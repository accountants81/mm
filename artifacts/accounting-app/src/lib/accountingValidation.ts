import type { AccountingStore } from "@/lib/localAccountingRepository";

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function validateAccountingRecord(store: AccountingStore, input: Record<string, unknown>): string | null {
  if (store === "journalEntries") {
    const lines = Array.isArray(input.journalLines) ? input.journalLines.filter(line => Boolean(line) && typeof line === "object") as Array<Record<string, unknown>> : [];
    if (lines.length) {
      const lineDebit = lines.reduce((sum, line) => sum + numberValue(line.debit), 0);
      const lineCredit = lines.reduce((sum, line) => sum + numberValue(line.credit), 0);
      if (lines.some(line => numberValue(line.debit) < 0 || numberValue(line.credit) < 0)) return "لا يمكن أن تحتوي بنود القيد على قيم سالبة.";
      if (lineDebit === 0 && lineCredit === 0) return "يجب إدخال قيمة مدينة أو دائنة للقيد.";
      if (Math.abs(lineDebit - lineCredit) > 0.005) return "القيد غير متوازن: يجب أن يتساوى إجمالي بنود المدين والدائن.";
      return null;
    }
    const debit = numberValue(input.debit);
    const credit = numberValue(input.credit);
    if (debit < 0 || credit < 0) return "لا يمكن أن تكون قيمة المدين أو الدائن سالبة.";
    if (debit === 0 && credit === 0) return "يجب إدخال قيمة مدينة أو دائنة للقيد.";
    if (Math.abs(debit - credit) > 0.005) return "القيد غير متوازن: يجب أن يتساوى إجمالي المدين مع إجمالي الدائن.";
  }
  const nonNegativeFields = ["quantity", "requiredQuantity", "consumedQuantity", "producedQuantity", "amount", "subtotal", "tax", "total", "value", "contractValue", "principal"];
  for (const field of nonNegativeFields) {
    if (field in input && numberValue(input[field]) < 0) return `لا يمكن أن تكون قيمة ${field} سالبة.`;
  }
  if (store === "invoices" || store === "salesOrders" || store === "purchaseOrders") {
    const quantity = numberValue(input.quantity);
    const unitPrice = numberValue(input.unitPrice);
    if (quantity > 0 && unitPrice < 0) return "سعر الوحدة لا يمكن أن يكون سالبًا.";
  }
  if (store === "invoices") {
    const subtotal = numberValue(input.subtotal);
    const tax = numberValue(input.tax);
    const total = numberValue(input.total);
    if (total > 0 && subtotal + tax > 0 && Math.abs(total - subtotal - tax) > 0.005) return "إجمالي الفاتورة لا يساوي قبل الضريبة مضافًا إليه الضريبة.";
  }
  const percentageFields = ["taxRate", "interestRate", "completionRate", "confidence", "rating"];
  for (const field of percentageFields) {
    if (!(field in input) || String(input[field] ?? "").trim() === "") continue;
    const value = numberValue(input[field]);
    const upper = field === "rating" ? 5 : 100;
    if (value < 0 || value > upper) return `قيمة ${field} يجب أن تكون بين 0 و${upper}.`;
  }
  return null;
}
