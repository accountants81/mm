import {
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Save,
  Banknote,
  BarChart3,
  BookOpen,
  Boxes,
  Calculator,
  CalendarCheck2,
  CalendarClock,
  ChevronLeft,
  CircleDollarSign,
  FileChartColumn,
  FileText,
  Landmark,
  Menu,
  MessageCircle,
  PackageSearch,
  Receipt,
  ScanLine,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { erpModules, modulePath } from "@/lib/moduleCatalog";
import { canManageUsers, getActiveLocalRole, isFixedManagerSession, logoutLocalSession } from "@/lib/localPermissions";
import { localList, localStoreCounts } from "@/lib/localDb";
import { writeAudit } from "@/lib/localAccountingRepository";

const siteUrl = "https://aamo.vercel.app/";
const whatsappPhone = "201010369035";
const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent("مرحبًا، أريد الاستفسار عن خدمات المحاسبة")}`;
const primaryPhone = "01010369035";
const secondaryPhone = "01226949834";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };


const sections: Array<{ title: string; note: string; icon: LucideIcon; tone: string; store: string }> = [
  { title: "القيود اليومية", note: "إدخال ومراجعة القيود", icon: BookOpen, tone: "red", store: "journalEntries" },
  { title: "المبيعات والفواتير", note: "فواتير البيع والعملاء", icon: Receipt, tone: "red", store: "invoices" },
  { title: "المشتريات والموردون", note: "أوامر الشراء والفواتير", icon: FileText, tone: "red", store: "contacts" },
  { title: "المخزون", note: "الأصناف وحركة المخزون", icon: Boxes, tone: "red", store: "products" },
  { title: "الخزينة والبنوك", note: "المقبوضات والمدفوعات", icon: Landmark, tone: "red", store: "cashAccounts" },
  { title: "التقارير المالية", note: "الدخل والمركز المالي", icon: FileChartColumn, tone: "red", store: "accounts" },
  { title: "الضرائب والإقرارات", note: "الوعاء والاستحقاق والسداد", icon: FileText, tone: "red", store: "taxReturns" },
  { title: "تكاليف الإنتاج", note: "المواد والأجور والتكلفة", icon: Calculator, tone: "red", store: "productionCosts" },
  { title: "الميزانية التقديرية", note: "التقديري مقابل الفعلي", icon: BarChart3, tone: "red", store: "budgets" },
  { title: "التدفقات النقدية", note: "تشغيلي واستثماري وتمويلي", icon: Banknote, tone: "red", store: "cashFlows" },
  { title: "المستخدمون والصلاحيات", note: "الأدوار وعدد مرات الدخول", icon: UsersRound, tone: "red", store: "users" },
  { title: "سجل التعديلات", note: "مراجعة الإضافة والتعديل والحذف", icon: ShieldCheck, tone: "red", store: "auditLogs" },
  { title: "العملات ومراكز التكلفة", note: "أسعار الصرف وربحية المراكز", icon: Calculator, tone: "red", store: "currencies" },
  { title: "السلف والتقسيط", note: "العهد والأقساط والأرصدة", icon: Banknote, tone: "red", store: "advances" },
  { title: "المؤشرات المالية", note: "النسب والربحية والسيولة", icon: BarChart3, tone: "red", store: "financialRatios" },
  { title: "التقارير المخصصة", note: "قوالب وتقارير محورية", icon: FileChartColumn, tone: "red", store: "customReports" },
  { title: "التنبيهات والمهام", note: "متابعة الاستحقاقات والتنفيذ", icon: CalendarClock, tone: "red", store: "tasks" },
  { title: "الفروع والتكاملات", note: "الفروع وERP والفواتير الإلكترونية", icon: ShieldCheck, tone: "red", store: "branches" },
];

const quickLinks: Array<[string, LucideIcon, string]> = [
  ["شجرة الحسابات", BookOpen, "/accounts"],
  ["الأستاذ العام", Scale, "/general-ledger"],
  ["ميزان المراجعة", Calculator, "/advanced-financial-reports"],
  ["تحليل العملاء", UsersRound, "/aging-reports"],
  ["تحليل الموردين", PackageSearch, "/aging-reports"],
  ["الأصول والإهلاك", CircleDollarSign, "/section/fixedAssets"],
];

const sidebarGroups = erpModules;
const currentYear = new Date().getFullYear();

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [localRole, setLocalRole] = useState(getActiveLocalRole());
  const [hasSession, setHasSession] = useState(false);
  const [dashboardCounts, setDashboardCounts] = useState({ accounts: 0, documents: 0, months: 0, analytics: 0 });

  useEffect(() => {
    setLocalRole(getActiveLocalRole());
    setHasSession(Boolean(localStorage.getItem("local-active-user-id") && localStorage.getItem("local-active-user-email")));
    const ownerId = getActiveLocalRole() === "مدير" ? undefined : localStorage.getItem("local-active-user-id") ?? undefined;
    void localStoreCounts({ ownerId }).then((counts) => {
      setDashboardCounts({
        accounts: counts.accounts ?? 0,
        documents: (counts.journalEntries ?? 0) + (counts.invoices ?? 0) + (counts.taxReturns ?? 0),
        months: Math.min(12, Number(counts.monthlyReports ?? 0)),
        analytics: (counts.financialAnalysis ?? 0) + (counts.financialRatios ?? 0) + (counts.kpis ?? 0),
      });
    }).catch(() => setDashboardCounts({ accounts: 0, documents: 0, months: 0, analytics: 0 }));
    if (localStorage.getItem("local-auth-required") === "1" && !localStorage.getItem("local-active-user-id")) {
      window.location.replace("/local-access");
      return;
    }
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
      setInstallMessage("تم تثبيت التطبيق بنجاح على الجهاز.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const confirmSessionAction = async (operation: "حفظ" | "خروج") => {
    const id = localStorage.getItem("local-active-user-id");
    const users = await localList<{ id: string; updatedAt: string; employeeBadgeCode?: string; code?: string; name?: string }>("users");
    const user = users.find(item => item.id === id);
    let verifiedQr = "";
    if (!isFixedManagerSession()) {
      const code = window.prompt(operation === "حفظ" ? "امسح QR Code لتأكيد حفظ البيانات:" : "امسح QR Code لتأكيد الخروج وحفظ التعديلات:");
      verifiedQr = code?.trim() ?? "";
      if (!verifiedQr || verifiedQr !== String(user?.employeeBadgeCode ?? user?.code ?? "").trim()) { window.alert(operation === "حفظ" ? "لم يتم تأكيد الهوية، البيانات لم تحفظ" : "لم يتم تأكيد الهوية، التعديلات لم تحفظ"); return; }
    }
    localStorage.setItem("last-pending-save-at", new Date().toISOString());
    await writeAudit(operation, "sessions", { id: id ?? "unknown", name: user?.name ?? "مستخدم محلي", ...(verifiedQr ? { qrCode: verifiedQr } : { qrCode: "غير مطلوب — المدير الموحد" }), updatedAt: new Date().toISOString() });
    if (operation === "خروج") { logoutLocalSession(); window.location.href = "/local-access"; }
  };

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setInstallMessage(choice.outcome === "accepted" ? "تم بدء تثبيت التطبيق." : "يمكنك التثبيت لاحقًا من قائمة المتصفح.");
      return;
    }
    setInstallMessage(/iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? "على iPhone: اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية."
      : "على Chrome أو Edge: افتح قائمة المتصفح ⋮ ثم اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية. إذا لم يظهر الخيار، افتح الرابط مباشرة في المتصفح وليس داخل واتساب.");
  };

  return (
    <div dir="rtl" className="accounting-shell min-h-[100dvh] text-[#eee8de] lg:flex">
      <aside className={`${sidebarOpen ? "lg:flex" : "lg:hidden"} hidden w-72 shrink-0 border-l border-[#e6d8ca]/10 bg-[#0c0b0c]/95 p-5 shadow-2xl shadow-black/30 lg:flex-col`}>
        <div className="ledger-rule flex items-center gap-3 pb-6">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-[#d9a766]/40 bg-[#a51e25] font-display text-lg font-bold text-[#fff5ee] shadow-[0_8px_24px_rgba(165,30,37,.28)]" aria-hidden="true">ع</span>
          <div><p className="font-bold text-[#f5eee6]">عبد العزيز عمران</p><p className="text-xs text-[#92857f]">المحاسبة القانونية</p></div>
        </div>
        <p className="mb-3 mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d8b83]">القائمة الرئيسية</p>
        <nav className="space-y-1">
          {hasSession && canManageUsers() && <LocalLink href="/section/users" className="mb-3 flex items-center gap-3 rounded-xl border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-3 text-sm font-bold text-[#f2c8c3] transition hover:bg-[#a51e25]/22"><UsersRound className="h-4 w-4 text-[#de7777]" /><span className="flex-1">إدارة بيانات المستخدمين</span><span className="text-[10px] text-[#de7777]">للمدير فقط</span></LocalLink>}
          {sidebarGroups.map((group) => { const GroupIcon = group.icon; return <details key={group.id} className="group/section"><summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#ddd2cb] transition hover:bg-[#f1e4d7]/[.05]"><GroupIcon className="h-4 w-4 text-[#c84b50]" /><span className="flex-1">{group.label}</span><span className="text-xs text-[#756660] transition group-open/section:rotate-90">‹</span></summary><div className="mr-3 space-y-1 border-r border-[#e6d8ca]/10 pr-3"><LocalLink href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#e38b87]">لوحة التحكم</LocalLink>{group.sections.filter(section => section.store !== "users" && (section.store !== "auditLogs" || (hasSession && canManageUsers()))).map((section) => <LocalLink key={`${group.id}-${section.label}`} href={modulePath(section)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#9d8d86] transition hover:bg-[#a51e25]/12 hover:text-[#f0b0a9]"><span className="h-1.5 w-1.5 rounded-full bg-[#75514e]" />{section.label}</LocalLink>)}</div></details>; })}
        </nav>
        <div className="mt-4 space-y-2 rounded-2xl border border-[#e6d8ca]/10 bg-[#f1e4d7]/[.03] p-3"><p className="text-xs text-[#9d8d86]">{hasSession ? "جلسة محلية مفعلة" : "لا توجد جلسة فعالة"}</p>{hasSession && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void confirmSessionAction("حفظ")} className="rounded-lg border border-[#d9a766]/30 bg-[#d9a766]/10 px-2 py-2 text-xs font-bold text-[#e2c48d] transition hover:bg-[#d9a766]/20"><Save className="ml-1 inline h-3.5 w-3.5" />حفظ</button><button type="button" onClick={() => void confirmSessionAction("خروج")} className="rounded-lg bg-[#a51e25]/12 px-2 py-2 text-xs font-bold text-[#e8aaa4] transition hover:bg-[#a51e25]/22">تسجيل الخروج</button></div>}</div>
          <div className="mt-auto rounded-2xl border border-[#b93a40]/25 bg-[#a51e25]/10 p-4"><p className="text-xs font-semibold text-[#efb0aa]">مساعدة المحاسب</p><p className="mt-2 text-xs leading-5 text-[#a99a93]">للاستفسار تواصل معنا مباشرة.</p><p className="mt-2 text-[11px] leading-5 text-[#cbb894]">الروابط الخارجية مثل واتساب والخرائط اختيارية وتحتاج اتصالًا؛ لا تؤثر على التخزين أو التشغيل المحلي.</p><a href={`tel:+20${primaryPhone.slice(1)}`} className="mt-3 block text-sm font-bold text-[#df7777]">{primaryPhone}</a><a href={`tel:+20${secondaryPhone.slice(1)}`} className="mt-1 block text-sm font-bold text-[#df7777]">{secondaryPhone}</a></div>
      </aside>
      <div className="min-w-0 flex-1">
       {mobileMenuOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="إغلاق القائمة" className="absolute inset-0 bg-[#050405]/75" onClick={() => setMobileMenuOpen(false)} /><aside className="absolute right-0 top-0 h-full w-[82%] max-w-sm border-l border-[#e6d8ca]/10 bg-[#171214] p-5 shadow-2xl"><div className="flex items-center justify-between border-b border-[#e6d8ca]/10 pb-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#d9a766]/40 bg-[#a51e25] text-sm font-bold text-[#fff5ee]" aria-hidden="true">ع</span><span className="font-bold text-[#f5eee6]">أقسام المحاسبة</span></div><button onClick={() => setMobileMenuOpen(false)} aria-label="إغلاق القائمة" className="rounded-lg p-2 text-[#a99a93] transition hover:bg-[#f1e4d7]/10"><X className="h-5 w-5" /></button></div><nav className="mt-6 space-y-2">{hasSession && canManageUsers() && <LocalLink onClick={() => setMobileMenuOpen(false)} href="/section/users" className="flex items-center gap-3 rounded-xl border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-3 text-sm font-bold text-[#f2c8c3]"><UsersRound className="h-4 w-4 text-[#de7777]" />إدارة بيانات المستخدمين <span className="mr-auto text-[10px] text-[#de7777]">للمدير فقط</span></LocalLink>}{sidebarGroups.map((group) => { const GroupIcon = group.icon; return <details key={group.id}><summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#ddd2cb]"><GroupIcon className="h-4 w-4 text-[#c84b50]" />{group.label}</summary><div className="mr-3 space-y-1 border-r border-[#e6d8ca]/10 pr-3"><LocalLink onClick={() => setMobileMenuOpen(false)} href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#e38b87]">لوحة التحكم</LocalLink>{group.sections.filter(section => section.store !== "users" && (section.store !== "auditLogs" || (hasSession && canManageUsers()))).map((section) => <LocalLink key={`${group.id}-${section.label}`} onClick={() => setMobileMenuOpen(false)} href={modulePath(section)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#9d8d86] hover:bg-[#a51e25]/12 hover:text-[#f0b0a9]"><span className="h-1.5 w-1.5 rounded-full bg-[#75514e]" />{section.label}</LocalLink>)}</div></details>; })}<LocalLink onClick={() => setMobileMenuOpen(false)} href="/about" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#b4a59e] hover:bg-[#a51e25]/12 hover:text-[#f0b0a9]"><ShieldCheck className="h-4 w-4 text-[#c84b50]" />عن النظام والخدمات</LocalLink></nav></aside></div>}
       <header className="sticky top-0 z-30 border-b border-[#e6d8ca]/10 bg-[#0c0b0c]/90 backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
             <span className="text-xs text-[#9d8d86]">لوحة المحاسب <span className="text-[#a51e25]">·</span> تشغيل محلي آمن</span>
            <div className="flex items-center gap-2">
               <button type="button" onClick={() => { if (window.innerWidth < 1024) setMobileMenuOpen(true); else setSidebarOpen(value => !value); }} className="inline-flex items-center gap-2 rounded-lg border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-2 text-xs font-bold text-[#efb0aa] transition hover:bg-[#a51e25]/22 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d35b60]" aria-label={sidebarOpen ? "إخفاء القائمة الجانبية" : "إظهار القائمة الجانبية"} aria-expanded={sidebarOpen}><Menu className="h-4 w-4" /> القائمة الجانبية</button>
               <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-2 text-xs font-bold text-[#efb0aa] transition hover:bg-[#a51e25]/22 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d35b60]" aria-label="التواصل عبر واتساب"><MessageCircle className="h-4 w-4" /> واتساب</a>
            </div>
          </div>

        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 lg:px-8">
           <div className="flex items-center gap-3">
             <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#d9a766]/40 bg-[#a51e25] font-display text-base font-bold text-[#fff5ee] shadow-[0_8px_24px_rgba(165,30,37,.28)]" aria-hidden="true">ع</span>
            <div>
               <p className="text-sm font-bold tracking-wide text-[#f5eee6]">عبد العزيز عمران</p>
               <p className="text-xs text-[#9d8d86]">نظام المحاسبة القانونية</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 text-xs text-slate-400 md:flex">
              <span className="rounded-full border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-1.5 text-[#e98d89]">السنة المالية {currentYear}</span>
             <div className="flex items-center gap-3"><a href={`tel:+20${primaryPhone.slice(1)}`} className="transition-colors hover:text-[#e98d89]">{primaryPhone}</a><a href={`tel:+20${secondaryPhone.slice(1)}`} className="transition-colors hover:text-[#e98d89]">{secondaryPhone}</a></div>
          </div>
          <div className="flex items-center gap-2">
              <LocalLink href="/qr-center?autoCamera=1" className="flex items-center gap-2 rounded-xl border border-[#d9a766]/35 bg-[#d9a766]/[.08] px-3 py-2 text-xs font-bold text-[#e2c48d] transition hover:bg-[#d9a766]/15" data-testid="link-top-qr"><ScanLine className="h-4 w-4" /> QR</LocalLink><button type="button" onClick={() => void confirmSessionAction("حفظ")} className="flex items-center gap-2 rounded-xl border border-[#d9a766]/35 bg-[#d9a766]/[.08] px-3 py-2 text-xs font-bold text-[#e2c48d] transition hover:bg-[#d9a766]/15" data-testid="button-home-save"><Save className="h-4 w-4" /> حفظ</button><button type="button" onClick={() => void confirmSessionAction("خروج")} className="flex items-center gap-2 rounded-xl border border-[#c84b50]/35 bg-[#7f2025]/15 px-3 py-2 text-xs font-bold text-[#e8aaa4] transition hover:bg-[#a51e25]/25" data-testid="button-home-logout">تسجيل الخروج</button><button type="button" onClick={handleInstall} className="flex items-center gap-2 rounded-xl border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-2 text-xs font-bold text-[#efb0aa] transition hover:bg-[#a51e25]/22">تثبيت التطبيق</button>
             <a href={siteUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-2 rounded-xl border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-2 text-xs font-semibold text-[#efb0aa] transition hover:bg-[#a51e25]/22 sm:flex">
              الموقع التعريفي <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

       <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-6 lg:px-8 lg:py-9">
         {installMessage && <div role="status" className="flex items-center justify-between gap-4 rounded-2xl border border-[#b93a40]/35 bg-[#a51e25]/12 px-4 py-3 text-sm text-[#f2c8c3]"><span>{installMessage}</span><button type="button" aria-label="إغلاق رسالة التثبيت" onClick={() => setInstallMessage(null)} className="rounded-lg px-2 py-1 text-[#efb0aa] transition hover:bg-[#f1e4d7]/10">إغلاق</button></div>}
         <section className="accounting-glass relative overflow-hidden rounded-[1.7rem] border border-[#d9a766]/15 bg-gradient-to-br from-[#2a171a] via-[#171214] to-[#3a151b] p-6 shadow-2xl shadow-black/25 lg:p-10">
           <div className="absolute -left-20 -top-28 h-72 w-72 rounded-full bg-[#a51e25]/25 blur-3xl" />
           <div className="absolute bottom-0 left-1/2 hidden h-px w-1/2 bg-gradient-to-l from-transparent via-[#c58b58]/50 to-transparent lg:block" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#e6a09b]">لوحة تحكم المحاسب <span className="text-[#d9a766]">/</span> {currentYear}</p>
               <h1 className="font-display text-3xl font-bold leading-[1.25] tracking-tight text-[#fff7ef] lg:text-5xl">مرحبًا بك في<br /><span className="text-[#df7777]">نظام محاسبة المصنع</span></h1>
               <p className="mt-5 max-w-xl text-sm leading-7 text-[#c0b2aa] lg:text-base">نظام موحد لإدارة الحسابات والقيود والفواتير والمخزون والتقارير المالية، مصمم ليكون واضحًا وسريعًا للمحاسب داخل المصنع.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                 <LocalLink href="/journal" className="inline-flex items-center gap-2 rounded-xl bg-[#bd3037] px-4 py-3 text-sm font-bold text-[#fff7ef] shadow-[0_10px_25px_rgba(165,30,37,.26)] transition hover:bg-[#d34b50]">إضافة قيد يومية <ArrowLeft className="h-4 w-4" /></LocalLink>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"><MessageCircle className="h-4 w-4" /> تواصل عبر واتساب</a>{hasSession && canManageUsers() && <LocalLink href="/section/users" className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20">إدارة المستخدمين</LocalLink>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[480px]">
              {([
                ["الحسابات", String(dashboardCounts.accounts), BookOpen],
                ["الأوراق المحاسبية", String(dashboardCounts.documents), FileText],
                ["الأشهر", String(dashboardCounts.months), CalendarClock],
                ["التحليلات", String(dashboardCounts.analytics), BarChart3],
               ] as Array<[string, string, LucideIcon]>).map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border border-[#e6d8ca]/12 bg-[#0b090a]/35 p-4 transition hover:border-[#d37a78]/35"><Icon className="mb-3 h-5 w-5 text-[#d98b82]" /><p className="font-display text-2xl font-bold text-[#fff7ef]">{value}</p><p className="mt-1 text-xs text-[#aa9b93]">{label}</p></div>)}
            </div>
          </div>
        </section>

        <section>
           <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d97675]">مساحات العمل</p><h2 className="mt-2 text-2xl font-bold text-[#f5eee6]">كل وحدة في مكان مستقل</h2></div><span className="hidden text-sm text-[#8d7d77] md:block">اختر الوحدة لبدء العمل</span></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
             {erpModules.map((module) => { const Icon = module.icon; return <LocalLink key={module.id} href={`/workspace/${module.id}`} className="accounting-card group rounded-2xl border border-[#e6d8ca]/10 bg-[#171315] p-5 transition hover:-translate-y-1 hover:border-[#c84b50]/45 hover:bg-[#211617]" data-testid={`link-home-module-${module.id}`}><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#c84b50]/25 bg-[#a51e25]/12 text-[#d97675]"><Icon className="h-5 w-5" /></div><div className="flex items-center justify-between"><div><h3 className="font-bold text-[#f3ebe4]">{module.label}</h3><p className="mt-1 text-sm text-[#a99a93]">{module.description}</p><p className="mt-3 text-xs text-[#d98b82]">{module.sections.length} أقسام فرعية</p></div><ChevronLeft className="h-5 w-5 text-[#695954] transition group-hover:-translate-x-1 group-hover:text-[#d97675]" /></div></LocalLink>; })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
           <div className="accounting-glass rounded-2xl border border-[#e6d8ca]/10 bg-[#171315] p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-bold text-[#f3ebe4]">اختصارات المحاسب</h2><ShieldCheck className="h-5 w-5 text-[#d98b82]" /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{quickLinks.map(([label, Icon, href]) => <LocalLink href={href} key={String(label)} className="flex items-center gap-2 rounded-xl border border-[#e6d8ca]/[.07] bg-[#0b090a]/30 px-3 py-3 text-sm text-[#b9aaa2] transition hover:border-[#c84b50]/35 hover:text-[#f3ebe4]" data-testid={`link-quick-${String(label)}`}><Icon className="h-4 w-4 text-[#d97675]" />{label}</LocalLink>)}</div></div>
           <div className="rounded-2xl border border-[#b93a40]/35 bg-gradient-to-br from-[#8f1b23]/35 to-[#211416] p-5"><p className="text-xs font-semibold text-[#f0aaa3]">عبد العزيز عمران للمحاسبة القانونية</p><h2 className="mt-3 text-xl font-bold text-[#fff3eb]">خبرة والتزام لخدمتك</h2><p className="mt-2 text-sm leading-6 text-[#c7b8b0]">خبرة أكثر من 25 عامًا في المحاسبة والضرائب، مع السرية والدقة وسرعة إنجاز الأعمال.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-[#d4c4b9]"><span className="rounded-full bg-[#f1e4d7]/10 px-3 py-1.5">محاسب قانوني معتمد</span><span className="rounded-full bg-[#f1e4d7]/10 px-3 py-1.5">تعامل أونلاين</span></div></div>
        </section>

         <footer className="space-y-4 border-t border-[#e6d8ca]/10 py-5 text-xs text-[#82736d]">
           <div className="grid gap-3 rounded-2xl border border-[#e6d8ca]/10 bg-[#171315]/70 p-4 text-[#a99a93] sm:grid-cols-2 lg:grid-cols-4">
             <a href="https://maps.app.goo.gl/BomNwQFaJ3swNyaP7" target="_blank" rel="noreferrer" title="رابط خارجي اختياري — يحتاج اتصالًا" className="hover:text-[#e98d89]">العنوان: 4 شارع محمود زرد، خلف برج الحديد، قويسنا، المنوفية <span className="text-[10px] text-[#cbb894]">(إنترنت)</span></a>
             <div className="flex flex-col gap-1"><a href={`tel:+20${primaryPhone.slice(1)}`} title="رابط اتصال خارجي اختياري — يحتاج شبكة هاتف" className="hover:text-[#e98d89]">الهاتف الأول: {primaryPhone}</a><a href={`tel:+20${secondaryPhone.slice(1)}`} title="رابط اتصال خارجي اختياري — يحتاج شبكة هاتف" className="hover:text-[#e98d89]">الهاتف الثاني: {secondaryPhone}</a></div>
             <a href="mailto:abdelaziz.omran76@gmail.com" title="رابط بريد خارجي اختياري — يحتاج اتصالًا" className="break-all hover:text-[#e98d89]">البريد: abdelaziz.omran76@gmail.com</a>
            <div className="flex flex-wrap gap-3"><a href={whatsappUrl} target="_blank" rel="noreferrer" title="رابط خارجي اختياري — يحتاج اتصالًا" className="hover:text-red-300">واتساب: {primaryPhone} <span className="text-[10px] text-amber-200/70">(إنترنت)</span></a><a href="https://www.facebook.com/share/1Dqv8nAF68/" target="_blank" rel="noreferrer" title="رابط خارجي اختياري — يحتاج اتصالًا" className="hover:text-red-300">فيسبوك <span className="text-[10px] text-amber-200/70">(إنترنت)</span></a><a href={siteUrl} target="_blank" rel="noreferrer" title="رابط خارجي اختياري — يحتاج اتصالًا" className="inline-flex items-center gap-1 text-red-300">الموقع <span className="text-[10px] text-amber-200/70">(إنترنت)</span> <ArrowUpRight className="h-3.5 w-3.5" /></a></div>
          </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span>© {currentYear} عبد العزيز عمران للمحاسبة القانونية</span><a href={siteUrl} target="_blank" rel="noreferrer" title="رابط خارجي اختياري — يحتاج اتصالًا" className="inline-flex items-center gap-2 text-[#df7777] transition hover:text-[#f0aaa3]">زيارة الموقع التعريفي <span className="text-[10px] text-[#cbb894]">(إنترنت)</span> <ArrowUpRight className="h-3.5 w-3.5" /></a></div>
        </footer>
      </main>
      </div>
    </div>
  );
}
