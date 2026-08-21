import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import {
  AssessmentFeatureId,
  AssessmentOrigin,
  AssessmentVerdict,
} from '@/common';
import { DiagnosticsService } from '@/diagnostics/diagnostics.service';
import { TaskEntity } from '@/tasks/entities/task.entity';
import { UnitEntity } from '@/units/entities/unit.entity';

import { SimulateAssessmentDto } from './dto/simulate-assessment.dto';
import { UnitAssessmentEntity } from './entities/unit-assessment.entity';
import { recomputeAssessment } from './rebaseline';
import {
  type AssessmentComputation,
  BATCH_SIZE,
  computeAssessment,
  FINAL_INVESTIGATION_STRIKES,
  type ScoringTask,
  windowFromNow,
} from './scoring';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    @InjectRepository(UnitAssessmentEntity)
    private readonly assessmentRepository: Repository<UnitAssessmentEntity>,
    @InjectRepository(UnitEntity)
    private readonly unitRepository: Repository<UnitEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly configService: ConfigService,
    private readonly diagnosticsService: DiagnosticsService,
  ) {}

  async getLatest(unitId: string): Promise<UnitAssessmentEntity> {
    const report = await this.assessmentRepository.findOne({
      where: { unit: { id: unitId } },
      order: { computedAt: 'DESC' },
    });

    if (!report) {
      throw new NotFoundException('Assessment not found');
    }

    return report;
  }

  async getHistory(
    unitId: string,
    limit = 12,
  ): Promise<UnitAssessmentEntity[]> {
    return this.assessmentRepository.find({
      where: { unit: { id: unitId } },
      order: { computedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
      select: [
        'id',
        'computedAt',
        'periodEnd',
        'sampleSize',
        'score',
        'replicantProbability',
        'verdict',
      ],
    });
  }

  async acknowledge(unitId: string): Promise<UnitAssessmentEntity> {
    const report = await this.getLatest(unitId);
    if (!report.acknowledgedAt) {
      report.acknowledgedAt = new Date();
      await this.assessmentRepository.save(report);
    }
    return report;
  }

  async runAll(): Promise<{
    processed: number;
    blocked: number;
    skipped: number;
    failed: number;
  }> {
    const summary = { processed: 0, blocked: 0, skipped: 0, failed: 0 };
    let skip = 0;

    for (;;) {
      const units = await this.unitRepository.find({
        where: { isVerified: true },
        select: ['id'],
        skip,
        take: BATCH_SIZE,
        order: { createdAt: 'ASC' },
      });

      if (!units.length) {
        break;
      }

      for (const unit of units) {
        try {
          const result = await this.assessUnit(unit.id);
          if (result === 'skipped') {
            summary.skipped += 1;
          } else {
            summary.processed += 1;
            if (result === 'blocked') {
              summary.blocked += 1;
            }
          }
        } catch (error) {
          summary.failed += 1;
          this.logger.error(
            `Assessment failed for unit ${unit.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      skip += units.length;
      if (units.length < BATCH_SIZE) {
        break;
      }
    }

    return summary;
  }

  async runOne(unitId: string): Promise<{
    processed: number;
    blocked: number;
    skipped: number;
    failed: number;
  }> {
    const unit = await this.unitRepository.findOne({
      where: { id: unitId, isVerified: true },
      select: ['id'],
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    try {
      const result = await this.assessUnit(unit.id);
      return {
        processed: result === 'skipped' ? 0 : 1,
        blocked: result === 'blocked' ? 1 : 0,
        skipped: result === 'skipped' ? 1 : 0,
        failed: 0,
      };
    } catch (error) {
      this.logger.error(
        `Assessment failed for unit ${unit.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { processed: 0, blocked: 0, skipped: 0, failed: 1 };
    }
  }

  simulate(dto: SimulateAssessmentDto) {
    const now = dto.now ? new Date(dto.now) : new Date();
    const { periodStart, periodEnd } = windowFromNow(now);
    const tasks: ScoringTask[] = dto.tasks.map((task) => ({
      category: task.category,
      complexity: task.complexity,
      createDate: new Date(task.createDate),
      startDate: task.startDate ? new Date(task.startDate) : null,
      deadline: new Date(task.deadline),
      completeDate: task.completeDate ? new Date(task.completeDate) : null,
      overdueReason: task.overdueReason ?? null,
    }));

    return {
      periodStart,
      periodEnd,
      ...computeAssessment(tasks, periodStart, periodEnd),
    };
  }

  async blockByUnitname(unitname: string) {
    const unit = await this.findByUnitname(unitname);
    const now = new Date();

    if (unit.finalInvestigationAt) {
      unit.isBlocked = true;
      unit.blockedAt = unit.blockedAt ?? now;
      await this.unitRepository.save(unit);
      return this.toBlockStatus(unit);
    }

    unit.replicantStrikeCount = (unit.replicantStrikeCount ?? 0) + 1;
    unit.isBlocked = true;
    unit.blockedAt = now;

    if (unit.replicantStrikeCount >= FINAL_INVESTIGATION_STRIKES) {
      unit.finalInvestigationAt = now;
      await this.unitRepository.save(unit);
      return this.toBlockStatus(unit);
    }

    await this.unitRepository.save(unit);
    await this.diagnosticsService.ensureCaseForBlockedUnit(unit);
    const updated = await this.findByUnitname(unitname);
    return this.toBlockStatus(updated);
  }

  async unblockByUnitname(unitname: string, purgeHistory = false) {
    const unit = await this.findByUnitname(unitname);

    if (purgeHistory) {
      await this.diagnosticsService.onDebugUnblock(unit.id, true);
      await this.assessmentRepository
        .createQueryBuilder()
        .delete()
        .from(UnitAssessmentEntity)
        .where('"unitId" = :unitId', { unitId: unit.id })
        .execute();
      unit.replicantStrikeCount = 0;
      unit.finalInvestigationAt = null;
    } else {
      await this.diagnosticsService.onDebugUnblock(unit.id, false);
    }

    unit.isBlocked = false;
    unit.blockedAt = null;
    unit.blockingAssessmentId = null;
    await this.unitRepository.save(unit);
    return this.toBlockStatus(unit);
  }

  isDebugRoutesEnabled(): boolean {
    return (
      this.configService.get<string>('ASSESSMENT_DEBUG_ROUTES_ENABLED') ===
      'true'
    );
  }

  private async assessUnit(
    unitId: string,
  ): Promise<'ok' | 'blocked' | 'skipped'> {
    const { periodStart, periodEnd } = windowFromNow();

    const existing = await this.assessmentRepository.findOne({
      where: { unit: { id: unitId }, periodEnd, revision: 0 },
      select: ['id'],
    });
    if (existing) {
      return 'skipped';
    }

    const taskEntities = await this.taskRepository
      .createQueryBuilder('task')
      .where('task.unitId = :unitId', { unitId })
      .andWhere('task.deadline BETWEEN :periodStart AND :periodEnd', {
        periodStart,
        periodEnd,
      })
      .getMany();

    const unit = await this.unitRepository.findOneByOrFail({ id: unitId });
    const computed = applyStoredDisqualifications(
      computeAssessment(
        taskEntities.map(toScoringTask),
        periodStart,
        periodEnd,
      ),
      unit.disqualifiedFeatures ?? [],
    );

    const report = this.assessmentRepository.create({
      unit,
      periodStart,
      periodEnd,
      computedAt: new Date(),
      sampleSize: computed.sampleSize,
      features: computed.features,
      metrics: computed.metrics,
      score: computed.score,
      replicantProbability: computed.replicantProbability,
      verdict: computed.verdict,
      revision: 0,
      origin: AssessmentOrigin.Scheduled,
      disqualifiedFeatures: unit.disqualifiedFeatures ?? [],
      supersedesAssessmentId: null,
      acknowledgedAt: null,
    });

    try {
      await this.assessmentRepository.save(report);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'skipped';
      }
      throw error;
    }

    unit.lastAssessmentAt = report.computedAt;

    if (computed.verdict === AssessmentVerdict.Replicant) {
      if (unit.finalInvestigationAt) {
        await this.unitRepository.save(unit);
        return 'blocked';
      }

      unit.replicantStrikeCount = (unit.replicantStrikeCount ?? 0) + 1;
      unit.isBlocked = true;
      unit.blockedAt = report.computedAt;
      unit.blockingAssessmentId = report.id;

      if (unit.replicantStrikeCount >= FINAL_INVESTIGATION_STRIKES) {
        unit.finalInvestigationAt = report.computedAt;
        await this.unitRepository.save(unit);
        return 'blocked';
      }

      await this.unitRepository.save(unit);
      await this.diagnosticsService.openCase(unit, report);
      return 'blocked';
    }

    await this.unitRepository.save(unit);
    return 'ok';
  }

  private async findByUnitname(unitname: string): Promise<UnitEntity> {
    const unit = await this.unitRepository.findOne({ where: { unitname } });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    return unit;
  }

  private toBlockStatus(unit: UnitEntity) {
    return {
      unitname: unit.unitname,
      isBlocked: unit.isBlocked,
      blockedAt: unit.blockedAt,
      blockingAssessmentId: unit.blockingAssessmentId,
      replicantStrikeCount: unit.replicantStrikeCount ?? 0,
      finalInvestigationAt: unit.finalInvestigationAt ?? null,
    };
  }
}

function toScoringTask(task: TaskEntity): ScoringTask {
  return {
    category: task.category,
    complexity: task.complexity,
    createDate: task.createDate,
    startDate: task.startDate,
    deadline: task.deadline,
    completeDate: task.completeDate,
    overdueReason: task.overdueReason,
  };
}

function applyStoredDisqualifications(
  computed: AssessmentComputation,
  disqualified: AssessmentFeatureId[],
): AssessmentComputation {
  if (!disqualified.length) {
    return computed;
  }
  return recomputeAssessment(computed, disqualified, 0);
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code === '23505';
}
