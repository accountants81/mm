import { useEffect, useMemo, useState } from "react";
import { BookOpen, Printer } from "lucide-react";
import AppTopBar from "@/components/AppTopBar";
import LocalLink from "@/components/LocalLink";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import { journalLinesOf, type JournalLine } from "@/lib/journalUtils";
import type { LocalRecord } from "@/lib/localDb";

type LedgerRow = JournalLine & { date: string; reference: string; source: string };
const money = (value: number) => value.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GeneralLedger() {
  const [rows, setRows] = useState<LocalRecord[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [account, setAccount] = useState("");
  useEffect(() => {
    void localAccountingRepository.list("journalEntries").then(setRows);
  }, []);
  const ledgerRows = useMemo<LedgerRow[]>(() => rows
    .filter(row => String(row.date ?? row.updatedAt ?? "").startsWith(month))
    .flatMap(row => journalLinesOf(row).map(line => ({
      ...line,
      date: String(row.date ?? row.updatedAt ?? "").slice(0, 10),
      reference: String(row.reference ?? row.code ?? row.id),
      source: String(row.sourceName ?? row.name ?? "قيد يومية"),
    })))
    .filter(row => !account || row.account.toLowerCase().includes(account.toLowerCase())), [rows, month, account]);
  const totals = ledgerRows.reduce((result, row) => ({ debit: result.debit + row.debit, credit: result.credit + row.credit }), { debit: 0, credit: 0 });
  return <div dir="rtl" className="accounting-shell min-h-screen text-slate-100"><AppTopBar title="الأستاذ العام" /><main className="mx-auto max-w-7xl px-4 py-8 lg:px-8"><div className="rounded-3xl border border-white/10 bg-white/[.035] p-6 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-bold text-cyan-300"><BookOpen className="h-4 w-4" /> دفتر الأستاذ العام</p><h1 className="mt-2 text-3xl font-black text-white">حركة الحسابات حسب الفترة</h1><p className="mt-2 text-sm leading-6 text-slate-400">يُبنى السجل من بنود القيود المرحّلة الفعلية، مع استبعاد القيود الملغاة والمعكوسة.</p></div><div className="flex gap-2"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"><Printer className="h-4 w-4" /> طباعة</button><LocalLink href="/advanced-financial-reports" className="rounded-xl border border-violet-300/30 px-3 py-2 text-sm text-violet-200">ميزان المراجعة</LocalLink></div></div><div className="mt-6 grid gap-3 sm:grid-cols-[180px_1fr_auto]"><label className="text-xs text-slate-400">الشهر<input type="month" value={month} onChange={event => setMonth(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white" /></label><label className="text-xs text-slate-400">الحساب<input value={account} onChange={event => setAccount(event.target.value)} placeholder="ابحث باسم الحساب" className="mt-2 w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white" /></label><div className="rounded-xl border border-cyan-300/20 bg-cyan-400/[.05] px-4 py-3 text-sm text-cyan-100">المدين {money(totals.debit)} — الدائن {money(totals.credit)}</div></div><div className="mt-6 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[760px] w-full text-right text-sm"><thead className="bg-[#211c1f] text-xs text-slate-400"><tr><th className="px-4 py-3">التاريخ</th><th className="px-4 py-3">المرجع</th><th className="px-4 py-3">البيان</th><th className="px-4 py-3">الحساب</th><th className="px-4 py-3">مدين</th><th className="px-4 py-3">دائن</th></tr></thead><tbody>{ledgerRows.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-500">لا توجد حركة حسابات في الفترة المحددة.</td></tr> : ledgerRows.map((row, index) => <tr key={`${row.reference}-${row.account}-${index}`} className="border-t border-white/10"><td className="px-4 py-3 text-slate-400">{row.date}</td><td className="px-4 py-3 text-slate-400">{row.reference}</td><td className="px-4 py-3 text-slate-300">{row.source}</td><td className="px-4 py-3 font-semibold text-white">{row.account}</td><td className="px-4 py-3 text-emerald-200">{money(row.debit)}</td><td className="px-4 py-3 text-amber-200">{money(row.credit)}</td></tr>)}</tbody><tfoot className="bg-black/10 font-black"><tr><td colSpan={4} className="px-4 py-3">الإجمالي</td><td className="px-4 py-3">{money(totals.debit)}</td><td className="px-4 py-3">{money(totals.credit)}</td></tr></tfoot></table></div></div></main></div>;
}