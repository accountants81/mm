import React from "react";
import LocalLink from "@/components/LocalLink";
import { Activity, AlertTriangle, BarChart3, ChevronRight, Gauge, Sparkles } from "lucide-react";
import { localList, type LocalRecord } from "@/lib/localDb";

const toneClasses = {
  cyan: "bg-cyan-300/10 text-cyan-200",
  emerald: "bg-emerald-300/10 text-emerald-200",
  violet: "bg-violet-300/10 text-violet-200",
  amber: "bg-amber-300/10 text-amber-200",
} as const;

type AnalyticsTone = keyof typeof toneClasses;
type AnalyticsState = { data: Record<string, LocalRecord[]> };

export default class AdvancedAnalytics extends React.Component<Record<string, never>, AnalyticsState> {
  state: AnalyticsState = { data: {} };

  componentDidMount() {
    void Promise.all(
      ["invoices", "expenses", "revenues", "products", "fixedAssets", "cashTransactions", "alerts", "tasks", "aiInsights"].map(async store => [store, await localList<LocalRecord>(store as never)] as const),
    ).then(entries => this.setState({ data: Object.fromEntries(entries) }));
  }

  render() {
    const { data } = this.state;
    const invoices = data.invoices ?? [], expenses = data.expenses ?? [], revenues = data.revenues ?? [], cash = data.cashTransactions ?? [];
    const revenue = revenues.reduce((sum, row) => sum + Number(row.amount ?? row.total ?? 0), 0) + invoices.filter(row => row.invoiceType === "مبيعات").reduce((sum, row) => sum + Number(row.total ?? 0), 0);
    const expense = expenses.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const inflow = cash.filter(row => String(row.direction).includes("قبض")).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const outflow = cash.filter(row => String(row.direction).includes("صرف")).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const inventory = (data.products ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0) * Number(row.purchasePrice ?? 0), 0);
    const assets = (data.fixedAssets ?? []).reduce((sum, row) => sum + Number(row.value ?? 0), 0);
    const metrics = { revenue, expense, net: revenue - expense, cash: inflow - outflow, inventory, assets };
    const cards = [
      { label: "صافي الربح التقديري", value: metrics.net, icon: Gauge, tone: "cyan" },
      { label: "صافي التدفق المرحّل", value: metrics.cash, icon: Activity, tone: "emerald" },
      { label: "قيمة المخزون", value: metrics.inventory, icon: BarChart3, tone: "violet" },
      { label: "قيمة الأصول", value: metrics.assets, icon: Sparkles, tone: "amber" },
    ];
    return <div dir="rtl" className="accounting-shell min-h-screen px-4 py-6 text-slate-100 lg:px-8"><div className="mx-auto max-w-7xl space-y-6"><header className="accounting-glass rounded-3xl p-6"><LocalLink href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-cyan-300"><ChevronRight className="h-4 w-4" /> العودة للوحة التحكم</LocalLink><div className="flex items-center gap-3"><div className="rounded-2xl bg-cyan-300/10 p-3 text-cyan-200"><Sparkles className="h-7 w-7" /></div><div><p className="text-sm font-semibold text-cyan-200">مركز القرار</p><h1 className="text-3xl font-black">التحليل المالي المتقدم ومؤشرات الأداء</h1></div></div><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">ملخص محلي يقرأ الفواتير والمصروفات والإيرادات والحركات المرحّلة والمخزون والأصول لتكوين صورة تشغيلية قابلة للمراجعة.</p></header><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="accounting-card rounded-2xl border border-white/10 bg-white/[0.045] p-5"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${toneClasses[tone as AnalyticsTone]}`}><Icon className="h-5 w-5" /></div><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-white">{value.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</p></div>)}</div><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="accounting-glass rounded-3xl p-5"><h2 className="mb-4 font-bold">قراءة المؤشرات</h2><div className="space-y-4"><Ratio label="هامش الربح الصافي" value={revenue > 0 ? metrics.net / revenue * 100 : 0} suffix="%" /><Ratio label="نسبة المصروفات إلى الإيرادات" value={revenue > 0 ? expense / revenue * 100 : 0} suffix="%" /><Ratio label="التدفق إلى الإيراد" value={revenue > 0 ? metrics.cash / revenue * 100 : 0} suffix="%" /></div></section><section className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-amber-200" /><h2 className="font-bold text-amber-100">المتابعة والتنبيهات</h2></div><p className="mt-4 text-sm text-slate-300">{(data.alerts ?? []).length} تنبيهًا مسجلًا، و{(data.tasks ?? []).length} مهمة متابعة، و{(data.aiInsights ?? []).length} نتيجة تحليل ذكي محلية.</p><div className="mt-5 flex flex-wrap gap-2"><LocalLink href="/module?store=alerts" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-amber-100 hover:bg-white/15">التنبيهات</LocalLink><LocalLink href="/module?store=tasks" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-amber-100 hover:bg-white/15">المهمات</LocalLink><LocalLink href="/module?store=aiInsights" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-amber-100 hover:bg-white/15">التحليل الذكي</LocalLink></div></section></div></div></div>;
  }
}

function Ratio({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  const safe = Number.isFinite(value) ? value : 0;
  return <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-300">{label}</span><strong className="text-cyan-200">{safe.toLocaleString("ar-EG", { maximumFractionDigits: 2 })}{suffix}</strong></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-l from-cyan-300 to-violet-400" style={{ width: `${Math.min(100, Math.max(0, safe))}%` }} /></div></div>;
}
