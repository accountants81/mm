import { useEffect, type ReactNode } from "react";
import NotFound from "@/pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "@/pages/Home";
import Module from "@/pages/Module";
import About from "@/pages/About";
import OfflineSettings from "@/pages/OfflineSettings";
import Reports from "@/pages/Reports";
import ReportDetails from "@/pages/ReportDetails";
import ExcelSheets from "@/pages/ExcelSheets";
import ManagementReports from "@/pages/ManagementReports";
import LocalAccess from "@/pages/LocalAccess";
import PostingCenter from "@/pages/PostingCenter";
import PeriodLocks from "@/pages/PeriodLocks";
import AgingReports from "@/pages/AgingReports";
import BankReconciliation from "@/pages/BankReconciliation";
import AdvancedAnalytics from "@/pages/AdvancedAnalytics";
import DocumentsCenter from "@/pages/DocumentsCenter";
import SystemHealth from "@/pages/SystemHealth";
import ModuleWorkspace from "@/pages/ModuleWorkspace";
import QrCenter from "@/pages/QrCenter";
import AttendanceReport from "@/pages/AttendanceReport";
import QrManagement from "@/pages/QrManagement";
import QrGenerator from "@/pages/QrGenerator";
import FinancialStatements from "@/pages/FinancialStatements";
import MonthlyExplorer from "@/pages/MonthlyExplorer";
import AdvancedFinancialReports from "@/pages/AdvancedFinancialReports";
import RelationAudit from "@/pages/RelationAudit";
import NotificationsCenter from "@/pages/NotificationsCenter";
import AnnualBudget from "@/pages/AnnualBudget";
import GeneralLedger from "@/pages/GeneralLedger";
import AppTopBar from "@/components/AppTopBar";
import { canManageUsers } from "@/lib/localPermissions";
import { runAutoBackup, shouldRunAutoBackup } from "@/lib/autoBackup";

function hasLocalSession() {
  if (typeof window === "undefined") return false;
  const localId = localStorage.getItem("local-active-user-id");
  const sessionId = sessionStorage.getItem("local-active-user-id");
  const email = localStorage.getItem("local-active-user-email");
  return Boolean(localId && sessionId && email && localId === sessionId);
}

const legacyStoreByPath: Record<string, string> = {
  "/contacts": "contacts",
  "/products": "products",
  "/cash": "cashAccounts",
  "/assets": "fixedAssets",
  "/payroll": "payroll",
  "/expenses": "expenses",
  "/revenues": "revenues",
};

function withTopBar(page: ReactNode, title: string) {
  return <><AppTopBar title={title} />{page}</>;
}

function Router() {
  const path = window.location.pathname;
  if (path === "/local-access") return <LocalAccess />;
  if (!hasLocalSession()) return <LocalAccess />;
  if (path === "/qr-center") return <QrCenter />;
  if (path === "/qr-generator") return <QrGenerator />;
  if (path === "/attendance-report") return <AttendanceReport />;
  if (path === "/qr-management") return canManageUsers() ? <QrManagement /> : <Home />;
  if (path === "/financial-statements") return <FinancialStatements />;
  if (path === "/monthly-explorer") return <MonthlyExplorer />;
  if (path === "/advanced-financial-reports") return <AdvancedFinancialReports />;
  if (path === "/relation-audit") return <RelationAudit />;
  if (path === "/annual-budget") return <AnnualBudget />;
  if (path === "/general-ledger") return <GeneralLedger />;
  if (path === "/notifications") return withTopBar(<NotificationsCenter />, "مركز الإشعارات");
  if (path === "/") return <Home />;
  if (path === "/about") return withTopBar(<About />, "عن النظام والخدمات");
  if (path === "/offline-settings") return withTopBar(<OfflineSettings />, "التخزين المحلي والنسخ الاحتياطي");
  if (path === "/system-health") return withTopBar(<SystemHealth />, "صحة النظام والبيانات");
  if (path === "/reports") return withTopBar(<Reports />, "التقارير المالية");
  if (path === "/report-details") return withTopBar(<ReportDetails />, "تفاصيل التقرير");
  if (path === "/excel-sheets") return withTopBar(<ExcelSheets />, "ملفات Excel");
  if (path === "/management-reports") return withTopBar(<ManagementReports />, "التقارير الإدارية");
  if (path === "/posting-center") return withTopBar(<PostingCenter />, "مركز الترحيل");
  if (path === "/period-locks") return withTopBar(<PeriodLocks />, "إقفال الفترات");
  if (path === "/aging-reports") return withTopBar(<AgingReports />, "أعمار الذمم");
  if (path === "/bank-reconciliation") return withTopBar(<BankReconciliation />, "مطابقة البنك");
  if (path === "/advanced-analytics") return withTopBar(<AdvancedAnalytics />, "التحليل المالي");
  if (path === "/documents-center") return withTopBar(<DocumentsCenter />, "مركز المستندات");
  if (path.startsWith("/workspace/")) return <ModuleWorkspace params={{ id: decodeURIComponent(path.split("/").filter(Boolean).at(-1) ?? "") }} />;
  if (path.startsWith("/section/")) {
    const store = decodeURIComponent(path.split("/").filter(Boolean).at(-1) ?? "");
    if (store === "users" && !canManageUsers()) return <Home />;
    if (store === "auditLogs" && !canManageUsers()) return <Home />;
    return <Module params={{ store }} />;
  }
  // Keep the legacy URLs, but route them through the shared CRUD surface so
  // the core accounting sections all have the same complete form and actions.
  if (["/accounts", "/journal", "/invoices"].includes(path)) return <Module />;
  if (path === "/module") return <Module />;
  if (legacyStoreByPath[path]) return <Module params={{ store: legacyStoreByPath[path] }} />;
  return <NotFound />;
}

export default function App() {
  useEffect(() => { if (!hasLocalSession() || !shouldRunAutoBackup()) return; const password = window.prompt("حان موعد النسخة الشهرية. أدخل كلمة مرور تشفير النسخة:"); if (password) void runAutoBackup(password).catch(error => window.alert(error instanceof Error ? error.message : "تعذر إنشاء النسخة التلقائية")); }, []);
  return <ErrorBoundary><Router /></ErrorBoundary>;
}
