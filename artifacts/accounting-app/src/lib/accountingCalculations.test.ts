import { describe, expect, it } from "vitest";
import { calculateDepreciation, calculateExchangeDifference, calculatePayroll, progressiveTax } from "./accountingCalculations";
import { calculateInventoryValuation } from "./inventoryValuation";

describe("accounting calculations", () => {
  it("calculates straight-line and declining depreciation without exceeding residual value", () => {
    const straight = calculateDepreciation({ value: 12000, residualValue: 0, usefulLife: 12, depreciationMethod: "القسط الثابت" });
    const declining = calculateDepreciation({ value: 12000, residualValue: 1000, usefulLife: 12, depreciationMethod: "الرصيد المتناقص" });
    expect(straight.depreciation).toBe(1000);
    expect(declining.depreciation).toBeCloseTo(1833.333, 2);
    expect(declining.bookValueAfter).toBeGreaterThanOrEqual(1000);
  });

  it("calculates configurable Egyptian payroll tax and insurance", () => {
    const payroll = calculatePayroll({ basicSalary: 10000, allowances: 1000, deductions: 200 });
    expect(payroll.grossSalary).toBe(11000);
    expect(payroll.employeeSocialInsurance).toBe(1210);
    expect(payroll.employerSocialInsurance).toBe(2062.5);
    expect(payroll.netSalary).toBeLessThan(payroll.grossSalary);
    expect(progressiveTax(payroll.taxableAnnualIncome)).toBeGreaterThan(0);
  });

  it("calculates currency revaluation direction", () => {
    expect(calculateExchangeDifference({ foreignAmount: 100, bookRate: 30, closingRate: 31 })).toEqual({ bookValue: 3000, closingValue: 3100, difference: 100, direction: "ربح فروق عملة" });
  });

  it("supports FIFO and weighted average inventory valuation", () => {
    const movements = [
      { product: "P-1", direction: "وارد", quantity: 10, unitPrice: 10, date: "2026-01-01" },
      { product: "P-1", direction: "وارد", quantity: 10, unitPrice: 20, date: "2026-01-02" },
      { product: "P-1", direction: "منصرف", quantity: 12, date: "2026-01-03" },
    ];
    expect(calculateInventoryValuation(movements, "FIFO").costOfGoodsSold).toBe(140);
    expect(calculateInventoryValuation(movements, "AVERAGE").costOfGoodsSold).toBe(180);
  });
});