import { localPutMany } from "./localDb";
import * as XLSX from "xlsx";
import { sectionDefinitions } from "./accountingFieldDefinitions";
import type { AccountingStore } from "@/lib/localAccountingRepository";
import { canManageAccounts, canManageUsers, getActiveLocalRole } from "./localPermissions";

type WorkbookSeed = { sheets?: Record<string, unknown[][]>; accounts?: unknown[][]; accountGuide?: unknown[][]; opening?: unknown[][]; months?: Record<string, unknown[][]>; adjustments?: unknown[][]; closing?: unknown[][]; reports?: Record<string, unknown[][]>; operations?: Record<string, unknown[][]> };
type SheetSource = { sheet: string; store: AccountingStore; rows: unknown[][] };
const storeMap: Record<string, AccountingStore> = { "شجرة الحسابات ": "accounts", "دليل الحسابات": "accounts", "افتيتاحي": "journalEntries", "التسويات الجردية ": "adjustments", "قيود الاقفال": "closingEntries", "تحليل العملاء": "contacts", "تحليل الموردين": "contacts", "تحليل الايرادات": "revenues", "تحليل المصروفات": "expenses", "تحليل البنوك": "cashAccounts", "تحليل خزينة": "cashAccounts", "تحليل المشتريات ": "invoices", "تحليل المبيعات": "invoices", "حركة المخزون": "products", "كشف حضور وانصراف": "payroll", "كشف المرتبات": "payroll" };
const SEED_CACHE_KEY = "abd-accounting-workbook-seed-v1";
async function loadSeed(): Promise<WorkbookSeed> {
  try {
    const cached = localStorage.getItem(SEED_CACHE_KEY);
    if (cached) return JSON.parse(cached) as WorkbookSeed;
  } catch { /* cache may be unavailable */ }
  throw new Error("لا توجد نسخة Excel محفوظة محليًا. اختر ملف Excel من جهازك ليتم استيراده دون اتصال.");
}
function clean(value: unknown): string | number | boolean | null { if (value === null || value === undefined) return null; if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value; return String(value); }
function rowColumns(row: unknown[]): Record<string, string | number | boolean | null> { return Object.fromEntries(row.map((value, index) => [`عمود ${index + 1}`, clean(value)])); }
function sources(seed: WorkbookSeed): SheetSource[] { return [{ sheet: "شجرة الحسابات ", store: "accounts", rows: seed.accounts ?? [] }, { sheet: "دليل الحسابات", store: "accounts", rows: seed.accountGuide ?? [] }, { sheet: "افتيتاحي", store: "journalEntries", rows: seed.opening ?? [] }, { sheet: "التسويات الجردية ", store: "adjustments", rows: seed.adjustments ?? [] }, { sheet: "قيود الاقفال", store: "closingEntries", rows: seed.closing ?? [] }, ...Object.entries(seed.months ?? {}).map(([sheet, rows]) => ({ sheet, store: "monthlyReports" as AccountingStore, rows })), ...Object.entries(seed.reports ?? {}).map(([sheet, rows]) => ({ sheet, store: "reportSnapshots" as AccountingStore, rows })), ...Object.entries(seed.operations ?? {}).map(([sheet, rows]) => ({ sheet, store: storeMap[sheet] ?? "reportSnapshots", rows }))]; }
function operationalRecord(source: SheetSource, row: unknown[], index: number) { const values = row.map(clean); const mapped: Record<string, unknown> = {}; (sectionDefinitions[source.store]?.fields ?? []).forEach((field, fieldIndex) => { const value = values[fieldIndex]; if (value !== null && value !== undefined && value !== "") mapped[field.key] = value; }); return { id: `excel-${source.store}-${source.sheet}-${index + 1}`, code: String(values[0] ?? `${source.sheet}-${index + 1}`), name: String(values[1] ?? "سجل مستورد"), sourceSheet: source.sheet, sourceRow: index + 1, excelRow: values, excelColumns: rowColumns(row), ...mapped, source: "برنامج Excel 2026", updatedAt: new Date().toISOString() }; }
export async function importWorkbookFile(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheets = Object.fromEntries(workbook.SheetNames.map((sheet: string) => [sheet, XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, raw: true }) as unknown[][]]));
  const operations = Object.fromEntries(Object.entries(sheets).map(([sheet, rows]) => [sheet, rows]));
  const seed: WorkbookSeed = { sheets, operations };
  try { localStorage.setItem(SEED_CACHE_KEY, JSON.stringify(seed)); } catch { /* الاستيراد التشغيلي لا يعتمد على نجاح الكاش */ }
  return importSeedData(seed);
}

async function importSeedData(seed: WorkbookSeed) { const sheetEntries = Object.entries(seed.sheets ?? {}); const operationalByStore = new Map<AccountingStore, ReturnType<typeof operationalRecord>[]>(); const rawRows = sheetEntries.flatMap(([sheet, rows]) => rows.map((row, index) => ({ id: `raw-${sheet}-${index + 1}`, sheet, rowNumber: index + 1, values: row.map(clean), columns: rowColumns(row), source: "برنامج Excel 2026", updatedAt: new Date().toISOString() }))); const role = getActiveLocalRole(); for (const source of sources(seed)) { const allowed = source.store !== "accounts" && source.store !== "users" && source.store !== "auditLogs" ? true : source.store === "accounts" ? canManageAccounts(role) : canManageUsers(role); if (!allowed) continue; for (let index = 0; index < source.rows.length; index += 1) { const record = operationalRecord(source, source.rows[index] ?? [], index); if (record.name && record.name !== "null") operationalByStore.set(source.store, [...(operationalByStore.get(source.store) ?? []), record]); } } let imported = 0; for (const [store, records] of Array.from(operationalByStore.entries())) { await localPutMany(store, records); imported += records.length; } await localPutMany("rawWorkbookRows", rawRows); return { imported, rawImported: rawRows.length, sheets: sheetEntries.length }; }

export async function importWorkbookData() { return importSeedData(await loadSeed()); }
