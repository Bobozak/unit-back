import * as dotenv from 'dotenv';
import { Client } from 'pg';
import { parse } from 'pg-connection-string';

import {
  computeAssessment,
  type ScoringTask,
  windowFromNow,
} from '@/assessment/scoring';
import { AssessmentVerdict } from '@/common';

dotenv.config();

const UNITNAME = 'bobozak';
const DAYS = 7;
const SLOTS_PER_DAY = 4;
const SLACK_BY_SLOT = [0.1, 0.11, 0.12, 0.13];
const START_DELAY_MIN_BY_SLOT = [20, 25, 30, 35];
const COMPLEXITY_BY_SLOT = [9, 8, 9, 10];

const NULL_INPUT_DAYS = new Set([1, 3]);
const INVERSION_DAYS = new Set([2, 5]);
const RETROACTIVE_DAYS = new Set([4]);
const PRECOGNITIVE_DAYS = new Set([6]);

const OVERDUE_WORK_DAYS = new Set<number>();
const OVERDUE_LIFE_DAYS = new Set([0]);
const OVERDUE_LEARNING_DAYS = new Set([1]);
const NIGHT_SLOT3_DAYS = new Set([0, 2, 4, 6]);

const WORK_TITLES = [
  'Standup notes',
  'Review checkout PR',
  'Client follow-up',
  'Fix login timeout',
  'Update API docs',
  'Estimate sprint tickets',
  'Draft Q3 status',
  'Pair on search bug',
  'Deploy staging',
  'Reply to hiring loop',
  'Triage Sentry errors',
  'Write migration notes',
];

const LIFE_TITLES = [
  'Grocery run',
  'Gym — 45 minutes',
  'Cook dinner',
  'Laundry',
  'Pay the rent reminder',
  'Walk 8k steps',
  'Call parents',
  'Clean the kitchen',
  'Pharmacy pickup',
  'Water the plants',
  'Take out recycling',
  'Meal-prep leftovers',
];

const LEARNING_TITLES = [
  'Read chapter 4',
  'TypeScript course module',
  'Algorithm kata',
  'Watch conference talk',
  'Write learning notes',
  'Practice SQL joins',
  'Read the RFC',
  'Anki review',
  'Sketch a system diagram',
  "Redo yesterday's kata",
];

type Category = 'work' | 'life' | 'learning';
type Priority = 'high' | 'medium' | 'low';

type SeedTask = {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  complexity: number;
  createDate: Date;
  startDate: Date;
  deadline: Date;
  completeDate: Date;
  overdueReason: string | null;
};

function pick(list: string[], index: number): string {
  return list[index % list.length];
}

function atHours(dayStart: Date, hours: number, minutes = 0): Date {
  const next = new Date(dayStart);
  next.setUTCHours(hours, minutes, 0, 0);
  return next;
}

function categoryFor(day: number, slot: number): Category {
  if (slot === 0) return 'work';
  if (slot === 1) return 'life';
  if (slot === 2) return 'learning';
  return day < 4 ? 'work' : 'life';
}

function priorityFor(category: Category, slot: number): Priority {
  if (category === 'work') return slot === 0 ? 'high' : 'medium';
  if (category === 'life') return slot === 1 ? 'medium' : 'low';
  return 'low';
}

function titlesFor(category: Category): string[] {
  if (category === 'work') return WORK_TITLES;
  if (category === 'life') return LIFE_TITLES;
  return LEARNING_TITLES;
}

function isOverdue(day: number, slot: number): boolean {
  return (
    (OVERDUE_WORK_DAYS.has(day) && slot === 0) ||
    (OVERDUE_LIFE_DAYS.has(day) && slot === 1) ||
    (OVERDUE_LEARNING_DAYS.has(day) && slot === 2)
  );
}

function isNight(day: number, slot: number): boolean {
  if (isOverdue(day, slot)) return false;
  if (slot === 2) return true;
  return slot === 3 && NIGHT_SLOT3_DAYS.has(day);
}

function standardTimes(
  dayStart: Date,
  slot: number,
  night: boolean,
): Pick<SeedTask, 'createDate' | 'startDate' | 'deadline' | 'completeDate'> {
  const slack = SLACK_BY_SLOT[slot];
  const deadline = atHours(dayStart, night ? 7 : 12 + slot * 3);
  const spanHours = night ? 24 : 36;
  const createDate = new Date(deadline.getTime() - spanHours * 3_600_000);
  const startDate = new Date(
    createDate.getTime() + START_DELAY_MIN_BY_SLOT[slot] * 60_000,
  );
  const span = deadline.getTime() - startDate.getTime();
  const completeDate = new Date(deadline.getTime() - slack * span);
  return { createDate, startDate, deadline, completeDate };
}

function descriptionFor(
  title: string,
  category: Category,
  overdue: boolean,
): string {
  if (overdue) {
    return `${title} slipped past the deadline during a compressed ${category} block.`;
  }
  return `${title} — ordinary ${category} block, closed in the usual window.`;
}

function buildBobozakTasks(periodStart: Date): SeedTask[] {
  const tasks: SeedTask[] = [];

  for (let day = 0; day < DAYS; day += 1) {
    const dayStart = new Date(periodStart.getTime() + day * 86_400_000);

    for (let slot = 0; slot < SLOTS_PER_DAY; slot += 1) {
      const category = categoryFor(day, slot);
      const overdue = isOverdue(day, slot);
      const night = isNight(day, slot);
      const title = pick(titlesFor(category), day * SLOTS_PER_DAY + slot);
      let complexity = COMPLEXITY_BY_SLOT[slot];
      let overdueReason: string | null = overdue ? 'rush' : null;
      let times = standardTimes(dayStart, slot, night);

      if (slot === 0 && NULL_INPUT_DAYS.has(day)) {
        const deadline = atHours(dayStart, 18);
        const createDate = new Date(deadline.getTime() - 36 * 3_600_000);
        const startDate = new Date(deadline.getTime() - 35_000);
        times = {
          createDate,
          startDate,
          deadline,
          completeDate: new Date(startDate.getTime() + 30_000),
        };
        complexity = 8;
        overdueReason = null;
      } else if (slot === 0 && INVERSION_DAYS.has(day)) {
        const deadline = atHours(dayStart, 18);
        const createDate = new Date(deadline.getTime() - 36 * 3_600_000);
        const startDate = new Date(deadline.getTime() + 3_600_000);
        times = {
          createDate,
          startDate,
          deadline,
          completeDate: new Date(startDate.getTime() - 2 * 3_600_000),
        };
        overdueReason = null;
      } else if (slot === 0 && RETROACTIVE_DAYS.has(day)) {
        const deadline = atHours(dayStart, 18);
        const createDate = new Date(deadline);
        const startDate = new Date(createDate.getTime() + 20 * 60_000);
        times = {
          createDate,
          startDate,
          deadline,
          completeDate: new Date(startDate.getTime() + 3_600_000),
        };
        overdueReason = 'rush';
      } else if (slot === 0 && PRECOGNITIVE_DAYS.has(day)) {
        times = standardTimes(dayStart, slot, false);
        times = {
          ...times,
          startDate: new Date(times.createDate.getTime() - 3_600_000),
        };
      } else if (overdue) {
        times = standardTimes(dayStart, slot, false);
        times = {
          ...times,
          completeDate: new Date(times.deadline.getTime() + 25 * 60_000),
        };
      }

      tasks.push({
        title,
        description: descriptionFor(title, category, Boolean(overdueReason)),
        category,
        priority: priorityFor(category, slot),
        complexity,
        overdueReason,
        ...times,
      });
    }
  }

  return tasks;
}

function toScoringTask(task: SeedTask): ScoringTask {
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

function assertTargetScore(
  tasks: SeedTask[],
  periodStart: Date,
  periodEnd: Date,
) {
  const computed = computeAssessment(
    tasks.map(toScoringTask),
    periodStart,
    periodEnd,
  );

  console.log(
    `Assessment preview: n=${computed.sampleSize} score=${computed.score} p=${computed.replicantProbability} verdict=${computed.verdict}`,
  );

  if (
    computed.verdict !== AssessmentVerdict.Replicant ||
    computed.replicantProbability < 0.75 ||
    computed.replicantProbability >= 0.9
  ) {
    throw new Error(
      `Seed missed RESTRICTED target (p≈0.82). Got p=${computed.replicantProbability} verdict=${computed.verdict}`,
    );
  }

  return computed;
}

async function seedBobozakTasks() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const { periodStart, periodEnd } = windowFromNow();
  const tasks = buildBobozakTasks(periodStart);
  assertTargetScore(tasks, periodStart, periodEnd);

  const dbConfig = parse(connectionString);
  const isLocalHost =
    dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1';

  const client = new Client({
    connectionString,
    ...(isLocalHost ? {} : { ssl: { rejectUnauthorized: false } }),
  });

  await client.connect();

  try {
    const unit = await client.query<{ id: string }>(
      'SELECT id FROM units WHERE unitname = $1',
      [UNITNAME],
    );

    if (!unit.rowCount) {
      throw new Error(`Unit "${UNITNAME}" not found`);
    }

    const unitId = unit.rows[0].id;

    await client.query('BEGIN');
    await client.query(
      'DELETE FROM notes WHERE "taskId" IN (SELECT id FROM tasks WHERE "unitId" = $1)',
      [unitId],
    );
    await client.query('DELETE FROM tasks WHERE "unitId" = $1', [unitId]);

    const columns = [
      'title',
      'description',
      'category',
      'priority',
      'complexity',
      '"createDate"',
      '"startDate"',
      'deadline',
      '"completeDate"',
      '"overdueReason"',
      '"unitId"',
    ];
    const placeholders: string[] = [];
    const values: unknown[] = [];

    tasks.forEach((task, index) => {
      const offset = index * 11;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`,
      );
      values.push(
        task.title,
        task.description,
        task.category,
        task.priority,
        task.complexity,
        task.createDate,
        task.startDate,
        task.deadline,
        task.completeDate,
        task.overdueReason,
        unitId,
      );
    });

    await client.query(
      `INSERT INTO tasks (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`,
      values,
    );
    await client.query('COMMIT');

    console.log(
      `Seeded ${tasks.length} tasks for ${UNITNAME} (${periodStart.toISOString()} → ${periodEnd.toISOString()})`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void seedBobozakTasks().catch((error) => {
  console.error(
    'Bobozak task seed failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
