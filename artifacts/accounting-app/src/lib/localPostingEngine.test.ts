import { describe, expect, it } from "vitest";
import { buildSourcePostings } from "./localPostingEngine";

describe("local posting idempotency", () => {
  it("connects a paid sales invoice to ledger, treasury, inventory, and tax effects", () => {
    const postings = buildSourcePostings("invoices", {
      id: "invoice-integrity-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      invoiceType: "مبيعات",
      total: 120,
      subtotal: 100,
      paid: 120,
      paymentMethod: "خزينة",
      tax: 20,
      party: "عميل اختبار",
      item: "صنف اختبار",
      quantity: 2,
      unitPrice: 50,
    });
    expect(postings.map(posting => posting.postingType)).toEqual(["قيد", "حركة نقدية", "حركة مخزون", "ضريبة", "إيراد"]);
    expect(postings.find(posting => posting.postingType === "حركة نقدية")?.direction).toBe("قبض");
    expect(postings.find(posting => posting.postingType === "حركة مخزون")?.direction).toBe("منصرف");
    expect(postings.find(posting => posting.postingType === "ضريبة")?.amount).toBe(20);
  });

  it("uses deterministic posting ids for the same source record", () => {
    const source = {
      id: "invoice-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      invoiceType: "مبيعات",
      total: 120,
      paid: 120,
      paymentMethod: "خزينة",
      tax: 20,
      party: "عميل اختبار",
      item: "صنف اختبار",
      quantity: 2,
      unitPrice: 50,
    };
    const first = buildSourcePostings("invoices", source);
    const second = buildSourcePostings("invoices", source);
    expect(first.map(posting => posting.id)).toEqual(second.map(posting => posting.id));
    expect(new Set(first.map(posting => posting.id)).size).toBe(first.length);
  });

  it("adds a balanced cost-of-goods-sold journal when a sales cost is known", () => {
    const postings = buildSourcePostings("invoices", {
      id: "invoice-cogs-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      invoiceType: "مبيعات",
      total: 240,
      subtotal: 240,
      quantity: 2,
      unitPrice: 120,
      purchasePrice: 70,
      status: "مرحل",
    });
    const cogs = postings.find(posting => posting.postingType === "قيد تكلفة مبيعات");
    expect(cogs?.amount).toBeUndefined();
    expect(cogs?.costOfGoodsSold).toBe(140);
    expect(cogs?.balanced).toBe(true);
  });

  it("posts a sales return as a balanced reversal and receives inventory", () => {
    const postings = buildSourcePostings("salesReturns", {
      id: "sales-return-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      amount: 120,
      tax: 20,
      customer: "عميل اختبار",
      product: "صنف اختبار",
      quantity: 2,
    });
    const journal = postings.find(posting => posting.postingType === "قيد مرتجع");
    expect(journal?.journalLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ account: "مرتجعات المبيعات", debit: 100 }),
      expect.objectContaining({ account: "ضريبة المخرجات", debit: 20 }),
      expect.objectContaining({ account: "عميل اختبار", credit: 120 }),
    ]));
    expect(journal?.balanced).toBe(true);
    expect(postings.find(posting => posting.postingType === "حركة مخزون")?.direction).toBe("وارد");
  });

  it("creates an auditable depreciation journal when an asset is approved", () => {
    const postings = buildSourcePostings("fixedAssets", {
      id: "asset-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
      name: "آلة إنتاج",
      value: 12000,
      residualValue: 0,
      periodDepreciation: 1000,
      status: "معتمد",
      paymentMethod: "بنك",
    });
    const depreciation = postings.find(posting => posting.postingType === "قيد إهلاك");
    expect(depreciation?.journalLines).toEqual([
      expect.objectContaining({ account: "مصروف الإهلاك", debit: 1000, credit: 0 }),
      expect.objectContaining({ account: "مجمع الإهلاك", debit: 0, credit: 1000 }),
    ]);
    expect(depreciation?.balanced).toBe(true);
  });
});
