import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export type RequestLogContext = {
  requestId: string;
  unitId?: string;
};

export const requestContext = new AsyncLocalStorage<RequestLogContext>();

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function resolveRequestId(header?: string): string {
  if (header && REQUEST_ID_PATTERN.test(header)) {
    return header;
  }

  return randomUUID();
}

export function bindRequestUnit(unitId: unknown): void {
  if (typeof unitId !== 'string' || !unitId) {
    return;
  }

  const store = requestContext.getStore();
  if (store) {
    store.unitId = unitId;
  }
}
