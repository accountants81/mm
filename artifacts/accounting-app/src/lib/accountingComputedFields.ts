import type { AccountingStore } from "@/lib/localAccountingRepository";
import { calculateDepreciation, calculateExchangeDifference, calculatePayroll } from "./accountingCalculations";

const numeric = (value: unknown) => Number(value ?? 0) || 0;

export function deriveComputedFields(store: AccountingStore, input: Record<string, string>): Record<string, string> {
  const next = { ...input };
  if (store === "taxReturns") next.taxAmount = String(numeric(input.taxBase) * numeric(input.rate) / 100);
  if (store === "invoices") {
    const subtotal = numeric(input.subtotal) || numeric(input.quantity) * numeric(input.unitPrice);
    const tax = numeric(input.tax) || subtotal * numeric(input.taxRate) / 100;
    next.subtotal = String(subtotal);
    next.tax = String(tax);
    next.total = String(subtotal + tax);
  }
  if (store === "payroll") {
    const payroll = calculatePayroll(input);
    next.grossSalary = String(payroll.grossSalary);
    next.taxableAnnualIncome = String(payroll.taxableAnnualIncome);
    next.incomeTax = String(payroll.incomeTax);
    next.insuranceSalary = String(payroll.insuranceSalary);
    next.employeeSocialInsurance = String(payroll.employeeSocialInsurance);
    next.employerSocialInsurance = String(payroll.employerSocialInsurance);
    next.totalDeductions = String(payroll.totalDeductions);
    next.netSalary = String(payroll.netSalary);
  }
  if (store === "socialInsurance") next.amount = String(numeric(input.insuredSalary) * numeric(input.rate) / 100);
  if (store === "fixedAssets") {
    const depreciation = calculateDepreciation(input);
    next.periodDepreciation = String(depreciation.depreciation);
    next.accumulatedDepreciation = String(depreciation.accumulatedAfter);
    next.bookValue = String(depreciation.bookValueAfter);
  }
  if (store === "currencies" && (input.foreignAmount || input.bookRate || input.closingRate)) {
    const exchange = calculateExchangeDifference(input);
    next.bookValue = String(exchange.bookValue);
    next.closingValue = String(exchange.closingValue);
    next.exchangeDifference = String(exchange.difference);
    next.exchangeDifferenceType = exchange.direction;
  }
  if (store === "productionCosts") {
    const total = numeric(input.rawMaterials) + numeric(input.directLabor) + numeric(input.indirectCosts);
    next.totalCost = String(total);
    next.unitCost = numeric(input.unitsProduced) > 0 ? String(total / numeric(input.unitsProduced)) : "0";
  }
  if (store === "purchaseOrders" || store === "salesOrders") next.total = String(numeric(input.quantity) * numeric(input.unitPrice));
  if (store === "physicalInventory") next.difference = String(numeric(input.actualQuantity) - numeric(input.bookQuantity));
  if (store === "budgets") {
    next.difference = String(numeric(input.actual) - numeric(input.planned));
    next.achievementRate = numeric(input.planned) > 0 ? String(numeric(input.actual) / numeric(input.planned) * 100) : "0";
  }
  if (store === "cashFlows") next.netCashFlow = String(numeric(input.operating) + numeric(input.investing) + numeric(input.financing));
  if (store === "energyConsumption") next.costPerProductionUnit = numeric(input.productionUnits) > 0 ? String(numeric(input.cost) / numeric(input.productionUnits)) : "0";
  if (store === "salesAnalysis") next.netSales = String(numeric(input.salesValue) - numeric(input.returns));
  if (store === "advances") next.remaining = String(Math.max(0, numeric(input.amount) - numeric(input.settledAmount)));
  if (store === "installments") next.remainingBalance = String(Math.max(0, numeric(input.contractValue) - numeric(input.downPayment) - numeric(input.paidInstallments) * numeric(input.installmentValue)));
  if (store === "costCenters") next.profit = String(numeric(input.actualRevenue) - numeric(input.actualExpenses));
  if (store === "financialAnalysis") {
    const revenue = numeric(input.revenue);
    next.breakEvenPoint = numeric(input.fixedCosts) > 0 && revenue > numeric(input.variableCosts) ? String(numeric(input.fixedCosts) / Math.max(0.01, 1 - numeric(input.variableCosts) / revenue)) : String(numeric(input.breakEvenPoint));
    next.grossMargin = revenue > 0 ? String((revenue - numeric(input.costOfSales)) / revenue * 100) : "0";
    next.netMargin = revenue > 0 ? String(numeric(input.netProfit) / revenue * 100) : "0";
    next.roi = numeric(input.investment) > 0 ? String(numeric(input.netProfit) / numeric(input.investment) * 100) : "0";
  }
  if (store === "financialRatios") {
    next.currentRatio = numeric(input.currentLiabilities) > 0 ? String(numeric(input.currentAssets) / numeric(input.currentLiabilities)) : "0";
    next.quickRatio = numeric(input.currentLiabilities) > 0 ? String((numeric(input.currentAssets) - numeric(input.inventory)) / numeric(input.currentLiabilities)) : "0";
    next.profitability = numeric(input.revenue) > 0 ? String(numeric(input.netProfit) / numeric(input.revenue) * 100) : "0";
    next.roa = numeric(input.assets) > 0 ? String(numeric(input.netProfit) / numeric(input.assets) * 100) : "0";
    next.roe = numeric(input.equity) > 0 ? String(numeric(input.netProfit) / numeric(input.equity) * 100) : "0";
    next.debtRatio = numeric(input.assets) > 0 ? String(numeric(input.liabilities) / numeric(input.assets) * 100) : "0";
  }
  if (store === "kpis") {
    next.profitability = numeric(input.revenue) > 0 ? String(numeric(input.netProfit) / numeric(input.revenue) * 100) : "0";
    next.liquidity = numeric(input.currentLiabilities) > 0 ? String(numeric(input.currentAssets) / numeric(input.currentLiabilities)) : "0";
    next.growth = numeric(input.previousRevenue) > 0 ? String((numeric(input.revenue) - numeric(input.previousRevenue)) / numeric(input.previousRevenue) * 100) : "0";
    next.inventoryTurnover = numeric(input.averageInventory) > 0 ? String(numeric(input.costOfSales) / numeric(input.averageInventory)) : "0";
  }
  if (store === "bankReconciliations") next.difference = String(numeric(input.bankBalance) - numeric(input.bookBalance) + numeric(input.depositsInTransit) - numeric(input.outstandingChecks) - numeric(input.bankFees) + numeric(input.bankInterest));
  if (store === "customReports") next.status = input.status || "نشط";
  return next;
}
