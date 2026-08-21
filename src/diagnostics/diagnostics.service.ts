import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';

import { UnitAssessmentEntity } from '@/assessment/entities/unit-assessment.entity';
import {
  type BaselineVersionRecord,
  bumpBaselineVersion,
  CATALOG_BASELINE_VERSIONS,
  detectAnomalies,
  escalateTier,
  formatLogLine,
  integrityAfterAccepts,
  isMethodologyCode,
  type LogSortField,
  type LogSortOrder,
  matchClaim,
  NOISE_PER_REJECTION,
  recomputeAssessment,
  sortLogStream,
  type StreamTask,
  TIER_RULES,
  tierFromProbability,
} from '@/assessment/rebaseline';
import {
  computeAssessment,
  VERDICT_REPLICANT_THRESHOLD,
  windowFromNow,
} from '@/assessment/scoring';
import {
  AnomalyCode,
  AssessmentFeatureId,
  AssessmentOrigin,
  AssessmentVerdict,
  BaselineVersionSource,
  RebaselineCaseStatus,
  RebaselineTier,
} from '@/common';
import { TaskEntity } from '@/tasks/entities/task.entity';
import { UnitEntity } from '@/units/entities/unit.entity';

import { FileClaimDto } from './dto/diagnostics.dto';
import { BaselineVersionEntity } from './entities/baseline-version.entity';
import { RebaselineCaseEntity } from './entities/rebaseline-case.entity';
import { RebaselineClaimEntity } from './entities/rebaseline-claim.entity';

const ACTIVE_STATUSES = [
  RebaselineCaseStatus.Open,
  RebaselineCaseStatus.Ready,
  RebaselineCaseStatus.Escalated,
];

@Injectable()
export class DiagnosticsService {
  constructor(
    @InjectRepository(RebaselineCaseEntity)
    private readonly caseRepository: Repository<RebaselineCaseEntity>,
    @InjectRepository(RebaselineClaimEntity)
    private readonly claimRepository: Repository<RebaselineClaimEntity>,
    @InjectRepository(BaselineVersionEntity)
    private readonly versionRepository: Repository<BaselineVersionEntity>,
    @InjectRepository(UnitAssessmentEntity)
    private readonly assessmentRepository: Repository<UnitAssessmentEntity>,
    @InjectRepository(UnitEntity)
    private readonly unitRepository: Repository<UnitEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async ensureCatalog(): Promise<void> {
    const existing = await this.versionRepository
      .createQueryBuilder('version')
      .where('version.unitId IS NULL')
      .andWhere('version.source = :source', {
        source: BaselineVersionSource.Catalog,
      })
      .getCount();
    if (existing > 0) return;

    await this.versionRepository.save(
      CATALOG_BASELINE_VERSIONS.map((row) =>
        this.versionRepository.create({
          unit: null,
          version: row.version,
          replicantThreshold: row.replicantThreshold,
          source: BaselineVersionSource.Catalog,
          recordedAt: new Date(row.recordedAt),
        }),
      ),
    );
  }

  async openCase(
    unit: UnitEntity,
    assessment: UnitAssessmentEntity,
  ): Promise<RebaselineCaseEntity> {
    this.assertNotFinalLock(unit);
    await this.ensureCatalog();
    const existing = await this.findActiveCase(unit.id);
    if (existing) return existing;

    const tier = tierFromProbability(assessment.replicantProbability);
    const rules = TIER_RULES[tier];
    const rebaselineCase = this.caseRepository.create({
      unit,
      blockingAssessment: assessment,
      resultingAssessment: null,
      tier,
      integrity: 1,
      requiredClaims: rules.requiredClaims,
      acceptedCount: 0,
      rejectedCount: 0,
      maxRejected: rules.maxRejected,
      noise: 0,
      status: RebaselineCaseStatus.Open,
      baselineVersionAtOpen: unit.baselineVersion ?? 'v3.7.14',
    });
    return this.caseRepository.save(rebaselineCase);
  }

  async ensureCaseForBlockedUnit(
    unit: UnitEntity,
  ): Promise<RebaselineCaseEntity> {
    this.assertNotFinalLock(unit);
    const existing = await this.findActiveCase(unit.id);
    if (existing) return existing;

    const assessment = await this.ensureBlockingAssessment(unit);
    if (unit.blockingAssessmentId !== assessment.id) {
      unit.blockingAssessmentId = assessment.id;
      await this.unitRepository.save(unit);
    }
    return this.openCase(unit, assessment);
  }

  async getStatus(unitId: string) {
    const { unit, rebaselineCase, claims } =
      await this.loadActiveContext(unitId);
    return this.toStatus(unit, rebaselineCase, claims);
  }

  async getLogs(
    unitId: string,
    cursor?: string,
    limit = 100,
    sort: LogSortField = 'startDate',
    order: LogSortOrder = 'desc',
  ) {
    const { rebaselineCase } = await this.loadActiveContext(unitId);
    const { logs, tasks } = await this.detectForCase(rebaselineCase);
    const ordered = sortLogStream(logs, tasks, sort, order);
    const take = Math.min(Math.max(limit, 1), 200);
    let start = 0;
    if (cursor) {
      const index = ordered.findIndex((entry) => entry.id === cursor);
      start = index >= 0 ? index + 1 : 0;
    }
    const items = ordered.slice(start, start + take);
    const last = items[items.length - 1];
    const exhausted = start + items.length >= ordered.length;
    return {
      items: items.map((entry) => ({
        ...entry,
        line: formatLogLine(entry),
      })),
      nextCursor: exhausted || !last ? null : last.id,
    };
  }

  async getVersions(unitId: string) {
    await this.ensureCatalog();
    const rows = await this.versionRepository
      .createQueryBuilder('version')
      .leftJoinAndSelect('version.unit', 'unit')
      .where('version.unitId IS NULL OR version.unitId = :unitId', { unitId })
      .orderBy('version.recordedAt', 'ASC')
      .getMany();
    return rows.map((row) => ({
      version: row.version,
      replicantThreshold: row.replicantThreshold,
      source: row.source,
      recordedAt: row.recordedAt,
      isCatalog: row.unit === null,
    }));
  }

  async getClaims(unitId: string) {
    const { claims } = await this.loadActiveContext(unitId);
    return claims.map((claim) => ({
      id: claim.id,
      anomalyCode: claim.anomalyCode,
      targetFeature: claim.targetFeature,
      evidenceRefs: claim.evidenceRefs,
      accepted: claim.accepted,
      filedAt: claim.filedAt,
    }));
  }

  async fileClaim(unitId: string, dto: FileClaimDto) {
    const { unit, rebaselineCase, claims } =
      await this.loadActiveContext(unitId);

    if (
      rebaselineCase.status === RebaselineCaseStatus.Resolved ||
      rebaselineCase.status === RebaselineCaseStatus.Overridden
    ) {
      throw new ConflictException('CASE_CLOSED');
    }

    const alreadyAccepted = claims.some(
      (claim) => claim.accepted && claim.anomalyCode === dto.anomalyCode,
    );
    if (alreadyAccepted) {
      throw new ConflictException('CLAIM_ALREADY_ACCEPTED');
    }

    const remaining = Math.max(
      0,
      rebaselineCase.maxRejected - rebaselineCase.rejectedCount,
    );
    const { anomalies } = await this.detectForCase(rebaselineCase);
    const match = matchClaim(anomalies, dto.anomalyCode, dto.logRefs);
    const accepted = Boolean(match);

    if (!accepted && remaining <= 0) {
      throw new ConflictException('ATTEMPTS_EXHAUSTED');
    }

    const claim = this.claimRepository.create({
      rebaselineCase,
      anomalyCode: dto.anomalyCode,
      targetFeature: match?.targetFeature ?? null,
      evidenceRefs: dto.logRefs,
      accepted,
    });
    await this.claimRepository.save(claim);

    if (accepted) {
      rebaselineCase.acceptedCount += 1;
      rebaselineCase.integrity = integrityAfterAccepts(
        rebaselineCase.tier,
        rebaselineCase.acceptedCount,
      );
    } else {
      rebaselineCase.rejectedCount += 1;
      rebaselineCase.noise =
        Math.round((rebaselineCase.noise + NOISE_PER_REJECTION) * 10000) /
        10000;
    }

    const nextClaims = [...claims, claim];
    rebaselineCase.status = this.nextStatus(rebaselineCase, nextClaims);
    await this.caseRepository.save(rebaselineCase);

    return {
      accepted,
      targetFeature: claim.targetFeature,
      status: this.toStatus(unit, rebaselineCase, nextClaims),
    };
  }

  async rebaseline(unitId: string) {
    return this.dataSource.transaction(async (manager) => {
      const { unit, rebaselineCase, claims } =
        await this.loadActiveContext(unitId);
      const status = this.toStatus(unit, rebaselineCase, claims);
      if (!status.canRebaseline) {
        throw new ConflictException('RECLASSIFICATION_NOT_AVAILABLE');
      }

      const blocking = await this.loadBlockingAssessment(rebaselineCase);
      const acceptedFeatures = uniqueFeatures(claims);
      const merged = uniqueFeatureList([
        ...(unit.disqualifiedFeatures ?? []),
        ...acceptedFeatures,
      ]);
      const previousProbability = blocking.replicantProbability;
      const computed = recomputeAssessment(
        blocking,
        merged,
        rebaselineCase.noise,
      );

      const latest = await manager.findOne(UnitAssessmentEntity, {
        where: {
          unit: { id: unit.id },
          periodEnd: blocking.periodEnd,
        },
        order: { revision: 'DESC' },
      });
      const report = manager.create(UnitAssessmentEntity, {
        unit,
        periodStart: blocking.periodStart,
        periodEnd: blocking.periodEnd,
        computedAt: new Date(),
        sampleSize: computed.sampleSize,
        features: computed.features,
        metrics: computed.metrics,
        score: computed.score,
        replicantProbability: computed.replicantProbability,
        verdict: computed.verdict,
        revision: (latest?.revision ?? 0) + 1,
        origin: AssessmentOrigin.Rebaseline,
        disqualifiedFeatures: merged,
        supersedesAssessmentId: blocking.id,
        acknowledgedAt: new Date(),
      });
      const savedReport = await manager.save(report);

      const stillReplicant = computed.verdict === AssessmentVerdict.Replicant;
      let escalated = false;

      if (!stillReplicant) {
        unit.isBlocked = false;
        unit.blockedAt = null;
        unit.blockingAssessmentId = null;
        unit.reclassificationCount += 1;
        unit.disqualifiedFeatures = merged;
        unit.baselineVersion = bumpBaselineVersion(unit.baselineVersion);
        unit.lastAssessmentAt = savedReport.computedAt;
        rebaselineCase.status = RebaselineCaseStatus.Resolved;
        rebaselineCase.resultingAssessment = savedReport;
        await manager.save(
          manager.create(BaselineVersionEntity, {
            unit,
            version: unit.baselineVersion,
            replicantThreshold: TIER_RULES[RebaselineTier.Quarantined].minP,
            source: BaselineVersionSource.Reclassification,
            recordedAt: savedReport.computedAt,
          }),
        );
      } else {
        const nextTier = escalateTier(rebaselineCase.tier);
        escalated = nextTier !== rebaselineCase.tier;
        rebaselineCase.tier = nextTier;
        const rules = TIER_RULES[nextTier];
        rebaselineCase.requiredClaims = rules.requiredClaims;
        rebaselineCase.maxRejected = rules.maxRejected;
        rebaselineCase.integrity = integrityAfterAccepts(
          nextTier,
          rebaselineCase.acceptedCount,
        );
        rebaselineCase.status = RebaselineCaseStatus.Escalated;
        rebaselineCase.resultingAssessment = savedReport;
        unit.lastAssessmentAt = savedReport.computedAt;
      }

      await manager.save(unit);
      await manager.save(rebaselineCase);

      return {
        unblocked: !stillReplicant,
        escalated,
        previousProbability,
        verdict: computed.verdict,
        origin: AssessmentOrigin.Rebaseline,
        report: savedReport,
        status: this.toStatus(unit, rebaselineCase, claims),
      };
    });
  }

  async override(unitId: string) {
    return this.dataSource.transaction(async (manager) => {
      const { unit, rebaselineCase, claims } =
        await this.loadActiveContext(unitId);
      const status = this.toStatus(unit, rebaselineCase, claims);
      if (!status.canOverride) {
        throw new ConflictException('OVERRIDE_NOT_AVAILABLE');
      }

      const acceptedFeatures = uniqueFeatures(claims);
      const merged = uniqueFeatureList([
        ...(unit.disqualifiedFeatures ?? []),
        ...acceptedFeatures,
      ]);

      unit.isBlocked = false;
      unit.blockedAt = null;
      unit.blockingAssessmentId = null;
      unit.reclassificationCount += 1;
      unit.disqualifiedFeatures = merged;
      unit.baselineVersion = bumpBaselineVersion(unit.baselineVersion);
      unit.manualOverrideAt = new Date();
      rebaselineCase.status = RebaselineCaseStatus.Overridden;

      await manager.save(
        manager.create(BaselineVersionEntity, {
          unit,
          version: unit.baselineVersion,
          replicantThreshold: TIER_RULES[RebaselineTier.Quarantined].minP,
          source: BaselineVersionSource.Override,
          recordedAt: unit.manualOverrideAt,
        }),
      );
      await manager.save(unit);
      await manager.save(rebaselineCase);

      return {
        unblocked: true,
        status: this.toStatus(unit, rebaselineCase, claims),
      };
    });
  }

  async setTierByUnitname(unitname: string, tier: RebaselineTier) {
    const unit = await this.unitRepository.findOne({ where: { unitname } });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    if (!unit.isBlocked) {
      throw new ConflictException('UNIT_NOT_BLOCKED');
    }

    let rebaselineCase = await this.findActiveCase(unit.id);
    if (!rebaselineCase) {
      const assessment = unit.blockingAssessmentId
        ? await this.assessmentRepository.findOne({
            where: { id: unit.blockingAssessmentId },
            relations: ['unit'],
          })
        : await this.assessmentRepository.findOne({
            where: { unit: { id: unit.id } },
            order: { computedAt: 'DESC' },
            relations: ['unit'],
          });
      if (!assessment) {
        throw new NotFoundException('Assessment not found');
      }
      rebaselineCase = await this.openCase(unit, assessment);
    }

    const rules = TIER_RULES[tier];
    rebaselineCase.tier = tier;
    rebaselineCase.requiredClaims = rules.requiredClaims;
    rebaselineCase.maxRejected = rules.maxRejected;
    rebaselineCase.integrity = integrityAfterAccepts(
      tier,
      rebaselineCase.acceptedCount,
    );
    const claims = await this.claimsFor(rebaselineCase.id);
    rebaselineCase.status = this.nextStatus(rebaselineCase, claims);
    await this.caseRepository.save(rebaselineCase);
    return this.toStatus(unit, rebaselineCase, claims);
  }

  async onDebugUnblock(unitId: string, purgeHistory: boolean) {
    if (purgeHistory) {
      await this.claimRepository
        .createQueryBuilder()
        .delete()
        .from(RebaselineClaimEntity)
        .where(
          `"caseId" IN (SELECT id FROM rebaseline_cases WHERE "unitId" = :unitId)`,
          { unitId },
        )
        .execute();
      await this.caseRepository
        .createQueryBuilder()
        .delete()
        .from(RebaselineCaseEntity)
        .where('"unitId" = :unitId', { unitId })
        .execute();
      await this.versionRepository
        .createQueryBuilder()
        .delete()
        .from(BaselineVersionEntity)
        .where('"unitId" = :unitId', { unitId })
        .execute();
      return;
    }

    const open = await this.caseRepository.find({
      where: { unit: { id: unitId }, status: In(ACTIVE_STATUSES) },
    });
    for (const rebaselineCase of open) {
      rebaselineCase.status = RebaselineCaseStatus.Resolved;
    }
    if (open.length) {
      await this.caseRepository.save(open);
    }
  }

  private assertNotFinalLock(unit: UnitEntity) {
    if (unit.finalInvestigationAt) {
      throw new ConflictException('FINAL_INVESTIGATION_LOCK');
    }
  }

  private async loadActiveContext(unitId: string) {
    const unit = await this.unitRepository.findOne({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    this.assertNotFinalLock(unit);

    let rebaselineCase = await this.findActiveCase(unitId);
    if (!rebaselineCase && unit.isBlocked) {
      rebaselineCase = await this.ensureCaseForBlockedUnit(unit);
    }
    if (!rebaselineCase) {
      throw new NotFoundException('Diagnostics case not found');
    }

    const claims = await this.claimsFor(rebaselineCase.id);
    return { unit, rebaselineCase, claims };
  }

  private async ensureBlockingAssessment(
    unit: UnitEntity,
  ): Promise<UnitAssessmentEntity> {
    if (unit.blockingAssessmentId) {
      const blocking = await this.assessmentRepository.findOne({
        where: { id: unit.blockingAssessmentId },
        relations: ['unit'],
      });
      if (blocking) return blocking;
    }

    const latest = await this.assessmentRepository.findOne({
      where: { unit: { id: unit.id } },
      order: { computedAt: 'DESC' },
      relations: ['unit'],
    });
    if (latest) return latest;

    const { periodStart, periodEnd } = windowFromNow();
    const existingPeriod = await this.assessmentRepository.findOne({
      where: { unit: { id: unit.id }, periodEnd, revision: 0 },
      relations: ['unit'],
    });
    if (existingPeriod) return existingPeriod;

    const taskEntities = await this.taskRepository
      .createQueryBuilder('task')
      .where('task.unitId = :unitId', { unitId: unit.id })
      .andWhere('task.deadline BETWEEN :periodStart AND :periodEnd', {
        periodStart,
        periodEnd,
      })
      .getMany();

    let computed = computeAssessment(
      taskEntities.map((task) => ({
        category: task.category,
        complexity: task.complexity,
        createDate: task.createDate,
        startDate: task.startDate,
        deadline: task.deadline,
        completeDate: task.completeDate,
        overdueReason: task.overdueReason,
      })),
      periodStart,
      periodEnd,
    );
    if (unit.disqualifiedFeatures?.length) {
      computed = recomputeAssessment(computed, unit.disqualifiedFeatures, 0);
    }

    const report = this.assessmentRepository.create({
      unit,
      periodStart,
      periodEnd,
      computedAt: new Date(),
      sampleSize: computed.sampleSize,
      features: computed.features,
      metrics: computed.metrics,
      score: computed.score,
      replicantProbability: Math.max(
        computed.replicantProbability,
        VERDICT_REPLICANT_THRESHOLD,
      ),
      verdict: AssessmentVerdict.Replicant,
      revision: 0,
      origin: AssessmentOrigin.Scheduled,
      disqualifiedFeatures: unit.disqualifiedFeatures ?? [],
      supersedesAssessmentId: null,
      acknowledgedAt: new Date(),
    });

    try {
      return await this.assessmentRepository.save(report);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.assessmentRepository.findOne({
        where: { unit: { id: unit.id }, periodEnd, revision: 0 },
        relations: ['unit'],
      });
      if (!raced) throw error;
      return raced;
    }
  }

  private async findActiveCase(
    unitId: string,
  ): Promise<RebaselineCaseEntity | null> {
    return this.caseRepository.findOne({
      where: { unit: { id: unitId }, status: In(ACTIVE_STATUSES) },
      order: { createdAt: 'DESC' },
      relations: ['blockingAssessment', 'unit'],
    });
  }

  private claimsFor(caseId: string) {
    return this.claimRepository.find({
      where: { rebaselineCase: { id: caseId } },
      order: { filedAt: 'ASC' },
    });
  }

  private async loadBlockingAssessment(rebaselineCase: RebaselineCaseEntity) {
    if (rebaselineCase.blockingAssessment) {
      return rebaselineCase.blockingAssessment;
    }
    const loaded = await this.caseRepository.findOne({
      where: { id: rebaselineCase.id },
      relations: ['blockingAssessment'],
    });
    if (!loaded?.blockingAssessment) {
      throw new NotFoundException('Assessment not found');
    }
    return loaded.blockingAssessment;
  }

  private async detectForCase(rebaselineCase: RebaselineCaseEntity) {
    const assessment = await this.loadBlockingAssessment(rebaselineCase);
    const unitId = rebaselineCase.unit?.id;
    if (!unitId) {
      throw new NotFoundException('Unit not found');
    }
    const taskEntities = await this.taskRepository
      .createQueryBuilder('task')
      .where('task.unitId = :unitId', { unitId })
      .andWhere('task.deadline BETWEEN :periodStart AND :periodEnd', {
        periodStart: assessment.periodStart,
        periodEnd: assessment.periodEnd,
      })
      .getMany();
    const tasks: StreamTask[] = taskEntities.map((task) => ({
      id: task.id,
      category: task.category,
      complexity: task.complexity,
      createDate: task.createDate,
      startDate: task.startDate,
      deadline: task.deadline,
      completeDate: task.completeDate,
      overdueReason: task.overdueReason,
    }));
    const versions = await this.versionsForDetect(unitId);
    const detected = detectAnomalies(tasks, assessment.computedAt, versions);
    return { ...detected, tasks };
  }

  private async versionsForDetect(
    unitId: string,
  ): Promise<BaselineVersionRecord[]> {
    await this.ensureCatalog();
    const rows = await this.versionRepository
      .createQueryBuilder('version')
      .where('version.unitId IS NULL OR version.unitId = :unitId', { unitId })
      .orderBy('version.recordedAt', 'ASC')
      .getMany();
    return rows.map((row) => ({
      version: row.version,
      replicantThreshold: row.replicantThreshold,
      recordedAt: row.recordedAt,
      source: row.source,
    }));
  }

  private nextStatus(
    rebaselineCase: RebaselineCaseEntity,
    claims: RebaselineClaimEntity[],
  ): RebaselineCaseStatus {
    if (this.isReady(rebaselineCase, claims)) {
      return RebaselineCaseStatus.Ready;
    }
    if (rebaselineCase.status === RebaselineCaseStatus.Escalated) {
      return RebaselineCaseStatus.Escalated;
    }
    return RebaselineCaseStatus.Open;
  }

  private isReady(
    rebaselineCase: RebaselineCaseEntity,
    claims: RebaselineClaimEntity[],
  ): boolean {
    if (rebaselineCase.tier === RebaselineTier.Terminal) {
      return false;
    }
    const rules = TIER_RULES[rebaselineCase.tier];
    const accepted = claims.filter((claim) => claim.accepted);
    if (accepted.length < rules.requiredClaims) return false;
    if (rebaselineCase.integrity >= rules.integrityThreshold) return false;
    if (
      rules.requireMethodology &&
      !accepted.some((claim) => isMethodologyCode(claim.anomalyCode))
    ) {
      return false;
    }
    return true;
  }

  private toStatus(
    unit: UnitEntity,
    rebaselineCase: RebaselineCaseEntity,
    claims: RebaselineClaimEntity[],
  ) {
    const rules = TIER_RULES[rebaselineCase.tier];
    const accepted = claims.filter((claim) => claim.accepted);
    const remainingAttempts = Math.max(
      0,
      rebaselineCase.maxRejected - rebaselineCase.rejectedCount,
    );
    const canOverride =
      rebaselineCase.tier === RebaselineTier.Terminal &&
      accepted.some(
        (claim) => claim.anomalyCode === AnomalyCode.ThresholdMutation,
      );

    return {
      caseId: rebaselineCase.id,
      tier: rebaselineCase.tier,
      status: rebaselineCase.status,
      integrity: rebaselineCase.integrity,
      integrityThreshold: rules.integrityThreshold,
      requiredClaims: rebaselineCase.requiredClaims,
      acceptedCount: rebaselineCase.acceptedCount,
      rejectedCount: rebaselineCase.rejectedCount,
      maxRejected: rebaselineCase.maxRejected,
      remainingAttempts,
      noise: rebaselineCase.noise,
      canRebaseline: this.isReady(rebaselineCase, claims),
      canOverride,
      reclassificationCount: unit.reclassificationCount,
      baselineVersion: unit.baselineVersion,
      hasReclassificationHistory: unit.reclassificationCount > 0,
      disqualifiedFeatures: unit.disqualifiedFeatures ?? [],
      acceptedFeatures: uniqueFeatures(claims),
      blockingAssessmentId:
        rebaselineCase.blockingAssessment?.id ??
        unit.blockingAssessmentId ??
        '',
    };
  }
}

function uniqueFeatures(
  claims: RebaselineClaimEntity[],
): AssessmentFeatureId[] {
  return uniqueFeatureList(
    claims
      .filter((claim) => claim.accepted && claim.targetFeature)
      .map((claim) => claim.targetFeature as AssessmentFeatureId),
  );
}

function uniqueFeatureList(
  features: AssessmentFeatureId[],
): AssessmentFeatureId[] {
  return [...new Set(features)];
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code === '23505';
}
