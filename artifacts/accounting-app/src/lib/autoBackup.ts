import { exportLocalBackup, localPut } from "./localDb";
import { encryptBackup } from "./encryption";
import { getOrCreateDeviceFingerprint } from "./localPermissions";

const LAST_BACKUP_KEY = "last-auto-backup-date";
export function shouldRunAutoBackup() {
  const today = new Date();
  const last = localStorage.getItem(LAST_BACKUP_KEY);
  const sameMonth = last && last.slice(0, 7) === today.toISOString().slice(0, 7);
  return !sameMonth;
}
export async function runAutoBackup(password: string) {
  const encrypted = await encryptBackup(await exportLocalBackup(), password);
  const date = new Date().toISOString();
  const blob = new Blob([encrypted], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `abd-accounting-auto-${new Date().toISOString().slice(0, 10)}.abdbackup`; anchor.click(); URL.revokeObjectURL(url);
  localStorage.setItem(LAST_BACKUP_KEY, date);
  await localPut("backups", { id: `auto-${date.slice(0, 10)}`, name: anchor.download, format: "encrypted", source: "monthly", createdAt: date, size: encrypted.length, deviceId: getOrCreateDeviceFingerprint(), updatedAt: date });
  await localPut("auditLogs", { id: `audit-auto-backup-${Date.now()}`, timestamp: date, updatedAt: date, operation: "نسخ احتياطي", table: "backups", recordId: "auto", deviceId: getOrCreateDeviceFingerprint(), user: "النظام المحلي" });
}
