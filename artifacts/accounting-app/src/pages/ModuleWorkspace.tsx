import { ArrowLeft, ChevronLeft, LayoutGrid } from "lucide-react";
import LocalLink from "@/components/LocalLink";
import AppTopBar from "@/components/AppTopBar";
import { getModule, modulePath } from "@/lib/moduleCatalog";

type ModuleWorkspaceProps = { params?: { id?: string } };

export default function ModuleWorkspace({ params }: ModuleWorkspaceProps) {
  const fallbackId = typeof window === "undefined" ? "" : window.location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const moduleId = params?.id ?? fallbackId;
  const module = getModule(moduleId);

  if (!module) {
    return (
      <div dir="rtl" className="accounting-shell flex min-h-screen items-center justify-center px-4 text-slate-100">
        <div className="accounting-glass w-full max-w-xl rounded-3xl border border-red-300/20 bg-red-300/10 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">مساحة عمل غير معروفة</p>
          <h1 className="mt-3 text-2xl font-black text-white">لم يتم العثور على هذه الوحدة</h1>
          <p className="mt-3 text-sm leading-7 text-slate-400">تحقق من الرابط أو عد إلى لوحة التحكم لاختيار إحدى الوحدات المتاحة.</p>
          <LocalLink href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-red-400"><ArrowLeft className="h-4 w-4" /> العودة للوحة التحكم</LocalLink>
        </div>
      </div>
    );
  }

  const Icon = module.icon;
  return (
    <div dir="rtl" className="accounting-shell min-h-screen text-slate-100">
      <AppTopBar title={module.label} />
      <main className="mx-auto max-w-[1320px] px-4 py-6 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <LocalLink href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-red-200"><ArrowLeft className="h-4 w-4" /> العودة للوحة التحكم</LocalLink>
          <span className="rounded-full border border-red-300/20 bg-red-300/10 px-3 py-1.5 text-xs font-semibold text-red-200">مساحة عمل محلية دون إنترنت</span>
        </div>
        <section className="accounting-glass relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#21171a] p-6 shadow-2xl lg:p-10">
          <div className="absolute -left-20 -top-28 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-red-300/25 bg-red-500/10 text-red-200"><Icon className="h-7 w-7" /></div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">وحدة رئيسية</p>
              <h1 className="mt-3 text-3xl font-black text-white lg:text-5xl">{module.label}</h1>
              <p className="mt-4 text-sm leading-7 text-slate-300 lg:text-base">{module.description}. اختر مساحة العمل المطلوبة، وستبقى كل العمليات مرتبطة بالأثر المحاسبي والتخزين المحلي.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 px-5 py-4 text-sm text-slate-300"><LayoutGrid className="mb-2 h-5 w-5 text-red-300" /><strong className="block text-2xl text-white">{module.sections.length}</strong>مساحات فرعية</div>
          </div>
        </section>
        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">مركز الوحدة</p><h2 className="mt-2 text-2xl font-black text-white">اختر شاشة العمل</h2></div><span className="text-xs text-slate-500">كل قسم مستقل ومترابط</span></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {module.sections.map(section => <LocalLink key={`${module.id}-${section.label}`} href={modulePath(section)} className="accounting-card group rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-1 hover:border-red-300/40 hover:bg-red-500/[0.06]" data-testid={`link-module-section-${section.store ?? section.label}`}><div className="flex items-start justify-between gap-4"><div><h3 className="font-bold text-white">{section.label}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{section.description}</p></div><ChevronLeft className="mt-1 h-5 w-5 shrink-0 text-slate-600 transition group-hover:-translate-x-1 group-hover:text-red-300" /></div></LocalLink>)}
          </div>
        </section>
      </main>
    </div>
  );
}