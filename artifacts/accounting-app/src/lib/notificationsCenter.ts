import { localList, type LocalRecord, type StoreName } from "./localDb";
export type Notification = { type: string; title: string; description: string; date: string; recordId: string; storeName: StoreName };
function daysFromNow(value: unknown) { const time = new Date(String(value ?? "")).getTime(); return Number.isFinite(time) ? Math.ceil((time - Date.now()) / 86400000) : null; }
async function upcoming(storeName: StoreName, type: string, title: string, field: string, days: number) { const rows = await localList<LocalRecord>(storeName); return rows.flatMap(row => { const date = String(row[field] ?? row.dueDate ?? row.expiryDate ?? row.date ?? ""); const remaining = daysFromNow(date); return remaining !== null && remaining >= 0 && remaining <= days ? [{ type, title, description: `${String(row.name ?? row.code ?? row.id)} — متبقٍ ${remaining} يوم`, date, recordId: row.id, storeName }] : []; }); }
export async function collectNotifications(): Promise<Notification[]> {
  const result = [
    ...(await upcoming("cheques", "cheque", "شيك قريب الاستحقاق", "dueDate", 7)),
    ...(await upcoming("invoices", "invoice", "فاتورة متأخرة أو مستحقة", "dueDate", 0)),
    ...(await upcoming("complianceRequirements", "compliance", "ترخيص قريب الانتهاء", "expiryDate", 30)),
    ...(await upcoming("maintenanceOrders", "maintenance", "أمر صيانة مجدول", "scheduledDate", 7)),
    ...(await upcoming("installments", "installment", "قسط مستحق", "dueDate", 7)),
  ];
  const locks = await localList<LocalRecord>("periodLocks");
  for (const row of locks) if (String(row.status ?? "") !== "مقفل" && daysFromNow(`${String(row.period ?? "")}-01`) !== null) result.push({ type: "period", title: "فترة مالية لم تُقفل", description: String(row.period ?? row.id), date: String(row.period ?? ""), recordId: row.id, storeName: "periodLocks" });
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
