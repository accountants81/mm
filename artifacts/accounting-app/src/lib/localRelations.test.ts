import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { localDelete, localPut } from "./localDb";
import { auditLocalRelations } from "./localRelations";

const id = "relation-audit-test";

describe("local relation integrity audit", () => {
  beforeEach(async () => {
    await localDelete("accounts", id);
    await localDelete("invoices", id);
    await localDelete("accounts", "relation-duplicate-a");
    await localDelete("accounts", "relation-duplicate-b");
  });

  it("finds linked records without reporting orphan references", async () => {
    await localPut("accounts", { id, code: "AUD-100", name: "حساب اختبار" });
    await localPut("invoices", { id, code: "INV-AUD", name: "فاتورة اختبار", account: "AUD-100", relationRefs: [{ store: "accounts", id, code: "AUD-100", label: "حساب اختبار" }] });
    const result = await auditLocalRelations();
    expect(result.stores).toBeGreaterThan(50);
    expect(result.records).toBeGreaterThanOrEqual(2);
    expect(result.linkedRecords).toBeGreaterThanOrEqual(1);
    expect(result.orphanRefs).toBe(0);
    expect(result.unresolvedFields).toBe(0);
  });

  it("detects unresolved relation fields", async () => {
    await localPut("invoices", { id, code: "INV-BAD", name: "فاتورة بلا عميل", partyCode: "MISSING-PARTY" });
    const result = await auditLocalRelations();
    expect(result.unresolvedFields).toBeGreaterThanOrEqual(1);
  });

  it("counts duplicate master codes inside the same section", async () => {
    await localPut("accounts", { id: "relation-duplicate-a", code: "DUP-1", name: "أ" });
    await localPut("accounts", { id: "relation-duplicate-b", code: "DUP-1", name: "ب" });
    const result = await auditLocalRelations();
    expect(result.duplicateCodes).toBeGreaterThanOrEqual(1);
  });
});
