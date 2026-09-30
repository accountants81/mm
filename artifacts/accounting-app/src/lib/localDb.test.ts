import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { importLocalBackup, localList, parseLocalBackup, STORE_NAMES } from "./localDb";
import { createLocalAuditBackup } from "./localAuditFixture";

function backup(data: Record<string, unknown[]> = {}) {
  return JSON.stringify({
    format: "abd-elaziz-omran-accounting-backup",
    version: 1,
    data: Object.fromEntries(STORE_NAMES.map(store => [store, data[store] ?? []])),
  });
}

describe("local backup validation", () => {
  it("creates a deterministic isolated audit fixture", () => {
    const parsed = parseLocalBackup(createLocalAuditBackup());
    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.contacts).toHaveLength(1);
    expect(parsed.invoices).toHaveLength(1);
  });

  it("accepts a complete backup without records", () => {
    const parsed = parseLocalBackup(backup());
    expect(Object.keys(parsed)).toHaveLength(STORE_NAMES.length);
  });

  it("rejects malformed JSON before any storage write", () => {
    expect(() => parseLocalBackup("not-json")).toThrow("ليس JSON صالحًا");
  });

  it("rejects a backup with a missing store", () => {
    const data = Object.fromEntries(STORE_NAMES.slice(1).map(store => [store, []]));
    const raw = JSON.stringify({ format: "abd-elaziz-omran-accounting-backup", version: 1, data });
    expect(() => parseLocalBackup(raw)).toThrow("ناقصة");
  });

  it("rejects duplicate ids, invalid dates, and unbalanced journal lines", () => {
    expect(() => parseLocalBackup(backup({ accounts: [{ id: "same" }, { id: "same" }] }))).toThrow("معرفًا مكررًا");
    expect(() => parseLocalBackup(backup({ accounts: [{ id: "bad-date", updatedAt: "not-a-date" }] }))).toThrow("تاريخ تحديث غير صالح");
    expect(() => parseLocalBackup(backup({ journalEntries: [{ id: "unbalanced", journalLines: [{ account: "أ", debit: 10, credit: 0 }, { account: "ب", debit: 0, credit: 9 }] }] }))).toThrow("غير متوازن");
  });

  it("rejects records without stable ids", () => {
    expect(() => parseLocalBackup(backup({ accounts: [{ name: "بدون معرف" }] }))).toThrow("بيانات المخزن accounts غير صالحة");
  });

  it("rejects an unexpected store", () => {
    const parsed = JSON.parse(backup());
    parsed.data.unknownStore = [];
    expect(() => parseLocalBackup(JSON.stringify(parsed))).toThrow("غير مدعومة");
  });

  it("restores a valid backup through the IndexedDB path", async () => {
    await importLocalBackup(backup({ accounts: [{ id: "idb-restore", updatedAt: "2026-03-01", name: "استعادة IndexedDB" }] }));
    await expect(localList("accounts")).resolves.toEqual([{ id: "idb-restore", updatedAt: "2026-03-01", name: "استعادة IndexedDB" }]);
  });

  it("preserves actor code and audit history when moved to another device", async () => {
    const actor = { id: "portable-record", updatedAt: "2026-04-01", name: "سجل منقول", updatedByCode: "EMP-77", updatedByName: "موظف منقول", updatedByEmail: "emp@example.com" };
    const audit = { id: "portable-audit", updatedAt: "2026-04-01", userCode: "EMP-77", user: "موظف منقول", userEmail: "emp@example.com", operation: "تعديل", table: "accounts", recordId: actor.id };
    await importLocalBackup(backup({ accounts: [actor], auditLogs: [audit] }));
    await expect(localList("accounts")).resolves.toContainEqual(actor);
    await expect(localList("auditLogs")).resolves.toContainEqual(audit);
  });

  it("rolls back localStorage when a restore write fails partway", async () => {
    const values: Record<string, string> = { "local-accounts": JSON.stringify([{ id: "old", updatedAt: "2026-01-01" }]) };
    let writes = 0;
    const storage = {
      getItem: (key: string) => values[key] ?? null,
      setItem: (key: string, value: string) => {
        writes += 1;
        if (writes === 3) throw new Error("simulated storage failure");
        values[key] = value;
      },
      removeItem: (key: string) => { delete values[key]; },
    };
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    await expect(importLocalBackup(backup({ accounts: [{ id: "new", updatedAt: "2026-02-01" }] }))).rejects.toThrow("simulated storage failure");
    expect(JSON.parse(values["local-accounts"] ?? "[]")).toEqual([{ id: "old", updatedAt: "2026-01-01" }]);
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "indexedDB");
    Reflect.deleteProperty(globalThis, "localStorage");
  });
});
