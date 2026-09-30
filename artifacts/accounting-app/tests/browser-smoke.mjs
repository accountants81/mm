import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, symlinkSync } from "node:fs";
import { chromium } from "@playwright/test";

const baseUrl = process.env.URJD_BASE_URL ?? "http://127.0.0.1:22636";
const currentManagerEmail = "AAO818@gmail.com";
const currentManagerPassword = "AAO818";
const runtimeLibraryDir = "/tmp/urjd-browser-libs";
mkdirSync(runtimeLibraryDir, { recursive: true });
for (const library of ["libgbm.so.1", "libxkbcommon.so.0", "libasound.so.2"]) {
  try {
    const source = execFileSync("find", ["/nix/store", "-maxdepth", "3", "-name", library, "-print", "-quit"], { encoding: "utf8" }).trim();
    symlinkSync(source, `${runtimeLibraryDir}/${library}`, "file");
  } catch {
    // The browser will report a clear missing-library error if the environment lacks it.
  }
}
const linkerLibraryDirs = (process.env.NIX_LDFLAGS ?? "")
  .match(/-L\S+/g)
  ?.map(value => value.slice(2))
  .filter((value, index, values) => values.indexOf(value) === index) ?? [];
const chromiumLibraries = [
  "libglib-2.0.so.0", "libgobject-2.0.so.0", "libnspr4.so", "libnss3.so", "libnssutil3.so",
  "libsmime3.so", "libgio-2.0.so.0", "libatk-1.0.so.0", "libatk-bridge-2.0.so.0",
  "libdbus-1.so.3", "libcups.so.2", "libxcb.so.1", "libxkbcommon.so.0", "libasound.so.2",
  "libgbm.so.1", "libX11.so.6", "libXext.so.6", "libcairo.so.2", "libpango-1.0.so.0",
  "libXcomposite.so.1", "libXdamage.so.1", "libXfixes.so.3", "libXrandr.so.2", "libatspi.so.0",
];
const runtimeLibraryDirs = chromiumLibraries
  .map(library => {
    try {
      return execFileSync("find", ["/nix/store", "-maxdepth", "3", "-name", library, "-printf", "%h\\n", "-quit"], { encoding: "utf8" }).trim();
    } catch {
      return "";
    }
  })
  .filter(Boolean);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? chromium.executablePath(),
  args: ["--disable-gpu", "--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  env: { ...process.env, LD_LIBRARY_PATH: [...new Set([runtimeLibraryDir, ...linkerLibraryDirs, process.env.LD_LIBRARY_PATH].filter(Boolean))].join(":") },
});
const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("dialog", async dialog => { await dialog.accept("browser-smoke-password"); });

page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => pageErrors.push(error.message));

async function visit(path, target = page) {
  console.log(`VISIT ${path}`);
  const response = await target.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await target.waitForTimeout(180);
  assert.ok(!response || response.status() < 400, `HTTP failure on ${path}`);
  const body = await target.locator("body").innerText();
  assert.ok(!body.includes("لم يتم العثور على هذه الوحدة"), `Unknown route rendered for ${path}`);
  assert.ok(!body.includes("حدث خطأ غير متوقع"), `Runtime error rendered for ${path}`);
  return body;
}

async function clickIfVisible(locator) {
  if (await locator.count().catch(() => 0) > 0 && await locator.first().isVisible().catch(() => false)) await locator.first().click({ timeout: 3000 }).catch(() => {});
}

try {
  await visit("/local-access");
  const initialize = page.getByTestId("button-initialize-manager");
  await clickIfVisible(initialize);
  await page.getByTestId("form-local-login").waitFor({ state: "visible", timeout: 5000 });
  await page.getByTestId("input-local-email").fill(currentManagerEmail);
  await page.getByTestId("input-local-password").fill(currentManagerPassword);
  await page.getByTestId("button-local-login").click();
  await page.waitForURL(url => url.pathname === "/" || url.pathname === "", { timeout: 5000 });
  await page.waitForTimeout(220);
  const installManagerSession = target => target.addInitScript(() => {
    localStorage.setItem("local-active-user-id", "system-manager");
    localStorage.setItem("local-active-user-email", "aao818@gmail.com");
    localStorage.setItem("local-active-user-role", "مدير");
    sessionStorage.setItem("local-active-user-id", "system-manager");
  });
  await installManagerSession(context);
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="link-top-qr"]', { timeout: 5000 });

  await page.goto(`${baseUrl}/qr-generator`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('img[alt^="QR Code"]', { timeout: 5000 });
  const generatorCode = await page.locator('input').first().inputValue();
  assert.ok(generatorCode.startsWith("QR-"), "QR generator did not create an initial code");
  const generatorPrint = page.waitForEvent("popup");
  await page.getByRole("button", { name: "طباعة الكود" }).click();
  const printPage = await generatorPrint;
  await printPage.waitForLoadState("domcontentloaded");
  assert.ok((await printPage.locator("body").innerText()).includes(generatorCode), "QR print window did not contain the generated code");
  await printPage.close();

  await page.goto(`${baseUrl}/qr-center?autoCamera=0`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "فتح الكاميرا" }).click();
  await page.waitForSelector("video", { timeout: 5000 });
  await page.waitForTimeout(700);
  const cameraState = await page.locator("video").evaluate(video => ({ hasStream: Boolean(video.srcObject), readyState: video.readyState }));
  assert.ok(cameraState.hasStream || cameraState.readyState >= 1, "Camera preview did not open");
  await page.getByRole("button", { name: "إيقاف الكاميرا" }).click().catch(() => {});

  await page.getByTestId("link-top-qr").click();
  await page.waitForURL(url => url.pathname === "/qr-center" && url.searchParams.get("autoCamera") === "1", { timeout: 5000 });
  assert.ok((await page.locator("body").innerText()).includes("مركز مسح وربط QR"), "Top QR button did not open the scanner");
  await visit("/qr-center?autoCamera=0");
  await page.locator("input[placeholder*='امسح']").fill("NEW-EMP-BROWSER-1");
  await page.locator("select").selectOption("employees");
  await page.getByRole("link", { name: "إنشاء سجل جديد بالكود" }).click();
  await page.waitForURL(url => url.pathname === "/section/employees" && url.searchParams.get("new") === "1", { timeout: 5000 });
  const prefilledQr = await page.locator("input").evaluateAll((inputs, expected) => inputs.some(input => input.value === expected && input.getBoundingClientRect().width > 0 && input.getBoundingClientRect().height > 0), "NEW-EMP-BROWSER-1");
  assert.ok(prefilledQr, "New QR code was not prefilled in the employee form");
  await page.getByTestId("button-cancel-form").click();
  await visit("/");

  const homeModuleLinks = await page.locator('[data-testid^="link-home-module-"]').evaluateAll(elements => elements.map(element => element.getAttribute("href")).filter(Boolean));
  assert.ok(homeModuleLinks.length >= 8, `Expected all module cards, found ${homeModuleLinks.length}`);

  const internalLinks = await page.locator("a[href]").evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute("href")).filter(href => href?.startsWith("/") && href !== "/local-access"))]);
  assert.ok(internalLinks.length >= 40, `Expected the complete local navigation, found ${internalLinks.length} links`);

  for (const path of [...new Set([...homeModuleLinks, ...internalLinks])]) {
    const routePage = await context.newPage();
    await installManagerSession(routePage);
    routePage.on("console", message => {
      if (message.type() === "error") consoleErrors.push(`${path}: ${message.text()}`);
    });
    routePage.on("pageerror", error => pageErrors.push(`${path}: ${error.message}`));
    await visit(path, routePage);
    if (path.startsWith("/workspace/")) {
      assert.ok(await routePage.locator('[data-testid^="link-module-section-"]').count() > 0, `Workspace has no sections: ${path}`);
    }
    await routePage.close();
  }

  await visit("/section/contacts");
  await page.getByTestId("button-add-record").click();
  await page.getByTestId("button-cancel-form").click();
  await page.getByTestId("button-refresh-records").click();
  const exportPromise = page.waitForEvent("download");
  await page.getByTestId("button-export-section").click();
  await exportPromise;

  await visit("/section/attendance");
  await page.getByTestId("button-add-record").click();
  await page.getByRole("button", { name: "تحديد كل الأيام" }).click();
  await page.getByRole("button", { name: "مسح العلامات" }).click();
  await page.getByTestId("button-cancel-form").click();

  await visit("/section/users");
  await page.getByTestId("button-add-record").click();
  const roleOptions = await page.locator('[role="dialog"] select').evaluateAll(selects => selects.flatMap(select => [...select.options].map(option => option.textContent?.trim())));
  assert.ok(roleOptions.includes("مدير"), "Master manager cannot create a company-manager account");
  await page.getByTestId("button-cancel-form").click();
  const managerRow = page.locator('[data-testid="row-record-system-manager"]');
  assert.equal(await managerRow.count(), 1, "Fixed manager row is missing");
  assert.equal(await managerRow.getByTestId("button-edit-record-system-manager").isDisabled(), true, "Manager edit button is not locked");
  assert.equal(await managerRow.getByTestId("button-delete-record-system-manager").isDisabled(), true, "Manager delete button is not locked");

  await visit("/offline-settings");
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /تصدير نسخة كاملة/ }).click();
  await backupDownload;
  await page.getByRole("button", { name: /تحديث الفحص/ }).click();
  assert.ok((await page.locator("body").innerText()).includes("مخازن البيانات"));

  await visit("/reports");
  await clickIfVisible(page.getByRole("button", { name: /تحديث التقرير|تحديث/ }).first());
  await clickIfVisible(page.getByRole("button", { name: /تصدير/ }).first());
  await visit("/management-reports");
  await clickIfVisible(page.getByRole("button", { name: /تحديث/ }).first());
  await visit("/advanced-analytics");
  await clickIfVisible(page.getByRole("button", { name: /تحديث/ }).first());
  await visit("/aging-reports");
  await clickIfVisible(page.getByRole("button", { name: /تحديث/ }).first());
  await visit("/bank-reconciliation");
  const reconciliationInput = page.locator("input[type=number]").first();
  if (await reconciliationInput.count()) {
    await reconciliationInput.fill("0");
    await page.getByRole("button", { name: "حفظ المطابقة" }).click();
  }

  const dbAudit = await page.evaluate(async () => {
    const databases = indexedDB.databases ? await indexedDB.databases() : [];
    const database = databases.find(item => item.name === "abd-elaziz-omran-accounting");
    if (!database) return { name: null, stores: [], recordCount: 0 };
    const connection = await new Promise((resolve, reject) => {
      const request = indexedDB.open(database.name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores = [...connection.objectStoreNames];
    const recordCount = await Promise.all(stores.map(store => new Promise((resolve, reject) => {
      const request = connection.transaction(store, "readonly").objectStore(store).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }))).then(counts => counts.reduce((sum, count) => sum + count, 0));
    connection.close();
    return { name: database.name, stores, recordCount };
  });
  assert.equal(dbAudit.name, "abd-elaziz-omran-accounting", "IndexedDB database was not created");
  assert.ok(dbAudit.stores.length >= 100, `Expected the complete accounting schema, found ${dbAudit.stores.length} stores`);
  assert.ok(dbAudit.stores.includes("postingLinks") && dbAudit.stores.includes("auditLogs") && dbAudit.stores.includes("backups"), "Core relationship/audit/backup stores are missing");

  assert.equal(consoleErrors.length, 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
  assert.equal(pageErrors.length, 0, `Browser page errors: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ status: "PASS", routesChecked: [...new Set([...homeModuleLinks, ...internalLinks])].length, storesChecked: dbAudit.stores.length, recordsInDatabase: dbAudit.recordCount }));
} finally {
  await browser.close();
}
