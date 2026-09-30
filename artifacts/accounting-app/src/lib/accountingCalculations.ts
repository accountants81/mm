export type DepreciationMethod = "القسط الثابت" | "الرصيد المتناقص";

const finite = (value: unknown) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

export type DepreciationResult = {
  depreciableBase: number;
  bookValueBefore: number;
  depreciation: number;
  accumulatedAfter: number;
  bookValueAfter: number;
  remainingPeriods: number;
  method: DepreciationMethod;
};

export function calculateDepreciation(input: Record<string, unknown>): DepreciationResult {
  const value = Math.max(0, finite(input.value));
  const residualValue = Math.min(value, Math.max(0, finite(input.residualValue)));
  const depreciableBase = Math.max(0, value - residualValue);
  const usefulLifeRaw = Math.max(0, finite(input.usefulLife));
  const periods = input.usefulLifeUnit === "years" ? usefulLifeRaw * 12 : usefulLifeRaw;
  const accumulatedBefore = Math.min(depreciableBase, Math.max(0, finite(input.accumulatedDepreciation)));
  const bookValueBefore = Math.max(residualValue, value - accumulatedBefore);
  const method: DepreciationMethod = input.depreciationMethod === "الرصيد المتناقص" ? "الرصيد المتناقص" : "القسط الثابت";
  if (periods <= 0 || bookValueBefore <= residualValue) {
    return { depreciableBase, bookValueBefore, depreciation: 0, accumulatedAfter: accumulatedBefore, bookValueAfter: bookValueBefore, remainingPeriods: 0, method };
  }
  const remainingPeriods = Math.max(0, periods - Math.max(0, finite(input.periodIndex ?? 0)));
  const straightLine = depreciableBase / periods;
  const decliningRate = Math.min(1, 2 / periods);
  const rawDepreciation = method === "الرصيد المتناقص" ? (bookValueBefore - residualValue) * decliningRate : straightLine;
  const depreciation = Math.min(bookValueBefore - residualValue, Math.max(0, rawDepreciation));
  return {
    depreciableBase,
    bookValueBefore,
    depreciation,
    accumulatedAfter: accumulatedBefore + depreciation,
    bookValueAfter: bookValueBefore - depreciation,
    remainingPeriods,
    method,
  };
}

export type PayrollTaxBracket = { upToAnnual: number | null; rate: number };
export type PayrollRules = {
  annualPersonalAllowance: number;
  employeeSocialRate: number;
  employerSocialRate: number;
  socialInsuranceCap: number | null;
  taxBrackets: PayrollTaxBracket[];
};

export const DEFAULT_EGYPT_PAYROLL_RULES: PayrollRules = {
  annualPersonalAllowance: 20000,
  employeeSocialRate: 0.11,
  employerSocialRate: 0.1875,
  socialInsuranceCap: 15000,
  taxBrackets: [
    { upToAnnual: 40000, rate: 0 },
    { upToAnnual: 55000, rate: 0.1 },
    { upToAnnual: 70000, rate: 0.15 },
    { upToAnnual: 200000, rate: 0.2 },
    { upToAnnual: 400000, rate: 0.225 },
    { upToAnnual: null, rate: 0.25 },
  ],
};

export function progressiveTax(annualTaxableIncome: number, brackets = DEFAULT_EGYPT_PAYROLL_RULES.taxBrackets) {
  let remaining = Math.max(0, annualTaxableIncome);
  let lower = 0;
  let tax = 0;
  for (const bracket of brackets) {
    const upper = bracket.upToAnnual === null ? Number.POSITIVE_INFINITY : Math.max(lower, bracket.upToAnnual);
    const slice = Math.max(0, Math.min(remaining, upper - lower));
    tax += slice * Math.max(0, bracket.rate);
    remaining -= slice;
    lower = upper;
    if (remaining <= 0) break;
  }
  return tax;
}

export type PayrollCalculation = {
  grossSalary: number;
  taxableAnnualIncome: number;
  incomeTax: number;
  insuranceSalary: number;
  employeeSocialInsurance: number;
  employerSocialInsurance: number;
  totalDeductions: number;
  netSalary: number;
};

export function calculatePayroll(input: Record<string, unknown>, rules: PayrollRules = DEFAULT_EGYPT_PAYROLL_RULES): PayrollCalculation {
  const basicSalary = Math.max(0, finite(input.basicSalary));
  const allowances = Math.max(0, finite(input.allowances));
  const overtime = Math.max(0, finite(input.overtime));
  const bonus = Math.max(0, finite(input.bonus));
  const otherDeductions = Math.max(0, finite(input.otherDeductions)) + Math.max(0, finite(input.deductions));
  const grossSalary = basicSalary + allowances + overtime + bonus;
  const taxableAnnualIncome = Math.max(0, grossSalary * 12 - Math.max(0, rules.annualPersonalAllowance));
  const incomeTax = progressiveTax(taxableAnnualIncome, rules.taxBrackets) / 12;
  const insuranceSalary = rules.socialInsuranceCap === null ? grossSalary : Math.min(grossSalary, Math.max(0, rules.socialInsuranceCap));
  const employeeSocialInsurance = insuranceSalary * Math.max(0, rules.employeeSocialRate);
  const employerSocialInsurance = insuranceSalary * Math.max(0, rules.employerSocialRate);
  const totalDeductions = otherDeductions + incomeTax + employeeSocialInsurance;
  return { grossSalary, taxableAnnualIncome, incomeTax, insuranceSalary, employeeSocialInsurance, employerSocialInsurance, totalDeductions, netSalary: Math.max(0, grossSalary - totalDeductions) };
}

export function calculateExchangeDifference(input: { foreignAmount?: unknown; bookRate?: unknown; closingRate?: unknown }) {
  const foreignAmount = finite(input.foreignAmount);
  const bookRate = finite(input.bookRate);
  const closingRate = finite(input.closingRate);
  const bookValue = foreignAmount * bookRate;
  const closingValue = foreignAmount * closingRate;
  return { bookValue, closingValue, difference: closingValue - bookValue, direction: closingValue >= bookValue ? "ربح فروق عملة" : "خسارة فروق عملة" as const };
}