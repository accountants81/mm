export type LocalRecord = {
  id: string;
  updatedAt: string;
  [key: string]: unknown;
};

const DB_NAME = "abd-elaziz-omran-accounting";
const DB_VERSION = 11;
export const STORE_NAMES = ["accounts", "journalEntries", "contacts", "products", "invoices", "cashAccounts", "fixedAssets", "payroll", "expenses", "revenues", "openingBalances", "companyProfile", "financialPeriods", "employees", "salesRepresentatives", "attendance", "attendanceEvents", "attendanceDaily", "attendanceClosures", "attendancePolicies", "holidays", "leaveRequests", "employeeAdjustments", "salesReturns", "purchaseReturns", "posOrders", "restaurantTables", "deliveryOrders", "units", "monthlyReports", "closingEntries", "adjustments", "reportSnapshots", "rawWorkbookRows", "settings", "taxReturns", "socialInsurance", "cheques", "commercialPapers", "productionCosts", "purchaseOrders", "salesOrders", "physicalInventory", "budgets", "cashFlows", "salesAnalysis", "cashTransactions", "inventoryMovements", "postingLinks", "receivingReports", "shippingReports", "paymentOrders", "collectionOrders", "inventoryTransferOrders", "cashTransferOrders", "productionOrders", "maintenanceOrders", "travelOrders", "projects", "shippingOrders", "receivingOrders", "customsClearance", "contracts", "leases", "loans", "investments", "insurancePolicies", "donations", "periodLocks", "bankReconciliations", "users", "auditLogs", "qrLinks", "qrScans", "currencies", "costCenters", "advances", "installments", "assetCheckIns", "claims", "financialRatios", "annualClosings", "customReports", "pivotTables", "alerts", "attachments", "notifications", "backups", "errorLogs", "financialAnalysis", "kpis", "branches", "autoJournalRules", "eInvoices", "geoAnalytics", "erpIntegrations", "sessions", "supportTickets", "faqs", "updates", "tasks", "feedback", "tutorials", "aiInsights", "twoFactorSettings", "pushNotifications", "quotations", "requestForQuotations", "crmCalls", "crmMeetings", "complaints", "partyEvaluations", "risks", "complianceRequirements", "qualityInspections", "correctiveActions", "performanceEvaluations", "developmentPlans", "energyConsumption", "environmentalInitiatives"] as const;

export type StoreName = (typeof STORE_NAMES)[number];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local database"));
  });
}

export async function localPut<T extends LocalRecord>(store: StoreName, value: T): Promise<T> {
  const payload = { ...value, updatedAt: new Date().toISOString() };
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(payload);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Unable to save local record"));
      });
      return payload;
    } finally {
      db.close();
    }
  } catch (error) {
    if (typeof indexedDB !== "undefined") throw error;
    const key = `local-${store}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
    const next = existing.filter(item => item.id !== payload.id);
    localStorage.setItem(key, JSON.stringify([...next, payload]));
    return payload;
  }
}

export async function localPutMany<T extends LocalRecord>(store: StoreName, values: T[]): Promise<T[]> {
  const payloads = values.map(value => ({ ...value, updatedAt: new Date().toISOString() }));
  if (!payloads.length) return [];
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const objectStore = tx.objectStore(store);
        payloads.forEach(payload => objectStore.put(payload));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Unable to save local records"));
      });
      return payloads;
    } finally {
      db.close();
    }
  } catch (error) {
    if (typeof indexedDB !== "undefined") throw error;
    const key = `local-${store}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
    const byId = new Map(existing.map(item => [item.id, item]));
    payloads.forEach(payload => byId.set(payload.id, payload));
    localStorage.setItem(key, JSON.stringify(Array.from(byId.values())));
    return payloads;
  }
}

export async function localDelete(store: StoreName, id: string): Promise<void> {
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Unable to delete local record"));
      });
    } finally {
      db.close();
    }
  } catch (error) {
    if (typeof indexedDB !== "undefined") throw error;
    const key = `local-${store}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as LocalRecord[];
    localStorage.setItem(key, JSON.stringify(existing.filter(item => item.id !== id)));
  }
}

export async function localList<T extends LocalRecord>(store: StoreName): Promise<T[]> {
  try {
    const db = await openDatabase();
    try {
      return await new Promise<T[]>((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error ?? new Error("Unable to read local records"));
      });
    } finally {
      db.close();
    }
  } catch (error) {
    if (typeof indexedDB !== "undefined") throw error;
    return JSON.parse(localStorage.getItem(`local-${store}`) ?? "[]") as T[];
  }
}

export async function exportLocalBackup(): Promise<string> {
  const result: Record<string, LocalRecord[]> = {};
  for (const store of STORE_NAMES) result[store] = await localList(store);
  return JSON.stringify({ format: "abd-elaziz-omran-accounting-backup", version: 1, exportedAt: new Date().toISOString(), data: result }, null, 2);
}

export function parseLocalBackup(raw: string): Record<StoreName, LocalRecord[]> {
  let parsed: { format?: string; version?: number; data?: Record<string, LocalRecord[]> };
  try {
    parsed = JSON.parse(raw) as { format?: string; version?: number; data?: Record<string, LocalRecord[]> };
  } catch {
    throw new Error("ملف النسخة الاحتياطية ليس JSON صالحًا");
  }
  if (parsed.format !== "abd-elaziz-omran-accounting-backup" || !parsed.data || (parsed.version !== undefined && parsed.version !== 1)) {
    throw new Error("ملف النسخة الاحتياطية غير صالح أو غير مدعوم");
  }
  const missingStores = STORE_NAMES.filter(store => !Object.prototype.hasOwnProperty.call(parsed.data, store));
  if (missingStores.length) throw new Error(`النسخة الاحتياطية ناقصة وتفتقد ${missingStores.length} مخزنًا: ${missingStores.slice(0, 5).join(", ")}`);
  const unexpectedStores = Object.keys(parsed.data).filter(store => !STORE_NAMES.includes(store as StoreName));
  if (unexpectedStores.length) throw new Error(`النسخة الاحتياطية تحتوي مخازن غير مدعومة: ${unexpectedStores.slice(0, 5).join(", ")}`);
  const validated = {} as Record<StoreName, LocalRecord[]>;
  for (const store of STORE_NAMES) {
    const records = parsed.data[store];
    if (!Array.isArray(records) || records.some(record => !record || typeof record !== "object" || typeof record.id !== "string" || !record.id.trim())) {
      throw new Error(`بيانات المخزن ${store} غير صالحة`);
    }
    const ids = new Set<string>();
    for (const record of records) {
      if (ids.has(record.id)) throw new Error(`المخزن ${store} يحتوي معرفًا مكررًا: ${record.id}`);
      ids.add(record.id);
      if (record.updatedAt !== undefined && !Number.isFinite(new Date(String(record.updatedAt)).getTime())) throw new Error(`السجل ${record.id} في المخزن ${store} يحتوي تاريخ تحديث غير صالح`);
      if (Array.isArray(record.journalLines)) {
        const lines = record.journalLines.filter(line => line && typeof line === "object") as Array<{ debit?: unknown; credit?: unknown }>;
        const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
        const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
        if (Math.abs(debit - credit) > 0.005) throw new Error(`القيد ${record.id} في المخزن ${store} غير متوازن`);
      }
    }
    validated[store] = records;
  }
  const known = new Map<StoreName, Set<string>>(STORE_NAMES.map(store => [store, new Set(validated[store].map(record => record.id))]));
  for (const link of validated.postingLinks) {
    const sourceStore = String(link.sourceStore ?? "") as StoreName;
    const targetStore = String(link.targetStore ?? "") as StoreName;
    if (!STORE_NAMES.includes(sourceStore) || !STORE_NAMES.includes(targetStore) || !known.get(sourceStore)?.has(String(link.sourceId)) || !known.get(targetStore)?.has(String(link.targetId))) {
      throw new Error(`رابط الترحيل ${link.id} يشير إلى سجل غير موجود`);
    }
  }
  return validated;
}

export type BackupDiff = { stores: Record<string, { currentCount: number; importedCount: number; currentLatestUpdatedAt: string | null; importedLatestUpdatedAt: string | null }> };

export async function previewBackupDiff(raw: string): Promise<BackupDiff> {
  const validated = parseLocalBackup(raw);
  const stores: BackupDiff["stores"] = {};
  const latest = (rows: LocalRecord[]) => rows.map(row => String(row.updatedAt ?? "")).filter(Boolean).sort().at(-1) ?? null;
  for (const store of STORE_NAMES) {
    const current = await localList(store);
    const imported = validated[store] ?? [];
    stores[store] = { currentCount: current.length, importedCount: imported.length, currentLatestUpdatedAt: latest(current), importedLatestUpdatedAt: latest(imported) };
  }
  return { stores };
}

function isNewer(incoming: LocalRecord, current?: LocalRecord) {
  if (!current) return true;
  return new Date(String(incoming.updatedAt ?? 0)).getTime() > new Date(String(current.updatedAt ?? 0)).getTime();
}

export async function importLocalBackup(raw: string): Promise<void> {
  const validated = parseLocalBackup(raw);
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([...STORE_NAMES], "readwrite");
        for (const store of STORE_NAMES) {
          const objectStore = tx.objectStore(store);
          const request = objectStore.getAll();
          request.onsuccess = () => {
            const currentById = new Map((request.result as LocalRecord[]).map(record => [record.id, record]));
            for (const record of validated[store] ?? []) {
              const normalized = { ...record, updatedAt: String(record.updatedAt ?? new Date().toISOString()) };
              const current = currentById.get(normalized.id);
              if (store === "auditLogs" || isNewer(normalized, current)) objectStore.put(store === "auditLogs" && current ? { ...normalized, id: `${normalized.id}-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` } : normalized);
            }
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Unable to restore local backup"));
        tx.onabort = () => reject(tx.error ?? new Error("Unable to restore local backup"));
      });
    } finally {
      db.close();
    }
  } catch (error) {
    if (typeof indexedDB !== "undefined") throw error;
    const previous = new Map<string, string | null>();
    const next = new Map<string, string>();
    try {
      for (const store of STORE_NAMES) {
        const key = `local-${store}`;
        previous.set(key, localStorage.getItem(key));
        const current = JSON.parse(localStorage.getItem(key) ?? "[]") as LocalRecord[];
        const byId = new Map(current.map(record => [record.id, record]));
        for (const record of validated[store] ?? []) {
          const normalized = { ...record, updatedAt: String(record.updatedAt ?? new Date().toISOString()) };
          const existing = byId.get(normalized.id);
          if (store === "auditLogs" && existing) byId.set(`${normalized.id}-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, normalized);
          else if (isNewer(normalized, existing)) byId.set(normalized.id, normalized);
        }
        next.set(key, JSON.stringify(Array.from(byId.values())));
      }
      for (const [key, value] of next) localStorage.setItem(key, value);
    } catch (error) {
      for (const [key, value] of previous) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      throw error instanceof Error ? error : new Error("تعذر استعادة النسخة المحلية دون فقدان البيانات");
    }
  }
}

export async function clearAllLocalData(options?: { preserveUsers?: boolean }): Promise<void> {
  const preserveUsers = options?.preserveUsers ?? true;
  try {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const stores = STORE_NAMES.filter(store => !(preserveUsers && store === "users"));
        const tx = db.transaction(stores, "readwrite");
        stores.forEach(store => tx.objectStore(store).clear());
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Unable to clear local data"));
      });
    } finally {
      db.close();
    }
  } catch (error) {
    if (typeof indexedDB !== "undefined") throw error;
    STORE_NAMES.filter(store => !(preserveUsers && store === "users")).forEach(store => localStorage.removeItem(`local-${store}`));
  }
  if (typeof indexedDB === "undefined") STORE_NAMES.filter(store => !(preserveUsers && store === "users")).forEach(store => localStorage.removeItem(`local-${store}`));
}

export async function localStoreCounts(options?: { ownerId?: string }): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const store of STORE_NAMES) {
    const rows = await localList(store);
    counts[store] = options?.ownerId ? rows.filter(row => row.ownerId === options.ownerId).length : rows.length;
  }
  return counts;
}
