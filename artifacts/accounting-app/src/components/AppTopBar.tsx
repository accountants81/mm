import { Bell, Check, ChevronLeft, Home, LogOut, Menu, MessageCircle, Save, ScanLine, ShieldCheck, WifiOff, X } from "lucide-react";
import { useState } from "react";
import LocalLink from "@/components/LocalLink";
import { getActiveLocalRole, isFixedManagerSession, logoutLocalSession } from "@/lib/localPermissions";
import { localList } from "@/lib/localDb";
import { writeAudit } from "@/lib/localAccountingRepository";
import { erpModules, modulePath } from "@/lib/moduleCatalog";

const whatsappUrl = `https://wa.me/201010369035?text=${encodeURIComponent("مرحبًا، أريد الاستفسار عن خدمات المحاسبة")}`;
async function savePendingChanges() { if (typeof window !== "undefined") localStorage.setItem("last-pending-save-at", new Date().toISOString()); }

export default function AppTopBar({ title, compact = false }: { title?: string; compact?: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isManager = getActiveLocalRole() === "مدير";
  const activeEmail = typeof window !== "undefined" ? localStorage.getItem("local-active-user-email") ?? "" : "";
  const activeName = typeof window !== "undefined" ? localStorage.getItem("local-active-user-name") ?? "" : "";
  const confirmAndSave = async () => {
    const users = await localList<{ id: string; updatedAt: string; employeeBadgeCode?: string; code?: string; name?: string }>("users");
    const id = localStorage.getItem("local-active-user-id");
    const user = users.find(item => item.id === id);
    let verifiedQr = "";
    if (!isFixedManagerSession()) {
      const code = window.prompt("امسح QR Code لتأكيد حفظ البيانات:");
      verifiedQr = code?.trim() ?? "";
      if (!verifiedQr || verifiedQr !== String(user?.employeeBadgeCode ?? user?.code ?? "").trim()) { window.alert("لم يتم تأكيد الهوية، البيانات لم تحفظ"); return; }
    }
    await savePendingChanges();
    await writeAudit("حفظ", "sessions", { id: id ?? "unknown", name: user?.name ?? "مستخدم محلي", ...(verifiedQr ? { qrCode: verifiedQr } : { qrCode: "غير مطلوب — المدير الموحد" }), updatedAt: new Date().toISOString() });
  };
  const confirmAndLogout = async () => {
    const users = await localList<{ id: string; updatedAt: string; employeeBadgeCode?: string; code?: string; name?: string }>("users");
    const id = localStorage.getItem("local-active-user-id");
    const user = users.find(item => item.id === id);
    let verifiedQr = "";
    if (!isFixedManagerSession()) {
      const code = window.prompt("يرجى مسح QR Code الخاص بك لتأكيد الخروج وحفظ التعديلات.");
      verifiedQr = code?.trim() ?? "";
      if (!verifiedQr || verifiedQr !== String(user?.employeeBadgeCode ?? user?.code ?? "").trim()) {
        window.alert("لم يتم تأكيد الهوية، التعديلات لم تحفظ");
        return;
      }
    }
    await savePendingChanges();
    await writeAudit("خروج", "sessions", { id: id ?? "unknown", name: user?.name ?? "مستخدم محلي", ...(verifiedQr ? { qrCode: verifiedQr } : { qrCode: "غير مطلوب — المدير الموحد" }), updatedAt: new Date().toISOString() });
    logoutLocalSession();
    window.location.href = "/local-access";
  };
  const closeSidebar = () => setSidebarOpen(false);
  return <>
    <header dir="rtl" className="sticky top-0 z-40 border-b border-[#e6d8ca]/10 bg-[#0c0b0c]/95 shadow-[0_10px_30px_rgba(3,2,2,.3)] backdrop-blur-xl" data-testid="app-top-bar">
      <div className={`mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 ${compact ? "py-3" : "py-3 lg:px-8"}`}>
        <div className="flex min-w-0 items-center gap-3">
           <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d9a766]/40 bg-[#a51e25] font-display text-sm font-bold text-[#fff5ee] shadow-[0_8px_22px_rgba(165,30,37,.28)]" aria-hidden="true">ع</span>
          <div className="min-w-0">
             <p className="truncate text-sm font-extrabold tracking-tight text-[#f5eee6]">عبد العزيز عمران</p>
             <p className="truncate text-xs text-[#9d8d86]">{title || "نظام المحاسبة القانونية"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="hidden items-center gap-1.5 rounded-full border border-[#bd7771]/25 bg-[#a51e25]/10 px-3 py-1.5 text-[11px] font-semibold text-[#e6aaa3] sm:inline-flex">
            <Check className="h-3.5 w-3.5" /> محفوظ على الجهاز
          </span>
           <span className="hidden items-center gap-1.5 rounded-full border border-[#d9a766]/25 bg-[#d9a766]/[.08] px-3 py-1.5 text-[11px] font-semibold text-[#e2c48d] md:inline-flex" title={activeEmail}>
            <ShieldCheck className="h-3.5 w-3.5" /> {activeName || activeEmail || (isManager ? "مدير النظام" : "مستخدم محلي")}
          </span>
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="التنقل الرئيسي">
             <button type="button" onClick={() => setSidebarOpen(value => !value)} className="inline-flex items-center gap-2 rounded-lg border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-2 text-xs font-bold text-[#efb0aa] transition hover:bg-[#a51e25]/22 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d35b60]" aria-label={sidebarOpen ? "إخفاء الشريط الجانبي" : "إظهار الشريط الجانبي"} aria-expanded={sidebarOpen} data-testid="button-top-sidebar"><Menu className="h-4 w-4" /> <span className="hidden sm:inline">التنقل</span></button>
             <LocalLink href="/offline-settings" className="hidden items-center gap-2 rounded-lg border border-[#e6d8ca]/12 px-3 py-2 text-xs text-[#b4a59e] transition hover:border-[#c84b50]/40 hover:text-[#f0c5bd] sm:inline-flex" data-testid="link-top-storage"><WifiOff className="h-4 w-4" /> التخزين</LocalLink>
              <LocalLink href="/qr-center?autoCamera=1" className="inline-flex items-center gap-2 rounded-lg border border-[#d9a766]/35 bg-[#d9a766]/[.08] px-3 py-2 text-xs font-bold text-[#e2c48d] transition hover:bg-[#d9a766]/15" data-testid="link-top-qr"><ScanLine className="h-4 w-4" /> QR</LocalLink>
             <LocalLink href="/notifications" className="inline-flex items-center gap-2 rounded-lg border border-[#d9a766]/35 bg-[#d9a766]/[.08] px-3 py-2 text-xs font-bold text-[#e2c48d] transition hover:bg-[#d9a766]/15" aria-label="مركز الإشعارات"><Bell className="h-4 w-4" /> إشعارات</LocalLink>
             <a href={whatsappUrl} target="_blank" rel="noreferrer" title="رابط خارجي اختياري — يحتاج اتصالًا" className="hidden items-center gap-2 rounded-lg border border-[#e6d8ca]/12 px-3 py-2 text-xs text-[#b4a59e] transition hover:border-[#c84b50]/40 hover:text-[#f0c5bd] lg:inline-flex" data-testid="link-top-whatsapp"><MessageCircle className="h-4 w-4" /> تواصل</a>
              <button type="button" onClick={() => void confirmAndSave()} className="inline-flex items-center gap-2 rounded-lg border border-[#d9a766]/35 bg-[#d9a766]/[.08] px-3 py-2 text-xs font-bold text-[#e2c48d] transition hover:bg-[#d9a766]/15" data-testid="button-top-save"><Save className="h-4 w-4" /> حفظ</button><button type="button" onClick={() => void confirmAndLogout()} className="inline-flex items-center gap-2 rounded-lg border border-[#c84b50]/35 bg-[#7f2025]/15 px-3 py-2 text-xs font-bold text-[#e8aaa4] transition hover:bg-[#a51e25]/25" data-testid="button-top-logout"><LogOut className="h-4 w-4" /> خروج</button>
          </nav>
        </div>
      </div>
    </header>
    {sidebarOpen && <div className="fixed inset-0 z-[100] h-[100dvh] w-full" role="dialog" aria-modal="true" aria-label="الشريط الجانبي للتنقل">
       <button type="button" onClick={closeSidebar} className="absolute inset-0 h-full w-full bg-[#050405]/80 backdrop-blur-sm" aria-label="إغلاق الشريط الجانبي" />
       <aside className="absolute right-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[min(90vw,400px)] flex-col overflow-hidden border-l border-[#e6d8ca]/12 bg-[#171214] p-5 shadow-2xl shadow-black/70">
         <div className="flex shrink-0 items-center justify-between border-b border-[#e6d8ca]/10 pb-5">
           <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#d9a766]/40 bg-[#a51e25] font-display text-sm font-bold text-[#fff5ee]" aria-hidden="true">ع</span><div><p className="font-bold text-[#f5eee6]">دليل النظام</p><p className="text-xs text-[#9d8d86]">كل أقسام المحاسبة في مكان واحد</p></div></div>
           <button type="button" onClick={closeSidebar} className="rounded-lg p-2 text-[#9d8d86] transition hover:bg-[#f1e4d7]/10 hover:text-[#f5eee6]" aria-label="إغلاق الشريط الجانبي"><X className="h-5 w-5" /></button>
        </div>
        <nav className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain" aria-label="كل أقسام النظام">
           <LocalLink onClick={closeSidebar} href="/" className="flex items-center gap-3 rounded-xl border border-[#b93a40]/35 bg-[#a51e25]/12 px-3 py-3 text-sm font-bold text-[#f0c5bd]"><Home className="h-4 w-4 text-[#df7777]" /> لوحة التحكم</LocalLink>
            <LocalLink onClick={closeSidebar} href="/qr-generator" className="flex items-center gap-3 rounded-xl border border-[#d9a766]/30 bg-[#d9a766]/[.08] px-3 py-3 text-sm font-bold text-[#e2c48d]"><ScanLine className="h-4 w-4" /> مولد QR Code</LocalLink>
           {isManager && <LocalLink onClick={closeSidebar} href="/section/users" className="flex items-center gap-3 rounded-xl border border-[#d9a766]/25 bg-[#d9a766]/[.08] px-3 py-3 text-sm font-bold text-[#e2c48d]"><ShieldCheck className="h-4 w-4 text-[#e2c48d]" /> المستخدمون والصلاحيات</LocalLink>}
           {erpModules.map(group => { const GroupIcon = group.icon; return <details key={group.id} className="group/sidebar"><summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#ddd2cb] transition hover:bg-[#f1e4d7]/[.06]"><GroupIcon className="h-4 w-4 text-[#d97675]" /><span className="flex-1">{group.label}</span><ChevronLeft className="h-4 w-4 text-[#796a64] transition group-open/sidebar:-rotate-90" /></summary><div className="mr-3 space-y-1 border-r border-[#e6d8ca]/10 pr-3">{group.sections.filter(section => section.store !== "users" && (section.store !== "auditLogs" || isManager)).map(section => <LocalLink onClick={closeSidebar} key={`${group.id}-${section.label}`} href={modulePath(section)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[#a99a93] transition hover:bg-[#a51e25]/15 hover:text-[#f0c5bd]"><span className="h-1.5 w-1.5 rounded-full bg-[#9f5c59]" />{section.label}</LocalLink>)}</div></details>; })}
           <LocalLink onClick={closeSidebar} href="/about" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#b4a59e] transition hover:bg-[#a51e25]/15 hover:text-[#f0c5bd]"><span className="h-1.5 w-1.5 rounded-full bg-[#9f5c59]" /> عن النظام والخدمات</LocalLink>
        </nav>
      </aside>
    </div>}
  </>;
}
