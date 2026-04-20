import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ShellCard({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#151923] md:p-6 ${className}`}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-300">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: LucideIcon }) {
  return (
    <div className="flex min-w-0 min-h-[9.5rem] flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md dark:border-white/10 dark:bg-[#151923] dark:hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
          {label}
        </p>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-stone-900 dark:text-stone-50">{value}</p>
      <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">{detail}</p>
    </div>
  );
}

function statusPillTone(children: React.ReactNode) {
  const label = String(children).toLowerCase();

  if (["approved", "active", "processed", "ready", "completed"].some(token => label.includes(token))) {
    return "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100";
  }

  if (["review", "drafting", "pending", "uploaded", "processing", "created", "high", "due soon", "λήγουν σύντομα", "υψηλή"].some(token => label.includes(token))) {
    return "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100";
  }

  if (["suspended", "failed", "duplicate", "archived", "inactive", "overdue", "critical", "εκπρόθεσμες", "κρίσιμη"].some(token => label.includes(token))) {
    return "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100";
  }

  if (["admin", "judge", "precedent", "statute", "regulation", "reference"].some(token => label.includes(token))) {
    return "border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100";
  }

  if (["evidence", "pleading", "supporting", "decision", "other"].some(token => label.includes(token))) {
    return "border-violet-200/80 bg-violet-50 text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100";
  }

  return "border-stone-200/80 bg-white/92 text-stone-700 dark:border-stone-700/80 dark:bg-white/[0.05] dark:text-stone-200";
}

export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.67rem] font-semibold uppercase tracking-[0.16em] shadow-[0_10px_22px_-18px_rgba(31,41,55,0.28)] ${statusPillTone(children)}`}>
      {children}
    </span>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <ShellCard title={label}>
      <div className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-white/84 px-4 py-8 text-sm text-stone-600 shadow-sm dark:border-stone-700/80 dark:bg-white/[0.05] dark:text-stone-200">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </ShellCard>
  );
}

export function WorkspaceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white/84 px-4 py-4 shadow-sm dark:border-stone-700/80 dark:bg-white/[0.05]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{label}</p>
      <p className="mt-2 text-sm font-semibold text-stone-950 dark:text-stone-100">{value}</p>
    </div>
  );
}

export function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{label}</span>
      {children}
    </label>
  );
}

export function InputField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <FieldWrapper label={label}>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-stone-300/80 bg-white px-4 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-400"
      />
    </FieldWrapper>
  );
}

export function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <FieldWrapper label={label}>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] w-full rounded-lg border border-stone-300/80 bg-white px-4 py-3 text-sm leading-7 text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-400"
      />
    </FieldWrapper>
  );
}

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <FieldWrapper label={label}>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-stone-300/80 bg-white px-4 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100 dark:focus:border-stone-400"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

export function FileField({ label, selectedFile, onChange, selectedPrefix = "Selected file" }: { label: string; selectedFile: File | null; onChange: (file: File | null) => void; selectedPrefix?: string }) {
  return (
    <FieldWrapper label={label}>
      <div className="rounded-xl border border-dashed border-stone-300/90 bg-stone-50 px-4 py-5 shadow-sm dark:border-stone-700/80 dark:bg-white/[0.04]">
        <input type="file" onChange={event => onChange(event.target.files?.[0] ?? null)} className="block w-full text-sm text-stone-700 file:mr-4 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-stone-50 dark:text-stone-200 dark:file:bg-stone-100 dark:file:text-stone-900" />
        {selectedFile ? <p className="mt-3 text-sm text-stone-600 dark:text-stone-200">{selectedPrefix}: {selectedFile.name}</p> : null}
      </div>
    </FieldWrapper>
  );
}

export function MultiFileField({ label, selectedFiles, onChange, selectedPrefix = "Selected files" }: { label: string; selectedFiles: File[]; onChange: (files: File[]) => void; selectedPrefix?: string }) {
  return (
    <FieldWrapper label={label}>
      <div className="rounded-xl border border-dashed border-stone-300/90 bg-stone-50 px-4 py-5 shadow-sm dark:border-stone-700/80 dark:bg-white/[0.04]">
        <input type="file" multiple onChange={event => onChange(Array.from(event.target.files ?? []))} className="block w-full text-sm text-stone-700 file:mr-4 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-stone-50 dark:text-stone-200 dark:file:bg-stone-100 dark:file:text-stone-900" />
        {selectedFiles.length ? <p className="mt-3 text-sm text-stone-600 dark:text-stone-200">{selectedPrefix}: {selectedFiles.map(file => file.name).join(", ")}</p> : null}
      </div>
    </FieldWrapper>
  );
}
