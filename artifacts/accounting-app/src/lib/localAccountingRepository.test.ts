import { afterEach, describe, expect, it } from "vitest";
import { localList } from "./localDb";
import { localAccountingRepository } from "./localAccountingRepository";
import { canManageUsers, changeLocalPassword, hashLocalPassword, MANAGER_EMAIL, registerLocalLogin } from "./localPermissions";

function installLocalSession(userId = "system-manager", email = MANAGER_EMAIL.toLowerCase(), role = "مدير") {
  const values: Record<string, string> = {
    "local-active-user-id": userId,
    "local-active-user-email": email,
    "local-active-role": role,
    "local-company-manager-authorized": userId !== "system-manager" && role === "مدير" ? "true" : "false",
  };
  const makeStore = () => ({
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = value; },
    removeItem: (key: string) => { delete values[key]; },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: makeStore() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: makeStore() });
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");
  Reflect.deleteProperty(globalThis, "indexedDB");
});

describe("local accounting repository integration", () => {
  it("creates a regular local user that cannot manage users", async () => {
    installLocalSession();
    await localAccountingRepository.save("users", {
      id: "regular-user-1",
      code: "U-1",
      name: "مستخدم عادي",
      email: "user@example.com",
      role: "محاسب",
      status: "نشط",
      loginCount: 0,
      loginLimit: 0,
      passwordHash: await hashLocalPassword("user-pass"),
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(await registerLocalLogin("regular-user-1", "user-pass")).toBe(true);
    expect(canManageUsers()).toBe(false);
    await expect(changeLocalPassword("regular-user-1", "wrong-pass", "new-pass")).rejects.toThrow("غير صحيحة");
    await expect(changeLocalPassword("regular-user-1", "user-pass", "new-pass")).resolves.toBe(true);
    expect(await registerLocalLogin("regular-user-1", "user-pass")).toBe(false);
    expect((await localList("users")).find(row => row.id === "regular-user-1")?.loginAttemptsUsed).toBe(1);
    expect(await registerLocalLogin("regular-user-1", "new-pass")).toBe(true);
    expect((await localList("users")).find(row => row.id === "regular-user-1")?.loginAttemptsUsed).toBe(0);
    await expect(localAccountingRepository.save("users", { id: "should-fail", email: "attacker@example.com", role: "مدير", name: "محاولة", code: "X", updatedAt: "2026-01-01" })).rejects.toThrow("غير مصرح");
  });

  it("rejects a disabled employee even when password and QR credentials are valid", async () => {
    installLocalSession();
    await localAccountingRepository.save("users", { id: "disabled-user", code: "U-DISABLED", name: "موظف موقوف", email: "disabled@example.com", role: "محاسب", status: "نشط", systemAccessEnabled: false, employeeBadgeCode: "BADGE-DISABLED", passwordHash: await hashLocalPassword("disabled-pass"), updatedAt: "2026-01-01" });
    await expect(registerLocalLogin("disabled-user", "disabled-pass")).rejects.toThrow("تم إيقاف دخول");
  });

  it("allows only the fixed manager to see and manage users, while protecting only the manager row from deletion", async () => {
    installLocalSession();
    await localAccountingRepository.save("users", { id: "system-manager", code: "MANAGER", name: "مدير النظام", email: MANAGER_EMAIL, role: "مدير", status: "نشط", loginCount: 0, loginLimit: 0, passwordHash: await hashLocalPassword("manager-pass"), updatedAt: "2026-01-01" });
    const regularUser = { id: "user-to-delete", code: "U-DELETE", name: "مستخدم قابل للحذف", email: "delete@example.com", role: "محاسب", status: "نشط", passwordHash: await hashLocalPassword("delete-pass"), updatedAt: "2026-01-01" };
    await localAccountingRepository.save("users", regularUser);
    await expect(localAccountingRepository.list("users")).resolves.toHaveLength(2);
    await expect(localAccountingRepository.remove("users", "system-manager")).rejects.toThrow("لا يمكن حذف مدير النظام الأساسي");
    await expect(localAccountingRepository.remove("users", regularUser.id)).resolves.toBeUndefined();
    await expect(localAccountingRepository.list("users")).resolves.toHaveLength(1);

    installLocalSession("user-to-delete", "delete@example.com", "محاسب");
    expect(canManageUsers()).toBe(false);
    await expect(localAccountingRepository.list("users")).resolves.toEqual([]);
    await expect(localAccountingRepository.remove("users", "system-manager")).rejects.toThrow("غير مصرح");
  });

  it("isolates records by the active local user", async () => {
    installLocalSession();
    const userRecord = { id: "user-b", code: "U-B", name: "مستخدم ب", email: "b@example.com", role: "محاسب", status: "نشط", passwordHash: await hashLocalPassword("pass-b"), updatedAt: "2026-01-01" };
    await localAccountingRepository.save("users", userRecord);
    installLocalSession("regular-user-1", "user@example.com", "محاسب");
    await localAccountingRepository.save("invoices", { id: "private-a", code: "A-1", name: "فاتورة أ", total: 10, updatedAt: "2026-01-01" });
    installLocalSession("user-b", "b@example.com", "محاسب");
    await expect(localAccountingRepository.list("invoices")).resolves.toEqual([]);
    await localAccountingRepository.save("invoices", { id: "private-b", code: "B-1", name: "فاتورة ب", total: 20, updatedAt: "2026-01-01" });
    await expect(localAccountingRepository.list("invoices")).resolves.toHaveLength(1);
  });

  it("supports local CRUD across contacts and products and reverses deleted invoice effects", async () => {
    installLocalSession();
    await localAccountingRepository.save("contacts", { id: "crud-contact", code: "C-1", name: "عميل CRUD", updatedAt: "2026-01-01" });
    await localAccountingRepository.save("products", { id: "crud-product", code: "P-1", name: "صنف CRUD", quantity: 4, updatedAt: "2026-01-01" });
    expect((await localAccountingRepository.list("contacts")).find(row => row.code === "C-1")?.name).toBe("عميل CRUD");
    expect((await localAccountingRepository.list("contacts")).find(row => row.id === "crud-contact")?.createdById).toBe("system-manager");
    expect((await localAccountingRepository.list("contacts")).find(row => row.id === "crud-contact")?.updatedByEmail).toBe(MANAGER_EMAIL.toLowerCase());
    await localAccountingRepository.save("contacts", { id: "crud-contact", code: "C-1", name: "عميل معدل", updatedAt: "2026-01-02" });
    expect((await localAccountingRepository.list("contacts")).find(row => row.id === "crud-contact")?.name).toBe("عميل معدل");
    await localAccountingRepository.save("invoices", { id: "crud-invoice", code: "INV-CRUD", name: "فاتورة حذف", invoiceType: "مبيعات", total: 30, paid: 30, paymentMethod: "خزينة", item: "صنف CRUD", quantity: 1, unitPrice: 30, updatedAt: "2026-01-01" });
    expect((await localList("postingLinks")).some(row => row.sourceId === "crud-invoice")).toBe(true);
    await localAccountingRepository.remove("invoices", "crud-invoice");
    expect((await localAccountingRepository.list("invoices")).some(row => row.id === "crud-invoice")).toBe(false);
    expect((await localList("postingLinks")).filter(row => row.sourceId === "crud-invoice")).toHaveLength(0);
    await localAccountingRepository.remove("contacts", "crud-contact");
    expect((await localAccountingRepository.list("contacts")).some(row => row.id === "crud-contact")).toBe(false);
  });

  it("keeps untrusted input as inert data and does not bypass ownership", async () => {
    installLocalSession("regular-user-1", "user@example.com", "محاسب");
    const payload = "<script>alert('x')</script>";
    await localAccountingRepository.save("contacts", { id: "unsafe-contact", code: "XSS-1", name: payload, email: payload, updatedAt: "2026-01-01" });
    const rows = await localAccountingRepository.list("contacts");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe(payload);
    expect(rows[0]?.ownerId).toBe("regular-user-1");
  });

  it("keeps the unified manager outside company-manager edit scope", async () => {
    installLocalSession();
    await localAccountingRepository.save("users", { id: "system-manager", code: "MANAGER", name: "مدير النظام", email: MANAGER_EMAIL, role: "مدير", status: "نشط", passwordHash: await hashLocalPassword("manager-pass"), updatedAt: "2026-01-01" });
    await localAccountingRepository.save("users", { id: "company-manager", code: "M-1", name: "مدير شركة", email: "manager@example.com", role: "مدير", status: "نشط", managedBy: "system-manager", passwordHash: await hashLocalPassword("manager-pass"), updatedAt: "2026-01-01" });
    await localAccountingRepository.save("users", { id: "employee-owned", code: "U-OWNED", name: "موظف الشركة", email: "owned@example.com", role: "محاسب", managedBy: "company-manager", passwordHash: await hashLocalPassword("employee-pass"), updatedAt: "2026-01-01" });

    localStorage.setItem("local-active-user-id", "company-manager");
    localStorage.setItem("local-active-user-email", "manager@example.com");
    localStorage.setItem("local-active-role", "مدير");
    localStorage.setItem("local-company-manager-authorized", "true");
    sessionStorage.setItem("local-active-user-id", "company-manager");
    await expect(localAccountingRepository.save("users", { id: "system-manager", code: "MANAGER", name: "محاولة تعديل", email: MANAGER_EMAIL, role: "مدير", updatedAt: "2026-01-01" })).rejects.toThrow("مدير النظام الأساسي");
    await expect(localAccountingRepository.save("users", { id: "other-manager", code: "M-2", name: "مدير آخر", email: "other-manager@example.com", role: "مدير", managedBy: "company-manager", updatedAt: "2026-01-01" })).rejects.toThrow("لا يمكن إنشاء أو منح صلاحية مدير");
    await expect(localAccountingRepository.save("users", { id: "employee-owned", code: "U-OWNED", name: "موظف معدل", email: "owned@example.com", role: "محاسب", managedBy: "company-manager", updatedAt: "2026-01-01" })).resolves.toMatchObject({ name: "موظف معدل" });
  });

  it("replaces a source invoice effects instead of duplicating them on edit", async () => {
    installLocalSession();
    const invoice = { id: "invoice-integration-1", code: "INV-1", name: "فاتورة اختبار", invoiceType: "مبيعات", total: 120, subtotal: 100, tax: 20, paid: 120, paymentMethod: "خزينة", item: "صنف اختبار", quantity: 2, updatedAt: "2026-01-01T00:00:00.000Z" };
    await localAccountingRepository.save("invoices", invoice);
    await localAccountingRepository.save("invoices", invoice);
    const firstLinks = await localList("postingLinks");
    expect(firstLinks.filter(link => link.sourceId === invoice.id)).toHaveLength(5);

    await localAccountingRepository.save("invoices", { ...invoice, total: 180, subtotal: 150, tax: 30 });
    const secondLinks = await localList("postingLinks");
    const activeEffects = (await Promise.all(["journalEntries", "cashTransactions", "inventoryMovements", "taxReturns", "revenues"].map(store => localList(store as never))))
      .flat()
      .filter(row => row.sourceId === invoice.id && row.postingStatus !== "معكوس");
    expect(secondLinks.filter(link => link.sourceId === invoice.id)).toHaveLength(5);
    expect(new Set(activeEffects.map(row => row.id)).size).toBe(activeEffects.length);
    expect(activeEffects.some(row => row.amount === 30 || row.tax === 30)).toBe(true);
  });
});
