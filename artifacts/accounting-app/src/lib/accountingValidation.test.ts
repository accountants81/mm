import { describe, expect, it } from "vitest";
import { validateAccountingRecord } from "./accountingValidation";

describe("accounting record validation", () => {
  it("rejects an unbalanced journal entry", () => {
    expect(validateAccountingRecord("journalEntries", { debit: "100", credit: "90" })).toContain("غير متوازن");
  });

  it("accepts a balanced journal entry", () => {
    expect(validateAccountingRecord("journalEntries", { debit: "100", credit: "100" })).toBeNull();
  });

  it("rejects invalid percentages and negative quantities", () => {
    expect(validateAccountingRecord("invoices", { quantity: "-1" })).toContain("سالبة");
    expect(validateAccountingRecord("invoices", { taxRate: "150" })).toContain("بين 0 و100");
  });
});
