import { FileText, Printer, ReceiptText } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import LocalLink from "@/components/LocalLink";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import type { LocalRecord } from "@/lib/localDb";

export default function Invoices() {
  const [invoices, setInvoices] = useState<LocalRecord[]>([]);
  const [customer, setCustomer] = useState("");
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [message, setMessage] = useState("");
  const refresh = async () => setInvoices(await localAccountingRepository.list("invoices"));
  useEffect(() => { void refresh(); }, []);
  const total = Number(quantity || 0) * Number(unitPrice || 0);
  const addInvoice = async (event: FormEvent) => {
    event.preventDefault();
    if (!customer.trim() || !item.trim() || total <= 0) return;
    await localAccountingRepository.save("invoices", { id: `invoice-${Date.now()}`, code: `INV-${Date.now()}`, name: `فاتورة بيع ${customer.trim()}`, invoiceType: "مبيعات", party: customer.trim(), customer: customer.trim(), item: item.trim(), product: item.trim(), quantity, unitPrice, subtotal: total.toFixed(2), total: total.toFixed(2), paid: total.toFixed(2), paymentMethod: "خزينة", collectionMethod: "خزينة", status: "مدفوعة", updatedAt: new Date().toISOString() });
    setCustomer(""); setItem(""); setQuantity("1"); setUnitPrice(""); setMessage("تم حفظ الفاتورة محليًا."); await refresh();
  };
  const exportInvoices = () => {
    const blob = new Blob([JSON.stringify(invoices, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "invoices.json"; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div dir="rtl" className="min-h-screen bg-[#07111f] px-4 py-8 text-slate-100 lg:px-10"><div className="mx-auto max-w-6xl"><div className="flex items-center justify-between"><LocalLink href="/" className="text-sm text-cyan-300">العودة للوحة التحكم</LocalLink><div className="flex flex-wrap gap-2"><LocalLink href="/module?store=invoices" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-200">فتح النموذج الشامل</LocalLink><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"><Printer className="h-4 w-4" /> طباعة</button><button onClick={exportInvoices} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300">تصدير JSON</button></div></div><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]"><section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><p className="text-sm font-semibold text-cyan-300">فاتورة بيع محلية</p><h1 className="mt-2 text-3xl font-black text-white">إنشاء فاتورة</h1><form onSubmit={addInvoice} className="mt-6 space-y-3"><input required value={customer} onChange={event => setCustomer(event.target.value)} placeholder="اسم العميل" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white" /><input required value={item} onChange={event => setItem(event.target.value)} placeholder="الصنف أو الخدمة" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white" /><div className="grid grid-cols-2 gap-3"><input required type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="الكمية" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white" /><input required type="number" min="0" step="0.01" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} placeholder="سعر الوحدة" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white" /></div><div className="rounded-xl bg-cyan-300/10 p-4 text-center text-lg font-black text-cyan-200">الإجمالي: {total.toFixed(2)}</div><button className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950">حفظ الفاتورة محليًا</button></form>{message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}</section><section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="flex items-center gap-3"><ReceiptText className="h-7 w-7 text-violet-300" /><div><h2 className="text-xl font-bold text-white">الفواتير المحفوظة</h2><p className="text-sm text-slate-400">{invoices.length} فاتورة محلية</p></div></div><div className="mt-6 space-y-3">{invoices.map(invoice => <article key={invoice.id} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">{String(invoice.name)}</h3><FileText className="h-5 w-5 text-cyan-300" /></div><p className="mt-2 text-sm text-slate-400">العميل: {String(invoice.customer)} — الصنف: {String(invoice.item)}</p><p className="mt-3 text-lg font-black text-cyan-200">{String(invoice.total)}</p></article>)}</div></section></div></div></div>;
}
