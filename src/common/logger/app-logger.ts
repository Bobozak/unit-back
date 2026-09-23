import { ConsoleLogger, ConsoleLoggerOptions, LogLevel } from '@nestjs/common';

import { isPlainObject, redactObject, redactText } from './redact';
import { requestContext } from './request-context';

const RESERVED_FIELDS = new Set([
  'level',
  'pid',
  'timestamp',
  'context',
  'message',
]);

type JsonLogOptions = {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: 'stdout' | 'stderr';
  errorStack?: unknown;
};

export class AppLogger extends ConsoleLogger {
  constructor(context: string, options: ConsoleLoggerOptions) {
    super(context, options);
  }

  protected printAsJson(message: unknown, options: JsonLogOptions): void {
    try {
      super.printAsJson(message, options);
    } catch {
      super.printAsJson(redactText(String(message)), options);
    }
  }

  protected stringifyMessage(message: unknown, logLevel: LogLevel) {
    if (typeof message === 'string') {
      return super.stringifyMessage(redactText(message), logLevel);
    }

    if (message instanceof Error) {
      const stack = message.stack ? `\n${redactText(message.stack)}` : '';
      return super.stringifyMessage(
        `${message.name}: ${redactText(message.message)}${stack}`,
        logLevel,
      );
    }

    if (isPlainObject(message)) {
      return super.stringifyMessage(redactObject(message), logLevel);
    }

    return super.stringifyMessage(message, logLevel);
  }

  protected printStackTrace(stack: string): void {
    super.printStackTrace(
      typeof stack === 'string' ? redactText(stack) : stack,
    );
  }

  protected formatContext(context: string): string {
    const requestId = requestContext.getStore()?.requestId;
    const label = [context, requestId].filter(Boolean).join(' ');
    return super.formatContext(label);
  }

  protected getJsonLogObject(message: unknown, options: JsonLogOptions) {
    const store = requestContext.getStore();
    const error = message instanceof Error ? message : undefined;
    const fields = isPlainObject(message) ? message : undefined;
    const stack = firstString(options.errorStack, error?.stack, fields?.stack);
    const text = error
      ? redactText(error.message)
      : fields
        ? textFromField(fields.message)
        : redactText(typeof message === 'string' ? message : String(message));

    const logObject: Record<string, unknown> = {
      level: options.logLevel,
      pid: process.pid,
      timestamp: Date.now(),
      message: text,
    };

    if (options.context) {
      logObject.context = options.context;
    }

    if (stack) {
      logObject.stack = redactText(stack);
    }

    if (error?.name) {
      logObject.error = error.name;
    }

    const cause = (error as { cause?: unknown } | undefined)?.cause;
    if (cause instanceof Error) {
      logObject.cause = redactText(cause.message);
    }

    if (store?.requestId && logObject.requestId === undefined) {
      logObject.requestId = store.requestId;
    }

    if (store?.unitId && logObject.unitId === undefined) {
      logObject.unitId = store.unitId;
    }

    if (fields) {
      for (const [key, value] of Object.entries(redactObject(fields))) {
        if (RESERVED_FIELDS.has(key) || logObject[key] !== undefined) {
          continue;
        }

        logObject[key] = value;
      }
    }

    return logObject as {
      level: LogLevel;
      pid: number;
      timestamp: number;
      message: unknown;
      context?: string;
      stack?: unknown;
    };
  }
}

function textFromField(value: unknown): string {
  if (typeof value === 'string') {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return redactText(value.map((item) => String(item)).join('; '));
  }

  if (value === undefined || value === null) {
    return 'log';
  }

  return redactText(String(value));
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value) {
      return value;
    }
  }

  return undefined;
}
