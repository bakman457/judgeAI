import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Brain,
  FileText,
  Home,
  Loader2,
  PenTool,
  Plus,
  Scale,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const copyByLocale = {
  en: {
    work: "Work",
    system: "System",
    dashboard: "Dashboard",
    cases: "Cases",
    knowledge: "Knowledge Base",
    judgeStyle: "Judge Style",
    memory: "Permanent Memory",
    logs: "Logs",
    description: "Review and control the durable preferences, instructions, edits, notes, and feedback Judge AI carries into future work.",
    addTitle: "Add permanent instruction",
    addDescription: "Create an explicit memory that should influence future drafts when relevant.",
    placeholder: "Example: Prefer concise reasoning paragraphs and state evidentiary gaps explicitly.",
    scope: "Scope",
    global: "All my cases",
    caseType: "Case type",
    caseTypePlaceholder: "e.g. inheritance",
    add: "Add memory",
    statsTitle: "Memory health",
    active: "Active",
    total: "Total memories",
    events: "Raw learning events",
    uses: "Times applied",
    listTitle: "Learned memories",
    listDescription: "Raw history is retained permanently. Disabling an item removes it from future prompt retrieval but does not erase its history.",
    none: "No memory items yet. Judge AI will learn from your instructions, edits, notes, and review feedback.",
    reinforcement: "reinforcements",
    used: "uses",
    deactivate: "Disable",
    activate: "Activate",
    inactive: "Inactive",
    loading: "Loading memory...",
    added: "Permanent memory added",
    updated: "Memory status updated",
    category: "Category",
  },
  el: {
    work: "Εργασία",
    system: "Σύστημα",
    dashboard: "Πίνακας ελέγχου",
    cases: "Υποθέσεις",
    knowledge: "Βάση γνώσης",
    judgeStyle: "Ύφος δικαστή",
    memory: "Μόνιμη Μνήμη",
    logs: "Καταγραφές",
    description: "Ελέγξτε τις μόνιμες προτιμήσεις, οδηγίες, διορθώσεις, σημειώσεις και ανατροφοδότηση που χρησιμοποιεί το Judge AI σε μελλοντικές εργασίες.",
    addTitle: "Προσθήκη μόνιμης οδηγίας",
    addDescription: "Δημιουργήστε μια ρητή μνήμη που θα επηρεάζει μελλοντικά σχέδια όταν είναι σχετική.",
    placeholder: "Παράδειγμα: Προτίμησε σύντομες παραγράφους αιτιολογίας και δήλωνε ρητά τα αποδεικτικά κενά.",
    scope: "Εμβέλεια",
    global: "Όλες οι υποθέσεις μου",
    caseType: "Τύπος υπόθεσης",
    caseTypePlaceholder: "π.χ. inheritance",
    add: "Προσθήκη μνήμης",
    statsTitle: "Κατάσταση μνήμης",
    active: "Ενεργές",
    total: "Σύνολο μνημών",
    events: "Ακατέργαστα συμβάντα μάθησης",
    uses: "Χρήσεις",
    listTitle: "Μνήμες που έχουν μαθευτεί",
    listDescription: "Το ιστορικό διατηρείται μόνιμα. Η απενεργοποίηση αφαιρεί ένα στοιχείο από μελλοντικά prompts χωρίς να διαγράφει το ιστορικό του.",
    none: "Δεν υπάρχουν ακόμη στοιχεία μνήμης. Το Judge AI θα μαθαίνει από οδηγίες, διορθώσεις, σημειώσεις και ανατροφοδότηση.",
    reinforcement: "ενισχύσεις",
    used: "χρήσεις",
    deactivate: "Απενεργοποίηση",
    activate: "Ενεργοποίηση",
    inactive: "Ανενεργή",
    loading: "Φόρτωση μνήμης...",
    added: "Η μόνιμη μνήμη προστέθηκε",
    updated: "Η κατάσταση μνήμης ενημερώθηκε",
    category: "Κατηγορία",
  },
} as const;

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.6rem] border border-stone-200/80 bg-white p-6 shadow-sm dark:border-stone-700/80 dark:bg-[#151923]">
      <h2 className="text-lg font-semibold text-stone-950 dark:text-stone-100">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function MemoryPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const copy = copyByLocale[locale];
  const utils = trpc.useUtils();
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<"global" | "case_type">("global");
  const [caseType, setCaseType] = useState("");

  const memoriesQuery = trpc.judgeAi.memory.list.useQuery(
    { status: "all", limit: 250 },
    { enabled: Boolean(user) },
  );
  const statsQuery = trpc.judgeAi.memory.stats.useQuery(undefined, { enabled: Boolean(user) });

  const addMutation = trpc.judgeAi.memory.add.useMutation({
    onSuccess: async () => {
      toast.success(copy.added);
      setContent("");
      await Promise.all([
        utils.judgeAi.memory.list.invalidate(),
        utils.judgeAi.memory.stats.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const setStatusMutation = trpc.judgeAi.memory.setStatus.useMutation({
    onSuccess: async () => {
      toast.success(copy.updated);
      await Promise.all([
        utils.judgeAi.memory.list.invalidate(),
        utils.judgeAi.memory.stats.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const memories = memoriesQuery.data ?? [];
  const stats = statsQuery.data;
  const activeCount = useMemo(
    () => memories.filter(item => item.status === "active").length,
    [memories],
  );

  const navGroups = [
    {
      id: "work",
      label: copy.work,
      items: [
        { icon: Home, label: copy.dashboard, path: "/" },
        { icon: Scale, label: copy.cases, path: "/cases" },
        { icon: BookOpen, label: copy.knowledge, path: "/knowledge" },
        { icon: PenTool, label: copy.judgeStyle, path: "/judge-style" },
        { icon: Brain, label: copy.memory, path: "/memory" },
      ],
    },
    {
      id: "system",
      label: copy.system,
      items: [{ icon: FileText, label: copy.logs, path: "/logs" }],
    },
  ];

  return (
    <DashboardLayout
      title={copy.memory}
      description={copy.description}
      breadcrumbs={[{ label: copy.work }, { label: copy.memory }]}
      navGroups={navGroups}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            [copy.active, stats?.activeItems ?? activeCount],
            [copy.total, stats?.totalItems ?? memories.length],
            [copy.events, stats?.totalEvents ?? 0],
            [copy.uses, stats?.totalUses ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-[#151923]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-stone-950 dark:text-stone-100">{value}</p>
            </div>
          ))}
        </div>

        <Card title={copy.addTitle} description={copy.addDescription}>
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]">
            <textarea
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder={copy.placeholder}
              rows={3}
              className="min-h-24 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
            <select
              value={scope}
              onChange={event => setScope(event.target.value as "global" | "case_type")}
              className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-900"
              aria-label={copy.scope}
            >
              <option value="global">{copy.global}</option>
              <option value="case_type">{copy.caseType}</option>
            </select>
            <Input
              value={caseType}
              onChange={event => setCaseType(event.target.value)}
              placeholder={copy.caseTypePlaceholder}
              disabled={scope !== "case_type"}
              className="h-11 rounded-xl"
            />
            <Button
              className="h-11 rounded-xl"
              disabled={
                addMutation.isPending ||
                !content.trim() ||
                (scope === "case_type" && !caseType.trim())
              }
              onClick={() =>
                addMutation.mutate({
                  content: content.trim(),
                  scope,
                  category: "manual",
                  caseType: scope === "case_type" ? caseType.trim() : null,
                  caseId: null,
                })
              }
            >
              {addMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {copy.add}
            </Button>
          </div>
        </Card>

        <Card title={copy.listTitle} description={copy.listDescription}>
          {memoriesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.loading}
            </div>
          ) : memories.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">{copy.none}</p>
          ) : (
            <div className="space-y-3">
              {memories.map(item => {
                const isActive = item.status === "active";
                return (
                  <div key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900/40">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                          <span className="rounded-full bg-stone-200 px-2 py-1 dark:bg-stone-800">{copy.category}: {item.category}</span>
                          <span className="rounded-full bg-stone-200 px-2 py-1 dark:bg-stone-800">{item.scope}{item.caseType ? ` · ${item.caseType}` : ""}</span>
                          {!isActive ? <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{copy.inactive}</span> : null}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-800 dark:text-stone-200">{item.content}</p>
                        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                          {item.reinforcementCount} {copy.reinforcement} · {item.usageCount} {copy.used}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-xl"
                        disabled={setStatusMutation.isPending}
                        onClick={() =>
                          setStatusMutation.mutate({
                            memoryId: item.id,
                            status: isActive ? "inactive" : "active",
                          })
                        }
                      >
                        {isActive ? <ToggleRight className="mr-2 h-4 w-4" /> : <ToggleLeft className="mr-2 h-4 w-4" />}
                        {isActive ? copy.deactivate : copy.activate}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Judge AI memory is advisory. Current case evidence, applicable law, and the judge's current explicit instruction always take priority over remembered preferences.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
