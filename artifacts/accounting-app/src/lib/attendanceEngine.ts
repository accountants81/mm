import { localList, localPut, type LocalRecord } from "./localDb";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const isoDay = (date: string) => DAY_NAMES[new Date(`${date}T12:00:00`).getDay()];
const minutes = (value: unknown) => { const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "")); return match ? Number(match[1]) * 60 + Number(match[2]) : 0; };
const diffMinutes = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 60000);

export type AttendanceSummary = { employeeId: string; employeeName: string; workDays: number; presentDays: number; absentDays: number; weeklyOffDays: number; holidayDays: number; leaveDays: number; lateDays: number; lateMinutes: number; earlyDays: number; earlyMinutes: number; overtimeMinutes: number; incompleteDays: number; manualDays: number; qrDays: number };

export async function getAttendancePolicy() {
  const policies = await localList<LocalRecord>("attendancePolicies");
  const row = policies[0];
  return { startTime: String(row?.startTime ?? "08:00"), endTime: String(row?.endTime ?? "16:00"), graceMinutes: Number(row?.graceMinutes ?? 15), minimumCheckoutMinutes: Number(row?.minimumCheckoutMinutes ?? 60), overtimeAfterMinutes: Number(row?.overtimeAfterMinutes ?? 0), weeklyDaysOff: String(row?.weeklyDaysOff ?? "الجمعة، السبت") };
}

async function dayClassification(date: string, employee: LocalRecord, currentPolicy: Awaited<ReturnType<typeof getAttendancePolicy>>) {
  const holidays = await localList<LocalRecord>("holidays");
  const leaves = await localList<LocalRecord>("leaveRequests");
  const weekday = isoDay(date);
  const weekly = currentPolicy.weeklyDaysOff.split(/[،,]/).map((item) => item.trim()).includes(weekday);
  const holiday = holidays.some((row) => { const start = String(row.startDate ?? ""); const end = String(row.endDate ?? start); const inRange = start && date >= start && date <= end; return inRange && (row.holidayType !== "إجازة أسبوعية" || row.weekDay === weekday) && (!row.scope || row.scope === "كل المنشأة" || String(row.employeeNumber ?? "") === String(employee.employeeNumber ?? "")); });
  const leave = leaves.some((row) => { const start = String(row.startDate ?? ""); const end = String(row.endDate ?? start); return String(row.employeeNumber ?? "") === String(employee.employeeNumber ?? employee.id) && row.status === "معتمدة" && start && date >= start && date <= end; });
  return { weekly, holiday, leave };
}

export async function closeAttendanceDay(date: string) {
  const currentPolicy = await getAttendancePolicy();
  const employees = (await localList<LocalRecord>("employees")).filter((employee) => String(employee.status ?? "على رأس العمل") === "على رأس العمل");
  const events = await localList<LocalRecord>("attendanceEvents");
  const existing = await localList<LocalRecord>("attendanceDaily");
  const results: LocalRecord[] = [];
  for (const employee of employees) {
    const classification = await dayClassification(date, employee, currentPolicy);
    const event = events.find((item) => item.employeeId === employee.id && item.date === date);
    const checkIn = event?.checkInAt ? String(event.checkInAt) : "";
    const checkOut = event?.checkOutAt ? String(event.checkOutAt) : "";
    const start = minutes(currentPolicy.startTime);
    const end = minutes(currentPolicy.endTime);
    const checkInClock = checkIn ? new Date(checkIn).getHours() * 60 + new Date(checkIn).getMinutes() : 0;
    const checkOutClock = checkOut ? new Date(checkOut).getHours() * 60 + new Date(checkOut).getMinutes() : 0;
    const status = classification.leave ? "إجازة موظف" : classification.holiday ? "عطلة عامة" : classification.weekly ? "إجازة أسبوعية" : checkIn ? (checkOut ? "حاضر" : "حاضر بدون انصراف") : "غياب تلقائي";
    const record = { id: `daily-${employee.id}-${date}`, date, employeeId: employee.id, employeeNumber: employee.employeeNumber ?? employee.code, employeeName: employee.name ?? employee.label, status, checkInAt: checkIn || "", checkOutAt: checkOut || "", lateMinutes: checkIn && !classification.weekly && !classification.holiday && !classification.leave ? Math.max(0, checkInClock - start - currentPolicy.graceMinutes) : 0, earlyMinutes: checkOut ? Math.max(0, end - checkOutClock) : 0, overtimeMinutes: checkOut ? Math.max(0, checkOutClock - end - currentPolicy.overtimeAfterMinutes) : 0, source: event?.source ?? "auto", closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    results.push(record);
    await localPut("attendanceDaily", record);
  }
  await localPut("attendanceClosures", { id: `closure-${date}`, date, employeeCount: employees.length, closedAt: new Date().toISOString(), status: "مغلق", updatedAt: new Date().toISOString() });
  return { date, count: results.length, results, wasReclosed: existing.some((row) => row.id === `closure-${date}`) };
}

export async function summarizeEmployeeMonth(employee: LocalRecord, month: string): Promise<AttendanceSummary> {
  const rows = (await localList<LocalRecord>("attendanceDaily")).filter((row) => row.employeeId === employee.id && String(row.date).startsWith(month));
  const summary: AttendanceSummary = { employeeId: employee.id, employeeName: String(employee.name ?? employee.label ?? ""), workDays: 0, presentDays: 0, absentDays: 0, weeklyOffDays: 0, holidayDays: 0, leaveDays: 0, lateDays: 0, lateMinutes: 0, earlyDays: 0, earlyMinutes: 0, overtimeMinutes: 0, incompleteDays: 0, manualDays: 0, qrDays: 0 };
  for (const row of rows) { const status = String(row.status); if (status === "إجازة أسبوعية") summary.weeklyOffDays++; else if (status === "عطلة عامة") summary.holidayDays++; else if (status === "إجازة موظف") summary.leaveDays++; else { summary.workDays++; if (status.startsWith("حاضر")) summary.presentDays++; if (status === "غياب تلقائي") summary.absentDays++; } const late = Number(row.lateMinutes ?? 0); const early = Number(row.earlyMinutes ?? 0); summary.lateMinutes += late; summary.earlyMinutes += early; summary.overtimeMinutes += Number(row.overtimeMinutes ?? 0); if (late > 0) summary.lateDays++; if (early > 0) summary.earlyDays++; if (status === "حاضر بدون انصراف") summary.incompleteDays++; if (row.source === "manual") summary.manualDays++; if (row.source === "qr") summary.qrDays++; }
  return summary;
}
