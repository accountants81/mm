import { localList, localPut, type LocalRecord, type StoreName } from "./localDb";
import { getAttendancePolicy } from "./attendanceEngine";
import { writeAudit } from "./localAccountingRepository";

export type QrLink = LocalRecord & {
  qrCode: string;
  targetStore: StoreName | string;
  targetId: string;
  targetLabel: string;
  status: "active" | "inactive";
  isPrimary?: boolean;
};

function activeOwnerId() {
  if (typeof window === "undefined") return "";
  return String(localStorage.getItem("local-active-user-id") ?? "").trim();
}

function canReadRow(row: LocalRecord) {
  const ownerId = activeOwnerId();
  if (!ownerId) return true;
  return !row.ownerId || row.ownerId === ownerId || localStorage.getItem("local-active-role") === "مدير";
}

export async function findQrLink(qrCode: string) {
  const normalized = qrCode.trim().toLowerCase();
  if (!normalized) return null;
  const links = await localList<QrLink>("qrLinks");
  return links.find((link) => canReadRow(link) && String(link.qrCode).trim().toLowerCase() === normalized && link.status !== "inactive") ?? null;
}

export async function linkQrCode(input: Omit<QrLink, "id" | "updatedAt" | "status"> & Partial<Pick<QrLink, "status">>) {
  const existing = await findQrLink(String(input.qrCode));
  if (existing && (existing.targetStore !== input.targetStore || existing.targetId !== input.targetId)) {
    throw new Error("كود QR مرتبط بسجل آخر بالفعل");
  }
  const saved = await localPut("qrLinks", {
    ...input,
    id: existing?.id ?? `qr-${Date.now()}`,
    status: input.status ?? "active",
    ...(activeOwnerId() ? { ownerId: activeOwnerId() } : {}),
    updatedAt: new Date().toISOString(),
  } as QrLink);
  await writeAudit(existing ? "تعديل" : "إضافة", "qrLinks", { ...saved, action: "ربط QR", updatedAt: new Date().toISOString() });
  return saved;
}

export async function resolveQrTarget(qrCode: string) {
  const link = await findQrLink(qrCode);
  if (link) return link;
  const stores: StoreName[] = ["employees", "products", "contacts", "fixedAssets", "branches", "salesRepresentatives", "restaurantTables", "posOrders", "deliveryOrders"];
  for (const store of stores) {
    const rows = await localList<LocalRecord>(store);
    const match = rows.filter(canReadRow).find((row) => [row.qrCode, row.code, row.barcode, row.employeeNumber, row.productCode, row.assetNumber, row.serialNumber, row.batchNumber, row.tableNumber].some((value) => String(value ?? "").trim().toLowerCase() === qrCode.trim().toLowerCase()));
    if (match) {
      return { id: `derived-${store}-${match.id}`, qrCode, targetStore: store, targetId: match.id, targetLabel: String(match.name ?? match.label ?? match.code ?? "سجل"), status: "active" } as QrLink;
    }
  }
  return null;
}

export async function recordQrScan(input: Omit<LocalRecord, "id" | "updatedAt">) {
  const saved = await localPut("qrScans", { ...input, ...(activeOwnerId() ? { ownerId: activeOwnerId() } : {}), id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, updatedAt: new Date().toISOString() });
  await writeAudit("إضافة", "qrScans", saved);
  return saved;
}

function localDay() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export async function processEmployeeQr(qrCode: string, employee: QrLink) {
  const today = localDay();
  const events = await localList<LocalRecord>("attendanceEvents");
  const dayEvents = events.filter((event) => event.employeeId === employee.targetId && event.date === today).sort((a, b) => String(a.checkInAt ?? a.updatedAt).localeCompare(String(b.checkInAt ?? b.updatedAt)));
  const open = dayEvents.find((event) => event.status === "open");
  if (!open && dayEvents.some((event) => event.status === "closed")) throw new Error("تم تسجيل الحضور والانصراف لهذا الموظف اليوم بالفعل");
  if (!open) {
    const saved = await localPut("attendanceEvents", { id: `attendance-${employee.targetId}-${today}`, employeeId: employee.targetId, employeeName: employee.targetLabel, date: today, checkInAt: new Date().toISOString(), status: "open", source: "qr", updatedAt: new Date().toISOString() });
    await writeAudit("إضافة", "attendanceEvents", { ...saved, action: "حضور عبر QR", updatedAt: new Date().toISOString() });
    return saved;
  }
  const elapsed = Date.now() - new Date(String(open.checkInAt)).getTime();
  const currentPolicy = await getAttendancePolicy();
  if (elapsed < currentPolicy.minimumCheckoutMinutes * 60 * 1000) throw new Error(`لا يمكن تسجيل الانصراف قبل مرور ${currentPolicy.minimumCheckoutMinutes} دقيقة من وقت الحضور`);
  const saved = await localPut("attendanceEvents", { ...open, checkOutAt: new Date().toISOString(), status: "closed", source: "qr" });
  await writeAudit("تعديل", "attendanceEvents", { ...saved, action: "انصراف عبر QR", updatedAt: new Date().toISOString() });
  return saved;
}

export function formatScanResult(result: LocalRecord | QrLink) {
  return `${String(result.targetLabel ?? result.employeeName ?? "تم تسجيل الحركة")} — ${String(result.status ?? "تم")}`;
}
