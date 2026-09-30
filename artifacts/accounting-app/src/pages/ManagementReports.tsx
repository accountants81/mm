import { useEffect, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { localAccountingRepository } from "@/lib/localAccountingRepository";

type Summary = { budgets: number; planned: number; actual: number; cashFlows: number; netCashFlow: number; postedCash: number; postedCashCount: number; taxReturns: number; taxAmount: number; auditLogs: number };
const number = (value: unknown) => Number(value ?? 0) || 0;

export default function ManagementReports() {
  const [summary, setSummary] = useState<Summary>({ budgets: 0, planned: 0, actual: 0, cashFlows: 0, netCashFlow: 0, postedCash: 0, postedCashCount: 0, taxReturns: 0, taxAmount: 0, auditLogs: 0 });
  useEffect(() => {
    void Promise.all([
      localAccountingRepository.list("budgets"),
      localAccountingRepository.list("cashFlows"),
      localAccountingRepository.list("taxReturns"),
      localAccountingRepository.list("auditLogs"),
      localAccountingRepository.list("cashTransactions"),
    ]).then(([budgets, cashFlows, taxReturns, auditLogs, cashTransactions]) => setSummary({
      budgets: budgets.length,
      planned: budgets.reduce((sum, row) => sum + number(row.planned), 0),
      actual: budgets.reduce((sum, row) => sum + number(row.actual), 0),
      cashFlows: cashFlows.length,
      netCashFlow: cashFlows.reduce((sum, row) => sum + number(row.netCashFlow), 0),
      postedCash: cashTransactions.filter(row => row.postingStatus !== "معكوس").reduce((sum, row) => sum + (row.direction === "قبض" ? number(row.amount) : -number(row.amount)), 0),
      postedCashCount: cashTransactions.filter(row => row.postingStatus !== "معكوس").length,
      taxReturns: taxReturns.length,
      taxAmount: taxReturns.reduce((sum, row) => sum + number(row.taxAmount), 0),
      auditLogs: auditLogs.length,
    }));
  }, []);
  const budgetDifference = summary.actual - summary.planned;
  return <div dir="rtl" className="min-h-screen bg-[#07111f] px-4 py-8 text-slate-100 lg:px-10"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-center justify-between gap-3"><LocalLink href="/reports" className="text-sm text-cyan-300">العودة إلى مركز التقارير</LocalLink><LocalLink href="/" className="text-sm text-slate-400">لوحة التحكم</LocalLink></div><section className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-[#13213b] to-[#21143c] p-7"><p className="text-sm font-semibold text-cyan-300">المرحلة التشغيلية — تقارير الإدارة</p><h1 className="mt-2 text-3xl font-black text-white">الميزانية والتدفقات والضرائب والتدقيق</h1><p className="mt-3 text-sm leading-7 text-slate-300">تُحسب المؤشرات من البيانات المحلية المحفوظة على الجهاز، ويمكن مراجعة التفاصيل من الأقسام المرتبطة.</p></section><div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">بنود الميزانية</p><p className="mt-2 text-3xl font-black text-violet-200">{summary.budgets}</p><p className="mt-2 text-xs text-slate-500">التقديري: {summary.planned.toFixed(2)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">فرق الميزانية</p><p className="mt-2 text-3xl font-black text-cyan-200">{budgetDifference.toFixed(2)}</p><p className="mt-2 text-xs text-slate-500">الفعلي: {summary.actual.toFixed(2)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">صافي التدفق النقدي</p><p className="mt-2 text-3xl font-black text-emerald-200">{summary.postedCash.toFixed(2)}</p><p className="mt-2 text-xs text-slate-500">الحركات المرحّلة: {summary.postedCashCount} — اليدوية: {summary.cashFlows}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs text-slate-400">الضرائب والتدقيق</p><p className="mt-2 text-3xl font-black text-amber-200">{summary.taxAmount.toFixed(2)}</p><p className="mt-2 text-xs text-slate-500">إقرارات: {summary.taxReturns} — تعديلات: {summary.auditLogs}</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><LocalLink href="/module?store=budgets" className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300 hover:border-cyan-300/40">فتح الميزانية التقديرية</LocalLink><LocalLink href="/module?store=cashFlows" className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300 hover:border-cyan-300/40">فتح التدفقات النقدية</LocalLink><LocalLink href="/module?store=taxReturns" className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300 hover:border-cyan-300/40">فتح الضرائب والإقرارات</LocalLink><LocalLink href="/module?store=auditLogs" className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300 hover:border-cyan-300/40">فتح سجل التعديلات</LocalLink></div></div></div>;
}
