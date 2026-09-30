import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Link2,
  RefreshCcw,
  Search,
  ShieldCheck,
  TableProperties,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import LocalLink from "@/components/LocalLink";
import { erpModules } from "@/lib/moduleCatalog";
import { exportLocalBackup, parseLocalBackup } from "@/lib/localDb";
import { auditLocalRelations, type LocalRelationAudit, type LocalStoreAudit } from "@/lib/localRelations";
import { getActiveLocalRole } from "@/lib/localPermissions";

const storeLabels = new Map(
  erpModules.flatMap(module => module.sections.filter(section => section.store).map(section => [section.store as string, section.label] as const)),
);

function labelForStore(store: string) {
  return storeLabels.get(store) ?? store;
}

function statusForStore(store: LocalStoreAudit) {
  if (store.orphanRefs || store.unresolvedFields || store.duplicateCodes) return "warning";
  return "ok";
}

function formatNumber(value: number) {
  return value.toLocaleString("ar-EG");
}

type StorageInfo = {
  mode: "IndexedDB" | "localStorage";
  usage?: number;
  quota?: number;
};

export default function SystemHealth() {
  const [audit, setAudit] = useState<LocalRelationAudit | null>(null);
  const [storage, setStorage] = useState<StorageInfo>({ mode: typeof indexedDB === "undefined" ? "localStorage" : "IndexedDB" });
  const [backupReady, setBackupReady] = useState<boolean | null>(null);
  const [backupError, setBackupError] = useState("");
  const [search, setSearch] = useState("");
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const isManager = getActiveLocalRole() === "مدير";
  const ownerId = isManager ? undefined : (typeof window !== "undefined" ? localStorage.getItem("local-active-user-id") ?? undefined : undefined);

  const runAudit = async () => {
    setLoading(true);
    setError("");
    setBackupError("");
    try {
      const nextAudit = await auditLocalRelations({ ownerId });
      setAudit(nextAudit);
      setLastChecked(new Date());
      const nextStorage: StorageInfo = { mode: typeof indexedDB === "undefined" ? "localStorage" : "IndexedDB" };
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        nextStorage.usage = estimate.usage;
        nextStorage.quota = estimate.quota;
      }
      setStorage(nextStorage);
      try {
        const backup = await exportLocalBackup();
        parseLocalBackup(backup);
        setBackupReady(true);
      } catch (backupFailure) {
        setBackupReady(false);
        setBackupError(backupFailure instanceof Error ? backupFailure.message : "تعذر التحقق من النسخة الاحتياطية.");
      }
    } catch (auditFailure) {
      setError(auditFailure instanceof Error ? auditFailure.message : "تعذر إكمال فحص قاعدة البيانات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void runAudit(); }, []);

  const filteredStores = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (audit?.byStore ?? [])
      .filter(store => !showOnlyIssues || statusForStore(store) === "warning")
      .filter(store => !term || store.store.toLocaleLowerCase().includes(term) || labelForStore(store.store).toLocaleLowerCase().includes(term))
      .sort((a, b) => Number(statusForStore(b) === "warning") - Number(statusForStore(a) === "warning") || b.records - a.records);
  }, [audit, search, showOnlyIssues]);

  const issueCount = (audit?.orphanRefs ?? 0) + (audit?.unresolvedFields ?? 0) + (audit?.duplicateCodes ?? 0);
  const storagePercent = storage.usage && storage.quota ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : null;

  return (
    <div dir="rtl" className="min-h-screen bg-[#09090b] px-4 py-8 text-slate-100 lg:px-10">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <LocalLink href="/offline-settings" className="mb-4 inline-flex text-sm font-semibold text-red-300 transition hover:text-red-200">العودة إلى التخزين والنسخ</LocalLink>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-200"><ShieldCheck className="h-6 w-6" /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">مركز الثقة والاعتماد</p>
                <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">صحة النظام والبيانات</h1>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">فحص قراءة فقط لكل أقسام قاعدة البيانات المحلية والعلاقات بينها. لا يغيّر هذا الفحص أي سجل، ويمكن تشغيله بعد الاستيراد أو قبل اعتماد دورة مالية.</p>
          </div>
          <button type="button" onClick={() => void runAudit()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400 disabled:cursor-wait disabled:opacity-60">
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "جارٍ الفحص..." : "إعادة الفحص"}
          </button>
        </div>

        {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100"><XCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {([
            ["المخازن", audit?.stores ?? 0, TableProperties, "text-red-200"],
            ["إجمالي السجلات", audit?.records ?? 0, Database, "text-white"],
            ["العلاقات المكتشفة", audit?.relationRefs ?? 0, Link2, "text-red-200"],
            ["مراجع تحتاج مراجعة", issueCount, issueCount ? XCircle : CheckCircle2, issueCount ? "text-amber-200" : "text-emerald-200"],
            ["النسخة الاحتياطية", backupReady === true ? "سليمة" : backupReady === false ? "مشكلة" : "—", HardDrive, backupReady === true ? "text-emerald-200" : "text-amber-200"],
          ] as Array<[string, number | string, LucideIcon, string]>).map(([label, value, Icon, tone]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[0_14px_45px_rgba(0,0,0,.2)]">
              <Icon className={`h-5 w-5 ${String(tone)}`} />
              <p className="mt-4 text-xs text-slate-500">{label}</p>
              <strong className={`mt-1 block text-2xl font-black ${String(tone)}`}>{typeof value === "number" ? formatNumber(value) : value}</strong>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-black text-white">تغطية الفحص</h2><p className="mt-1 text-xs text-slate-500">عرض كل قسم مع حالته التفصيلية</p></div>
              <label className="relative block sm:w-64">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث عن قسم" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 pr-9 text-sm text-white outline-none transition focus:border-red-400/50" />
              </label>
            </div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-[850px] w-full text-right text-sm">
                <thead className="bg-white/[0.04] text-xs text-slate-500"><tr><th className="px-4 py-3">القسم</th><th className="px-4 py-3">السجلات</th><th className="px-4 py-3">روابط</th><th className="px-4 py-3">يتيمة</th><th className="px-4 py-3">غير محلولة</th><th className="px-4 py-3">تكرارات</th><th className="px-4 py-3">الحالة</th></tr></thead>
                <tbody>
                  {loading && Array.from({ length: 6 }, (_, index) => <tr key={index} className="border-t border-white/10"><td colSpan={7} className="px-4 py-4"><span className="block h-4 animate-pulse rounded bg-white/10" /></td></tr>)}
                  {!loading && filteredStores.map(store => {
                    const status = statusForStore(store);
                    return <tr key={store.store} className="border-t border-white/10 transition hover:bg-red-500/[0.035]">
                      <td className="px-4 py-3"><div className="font-bold text-slate-200">{labelForStore(store.store)}</div><div className="mt-1 font-mono text-[10px] text-slate-600" dir="ltr">{store.store}</div></td>
                      <td className="px-4 py-3 font-bold text-white">{formatNumber(store.records)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatNumber(store.relationRefs)}</td>
                      <td className={`px-4 py-3 ${store.orphanRefs ? "font-bold text-amber-200" : "text-slate-500"}`}>{formatNumber(store.orphanRefs)}</td>
                      <td className={`px-4 py-3 ${store.unresolvedFields ? "font-bold text-amber-200" : "text-slate-500"}`}>{formatNumber(store.unresolvedFields)}</td>
                      <td className={`px-4 py-3 ${store.duplicateCodes ? "font-bold text-amber-200" : "text-slate-500"}`}>{formatNumber(store.duplicateCodes)}</td>
                      <td className="px-4 py-3">{status === "ok" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /> سليم</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200"><AlertTriangle className="h-3.5 w-3.5" /> يحتاج مراجعة</span>}</td>
                    </tr>;
                  })}
                  {!loading && !filteredStores.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">لا توجد أقسام مطابقة.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-red-400/20 bg-gradient-to-br from-red-500/[0.13] to-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-white">مصدر التخزين</h2><p className="mt-1 text-xs text-slate-500">الحالة الحالية لهذا الجهاز</p></div><Database className="h-5 w-5 text-red-300" /></div>
              <p className="mt-5 text-2xl font-black text-red-100">{storage.mode}</p>
              <p className="mt-2 text-xs leading-6 text-slate-400">{storage.mode === "IndexedDB" ? "التخزين الدائم الأساسي يعمل عبر IndexedDB." : "يعمل النظام عبر localStorage كبديل. يفضّل استخدام متصفح يدعم IndexedDB."}</p>
              {storagePercent !== null && <div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-500"><span>الاستخدام التقريبي</span><span>{storagePercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/30"><div className={`h-full rounded-full ${storagePercent > 80 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${storagePercent}%` }} /></div></div>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-white">فلاتر المراجعة</h2><p className="mt-1 text-xs text-slate-500">ركّز على الأقسام التي تحتاج تدخلًا</p></div><AlertTriangle className="h-5 w-5 text-amber-200" /></div>
              <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300"><input type="checkbox" checked={showOnlyIssues} onChange={event => setShowOnlyIssues(event.target.checked)} className="h-4 w-4 accent-red-500" /> عرض الأقسام التي بها مشاكل فقط</label>
              <p className="mt-4 text-xs leading-6 text-slate-500">المراجع اليتيمة تعني أن سجلًا يشير إلى سجل تم حذفه. الحقل غير المحلول يعني أن كود العلاقة لا يطابق دليلًا موجودًا. التكرار يراجع الأكواد داخل كل قسم.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-xs text-slate-500">
              <p>آخر فحص: <span className="text-slate-300">{lastChecked ? lastChecked.toLocaleString("ar-EG") : "جارٍ التنفيذ"}</span></p>
              {backupError && <p className="mt-2 text-amber-200">{backupError}</p>}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}