import { useEffect, useMemo, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { ArrowRightLeft, CheckCircle2, ChevronRight, RotateCcw, ShieldCheck } from "lucide-react";
import type { LocalRecord } from "@/lib/localDb";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import { reverseSourcePostings } from "@/lib/localPostingEngine";
import { Button } from "@/components/ui/button";

const sourceLabels: Record<string, string> = {
  invoices: "الفواتير", salesReturns: "مرتجعات المبيعات", purchaseReturns: "مرتجعات المشتريات", fixedAssets: "الأصول والإهلاك", expenses: "المصروفات", revenues: "الإيرادات", payroll: "الرواتب", purchaseOrders: "أوامر الشراء", salesOrders: "أوامر البيع", paymentOrders: "أوامر الصرف", collectionOrders: "أوامر التحصيل", productionOrders: "أوامر الإنتاج", projects: "المشروعات", customsClearance: "التخليص الجمركي", leases: "الإيجارات", loans: "القروض", investments: "الاستثمارات", insurancePolicies: "التأمين", donations: "التبرعات",
};

export default function PostingCenter() {
  const [links, setLinks] = useState<LocalRecord[]>([]);
  const [sources, setSources] = useState<LocalRecord[]>([]);
  const [notice, setNotice] = useState("");
  const role = localStorage.getItem("local-active-role") ?? "مدير";
  const reload = async () => {
    const [nextLinks, ...sourceRows] = await Promise.all([localAccountingRepository.list("postingLinks"), ...Object.keys(sourceLabels).map(store => localAccountingRepository.list(store as never))]);
    setLinks(nextLinks.sort((a, b) => String(b.createdAt ?? b.updatedAt ?? "").localeCompare(String(a.createdAt ?? a.updatedAt ?? ""))));
    setSources(sourceRows.flat());
  };
  useEffect(() => { void reload(); }, []);
  const grouped = useMemo(() => links.reduce<Record<string, LocalRecord[]>>((acc, link) => { const key = `${link.sourceStore}:${link.sourceId}`; (acc[key] ??= []).push(link); return acc; }, {}), [links]);
  const reverse = async (sourceStore: string, sourceId: string) => {
    if (role !== "مدير") { setNotice("العكس اليدوي متاح للمدير فقط حفاظًا على سلامة الدورة المحاسبية."); return; }
    if (!window.confirm("سيتم عكس آثار المستند مع الإبقاء على سجل المراجعة. هل تريد المتابعة؟")) return;
    await reverseSourcePostings(sourceStore as never, sourceId);
    setNotice("تم عكس الآثار المرتبطة مع الاحتفاظ بالمستند الأصلي.");
    await reload();
  };
  return <div dir="rtl" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-cyan-400/15 bg-gradient-to-l from-cyan-400/10 via-slate-900 to-violet-500/10 p-6 md:flex-row md:items-end md:justify-between">
        <div><LocalLink href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-cyan-300"><ChevronRight className="h-4 w-4" /> العودة للوحة التحكم</LocalLink><div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-300/10 p-3 text-cyan-300"><ArrowRightLeft className="h-7 w-7" /></div><div><p className="text-sm font-semibold text-cyan-300">مركز المراجعة والربط</p><h1 className="mt-1 text-3xl font-black">مركز الترحيل المحاسبي</h1></div></div><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">شاهد المستند الأصلي وكل أثر أنشأه في الخزينة والمخزون والقيود، ثم نفّذ العكس عند الحاجة بصلاحية المدير دون حذف أصل المستند.</p></div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300"><ShieldCheck className="h-4 w-4 text-emerald-300" />{role === "مدير" ? "صلاحية عكس كاملة" : "مراجعة فقط"}</div>
      </header>
      {notice && <div role="status" className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
      <div className="grid gap-4 sm:grid-cols-3"><Metric label="روابط الترحيل" value={links.length} /><Metric label="المستندات ذات الأثر" value={Object.keys(grouped).length} /><Metric label="الأقسام المتصلة" value={new Set(links.map(link => link.targetStore)).size} /></div>
      <section className="space-y-4">{Object.entries(grouped).map(([key, rows]) => { const [sourceStore, sourceId] = key.split(":"); const source = sources.find(row => row.id === sourceId && Object.keys(sourceLabels).some(store => store === sourceStore)); return <article key={key} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">{sourceLabels[sourceStore] ?? sourceStore}</span><span className="text-xs text-slate-500">#{sourceId?.slice(-8)}</span></div><h2 className="mt-3 text-lg font-bold text-white">{String(source?.name ?? source?.code ?? source?.documentNumber ?? "مستند مرتبط")}</h2><p className="mt-1 text-sm text-slate-400">{String(source?.date ?? source?.updatedAt ?? "بدون تاريخ")}</p></div><Button variant="outline" disabled={role !== "مدير"} onClick={() => void reverse(sourceStore, sourceId)} className="border-rose-300/20 bg-transparent text-rose-200 hover:bg-rose-300/10"><RotateCcw className="ml-2 h-4 w-4" /> عكس الآثار</Button></div><div className="mt-5 grid gap-3 md:grid-cols-3">{rows.map(row => <div key={String(row.id)} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-cyan-200">{String(row.postingType ?? "أثر محاسبي")}</span><CheckCircle2 className="h-4 w-4 text-emerald-300" /></div><p className="mt-2 text-xs text-slate-400">إلى: {String(row.targetStore ?? "-")}</p><p className="mt-1 text-xs text-slate-500">{String(row.reversed ? "معكوس" : "نشط")}</p></div>)}</div></article>; })}</section>
      {!links.length && <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-12 text-center text-slate-400">ستظهر هنا آثار المستندات بعد اعتماد الفواتير أو المصروفات أو الأوامر التشغيلية.</div>}
    </div>
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-white">{value.toLocaleString("ar-EG")}</p></div>; }
