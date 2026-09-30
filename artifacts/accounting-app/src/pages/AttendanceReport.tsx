import { useEffect, useState } from "react";
import AppTopBar from "@/components/AppTopBar";
import LocalLink from "@/components/LocalLink";
import { localList, type LocalRecord } from "@/lib/localDb";
import { summarizeEmployeeMonth, type AttendanceSummary } from "@/lib/attendanceEngine";

const currentMonth = new Date().toISOString().slice(0, 7);
const empty: AttendanceSummary = { employeeId: "", employeeName: "", workDays: 0, presentDays: 0, absentDays: 0, weeklyOffDays: 0, holidayDays: 0, leaveDays: 0, lateDays: 0, lateMinutes: 0, earlyDays: 0, earlyMinutes: 0, overtimeMinutes: 0, incompleteDays: 0, manualDays: 0, qrDays: 0 };
const cards: [keyof AttendanceSummary, string][] = [["presentDays", "أيام الحضور"], ["absentDays", "أيام الغياب"], ["lateDays", "أيام التأخير"], ["lateMinutes", "دقائق التأخير"], ["earlyMinutes", "دقائق الحضور المبكر/الانصراف"], ["overtimeMinutes", "دقائق الإضافي"], ["weeklyOffDays", "الإجازة الأسبوعية"], ["holidayDays", "العطلات العامة"], ["leaveDays", "إجازات الموظف"], ["incompleteDays", "بدون انصراف"], ["manualDays", "حركات يدوية"], ["qrDays", "حركات QR"]];

export default function AttendanceReport() {
  const [employees, setEmployees] = useState<LocalRecord[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<AttendanceSummary>(empty);
  const [status, setStatus] = useState("");
  useEffect(() => { void localList<LocalRecord>("employees").then((rows) => { setEmployees(rows); if (rows[0]) setEmployeeId(rows[0].id); }); }, []);
  useEffect(() => { const employee = employees.find((row) => row.id === employeeId); if (employee) void summarizeEmployeeMonth(employee, month).then(setSummary); }, [employees, employeeId, month]);
  const employee = employees.find((row) => row.id === employeeId);
  return <div dir="rtl" className="accounting-shell min-h-screen text-slate-100"><AppTopBar title="تقرير الحضور الشهري" /><main className="mx-auto max-w-6xl px-4 py-8 lg:px-8"><div className="rounded-3xl border border-white/10 bg-white/[.035] p-6 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-red-300">تقرير HR قابل للمراجعة</p><h1 className="mt-2 text-3xl font-black text-white">تقرير الحضور الشهري</h1><p className="mt-2 text-sm leading-6 text-slate-400">يعرض الحضور والغياب والإجازات والتأخير والإضافي مع تمييز الحركات اليدوية عن QR.</p></div><LocalLink href="/section/attendance" className="rounded-xl border border-red-300/30 px-4 py-2 text-sm font-bold text-red-100">فتح شاشة الحضور اليدوي</LocalLink></div><div className="mt-7 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-300">الموظف<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white"><option value="">اختر موظفًا</option>{employees.map((row) => <option key={row.id} value={row.id}>{String(row.name ?? row.label ?? row.employeeNumber ?? row.id)}</option>)}</select></label><label className="text-sm font-bold text-slate-300">الشهر<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white" /></label></div>{employee && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/[.06] p-4"><p className="font-bold text-red-100">{summary.employeeName || String(employee.name ?? "الموظف")}</p><p className="mt-1 text-xs text-slate-400">فترة التقرير: {month} — أيام العمل المحتسبة: {summary.workDays}</p></div>}<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([key, label]) => <div key={key} className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-white">{summary[key]}</p></div>)}</div>{status && <p className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{status}</p>}</div></main></div>;
}
