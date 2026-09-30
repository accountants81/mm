import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.URJD_BASE_URL ?? "http://127.0.0.1:80";
const managerEmail = "AAO818@gmail.com";
const managerPassword = "AAO818";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();

async function login() {
  await page.goto(`${base}/local-access`, { waitUntil: "domcontentloaded" });
  const initialize = page.getByTestId("button-initialize-manager");
  if (await initialize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await initialize.click({ timeout: 5000 });
    await page.getByTestId("form-local-login").waitFor({ state: "visible", timeout: 10000 });
  }
  await page.getByTestId("form-local-login").waitFor({ state: "visible", timeout: 10000 });
  await page.getByTestId("input-local-email").fill(managerEmail);
  await page.getByTestId("input-local-password").fill(managerPassword);
  await page.getByTestId("button-local-login").click();
  await page.waitForURL(`${base}/`);
}

async function openSection(path) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-add-record").click();
  return page.getByRole("dialog");
}

async function save(dialog) {
  await dialog.getByTestId("button-save-record").click();
  await page.getByTestId("status-module-message").waitFor({ state: "visible" });
  await page.waitForTimeout(120);
}

try {
  await login();

  let dialog = await openSection("/section/products");
  await dialog.getByLabel("الكود / رقم المستند").fill("PROD-100");
  await dialog.getByLabel("البيان أو الاسم").fill("منتج اختبار");
  await dialog.getByLabel("التصنيف").fill("مواد خام");
  await dialog.getByLabel("الوحدة").fill("قطعة");
  await dialog.getByLabel("سعر الشراء").fill("25");
  await dialog.getByLabel("سعر البيع").fill("50");
  await dialog.getByLabel("طريقة تقييم المخزون").selectOption("AVERAGE");
  await dialog.getByLabel("الكمية الحالية").fill("20");
  await dialog.getByLabel("حد إعادة الطلب").fill("5");
  await dialog.getByLabel("المخزن").fill("المخزن الرئيسي");
  await save(dialog);
  assert.match(await page.locator("body").innerText(), /PROD-100/);

  dialog = await openSection("/section/employees");
  await dialog.getByLabel("الكود / رقم المستند").fill("EMP-100");
  await dialog.getByLabel("البيان أو الاسم").fill("موظف اختبار");
  await dialog.getByLabel("الرقم الوظيفي").fill("EMP-100");
  await dialog.getByLabel("القسم").fill("التشغيل");
  await dialog.getByLabel("الوظيفة").fill("مشغل");
  await dialog.getByLabel("الهاتف").fill("01000000000");
  await dialog.getByLabel("تاريخ التعيين").fill("2026-09-01");
  await dialog.getByLabel("الحالة").selectOption("على رأس العمل");
  await save(dialog);
  assert.match(await page.locator("body").innerText(), /EMP-100/);

  dialog = await openSection("/section/attendancePolicies");
  await dialog.getByLabel("اسم السياسة / الوردية").fill("وردية الاختبار");
  await dialog.getByLabel("بداية الوردية").fill("08:00");
  await dialog.getByLabel("نهاية الوردية").fill("16:00");
  await dialog.getByLabel("دقائق السماح").fill("15");
  await dialog.getByLabel("أقل مدة قبل الانصراف").fill("0");
  await dialog.getByLabel("بدء الإضافي بعد دقائق").fill("0");
  await dialog.getByLabel("وقت إغلاق اليوم").fill("23:59");
  await dialog.getByLabel("أيام الإجازة الأسبوعية").fill("الجمعة، السبت");
  await save(dialog);

  dialog = await openSection("/section/attendance");
  await dialog.getByLabel("الرقم الوظيفي").fill("EMP-100");
  await page.waitForTimeout(150);
  assert.equal(await dialog.getByLabel("اسم الموظف").inputValue(), "موظف اختبار");
  await dialog.getByLabel("شهر الحضور").fill("2026-09");
  await dialog.getByRole("checkbox", { name: "اليوم 1", exact: true }).check();
  await dialog.getByLabel("وقت الحضور المعتاد").fill("08:00");
  await dialog.getByLabel("وقت الانصراف المعتاد").fill("16:00");
  await dialog.getByLabel("حالة الكشف").selectOption("مسجل");
  await save(dialog);
  assert.match(await page.locator("body").innerText(), /موظف اختبار/);

  await page.goto(`${base}/qr-center?autoCamera=0`, { waitUntil: "domcontentloaded" });
  const qrInput = page.getByPlaceholder("امسح بالكاميرا أو ضع المؤشر واستخدم الجهاز الخارجي");
  await qrInput.fill("EMP-100");
  await qrInput.press("Enter");
  await page.getByText("تمت معالجة حركة موظف اختبار لليوم الحالي.").waitFor({ state: "visible" });
  await page.waitForTimeout(2200);
  await qrInput.press("Enter");
  await page.getByText("تمت معالجة حركة موظف اختبار لليوم الحالي.").waitFor({ state: "visible" });

  dialog = await openSection("/section/invoices");
  await dialog.getByLabel("الكود / رقم المستند").fill("INV-100");
  await dialog.getByLabel("البيان أو الاسم").fill("فاتورة اختبار");
  await dialog.getByLabel("نوع الفاتورة").selectOption("مبيعات");
  await dialog.getByLabel("التاريخ").fill("2026-09-06");
  await dialog.getByLabel("العميل / المورد *", { exact: true }).fill("عميل اختبار");
  await dialog.getByLabel("كود العميل / المورد *", { exact: true }).fill("CUST-100");
  await dialog.getByLabel("الصنف الرئيسي").fill("منتج اختبار");
  await dialog.getByLabel("كود الصنف").fill("PROD-100");
  await dialog.getByLabel("المخزن").fill("المخزن الرئيسي");
  await dialog.getByLabel("الكمية").fill("2");
  await dialog.getByLabel("سعر الوحدة").fill("50");
  await dialog.getByLabel("طريقة الدفع").selectOption("خزينة");
  await dialog.getByLabel("قبل الضريبة *", { exact: true }).fill("100");
  await dialog.getByLabel("الضريبة *", { exact: true }).fill("14");
  await dialog.getByLabel("نسبة الضريبة *", { exact: true }).fill("14");
  await dialog.getByLabel("الإجمالي *", { exact: true }).fill("114");
  await dialog.getByLabel("المدفوع *", { exact: true }).fill("114");
  await dialog.getByLabel("الحالة").selectOption("مدفوعة");
  await dialog.getByLabel("بنود الفاتورة").fill("منتج اختبار — 2 — 50");
  await save(dialog);
  const invoiceBody = await page.locator("body").innerText();
  assert.match(invoiceBody, /INV-100/);
  assert.match(invoiceBody, /114/);

  const audit = await page.evaluate(async () => {
    const connection = await new Promise((resolve, reject) => {
      const request = indexedDB.open("abd-elaziz-omran-accounting");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (store) => new Promise((resolve, reject) => {
      const request = connection.transaction(store, "readonly").objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [events, links, logs] = await Promise.all([
      read("attendanceEvents"),
      read("postingLinks"),
      read("auditLogs"),
    ]);
    connection.close();
    return {
      attendanceClosed: events.some((row) => row.employeeId && row.status === "closed"),
      postingLinks: links.length,
      auditEntries: logs.length,
    };
  });
  assert.equal(audit.attendanceClosed, true);
  assert.ok(audit.postingLinks > 0, "Invoice did not create linked posting effects");
  assert.ok(audit.auditEntries >= 5, "Core create actions were not audited");
  console.log(JSON.stringify({ status: "PASS", product: true, employee: true, attendance: true, checkInOut: true, invoice: true, postingLinks: audit.postingLinks, auditEntries: audit.auditEntries }));
} finally {
  await browser.close();
}