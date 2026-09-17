export const APPLICATIONS_CLOSES_AT_MS = Date.parse("2026-09-18T00:00:00.000Z");

export const applicationsAreClosed = (nowMs: number = Date.now()): boolean =>
  nowMs >= APPLICATIONS_CLOSES_AT_MS;
