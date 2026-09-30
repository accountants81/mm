import { localList, localPut } from "./localDb";

export type LocalRole = "مدير" | "محاسب" | "مشرف";
export const localRoles: LocalRole[] = ["مدير", "محاسب", "مشرف"];
export const MANAGER_EMAIL = "AAO818@gmail.com";
// SHA-256 of the fixed manager password. The password itself is never stored.
export const MANAGER_PASSWORD_HASH = "78f37c2c16681938fa9fcdab4b8a40fff4e1f0e40390f90d53f9fd03efec00c3";

function hasConsistentLocalSession() {
  if (typeof window === "undefined") return false;
  const localId = localStorage.getItem("local-active-user-id");
  const sessionId = sessionStorage.getItem("local-active-user-id");
  const email = localStorage.getItem("local-active-user-email");
  return Boolean(localId && sessionId && email && localId === sessionId);
}

export function isFixedManagerSession() {
  if (!hasConsistentLocalSession()) return false;
  return localStorage.getItem("local-active-user-id") === "system-manager"
    && localStorage.getItem("local-active-user-email") === MANAGER_EMAIL.toLowerCase()
    && localStorage.getItem("local-active-role") === "مدير";
}

export function getActiveLocalRole(): LocalRole {
  if (isFixedManagerSession()) return "مدير";
  if (!hasConsistentLocalSession()) return "محاسب";
  const role = localStorage.getItem("local-active-role");
  return role === "مدير" && localStorage.getItem("local-company-manager-authorized") === "true" ? "مدير" : role === "مشرف" ? "مشرف" : "محاسب";
}

export function setActiveLocalRole(role: LocalRole) {
  localStorage.setItem("local-active-role", role);
}

export function logoutLocalSession() {
  localStorage.removeItem("local-active-user-id");
  localStorage.removeItem("local-active-role");
  localStorage.removeItem("local-active-user-email");
  localStorage.removeItem("local-active-user-name");
  localStorage.removeItem("local-company-manager-authorized");
  sessionStorage.removeItem("local-active-user-id");
}

export function canManageUsers(role = getActiveLocalRole()) {
  return role === "مدير" && hasConsistentLocalSession();
}

export function canManageAccounts(role = getActiveLocalRole()) {
  return role === "مدير" && isFixedManagerSession();
}

export function canEditAuditLogs(role = getActiveLocalRole()) {
  return role === "مدير" && isFixedManagerSession();
}

export function isManagerIdentity(userId: string, email: string, role: string) {
  return userId === "system-manager"
    && email.trim().toLowerCase() === MANAGER_EMAIL.toLowerCase()
    && role === "مدير";
}

export function getOrCreateDeviceFingerprint() {
  if (typeof window === "undefined") return "server-device";
  const existing = localStorage.getItem("local-device-id");
  if (existing) return existing;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem("local-device-id", id);
  return id;
}

export async function hashLocalPassword(password: string) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function changeLocalPassword(userId: string, currentPassword: string, newPassword: string) {
  const activeUserId = typeof window === "undefined" ? null : localStorage.getItem("local-active-user-id");
  if (activeUserId !== userId) throw new Error("لا يمكن تغيير كلمة مرور مستخدم آخر");
  if (newPassword.trim().length < 6) throw new Error("كلمة المرور قصيرة جدًا");
  const users = await localList("users");
  const user = users.find(item => item.id === userId);
  if (!user || user.passwordHash !== await hashLocalPassword(currentPassword)) throw new Error("كلمة المرور الحالية غير صحيحة");
  await localPut("users", { ...user, passwordHash: await hashLocalPassword(newPassword), updatedAt: new Date().toISOString() });
  return true;
}

export async function recordLocalSecurityEvent(
  operation: string,
  user?: { id?: string; code?: string; employeeNumber?: string; name?: string; email?: string; role?: string },
  reason?: string,
) {
  const timestamp = new Date().toISOString();
  await localPut("auditLogs", {
    id: `audit-security-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    updatedAt: timestamp,
    operation,
    table: "sessions",
    recordId: String(user?.id ?? "unknown"),
    user: String(user?.name ?? user?.email ?? "مستخدم غير معروف"),
    userCode: String(user?.employeeNumber ?? user?.code ?? user?.id ?? "unknown"),
    userEmail: String(user?.email ?? ""),
    role: String(user?.role ?? "غير معروف"),
    deviceId: getOrCreateDeviceFingerprint(),
    reason: reason ?? "",
  });
}

export async function registerLocalLogin(userId: string, password?: string) {
  const users = await localList("users");
  const user = users.find(item => item.id === userId);
  if (!user) return false;
  const attempts = Number(user.loginAttemptsUsed ?? 0);
  const maxAttempts = Number(user.maxLoginAttempts ?? 5);
  if (maxAttempts > 0 && attempts >= maxAttempts) {
    await recordLocalSecurityEvent("فشل دخول", user, "تجاوز الحد الأقصى لمحاولات الدخول");
    throw new Error("تجاوزت الحد الأقصى لمحاولات الدخول، راجع المدير");
  }
  if (user.passwordHash && user.passwordHash !== await hashLocalPassword(password ?? "")) {
    await localPut("users", { ...user, loginAttemptsUsed: Math.min(attempts + 1, maxAttempts || attempts + 1) });
    await recordLocalSecurityEvent("فشل دخول", user, "كلمة المرور غير صحيحة");
    return false;
  }
  if (user.id !== "system-manager" && user.systemAccessEnabled === false) {
    await recordLocalSecurityEvent("فشل دخول", user, "تم تعطيل دخول المستخدم");
    throw new Error("تم إيقاف دخول هذا الموظف إلى النظام بواسطة المدير");
  }
  const now = new Date();
  if (user.accessExpiresAt && new Date(String(user.accessExpiresAt)).getTime() <= now.getTime()) {
    await recordLocalSecurityEvent("فشل دخول", user, "انتهت صلاحية الحساب");
    throw new Error("انتهت صلاحية هذا الحساب، راجع المدير");
  }
  const device = getOrCreateDeviceFingerprint();
  const boundDevices = Array.isArray(user.boundDevices) ? user.boundDevices.map(String) : [];
  const maxDevices = Math.max(1, Number(user.maxDevices ?? 1));
  if (!boundDevices.includes(device) && boundDevices.length >= maxDevices) {
    await recordLocalSecurityEvent("فشل دخول", user, "تم تجاوز حد الأجهزة");
    throw new Error("هذا الحساب مرتبط بأقصى عدد من الأجهزة المسموح به، راجع المدير");
  }
  if (!boundDevices.includes(device)) boundDevices.push(device);
  const count = Number(user.loginCount ?? 0);
  const limit = Number(user.loginLimit ?? 0);
  if (String(user.status ?? "نشط") !== "نشط" || (limit > 0 && count >= limit)) {
    await recordLocalSecurityEvent("فشل دخول", user, "الحساب غير نشط أو تجاوز حد مرات الدخول");
    return false;
  }
  await localPut("users", { ...user, loginCount: count + 1, loginAttemptsUsed: 0, boundDevices, maxDevices, maxLoginAttempts: maxAttempts, lastLogin: now.toISOString().slice(0, 10) });
  const requestedRole = (user.role as LocalRole) || "محاسب";
  const isManager = isManagerIdentity(user.id, String(user.email ?? ""), requestedRole);
  setActiveLocalRole(isManager ? "مدير" : requestedRole === "مشرف" ? "مشرف" : "محاسب");
  localStorage.setItem("local-active-user-id", user.id);
  localStorage.setItem("local-active-user-email", String(user.email ?? "").trim().toLowerCase());
  localStorage.setItem("local-active-user-name", String(user.name ?? user.email ?? "مستخدم محلي"));
  if (requestedRole === "مدير" && !isManager) localStorage.setItem("local-company-manager-authorized", "true");
  else localStorage.removeItem("local-company-manager-authorized");
  sessionStorage.setItem("local-active-user-id", user.id);
  return true;
}
