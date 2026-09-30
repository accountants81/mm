import { BarChart3, FileDown, Printer, Scale, TrendingUp, WalletCards, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { localAccountingRepository, type AccountingStore, writeAudit } from "@/lib/localAccountingRepository";
import type { LocalRecord } from "@/lib/localDb";
import { journalTotals } from "@/lib/journalUtils";

const reportStores = [
  ["accounts", "الحسابات", Scale],
  ["journalEntries", "القيود اليومية", TrendingUp],
  ["contacts", "العملاء والموردون", BarChart3],
  ["products", "الأصناف والمخزون", Warehouse],
  ["invoices", "الفواتير", FileDown],
] as const;

export const reportAmount = (row: LocalRecord) => Number(row.amount ?? row.total ?? 0) || 0;
export const isActiveReportRow = (row: LocalRecord) => row.postingStatus !== "معكوس" && row.status !== "ملغى";

export function summarizeFinancialRows(input: {
  invoices: LocalRecord[]; expenses: LocalRecord[]; revenues: LocalRecord[];
  cashTransactions: LocalRecord[]; inventoryMovements: LocalRecord[]; journalEntries: LocalRecord[];
  budgets: LocalRecord[]; cashFlows: LocalRecord[]; taxReturns: LocalRecord[];
}) {
  const active = (rows: LocalRecord[]) => rows.filter(isActiveReportRow);
  const originals = (rows: LocalRecord[]) => active(rows).filter(row => !row.generated);
  const invoices = originals(input.invoices).reduce((sum, row) => sum + reportAmount(row), 0);
  const expenses = originals(input.expenses).reduce((sum, row) => sum + reportAmount(row), 0);
  const revenues = originals(input.revenues).reduce((sum, row) => sum + reportAmount(row), 0);
  const cash = active(input.cashTransactions);
  const inventory = active(input.inventoryMovements);
  const cashIn = cash.filter(row => row.direction === "قبض").reduce((sum, row) => sum + reportAmount(row), 0);
  const cashOut = cash.filter(row => row.direction === "صرف").reduce((sum, row) => sum + reportAmount(row), 0);
  const stockIn = inventory.filter(row => String(row.direction).includes("وارد")).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const stockOut = inventory.filter(row => String(row.direction).includes("منصرف")).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const journal = active(input.journalEntries);
  const { debit, credit } = journalTotals(journal);
  const planned = input.budgets.reduce((sum, row) => sum + Number(row.planned ?? 0), 0);
  const actual = input.budgets.reduce((sum, row) => sum + Number(row.actual ?? 0), 0);
  return { invoices, expenses, revenues, netIncome: revenues - expenses, cashIn, cashOut, cashNet: cashIn - cashOut, stockIn, stockOut, stockNet: stockIn - stockOut, debit, credit, trialDifference: debit - credit, planned, actual, budgetVariance: actual - planned, netCashFlow: input.cashFlows.reduce((sum, row) => sum + Number(row.netCashFlow ?? 0), 0), taxAmount: active(input.taxReturns).reduce((sum, row) => sum + Number(row.taxAmount ?? 0), 0) };
}

export function buildReportHtml(content: string) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير محاسبي محلي</title><style>body{font-family:Arial,sans-serif;direction:rtl;padding:24px;color:#111;background:#fff}button,a{display:none!important}*{box-sizing:border-box}</style></head><body>${content}</body></html>`;
}

export function exportCurrentReportHtml() {
  if (typeof document === "undefined") return;
  const html = buildReportHtml(document.querySelector("main")?.innerHTML ?? document.body.innerHTML);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `accounting-report-${new Date().toISOString().slice(0, 10)}.html`; anchor.click(); URL.revokeObjectURL(url);
  void writeAudit("تصدير", "reportSnapshots", { id: `report-export-${Date.now()}`, format: "html", updatedAt: new Date().toISOString() });
}

export default function Reports() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState({ invoices: 0, expenses: 0, revenues: 0 });
  const [posted, setPosted] = useState({ cashIn: 0, cashOut: 0, cashNet: 0, stockIn: 0, stockOut: 0, stockNet: 0, links: 0 });
  const [importedReports, setImportedReports] = useState({ monthly: 0, snapshots: 0, closing: 0, adjustments: 0 });
  const [trialBalance, setTrialBalance] = useState({ debit: 0, credit: 0 });
  const [management, setManagement] = useState({ planned: 0, actual: 0, netCashFlow: 0, taxAmount: 0, budgets: 0, cashFlows: 0, taxReturns: 0 });
  const netIncome = totals.revenues - totals.expenses;
  const trialDifference = trialBalance.debit - trialBalance.credit;
  useEffect(() => {
    void Promise.all(reportStores.map(async ([store]) => [store, (await localAccountingRepository.list(store)).length] as const)).then(values => setCounts(Object.fromEntries(values)));
    void Promise.all((['invoices', 'expenses', 'revenues'] as AccountingStore[]).map(async store => [store, (await localAccountingRepository.list(store)).filter(row => !row.generated && isActiveReportRow(row))] as const)).then(values => setTotals({ invoices: values[0]?.[1].reduce((sum, row) => sum + reportAmount(row), 0) ?? 0, expenses: values[1]?.[1].reduce((sum, row) => sum + reportAmount(row), 0) ?? 0, revenues: values[2]?.[1].reduce((sum, row) => sum + reportAmount(row), 0) ?? 0 }));
    void Promise.all([localAccountingRepository.list("cashTransactions"), localAccountingRepository.list("inventoryMovements"), localAccountingRepository.list("postingLinks")]).then(([cash, inventory, links]) => {
      const activeCash = cash.filter(isActiveReportRow);
      const activeInventory = inventory.filter(isActiveReportRow);
      const cashIn = activeCash.filter(row => row.direction === "قبض").reduce((sum, row) => sum + reportAmount(row), 0);
      const cashOut = activeCash.filter(row => row.direction === "صرف").reduce((sum, row) => sum + reportAmount(row), 0);
      const stockIn = activeInventory.filter(row => String(row.direction).includes("وارد")).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      const stockOut = activeInventory.filter(row => String(row.direction).includes("منصرف")).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
      setPosted({ cashIn, cashOut, cashNet: cashIn - cashOut, stockIn, stockOut, stockNet: stockIn - stockOut, links: links.length });
    });
    void Promise.all([localAccountingRepository.list("monthlyReports"), localAccountingRepository.list("reportSnapshots"), localAccountingRepository.list("closingEntries"), localAccountingRepository.list("adjustments")]).then(([monthly, snapshots, closing, adjustments]) => setImportedReports({ monthly: monthly.length, snapshots: snapshots.length, closing: closing.length, adjustments: adjustments.length }));
     void localAccountingRepository.list("journalEntries").then(rows => { const totals = journalTotals(rows); setTrialBalance(totals); });
    void Promise.all([localAccountingRepository.list("budgets"), localAccountingRepository.list("cashFlows"), localAccountingRepository.list("taxReturns")]).then(([budgets, cashFlows, taxReturns]) => setManagement({ planned: budgets.reduce((sum, row) => sum + Number(row.planned ?? 0), 0), actual: budgets.reduce((sum, row) => sum + Number(row.actual ?? 0), 0), netCashFlow: cashFlows.reduce((sum, row) => sum + Number(row.netCashFlow ?? 0), 0), taxAmount: taxReturns.filter(isActiveReportRow).reduce((sum, row) => sum + Number(row.taxAmount ?? 0), 0), budgets: budgets.length, cashFlows: cashFlows.length, taxReturns: taxReturns.length }));
  }, []);
  return <div dir="rtl" className="min-h-screen bg-[#07111f] px-4 py-8 text-slate-100 lg:px-10"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between"><div className="flex flex-wrap items-center gap-4"><LocalLink href="/" className="text-sm text-cyan-300">العودة للوحة التحكم</LocalLink><LocalLink href="/report-details" className="text-sm text-violet-300">فتح الجداول التفصيلية</LocalLink><LocalLink href="/management-reports" className="text-sm text-amber-300">التقارير الإدارية</LocalLink></div><div className="flex flex-wrap gap-2"><button onClick={() => window.print()} aria-label="طباعة التقرير أو حفظه PDF من حوار الطباعة" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><Printer className="h-4 w-4" /> طباعة التقرير</button><button onClick={exportCurrentReportHtml} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><FileDown className="h-4 w-4" /> حفظ HTML</button></div></div><div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-[#13213b] to-[#21143c] p-8"><p className="text-sm font-semibold text-cyan-300">مركز التقارير المحلي</p><h1 className="mt-2 text-3xl font-black text-white">ملخص حركة النظام المترابطة</h1><p className="mt-3 text-slate-300">كل رقم هنا يقرأ من السجلات الأصلية أو من آثار الترحيل المرتبطة بالمستند المصدر، مع استبعاد الآثار المعكوسة من الإجماليات الحالية.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{reportStores.map(([store, label, Icon]) => <div key={store} className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="h-5 w-5 text-cyan-300" /><p className="mt-4 text-3xl font-black text-white">{counts[store] ?? 0}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>)}</div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-5"><p className="text-xs text-slate-400">صافي الخزينة المرحّل</p><p className="mt-2 text-2xl font-black text-emerald-200">{posted.cashNet.toFixed(2)}</p><p className="mt-2 text-xs text-slate-500">قبض {posted.cashIn.toFixed(2)} — صرف {posted.cashOut.toFixed(2)}</p></div><div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5"><p className="text-xs text-slate-400">صافي حركة المخزون</p><p className="mt-2 text-2xl font-black text-cyan-200">{posted.stockNet.toFixed(2)}</p><p className="mt-2 text-xs text-slate-500">وارد {posted.stockIn.toFixed(2)} — منصرف {posted.stockOut.toFixed(2)}</p></div><div className="rounded-2xl border border-violet-300/20 bg-violet-300/5 p-5"><p className="text-xs text-slate-400">روابط الترحيل</p><p className="mt-2 text-2xl font-black text-violet-200">{posted.links}</p><p className="mt-2 text-xs text-slate-500">مستندات وآثار قابلة للمراجعة</p></div><div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5"><p className="text-xs text-slate-400">الميزان المرحّل</p><p className="mt-2 text-2xl font-black text-amber-200">{trialDifference.toFixed(2)}</p><p className="mt-2 text-xs text-slate-500">الفرق بين المدين والدائن</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">أوراق الأشهر المستوردة</p><p className="mt-2 text-2xl font-black text-violet-200">{importedReports.monthly}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">لقطات التقارير</p><p className="mt-2 text-2xl font-black text-violet-200">{importedReports.snapshots}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">قيود الإقفال</p><p className="mt-2 text-2xl font-black text-amber-200">{importedReports.closing}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">التسويات الجردية</p><p className="mt-2 text-2xl font-black text-amber-200">{importedReports.adjustments}</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">إجمالي الفواتير الأصلية</p><p className="mt-2 text-2xl font-black text-cyan-200">{totals.invoices.toFixed(2)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">إجمالي المصروفات الأصلية</p><p className="mt-2 text-2xl font-black text-rose-200">{totals.expenses.toFixed(2)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">إجمالي الإيرادات الأصلية</p><p className="mt-2 text-2xl font-black text-emerald-200">{totals.revenues.toFixed(2)}</p></div></div><div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">الأقسام المرتبطة</h2><LocalLink href="/management-reports" className="text-sm text-amber-300">فتح التقرير الإداري الكامل</LocalLink></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><LocalLink href="/module?store=cashTransactions" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">الحركات النقدية</p><p className="mt-2 text-xs text-emerald-300">قبض وصرف مرحّل</p></LocalLink><LocalLink href="/module?store=inventoryMovements" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">حركة المخزون</p><p className="mt-2 text-xs text-cyan-300">وارد ومنصرف وتسويات</p></LocalLink><LocalLink href="/module?store=budgets" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">الميزانية التقديرية</p><p className="mt-2 text-xs text-amber-300">{management.budgets} بند — الفرق {(management.actual - management.planned).toFixed(2)}</p></LocalLink><LocalLink href="/module?store=taxReturns" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">الضرائب والإقرارات</p><p className="mt-2 text-xs text-amber-300">{management.taxReturns} إقرار — الضريبة {management.taxAmount.toFixed(2)}</p></LocalLink><LocalLink href="/module?store=productionCosts" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">تكاليف الإنتاج</p><p className="mt-2 text-xs text-emerald-300">المواد والأجور والتكلفة</p></LocalLink><LocalLink href="/module?store=salesAnalysis" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">تحليل المبيعات</p><p className="mt-2 text-xs text-cyan-300">الإجمالي والمرتجعات والصافي</p></LocalLink><LocalLink href="/module?store=physicalInventory" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">الجرد الفعلي</p><p className="mt-2 text-xs text-amber-300">الفروق والتسويات</p></LocalLink><LocalLink href="/module?store=cheques" className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-bold text-white">الشيكات</p><p className="mt-2 text-xs text-violet-300">التحصيل والسداد</p></LocalLink></div></div><div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">صافي الدخل التشغيلي</p><p className="mt-2 text-2xl font-black text-white">{netIncome.toFixed(2)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">التدفق النقدي اليدوي</p><p className="mt-2 text-2xl font-black text-white">{management.netCashFlow.toFixed(2)}</p></div></div></div></div>;
}
