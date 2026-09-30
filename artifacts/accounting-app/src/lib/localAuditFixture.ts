import { STORE_NAMES, type LocalRecord, type StoreName } from "./localDb";

export const LOCAL_AUDIT_FIXTURE = {
  accounts: [{ id: "fixture-account-1000", code: "1000", name: "حساب اختبار", updatedAt: "2026-01-01T00:00:00.000Z" }],
  contacts: [{ id: "fixture-contact-1", code: "C-001", name: "عميل اختبار", updatedAt: "2026-01-01T00:00:00.000Z" }],
  invoices: [{ id: "fixture-invoice-1", code: "INV-001", name: "فاتورة اختبار", total: 100, updatedAt: "2026-01-01T00:00:00.000Z" }],
} satisfies Partial<Record<StoreName, LocalRecord[]>>;

export function createLocalAuditBackup() {
  const fixture = LOCAL_AUDIT_FIXTURE as Partial<Record<StoreName, LocalRecord[]>>;
  const data = Object.fromEntries(STORE_NAMES.map(store => [store, fixture[store] ?? []]));
  return JSON.stringify({
    format: "abd-elaziz-omran-accounting-backup",
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    data,
  });
}
