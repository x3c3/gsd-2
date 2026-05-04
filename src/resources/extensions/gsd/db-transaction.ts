// Project/App: GSD-2
// File Purpose: Transaction depth and BEGIN/COMMIT/ROLLBACK helpers for the GSD database facade.

import type { DbAdapter } from "./db-adapter.js";

export class DbTransactionRunner {
  private depth = 0;

  isInTransaction(): boolean {
    return this.depth > 0;
  }

  transaction<T>(db: DbAdapter, fn: () => T): T {
    if (this.depth > 0) {
      return this.runNested(fn);
    }

    db.exec("BEGIN");
    this.depth++;
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    } finally {
      this.depth--;
    }
  }

  readTransaction<T>(
    db: DbAdapter,
    fn: () => T,
    logRollbackError: (error: Error) => void,
  ): T {
    if (this.depth > 0) {
      return this.runNested(fn);
    }

    db.exec("BEGIN DEFERRED");
    this.depth++;
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch (rollbackErr) {
        logRollbackError(rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr)));
      }
      throw err;
    } finally {
      this.depth--;
    }
  }

  private runNested<T>(fn: () => T): T {
    this.depth++;
    try {
      return fn();
    } finally {
      this.depth--;
    }
  }
}

export function createDbTransactionRunner(): DbTransactionRunner {
  return new DbTransactionRunner();
}
