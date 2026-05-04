// Project/App: GSD-2
// File Purpose: Tests for DB transaction depth and rollback helpers.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createDbTransactionRunner } from "../db-transaction.ts";
import type { DbAdapter, DbStatement } from "../db-adapter.ts";

class FakeAdapter implements DbAdapter {
  readonly calls: string[] = [];
  failExec = new Set<string>();

  exec(sql: string): void {
    this.calls.push(sql);
    if (this.failExec.has(sql)) throw new Error(`failed ${sql}`);
  }

  prepare(): DbStatement {
    throw new Error("prepare is not used by DbTransactionRunner tests");
  }

  close(): void {}
}

describe("db-transaction", () => {
  test("commits successful write transactions", () => {
    const runner = createDbTransactionRunner();
    const db = new FakeAdapter();

    const result = runner.transaction(db, () => {
      assert.equal(runner.isInTransaction(), true);
      return "ok";
    });

    assert.equal(result, "ok");
    assert.equal(runner.isInTransaction(), false);
    assert.deepEqual(db.calls, ["BEGIN", "COMMIT"]);
  });

  test("rolls back failed write transactions and clears depth", () => {
    const runner = createDbTransactionRunner();
    const db = new FakeAdapter();

    assert.throws(
      () => runner.transaction(db, () => {
        throw new Error("boom");
      }),
      /boom/,
    );

    assert.equal(runner.isInTransaction(), false);
    assert.deepEqual(db.calls, ["BEGIN", "ROLLBACK"]);
  });

  test("nested transactions do not issue nested BEGIN or COMMIT", () => {
    const runner = createDbTransactionRunner();
    const db = new FakeAdapter();

    runner.transaction(db, () => {
      runner.transaction(db, () => {
        assert.equal(runner.isInTransaction(), true);
      });
    });

    assert.deepEqual(db.calls, ["BEGIN", "COMMIT"]);
  });

  test("failed BEGIN does not mark transaction depth active", () => {
    const runner = createDbTransactionRunner();
    const db = new FakeAdapter();
    db.failExec.add("BEGIN");

    assert.throws(() => runner.transaction(db, () => undefined), /failed BEGIN/);

    assert.equal(runner.isInTransaction(), false);
    assert.deepEqual(db.calls, ["BEGIN"]);
  });

  test("read transactions log rollback failures and clear depth", () => {
    const runner = createDbTransactionRunner();
    const db = new FakeAdapter();
    const rollbackErrors: Error[] = [];
    db.failExec.add("ROLLBACK");

    assert.throws(
      () => runner.readTransaction(
        db,
        () => {
          throw new Error("read failed");
        },
        (error) => rollbackErrors.push(error),
      ),
      /read failed/,
    );

    assert.equal(runner.isInTransaction(), false);
    assert.deepEqual(db.calls, ["BEGIN DEFERRED", "ROLLBACK"]);
    assert.equal(rollbackErrors.length, 1);
    assert.match(rollbackErrors[0].message, /failed ROLLBACK/);
  });
});
