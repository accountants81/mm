import { useEffect, useMemo, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import type { LocalRecord } from "@/lib/localDb";
import { journalLinesOf } from "@/lib/journalUtils";

type Tab = "ledger" | "trial" | "income" | "position" | "closing" | "adjustments";
const tabs: Array<[Tab, string]> = [["ledger", "الأستاذ العام"], ["trial", "ميزان المراجعة"], ["income", "قائمة الدخل"], ["position", "المركز المالي"], ["closing", "قيود الإقفال"], ["adjustments", "التسويات"]];
type ReportRow = { id: string; label: string; code: string; debit: number; credit: number; value: number; nature: string; source: string };

export default function ReportDetails() {
  const [tab, setTab] = useState<Tab>("ledger");
  const [rows, setRows] = useState<LocalRecord[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  useEffect(() => {
    const store = tab === "closing" ? "closingEntries" : tab === "adjustments" ? "adjustments" : tab === "ledger" || tab === "trial" ? "journalEntries" : tab === "income" ? "revenues" : "accounts";
    void localAccountingRepository.list(store).then(setRows);
  }, [tab]);
  useEffect(() => { setPage(1); }, [tab]);
   const reportRows = useMemo<ReportRow[]>(() => rows.flatMap((row, index) => {
     const lines = tab === "ledger" || tab === "trial" ? journalLinesOf(row) : [];
      if (lines.length) {
        const grouped = new Map<string, ReportRow>();
        for (const line of lines) {
          const key = String(line.account || "حساب غير محدد");
          const current = grouped.get(key) ?? { id: `${String(row.id ?? index)}-${key}`, label: key, code: String(row.code ?? row.reference ?? "-"), debit: 0, credit: 0, value: 0, nature: String(row.nature ?? row.statement ?? "-"), source: String(row.source ?? row.name ?? "محلي") };
          current.debit += line.debit;
          current.credit += line.credit;
          current.value = current.debit - current.credit;
          grouped.set(key, current);
        }
        return Array.from(grouped.values());
      }
     const debit = Number(row.debit ?? 0); const credit = Number(row.credit ?? 0); const value = Number(row.total ?? row.amount ?? row.value ?? debit - credit);
     return [{ id: String(row.id ?? index), label: String(row.name ?? row.description ?? "بدون بيان"), code: String(row.code ?? row.type ?? "-"), debit, credit, value, nature: String(row.nature ?? row.statement ?? "-"), source: String(row.source ?? "محلي") }];
   }), [rows, tab]);
  const totalDebit = reportRows.reduce((sum, row) => sum + row.debit, 0); const totalCredit = reportRows.reduce((sum, row) => sum + row.credit, 0); const totalValue = reportRows.reduce((sum, row) => sum + row.value, 0); const pageCount = Math.max(1, Math.ceil(reportRows.length / pageSize)); const visibleRows = reportRows.slice((page - 1) * pageSize, page * pageSize);
  const title = tabs.find(([key]) => key === tab)?.[1] ?? "التقرير";
  const headers = tab === "trial" ? ["الحساب", "الطبيعة", "مدين", "دائن"] : tab === "income" ? ["بند الإيراد", "رقم/نوع", "القيمة", "المصدر"] : tab === "position" ? ["الحساب", "القائمة", "القيمة", "الطبيعة"] : tab === "ledger" ? ["بيان القيد", "رقم القيد", "مدين", "دائن"] : ["البيان", "رقم المستند", "القيمة", "المصدر"];
  return <div dir="rtl" className="min-h-screen bg-[#07111f] px-4 py-8 text-slate-100 lg:px-10"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between"><LocalLink href="/reports" className="text-sm text-cyan-300">العودة لملخص التقارير</LocalLink><span className="text-xs text-slate-500">بيانات محلية</span></div><div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6"><h1 className="text-3xl font-black text-white">التقارير التفصيلية</h1><p className="mt-2 text-sm text-slate-400">كل تبويب يستخدم مخزنًا ومنطق عرض مناسبًا لنوع التقرير.</p><div className="mt-6 flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm ${tab === key ? "bg-cyan-300 font-bold text-slate-950" : "border border-white/10 text-slate-300"}`}>{label}</button>)}</div><div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">{title}</h2><span className="text-sm text-cyan-200">الصفوف: {reportRows.length} — المدين: {totalDebit.toFixed(2)} — الدائن: {totalCredit.toFixed(2)} — القيمة: {totalValue.toFixed(2)}</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm"><thead><tr className="border-b border-white/10 text-slate-500">{headers.map(header => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead><tbody>{visibleRows.map(row => <tr key={row.id} className="border-b border-white/5"><td className="px-3 py-3 font-semibold text-white">{row.label}</td><td className="px-3 py-3 text-slate-400">{tab === "position" || tab === "trial" ? row.nature : row.code}</td><td className="px-3 py-3 text-cyan-200">{tab === "ledger" || tab === "trial" ? row.debit.toFixed(2) : row.value.toFixed(2)}</td><td className="px-3 py-3 text-violet-200">{tab === "ledger" || tab === "trial" ? row.credit.toFixed(2) : row.source}</td></tr>)}</tbody></table>{reportRows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">لا توجد صفوف في هذا التقرير بعد.</p>}{reportRows.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm"><span className="text-slate-400">عرض الصفوف {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, reportRows.length)} من {reportRows.length}</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 disabled:opacity-40">السابق</button><span className="text-cyan-200">صفحة {page} من {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))} className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 disabled:opacity-40">التالي</button></div></div>}</div></div></div></div></div>;
}
