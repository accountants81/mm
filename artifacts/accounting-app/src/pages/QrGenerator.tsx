import QRCode from "qrcode";
import { CheckCircle2, Link2, Printer, RefreshCw, ScanLine, Sparkles, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppTopBar from "@/components/AppTopBar";
import LocalLink from "@/components/LocalLink";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import { type LocalRecord, type StoreName } from "@/lib/localDb";
import { sectionDefinitions, storeOrder } from "@/lib/accountingFieldDefinitions";
import { linkQrCode } from "@/lib/qr";

function makeCode() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(2, 14);
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `QR-${stamp}-${random}`;
}

function recordLabel(record: LocalRecord) {
  return String(record.name ?? record.label ?? record.description ?? record.code ?? record.id ?? "سجل");
}

export default function QrGenerator() {
  const [code, setCode] = useState(() => makeCode());
  const [targetStore, setTargetStore] = useState<StoreName>("products");
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [recordId, setRecordId] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [label, setLabel] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);

  const filteredRecords = useMemo(() => {
    const term = recordSearch.trim().toLowerCase();
    if (!term) return records.slice(0, 100);
    return records.filter(record => Object.values(record).some(value => String(value ?? "").toLowerCase().includes(term))).slice(0, 100);
  }, [records, recordSearch]);
  const selectedRecord = records.find(record => record.id === recordId);
  const selectedLabel = label.trim() || (selectedRecord ? recordLabel(selectedRecord) : "كود QR جديد");

  useEffect(() => {
    let active = true;
    setLoadingRecords(true);
    setRecordId("");
    setRecordSearch("");
    void localAccountingRepository.list(targetStore)
      .then(rows => { if (active) setRecords(rows); })
      .catch(() => { if (active) setRecords([]); })
      .finally(() => { if (active) setLoadingRecords(false); });
    return () => { active = false; };
  }, [targetStore]);

  useEffect(() => {
    if (!code.trim()) {
      setQrImage("");
      return;
    }
    let active = true;
    void QRCode.toDataURL(code.trim(), { errorCorrectionLevel: "M", width: 360, margin: 2, color: { dark: "#181315", light: "#fffaf4" } })
      .then(dataUrl => { if (active) setQrImage(dataUrl); })
      .catch(() => { if (active) setQrImage(""); });
    return () => { active = false; };
  }, [code]);

  function generateAnother() {
    setCode(makeCode());
    setMessage("");
    setError("");
  }

  async function attachToRecord() {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError("أدخل الكود أولًا.");
      return;
    }
    if (!recordId || !selectedRecord) {
      setError("اختر سجلًا موجودًا حتى يتم ربط الكود به، أو استخدم إنشاء سجل جديد بالكود.");
      return;
    }
    try {
      await linkQrCode({ qrCode: normalizedCode, targetStore, targetId: selectedRecord.id, targetLabel: selectedLabel, isPrimary: true });
      setMessage(`تم ربط الكود بالسجل «${selectedLabel}» دون حذف أو استبدال أي بيانات.`);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر ربط الكود بالسجل.");
      setMessage("");
    }
  }

  function printCode() {
    if (!qrImage) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=520,height=720");
    if (!printWindow) {
      setError("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا التطبيق.");
      return;
    }
    printWindow.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>QR Code - ${selectedLabel}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#181315}img{width:360px;max-width:90vw}h1{font-size:24px;margin:0 0 10px}p{font-size:16px;word-break:break-all}</style></head><body><h1>${selectedLabel.replace(/[<>&"]/g, "")}</h1><img src="${qrImage}" alt="QR Code"><p>${code.trim().replace(/[<>&"]/g, "")}</p><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  }

  const newRecordPath = `/section/${targetStore}?qrCode=${encodeURIComponent(code.trim())}&new=1`;

  return <div dir="rtl" className="accounting-shell min-h-screen text-slate-100">
    <AppTopBar title="مولد QR Code" />
    <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="rounded-3xl border border-[#d9a766]/20 bg-white/[.035] p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-[#e2c48d]"><Sparkles className="h-5 w-5" /> مولد الأكواد وربطها بالأقسام</p>
            <h1 className="mt-2 text-3xl font-black text-white">مولد QR Code</h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-400">أنشئ كودًا محليًا، اربطه بسجل موجود أو افتح نموذج سجل جديد بالكود نفسه. الكود والصورة لا يحتاجان إلى اتصال بالإنترنت.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LocalLink href="/qr-center" className="inline-flex items-center gap-2 rounded-xl border border-red-300/30 px-4 py-2 text-sm font-bold text-red-100"><ScanLine className="h-4 w-4" /> مركز المسح</LocalLink>
            <LocalLink href="/qr-management" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300"><Link2 className="h-4 w-4" /> إدارة الربط</LocalLink>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-white/10 bg-black/10 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-bold text-red-100">قيمة الكود</span><div className="flex gap-2"><input value={code} onChange={event => setCode(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white outline-none focus:border-red-400" placeholder="اكتب كودًا فريدًا أو ولّد كودًا تلقائيًا" /><button type="button" onClick={generateAnother} className="inline-flex items-center gap-2 rounded-xl border border-[#d9a766]/30 px-3 text-xs font-bold text-[#e2c48d]" title="توليد كود جديد"><RefreshCw className="h-4 w-4" /> جديد</button></div></label>
              <label><span className="mb-1.5 block text-xs font-bold text-red-100">القسم</span><select value={targetStore} onChange={event => setTargetStore(event.target.value as StoreName)} className="w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white outline-none focus:border-red-400"><option value="">اختر القسم</option>{storeOrder.map(store => <option key={store} value={store}>{sectionDefinitions[store]?.label ?? store}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-bold text-red-100">اسم الكود أو وصفه</span><input value={label} onChange={event => setLabel(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white outline-none focus:border-red-400" placeholder="يُملأ من السجل عند اختياره" /></label>
              <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-bold text-red-100">ربط بسجل موجود (اختياري)</span><input value={recordSearch} onChange={event => setRecordSearch(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white outline-none focus:border-red-400" placeholder="ابحث بالاسم أو الكود أو الهاتف..." /><select value={recordId} onChange={event => { setRecordId(event.target.value); const row = records.find(item => item.id === event.target.value); if (row && !label.trim()) setLabel(recordLabel(row)); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white outline-none focus:border-red-400"><option value="">{loadingRecords ? "جاري تحميل السجلات..." : "بدون ربط — استخدم الكود لإنشاء سجل جديد"}</option>{filteredRecords.map(record => <option key={record.id} value={record.id}>{recordLabel(record)} — {String(record.code ?? record.id)}</option>)}</select></label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => void attachToRecord()} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-slate-950"><Link2 className="h-4 w-4" /> ربط بالسجل المحدد</button>
              <LocalLink href={newRecordPath} className="inline-flex items-center gap-2 rounded-xl border border-red-300/30 px-4 py-3 text-sm font-bold text-red-100">إنشاء سجل جديد بهذا الكود</LocalLink>
              <button type="button" onClick={printCode} disabled={!qrImage} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"><Printer className="h-4 w-4" /> طباعة الكود</button>
            </div>
          </section>

          <section className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-[#d9a766]/25 bg-[#fffaf4] p-6 text-center">
            {qrImage ? <><img src={qrImage} alt={`QR Code ${code}`} className="h-auto w-full max-w-[300px] rounded-xl" /><p className="mt-4 break-all text-sm font-bold text-[#181315]">{code}</p><p className="mt-1 text-xs text-[#6e5a54]">{selectedLabel}</p></> : <p className="text-sm text-[#6e5a54]">اكتب قيمة الكود لعرض المعاينة</p>}
          </section>
        </div>

        {(message || error) && <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${error ? "border-red-300/25 bg-red-500/10 text-red-100" : "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"}`}>{error ? <XCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}{error || message}</div>}
      </div>
    </main>
  </div>;
}