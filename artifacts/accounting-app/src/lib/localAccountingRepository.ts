import { localDelete, localList, localPut, type LocalRecord, type StoreName } from "./localDb";
import { reverseSourcePostings, syncSourcePostings } from "./localPostingEngine";
import { resolveRecordRelations } from "./localRelations";
import { validateAccountingRecord } from "./accountingValidation";
import { canManageAccounts, canManageUsers, getActiveLocalRole, getOrCreateDeviceFingerprint, isFixedManagerSession, MANAGER_EMAIL, MANAGER_PASSWORD_HASH } from "./localPermissions";

export type AccountingStore = StoreName;

function auditUser() {
  try {
    const raw = localStorage.getItem("manus-runtime-user-info");
    const user = raw ? JSON.parse(raw) as { name?: string; email?: string } : null;
    return user?.name || user?.email || "المستخدم المحلي";
  } catch {
    return "المستخدم المحلي";
  }
}

function localAccessContext() {
  if (typeof window === "undefined") return { activeUserId: null, role: "محاسب" };
  const localId = localStorage.getItem("local-active-user-id");
  const sessionId = sessionStorage.getItem("local-active-user-id");
  const email = localStorage.getItem("local-active-user-email");
  const activeUserId = localId && sessionId && email && localId === sessionId ? localId : null;
  const role = activeUserId ? getActiveLocalRole() : "محاسب";
  return { activeUserId, role };
}

async function actorMetadata() {
  const { activeUserId, role } = localAccessContext();
  const email = typeof window !== "undefined" ? String(localStorage.getItem("local-active-user-email") ?? "") : "";
  const users = await localList<LocalRecord>("users");
  const actor = users.find(item => item.id === activeUserId);
  const name = String(actor?.name ?? (email || "المستخدم المحلي"));
  const code = String(actor?.employeeNumber ?? actor?.employeeBadgeCode ?? actor?.code ?? activeUserId ?? "unknown");
  return { id: activeUserId ?? "unknown", code, name, email, role, deviceId: getOrCreateDeviceFingerprint() };
}

function recordPeriod(record: LocalRecord) {
  const explicit = String(record.period ?? "").trim();
  if (explicit) return explicit;
  const rawDate = String(record.date ?? record.countDate ?? record.orderDate ?? record.purchaseDate ?? record.statementDate ?? "");
  return rawDate.slice(0, 7);
}

const uniqueCodeStores: AccountingStore[] = ["accounts", "contacts", "products", "employees", "fixedAssets", "cashAccounts", "branches"];

async function ensurePeriodOpen(store: AccountingStore, record: LocalRecord | undefined, role: string) {
  if (!record || role === "مدير" || store === "periodLocks" || store === "settings") return;
  const period = recordPeriod(record);
  if (!period) return;
  const locks = await localList<LocalRecord>("periodLocks");
  const locked = locks.some(lock => String(lock.period ?? "").trim() === period && String(lock.status ?? "").trim() !== "ملغي");
  if (locked) throw new Error(`الفترة ${period} مقفلة ولا يمكن تعديلها إلا بواسطة المدير`);
}

export async function writeAudit(operation: "إضافة" | "تعديل" | "حذف" | "تصدير" | "نسخ احتياطي" | "حفظ" | "دخول" | "خروج", store: AccountingStore, record: LocalRecord) {
  if (store === "auditLogs") return;
  const { activeUserId, role } = localAccessContext();
  const timestamp = new Date().toISOString();
  const actor = await actorMetadata();
  await localPut("auditLogs", { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp, updatedAt: timestamp, user: actor.name, userCode: actor.code, userEmail: actor.email, role: actor.role, deviceId: actor.deviceId, userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown", operation, table: store, recordId: record.id, record: JSON.stringify(record), ...(activeUserId ? { ownerId: activeUserId } : {}) });
}

export const localAccountingRepository = {
  async list(store: AccountingStore) {
    const rows = await localList<LocalRecord>(store);
    const { activeUserId, role } = localAccessContext();
    if (!activeUserId) return [];
    if (role === "مدير" && isFixedManagerSession()) return rows;
    if (role === "مدير") return rows.filter(row => row.ownerId === activeUserId || row.id === activeUserId || row.managedBy === activeUserId);
    return rows.filter(row => row.ownerId === activeUserId);
  },
  async save(store: AccountingStore, record: LocalRecord) {
    const { activeUserId, role } = localAccessContext();
    if (!activeUserId) throw new Error("يجب تسجيل الدخول قبل حفظ البيانات");
    if (store === "auditLogs" || (store === "users" && !canManageUsers(role)) || (store === "accounts" && !canManageAccounts(role))) throw new Error("غير مصرح بإدارة هذا القسم");
    const existing = (await localList<LocalRecord>(store)).find(item => item.id === record.id);
    await ensurePeriodOpen(store, existing ?? record, role);
    if (activeUserId && role !== "مدير" && existing && existing.ownerId !== activeUserId) throw new Error("لا يمكن تعديل سجل مستخدم آخر");
    let scopedRecord = activeUserId && role !== "مدير" ? { ...record, ownerId: activeUserId } : record;
    const validationError = validateAccountingRecord(store, scopedRecord);
    if (validationError) throw new Error(validationError);
    if (uniqueCodeStores.includes(store)) {
      const code = String(scopedRecord.code ?? "").trim().toLowerCase();
      if (code) {
        const duplicate = (await localList<LocalRecord>(store)).find(item =>
          item.id !== scopedRecord.id &&
          String(item.code ?? "").trim().toLowerCase() === code &&
          (role === "مدير" || item.ownerId === activeUserId),
        );
        if (duplicate) throw new Error(`الكود ${String(scopedRecord.code)} مستخدم بالفعل في هذا القسم`);
      }
    }
    if (store === "users") {
      const normalizedEmail = String(scopedRecord.email ?? "").trim().toLowerCase();
      const requestedRole = String(scopedRecord.role ?? "محاسب");
      if (existing?.id === "system-manager" && !isFixedManagerSession()) throw new Error("لا يمكن تعديل مدير النظام الأساسي إلا من هويته الثابتة");
      if (!isFixedManagerSession() && role === "مدير" && existing && existing.managedBy !== activeUserId && existing.id !== activeUserId) {
        throw new Error("مدير الشركة يستطيع إدارة موظفي شركته فقط");
      }
      if (requestedRole === "مدير" && !isFixedManagerSession()) throw new Error("لا يمكن إنشاء أو منح صلاحية مدير إلا للمدير الموحد");
      if (normalizedEmail === MANAGER_EMAIL.toLowerCase() && scopedRecord.id !== "system-manager") throw new Error("هوية مدير النظام ثابتة");
      if (scopedRecord.id === "system-manager") scopedRecord = { ...scopedRecord, id: "system-manager", email: MANAGER_EMAIL, role: "مدير", passwordHash: MANAGER_PASSWORD_HASH };
      else scopedRecord = { ...scopedRecord, role: requestedRole === "مدير" ? "مدير" : requestedRole === "مشرف" ? "مشرف" : "محاسب", managedBy: scopedRecord.managedBy ?? (isFixedManagerSession() ? "system-manager" : activeUserId), systemAccessEnabled: scopedRecord.systemAccessEnabled !== false, accessExpiresAt: scopedRecord.accessExpiresAt ?? null, boundDevices: Array.isArray(scopedRecord.boundDevices) ? scopedRecord.boundDevices : [], maxDevices: Math.max(1, Number(scopedRecord.maxDevices ?? 1)), maxLoginAttempts: Math.max(1, Number(scopedRecord.maxLoginAttempts ?? 5)), loginAttemptsUsed: Math.max(0, Number(scopedRecord.loginAttemptsUsed ?? 0)), employeeBadgeCode: String(scopedRecord.employeeBadgeCode ?? scopedRecord.code ?? `BADGE-${scopedRecord.id}`) };
    }
    const relations = store === "postingLinks" ? [] : await resolveRecordRelations(scopedRecord);
    const actor = await actorMetadata();
    const actorNow = new Date().toISOString();
    const saved = await localPut(store, { ...scopedRecord, relationRefs: relations, createdAt: existing?.createdAt ?? actorNow, createdById: existing?.createdById ?? actor.id, createdByCode: existing?.createdByCode ?? actor.code, createdByName: existing?.createdByName ?? actor.name, createdByEmail: existing?.createdByEmail ?? actor.email, createdByRole: existing?.createdByRole ?? actor.role, createdByDeviceId: existing?.createdByDeviceId ?? actor.deviceId, updatedAt: actorNow, updatedById: actor.id, updatedByCode: actor.code, updatedByName: actor.name, updatedByEmail: actor.email, updatedByRole: actor.role, updatedByDeviceId: actor.deviceId });
    await writeAudit(existing ? "تعديل" : "إضافة", store, saved);
    await syncSourcePostings(store, saved);
    return saved;
  },
  async remove(store: AccountingStore, id: string) {
    const { activeUserId, role } = localAccessContext();
    if (!activeUserId) throw new Error("يجب تسجيل الدخول قبل حذف البيانات");
    if (store === "auditLogs" || (store === "users" && !canManageUsers(role)) || (store === "accounts" && !canManageAccounts(role))) throw new Error("غير مصرح بحذف هذا القسم");
    if (store === "users" && id === "system-manager") throw new Error("لا يمكن حذف مدير النظام الأساسي");
    const existing = (await this.list(store)).find(item => item.id === id);
    await ensurePeriodOpen(store, existing, role);
    await reverseSourcePostings(store, id);
    await localDelete(store, id);
    if (existing) await writeAudit("حذف", store, existing);
  },
};
