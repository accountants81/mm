import { ArrowRight, Database, Download, Edit3, FilePlus2, RefreshCw, RotateCcw, Search, Trash2, WifiOff, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import LocalLink from "@/components/LocalLink";
import AppTopBar from "@/components/AppTopBar";
import { localList, type LocalRecord } from "@/lib/localDb";
import { localAccountingRepository, writeAudit, type AccountingStore } from "@/lib/localAccountingRepository";
import { findLocalRecordByCode, isRelationLookupField, normalizeRelationKey, relationKindForField, relationRecordValue, storesForRelationField, type RelationKind, type RelationRef } from "@/lib/localRelations";
import { deriveComputedFields } from "@/lib/accountingComputedFields";
import { validateAccountingRecord } from "@/lib/accountingValidation";
import { canEditAuditLogs, canManageAccounts, canManageUsers, getActiveLocalRole, hashLocalPassword, isFixedManagerSession, MANAGER_EMAIL } from "@/lib/localPermissions";
import { sectionDefinitions, storeOrder, type FieldDefinition } from "@/lib/accountingFieldDefinitions";
import { linkQrCode } from "@/lib/qr";
import { closeAttendanceDay } from "@/lib/attendanceEngine";

function initialStore(params?: { store?: string }): AccountingStore {
  const pathStore: Record<string, AccountingStore> = { "/accounts": "accounts", "/journal": "journalEntries", "/contacts": "contacts", "/products": "products", "/invoices": "invoices", "/cash": "cashAccounts", "/assets": "fixedAssets", "/payroll": "payroll", "/expenses": "expenses", "/revenues": "revenues" };
  const queryValue = new URLSearchParams(window.location.search).get("store");
  const candidate = params?.store || queryValue;
  return pathStore[window.location.pathname] ?? (candidate && candidate in sectionDefinitions ? candidate as AccountingStore : "accounts");
}

const inputClass = "w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-[#f5eeee] outline-none placeholder:text-[#907d80] transition-colors focus:border-red-400/70 focus:bg-[#282023]";
const currentMonth = new Date().toISOString().slice(0, 7);
const autofillSources: Record<string, string[]> = {
  name: ["name", "label", "description", "employeeName", "productName", "partyName", "accountName"],
  employeeName: ["employeeName", "name", "label"],
  employee: ["employee", "employeeName", "name", "label"],
  product: ["product", "productName", "name", "label", "description"],
  item: ["item", "itemName", "product", "productName", "name", "label", "description"],
  party: ["party", "partyName", "customer", "supplier", "name", "label"],
  customer: ["customer", "customerName", "party", "partyName", "name", "label"],
  supplier: ["supplier", "supplierName", "party", "partyName", "name", "label"],
  account: ["account", "accountName", "name", "label", "description"],
  accountName: ["accountName", "account", "name", "label"],
  department: ["department"],
  jobTitle: ["jobTitle"],
  phone: ["phone"],
  email: ["email"],
  address: ["address"],
  category: ["category"],
  warehouse: ["warehouse"],
  purchasePrice: ["purchasePrice"],
  salePrice: ["salePrice"],
  unitPrice: ["unitPrice", "salePrice", "price"],
  quantity: ["quantity", "currentQuantity", "stockQuantity"],
  unit: ["unit", "unitName"],
  employeeCode: ["employeeNumber", "employeeCode", "code"],
  invoiceCode: ["invoiceNumber", "invoiceCode", "code"],
  invoiceNumber: ["invoiceNumber", "invoiceCode", "code"],
  orderNumber: ["orderNumber", "purchaseOrderNumber", "salesOrderNumber", "code"],
  purchaseOrderNumber: ["purchaseOrderNumber", "orderNumber", "code"],
  salesOrderNumber: ["salesOrderNumber", "orderNumber", "code"],
  assetNumber: ["assetNumber", "code"],
};

const relationPrimaryTargets: Record<RelationKind, string[]> = {
  employee: ["employeeName", "employee"],
  product: ["product", "item"],
  party: ["party", "customer", "supplier"],
  account: ["account", "accountName"],
  asset: ["asset", "insuredAsset"],
  warehouse: ["warehouse", "fromWarehouse", "toWarehouse"],
  branch: ["branch"],
  invoice: ["party", "customer", "supplier", "product", "item"],
  order: ["party", "customer", "supplier", "product", "item", "products"],
  document: ["reference", "relatedOrder"],
  generic: [],
};

const relationTargetFields: Record<RelationKind, string[]> = {
  employee: ["employeeName", "employee", "name", "department", "jobTitle", "phone", "email", "address"],
  product: ["product", "item", "name", "category", "unit", "purchasePrice", "salePrice", "unitPrice", "quantity", "warehouse"],
  party: ["party", "customer", "supplier", "name", "phone", "email", "address", "taxNumber", "openingBalance", "creditLimit"],
  account: ["account", "accountName", "name", "nature", "statement", "classification", "level"],
  asset: ["asset", "insuredAsset", "name", "value", "location", "purchaseDate", "usefulLife", "depreciationMethod", "residualValue"],
  warehouse: ["warehouse", "fromWarehouse", "toWarehouse", "name", "address", "phone"],
  branch: ["branch", "name", "address", "phone", "email", "manager"],
  invoice: ["party", "customer", "supplier", "product", "item", "warehouse", "quantity", "unitPrice", "subtotal", "tax", "taxRate", "total", "paid", "date"],
  order: ["party", "customer", "supplier", "product", "item", "products", "quantity", "unitPrice", "total", "date", "orderDate", "deliveryDate"],
  document: ["reference", "relatedOrder", "name", "date", "amount"],
  generic: [],
};

function sourceKeysForAutofill(targetKey: string, relationKind: RelationKind | null, availableKeys: Set<string>) {
  if (!relationKind || relationKind === "generic") return [];
  const normalizedTarget = normalizeRelationKey(targetKey);
  const matchingTarget = relationTargetFields[relationKind].find(key => normalizeRelationKey(key) === normalizedTarget);
  if (!matchingTarget) return [];
  const primaryTargets = relationPrimaryTargets[relationKind];
  const hasPrimaryTarget = primaryTargets.some(key => Array.from(availableKeys).some(availableKey => normalizeRelationKey(availableKey) === normalizeRelationKey(key)));
  if (normalizedTarget === "name" && hasPrimaryTarget) return [];
  const sourceKey = Object.keys(autofillSources).find(key => normalizeRelationKey(key) === normalizedTarget);
  return sourceKey ? autofillSources[sourceKey] : [targetKey];
}

function daysInMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return 31;
  return new Date(Number(match[1]), Number(match[2]), 0).getDate();
}

function readAttendanceMarks(value: unknown): Record<number, boolean> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([day, mark]) => [Number(day), mark === true || mark === "حاضر" || mark === "true"]));
  } catch {
    return {};
  }
}

function qrPrefill(store: AccountingStore, qrCode: string) {
  const base: Record<string, string> = { qrCode, code: qrCode };
  if (store === "employees") return { ...base, employeeNumber: qrCode };
  if (store === "products") return { ...base, productCode: qrCode };
  if (store === "fixedAssets") return { ...base, assetNumber: qrCode };
  return base;
}

export default function Module({ params }: { params?: { store?: string } }) {
  const [store, setStore] = useState<AccountingStore>(() => initialStore(params));
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastChanges, setLastChanges] = useState<Record<string, LocalRecord>>({});
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const definition = sectionDefinitions[store] ?? sectionDefinitions.accounts;
  const activeRole = getActiveLocalRole();
  const restricted = (store === "users" && !canManageUsers(activeRole)) || (store === "auditLogs" && !canEditAuditLogs(activeRole)) || (store === "accounts" && !canManageAccounts(activeRole));
  const adminOnlySection = store === "users" || store === "auditLogs";
  const visibleStoreOrder = storeOrder.filter(item => !["users", "auditLogs"].includes(item) || canManageUsers(activeRole));

  const refresh = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const nextRecords = adminOnlySection && restricted ? [] : await localAccountingRepository.list(store);
      setRecords(nextRecords);
      const logs = await localList<LocalRecord>("auditLogs");
      const byId: Record<string, LocalRecord> = {};
      for (const log of logs.filter(item => item.table === store).sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))) if (log.recordId) byId[String(log.recordId)] = log;
      setLastChanges(byId);
    } catch {
      setLoadError("تعذر تحميل سجلات القسم من التخزين المحلي. أعد المحاولة دون فقدان بياناتك.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const scannedQr = String(query.get("qrCode") ?? "").trim();
    setForm({});
    setEditingId(null);
    setSearch("");
    setMessage("");
    setAttendanceMarks({});
    autoFilledValues.current = {};
    setDialogOpen(Boolean(scannedQr && query.get("new") === "1"));
    if (scannedQr && query.get("new") === "1") setForm(qrPrefill(store, scannedQr));
    void refresh();
  }, [store]);

  useEffect(() => {
    if (dialogOpen && store === "attendance" && !editingId && !form.month) {
      setForm({ month: currentMonth, attendanceDays: "{}", attendanceCount: "0", absenceCount: String(daysInMonth(currentMonth)), status: "مسودة" });
    }
  }, [dialogOpen, store, editingId, form.month]);

  const lookupEntries = Object.entries(form).filter(([key, value]) => isRelationLookupField(key) && String(value ?? "").trim());
  const lookupSignature = lookupEntries.map(([key, value]) => `${key}:${String(value).trim()}`).join("|");
  const [linkedRecord, setLinkedRecord] = useState<RelationRef | null>(null);
  const [attendanceMarks, setAttendanceMarks] = useState<Record<number, boolean>>({});
  const autoFilledValues = useRef<Record<string, string>>({});
  useEffect(() => {
    const clearUntouchedAutofill = () => {
      setForm(current => {
        const next = { ...current };
        for (const [key, autoValue] of Object.entries(autoFilledValues.current)) {
          if (String(next[key] ?? "").trim() === autoValue.trim()) delete next[key];
        }
        return next;
      });
      autoFilledValues.current = {};
    };
    if (!lookupEntries.length) {
      setLinkedRecord(null);
      clearUntouchedAutofill();
      return;
    }
    let active = true;
    clearUntouchedAutofill();
    const fillFromRelations = async () => {
      let lastRelation: RelationRef | null = null;
      for (const [lookupField, rawCode] of lookupEntries) {
        const match = await findLocalRecordByCode(String(rawCode), storesForRelationField(lookupField, store));
        if (!active || !match) continue;
        lastRelation = { store: match.store, id: match.id, code: match.code, label: match.label };
        const relationKind = relationKindForField(lookupField);
        setForm(current => {
          const next = { ...current };
          const availableKeys = new Set(visibleFields.map(field => field.key));
          for (const targetKey of availableKeys) {
            const sourceKeys = sourceKeysForAutofill(targetKey, relationKind, availableKeys);
            const sourceValue = sourceKeys.map(key => relationRecordValue(match.record, key)).find(Boolean);
            if (!sourceValue) continue;
            const currentValue = String(next[targetKey] ?? "").trim();
            const previousAutoValue = autoFilledValues.current[targetKey];
            if (!currentValue || currentValue === previousAutoValue) {
              next[targetKey] = sourceValue;
              autoFilledValues.current[targetKey] = sourceValue;
            }
          }
          return next;
        });
      }
      if (active) setLinkedRecord(lastRelation);
    };
    void fillFromRelations();
    return () => { active = false; };
  }, [lookupSignature]);

  // Every section uses the same completeness rule: identifiers, dates,
  // amounts, relations, statuses, and descriptive details are requested
  // before a record is saved. Free-form notes remain optional so they do not
  // block a valid operational entry, while boolean fields have a valid
  // default state.
  const visibleFields = [{ key: "qrCode", label: "كود QR (اختياري)", type: "text" as const, placeholder: "امسح الكود أو اكتبه يدويًا" }, ...definition.fields].map(field => ({
    ...field,
    options: store === "users" && field.key === "role" && !isFixedManagerSession() ? (field.options ?? []).filter(option => option !== "مدير") : field.options,
    required: field.key === "qrCode" ? false : field.required ?? (!["notes", "description"].includes(field.key) && field.type !== "boolean"),
  }));
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter(record => Object.values(record).some(value => String(value ?? "").toLowerCase().includes(term)));
  }, [records, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => filteredRecords.slice((page - 1) * pageSize, page * pageSize), [filteredRecords, page]);
  const selectedForDelete = records.find(record => record.id === confirmDeleteId);

  useEffect(() => { setPage(1); }, [store, search]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const updateField = (field: FieldDefinition, value: string) => setForm(current => {
    const previousAutoValue = autoFilledValues.current[field.key];
    if (previousAutoValue !== undefined && value.trim() !== previousAutoValue.trim()) delete autoFilledValues.current[field.key];
    const next = { ...current, [field.key]: value };
    if (store === "attendance" && field.key === "month") {
      const totalDays = daysInMonth(value);
      const validMarks = Object.fromEntries(Object.entries(attendanceMarks).filter(([day]) => Number(day) <= totalDays));
      setAttendanceMarks(validMarks);
      next.attendanceDays = JSON.stringify(validMarks);
      next.attendanceCount = String(Object.values(validMarks).filter(Boolean).length);
      next.absenceCount = String(totalDays - Object.values(validMarks).filter(Boolean).length);
    }
    return next;
  });
  const closeForm = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({});
    setAttendanceMarks({});
    autoFilledValues.current = {};
  };

  const openNewForm = () => {
    setEditingId(null);
    autoFilledValues.current = {};
    const queryQr = String(new URLSearchParams(window.location.search).get("qrCode") ?? "").trim();
    if (store === "attendance") {
      setAttendanceMarks({});
      setForm({ month: currentMonth, attendanceDays: "{}", attendanceCount: "0", absenceCount: String(daysInMonth(currentMonth)), status: "مسودة" });
    } else {
      setForm(queryQr ? qrPrefill(store, queryQr) : {});
    }
    setDialogOpen(true);
  };

  const updateAttendanceMark = (day: number, present: boolean) => {
    const nextMarks = { ...attendanceMarks, [day]: present };
    setAttendanceMarks(nextMarks);
    const presentCount = Object.values(nextMarks).filter(Boolean).length;
    setForm(current => ({ ...current, attendanceDays: JSON.stringify(nextMarks), attendanceCount: String(presentCount), absenceCount: String(daysInMonth(current.month) - presentCount) }));
  };

  const fillAllAttendance = () => {
    const totalDays = daysInMonth(form.month);
    const nextMarks = Object.fromEntries(Array.from({ length: totalDays }, (_, index) => [index + 1, true]));
    setAttendanceMarks(nextMarks);
    setForm(current => ({ ...current, attendanceDays: JSON.stringify(nextMarks), attendanceCount: String(totalDays), absenceCount: "0" }));
  };

  const clearAttendance = () => {
    setAttendanceMarks({});
    setForm(current => ({ ...current, attendanceDays: "{}", attendanceCount: "0", absenceCount: String(daysInMonth(current.month)) }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (restricted) {
      setMessage("هذه العملية متاحة للمدير فقط.");
      return;
    }
    if (store === "users" && editingId && (editingId === "system-manager" || String(form.email ?? "").trim().toLowerCase() === MANAGER_EMAIL.toLowerCase())) {
      setMessage("بيانات مدير النظام الأساسي ثابتة ولا تُعدّل من هذه الشاشة.");
      return;
    }
    const requiredMissing = visibleFields.find(field => field.required && !String(form[field.key] ?? "").trim() && !(store === "users" && field.key === "password" && editingId));
    if (store === "users" && !editingId && !String(form.password ?? "").trim()) {
      setMessage("يرجى إدخال: كلمة المرور");
      return;
    }
    if (store === "attendance" && !String(form.employeeName ?? "").trim()) {
      setMessage("اكتب كود الموظف ليتم ملء اسم الموظف تلقائيًا، أو أدخل الاسم يدويًا.");
      return;
    }
    if (requiredMissing) {
      setMessage(`يرجى إدخال: ${requiredMissing.label}`);
      return;
    }
    try {
      const wasEditing = Boolean(editingId);
      const id = editingId ?? `${store}-${Date.now()}`;
      const presentCount = Object.values(attendanceMarks).filter(Boolean).length;
      const totalAttendanceDays = store === "attendance" ? daysInMonth(String(form.month ?? "")) : 0;
      const saveForm = store === "attendance"
        ? { ...form, date: `${form.month}-01`, attendanceDays: JSON.stringify(attendanceMarks), attendanceCount: String(presentCount), absenceCount: String(Math.max(0, totalAttendanceDays - presentCount)), status: form.status || "مسودة" }
        : form;
      const computedForm = deriveComputedFields(store, saveForm);
      const validationError = validateAccountingRecord(store, computedForm);
      if (validationError) {
        setMessage(validationError);
        return;
      }
      if (store === "users") {
        const normalizedEmail = String(computedForm.email ?? "").trim().toLowerCase();
        if (normalizedEmail === MANAGER_EMAIL.toLowerCase()) {
          setMessage("حساب المدير الأساسي ثابت ولا يُنشأ أو يُعدّل من نموذج المستخدمين.");
          return;
        }
        computedForm.role = computedForm.role === "مدير" && isFixedManagerSession() ? "مدير" : computedForm.role === "مشرف" ? "مشرف" : "محاسب";
      }
      const persistedForm: Record<string, string | undefined> = { ...computedForm, ...(store === "users" ? { passwordHash: computedForm.password ? await hashLocalPassword(computedForm.password) : undefined } : {}) };
      if (store === "users") delete persistedForm.password;
      const saved = await localAccountingRepository.save(store, { id, ...persistedForm, name: persistedForm.name || persistedForm.reportName || persistedForm.month || persistedForm.product || persistedForm.item || "سجل جديد", code: persistedForm.code || id, updatedAt: new Date().toISOString() });
      if (String(persistedForm.qrCode ?? "").trim()) {
        const savedRecord = saved as LocalRecord;
        await linkQrCode({ qrCode: String(persistedForm.qrCode).trim(), targetStore: store, targetId: savedRecord.id, targetLabel: String(savedRecord.name ?? savedRecord.label ?? savedRecord.code ?? "سجل"), isPrimary: true });
      }
      const links = await localAccountingRepository.list("postingLinks");
      const linkedCount = links.filter(link => link.sourceStore === store && link.sourceId === saved.id).length;
      closeForm();
      setMessage(wasEditing ? `تم تعديل السجل محليًا وإعادة ترحيل ${linkedCount} أثر.` : `تمت إضافة السجل محليًا وترحيل ${linkedCount} أثر مترابط.`);
      await refresh();
    } catch {
      setMessage("تعذر حفظ السجل. تحقق من الحقول أو من صلاحية الفترة المحاسبية.");
    }
  };

  const editRecord = (record: LocalRecord) => {
    setEditingId(record.id);
    autoFilledValues.current = {};
    const nextForm = Object.fromEntries(visibleFields.map(field => [field.key, field.type === "boolean" ? String(Boolean(record[field.key])) : String(record[field.key] ?? "")]));
    if (store === "attendance") {
      const month = String(record.month ?? record.date ?? "").slice(0, 7);
      const marks = readAttendanceMarks(record.attendanceDays);
      const presentCount = Object.values(marks).filter(Boolean).length;
      nextForm.month = month;
      nextForm.attendanceDays = JSON.stringify(marks);
      nextForm.attendanceCount = String(record.attendanceCount ?? presentCount);
      nextForm.absenceCount = String(record.absenceCount ?? Math.max(0, daysInMonth(month) - presentCount));
      setAttendanceMarks(marks);
    }
    setForm(nextForm);
    setDialogOpen(true);
  };

  const deleteRecord = (id: string) => {
    if (restricted) {
      setMessage("حذف السجلات متاح للمدير فقط.");
      return;
    }
    const target = records.find(record => record.id === id);
    if (store === "users" && (id === "system-manager" || String(target?.email ?? "").trim().toLowerCase() === MANAGER_EMAIL.toLowerCase())) {
      setMessage("لا يمكن حذف مدير النظام الأساسي.");
      return;
    }
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await localAccountingRepository.remove(store, confirmDeleteId);
      setConfirmDeleteId(null);
      setMessage("تم حذف السجل محليًا.");
      await refresh();
    } catch {
      setConfirmDeleteId(null);
      setMessage("تعذر حذف السجل. قد تكون الفترة مقفلة أو لا تملك الصلاحية.");
    }
  };

  const resetUserLogins = async (record: LocalRecord) => {
    if (store !== "users" || restricted || record.id === "system-manager") return;
    try {
      await localAccountingRepository.save("users", { ...record, loginCount: 0, status: record.status === "محذوف" ? "نشط" : record.status, updatedAt: new Date().toISOString() });
      setMessage("تم تصفير عداد الدخول وإعادة تفعيل المستخدم.");
      await refresh();
    } catch {
      setMessage("تعذر تحديث بيانات المستخدم.");
    }
  };

  const toggleUserAccess = async (record: LocalRecord) => {
    if (store !== "users" || restricted || record.id === "system-manager") return;
    try {
      const enabled = record.systemAccessEnabled !== false;
      await localAccountingRepository.save("users", { ...record, systemAccessEnabled: !enabled, updatedAt: new Date().toISOString() });
      setMessage(!enabled ? "تم السماح للموظف بدخول النظام." : "تم إيقاف دخول الموظف إلى النظام.");
      await refresh();
    } catch {
      setMessage("تعذر تغيير حالة دخول الموظف.");
    }
  };

  const exportRows = async () => {
    if (adminOnlySection && restricted) {
      setMessage("هذا القسم متاح للمدير فقط.");
      return;
    }
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${store}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    await writeAudit("تصدير", store, { id: `${store}-export-${Date.now()}`, count: records.length, updatedAt: new Date().toISOString() });
  };

  const closeToday = async () => {
    if (store !== "attendance") return;
    try { const result = await closeAttendanceDay(new Date().toISOString().slice(0, 10)); setMessage(`تم إغلاق اليوم تلقائيًا لعدد ${result.count} موظفًا مع استثناء الإجازات والعطلات.`); }
    catch { setMessage("تعذر إغلاق اليوم تلقائيًا. راجع سياسة الوردية وبيانات الموظفين."); }
  };

  if (adminOnlySection && restricted) return <div dir="rtl" className="accounting-shell flex min-h-screen items-center justify-center p-5 text-slate-100"><div className="accounting-glass w-full max-w-xl rounded-3xl border border-red-300/20 bg-red-300/10 p-8 text-center"><h1 className="text-2xl font-black text-white">صلاحية غير كافية</h1><p className="mt-3 leading-7 text-red-100/80">قسم المستخدمين وسجل التدقيق متاحان للمدير فقط. لا يمكن إنشاء أو تعديل أو حذف أي حساب من هذه الجلسة.</p><LocalLink href="/" className="mt-6 inline-flex rounded-xl bg-red-500 px-5 py-3 font-bold text-slate-950">العودة للوحة التحكم</LocalLink></div></div>;

  const renderAttendancePlanner = () => {
    if (store !== "attendance") return null;
    const totalDays = daysInMonth(String(form.month ?? ""));
    const presentCount = Object.values(attendanceMarks).filter(Boolean).length;
    return <div key="attendance-calendar" className="md:col-span-3 rounded-2xl border border-red-400/25 bg-red-500/[0.07] p-4" data-testid="attendance-calendar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-bold text-red-100">تحديد الحضور اليومي</p><p className="mt-1 text-xs leading-5 text-red-100/70">ضع علامة صح أمام كل يوم حضر فيه الموظف. الأيام بدون علامة تُحسب غيابًا.</p></div>
        <div className="flex gap-2"><button type="button" onClick={fillAllAttendance} className="rounded-lg border border-red-300/30 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/15">تحديد كل الأيام</button><button type="button" onClick={clearAttendance} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-red-300/30">مسح العلامات</button></div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {Array.from({ length: totalDays }, (_, index) => index + 1).map(day => <label key={day} className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-xs transition ${attendanceMarks[day] ? "border-red-300/50 bg-red-500/20 text-red-100" : "border-white/10 bg-black/15 text-slate-400 hover:border-red-300/30"}`}><input type="checkbox" checked={Boolean(attendanceMarks[day])} onChange={event => updateAttendanceMark(day, event.target.checked)} className="h-4 w-4 accent-red-500" aria-label={`اليوم ${day}`} /><span className="font-bold">{day}</span><span className="text-[10px]">{attendanceMarks[day] ? "حاضر" : "غياب"}</span></label>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300"><span className="rounded-lg bg-red-500/15 px-3 py-2 text-red-100">الحضور: {presentCount}</span><span className="rounded-lg bg-black/20 px-3 py-2">الغياب: {totalDays - presentCount}</span><span className="rounded-lg bg-black/20 px-3 py-2">إجمالي الأيام: {totalDays}</span></div>
    </div>;
  };

  const renderField = (field: FieldDefinition) => {
    if (store === "attendance" && field.key === "attendanceDays") return renderAttendancePlanner();
    if (store === "attendance" && ["attendanceCount", "absenceCount"].includes(field.key)) return null;
    return <label key={field.key} className={field.width === "lg" ? "md:col-span-2" : ""}><span className="mb-1.5 block text-xs font-semibold text-[#d9cacc]">{field.label}{field.required ? " *" : ""}</span>{field.key === "qrCode" ? <div className="flex gap-2"><input type="text" value={form[field.key] ?? ""} onChange={event => updateField(field, event.target.value)} placeholder={field.placeholder} disabled={restricted} className={inputClass} /><LocalLink href="/qr-center" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[#d9a766]/30 px-3 text-xs font-bold text-[#e2c48d]">مركز QR</LocalLink></div> : field.type === "textarea" ? <textarea required={field.required} disabled={restricted} rows={3} value={form[field.key] ?? ""} onChange={event => updateField(field, event.target.value)} placeholder={field.placeholder} className={inputClass} /> : field.type === "select" ? <select required={field.required} disabled={restricted} value={form[field.key] ?? ""} onChange={event => updateField(field, event.target.value)} className={inputClass}><option value="">اختر...</option>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> : field.type === "boolean" ? <span className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-[#211c1f] px-3"><input type="checkbox" checked={form[field.key] === "true"} onChange={event => updateField(field, event.target.checked ? "true" : "false")} disabled={restricted} className="h-4 w-4 accent-red-500" /><span className="text-sm text-slate-300">{form[field.key] === "true" ? "مفعل" : "غير مفعل"}</span></span> : <input required={field.required} type={field.type === "number" ? "number" : field.type} value={form[field.key] ?? ""} onChange={event => updateField(field, event.target.value)} placeholder={field.placeholder} disabled={restricted} className={inputClass} />}</label>;
  };

  return (
    <div dir="rtl" className="accounting-shell min-h-screen text-slate-100">
      <AppTopBar title={definition.label} />
      <div className="px-4 py-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
           <div className="flex flex-wrap items-center justify-between gap-3"><LocalLink href="/" className="inline-flex items-center gap-2 text-sm text-red-300 transition hover:text-red-200" data-testid="link-back-dashboard"><ArrowRight className="h-4 w-4" /> العودة للوحة التحكم</LocalLink><div className="flex gap-2"><LocalLink href="/offline-settings" className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition hover:bg-red-500/20" data-testid="link-local-storage"><WifiOff className="h-4 w-4" /> التخزين المحلي</LocalLink><button onClick={() => void exportRows()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-red-400/30 hover:text-red-200" data-testid="button-export-section"><Download className="h-4 w-4" /> تصدير القسم</button></div></div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[250px_1fr]">
          <aside className="accounting-glass h-fit rounded-2xl p-4"><p className="text-xs font-bold text-slate-500">القسم الحالي</p><p className="mt-3 font-bold text-white">{definition.label}</p><p className="mt-2 text-xs leading-6 text-slate-500">كل البيانات تحفظ على هذا الجهاز ويمكن مراجعتها أو تصديرها في أي وقت.</p><div className="mt-5 border-t border-white/10 pt-4"><p className="mb-2 text-[11px] font-bold text-slate-500">أقسام الحسابات</p><div className="max-h-72 space-y-1 overflow-y-auto">{visibleStoreOrder.map(item => <button key={item} type="button" onClick={() => setStore(item)} className={`w-full rounded-lg px-3 py-2 text-right text-xs transition ${item === store ? "bg-red-500/15 font-bold text-red-200" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}>{sectionDefinitions[item]?.label ?? item}</button>)}</div></div></aside>
          <section className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-red-300">وضع محلي دون إنترنت</p><h1 className="mt-2 text-3xl font-black text-white" data-testid="text-section-title">{definition.label}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{definition.description}</p></div><Database className="h-7 w-7 text-red-300" /></div>
            <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-4"><p className="text-sm font-bold text-red-100">ماذا تضيف في هذا القسم؟</p><p className="mt-2 text-sm leading-6 text-red-50/80">{definition.addHint}</p></div>
             <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={openNewForm} disabled={restricted} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-add-record"><FilePlus2 className="h-4 w-4" /> إضافة سجل جديد</button>{store === "attendance" && <button type="button" onClick={() => void closeToday()} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-5 py-3 text-sm font-bold text-amber-100">إغلاق اليوم وتسجيل الغياب</button>}</div>
            {dialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0a0b]/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editingId ? `تعديل ${definition.label}` : `إضافة ${definition.label}`}><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-red-300/20 bg-[#1b1618] p-5 shadow-2xl lg:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.14em] text-red-300">{editingId ? "تعديل سجل" : "سجل جديد"}</p><h2 className="mt-2 text-xl font-black text-white">{editingId ? `تعديل ${definition.label}` : `إضافة ${definition.label}`}</h2><p className="mt-2 text-sm text-slate-400">تظهر هنا كل الحقول المعرفة لهذا القسم. سيُحفظ السجل محليًا ويُسجل في سجل التدقيق.</p></div><button type="button" onClick={closeForm} className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:border-red-400/40 hover:text-red-200" aria-label="إغلاق النافذة" data-testid="button-close-form"><X className="h-4 w-4" /></button></div>{linkedRecord && <div className="mb-4 rounded-xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100"><strong>تم العثور على سجل مرتبط:</strong><span className="mr-2">{linkedRecord.label}</span><span className="mr-2 text-red-200/80">القسم: {linkedRecord.store}</span><span className="mr-2 text-red-200/80">الكود: {linkedRecord.code}</span></div>}<form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/10 bg-black/15 p-4 md:grid-cols-3">{visibleFields.map(renderField)}<div className="flex flex-wrap gap-2 md:col-span-3"><button disabled={restricted} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-save-record"><FilePlus2 className="h-4 w-4" />{editingId ? "حفظ التعديل" : `إضافة ${definition.label}`}</button><button type="button" onClick={closeForm} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:border-red-400/40 hover:text-white" data-testid="button-cancel-form">إلغاء</button></div></form></div></div>}
            {message && <p role="status" className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200" data-testid="status-module-message">{message}</p>}
            <div className="mt-8 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold text-white">السجلات ({filteredRecords.length} من {records.length})</h2><p className="mt-1 text-xs text-slate-500">يمكنك تعديل أو حذف أي سجل محفوظ على هذا الجهاز.</p></div><div className="flex w-full gap-2 sm:w-auto"><label className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث في كل الخانات" className={`${inputClass} pr-9`} data-testid="input-search-records" /></label><button onClick={() => void refresh()} className="rounded-xl border border-white/10 px-3 text-slate-400 transition hover:border-red-400/40 hover:text-red-200" aria-label="تحديث السجلات" data-testid="button-refresh-records"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div></div>
            {loadError && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100" data-testid="status-load-error"><span>{loadError}</span><button type="button" onClick={() => void refresh()} className="rounded-lg border border-red-300/30 px-3 py-1.5 font-bold text-red-200">إعادة المحاولة</button></div>}
             <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[1200px] w-full text-right text-sm"><thead className="bg-[#211c1f] text-xs text-slate-400"><tr>{visibleFields.map(field => <th key={field.key} className="whitespace-nowrap px-4 py-3 font-semibold">{field.label}</th>)}<th className="whitespace-nowrap px-4 py-3">آخر تعديل بواسطة</th><th className="px-4 py-3">الإجراءات</th></tr></thead><tbody>{loading ? Array.from({ length: 5 }, (_, index) => <tr key={`loading-${index}`} className="border-t border-white/10">{Array.from({ length: Math.min(visibleFields.length + 2, 5) }, (_, cell) => <td key={cell} className="px-4 py-4"><span className="block h-3 animate-pulse rounded bg-white/10" /></td>)}</tr>) : filteredRecords.length === 0 ? <tr><td colSpan={visibleFields.length + 2} className="p-12 text-center"><div className="mx-auto max-w-sm"><Database className="mx-auto h-8 w-8 text-red-300/60" /><p className="mt-3 font-bold text-slate-300">{search ? "لا توجد نتائج مطابقة" : definition.emptyHint}</p><p className="mt-2 text-xs leading-6 text-slate-500">{search ? "جرّب كلمة بحث مختلفة أو امسح البحث." : "ابدأ بإضافة أول سجل ليظهر هنا."}</p></div></td></tr> : paginatedRecords.map(record => <tr key={record.id} className="border-t border-white/10 transition-colors hover:bg-red-500/[0.035]" data-testid={`row-record-${record.id}`}>{visibleFields.map(field => <td key={field.key} className="max-w-[260px] whitespace-pre-wrap px-4 py-3 text-slate-200">{field.type === "boolean" ? (record[field.key] ? "مفعل" : "غير مفعل") : String(record[field.key] ?? "—")}</td>)}<td className="max-w-[220px] px-4 py-3 text-xs text-slate-300"><div className="font-bold text-red-200">كود الموظف: {String(record.updatedByCode ?? lastChanges[String(record.id)]?.userCode ?? "غير معروف")}</div><div>{String(record.updatedByName ?? lastChanges[String(record.id)]?.user ?? "غير معروف")}</div><div>{String(record.updatedByEmail ?? lastChanges[String(record.id)]?.userEmail ?? "—")}</div><div className="text-slate-500">{String(record.updatedAt ?? lastChanges[String(record.id)]?.timestamp ?? "—")}</div></td><td className="whitespace-nowrap px-4 py-3"><button disabled={restricted || (store === "users" && String(record.email ?? "").trim().toLowerCase() === MANAGER_EMAIL.toLowerCase())} onClick={() => editRecord(record)} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-30" aria-label="تعديل السجل" data-testid={`button-edit-record-${record.id}`}><Edit3 className="h-4 w-4" /> تعديل</button>{store === "users" && <><button disabled={restricted || record.id === "system-manager" || String(record.email ?? "").trim().toLowerCase() === MANAGER_EMAIL.toLowerCase()} onClick={() => void toggleUserAccess(record)} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-30" aria-label={record.systemAccessEnabled === false ? "السماح بدخول الموظف" : "إيقاف دخول الموظف"} data-testid={`button-toggle-access-${record.id}`}>{record.systemAccessEnabled === false ? "السماح بالدخول" : "إيقاف الدخول"}</button><button disabled={restricted || String(record.email ?? "").trim().toLowerCase() === MANAGER_EMAIL.toLowerCase()} onClick={() => void resetUserLogins(record)} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-30" aria-label="تصفير عداد الدخول" data-testid={`button-reset-login-${record.id}`}><RotateCcw className="h-4 w-4" /> تصفير</button></>}<button disabled={restricted || (store === "users" && (record.id === "system-manager" || String(record.email ?? "").trim().toLowerCase() === MANAGER_EMAIL.toLowerCase()))} onClick={() => deleteRecord(record.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-30" aria-label="حذف السجل" data-testid={`button-delete-record-${record.id}`}><Trash2 className="h-4 w-4" /> حذف</button></td></tr>)}</tbody></table></div>
            {pageCount > 1 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-slate-400"><span>صفحة {page} من {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-white/10 px-3 py-2 transition hover:border-red-400/40 disabled:opacity-40">السابق</button><button type="button" disabled={page === pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))} className="rounded-lg border border-white/10 px-3 py-2 transition hover:border-red-400/40 disabled:opacity-40">التالي</button></div></div>}
          </section>
        </div>
      </div>
       {confirmDeleteId && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0c0a0b]/85 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#1b1618] p-6 shadow-2xl"><div className="flex items-start gap-4"><div className="rounded-xl bg-red-500/15 p-3 text-red-300"><Trash2 className="h-5 w-5" /></div><div><h2 id="delete-dialog-title" className="font-black text-white">تأكيد حذف السجل</h2><p className="mt-2 text-sm leading-6 text-slate-400">سيُحذف هذا السجل نهائيًا من التخزين المحلي وقد تُعكس آثاره المترابطة. لا يمكن التراجع عن العملية.</p><p className="mt-3 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-red-200">{String(selectedForDelete?.name ?? selectedForDelete?.code ?? "السجل المحدد")}</p></div></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-red-400/40 hover:text-white" data-testid="button-cancel-delete">إلغاء</button><button type="button" onClick={() => void confirmDelete()} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500" data-testid="button-confirm-delete">نعم، حذف السجل</button></div></div></div>}
      </div>
    </div>
  );
}
