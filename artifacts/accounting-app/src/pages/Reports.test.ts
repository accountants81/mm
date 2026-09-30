import { describe, expect, it } from "vitest";
import { buildReportHtml, isActiveReportRow, reportAmount, summarizeFinancialRows } from "./Reports";

describe("report calculations", () => {
  it("uses amount first and falls back to total", () => {
    expect(reportAmount({ id: "a", updatedAt: "2026-01-01", amount: 25, total: 99 })).toBe(25);
    expect(reportAmount({ id: "b", updatedAt: "2026-01-01", total: 99 })).toBe(99);
  });

  it("summarizes financial outputs from local rows and excludes generated/reversed rows", () => {
    const summary = summarizeFinancialRows({
      invoices: [{ id: "i1", updatedAt: "2026-01-01", total: 100 }, { id: "i2", updatedAt: "2026-01-01", total: 50, generated: true }],
      expenses: [{ id: "e1", updatedAt: "2026-01-01", amount: 30 }],
      revenues: [{ id: "r1", updatedAt: "2026-01-01", amount: 90 }, { id: "r2", updatedAt: "2026-01-01", amount: 10, status: "ملغى" }],
      cashTransactions: [{ id: "c1", updatedAt: "2026-01-01", direction: "قبض", amount: 70 }, { id: "c2", updatedAt: "2026-01-01", direction: "صرف", amount: 20 }],
      inventoryMovements: [{ id: "m1", updatedAt: "2026-01-01", direction: "وارد", quantity: 5 }, { id: "m2", updatedAt: "2026-01-01", direction: "منصرف", quantity: 2 }],
      journalEntries: [{ id: "j1", updatedAt: "2026-01-01", debit: 100, credit: 60 }, { id: "j2", updatedAt: "2026-01-01", debit: 99, credit: 99, postingStatus: "معكوس" }],
      budgets: [{ id: "b1", updatedAt: "2026-01-01", planned: 200, actual: 180 }],
      cashFlows: [{ id: "f1", updatedAt: "2026-01-01", netCashFlow: 50 }],
      taxReturns: [{ id: "t1", updatedAt: "2026-01-01", taxAmount: 12 }],
    });
    expect(summary).toMatchObject({ invoices: 100, expenses: 30, revenues: 90, netIncome: 60, cashNet: 50, stockNet: 3, debit: 100, credit: 60, trialDifference: 40, budgetVariance: -20, netCashFlow: 50, taxAmount: 12 });
  });

  it("builds a downloadable RTL HTML document from supplied content only", () => {
    const html = buildReportHtml("<h1>تقرير</h1><p>100</p>");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("<h1>تقرير</h1>");
    expect(html).not.toContain("localPut");
  });

  it("excludes reversed and cancelled rows", () => {
    expect(isActiveReportRow({ id: "a", updatedAt: "2026-01-01" })).toBe(true);
    expect(isActiveReportRow({ id: "b", updatedAt: "2026-01-01", postingStatus: "معكوس" })).toBe(false);
    expect(isActiveReportRow({ id: "c", updatedAt: "2026-01-01", status: "ملغى" })).toBe(false);
  });
});
