import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox", "--disable-gpu"] });
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();
page.on("dialog", async dialog => {
  if (dialog.type() === "prompt") await dialog.accept("TEST-BADGE");
  else await dialog.dismiss();
});
const base = process.env.URJD_BASE_URL ?? "http://127.0.0.1:5173";
const email = "test.user@example.com";
const password = "TestUser123!";
try {
  await page.goto(`${base}/local-access`, { waitUntil: "domcontentloaded" });
  if (await page.getByTestId("button-initialize-manager").count()) await page.getByTestId("button-initialize-manager").click();
  await page.getByTestId("input-local-email").fill("AAO818@gmail.com");
  await page.getByTestId("input-local-password").fill("AAO818");
  await page.getByTestId("button-local-login").click();
  await page.waitForURL(`${base}/`);
  await page.goto(`${base}/section/users`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-add-record").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("اسم المستخدم").fill("مستخدم اختبار");
  await dialog.getByLabel("البريد الإلكتروني").fill(email);
  await dialog.getByLabel("كلمة المرور").fill(password);
  await dialog.locator("select").nth(0).selectOption({ label: "محاسب" });
  await dialog.getByLabel("كود QR الموظف").fill("TEST-BADGE");
  await dialog.getByLabel("تاريخ انتهاء الصلاحية").fill("2027-12-31");
  await dialog.getByLabel("الحد الأقصى للأجهزة").fill("1");
  await dialog.getByLabel("الحد الأقصى للمحاولات").fill("5");
  await dialog.getByLabel("المحاولات المستخدمة").fill("0");
  await dialog.getByLabel("عدد مرات الدخول المسموح").fill("10");
  await dialog.getByLabel("عدد مرات الدخول *", { exact: true }).fill("0");
  await dialog.getByLabel("آخر تسجيل دخول *", { exact: true }).fill("2026-09-06");
  await dialog.locator("select").nth(1).selectOption({ label: "نشط" });
  await dialog.getByRole("button", { name: /إضافة المستخدمون والصلاحيات/ }).click();
  await page.waitForTimeout(250);
  console.log((await page.locator("body").innerText()).slice(-1200));
  await assert.rejects(() => page.getByText(email).waitFor({ state: "detached", timeout: 100 }), /Timeout|detached/).catch(() => {});
  assert.ok((await page.locator("body").innerText()).includes(email), "Ordinary user was not created");

  await page.goto(`${base}/local-access`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("input-local-email").fill(email);
  await page.getByTestId("input-local-password").fill(password);
  await page.getByTestId("button-local-login").click();
  await page.waitForURL(`${base}/`);
  const home = await page.locator("body").innerText();
  assert.ok(!home.includes("إدارة المستخدمين"), "Ordinary user can see user-management link");
  await page.goto(`${base}/section/users`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const protectedRouteBody = await page.locator("body").innerText();
  assert.ok(!protectedRouteBody.includes("# المستخدمون والصلاحيات"), "Ordinary user can view the users section directly");
  assert.ok(protectedRouteBody.includes("نظام محاسبة المصنع"), "Protected route did not render the safe dashboard");

  console.log(JSON.stringify({ status: "PASS", created: email, ordinaryUserDeniedUsersSection: true }));
} finally {
  await browser.close();
}
