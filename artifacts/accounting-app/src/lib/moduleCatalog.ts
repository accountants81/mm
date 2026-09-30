import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ClipboardCheck,
  FileChartColumn,
  FileCog,
  Landmark,
  LifeBuoy,
  Receipt,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { StoreName } from "./localDb";

export type ModuleSection = {
  label: string;
  description: string;
  store?: StoreName;
  path?: string;
};

export type ErpModule = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "cyan" | "violet" | "emerald" | "amber" | "blue" | "rose";
  sections: ModuleSection[];
};

export const erpModules: ErpModule[] = [
  { id: "finance", label: "المالية والمحاسبة", description: "الحسابات والقيود والأرصدة والضرائب", icon: Calculator, tone: "violet", sections: [
    { label: "لوحة المالية", description: "ملخص مالي سريع", path: "/reports?scope=finance" },
    { label: "شجرة الحسابات", description: "دليل الحسابات والأرصدة", store: "accounts" },
    { label: "القيود اليومية", description: "القيود والتسويات والإقفال", store: "journalEntries" },
    { label: "الأرصدة الافتتاحية", description: "أرصدة بداية الفترة", store: "openingBalances" },
    { label: "الضرائب والإقرارات", description: "ضريبة المبيعات والمشتريات", store: "taxReturns" },
    { label: "مراكز التكلفة", description: "الربحية والتوزيع", store: "costCenters" },
  ] },
  { id: "sales", label: "المبيعات والعملاء", description: "دورة البيع والتحصيل والذمم", icon: Receipt, tone: "cyan", sections: [
    { label: "المندوبون", description: "المناطق والعمولات والتحصيل", store: "salesRepresentatives" },
    { label: "الفواتير", description: "فواتير نقدية وآجلة", path: "/invoices" },
    { label: "نقطة البيع POS", description: "السلة والدفع وإغلاق الوردية", store: "posOrders" },
    { label: "التوصيل", description: "العناوين والمندوب وحالة التسليم", store: "deliveryOrders" },
    { label: "طاولات المطعم", description: "الإشغال والحجوزات والطلبات", store: "restaurantTables" },
    { label: "أوامر البيع", description: "طلبات العملاء والشحن", store: "salesOrders" },
    { label: "العملاء والذمم", description: "الأرصدة والتحصيل والأعمار", store: "contacts" },
    { label: "مرتجعات المبيعات", description: "الإشعارات الدائنة", store: "salesReturns" },
    { label: "عروض أسعار العملاء", description: "العروض والتحويل إلى فاتورة", store: "quotations" },
    { label: "سجل المكالمات", description: "مكالمات العملاء والموردين والمتابعة", store: "crmCalls" },
    { label: "الاجتماعات والمحاضر", description: "قرارات الاجتماعات والإجراءات التالية", store: "crmMeetings" },
    { label: "تقييم الأطراف", description: "تقييم موثق من واقع التعامل", store: "partyEvaluations" },
    { label: "الأقساط", description: "جداول السداد والمتأخرات", store: "installments" },
  ] },
  { id: "purchases", label: "المشتريات والموردون", description: "الشراء والاستلام والمدفوعات", icon: ClipboardCheck, tone: "amber", sections: [
    { label: "أوامر الشراء", description: "طلبات التوريد", store: "purchaseOrders" },
    { label: "أذون الاستلام", description: "استلام الأصناف والخدمات", store: "receivingReports" },
    { label: "موردو المشتريات", description: "الأرصدة وشروط السداد", path: "/module?store=contacts&view=suppliers" },
    { label: "مرتجعات المشتريات", description: "الإشعارات المدينة", store: "purchaseReturns" },
    { label: "طلبات عروض الموردين", description: "مقارنة عروض التوريد", store: "requestForQuotations" },
    { label: "أوامر الصرف", description: "اعتماد المدفوعات", store: "paymentOrders" },
  ] },
  { id: "inventory", label: "المخزون والإنتاج", description: "المخازن والأصناف والتصنيع", icon: Boxes, tone: "emerald", sections: [
    { label: "الأصناف والمخزون", description: "الكميات والتقييم والحدود", path: "/products" },
    { label: "حركات المخزون", description: "الوارد والصادر والتحويل", store: "inventoryMovements" },
    { label: "الجرد والفروقات", description: "الجرد الفعلي والدوري", store: "physicalInventory" },
    { label: "أوامر الإنتاج", description: "المواد والمنتج التام", store: "productionOrders" },
    { label: "تكاليف الإنتاج", description: "المواد والأجور والتكاليف", store: "productionCosts" },
    { label: "فحوص الجودة", description: "فحص المواد والمنتجات", store: "qualityInspections" },
    { label: "الإجراءات التصحيحية", description: "معالجة عدم المطابقة", store: "correctiveActions" },
    { label: "وحدات القياس", description: "الوحدات ومعاملات التحويل", store: "units" },
  ] },
  { id: "hr", label: "الموارد البشرية", description: "الموظفون والحضور والرواتب", icon: UsersRound, tone: "rose", sections: [
    { label: "الموظفون", description: "الملفات والعقود والحالة", store: "employees" },
    { label: "الحضور والإجازات", description: "الدوام والانصراف والإجازات", store: "attendance" },
    { label: "تقرير الحضور الشهري", description: "ملخص الموظف والتأخير والإضافي", path: "/attendance-report" },
    { label: "سياسات الحضور والورديات", description: "السماح والتأخير وإغلاق اليوم", store: "attendancePolicies" },
    { label: "العطلات والإجازات العامة", description: "الجمعة والسبت والعطلات المحددة", store: "holidays" },
    { label: "إجازات الموظفين", description: "إجازات فردية ومأموريات وغياب بعذر", store: "leaveRequests" },
    { label: "الرواتب", description: "الكشوف والخصومات والسلف", path: "/payroll" },
    { label: "المكافآت والخصومات", description: "المستحقات والتسويات", store: "employeeAdjustments" },
    { label: "تقييم الأداء", description: "تقييم الموظفين والإدارات", store: "performanceEvaluations" },
    { label: "خطط التطوير", description: "أهداف التحسين والمتابعة", store: "developmentPlans" },
  ] },
  { id: "treasury", label: "الخزينة والبنوك", description: "النقدية والتحويلات والمطابقة", icon: Landmark, tone: "blue", sections: [
    { label: "الحسابات النقدية", description: "الصناديق والبنوك", path: "/cash" },
    { label: "الحركات النقدية", description: "إيداع وسحب وتحويل", store: "cashTransactions" },
    { label: "مطابقة البنك", description: "الرصيد الدفتري وكشف البنك", path: "/bank-reconciliation" },
    { label: "الشيكات والأوراق التجارية", description: "الاستلام والصرف والاستحقاق", store: "cheques" },
  ] },
  { id: "assets", label: "الأصول والمشروعات", description: "الأصول والصيانة والمشروعات", icon: Archive, tone: "violet", sections: [
    { label: "الأصول والإهلاك", description: "القيمة والإهلاك والاستبعاد", store: "fixedAssets" },
    { label: "استلام وتسليم الأصول", description: "حيازة الأصل ومسؤوليته", store: "assetCheckIns" },
    { label: "الصيانة", description: "أوامر الصيانة والتكلفة", store: "maintenanceOrders" },
    { label: "المشروعات", description: "العقود والتكلفة والإنجاز", store: "projects" },
    { label: "المخاطر وخطط التخفيف", description: "تقييم المخاطر والمتابعة", store: "risks" },
    { label: "الامتثال القانوني", description: "المتطلبات والتراخيص", store: "complianceRequirements" },
  ] },
  { id: "reports", label: "التقارير والتحليل", description: "قرارات مبنية على بيانات مترابطة", icon: FileChartColumn, tone: "cyan", sections: [
    { label: "القوائم المالية والميزانية", description: "المركز المالي والدخل والتدفقات", path: "/financial-statements" },
    { label: "الميزانية السنوية الشهرية", description: "توزيع البنود ومقارنة الفعلي", path: "/annual-budget" },
    { label: "التقارير المالية المتقدمة", description: "ميزان المراجعة والأعمار والانحرافات", path: "/advanced-financial-reports" },
    { label: "تدقيق العلاقات والترحيل", description: "كشف الروابط اليتيمة والأكواد غير المحلولة", path: "/relation-audit" },
    { label: "المستكشف الشهري", description: "كل قسم حسب الشهر والتصدير", path: "/monthly-explorer" },
    { label: "التقارير المالية", description: "الأستاذ والميزانية والدخل", path: "/reports" },
    { label: "التقارير الإدارية", description: "المبيعات والمشتريات والتدفق", path: "/management-reports" },
    { label: "مركز التحليل", description: "الربحية والسيولة والمؤشرات", path: "/advanced-analytics" },
    { label: "أعمار الذمم", description: "أعمار العملاء والموردين", path: "/aging-reports" },
    { label: "مركز الترحيل", description: "أثر كل مستند وعكسه", path: "/posting-center" },
    { label: "مركز المستندات وPDF", description: "طباعة الفواتير والميزانيات والإقرارات", path: "/documents-center" },
    { label: "تقارير مخصصة", description: "قوالب ومحاور قابلة للتخصيص", store: "customReports" },
  ] },
  { id: "admin", label: "الإدارة والأمن", description: "الفروع والإعدادات والصلاحيات", icon: ShieldCheck, tone: "rose", sections: [
    { label: "بيانات المنشأة", description: "الهوية القانونية والضريبية", store: "companyProfile" },
    { label: "الفترات المالية", description: "الفتح والإقفال ومنع التعديل", store: "financialPeriods" },
    { label: "الفروع والإعدادات", description: "بيانات الشركة والفروع", store: "branches" },
    { label: "المستخدمون والصلاحيات", description: "الأدوار والجلسات", store: "users" },
    { label: "إقفال الفترات", description: "اعتماد ومنع التعديل", path: "/period-locks" },
    { label: "سجل التدقيق", description: "كل عمليات الإضافة والتعديل والحذف", store: "auditLogs" },
    { label: "الشكاوى", description: "المتابعة والإجراءات التصحيحية", store: "complaints" },
    { label: "النسخ الاحتياطي", description: "حفظ واسترجاع البيانات المحلية", path: "/offline-settings" },
  ] },
  { id: "operations", label: "التشغيل والدعم", description: "المهام والتنبيهات والمستندات", icon: LifeBuoy, tone: "emerald", sections: [
    { label: "التنبيهات", description: "استحقاقات ومخزون منخفض", store: "alerts" },
    { label: "المهمات والمتابعة", description: "مسؤوليات ومواعيد", store: "tasks" },
    { label: "المستندات والمرفقات", description: "مستندات مرتبطة بالسجلات", store: "attachments" },
    { label: "استهلاك الطاقة", description: "الكهرباء والماء والغاز والتكلفة", store: "energyConsumption" },
    { label: "الاستدامة والمبادرات البيئية", description: "الأثر الكربوني وخطط التحسين", store: "environmentalInitiatives" },
    { label: "الدعم الفني", description: "التذاكر والأسئلة الشائعة", store: "supportTickets" },
    { label: "الإعدادات المتقدمة", description: "تكاملات وتحديثات وأمان", store: "settings" },
  ] },
];

export const sidebarModules = erpModules;

export function modulePath(section: ModuleSection) {
  return section.path ?? `/section/${section.store}`;
}

export function getModule(id: string) {
  return erpModules.find((module) => module.id === id);
}

export const catalogStoreNames = new Set(
  erpModules.flatMap((module) => module.sections.map((section) => section.store).filter(Boolean)),
);

export const catalogIcons = { Building2, BriefcaseBusiness, FileCog, WalletCards };
