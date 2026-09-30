import { describe, expect, it } from "vitest";
import { canManageUsers, getActiveLocalRole, hashLocalPassword, isManagerIdentity, MANAGER_EMAIL, MANAGER_PASSWORD_HASH } from "./localPermissions";

function installStorage(values: Record<string, string>) {
  const makeStore = () => ({
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = value; },
    removeItem: (key: string) => { delete values[key]; },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: makeStore() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: makeStore() });
}

describe("local manager identity", () => {
  it("accepts only the fixed manager identity", () => {
    expect(isManagerIdentity("system-manager", MANAGER_EMAIL, "مدير")).toBe(true);
    expect(isManagerIdentity("another-id", MANAGER_EMAIL, "مدير")).toBe(false);
    expect(isManagerIdentity("system-manager", "other@example.com", "مدير")).toBe(false);
    expect(isManagerIdentity("system-manager", MANAGER_EMAIL, "مشرف")).toBe(false);
  });

  it("keeps the configured manager password hash consistent", async () => {
    await expect(hashLocalPassword("AAO818")).resolves.toBe(MANAGER_PASSWORD_HASH);
  });

  it("rejects a forged manager session and accepts only the fixed session", () => {
    installStorage({
      "local-active-user-id": "forged-user",
      "local-active-user-email": MANAGER_EMAIL.toLowerCase(),
      "local-active-role": "مدير",
    });
    Object.assign(globalThis.sessionStorage, { getItem: (key: string) => key === "local-active-user-id" ? "forged-user" : null });
    expect(getActiveLocalRole()).toBe("محاسب");
    expect(canManageUsers()).toBe(false);

    installStorage({
      "local-active-user-id": "system-manager",
      "local-active-user-email": MANAGER_EMAIL.toLowerCase(),
      "local-active-role": "مدير",
    });
    Object.assign(globalThis.sessionStorage, { getItem: (key: string) => key === "local-active-user-id" ? "system-manager" : null });
    expect(getActiveLocalRole()).toBe("مدير");
    expect(canManageUsers()).toBe(true);
  });
});
