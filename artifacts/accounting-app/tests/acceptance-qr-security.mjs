import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.URJD_BASE_URL ?? "http://127.0.0.1:22636";
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/home/ubuntu/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args: ["--no-sandbox", "--disable-gpu"] });
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();
let nextQr = "MANAGER";
page.on("dialog", async dialog => { await dialog.accept(nextQr); });
const managerEmail = "AAO818@gmail.com";
const managerPassword = "AAO818";
const testEmail = "qa.employee@example.com";
const testPassword = "QaEmployee123!";

async function login(email, password, qr) {
  nextQr = qr;
  await page.goto(`${base}/local-access`, { waitUntil: "domcontentloaded" });
  const init = page.getByTestId("button-initialize-manager");
  const loginForm = page.getByTestId("form-local-login");
  try {
    await loginForm.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    await init.waitFor({ state: "visible", timeout: 5000 });
    await init.click();
    await loginForm.waitFor({ state: "visible", timeout: 5000 });
  }
  await page.getByTestId("input-local-email").fill(email);
  await page.getByTestId("input-local-password").fill(password);
  await page.getByTestId("button-local-login").click();
  await page.waitForURL(`${base}/`);
}

try {
  await login(managerEmail, managerPassword, "MANAGER");
  await page.goto(`${base}/section/users`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-add-record").click();
  const dialog = page.getByRole("dialog");
  const inputs = dialog.locator("input");
  assert.ok(await inputs.count() >= 8, "User security fields are missing");
  await dialog.getByLabel("اسم المستخدم *").fill("موظف اختبار QA");
  await dialog.getByLabel("البريد الإلكتروني *").fill(testEmail);
  await dialog.getByLabel("كلمة المرور *").fill(testPassword);
  await dialog.getByLabel("كود QR الموظف").fill("TEST-BADGE");
  await dialog.getByLabel("تاريخ انتهاء الصلاحية").fill("2027-12-31");
  await dialog.getByLabel("الحد الأقصى للأجهزة").fill("1");
  await dialog.getByLabel("الحد الأقصى للمحاولات").fill("5");
  await dialog.getByLabel("المحاولات المستخدمة").fill("0");
  await dialog.getByLabel("عدد مرات الدخول المسموح *").fill("10");
  await dialog.getByLabel("عدد مرات الدخول *").fill("0");
  await dialog.getByLabel("آخر تسجيل دخول").fill("2026-09-05");
  const selects = dialog.locator("select");
  await selects.nth(0).selectOption({ label: "محاسب" });
  await selects.nth(1).selectOption({ label: "نشط" });
  await dialog.getByRole("button", { name: /إضافة المستخدمون والصلاحيات/ }).click();
  await page.waitForTimeout(300);
  console.log((await page.locator("body").innerText()).slice(-1800));
  assert.ok((await page.locator("body").innerText()).includes(testEmail), "QA user was not created");
  const createdRow = page.getByText(testEmail).locator("xpath=ancestor::tr").first();
  await createdRow.getByRole("button", { name: "إيقاف دخول الموظف" }).click();
  await page.waitForTimeout(150);
  assert.ok(await createdRow.getByRole("button", { name: "السماح بدخول الموظف" }).count(), "Manager access toggle did not disable the employee");
  await createdRow.getByRole("button", { name: "السماح بدخول الموظف" }).click();
  await page.waitForTimeout(150);

  nextQr = "MANAGER";
  await page.getByTestId("button-top-logout").click();
  await page.waitForURL(`${base}/local-access`);
  await login(testEmail, testPassword, "TEST-BADGE");
  const home = await page.locator("body").innerText();
  assert.ok(!home.includes("إدارة المستخدمين"), "Ordinary user sees user-management navigation");
  await page.goto(`${base}/section/users`, { waitUntil: "domcontentloaded" });
  assert.ok((await page.locator("body").innerText()).includes("نظام محاسبة المصنع"), "Users section was not protected");
  await page.goto(`${base}/section/accounts`, { waitUntil: "domcontentloaded" });
  const addAccounts = page.getByTestId("button-add-record");
  if (await addAccounts.count()) assert.equal(await addAccounts.isDisabled(), true, "Ordinary user can add accounts");
  await page.getByTestId("button-top-logout").click();
  await page.waitForURL(`${base}/local-access`);

  await login(managerEmail, managerPassword, "MANAGER");
  await page.goto(`${base}/section/users`, { waitUntil: "domcontentloaded" });
  await page.getByText(testEmail).waitFor({ state: "visible", timeout: 5000 });
  const row = page.getByText(testEmail).locator("xpath=ancestor::tr").first();
  assert.equal(await row.count(), 1, "QA user missing during cleanup");
  await row.getByRole("button", { name: "حذف السجل" }).click();
  await page.getByTestId("button-confirm-delete").click();
  await page.waitForTimeout(250);
  assert.ok(!(await page.locator("body").innerText()).includes(testEmail), "QA user cleanup failed");
  console.log(JSON.stringify({ status: "PASS", managerLogin: true, qrLogin: true, qrLogout: true, userCreation: true, ordinaryUserProtection: true, accountsProtection: true, cleanup: true }));
} finally {
  await browser.close();
}
