import * as dotenv from 'dotenv';
import { Client } from 'pg';
import { parse } from 'pg-connection-string';

dotenv.config();

const UNITNAME = 'bobozak';

type Category = 'work' | 'life' | 'learning';
type Priority = 'high' | 'medium' | 'low';

type SeedTask = {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  complexity: number;
  createDate: Date;
  startDate: Date | null;
  deadline: Date;
  completeDate: Date | null;
  overdueReason: string | null;
};

function utcDay(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

function atUtc(day: Date, hours: number, minutes = 0): Date {
  const next = new Date(day);
  next.setUTCHours(hours, minutes, 0, 0);
  return next;
}

function buildFilterTestTasks(now: Date): SeedTask[] {
  const today = utcDay(0);
  const yesterday = utcDay(-1);
  const twoDaysAgo = utcDay(-2);
  const threeDaysAgo = utcDay(-3);
  const fourDaysAgo = utcDay(-4);

  return [
    // work — not started
    {
      title: 'review pr backlog',
      description: 'Filter fixture: work, not started, high, complexity 11.',
      category: 'work',
      priority: 'high',
      complexity: 11,
      createDate: new Date(now.getTime() - 2 * 3_600_000),
      startDate: null,
      deadline: atUtc(utcDay(4), 18, 0),
      completeDate: null,
      overdueReason: null,
    },
    // work — in progress
    {
      title: 'fix login timeout',
      description: 'Filter fixture: work, in progress, medium, complexity 18.',
      category: 'work',
      priority: 'medium',
      complexity: 18,
      createDate: atUtc(today, 6, 0),
      startDate: atUtc(today, 7, 0),
      deadline: atUtc(today, 22, 0),
      completeDate: null,
      overdueReason: null,
    },
    // work — overdue
    {
      title: 'update api docs',
      description: 'Filter fixture: work, overdue, low, complexity 4.',
      category: 'work',
      priority: 'low',
      complexity: 4,
      createDate: atUtc(yesterday, 8, 0),
      startDate: atUtc(yesterday, 9, 0),
      deadline: atUtc(yesterday, 17, 0),
      completeDate: null,
      overdueReason: null,
    },
    // work — completed
    {
      title: 'deploy staging build',
      description: 'Filter fixture: work, completed, high, complexity 18.',
      category: 'work',
      priority: 'high',
      complexity: 18,
      createDate: atUtc(twoDaysAgo, 8, 0),
      startDate: atUtc(twoDaysAgo, 9, 0),
      deadline: atUtc(twoDaysAgo, 18, 0),
      completeDate: atUtc(twoDaysAgo, 16, 30),
      overdueReason: null,
    },
    // life — not started
    {
      title: 'grocery run',
      description: 'Filter fixture: life, not started, medium, complexity 18.',
      category: 'life',
      priority: 'medium',
      complexity: 18,
      createDate: new Date(now.getTime() - 3_600_000),
      startDate: null,
      deadline: atUtc(utcDay(3), 20, 0),
      completeDate: null,
      overdueReason: null,
    },
    // life — in progress
    {
      title: 'gym session',
      description: 'Filter fixture: life, in progress, low, complexity 4.',
      category: 'life',
      priority: 'low',
      complexity: 4,
      createDate: atUtc(today, 6, 30),
      startDate: atUtc(today, 8, 0),
      deadline: atUtc(today, 21, 0),
      completeDate: null,
      overdueReason: null,
    },
    // life — overdue
    {
      title: 'pay rent reminder',
      description: 'Filter fixture: life, overdue, high, complexity 11.',
      category: 'life',
      priority: 'high',
      complexity: 11,
      createDate: atUtc(yesterday, 7, 0),
      startDate: atUtc(yesterday, 8, 0),
      deadline: atUtc(yesterday, 16, 0),
      completeDate: null,
      overdueReason: null,
    },
    // life — completed
    {
      title: 'cook dinner',
      description: 'Filter fixture: life, completed, medium, complexity 18.',
      category: 'life',
      priority: 'medium',
      complexity: 18,
      createDate: atUtc(threeDaysAgo, 10, 0),
      startDate: atUtc(threeDaysAgo, 11, 0),
      deadline: atUtc(threeDaysAgo, 19, 0),
      completeDate: atUtc(threeDaysAgo, 18, 0),
      overdueReason: null,
    },
    // learning — not started
    {
      title: 'read chapter 5',
      description: 'Filter fixture: learning, not started, low, complexity 4.',
      category: 'learning',
      priority: 'low',
      complexity: 4,
      createDate: new Date(now.getTime() - 30 * 60_000),
      startDate: null,
      deadline: atUtc(utcDay(2), 21, 0),
      completeDate: null,
      overdueReason: null,
    },
    // learning — in progress
    {
      title: 'typescript course module',
      description:
        'Filter fixture: learning, in progress, high, complexity 11.',
      category: 'learning',
      priority: 'high',
      complexity: 11,
      createDate: atUtc(today, 7, 0),
      startDate: atUtc(today, 9, 0),
      deadline: atUtc(today, 23, 0),
      completeDate: null,
      overdueReason: null,
    },
    // learning — overdue
    {
      title: 'algorithm kata',
      description: 'Filter fixture: learning, overdue, medium, complexity 18.',
      category: 'learning',
      priority: 'medium',
      complexity: 18,
      createDate: atUtc(yesterday, 9, 0),
      startDate: atUtc(yesterday, 10, 0),
      deadline: atUtc(yesterday, 18, 0),
      completeDate: null,
      overdueReason: null,
    },
    // learning — completed
    {
      title: 'anki review',
      description: 'Filter fixture: learning, completed, low, complexity 4.',
      category: 'learning',
      priority: 'low',
      complexity: 4,
      createDate: atUtc(fourDaysAgo, 8, 0),
      startDate: atUtc(fourDaysAgo, 9, 0),
      deadline: atUtc(fourDaysAgo, 17, 0),
      completeDate: atUtc(fourDaysAgo, 15, 0),
      overdueReason: null,
    },
  ];
}

async function seedBobozakFilterTestTasks() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const now = new Date();
  const tasks = buildFilterTestTasks(now);

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
      `Seeded ${tasks.length} filter-test tasks for ${UNITNAME} (at ${now.toISOString()})`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void seedBobozakFilterTestTasks().catch((error) => {
  console.error(
    'Bobozak filter-test task seed failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
