import { FormEvent, useEffect, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { CalendarCheck2, ChevronRight, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { localList, type LocalRecord } from "@/lib/localDb";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import { Button } from "@/components/ui/button";

export default function PeriodLocks() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [reason, setReason] = useState("اعتماد ومراجعة شهرية");
  const [locks, setLocks] = useState<LocalRecord[]>([]);
  const [notice, setNotice] = useState("");
  const role = localStorage.getItem("local-active-role") ?? "مدير";
  const reload = async () => setLocks(await localList<LocalRecord>("periodLocks"));
  useEffect(() => { void reload(); }, []);
  const lockPeriod = async (event: FormEvent) => {
    event.preventDefault();
    if (role !== "مدير") { setNotice("إقفال الفترات متاح للمدير فقط."); return; }
    const already = locks.find(item => String(item.period) === period && String(item.status) !== "ملغي");
    if (already) { setNotice("هذه الفترة مقفلة بالفعل."); return; }
    await localAccountingRepository.save("periodLocks", { id: `period-${period}`, period, name: `إقفال ${period}`, lockedAt: new Date().toISOString(), lockedBy: localStorage.getItem("manus-runtime-user-info") ?? "المدير العام", reason, status: "مقفل", updatedAt: new Date().toISOString() });
    setNotice(`تم إقفال الفترة ${period}.`);
    await reload();
  };
  const unlock = async (id: string) => {
    if (role !== "مدير") return;
    const row = locks.find(item => item.id === id);
    if (!row) return;
    await localAccountingRepository.save("periodLocks", { ...row, status: "ملغي", unlockedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setNotice(`تم فتح الفترة ${String(row.period)}.`);
    await reload();
  };
  return <div dir="rtl" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 lg:px-8"><div className="mx-auto max-w-6xl space-y-6"><header className="rounded-3xl border border-amber-300/15 bg-gradient-to-l from-amber-300/10 via-slate-900 to-slate-900 p-6"><LocalLink href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-cyan-300"><ChevronRight className="h-4 w-4" /> العودة للوحة التحكم</LocalLink><div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-300/10 p-3 text-amber-200"><CalendarCheck2 className="h-7 w-7" /></div><div><p className="text-sm font-semibold text-amber-200">الاعتماد الشهري</p><h1 className="text-3xl font-black">إقفال الفترات المحاسبية</h1></div></div><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">بعد إقفال الشهر، يمنع النظام تعديل أو حذف حركاته للمستخدمين التشغيليين، بينما يحتفظ المدير بصلاحية الفتح مع تسجيل العملية.</p></header>{notice && <div role="status" className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}<form onSubmit={lockPeriod} className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.045] p-5 md:grid-cols-[180px_1fr_auto] md:items-end"><label className="text-sm text-slate-300">الفترة<input value={period} onChange={event => setPeriod(event.target.value)} type="month" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white" /></label><label className="text-sm text-slate-300">سبب الإقفال<input value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white" /></label><Button type="submit" className="bg-amber-300 text-slate-950 hover:bg-amber-200"><LockKeyhole className="ml-2 h-4 w-4" /> إقفال الفترة</Button></form><section className="grid gap-4 md:grid-cols-2">{locks.map(lock => <article key={String(lock.id)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5"><div className="flex items-center justify-between"><div><p className="text-xl font-black text-white">{String(lock.period)}</p><p className="mt-1 text-sm text-slate-400">{String(lock.reason ?? "-")}</p></div>{String(lock.status) === "مقفل" ? <LockKeyhole className="h-6 w-6 text-amber-200" /> : <UnlockKeyhole className="h-6 w-6 text-emerald-300" />}</div><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{String(lock.status)}</span>{String(lock.status) === "مقفل" && role === "مدير" && <Button variant="outline" onClick={() => void unlock(String(lock.id))} className="border-emerald-300/20 bg-transparent text-emerald-200"><UnlockKeyhole className="ml-2 h-4 w-4" /> فتح الفترة</Button>}</div></article>)}</section>{!locks.length && <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-slate-400">لا توجد فترات مقفلة بعد.</div>}</div></div>;
}
