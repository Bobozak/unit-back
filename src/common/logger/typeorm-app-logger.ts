import { Logger } from '@nestjs/common';
import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';

import { redactText } from './redact';

export class TypeOrmAppLogger implements TypeOrmLogger {
  private readonly logger = new Logger('TypeORM');

  logQuery(
    _query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    return undefined;
  }

  logQueryError(
    error: string | Error,
    query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    const detail = error instanceof Error ? error.message : error;
    this.logger.error({
      message: 'query failed',
      error: redactText(detail),
      query: redactText(query),
    });
  }

  logQuerySlow(
    time: number,
    query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    this.logger.warn({
      message: 'slow query',
      durationMs: time,
      query: redactText(query),
    });
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner): void {
    this.logger.log(redactText(message));
  }

  logMigration(message: string, _queryRunner?: QueryRunner): void {
    this.logger.log(redactText(message));
  }

  log(
    level: 'log' | 'info' | 'warn',
    message: unknown,
    _queryRunner?: QueryRunner,
  ): void {
    const text = redactText(String(message));
    if (level === 'warn') {
      this.logger.warn(text);
      return;
    }

    this.logger.log(text);
  }
}
