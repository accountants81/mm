import { BookOpenCheck, CheckCircle2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import type { LocalRecord } from "@/lib/localDb";

export default function Journal() {
  const [entries, setEntries] = useState<LocalRecord[]>([]);
  const [description, setDescription] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [type, setType] = useState("يومي");
  const [message, setMessage] = useState("");
  const refresh = async () => setEntries(await localAccountingRepository.list("journalEntries"));
  useEffect(() => { void refresh(); }, []);
  const addEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim() || !debit || !credit) return;
    if (Number(debit) !== Number(credit)) { setMessage("لا يمكن حفظ القيد: إجمالي المدين يجب أن يساوي إجمالي الدائن."); return; }
    await localAccountingRepository.save("journalEntries", { id: `entry-${Date.now()}`, name: description.trim(), type, debit, credit, status: "متوازن", updatedAt: new Date().toISOString() });
    setDescription(""); setDebit(""); setCredit(""); setMessage("تم حفظ القيد المتوازن محليًا."); await refresh();
  };
  return <div dir="rtl" className="min-h-screen bg-[#07111f] px-4 py-8 text-slate-100 lg:px-10"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-center justify-between gap-3"><LocalLink href="/" className="text-sm text-cyan-300">العودة للوحة التحكم</LocalLink><LocalLink href="/module?store=journalEntries" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-200">فتح نموذج القيود الشامل</LocalLink></div><div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-cyan-300">اليومية المحلية</p><h1 className="mt-2 text-3xl font-black text-white">القيود اليومية</h1><p className="mt-2 text-sm text-slate-400">قيد يومي أو افتتاحي أو تسوية أو إقفال مع تحقق التوازن.</p></div><BookOpenCheck className="h-8 w-8 text-emerald-300" /></div><form onSubmit={addEntry} className="mt-7 grid gap-3 md:grid-cols-4"><input required value={description} onChange={event => setDescription(event.target.value)} placeholder="البيان" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none md:col-span-2" /><select value={type} onChange={event => setType(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"><option>يومي</option><option>افتتاحي</option><option>تسوية</option><option>إقفال</option></select><input required type="number" step="0.01" value={debit} onChange={event => setDebit(event.target.value)} placeholder="المدين" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" /><input required type="number" step="0.01" value={credit} onChange={event => setCredit(event.target.value)} placeholder="الدائن" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" /><button className="rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950 md:col-span-4">حفظ القيد محليًا</button></form>{message && <p className={`mt-4 text-sm ${message.includes("لا يمكن") ? "text-rose-300" : "text-emerald-300"}`}>{message}</p>}<div className="mt-8 space-y-2">{entries.map(entry => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-4"><div><p className="font-bold text-white">{String(entry.name)}</p><p className="mt-1 text-xs text-slate-500">{String(entry.type)} — مدين {String(entry.debit)} / دائن {String(entry.credit)}</p></div><span className="inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" /> متوازن</span></div>)}</div></div></div></div>;
}
