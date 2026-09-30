import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localDelete, localList, localPut } from "./localDb";
import { findQrLink, linkQrCode, processEmployeeQr, resolveQrTarget } from "./qr";

const employee = { id: "employee-qr-test", targetStore: "employees", targetId: "employee-qr-test", targetLabel: "موظف QR", qrCode: "EMP-QR-1", status: "active" as const };

describe("QR employee attendance flow", () => {
  beforeEach(async () => {
    await localDelete("employees", employee.id);
    await localDelete("qrLinks", "qr-employee-qr-test");
    await localDelete("attendanceEvents", `attendance-${employee.targetId}-2026-01-15`);
    await localDelete("attendancePolicies", "policy-qr-test");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T08:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("links and resolves an employee code without changing the employee record", async () => {
    await localPut("employees", { id: employee.id, code: "EMP-QR-1", employeeNumber: "EMP-QR-1", name: employee.targetLabel });
    await linkQrCode(employee);
    await expect(findQrLink("emp-qr-1")).resolves.toMatchObject({ targetId: employee.id });
    await expect(resolveQrTarget("EMP-QR-1")).resolves.toMatchObject({ targetStore: "employees", targetId: employee.id });
  });

  it("records check-in, respects the minimum checkout policy, then closes and blocks a third scan", async () => {
    await localPut("attendancePolicies", { id: "policy-qr-test", minimumCheckoutMinutes: 90 });
    await expect(processEmployeeQr(employee.qrCode, employee)).resolves.toMatchObject({ status: "open", source: "qr" });
    vi.setSystemTime(new Date("2026-01-15T09:00:00"));
    await expect(processEmployeeQr(employee.qrCode, employee)).rejects.toThrow("90 دقيقة");
    vi.setSystemTime(new Date("2026-01-15T10:00:00"));
    await expect(processEmployeeQr(employee.qrCode, employee)).resolves.toMatchObject({ status: "closed", source: "qr" });
    await expect(processEmployeeQr(employee.qrCode, employee)).rejects.toThrow("الحضور والانصراف");
    await expect(localList("attendanceEvents")).resolves.toHaveLength(1);
  });
});