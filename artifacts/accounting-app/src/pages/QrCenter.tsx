import { Camera, CheckCircle2, Download, Keyboard, Link2, ScanLine, Search, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AppTopBar from "@/components/AppTopBar";
import LocalLink from "@/components/LocalLink";
import { localList, localPut, type LocalRecord, type StoreName } from "@/lib/localDb";
import { localAccountingRepository } from "@/lib/localAccountingRepository";
import { findQrLink, linkQrCode, processEmployeeQr, recordQrScan, resolveQrTarget, type QrLink } from "@/lib/qr";

const choices: { value: StoreName; label: string }[] = [
  { value: "employees", label: "موظف" },
  { value: "products", label: "منتج أو خامة" },
  { value: "contacts", label: "عميل أو مورد" },
  { value: "fixedAssets", label: "أصل أو معدة" },
];

export default function QrCenter() {
  const [code, setCode] = useState("");
  const [target, setTarget] = useState<QrLink | null>(null);
  const [quantity, setQuantity] = useState("");
  const [targetStore, setTargetStore] = useState<StoreName>("employees");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(() => new URLSearchParams(window.location.search).get("autoCamera") === "1");
  const [cameraSupported, setCameraSupported] = useState(true);
  const [continuous, setContinuous] = useState(false);
  const [recentScans, setRecentScans] = useState<LocalRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef({ code: "", at: 0 });

  useEffect(() => { inputRef.current?.focus(); void localList<LocalRecord>("qrScans").then((rows) => setRecentScans(rows.slice(-8).reverse())); return () => streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) { setCameraSupported(false); return; }
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream; videoRef.current!.srcObject = stream; await videoRef.current!.play();
        const Detector = (window as typeof window & { BarcodeDetector: new (options?: { formats: string[] }) => { detect(video: HTMLVideoElement): Promise<{ rawValue?: string }[]> }; }).BarcodeDetector as unknown as {
          new (options?: { formats: string[] }): { detect(video: HTMLVideoElement): Promise<{ rawValue?: string }[]> };
          getSupportedFormats?: () => Promise<string[]>;
        };
        const requestedFormats = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "data_matrix", "pdf417", "aztec"];
        const supportedFormats = Detector.getSupportedFormats ? await Detector.getSupportedFormats() : requestedFormats;
        const formats = requestedFormats.filter(format => supportedFormats.includes(format));
        if (!formats.includes("qr_code")) { setCameraSupported(false); setError("الكاميرا لا تدعم قراءة QR في هذا المتصفح؛ استخدم قارئ USB/Bluetooth أو الإدخال اليدوي."); return; }
        const detector = new Detector({ formats });
        const scan = async () => {
          if (!cameraOn || cancelled) return;
          try { const found = await detector.detect(videoRef.current!); if (found[0]?.rawValue) { setCode(found[0].rawValue); await handleScan(found[0].rawValue); if (!continuous) { setCameraOn(false); return; } } } catch { /* camera frame not ready */ }
          window.requestAnimationFrame(scan);
        };
        void scan();
      } catch { setError("تعذر تشغيل الكاميرا. اسمح بالوصول إليها أو استخدم قارئ QR الخارجي."); }
    };
    void start();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, [cameraOn, continuous]);

  async function handleScan(rawCode = code) {
    const scanned = rawCode.trim();
    if (!scanned) return;
    if (lastScanRef.current.code === scanned && Date.now() - lastScanRef.current.at < 2000) return;
    lastScanRef.current = { code: scanned, at: Date.now() };
    setError(""); setMessage("");
    const resolved = await resolveQrTarget(scanned);
    await recordQrScan({ qrCode: scanned, targetStore: resolved?.targetStore ?? "unknown", targetId: resolved?.targetId ?? "", targetLabel: resolved?.targetLabel ?? "كود غير مسجل", action: "scan", source: "qr-center", scannedAt: new Date().toISOString() });
    setRecentScans((rows) => [{ id: `scan-view-${Date.now()}`, qrCode: scanned, targetLabel: resolved?.targetLabel ?? "كود غير مسجل", updatedAt: new Date().toISOString() }, ...rows].slice(0, 8));
    if (!resolved) { setTarget(null); setMessage("الكود جديد. اختر نوع السجل ثم افتح نموذج الإنشاء؛ سيُمرر الكود تلقائيًا ويُربط عند الحفظ."); return; }
    setTarget(resolved);
    const targetRows = await localList<LocalRecord>(resolved.targetStore as StoreName);
    const targetRecord = targetRows.find(row => row.id === resolved.targetId);
    setQuantity(targetRecord && targetRecord.quantity !== undefined ? String(targetRecord.quantity) : "");
    if (resolved.targetStore === "employees") {
      try { await processEmployeeQr(scanned, resolved); setMessage(`تمت معالجة حركة ${resolved.targetLabel} لليوم الحالي.`); } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر تسجيل حركة الموظف"); }
    } else setMessage(`تم العثور على ${resolved.targetLabel}. يمكنك فتح السجل أو استخدامه في القسم المرتبط.`);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function updateTargetQuantity() {
    if (!target || !quantity.trim()) {
      setError("أدخل كمية صحيحة قبل الحفظ.");
      return;
    }
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setError("الكمية يجب أن تكون رقمًا يساوي صفرًا أو أكبر.");
      return;
    }
    try {
      const targetStoreName = target.targetStore as StoreName;
      const rows = await localList<LocalRecord>(targetStoreName);
      const record = rows.find(row => row.id === target.targetId);
      if (!record) {
        setError("السجل المرتبط غير موجود في التخزين المحلي.");
        return;
      }
      await localAccountingRepository.save(targetStoreName, {
        ...record,
        quantity: parsedQuantity,
        ...(record.currentQuantity !== undefined ? { currentQuantity: parsedQuantity } : {}),
        ...(record.stockQuantity !== undefined ? { stockQuantity: parsedQuantity } : {}),
      });
      setMessage(`تم تحديث كمية «${target.targetLabel}» إلى ${parsedQuantity} مع تسجيل العملية في سجل التدقيق.`);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحديث الكمية.");
      setMessage("");
    }
  }

  async function linkExistingCode() {
    if (!code.trim()) return;
    setError(""); setMessage("");
    const rows = await localList<LocalRecord>(targetStore);
    const record = rows.find((row) => String(row.qrCode ?? row.code ?? row.employeeNumber ?? row.productCode ?? row.assetNumber ?? "").trim().toLowerCase() === code.trim().toLowerCase());
    if (!record) { setError("لم يوجد سجل بهذا الكود في القسم المختار. يمكنك إنشاء السجل يدويًا من القسم ثم ربطه بهذا الكود."); return; }
    await linkQrCode({ qrCode: code.trim(), targetStore, targetId: record.id, targetLabel: String(record.name ?? record.label ?? record.code ?? "سجل"), isPrimary: true });
    setTarget({ id: `qr-${record.id}`, updatedAt: new Date().toISOString(), qrCode: code.trim(), targetStore, targetId: record.id, targetLabel: String(record.name ?? record.label ?? record.code ?? "سجل"), status: "active", isPrimary: true });
    setMessage("تم ربط QR بالسجل الحالي دون تغيير البيانات القديمة.");
  }

  const targetPath = target ? `/section/${target.targetStore}` : `/section/${targetStore}`;
  const newRecordPath = code.trim() ? `${targetPath}?qrCode=${encodeURIComponent(code.trim())}&new=1` : targetPath;
  return <div dir="rtl" className="accounting-shell min-h-screen text-slate-100"><AppTopBar title="مركز QR Code" /><main className="mx-auto max-w-5xl px-4 py-8 lg:px-8"><div className="rounded-3xl border border-red-300/15 bg-white/[.035] p-6 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-bold text-red-300"><ScanLine className="h-5 w-5" /> طبقة QR فوق الأقسام الحالية</p><h1 className="mt-2 text-3xl font-black text-white">مركز مسح وربط QR</h1><p className="mt-3 max-w-2xl leading-7 text-slate-400">اقرأ الكود بالكاميرا أو بقارئ خارجي. الإدخال اليدوي القديم يظل متاحًا، وهذه الشاشة تضيف طريقة أسرع للوصول والتسجيل.</p><div className="mt-4 flex flex-wrap gap-2"><LocalLink href="/qr-generator" className="rounded-xl bg-[#d9a766] px-4 py-2 text-xs font-bold text-slate-950">فتح مولد QR Code</LocalLink><LocalLink href="/qr-management" className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">إدارة الأكواد</LocalLink></div></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100"><Link2 className="mb-1 h-5 w-5" /> لا يتم حذف أي سجل قديم</div></div><div className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-white/10 bg-black/10 p-5"><label className="block text-sm font-bold text-red-100">كود QR أو كود السجل</label><div className="mt-2 flex gap-2"><input ref={inputRef} value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleScan(); }} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#211c1f] px-4 py-3 text-sm text-white outline-none focus:border-red-400" placeholder="امسح بالكاميرا أو ضع المؤشر واستخدم الجهاز الخارجي" autoComplete="off" /><button type="button" onClick={() => void handleScan()} className="rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-slate-950"><Search className="h-4 w-4" /></button></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setCameraOn((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-red-300/30 px-4 py-2 text-xs font-bold text-red-100"><Camera className="h-4 w-4" /> {cameraOn ? "إيقاف الكاميرا" : "فتح الكاميرا"}</button><button type="button" onClick={() => setContinuous((value) => !value)} className={`rounded-xl border px-4 py-2 text-xs font-bold ${continuous ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-slate-400"}`}>وضع المسح المتتابع: {continuous ? "مفعل" : "متوقف"}</button><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400"><Keyboard className="h-4 w-4" /> قارئ USB/Bluetooth كلوحة مفاتيح</span></div>{cameraOn && <div className="mt-4 overflow-hidden rounded-2xl border border-red-300/20 bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /><p className="p-3 text-center text-xs text-slate-400">وجّه الكاميرا إلى QR Code</p></div>}{!cameraSupported && cameraOn && <p className="mt-3 text-xs text-amber-200">المتصفح لا يدعم BarcodeDetector؛ استخدم جهاز القراءة الخارجي أو الإدخال اليدوي.</p>}</section><section className="rounded-2xl border border-white/10 bg-black/10 p-5"><p className="text-sm font-bold text-red-100">إذا كان الكود جديدًا</p><p className="mt-2 text-xs leading-6 text-slate-400">اختر القسم الذي سيحمل السجل. عند إنشاء موظف جديد سيُستخدم الكود أيضًا كرقم موظف ويتم ربطه بالحضور والانصراف تلقائيًا.</p><select value={targetStore} onChange={(event) => setTargetStore(event.target.value as StoreName)} className="mt-4 w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-3 text-sm text-white">{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select><LocalLink href="/qr-generator" className="mt-3 block w-full rounded-xl border border-[#d9a766]/30 px-4 py-3 text-center text-sm font-bold text-[#e2c48d]">توليد وطباعة كود QR</LocalLink><LocalLink href={newRecordPath} className="mt-3 block w-full rounded-xl bg-red-500 px-4 py-3 text-center text-sm font-bold text-slate-950">إنشاء سجل جديد بالكود</LocalLink><button type="button" onClick={() => void linkExistingCode()} className="mt-3 w-full rounded-xl border border-red-300/30 px-4 py-3 text-sm font-bold text-red-100">ربط الكود بسجل موجود</button><LocalLink href={`/section/${targetStore}`} className="mt-3 block text-center text-xs text-red-300">فتح قسم {choices.find((choice) => choice.value === targetStore)?.label}</LocalLink></section></div>{(message || error) && <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${error ? "border-red-300/25 bg-red-500/10 text-red-100" : "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"}`}>{error ? <XCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}{error || message}</div>}{target && <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-5"><p className="text-xs text-slate-400">السجل المرتبط</p><h2 className="mt-1 text-xl font-black text-white">{target.targetLabel}</h2><p className="mt-2 text-sm text-slate-400">القسم: {target.targetStore} — الكود: {target.qrCode}</p><div className="mt-4 flex flex-wrap items-end gap-2"><label className="min-w-[180px] flex-1"><span className="mb-1 block text-xs text-slate-400">الكمية الحالية</span><input type="number" min="0" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#211c1f] px-3 py-2 text-sm text-white outline-none focus:border-red-400" placeholder="اختياري" /></label><button type="button" onClick={() => void updateTargetQuantity()} className="rounded-xl border border-[#d9a766]/30 px-4 py-2 text-sm font-bold text-[#e2c48d]">حفظ الكمية</button></div><LocalLink href={targetPath} className="mt-4 inline-flex rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-slate-950">فتح القسم المرتبط</LocalLink></div>}{recentScans.length > 0 && <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-5"><div className="flex items-center justify-between"><p className="font-bold text-red-100">آخر عمليات المسح</p><Download className="h-4 w-4 text-slate-500" /></div><div className="mt-3 space-y-2">{recentScans.map((scan) => <div key={scan.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-white/5 px-3 py-2 text-xs"><span className="text-slate-200">{String(scan.targetLabel ?? "غير مسجل")}</span><span className="text-slate-500">{String(scan.qrCode ?? "")}</span></div>)}</div></div>}</div></main></div>;
}
