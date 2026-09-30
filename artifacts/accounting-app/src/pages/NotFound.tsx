import { AlertCircle, ArrowRight, Home } from "lucide-react";
import LocalLink from "@/components/LocalLink";

export default function NotFound() {
  return (
    <div dir="rtl" className="accounting-shell flex min-h-screen items-center justify-center px-4 text-slate-100">
      <div className="accounting-glass w-full max-w-lg rounded-3xl border border-white/10 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-300/25 bg-red-500/10 text-red-300">
          <AlertCircle className="h-8 w-8" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-red-300">خطأ في المسار</p>
        <h1 className="mt-2 text-5xl font-black text-white">404</h1>
        <h2 className="mt-3 text-xl font-bold text-slate-200">لم يتم العثور على الصفحة</h2>
        <p className="mt-4 text-sm leading-7 text-slate-400">الرابط المطلوب غير متاح أو ربما تم نقله. عد إلى لوحة التحكم لمتابعة العمل.</p>
        <LocalLink href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-red-400" data-testid="link-not-found-home">
          <Home className="h-4 w-4" /> العودة للوحة التحكم <ArrowRight className="h-4 w-4" />
        </LocalLink>
      </div>
    </div>
  );
}