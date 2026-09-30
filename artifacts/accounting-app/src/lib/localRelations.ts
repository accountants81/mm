import { localList, type LocalRecord, type StoreName, STORE_NAMES } from "./localDb";

export type RelationRef = { store: StoreName; id: string; code: string; label: string };
export type LocalRelationMatch = RelationRef & { record: LocalRecord };
export type RelationKind = "employee" | "product" | "party" | "account" | "asset" | "warehouse" | "branch" | "invoice" | "order" | "document" | "generic";

/*
 * The workbook and the manual forms do not use one naming convention.
 * Keep the aliases here so every module uses the same relation rules.
 * normalizeRelationKey also makes "employee Code" and "employee-code" work.
 */
const CODE_KEYS = new Set([
  "code", "employeenumber", "employeecode", "accountcode", "accountnumber",
  "productcode", "partycode", "customercode", "suppliercode", "warehousecode",
  "branchcode", "documentcode", "invoicecode", "invoicenumber", "ordernumber",
  "purchaseordernumber", "salesordernumber", "assetnumber", "projectnumber",
  "trackingnumber", "referencenumber", "policynumber", "contractnumber",
  "quotationnumber", "requestnumber", "customsdeclaration", "chequenumber",
  "papernumber", "inspectionnumber", "insurancenumber", "taxnumber",
  "relatedorder", "reference",
]);

export function normalizeRelationKey(key: string) {
  return key.trim().replace(/[\s_-]+/g, "").toLowerCase();
}

function normalizeCode(code: string) {
  return code.trim().toLocaleLowerCase();
}

export function relationRecordValue(record: LocalRecord, key: string) {
  const directValue = record[key];
  if (directValue !== undefined && directValue !== null && String(directValue).trim()) return String(directValue).trim();
  const normalized = normalizeRelationKey(key);
  const equivalent = Object.entries(record).find(([recordKey, rawValue]) => normalizeRelationKey(recordKey) === normalized && rawValue !== undefined && rawValue !== null && String(rawValue).trim());
  return equivalent ? String(equivalent[1]).trim() : "";
}

function label(record: LocalRecord) {
  return relationRecordValue(record, "name")
    || relationRecordValue(record, "employeeName")
    || relationRecordValue(record, "productName")
    || relationRecordValue(record, "partyName")
    || relationRecordValue(record, "label")
    || relationRecordValue(record, "description")
    || relationRecordValue(record, "code")
    || record.id;
}

export function isCodeFieldKey(key: string) {
  return CODE_KEYS.has(normalizeRelationKey(key));
}

export function relationKindForField(key: string): RelationKind | null {
  const normalized = normalizeRelationKey(key);
  if (["employeenumber", "employeecode", "employee", "employeename", "assignee", "owner"].includes(normalized)) return "employee";
  if (["productcode", "product", "item", "products", "itemcode"].includes(normalized)) return "product";
  if (["partycode", "customercode", "suppliercode", "party", "customer", "supplier", "counterparty", "beneficiary", "recipient", "collector", "debtor", "creditor", "lessor", "tenant", "financier"].includes(normalized)) return "party";
  if (["accountcode", "accountnumber", "account", "accountname", "parent", "debitaccount", "creditaccount", "fromaccount", "toaccount", "bankaccount"].includes(normalized)) return "account";
  if (["assetnumber", "asset", "insuredasset"].includes(normalized)) return "asset";
  if (["warehousecode", "warehouse", "fromwarehouse", "towarehouse"].includes(normalized)) return "warehouse";
  if (["branchcode", "branch", "manager"].includes(normalized)) return "branch";
  if (["invoicecode", "invoicenumber"].includes(normalized)) return "invoice";
  if (["ordernumber", "purchaseordernumber", "salesordernumber", "relatedorder"].includes(normalized)) return "order";
  if (["documentcode", "referencenumber", "reference", "quotationnumber", "requestnumber", "contractnumber", "projectnumber", "trackingnumber", "policynumber", "customsdeclaration", "chequenumber", "papernumber", "inspectionnumber", "insurancenumber"].includes(normalized)) return "document";
  if (normalized === "code") return "generic";
  return null;
}

export function isRelationLookupField(key: string) {
  if (isCodeFieldKey(key)) return true;
  return new Set([
    "employee", "assignee", "owner", "product", "item", "products",
    "party", "customer", "supplier", "counterparty", "beneficiary", "recipient",
    "collector", "debtor", "creditor", "lessor", "tenant", "financier",
    "account", "accountname", "parent", "debitaccount", "creditaccount",
    "fromaccount", "toaccount", "bankaccount", "asset", "insuredasset",
    "warehouse", "fromwarehouse", "towarehouse", "branch",
  ]).has(normalizeRelationKey(key));
}

export function storesForRelationField(key: string, activeStore?: StoreName): StoreName[] | undefined {
  const kind = relationKindForField(key);
  if (kind === "employee") return ["employees", "payroll", "socialInsurance", "employeeAdjustments", "attendance"];
  if (kind === "product") return ["products", "inventoryMovements", "productionOrders", "productionCosts", "physicalInventory"];
  if (kind === "party") return ["contacts"];
  if (kind === "account") return ["accounts", "cashAccounts"];
  if (kind === "asset") return ["fixedAssets", "assetCheckIns", "maintenanceOrders", "insurancePolicies"];
  if (kind === "warehouse") return ["settings", "branches", "products"];
  if (kind === "branch") return ["branches"];
  if (kind === "invoice") return ["invoices", "salesReturns", "purchaseReturns", "eInvoices"];
  if (kind === "order") return ["purchaseOrders", "salesOrders", "receivingReports", "shippingReports", "receivingOrders", "shippingOrders"];
  if (kind === "document") return ["invoices", "purchaseOrders", "salesOrders", "quotations", "requestForQuotations", "contracts", "attachments", "cheques", "commercialPapers"];
  if (kind === "generic" && activeStore) return [activeStore, ...STORE_NAMES.filter(store => store !== activeStore)];
  return undefined;
}

export function recordCodes(record: LocalRecord) {
  return Array.from(new Set(Object.entries(record)
    .filter(([key]) => isCodeFieldKey(key))
    .map(([, rawValue]) => String(rawValue ?? "").trim())
    .filter(Boolean)));
}

export async function findLocalRecordByCode(code: string, stores: StoreName[] = [...STORE_NAMES]): Promise<LocalRelationMatch | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  for (const store of stores) {
    const rows = await localList<LocalRecord>(store);
    const found = rows.find(row => recordCodes(row).some(recordCode => normalizeCode(recordCode) === normalized));
    if (found) {
      const matchedCode = recordCodes(found).find(recordCode => normalizeCode(recordCode) === normalized) ?? code.trim();
      return { store, id: found.id, code: matchedCode, label: label(found), record: found };
    }
  }
  return null;
}

export async function findLocalByCode(code: string, stores: StoreName[] = [...STORE_NAMES]): Promise<RelationRef | null> {
  const match = await findLocalRecordByCode(code, stores);
  if (!match) return null;
  const { record: _record, ...ref } = match;
  return ref;
}

export async function resolveRecordRelations(record: LocalRecord): Promise<RelationRef[]> {
  const refs: RelationRef[] = [];
  for (const [key, rawValue] of Object.entries(record)) {
    if (!isRelationLookupField(key) || normalizeRelationKey(key) === "code") continue;
    const code = String(rawValue ?? "").trim();
    if (!code) continue;
    const match = await findLocalByCode(code, storesForRelationField(key));
    if (match && !refs.some(ref => ref.store === match.store && ref.id === match.id)) refs.push({ ...match, code });
  }
  return refs;
}

export type LocalRelationAudit = {
  stores: number;
  records: number;
  linkedRecords: number;
  relationRefs: number;
  orphanRefs: number;
  unresolvedFields: number;
  duplicateCodes: number;
  orphanPostingLinks: number;
  unbalancedJournals: number;
  ownershipMismatches: number;
  byStore: LocalStoreAudit[];
};

export type LocalStoreAudit = {
  store: StoreName;
  records: number;
  linkedRecords: number;
  relationRefs: number;
  orphanRefs: number;
  unresolvedFields: number;
  duplicateCodes: number;
};

/** Read-only integrity scan for the local database; it never changes user data. */
export async function auditLocalRelations(options?: { ownerId?: string }): Promise<LocalRelationAudit> {
  const storeRows = new Map<StoreName, LocalRecord[]>();
  for (const store of STORE_NAMES) {
    const rows = await localList<LocalRecord>(store);
    storeRows.set(store, options?.ownerId ? rows.filter(row => row.ownerId === options.ownerId) : rows);
  }
  const knownIds = new Set<string>();
  const codes = new Map<string, number>();
  let records = 0;
  let linkedRecords = 0;
  let relationRefs = 0;
  let orphanRefs = 0;
  let unresolvedFields = 0;
  let duplicateCodes = 0;
  let orphanPostingLinks = 0;
  let unbalancedJournals = 0;
  let ownershipMismatches = 0;
  const byStore = new Map<StoreName, LocalStoreAudit>();
  for (const [store, rows] of storeRows) {
    byStore.set(store, {
      store,
      records: rows.length,
      linkedRecords: 0,
      relationRefs: 0,
      orphanRefs: 0,
      unresolvedFields: 0,
      duplicateCodes: 0,
    });
    records += rows.length;
    for (const row of rows) {
      knownIds.add(`${store}:${row.id}`);
      for (const code of recordCodes(row)) {
        const normalized = normalizeCode(code);
        codes.set(`${store}:${normalized}`, (codes.get(`${store}:${normalized}`) ?? 0) + 1);
      }
    }
  }
  const journalRows = storeRows.get("journalEntries") ?? [];
  for (const row of journalRows) {
    if (!Array.isArray(row.journalLines)) continue;
    const debit = row.journalLines.reduce((sum, line) => sum + (Number((line as Record<string, unknown>).debit) || 0), 0);
    const credit = row.journalLines.reduce((sum, line) => sum + (Number((line as Record<string, unknown>).credit) || 0), 0);
    if (Math.abs(debit - credit) > 0.005) unbalancedJournals++;
  }
  for (const link of storeRows.get("postingLinks") ?? []) {
    const sourceStore = String(link.sourceStore ?? "") as StoreName;
    const targetStore = String(link.targetStore ?? "") as StoreName;
    const source = (storeRows.get(sourceStore) ?? []).find(row => row.id === String(link.sourceId));
    const target = (storeRows.get(targetStore) ?? []).find(row => row.id === String(link.targetId));
    if (!source || !target) orphanPostingLinks++;
    if (link.ownerId && ((source?.ownerId && source.ownerId !== link.ownerId) || (target?.ownerId && target.ownerId !== link.ownerId))) ownershipMismatches++;
  }
  for (const [store, rows] of storeRows) for (const row of rows) {
    const refs = Array.isArray(row.relationRefs) ? row.relationRefs as RelationRef[] : [];
    const storeAudit = byStore.get(store);
    if (refs.length) {
      linkedRecords += 1;
      if (storeAudit) storeAudit.linkedRecords += 1;
    }
    relationRefs += refs.length;
    if (storeAudit) storeAudit.relationRefs += refs.length;
    for (const ref of refs) if (!knownIds.has(`${ref.store}:${ref.id}`)) {
      orphanRefs += 1;
      if (storeAudit) storeAudit.orphanRefs += 1;
    }
    for (const [key, rawValue] of Object.entries(row)) {
      if (!isRelationLookupField(key) || normalizeRelationKey(key) === "code" || !String(rawValue ?? "").trim()) continue;
      const targets = storesForRelationField(key, store);
      if (!targets?.length) continue;
      const normalized = normalizeCode(String(rawValue));
      const resolved = targets.some(target => (storeRows.get(target) ?? []).some(candidate => recordCodes(candidate).some(code => normalizeCode(code) === normalized)));
      // Plain fields such as "account" and "warehouse" may intentionally
      // contain a human-readable label rather than a master-data code. Only
      // explicit code fields are integrity failures when they do not resolve.
      if (!resolved && isCodeFieldKey(key)) {
        unresolvedFields += 1;
        if (storeAudit) storeAudit.unresolvedFields += 1;
      }
    }
  }
  duplicateCodes += Array.from(codes.values()).filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0);
  for (const [store, rows] of storeRows) {
    const codeCounts = new Map<string, number>();
    rows.forEach(row => recordCodes(row).forEach(code => {
      const key = normalizeCode(code);
      codeCounts.set(key, (codeCounts.get(key) ?? 0) + 1);
    }));
    const storeAudit = byStore.get(store);
    if (storeAudit) {
      storeAudit.duplicateCodes = Array.from(codeCounts.values())
        .filter(count => count > 1)
        .reduce((sum, count) => sum + count - 1, 0);
    }
  }
  return { stores: STORE_NAMES.length, records, linkedRecords, relationRefs, orphanRefs, unresolvedFields, duplicateCodes, orphanPostingLinks, unbalancedJournals, ownershipMismatches, byStore: Array.from(byStore.values()) };
}
