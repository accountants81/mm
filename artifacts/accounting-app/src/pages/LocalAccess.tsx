import { ArrowLeft, Check, Database, LockKeyhole, ShieldCheck, WifiOff } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { localDelete, localList, localPut } from "@/lib/localDb";
import { getActiveLocalRole, logoutLocalSession, MANAGER_EMAIL, MANAGER_PASSWORD_HASH, recordLocalSecurityEvent, registerLocalLogin } from "@/lib/localPermissions";
import { writeAudit } from "@/lib/localAccountingRepository";
import { recordQrScan } from "@/lib/qr";

type LocalUser = { id: string; code?: string; name?: string; email?: string; role?: string; status?: string; loginCount?: number; loginLimit?: number; accessExpiresAt?: string | null; boundDevices?: string[]; maxDevices?: number; maxLoginAttempts?: number; loginAttemptsUsed?: number; employeeBadgeCode?: string; updatedAt: string; passwordHash?: string };
const siteUrl = "https://aamo.vercel.app/";

export default function LocalAccess() {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ensureManagerRecord = async () => {
    const rows = await localList<LocalUser>("users");
    const normalizedManagerEmail = MANAGER_EMAIL.toLowerCase();
    const legacyManagerEmails = ["abdelaziz.omran76@gmail.com", "aa0818@gmail.com"];
    const managerCandidates = rows.filter(item => item.id === "system-manager" || [normalizedManagerEmail, ...legacyManagerEmails].includes(String(item.email ?? "").trim().toLowerCase()));
    const manager = managerCandidates.find(item => item.id === "system-manager") ?? managerCandidates[0];
    const managerRecord = { id: "system-manager", code: "MANAGER", name: "مدير النظام", email: MANAGER_EMAIL, role: "مدير", status: "نشط", loginCount: manager?.loginCount ?? 0, loginLimit: 0, maxDevices: manager?.maxDevices ?? 1, maxLoginAttempts: 0, loginAttemptsUsed: manager?.loginAttemptsUsed ?? 0, boundDevices: manager?.boundDevices ?? [], employeeBadgeCode: manager?.employeeBadgeCode ?? "MANAGER", accessExpiresAt: manager?.accessExpiresAt ?? null, passwordHash: MANAGER_PASSWORD_HASH, updatedAt: manager?.updatedAt ?? new Date().toISOString() };
    await localPut("users", manager ? { ...manager, ...managerRecord } : managerRecord);
    for (const duplicate of managerCandidates.filter(item => item.id !== "system-manager")) await localDelete("users", duplicate.id);
    return managerRecord;
  };

  const refresh = async () => {
    await ensureManagerRecord();
    const rows = await localList<LocalUser>("users");
    setUsers(rows);
  };
  useEffect(() => { void refresh(); }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const loginEmail = String(formData.get("manual-login-id-v3") ?? "").trim();
    const loginPassword = String(formData.get("manual-secret-v3") ?? "");
    setEmail(loginEmail); setPassword(loginPassword); setError(""); setMessage(""); setBusy(true);
    let user: LocalUser | undefined;
    try {
      if (loginEmail.toLowerCase() === MANAGER_EMAIL.toLowerCase()) await ensureManagerRecord();
      const currentUsers = await localList<LocalUser>("users");
      user = currentUsers.find(item => String(item.email ?? "").trim().toLowerCase() === loginEmail.toLowerCase());
      if (!user) {
        await recordLocalSecurityEvent("فشل دخول", { email: loginEmail }, "البريد غير مسجل");
        setError("لم يتم العثور على هذا البريد. راجع البريد أو قم بتهيئة حساب المدير.");
        return;
      }
      const ok = await registerLocalLogin(user.id, loginPassword);
      if (!ok) { setError("تعذر الدخول. راجع كلمة المرور أو حالة المستخدم أو حد مرات الدخول."); return; }
      const isUnifiedManager = user.id === "system-manager" && String(user.email ?? "").trim().toLowerCase() === MANAGER_EMAIL.toLowerCase();
      let verifiedQr = "";
      if (!isUnifiedManager) {
        const badge = window.prompt("امسح QR Code الخاص بك أو أدخل الكود يدويًا للمتابعة:");
        verifiedQr = badge?.trim() ?? "";
        if (!verifiedQr || verifiedQr !== String(user.employeeBadgeCode ?? user.code ?? "").trim()) {
          const latest = (await localList<LocalUser>("users")).find(item => item.id === user?.id);
          if (latest) await localPut("users", { ...latest, loginCount: Math.max(0, Number(latest.loginCount ?? 1) - 1) });
          await recordLocalSecurityEvent("رفض QR", user, "رمز QR غير صحيح");
          logoutLocalSession();
          setError("رمز QR غير صحيح، لم يتم فتح الجلسة.");
          return;
        }
        await recordQrScan({ qrCode: verifiedQr, targetStore: "users", targetId: user.id, targetLabel: user.name ?? user.email ?? "مستخدم", action: "login", source: "local-login", scannedAt: new Date().toISOString() });
      }
      await writeAudit("دخول", "sessions", { id: user.id, name: user.name ?? user.email ?? "موظف", ...(verifiedQr ? { qrCode: verifiedQr } : { qrCode: "غير مطلوب — المدير الموحد" }), updatedAt: new Date().toISOString() });
      setEmail(""); setPassword("");
      setMessage(`تم تسجيل الدخول بنجاح بصلاحية ${getActiveLocalRole()}.`);
      window.setTimeout(() => { window.location.replace("/"); }, 250);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إتمام تسجيل الدخول.");
    } finally { setBusy(false); }
  };

  const createManager = async () => {
    setError(""); setMessage(""); setBusy(true);
    try {
      await localPut("users", { id: "system-manager", code: "MANAGER", name: "مدير النظام", email: MANAGER_EMAIL, role: "مدير", status: "نشط", loginCount: 0, loginLimit: 0, maxDevices: 1, maxLoginAttempts: 0, loginAttemptsUsed: 0, boundDevices: [], employeeBadgeCode: "MANAGER", accessExpiresAt: null, passwordHash: MANAGER_PASSWORD_HASH, updatedAt: new Date().toISOString() });
      setEmail(""); setPassword(""); await refresh();
      setMessage("تمت تهيئة حساب المدير الثابت محليًا. استخدم البريد المعتمد لتسجيل الدخول.");
    } finally { setBusy(false); }
  };

  return (
    <main data-login-screen="manual-entry-v3" dir="rtl" className="accounting-shell flex min-h-[100dvh] items-center px-4 py-6 text-[#eee8de] sm:px-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[1.8rem] border border-[#e6d8ca]/12 bg-[#171214]/90 shadow-[0_28px_100px_rgba(3,2,2,.6)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden min-h-[650px] overflow-hidden border-l border-[#e6d8ca]/10 bg-gradient-to-br from-[#251719] via-[#161113] to-[#33161b] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full border border-[#d9a766]/20 bg-[#d9a766]/[.04]" aria-hidden="true" />
          <div className="absolute bottom-20 right-8 h-44 w-44 rounded-full border border-[#c84b50]/20" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl border border-[#d9a766]/45 bg-[#a51e25] font-display text-lg font-bold text-[#fff5ee] shadow-[0_10px_28px_rgba(165,30,37,.3)]">ع</span><div><p className="font-extrabold text-[#f5eee6]">عبد العزيز عمران</p><p className="text-xs text-[#a99a93]">للمحاسبة القانونية</p></div></div>
            <div className="mt-20 max-w-md"><p className="text-xs font-bold tracking-[.18em] text-[#e2c48d]">دفتر موثوق، على جهازك</p><h1 className="mt-5 font-display text-5xl font-bold leading-[1.22] tracking-tight text-[#fff5ee]">حسابات واضحة<br /><span className="text-[#df7777]">وقرارات أهدأ.</span></h1><p className="mt-6 text-sm leading-8 text-[#c0b2aa]">نظام محاسبي محلي يحفظ السجلات والقيود والتقارير داخل هذا الجهاز، مع صلاحيات واضحة ونسخ احتياطية تحت سيطرتك.</p></div>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {[["محلي", "بياناتك لا تغادر الجهاز"], ["موثّق", "سجل تعديلات واضح"], ["مستمر", "يعمل دون إنترنت"]].map(([value, label]) => <div key={value} className="rounded-2xl border border-[#e6d8ca]/10 bg-[#0b090a]/40 p-4"><p className="text-lg font-extrabold text-[#e2c48d]">{value}</p><p className="mt-1 text-[11px] leading-5 text-[#a99a93]">{label}</p></div>)}
          </div>
        </section>

        <section className="bg-[#141113] p-6 sm:p-10 lg:p-12">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold text-[#df7777]"><WifiOff className="h-4 w-4" /> وصول محلي آمن</div><h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#fff5ee]">تسجيل الدخول</h2></div><span className="rounded-full border border-[#d9a766]/25 bg-[#d9a766]/[.08] px-3 py-1.5 text-[11px] font-bold text-[#e2c48d]">بدون إنترنت</span></div>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#a99a93]">أدخل بيانات الحساب المحلي. لن يتم فتح لوحة التحكم قبل نجاح التحقق من الجهاز والصلاحية.</p>
          {users.length === 0 ? (
            <form onSubmit={event => { event.preventDefault(); void createManager(); }} className="mt-8 rounded-2xl border border-[#e5c983]/25 bg-[#b89b5e]/[.08] p-5" data-testid="form-initialize-manager">
              <div className="flex items-start gap-3"><div className="rounded-xl bg-[#d9a766]/15 p-2.5 text-[#e2c48d]"><Database className="h-5 w-5" /></div><div><p className="font-bold text-[#f0d899]">إعداد الجهاز لأول مرة</p><p className="mt-2 text-sm leading-6 text-[#c0b2aa]">لا يوجد مستخدم محلي بعد. أنشئ حساب المدير الثابت لبدء استخدام النظام.</p></div></div>
              <input type="text" name="create-manager-email" autoComplete="username" value={MANAGER_EMAIL} readOnly aria-hidden="true" tabIndex={-1} className="sr-only" />
               <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b52b32] px-4 py-3 text-sm font-extrabold text-[#fff5ee] shadow-lg shadow-[#6d171d]/25 transition hover:bg-[#d3484e] disabled:opacity-50" data-testid="button-initialize-manager">{busy ? "جارٍ التهيئة..." : "تهيئة حساب المدير محليًا"}<ArrowLeft className="h-4 w-4" /></button>
            </form>
          ) : (
            <form onSubmit={login} className="mt-8 space-y-5" data-testid="form-local-login">
              <label className="block"><span className="mb-2 block text-xs font-bold text-[#e2c48d]">البريد الإلكتروني</span><div className="relative"><Database className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c84b50]" /><input type="email" inputMode="email" name="manual-login-id-v3" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-xl border border-[#c84b50]/25 bg-[#241b1d] py-3.5 pr-10 pl-3 text-sm text-[#f2ead8] outline-none transition focus:border-[#df7777]/70 focus:bg-[#2b1d20]" data-testid="input-local-email" /></div></label>
              <label className="block"><span className="mb-2 block text-xs font-bold text-[#e2c48d]">كلمة المرور</span><div className="relative"><LockKeyhole className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c84b50]" /><input type="password" name="manual-secret-v3" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" className="w-full rounded-xl border border-[#c84b50]/25 bg-[#241b1d] py-3.5 pr-10 pl-3 text-sm text-[#f2ead8] outline-none transition focus:border-[#df7777]/70 focus:bg-[#2b1d20]" data-testid="input-local-password" /></div></label>
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#a51e25] px-4 py-3.5 text-sm font-extrabold text-[#fff5ee] shadow-lg shadow-[#6d171d]/30 transition hover:bg-[#c33239] disabled:opacity-50" data-testid="button-local-login">{busy ? "جارٍ التحقق..." : "تسجيل الدخول"}<ArrowLeft className="h-4 w-4" /></button>
            </form>
          )}
          {error && <p role="alert" className="mt-5 rounded-xl border border-[#e9aaa4]/25 bg-[#b95750]/10 p-3.5 text-sm leading-6 text-[#efb9af]" data-testid="status-login-error">{error}</p>}
          {message && <p role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-[#9bd9b4]/25 bg-[#3e9168]/10 p-3.5 text-sm leading-6 text-[#a9dfbd]" data-testid="status-login-message"><Check className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>}
          <div className="mt-8 border-t border-[#d9a766]/15 pt-6"><div className="flex items-center gap-2 text-xs text-[#a99a93]"><ShieldCheck className="h-4 w-4 text-[#e5c983]" /> الحساب الأساسي ثابت ولا يمكن حذفه</div><a href={siteUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#df7777] transition hover:text-[#f0b0a9]" data-testid="link-public-site">زيارة الموقع التعريفي <ArrowLeft className="h-3.5 w-3.5" /></a></div>
        </section>
      </div>
    </main>
  );
}
