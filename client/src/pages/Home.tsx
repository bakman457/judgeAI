import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale, type Locale } from "@/contexts/LocaleContext";
import { fileToBase64, filesToBatchPayload } from "@/lib/fileUpload";
import { buildIntakeMetrics, buildIntakeQueue } from "@/lib/intakeQueue";
import { repairMojibakeObject } from "@/lib/textEncoding";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  BookCopy,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Filter,
  Gavel,
  Keyboard,
  PenTool,
  Pencil,
  History,
  Loader2,
  RotateCcw,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import {
  FileField,
  FieldWrapper,
  InputField,
  LoadingPanel,
  MetricCard,
  MultiFileField,
  SectionAuthorNote,
  SelectField,
  ShellCard,
  TextAreaField,
  WorkspaceFact,
} from "./home/components";
import type { CaseReviewResult, ReviewSnapshot } from "./home/reviewUtils";
import { localizedCopy, localizedInterface, runtimeCopy } from "@/locales/translations";

function getNavGroups(locale: "en" | "el") {
  const copy = repairMojibakeObject(localizedCopy[locale]).nav;
  const groupLabels = locale === "el"
    ? { work: "Εργασία", setup: "Ρυθμίσεις", system: "Σύστημα" }
    : { work: "Work", setup: "Setup", system: "System" };
  const allRoles = ["judge", "admin"] as Array<"judge" | "admin">;
  return [
    {
      id: "work",
      label: groupLabels.work,
      items: [
        { icon: Scale, label: copy.overview, path: "/", roles: allRoles },
        { icon: Gavel, label: copy.cases, path: "/cases", roles: allRoles },
        { icon: BookCopy, label: copy.knowledge, path: "/knowledge", roles: allRoles },
        { icon: PenTool, label: copy.judgeStyle, path: "/judge-style", roles: allRoles },
      ],
    },
    {
      id: "setup",
      label: groupLabels.setup,
      items: [
        { icon: Settings2, label: copy.admin, path: "/admin", roles: ["admin"] as Array<"judge" | "admin"> },
      ],
    },
    {
      id: "system",
      label: groupLabels.system,
      items: [
        { icon: FileText, label: copy.logs, path: "/logs", roles: allRoles },
        { icon: BookOpen, label: copy.help, path: "/help", roles: allRoles },
      ],
    },
  ];
}

const defaultCaseForm = {
  caseNumber: "",
  title: "",
  jurisdictionCode: "",
  courtLevel: "",
  caseType: "",
  summary: "",
  languageCode: "el",
};

const defaultKnowledgeForm: {
  title: string;
  documentType: "statute" | "regulation" | "precedent" | "reference" | "other";
  jurisdictionCode: string;
  courtLevel: string;
  citation: string;
  sourceReference: string;
} = {
  title: "",
  documentType: "statute",
  jurisdictionCode: "",
  courtLevel: "",
  citation: "",
  sourceReference: "",
};

const defaultProviderForm: {
  id?: number;
  name: string;
  providerType: "openai" | "azure_openai" | "custom_openai_compatible" | "alibaba_cloud" | "kimi" | "deepseek";
  endpoint: string;
  model: string;
  apiKey: string;
  azureApiVersion: string;
  defaultSystemPrompt: string;
  draftTemperature: string;
  maxTokens: string;
} = {
  id: undefined,
  name: "",
  providerType: "openai",
  endpoint: "https://api.openai.com/v1",
  model: "gpt-4.1",
  apiKey: "",
  azureApiVersion: "2024-10-21",
  defaultSystemPrompt: "",
  draftTemperature: "0.2",
  maxTokens: "8000",
};

function formatTimestamp(value?: string | number | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatSignedDelta(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
}

function translateToken(locale: Locale, value?: string | null) {
  if (!value) return "";
  const key = String(value).trim().toLowerCase();
  return (runtimeCopy[locale].status as Record<string, string>)[key] ?? key.replace(/_/g, " ");
}

function translateRole(locale: Locale, value?: string | null) {
  return translateToken(locale, value);
}

function formatReviewSnapshotOption(locale: Locale, snapshot: any) {
  const labels = runtimeCopy[locale].labels;
  return `${labels.snapshot} #${snapshot.id} · ${labels.draft} v${snapshot.draftVersionNo ?? labels.manual} · ${formatTimestamp(snapshot.createdAt)}`;
}

function formatActivitySummary(locale: Locale, item: any) {
  const details = item.detailsJson ?? {};
  const labels = runtimeCopy[locale].labels;
  const actionTypes = runtimeCopy[locale].actionTypes as Record<string, string>;

  if (locale === "en") {
    return item.summary ?? actionTypes[item.actionType] ?? item.actionType;
  }

  switch (item.actionType) {
    case "case.created":
      return `Η υπόθεση ${details.caseNumber ?? item.entityId ?? ""} δημιουργήθηκε`.trim();
    case "case.status_changed":
      return `Η κατάσταση υπόθεσης άλλαξε σε ${translateToken(locale, details.status)}`;
    case "case.archived":
      return "Η υπόθεση αρχειοθετήθηκε";
    case "case_document.duplicate_detected":
      return `Εντοπίστηκε διπλότυπο έγγραφο για ${details.title ?? item.summary ?? ""}`.trim();
    case "case_document.uploaded":
      if (Array.isArray(details.batchResults)) {
        return `Η μαζική εισαγωγή ολοκληρώθηκε για ${details.batchResults.length} έγγραφα υπόθεσης`;
      }
      return `Το έγγραφο υπόθεσης ${details.title ?? item.summary ?? ""} μεταφορτώθηκε`.trim();
    case "draft.created":
      return `Δημιουργήθηκε σχέδιο ${item.entityId ? `#${item.entityId}` : ""}`.trim();
    case "draft.generated":
      return "Το σχέδιο AI δημιουργήθηκε";
    case "draft.paragraph_updated":
      return "Η παράγραφος του σχεδίου ενημερώθηκε";
    case "draft.section_status_changed":
      return `Η ενότητα σχεδίου σημειώθηκε ως ${translateToken(locale, details.reviewStatus)}`;
    case "draft.approved":
      return "Το σχέδιο εγκρίθηκε για εξαγωγή";
    case "case.review_generated":
      return `Ο έλεγχος υπόθεσης δημιουργήθηκε με αξιολόγηση ${translateToken(locale, details.outcomeAssessment)}`;
    case "decision.exported":
      return "Το εγκεκριμένο σχέδιο εξήχθη ως DOCX";
    case "case.review_report_exported":
      return "Η έκθεση ελέγχου εξήχθη";
    default:
      return actionTypes[item.actionType] ?? item.summary ?? item.actionType ?? labels.savedReviewFallback;
  }
}

function toSavedReviewResult(snapshot: ReviewSnapshot | null | undefined): CaseReviewResult | null {
  if (!snapshot) return null;
  return {
    ...(snapshot.resultJson ?? {}),
    reviewSnapshotId: snapshot.id,
    reviewedDraftVersionNo: snapshot.draftVersionNo,
    reviewTemplateKey: snapshot.reviewTemplateKey,
    createdAt: snapshot.createdAt,
  };
}

function uniqueReviewItems(values: any[] = []) {
  return Array.from(
    new Set(
      (values ?? [])
        .map(item => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function diffReviewTextLists(currentValues: any[] = [], previousValues: any[] = []) {
  const current = uniqueReviewItems(currentValues);
  const previous = uniqueReviewItems(previousValues);
  return {
    added: current.filter(item => !previous.includes(item)),
    removed: previous.filter(item => !current.includes(item)),
  };
}

function diffReviewObjects(currentItems: any[] = [], previousItems: any[] = [], keyBuilder: (item: any) => string) {
  const currentMap = new Map((currentItems ?? []).map(item => [keyBuilder(item), item]));
  const previousMap = new Map((previousItems ?? []).map(item => [keyBuilder(item), item]));

  return {
    added: Array.from(currentMap.entries())
      .filter(([key]) => !previousMap.has(key))
      .map(([, item]) => item),
    removed: Array.from(previousMap.entries())
      .filter(([key]) => !currentMap.has(key))
      .map(([, item]) => item),
  };
}

function normalizeFindingKey(item: any) {
  return String(item?.issue ?? "").trim().toLowerCase();
}

function buildFindingComparison(currentItems: any[] = [], previousItems: any[] = [], locale: Locale = "en") {
  const labels = runtimeCopy[locale].labels;
  const current = currentItems ?? [];
  const previous = previousItems ?? [];
  const previousByIssue = new Map(previous.map(item => [normalizeFindingKey(item), item]));
  const currentByIssue = new Map(current.map(item => [normalizeFindingKey(item), item]));

  const buildChangeSummary = (currentItem: any, previousItem: any) => {
    const summary: string[] = [];
    const currentSeverity = String(currentItem?.severity ?? "medium").toUpperCase();
    const previousSeverity = String(previousItem?.severity ?? "medium").toUpperCase();

    if (currentSeverity !== previousSeverity) {
      summary.push(labels.severityChanged(previousSeverity, currentSeverity));
    }

    const currentRecommendation = String(currentItem?.recommendedAction ?? "").trim();
    const previousRecommendation = String(previousItem?.recommendedAction ?? "").trim();
    if (currentRecommendation !== previousRecommendation && (currentRecommendation || previousRecommendation)) {
      summary.push(labels.recommendedActionUpdated);
    }

    return summary;
  };

  const currentRows = current.map(item => {
    const previousItem = previousByIssue.get(normalizeFindingKey(item));
    if (!previousItem) {
      return { item, previousItem: null, status: "added" as const, changeSummary: [labels.newFinding] };
    }

    const changeSummary = buildChangeSummary(item, previousItem);
    return {
      item,
      previousItem,
      status: (changeSummary.length ? "changed" : "unchanged") as "changed" | "unchanged",
      changeSummary,
    };
  });

  const previousRows = previous.map(item => {
    const currentItem = currentByIssue.get(normalizeFindingKey(item));
    if (!currentItem) {
      return { item, currentItem: null, status: "removed" as const, changeSummary: [labels.resolvedOrRemoved] };
    }

    const changeSummary = buildChangeSummary(currentItem, item);
    return {
      item,
      currentItem,
      status: (changeSummary.length ? "changed" : "unchanged") as "changed" | "unchanged",
      changeSummary,
    };
  });

  return {
    currentRows,
    previousRows,
    changedCount:
      currentRows.filter(row => row.status === "added" || row.status === "changed").length
      + previousRows.filter(row => row.status === "removed").length,
  };
}

function getFindingHighlightMeta(status: "added" | "removed" | "changed" | "unchanged", locale: Locale = "en") {
  const labels = runtimeCopy[locale].labels;
  if (status === "added") {
    return {
      label: labels.new,
      containerClass: "border-emerald-300/80 bg-emerald-50/90 dark:border-emerald-500/40 dark:bg-emerald-500/10",
      badgeClass: "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950",
    };
  }
  if (status === "removed") {
    return {
      label: labels.resolved,
      containerClass: "border-rose-300/80 bg-rose-50/90 dark:border-rose-500/40 dark:bg-rose-500/10",
      badgeClass: "bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950",
    };
  }
  if (status === "changed") {
    return {
      label: labels.changed,
      containerClass: "border-amber-300/80 bg-amber-50/90 dark:border-amber-500/40 dark:bg-amber-500/10",
      badgeClass: "bg-amber-500 text-amber-950 dark:bg-amber-300 dark:text-amber-950",
    };
  }
  return {
    label: labels.stable,
    containerClass: "border-stone-200/80 bg-white/95 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]",
    badgeClass: "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100",
  };
}

function buildReviewComparison(currentSnapshot: ReviewSnapshot | null | undefined, previousSnapshot: ReviewSnapshot | null | undefined, locale: Locale = "en") {
  if (!currentSnapshot || !previousSnapshot) return null;

  const currentReview = currentSnapshot.resultJson ?? {};
  const previousReview = previousSnapshot.resultJson ?? {};
  const blockerDiff = diffReviewTextLists(currentReview.preSignatureReview?.blockers ?? [], previousReview.preSignatureReview?.blockers ?? []);
  const missingEvidenceDiff = diffReviewTextLists(currentReview.missingEvidence ?? [], previousReview.missingEvidence ?? []);
  const missingLawDiff = diffReviewTextLists(currentReview.missingLaw ?? [], previousReview.missingLaw ?? []);
  const issueDiff = diffReviewObjects(
    currentReview.extractedIssues ?? [],
    previousReview.extractedIssues ?? [],
    item => `${item?.question ?? ""}::${item?.significance ?? ""}`,
  );
  const findingDiff = diffReviewObjects(
    currentReview.findings ?? [],
    previousReview.findings ?? [],
    item => `${item?.severity ?? ""}::${item?.issue ?? ""}`,
  );
  const findingComparison = buildFindingComparison(currentReview.findings ?? [], previousReview.findings ?? [], locale);

  return {
    currentReview,
    previousReview,
    currentSnapshot,
    previousSnapshot,
    qualityScoreDelta: (Number(currentReview.decisionQuality?.score) || 0) - (Number(previousReview.decisionQuality?.score) || 0),
    blockerDiff,
    missingEvidenceDiff,
    missingLawDiff,
    issueDiff,
    findingDiff,
    findingComparison,
    findingChangeCount: findingComparison.changedCount,
  };
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

  return "border-stone-200/80 bg-white/92 text-stone-700 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(27,32,45,0.98)_0%,rgba(18,21,31,0.99)_100%)] dark:text-stone-200";
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[0.67rem] font-semibold uppercase tracking-[0.22em] shadow-[0_10px_22px_-18px_rgba(31,41,55,0.28)] ${statusPillTone(children)}`}>
      {children}
    </span>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { locale } = useLocale();
  const copy = useMemo(() => repairMojibakeObject(localizedCopy[locale]), [locale]);
  const ui = useMemo(() => repairMojibakeObject(localizedInterface[locale]), [locale]);
  const rt = useMemo(() => repairMojibakeObject(runtimeCopy[locale]), [locale]);
  const navGroups = getNavGroups(locale);
  const [location, setLocation] = useLocation();
  const [caseMatch, caseParams] = useRoute("/cases/:caseId");
  const caseId = caseMatch ? Number(caseParams.caseId) : null;

  const [caseForm, setCaseForm] = useState(defaultCaseForm);
  const [caseStatusFilter, setCaseStatusFilter] = useState<"all" | "active" | "approved" | "archived">("all");
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [editCaseForm, setEditCaseForm] = useState(defaultCaseForm);
  const [deleteConfirmCaseId, setDeleteConfirmCaseId] = useState<number | null>(null);
  const [knowledgeForm, setKnowledgeForm] = useState(defaultKnowledgeForm);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeBatchFiles, setKnowledgeBatchFiles] = useState<File[]>([]);
  const [caseFile, setCaseFile] = useState<File | null>(null);
  const [caseBatchFiles, setCaseBatchFiles] = useState<File[]>([]);
  const [caseDocumentTitle, setCaseDocumentTitle] = useState("");
  const [caseDocumentType, setCaseDocumentType] = useState("pleading");
  const [searchQuery, setSearchQuery] = useState("");
  const [judgmentReviewText, setJudgmentReviewText] = useState("");
  const [selectedReviewTemplate, setSelectedReviewTemplate] = useState<"inheritance">("inheritance");
  const [reviewTemplateFocus, setReviewTemplateFocus] = useState("");
  const [caseReviewResult, setCaseReviewResult] = useState<CaseReviewResult | null>(null);
  const [reviewedFindingIndices, setReviewedFindingIndices] = useState<Set<number>>(new Set());
  const [findingExplanations, setFindingExplanations] = useState<Map<number, string>>(new Map());
  const [activeTab, setActiveTab] = useState("documents");
  const [providerForm, setProviderForm] = useState(defaultProviderForm);
  const [providerTestResult, setProviderTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [ocrTestFile, setOcrTestFile] = useState<File | null>(null);
  const [ocrTestResult, setOcrTestResult] = useState("");
  const [paragraphDrafts, setParagraphDrafts] = useState<Record<number, { paragraphText: string; rationale: string; confidenceScore: string; reviewStatus: "draft" | "reviewed" | "approved" }>>({});
  const [draftProgress, setDraftProgress] = useState(0);
  const [draftProgressElapsed, setDraftProgressElapsed] = useState(0);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [reviewProgressElapsed, setReviewProgressElapsed] = useState(0);
  const [intakeSearch, setIntakeSearch] = useState("");
  const [crossCaseSearchQuery, setCrossCaseSearchQuery] = useState("");
  const [crossCaseSearchSubmitted, setCrossCaseSearchSubmitted] = useState("");
  const [usageDashboardDays, setUsageDashboardDays] = useState(30);
  const [intakePriorityFilter, setIntakePriorityFilter] = useState<"all" | "critical" | "high" | "normal">("all");
  const [batchSelectedCaseIds, setBatchSelectedCaseIds] = useState<Set<number>>(new Set());
  const [batchReviewOutcomes, setBatchReviewOutcomes] = useState<Array<{
    caseId: number;
    caseNumber: string | null;
    caseTitle: string | null;
    status: "ok" | "failed";
    qualityScore: number | null;
    readyForSignature: boolean | null;
    blockers: string[];
    errorMessage: string | null;
  }> | null>(null);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("judgeAi.overview.hiddenSections");
      if (!raw) return new Set();
      const parsed = JSON.parse(raw) as string[];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });
  const [resetScope, setResetScope] = useState<"factory" | "program_data" | "settings" | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const prevOverdueCountRef = useRef<number | null>(null);
  const keyboardBufferRef = useRef<{ key: string; at: number } | null>(null);
  const prevJobStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("judgeAi.overview.hiddenSections", JSON.stringify(Array.from(hiddenSections)));
    } catch {
      // ignore quota errors
    }
  }, [hiddenSections]);

  useEffect(() => {
    setParagraphDrafts({});
  }, [caseId]);

  const utils = trpc.useUtils();

  const generateDraftMutation = trpc.judgeAi.drafts.generate.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.draftStarted);
      await utils.judgeAi.drafts.jobStatus.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const cancelDraftMutation = trpc.judgeAi.drafts.cancel.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.draftCancelled);
      await utils.judgeAi.drafts.jobStatus.invalidate();
      setDraftProgress(0);
      setDraftProgressElapsed(0);
    },
    onError: error => toast.error(error.message),
  });

  const jobStatusQuery = trpc.judgeAi.drafts.jobStatus.useQuery(
    { caseId: caseId ?? 0 },
    {
      enabled: Boolean(caseId),
      refetchInterval: query => {
        const status = query.state.data?.status;
        return status === "running" || status === "queued" ? 1000 : false;
      },
    }
  );

  // Watch for job completion and refresh workspace when done
  useEffect(() => {
    const status = jobStatusQuery.data?.status;
    const prevStatus = prevJobStatusRef.current;
    prevJobStatusRef.current = status ?? null;

    if (status === "completed") {
      toast.success(rt.toast.draftGenerated);
      utils.judgeAi.cases.workspace.invalidate();
      utils.judgeAi.cases.timeline.invalidate();
      setDraftProgress(0);
      setDraftProgressElapsed(0);
    } else if (status === "failed" && prevStatus !== "failed") {
      // Only toast for fresh failures, not stale ones already present when opening a case
      toast.error(jobStatusQuery.data?.errorMessage || rt.toast.draftFailed);
      setDraftProgress(0);
      setDraftProgressElapsed(0);
    }
  }, [jobStatusQuery.data?.status, jobStatusQuery.data?.errorMessage, rt, utils]);

  const isGeneratingDraft = jobStatusQuery.data?.status === "running" || jobStatusQuery.data?.status === "queued";

  useEffect(() => {
    if (!isGeneratingDraft) {
      setDraftProgress(0);
      setDraftProgressElapsed(0);
      return;
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setDraftProgressElapsed(Math.floor(elapsed));
      // If we have real job status, use stage-based progress
      const stage = jobStatusQuery.data?.stage;
      if (stage) {
        const stageProgress: Record<string, number> = {
          preparing: 5,
          analyzing: 20,
          generating: 50,
          validating: 75,
          saving: 90,
        };
        setDraftProgress(stageProgress[stage] ?? 10);
        return;
      }
      // Fallback to time-based fake progress
      let progress: number;
      if (elapsed < 10) {
        progress = (elapsed / 10) * 15;
      } else if (elapsed < 25) {
        progress = 15 + ((elapsed - 10) / 15) * 25;
      } else if (elapsed < 45) {
        progress = 40 + ((elapsed - 25) / 20) * 30;
      } else if (elapsed < 70) {
        progress = 70 + ((elapsed - 45) / 25) * 20;
      } else {
        progress = 90 + Math.min((elapsed - 70) / 60, 1) * 8;
      }
      setDraftProgress(Math.min(progress, 98));
    }, 500);
    return () => clearInterval(interval);
  }, [isGeneratingDraft, jobStatusQuery.data?.stage]);

  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, { minimumQualityScore: string; requireReadyForSignature: boolean; maxHighSeverityFindings: string; maxMediumSeverityFindings: string }>>({});
  const [comparisonReviewSnapshotId, setComparisonReviewSnapshotId] = useState<number | null>(null);
  const [localAutoApprove, setLocalAutoApprove] = useState(Boolean(user?.autoApprove));

  useEffect(() => {
    setLocalAutoApprove(Boolean(user?.autoApprove));
  }, [user?.autoApprove]);

  const casesQuery = trpc.judgeAi.cases.list.useQuery(undefined, { enabled: isAuthenticated });
  const staleReviewsQuery = trpc.judgeAi.cases.staleReviews.useQuery(undefined, { enabled: isAuthenticated });
  const usageStatsQuery = trpc.judgeAi.admin.usageStats.useQuery(
    { days: usageDashboardDays },
    { enabled: isAuthenticated && user?.role === "admin" },
  );
  const crossCaseSearchQueryResult = trpc.judgeAi.cases.crossCaseSearch.useQuery(
    { query: crossCaseSearchSubmitted },
    { enabled: isAuthenticated && crossCaseSearchSubmitted.trim().length >= 2 },
  );
  const knowledgeQuery = trpc.judgeAi.knowledge.list.useQuery(undefined, { enabled: isAuthenticated });
  const workspaceQuery = trpc.judgeAi.cases.workspace.useQuery(
    { caseId: caseId ?? 0 },
    { enabled: Boolean(isAuthenticated && caseId) },
  );
  const timelineQuery = trpc.judgeAi.cases.timeline.useQuery(
    { caseId: caseId ?? 0 },
    { enabled: Boolean(isAuthenticated && caseId) },
  );
  const searchQueryResult = trpc.judgeAi.cases.search.useQuery(
    { caseId: caseId ?? 0, query: searchQuery },
    { enabled: Boolean(isAuthenticated && caseId && searchQuery.trim().length > 1) },
  );
  const providerSettingsQuery = trpc.judgeAi.admin.listProviderSettings.useQuery(undefined, {
    enabled: Boolean(isAuthenticated),
  });
  const reviewThresholdsQuery = trpc.judgeAi.cases.reviewThresholds.useQuery(undefined, {
    enabled: Boolean(isAuthenticated),
  });
  const usersQuery = trpc.judgeAi.admin.listUsers.useQuery(undefined, {
    enabled: Boolean(isAuthenticated && user?.role === "admin"),
  });

  const createCaseMutation = trpc.judgeAi.cases.create.useMutation({
    onSuccess: async createdCase => {
      toast.success(rt.toast.caseCreated);
      setCaseForm(defaultCaseForm);
      await utils.judgeAi.cases.list.invalidate();
      if (createdCase?.id) setLocation(`/cases/${createdCase.id}`);
    },
    onError: error => toast.error(error.message),
  });

  const updateCaseMutation = trpc.judgeAi.cases.update.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.caseUpdated);
      setEditingCaseId(null);
      setEditCaseForm(defaultCaseForm);
      await utils.judgeAi.cases.list.invalidate();
      await utils.judgeAi.cases.workspace.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteCaseMutation = trpc.judgeAi.cases.delete.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.caseDeleted);
      setDeleteConfirmCaseId(null);
      await utils.judgeAi.cases.list.invalidate();
      setLocation("/cases");
    },
    onError: error => toast.error(error.message),
  });

  const uploadKnowledgeMutation = trpc.judgeAi.knowledge.upload.useMutation({
    onSuccess: async result => {
      toast.success(result.duplicateOf ? rt.toast.knowledgeDuplicate : rt.toast.knowledgeUploaded);
      setKnowledgeForm(defaultKnowledgeForm);
      setKnowledgeFile(null);
      await utils.judgeAi.knowledge.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const batchUploadKnowledgeMutation = trpc.judgeAi.knowledge.batchUpload.useMutation({
    onSuccess: async result => {
      toast.success(rt.toast.batchImportCompleted(result.importedCount, result.duplicateCount));
      setKnowledgeBatchFiles([]);
      await utils.judgeAi.knowledge.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const uploadCaseDocumentMutation = trpc.judgeAi.cases.uploadDocument.useMutation({
    onSuccess: async result => {
      toast.success(result.duplicateOf ? rt.toast.caseDocumentDuplicate : rt.toast.caseDocumentUploaded);
      setCaseFile(null);
      setCaseDocumentTitle("");
      setCaseDocumentType("pleading");
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const batchImportCaseDocumentsMutation = trpc.judgeAi.cases.batchImportDocuments.useMutation({
    onSuccess: async result => {
      toast.success(rt.toast.batchImportCompleted(result.importedCount, result.duplicateCount));
      setCaseBatchFiles([]);
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const findingResolutionsQuery = trpc.judgeAi.cases.findingResolutions.useQuery(
    { caseId: caseId ?? 0, reviewSnapshotId: caseReviewResult?.reviewSnapshotId ?? 0 },
    { enabled: Boolean(caseId && caseReviewResult?.reviewSnapshotId) },
  );

  const setFindingResolutionMutation = trpc.judgeAi.cases.setFindingResolution.useMutation({
    onSuccess: async () => {
      await findingResolutionsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const clearFindingResolutionMutation = trpc.judgeAi.cases.clearFindingResolution.useMutation({
    onSuccess: async () => {
      await findingResolutionsQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const explainFindingMutation = trpc.judgeAi.cases.explainFinding.useMutation({
    onError: error => toast.error(error.message),
  });

  const findingResolutionsMap = useMemo(() => {
    const map = new Map<number, { status: "addressed" | "accepted" | "deferred"; note: string | null }>();
    for (const row of findingResolutionsQuery.data ?? []) {
      map.set(row.findingIndex, { status: row.status, note: row.note });
    }
    return map;
  }, [findingResolutionsQuery.data]);

  async function handleSetFindingResolution(
    findingIndex: number,
    status: "addressed" | "accepted" | "deferred",
    note: string | null,
  ) {
    if (!caseId || !caseReviewResult?.reviewSnapshotId) return;
    try {
      await setFindingResolutionMutation.mutateAsync({
        caseId,
        reviewSnapshotId: caseReviewResult.reviewSnapshotId,
        findingIndex,
        status,
        note,
      });
    } catch {
      // handled in onError
    }
  }

  async function handleClearFindingResolution(findingIndex: number) {
    if (!caseId || !caseReviewResult?.reviewSnapshotId) return;
    try {
      await clearFindingResolutionMutation.mutateAsync({
        caseId,
        reviewSnapshotId: caseReviewResult.reviewSnapshotId,
        findingIndex,
      });
    } catch {
      // handled in onError
    }
  }

  async function handleExplainFinding(findingIndex: number) {
    if (!caseId || !caseReviewResult?.reviewSnapshotId) return;
    try {
      const result = await explainFindingMutation.mutateAsync({
        caseId,
        reviewSnapshotId: caseReviewResult.reviewSnapshotId,
        findingIndex,
      });
      setFindingExplanations(prev => {
        const next = new Map(prev);
        next.set(findingIndex, result.explanation);
        return next;
      });
    } catch {
      // handled in onError
    }
  }

  const reviewJudgmentMutation = trpc.judgeAi.cases.reviewJudgment.useMutation({
    onSuccess: async result => {
      toast.success(rt.toast.reviewCompleted);
      setCaseReviewResult(result);
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const reviewBatchMutation = trpc.judgeAi.cases.reviewBatch.useMutation({
    onSuccess: async result => {
      setBatchReviewOutcomes(result.outcomes);
      const failed = result.outcomes.filter(outcome => outcome.status === "failed").length;
      if (failed === 0) {
        toast.success(rt.toast.batchReviewCompleted);
      } else {
        toast.info(rt.toast.batchReviewCompletedWithErrors.replace("{count}", String(failed)));
      }
      await utils.judgeAi.cases.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!reviewJudgmentMutation.isPending) {
      setReviewProgress(0);
      setReviewProgressElapsed(0);
      return;
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setReviewProgressElapsed(Math.floor(elapsed));
      let progress: number;
      if (elapsed < 10) {
        progress = (elapsed / 10) * 20;
      } else if (elapsed < 25) {
        progress = 20 + ((elapsed - 10) / 15) * 30;
      } else if (elapsed < 45) {
        progress = 50 + ((elapsed - 25) / 20) * 25;
      } else if (elapsed < 70) {
        progress = 75 + ((elapsed - 45) / 25) * 15;
      } else {
        progress = 90 + Math.min((elapsed - 70) / 60, 1) * 8;
      }
      setReviewProgress(Math.min(progress, 98));
    }, 500);
    return () => clearInterval(interval);
  }, [reviewJudgmentMutation.isPending]);

  const updateParagraphMutation = trpc.judgeAi.drafts.updateParagraph.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.paragraphSaved);
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const updateSectionMutation = trpc.judgeAi.drafts.updateSection.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.sectionStatusUpdated);
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const approveDraftMutation = trpc.judgeAi.drafts.approve.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.draftApproved);
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const saveSectionNoteMutation = trpc.judgeAi.drafts.saveSectionNote.useMutation({
    onSuccess: async () => {
      await utils.judgeAi.cases.workspace.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const transcribeSectionNoteMutation = trpc.judgeAi.drafts.transcribeSectionNote.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.voiceNoteSaved);
      await utils.judgeAi.cases.workspace.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const exportCaseBundleMutation = trpc.judgeAi.cases.exportBundle.useMutation({
    onSuccess: async result => {
      toast.success(rt.toast.caseBundleExported);
      if (result?.fileUrl) {
        window.open(result.fileUrl, "_blank", "noopener,noreferrer");
      }
      await utils.judgeAi.cases.workspace.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const exportDraftMutation = trpc.judgeAi.drafts.exportDocx.useMutation({
    onSuccess: async exported => {
      toast.success(rt.toast.docxExportCreated);
      const unresolved = (exported as { unresolvedCitations?: Array<{ citation: string; occurrences: number }> })?.unresolvedCitations ?? [];
      if (unresolved.length > 0) {
        const preview = unresolved.slice(0, 5).map(u => u.citation).join(", ");
        const suffix = unresolved.length > 5 ? ` (+${unresolved.length - 5})` : "";
        toast.warning(
          rt.toast.citationsUnresolved
            .replace("{count}", String(unresolved.length))
            .replace("{preview}", `${preview}${suffix}`),
          { duration: 10000 },
        );
      }
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
      if (caseId && exported?.id) {
        try {
          const download = await utils.client.judgeAi.drafts.exportDownloadUrl.query({ caseId, exportId: exported.id });
          if (download?.url) window.open(download.url, "_blank", "noopener,noreferrer");
        } catch (err) {
          toast.error(rt.toast.downloadLinkFailed);
          console.error(err);
        }
      }
    },
    onError: error => toast.error(error.message),
  });

  const saveReviewThresholdMutation = trpc.judgeAi.cases.saveReviewThreshold.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.thresholdSaved);
      await reviewThresholdsQuery.refetch();
      await utils.judgeAi.cases.workspace.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const toggleAutoApproveMutation = trpc.judgeAi.admin.toggleAutoApprove.useMutation({
    onSuccess: async () => {
      toast.success(localAutoApprove ? rt.toast.autoApproveDisabled : rt.toast.autoApproveEnabled);
      await utils.auth.me.refetch();
    },
    onError: error => {
      toast.error(error.message);
      setLocalAutoApprove(Boolean(user?.autoApprove));
    },
  });

  const exportReviewReportMutation = trpc.judgeAi.cases.exportReviewReport.useMutation({
    onSuccess: exportResult => {
      toast.success(exportResult?.format === "pdf" ? rt.toast.signedPdfExported : rt.toast.reviewReportExported);
      if (exportResult?.fileUrl) {
        window.open(exportResult.fileUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: error => toast.error(error.message),
  });

  const saveProviderMutation = trpc.judgeAi.admin.saveProviderSettings.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.providerSaved);
      setProviderForm(defaultProviderForm);
      setProviderTestResult(null);
      await utils.judgeAi.admin.listProviderSettings.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const testProviderMutation = trpc.judgeAi.admin.testProviderSettings.useMutation({
    onSuccess: result => {
      setProviderTestResult({ ok: true, message: `${ui.admin.testProviderSuccess} — ${result.message}` });
    },
    onError: error => {
      setProviderTestResult({ ok: false, message: `${ui.admin.testProviderFail}: ${error.message}` });
    },
  });

  const activateProviderMutation = trpc.judgeAi.admin.activateProviderSettings.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.activeProviderUpdated);
      await utils.judgeAi.admin.listProviderSettings.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const ocrSettingsQuery = trpc.judgeAi.admin.getOcrSettings.useQuery(undefined, { enabled: Boolean(isAuthenticated) });

  const saveOcrSettingsMutation = trpc.judgeAi.admin.saveOcrSettings.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.settingsSaved);
      await utils.judgeAi.admin.getOcrSettings.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const testOcrMutation = trpc.judgeAi.admin.testOcr.useMutation({
    onSuccess: result => {
      setOcrTestResult(result.text ?? "");
      toast.success(rt.toast.ocrTestSuccess);
    },
    onError: error => {
      setOcrTestResult("");
      toast.error(error.message);
    },
  });

  const updateUserMutation = trpc.judgeAi.admin.updateUser.useMutation({
    onSuccess: async () => {
      toast.success(rt.toast.userUpdated);
      await utils.judgeAi.admin.listUsers.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const updateCaseStatusMutation = trpc.judgeAi.cases.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.judgeAi.cases.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const resetSystemMutation = trpc.judgeAi.admin.resetSystem.useMutation({
    onSuccess: async result => {
      toast.success(
        result.scope === "factory"
          ? "Factory reset completed"
          : result.scope === "settings"
            ? "Settings cleared"
            : "Program data cleared",
      );
      setResetScope(null);
      setResetConfirmText("");
      await Promise.all([
        utils.judgeAi.cases.list.invalidate(),
        utils.judgeAi.knowledge.list.invalidate(),
        utils.judgeAi.admin.listProviderSettings.invalidate(),
        utils.judgeAi.cases.reviewThresholds.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const thresholdRows = reviewThresholdsQuery.data ?? [];
    if (!thresholdRows.length) return;
    setThresholdDrafts(current => {
      const next = { ...current };
      for (const item of thresholdRows) {
        next[String(item.caseTypeKey)] = {
          minimumQualityScore: String(item.minimumQualityScore ?? ""),
          requireReadyForSignature: Boolean(item.requireReadyForSignature),
          maxHighSeverityFindings: String(item.maxHighSeverityFindings ?? ""),
          maxMediumSeverityFindings: String(item.maxMediumSeverityFindings ?? ""),
        };
      }
      return next;
    });
  }, [reviewThresholdsQuery.data]);

  useEffect(() => {
    const latestSavedReview = workspaceQuery.data?.reviewHistory?.[0];
    if (!latestSavedReview) return;
    setCaseReviewResult((current: any) => {
      if (current?.reviewSnapshotId === latestSavedReview.id) return current;
      return toSavedReviewResult(latestSavedReview);
    });
  }, [workspaceQuery.data?.reviewHistory]);

  useEffect(() => {
    setReviewedFindingIndices(new Set());
    setActiveTimelineIndex(0);
  }, [caseReviewResult?.reviewSnapshotId]);

  const activeDraft = useMemo(() => workspaceQuery.data?.latestDraft ?? null, [workspaceQuery.data]);
  const latestDraftText = useMemo(
    () => activeDraft?.sections?.map((section: any) => `${section.sectionTitle}\n${section.sectionText}`).join("\n\n") ?? "",
    [activeDraft],
  );
  const latestReasoningText = useMemo(
    () => activeDraft?.sections?.find((section: any) => section.sectionKey === "reasoning")?.sectionText ?? "",
    [activeDraft],
  );
  const reviewHistory = useMemo(() => (workspaceQuery.data?.reviewHistory ?? []) as ReviewSnapshot[], [workspaceQuery.data]);
  const selectedReviewSnapshot = useMemo(() => {
    const selectedId = caseReviewResult?.reviewSnapshotId ?? reviewHistory[0]?.id ?? null;
    return reviewHistory.find(snapshot => snapshot.id === selectedId) ?? reviewHistory[0] ?? null;
  }, [caseReviewResult, reviewHistory]);
  useEffect(() => {
    if (!reviewHistory.length) return;
    setComparisonReviewSnapshotId(current => {
      if (current && current !== selectedReviewSnapshot?.id && reviewHistory.some(snapshot => snapshot.id === current)) {
        return current;
      }
      return reviewHistory.find(snapshot => snapshot.id !== selectedReviewSnapshot?.id)?.id ?? null;
    });
  }, [reviewHistory, selectedReviewSnapshot?.id]);
  const comparisonReviewSnapshot = useMemo(() => {
    if (!selectedReviewSnapshot) return null;
    return reviewHistory.find(snapshot => snapshot.id === comparisonReviewSnapshotId && snapshot.id !== selectedReviewSnapshot.id)
      ?? reviewHistory.find(snapshot => snapshot.id !== selectedReviewSnapshot.id)
      ?? null;
  }, [comparisonReviewSnapshotId, reviewHistory, selectedReviewSnapshot]);
  const reviewComparison = useMemo(() => buildReviewComparison(selectedReviewSnapshot, comparisonReviewSnapshot, locale), [comparisonReviewSnapshot, locale, selectedReviewSnapshot]);
  const approvalThresholdRows = useMemo(() => reviewThresholdsQuery.data ?? workspaceQuery.data?.reviewThresholds ?? [], [reviewThresholdsQuery.data, workspaceQuery.data]);
  const approvalGateMessage = useMemo(() => {
    if (localAutoApprove) return null;
    if (!caseReviewResult) return ui.workspace.reviewBeforeApproval;
    if (caseReviewResult.thresholdEvaluation?.blockers?.length) {
      return caseReviewResult.thresholdEvaluation.blockers[0];
    }
    if (!caseReviewResult.preSignatureReview?.readyForSignature) {
      return caseReviewResult.preSignatureReview?.blockers?.[0] ?? ui.workspace.resolveReviewBlockers;
    }
    return null;
  }, [caseReviewResult, localAutoApprove, ui.workspace.resolveReviewBlockers, ui.workspace.reviewBeforeApproval]);

  // Workspace keyboard shortcuts: number keys switch tabs, "?" shows a help
  // toast, "a" approves on the review tab. Only fires when the case workspace
  // is open and no text input has focus.
  useEffect(() => {
    if (!caseId) return;
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (event.key === "1") {
        event.preventDefault();
        setActiveTab("documents");
      } else if (event.key === "2") {
        event.preventDefault();
        setActiveTab("draft");
      } else if (event.key === "3") {
        event.preventDefault();
        setActiveTab("review");
      } else if (event.key === "4") {
        event.preventDefault();
        setActiveTab("history");
      } else if (event.key === "?") {
        event.preventDefault();
        toast.info(rt.toast.workspaceShortcutsHelp, { duration: 6000 });
      } else if (event.key === "a" || event.key === "A") {
        if (activeTab !== "review") return;
        if (!caseId) return;
        if (!activeDraft || activeDraft.status === "approved") return;
        if (approveDraftMutation.isPending) return;
        event.preventDefault();
        if (approvalGateMessage) {
          toast.error(approvalGateMessage);
          return;
        }
        approveDraftMutation.mutate({ caseId, draftId: activeDraft.id });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [caseId, rt.toast.workspaceShortcutsHelp, activeTab, activeDraft, approvalGateMessage, approveDraftMutation]);

  const searchResults = useMemo(() => {
    const payload = searchQueryResult.data;
    if (!payload) return [] as Array<{ id: number; sourceType: string; title: string; snippet?: string | null }>;

    return [
      ...(payload.caseDocuments ?? []).map(item => ({
        id: item.id,
        sourceType: item.documentType,
        title: item.title,
        snippet: item.extractedText,
      })),
      ...(payload.knowledgeDocuments ?? []).map(item => ({
        id: item.id,
        sourceType: item.documentType,
        title: item.title,
        snippet: item.summary ?? item.extractedText,
      })),
    ];
  }, [searchQueryResult.data]);

  const totals = {
    cases: casesQuery.data?.length ?? 0,
    knowledge: knowledgeQuery.data?.length ?? 0,
    readyDrafts: (casesQuery.data ?? []).filter(item => item.status === "approved" || item.status === "under_review").length,
    uploads: (workspaceQuery.data?.documents?.length ?? 0) + (knowledgeQuery.data?.length ?? 0),
  };

  const intakeQueue = useMemo(() => buildIntakeQueue(casesQuery.data ?? []), [casesQuery.data]);

  const intakeMetrics = useMemo(() => buildIntakeMetrics(intakeQueue), [intakeQueue]);

  const filteredIntakeQueue = useMemo(() => {
    const query = intakeSearch.trim().toLowerCase();
    return intakeQueue.filter(item => {
      if (intakePriorityFilter !== "all" && item.priorityLevel !== intakePriorityFilter) {
        return false;
      }
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.caseNumber.toLowerCase().includes(query) ||
        item.caseType.toLowerCase().includes(query) ||
        item.courtLevel.toLowerCase().includes(query)
      );
    });
  }, [intakeQueue, intakeSearch, intakePriorityFilter]);

  const throughputStats = useMemo(() => {
    const data = casesQuery.data ?? [];
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const approvedLastSevenDays = data.filter(item => {
      if (item.status !== "approved") return false;
      return now - new Date(item.updatedAt).getTime() <= sevenDays;
    }).length;
    const approvedLastThirtyDays = data.filter(item => {
      if (item.status !== "approved") return false;
      return now - new Date(item.updatedAt).getTime() <= thirtyDays;
    }).length;
    const openCases = data.filter(item => item.status !== "approved" && item.status !== "archived");
    const avgAgeDays = openCases.length
      ? openCases.reduce((acc, item) => acc + (now - new Date(item.updatedAt).getTime()), 0)
        / openCases.length
        / (24 * 60 * 60 * 1000)
      : 0;
    return {
      approvedLastSevenDays,
      approvedLastThirtyDays,
      avgAgeDays: Math.round(avgAgeDays * 10) / 10,
      openCount: openCases.length,
    };
  }, [casesQuery.data]);

  useEffect(() => {
    const current = intakeMetrics.overdue;
    const prev = prevOverdueCountRef.current;
    if (prev !== null && current > prev) {
      const delta = current - prev;
      toast.warning(
        locale === "el"
          ? `${delta} νέα εκπρόθεσμη${delta === 1 ? "" : "ς"} υπόθεση`
          : `${delta} new overdue matter${delta === 1 ? "" : "s"}`,
      );
    }
    prevOverdueCountRef.current = current;
  }, [intakeMetrics.overdue, locale]);

  useEffect(() => {
    if (!isAuthenticated) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        setShowKeyboardHelp(true);
        return;
      }
      if (event.key === "Escape") {
        setShowKeyboardHelp(false);
        return;
      }
      const now = Date.now();
      const buffer = keyboardBufferRef.current;
      if (buffer && buffer.key === "g" && now - buffer.at < 1200) {
        keyboardBufferRef.current = null;
        if (event.key === "c") {
          event.preventDefault();
          setLocation("/cases");
          return;
        }
        if (event.key === "k") {
          event.preventDefault();
          setLocation("/knowledge");
          return;
        }
        if (event.key === "o") {
          event.preventDefault();
          setLocation("/");
          return;
        }
        if (event.key === "a" && user?.role === "admin") {
          event.preventDefault();
          setLocation("/admin");
          return;
        }
      }
      if (event.key === "g") {
        keyboardBufferRef.current = { key: "g", at: now };
        return;
      }
      if (event.key === "n") {
        event.preventDefault();
        setLocation("/cases");
        setShowNewCaseForm(true);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAuthenticated, setLocation, user?.role]);

  function handleAdvanceStage(item: { id: number; status: string }) {
    const progression: Record<string, string> = {
      created: "document_review",
      document_review: "drafting",
      drafting: "under_review",
      under_review: "approved",
    };
    const next = progression[item.status];
    if (!next) return;
    updateCaseStatusMutation.mutate({ caseId: item.id, status: next as any });
  }

  function handleExportTimelineCsv() {
    const events = caseReviewResult?.chronologicalEvents ?? [];
    if (!events.length) {
      toast.info(rt.toast.noTimelineEvents);
      return;
    }
    const header = ["#", "Date", "Event", "Significance"];
    const escape = (value: unknown) => {
      const text = value == null ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [
      header.join(","),
      ...events.map((event, index) =>
        [String(index + 1), event.date, event.event, event.significance ?? ""].map(escape).join(","),
      ),
    ];
    const caseLabel = workspaceQuery.data?.case?.caseNumber?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "case";
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `timeline-${caseLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleToggleBatchSelection(caseIdToToggle: number) {
    setBatchSelectedCaseIds(current => {
      const next = new Set(current);
      if (next.has(caseIdToToggle)) next.delete(caseIdToToggle);
      else next.add(caseIdToToggle);
      return next;
    });
  }

  function handleSelectAllVisibleForBatch() {
    const visibleIds = filteredIntakeQueue.map(item => item.id);
    setBatchSelectedCaseIds(new Set(visibleIds));
  }

  function handleClearBatchSelection() {
    setBatchSelectedCaseIds(new Set());
    setBatchReviewOutcomes(null);
  }

  async function handleRunBatchReview() {
    const ids = Array.from(batchSelectedCaseIds);
    if (!ids.length) {
      toast.info(rt.toast.batchReviewNoSelection);
      return;
    }
    try {
      await reviewBatchMutation.mutateAsync({
        caseIds: ids,
        reviewTemplateKey: "inheritance",
      });
    } catch {
      // toast handled in onError
    }
  }

  function handleExportIntakeCsv() {
    const rows = filteredIntakeQueue;
    if (!rows.length) {
      toast.info(rt.toast.noCasesToExport);
      return;
    }
    const header = ["Case number", "Title", "Case type", "Court level", "Status", "Priority", "Deadline", "Updated at"];
    const escape = (value: unknown) => {
      const text = value == null ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const lines = [
      header.join(","),
      ...rows.map(item =>
        [
          item.caseNumber,
          item.title,
          item.caseType,
          item.courtLevel,
          item.status,
          item.priorityLevel,
          item.deadlineState,
          new Date(item.updatedAt).toISOString(),
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `intake-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleToggleSection(id: string, next: boolean) {
    setHiddenSections(current => {
      const updated = new Set(current);
      if (next) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  }

  async function handleConfirmReset() {
    if (!resetScope) return;
    try {
      await resetSystemMutation.mutateAsync({ scope: resetScope, confirmation: "RESET" });
    } catch {
      // toast handled in onError
    }
  }

  async function handleCreateCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createCaseMutation.mutateAsync({
        ...caseForm,
        summary: caseForm.summary || null,
        parties: [],
      });
    } catch {
      // Error already toasted by onError
    }
  }

  function handleStartEditCase(item: { id: number; caseNumber: string; title: string; jurisdictionCode: string; courtLevel: string; caseType: string; summary: string | null; languageCode: string | null }) {
    setEditingCaseId(item.id);
    setEditCaseForm({
      caseNumber: item.caseNumber,
      title: item.title,
      jurisdictionCode: item.jurisdictionCode,
      courtLevel: item.courtLevel,
      caseType: item.caseType,
      summary: item.summary ?? "",
      languageCode: item.languageCode ?? "el",
    });
  }

  function handleCancelEditCase() {
    setEditingCaseId(null);
    setEditCaseForm(defaultCaseForm);
  }

  async function handleUpdateCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCaseId) return;
    try {
      await updateCaseMutation.mutateAsync({
        caseId: editingCaseId,
        ...editCaseForm,
        summary: editCaseForm.summary || null,
      });
    } catch {
      // Error already toasted by onError
    }
  }

  async function handleKnowledgeUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!knowledgeFile) {
      toast.error(rt.toast.chooseKnowledgeFile);
      return;
    }
    try {
      const base64Content = await fileToBase64(knowledgeFile);
      await uploadKnowledgeMutation.mutateAsync({
        ...knowledgeForm,
        courtLevel: knowledgeForm.courtLevel || null,
        citation: knowledgeForm.citation || null,
        sourceReference: knowledgeForm.sourceReference || null,
        fileName: knowledgeFile.name,
        mimeType: knowledgeFile.type || "application/octet-stream",
        base64Content,
        metadataJson: { originalSize: knowledgeFile.size },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : rt.toast.uploadFailed);
    }
  }

  async function handleCaseDocumentUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    if (!caseFile) {
      toast.error(rt.toast.chooseCaseFile);
      return;
    }
    try {
      const base64Content = await fileToBase64(caseFile);
      await uploadCaseDocumentMutation.mutateAsync({
        caseId,
        title: caseDocumentTitle || caseFile.name,
        documentType: caseDocumentType as "pleading" | "evidence" | "supporting" | "reference" | "decision" | "other",
        fileName: caseFile.name,
        mimeType: caseFile.type || "application/octet-stream",
        base64Content,
        metadataJson: { originalSize: caseFile.size },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : rt.toast.uploadFailed);
    }
  }

  async function handleKnowledgeBatchUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!knowledgeBatchFiles.length) {
      toast.error(rt.toast.chooseKnowledgeFiles);
      return;
    }
    try {
      const files = await filesToBatchPayload(knowledgeBatchFiles);
      await batchUploadKnowledgeMutation.mutateAsync({
        jurisdictionCode: knowledgeForm.jurisdictionCode || "GENERAL",
        courtLevel: knowledgeForm.courtLevel || null,
        files,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : rt.toast.batchUploadFailed);
    }
  }

  async function handleCaseBatchUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    if (!caseBatchFiles.length) {
      toast.error(rt.toast.chooseCaseFiles);
      return;
    }
    try {
      const files = await filesToBatchPayload(caseBatchFiles);
      await batchImportCaseDocumentsMutation.mutateAsync({ caseId, files });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : rt.toast.batchImportFailed);
    }
  }

  async function handleCaseReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return;
    try {
      await reviewJudgmentMutation.mutateAsync({
        caseId,
        judgmentText: judgmentReviewText.trim() || null,
        reviewTemplateKey: selectedReviewTemplate,
        reviewTemplateFocus: reviewTemplateFocus.trim() || null,
      });
    } catch {
      // Error already toasted by onError
    }
  }

  async function handleProviderSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveProviderMutation.mutateAsync({
        id: providerForm.id,
        name: providerForm.name,
        providerType: providerForm.providerType,
        endpoint: providerForm.endpoint,
        model: providerForm.model,
        apiKey: providerForm.apiKey || null,
        azureApiVersion: providerForm.azureApiVersion || null,
        defaultSystemPrompt: providerForm.defaultSystemPrompt || null,
        draftTemperature: providerForm.draftTemperature || null,
        maxTokens: providerForm.maxTokens ? Number(providerForm.maxTokens) : null,
      });
    } catch {
      // Error already toasted by onError
    }
  }

  const actions = (
    <>
      <Button variant="outline" className="rounded-2xl border-stone-300/80 bg-white/92 px-5 text-stone-700 shadow-[0_12px_30px_-20px_rgba(31,41,55,0.22)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => setLocation("/knowledge")}>{copy.shell.knowledgeBaseAction}</Button>
      <Button className="rounded-2xl bg-[linear-gradient(135deg,#1f2538_0%,#30374c_100%)] px-5 text-stone-50 shadow-[0_18px_38px_-22px_rgba(27,35,54,0.72)] hover:opacity-95 dark:bg-[linear-gradient(135deg,#f4efe2_0%,#dfd4bc_100%)] dark:text-stone-900" onClick={() => setLocation("/cases")}>{copy.shell.openCasesAction}</Button>
    </>
  );

  function renderOverview() {
    const recentCases = (casesQuery.data ?? []).slice(0, 4);
    const recentKnowledge = (knowledgeQuery.data ?? []).slice(0, 5);
    const displayedIntake = filteredIntakeQueue.slice(0, 5);
    const hasIntakeFilters = intakeSearch.trim().length > 0 || intakePriorityFilter !== "all";
    const intakePriorityLabels = {
      critical: copy.overview.intakePriorityCritical,
      high: copy.overview.intakePriorityHigh,
      normal: copy.overview.intakePriorityNormal,
    } as const;
    const intakeDeadlineLabels = {
      overdue: copy.overview.overdue,
      dueSoon: copy.overview.dueSoon,
      onTrack: copy.overview.deadlineOnTrack,
    } as const;
    const intakeStageSummary = {
      created: copy.overview.intakeCreatedSummary,
      document_review: copy.overview.intakeDocumentsSummary,
      drafting: copy.overview.intakeDraftingSummary,
      under_review: copy.overview.intakeReviewSummary,
      approved: copy.overview.intakeApprovedSummary,
    } as const;
    const stageProgression: Record<string, string | null> = {
      created: "document_review",
      document_review: "drafting",
      drafting: "under_review",
      under_review: "approved",
      approved: null,
    };

    const sectionToggles: Array<{ id: string; label: string }> = [
      { id: "focus", label: copy.overview.sectionFocus },
      { id: "intake", label: copy.overview.sectionIntake },
      { id: "throughput", label: copy.overview.sectionThroughput },
      { id: "recent", label: copy.overview.sectionRecent },
      { id: "knowledge", label: copy.overview.sectionKnowledge },
      { id: "governance", label: copy.overview.sectionGovernance },
    ];

    const intakeCardActions = (
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={intakeSearch}
            onChange={event => setIntakeSearch(event.target.value)}
            placeholder={copy.overview.searchPlaceholder}
            className="h-9 w-60 rounded-xl pl-9 text-sm"
          />
        </div>
        <select
          value={intakePriorityFilter}
          onChange={event => setIntakePriorityFilter(event.target.value as typeof intakePriorityFilter)}
          className="h-9 rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-700 dark:border-stone-700 dark:bg-[#151923] dark:text-stone-200"
        >
          <option value="all">{copy.overview.filterAll}</option>
          <option value="critical">{copy.overview.filterCritical}</option>
          <option value="high">{copy.overview.filterHigh}</option>
          <option value="normal">{copy.overview.filterNormal}</option>
        </select>
        {hasIntakeFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl"
            onClick={() => {
              setIntakeSearch("");
              setIntakePriorityFilter("all");
            }}
          >
            <X className="mr-1 h-4 w-4" />
            {copy.overview.clearFilters}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl"
          onClick={handleExportIntakeCsv}
          disabled={!filteredIntakeQueue.length}
        >
          <Download className="mr-1 h-4 w-4" />
          {copy.overview.exportCsv}
        </Button>
      </div>
    );

    const overviewHeaderActions = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl">
            <Eye className="mr-1 h-4 w-4" />
            {copy.overview.customizeTitle}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{copy.overview.customizeLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sectionToggles.map(section => (
            <DropdownMenuCheckboxItem
              key={section.id}
              checked={!hiddenSections.has(section.id)}
              onCheckedChange={next => handleToggleSection(section.id, Boolean(next))}
            >
              {section.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {overviewHeaderActions}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
          <MetricCard label={copy.overview.activeCases} value={totals.cases} detail={copy.overview.activeCasesDetail} icon={Gavel} />
          <MetricCard label={copy.overview.knowledgeItems} value={totals.knowledge} detail={copy.overview.knowledgeItemsDetail} icon={BookCopy} />
          <MetricCard label={copy.overview.draftReady} value={totals.readyDrafts} detail={copy.overview.draftReadyDetail} icon={Sparkles} />
          <MetricCard label={copy.overview.indexedDocuments} value={totals.uploads} detail={copy.overview.indexedDocumentsDetail} icon={History} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-6 min-w-0">

            {hiddenSections.has("focus") ? null : (
              <ShellCard
                title={copy.overview.focusTitle}
                description={copy.overview.focusDescription}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,239,230,0.95))] p-5 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{copy.overview.curateLawTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{copy.overview.curateLawDescription}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,239,230,0.95))] p-5 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{copy.overview.assembleCaseTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{copy.overview.assembleCaseDescription}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,239,230,0.95))] p-5 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{copy.overview.refineDraftTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{copy.overview.refineDraftDescription}</p>
                  </div>
                </div>
              </ShellCard>
            )}

            <ShellCard
              title={copy.overview.crossCaseSearchTitle}
              description={copy.overview.crossCaseSearchDescription}
            >
              <div className="space-y-4">
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    setCrossCaseSearchSubmitted(crossCaseSearchQuery.trim());
                  }}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    type="search"
                    value={crossCaseSearchQuery}
                    onChange={event => setCrossCaseSearchQuery(event.target.value)}
                    placeholder={copy.overview.crossCaseSearchPlaceholder}
                    className="h-11 flex-1 rounded-xl border border-stone-300/80 bg-white px-4 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-400"
                  />
                  <Button type="submit" className="rounded-xl" disabled={crossCaseSearchQuery.trim().length < 2}>
                    {copy.overview.crossCaseSearchAction}
                  </Button>
                  {crossCaseSearchSubmitted ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => {
                        setCrossCaseSearchQuery("");
                        setCrossCaseSearchSubmitted("");
                      }}
                    >
                      {copy.overview.crossCaseSearchClear}
                    </Button>
                  ) : null}
                </form>
                {crossCaseSearchSubmitted ? (
                  crossCaseSearchQueryResult.isFetching ? (
                    <p className="text-sm text-stone-500 dark:text-stone-400">{copy.overview.crossCaseSearchLoading}</p>
                  ) : (() => {
                    const caseHits = crossCaseSearchQueryResult.data?.caseDocuments ?? [];
                    const knowledgeHits = crossCaseSearchQueryResult.data?.knowledgeDocuments ?? [];
                    if (caseHits.length === 0 && knowledgeHits.length === 0) {
                      return <p className="text-sm text-stone-500 dark:text-stone-400">{copy.overview.crossCaseSearchEmpty}</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {caseHits.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                              {copy.overview.crossCaseSearchCaseHits} ({caseHits.length})
                            </p>
                            {caseHits.slice(0, 15).map(hit => {
                              const snippet = (hit.extractedText ?? "").slice(0, 240);
                              return (
                                <button
                                  key={`case-${hit.id}`}
                                  type="button"
                                  onClick={() => setLocation(`/cases/${hit.caseId}`)}
                                  className="w-full rounded-xl border border-stone-200/80 bg-white px-4 py-3 text-left shadow-sm transition hover:border-stone-300 hover:shadow-md dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,29,40,0.98)_0%,rgba(15,18,27,0.99)_100%)]"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-stone-950 dark:text-stone-100">{hit.title ?? hit.fileName}</p>
                                    {hit.caseNumber ? <StatusPill>{hit.caseNumber}</StatusPill> : null}
                                  </div>
                                  {hit.caseTitle ? (
                                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{hit.caseTitle}</p>
                                  ) : null}
                                  {snippet ? (
                                    <p className="mt-2 line-clamp-2 text-sm text-stone-600 dark:text-stone-300">{snippet}</p>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {knowledgeHits.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                              {copy.overview.crossCaseSearchKnowledgeHits} ({knowledgeHits.length})
                            </p>
                            {knowledgeHits.slice(0, 10).map(hit => (
                              <div
                                key={`kb-${hit.id}`}
                                className="rounded-xl border border-stone-200/80 bg-white px-4 py-3 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,29,40,0.98)_0%,rgba(15,18,27,0.99)_100%)]"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-stone-950 dark:text-stone-100">{hit.title}</p>
                                  {hit.citation ? <StatusPill>{hit.citation}</StatusPill> : null}
                                </div>
                                {hit.summary ? (
                                  <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-300">{hit.summary}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                ) : null}
              </div>
            </ShellCard>

            {(staleReviewsQuery.data?.length ?? 0) > 0 ? (
              <div className="rounded-[1.35rem] border border-amber-200/80 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      {copy.overview.staleReviewTitle.replace("{count}", String(staleReviewsQuery.data?.length ?? 0))}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                      {copy.overview.staleReviewDescription}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl shrink-0"
                    onClick={async () => {
                      const ids = (staleReviewsQuery.data ?? []).map(c => c.id);
                      if (!ids.length) return;
                      setBatchSelectedCaseIds(new Set(ids));
                      try {
                        await reviewBatchMutation.mutateAsync({
                          caseIds: ids,
                          reviewTemplateKey: "inheritance",
                        });
                        await staleReviewsQuery.refetch();
                      } catch {
                        // toast via mutation onError
                      }
                    }}
                    disabled={reviewBatchMutation.isPending}
                  >
                    {reviewBatchMutation.isPending
                      ? copy.overview.batchReviewRunning
                      : copy.overview.staleReviewRunNow}
                  </Button>
                </div>
              </div>
            ) : null}

            {hiddenSections.has("intake") ? null : (
              <ShellCard title={copy.overview.intakeTitle} description={copy.overview.intakeDescription} actions={intakeCardActions}>
                <div className="space-y-5 min-w-0">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard label={copy.overview.priorityNow} value={intakeMetrics.priorityNow} detail={copy.overview.priorityNowDetail} icon={FilePlus2} />
                    <MetricCard label={copy.overview.dueSoon} value={intakeMetrics.dueSoon} detail={copy.overview.dueSoonDetail} icon={History} />
                    <MetricCard label={copy.overview.overdue} value={intakeMetrics.overdue} detail={copy.overview.overdueDetail} icon={ShieldCheck} />
                  </div>
                  <div className="space-y-3 min-w-0">
                    <div className="rounded-[1.35rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,239,230,0.92))] px-4 py-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,29,40,0.98)_0%,rgba(15,18,27,0.99)_100%)]">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{copy.overview.priorityQueueTitle}</p>
                      <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{copy.overview.priorityQueueDescription}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={handleSelectAllVisibleForBatch}
                          disabled={!displayedIntake.length || reviewBatchMutation.isPending}
                        >
                          {copy.overview.batchReviewSelectAll}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={handleClearBatchSelection}
                          disabled={batchSelectedCaseIds.size === 0 || reviewBatchMutation.isPending}
                        >
                          {copy.overview.batchReviewClear}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          onClick={handleRunBatchReview}
                          disabled={batchSelectedCaseIds.size === 0 || reviewBatchMutation.isPending}
                        >
                          {reviewBatchMutation.isPending
                            ? copy.overview.batchReviewRunning
                            : copy.overview.batchReviewRun}
                        </Button>
                        {batchSelectedCaseIds.size > 0 ? (
                          <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                            {copy.overview.batchReviewSelected.replace("{count}", String(batchSelectedCaseIds.size))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {displayedIntake.length ? (
                      displayedIntake.map(item => (
                        <div key={item.id} className="rounded-[1.35rem] border border-stone-200/80 bg-white/92 px-4 py-4 shadow-[0_14px_34px_-24px_rgba(31,41,55,0.2)] dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,29,40,0.98)_0%,rgba(15,18,27,0.99)_100%)]">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <input
                                type="checkbox"
                                checked={batchSelectedCaseIds.has(item.id)}
                                onChange={() => handleToggleBatchSelection(item.id)}
                                disabled={reviewBatchMutation.isPending}
                                aria-label={`${copy.overview.batchReviewRun} · ${item.caseNumber}`}
                                className="mt-1 h-4 w-4 cursor-pointer rounded border-stone-300 text-stone-900 focus:ring-stone-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-600 dark:text-stone-100 dark:focus:ring-stone-400"
                              />
                              <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-stone-950 dark:text-stone-100 break-words">{item.title}</p>
                                <StatusPill>{intakePriorityLabels[item.priorityLevel as keyof typeof intakePriorityLabels]}</StatusPill>
                                <StatusPill>{intakeDeadlineLabels[item.deadlineState as keyof typeof intakeDeadlineLabels]}</StatusPill>
                              </div>
                              <p className="mt-2 text-sm text-stone-600 dark:text-stone-200 break-words">{item.caseNumber} · {item.caseType} · {item.courtLevel}</p>
                              <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-200">{intakeStageSummary[item.status as keyof typeof intakeStageSummary] ?? copy.overview.intakeReviewSummary}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                              <p className="text-sm text-stone-500 dark:text-stone-300">{copy.overview.updatedPrefix} {formatTimestamp(item.updatedAt)}</p>
                              <div className="flex flex-wrap gap-2 md:justify-end">
                                {stageProgression[item.status] ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => handleAdvanceStage(item)}
                                    disabled={updateCaseStatusMutation.isPending}
                                  >
                                    <ArrowRight className="mr-1 h-4 w-4" />
                                    {copy.overview.advanceStage}
                                  </Button>
                                ) : null}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                                  onClick={() => setLocation(`/cases/${item.id}`)}
                                >
                                  {copy.overview.openWorkspace}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">
                        {hasIntakeFilters ? copy.overview.noMattersMatchingFilter : copy.overview.noIntakeQueue}
                      </p>
                    )}
                  </div>
                </div>
              </ShellCard>
            )}

            {batchReviewOutcomes && batchReviewOutcomes.length > 0 ? (
              <ShellCard
                title={copy.overview.batchReviewResultsTitle}
                description={copy.overview.batchReviewResultsDescription}
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setBatchReviewOutcomes(null)}
                  >
                    {copy.overview.batchReviewClear}
                  </Button>
                }
              >
                <div className="space-y-3">
                  {batchReviewOutcomes.map(outcome => {
                    const failed = outcome.status === "failed";
                    const blocked = !failed && !outcome.readyForSignature;
                    const ready = !failed && outcome.readyForSignature === true;
                    const tone = failed
                      ? "border-rose-200/80 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-900/10"
                      : blocked
                      ? "border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10"
                      : "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10";
                    return (
                      <div
                        key={outcome.caseId}
                        className={`rounded-[1.25rem] border px-4 py-3 shadow-sm ${tone}`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-stone-950 dark:text-stone-100 break-words">
                                {outcome.caseTitle ?? `Case #${outcome.caseId}`}
                              </p>
                              <StatusPill>
                                {failed
                                  ? copy.overview.batchReviewResultFailed
                                  : ready
                                  ? copy.overview.batchReviewResultReady
                                  : copy.overview.batchReviewResultBlockers}
                              </StatusPill>
                              {!failed && outcome.qualityScore !== null ? (
                                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                                  {copy.overview.batchReviewQualityLabel}: {outcome.qualityScore}
                                </span>
                              ) : null}
                            </div>
                            {outcome.caseNumber ? (
                              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{outcome.caseNumber}</p>
                            ) : null}
                            {failed && outcome.errorMessage ? (
                              <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">{outcome.errorMessage}</p>
                            ) : null}
                            {!failed && outcome.blockers.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700 dark:text-stone-200">
                                {outcome.blockers.slice(0, 3).map((blocker, idx) => (
                                  <li key={idx}>{blocker}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl shrink-0"
                            onClick={() => setLocation(`/cases/${outcome.caseId}`)}
                          >
                            {copy.overview.openWorkspace}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ShellCard>
            ) : null}

            {hiddenSections.has("throughput") ? null : (
              <ShellCard title={copy.overview.throughputTitle} description={copy.overview.throughputDescription}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-4">
                  <MetricCard label={copy.overview.throughputApproved7} value={throughputStats.approvedLastSevenDays} detail={copy.overview.throughputApproved7Detail} icon={TrendingUp} />
                  <MetricCard label={copy.overview.throughputApproved30} value={throughputStats.approvedLastThirtyDays} detail={copy.overview.throughputApproved30Detail} icon={Sparkles} />
                  <MetricCard label={copy.overview.throughputOpenCount} value={throughputStats.openCount} detail={copy.overview.throughputOpenCountDetail} icon={FilePlus2} />
                  <MetricCard label={copy.overview.throughputAvgAge} value={throughputStats.avgAgeDays} detail={copy.overview.throughputAvgAgeDetail} icon={History} />
                </div>
              </ShellCard>
            )}

            {hiddenSections.has("recent") ? null : (
              <ShellCard title={copy.overview.recentMattersTitle} description={copy.overview.recentMattersDescription}>
                <div className="space-y-3">
                  {recentCases.length ? (
                    recentCases.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLocation(`/cases/${item.id}`)}
                        className="flex w-full flex-col gap-3 rounded-[1.35rem] border border-stone-200/80 bg-white/92 px-4 py-4 text-left shadow-[0_14px_34px_-24px_rgba(31,41,55,0.2)] transition hover:-translate-y-0.5 hover:border-stone-300/90 hover:bg-white dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)] md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-stone-950 dark:text-stone-100">{item.title}</p>
                            <StatusPill>{translateToken(locale, item.status)}</StatusPill>
                          </div>
                          <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{item.caseNumber} · {item.courtLevel} · {item.caseType}</p>
                        </div>
                        <p className="text-sm text-stone-500 dark:text-stone-300">{copy.overview.updatedPrefix} {formatTimestamp(item.updatedAt)}</p>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">
                      {copy.overview.noCases}
                    </p>
                  )}
                </div>
              </ShellCard>
            )}
          </div>

          <div className="space-y-6 min-w-0">
            {hiddenSections.has("knowledge") ? null : (
              <ShellCard title={copy.overview.knowledgeSnapshotTitle} description={copy.overview.knowledgeSnapshotDescription}>
                <div className="space-y-3">
                  {recentKnowledge.length ? (
                    recentKnowledge.map(item => (
                      <div key={item.id} className="rounded-[1.35rem] border border-stone-200/80 bg-white/84 px-4 py-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{item.title}</p>
                          <StatusPill>{translateToken(locale, item.documentType)}</StatusPill>
                        </div>
                        <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{item.jurisdictionCode}{item.citation ? ` · ${item.citation}` : ""}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{copy.overview.noKnowledge}</p>
                  )}
                </div>
              </ShellCard>
            )}

            {hiddenSections.has("governance") ? null : (
              <ShellCard title={copy.overview.governanceTitle} description={copy.overview.governanceDescription}>
                <div className="space-y-3 text-sm text-stone-600 dark:text-stone-200">
                  <div className="rounded-[1.35rem] border border-stone-200/80 bg-white/84 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <p className="font-semibold text-stone-900 dark:text-stone-100">{copy.overview.currentRole}</p>
                    <p className="mt-2 uppercase tracking-[0.24em] text-stone-500 dark:text-stone-300">{user?.role ?? copy.overview.guest}</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-stone-200/80 bg-white/84 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <p className="font-semibold text-stone-900 dark:text-stone-100">{copy.overview.providerConfiguration}</p>
                    <p className="mt-2 leading-6 text-stone-600 dark:text-stone-200">{copy.overview.providerDescription}</p>
                  </div>
                </div>
              </ShellCard>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderCases() {
    const cases = casesQuery.data ?? [];
    const filterChipsCopy = locale === "el"
      ? { all: "Όλες", active: "Σε εξέλιξη", approved: "Εγκεκριμένες", archived: "Αρχειοθετημένες", newCase: "Νέα υπόθεση", hideForm: "Απόκρυψη φόρμας" }
      : { all: "All", active: "Active", approved: "Approved", archived: "Archived", newCase: "New case", hideForm: "Hide form" };
    const matchesFilter = (status: string) => {
      if (caseStatusFilter === "all") return true;
      if (caseStatusFilter === "approved") return status === "approved";
      if (caseStatusFilter === "archived") return status === "archived";
      return status !== "approved" && status !== "archived";
    };
    const filteredCases = cases.filter(item => matchesFilter(item.status));
    const counts = {
      all: cases.length,
      active: cases.filter(c => c.status !== "approved" && c.status !== "archived").length,
      approved: cases.filter(c => c.status === "approved").length,
      archived: cases.filter(c => c.status === "archived").length,
    };
    const chip = (key: "all" | "active" | "approved" | "archived", label: string) => (
      <button
        key={key}
        type="button"
        onClick={() => setCaseStatusFilter(key)}
        className={
          caseStatusFilter === key
            ? "inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-semibold text-stone-50 dark:bg-stone-100 dark:text-stone-900"
            : "inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-white/10 dark:bg-white/5 dark:text-stone-300 dark:hover:bg-white/10"
        }
      >
        {label}
        <span className={caseStatusFilter === key ? "rounded-full bg-white/20 px-1.5 text-[0.65rem]" : "rounded-full bg-stone-100 px-1.5 text-[0.65rem] text-stone-600 dark:bg-white/10 dark:text-stone-300"}>
          {counts[key]}
        </span>
      </button>
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {chip("all", filterChipsCopy.all)}
            {chip("active", filterChipsCopy.active)}
            {chip("approved", filterChipsCopy.approved)}
            {chip("archived", filterChipsCopy.archived)}
          </div>
          <Button
            type="button"
            onClick={() => setShowNewCaseForm(value => !value)}
            className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
          >
            <FilePlus2 className="mr-2 h-4 w-4" />
            {showNewCaseForm ? filterChipsCopy.hideForm : filterChipsCopy.newCase}
          </Button>
        </div>

        {showNewCaseForm ? (
          <ShellCard title={ui.cases.createTitle} description={ui.cases.createDescription}>
            <form className="space-y-4" onSubmit={handleCreateCase}>
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label={ui.cases.caseNumber} value={caseForm.caseNumber} onChange={value => setCaseForm(current => ({ ...current, caseNumber: value }))} />
                <InputField label={ui.cases.jurisdictionCode} value={caseForm.jurisdictionCode} onChange={value => setCaseForm(current => ({ ...current, jurisdictionCode: value }))} />
                <InputField label={ui.cases.courtLevel} value={caseForm.courtLevel} onChange={value => setCaseForm(current => ({ ...current, courtLevel: value }))} />
                <InputField label={ui.cases.caseType} value={caseForm.caseType} onChange={value => setCaseForm(current => ({ ...current, caseType: value }))} />
              </div>
              <InputField label={ui.cases.caseTitle} value={caseForm.title} onChange={value => setCaseForm(current => ({ ...current, title: value }))} />
              <TextAreaField label={ui.cases.summary} value={caseForm.summary} onChange={value => setCaseForm(current => ({ ...current, summary: value }))} />
              <SelectField label={ui.cases.languageCode} value={caseForm.languageCode} onChange={value => setCaseForm(current => ({ ...current, languageCode: value }))} options={[["el", "Ελληνικά (Greek)"], ["en", "English"]]} />
              <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={createCaseMutation.isPending}>
                {createCaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}{ui.cases.createAction}
              </Button>
            </form>
          </ShellCard>
        ) : null}

        <ShellCard title={ui.cases.registryTitle} description={ui.cases.registryDescription}>
          <div className="space-y-3">
            {filteredCases.length ? (
              filteredCases.map(item => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-4 transition hover:border-stone-300 hover:bg-stone-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                >
                  {editingCaseId === item.id ? (
                    <form className="space-y-4" onSubmit={handleUpdateCase}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InputField label={ui.cases.caseNumber} value={editCaseForm.caseNumber} onChange={value => setEditCaseForm(current => ({ ...current, caseNumber: value }))} />
                        <InputField label={ui.cases.jurisdictionCode} value={editCaseForm.jurisdictionCode} onChange={value => setEditCaseForm(current => ({ ...current, jurisdictionCode: value }))} />
                        <InputField label={ui.cases.courtLevel} value={editCaseForm.courtLevel} onChange={value => setEditCaseForm(current => ({ ...current, courtLevel: value }))} />
                        <InputField label={ui.cases.caseType} value={editCaseForm.caseType} onChange={value => setEditCaseForm(current => ({ ...current, caseType: value }))} />
                      </div>
                      <InputField label={ui.cases.caseTitle} value={editCaseForm.title} onChange={value => setEditCaseForm(current => ({ ...current, title: value }))} />
                      <TextAreaField label={ui.cases.summary} value={editCaseForm.summary} onChange={value => setEditCaseForm(current => ({ ...current, summary: value }))} />
                      <SelectField label={ui.cases.languageCode} value={editCaseForm.languageCode} onChange={value => setEditCaseForm(current => ({ ...current, languageCode: value }))} options={[["el", "Ελληνικά (Greek)"], ["en", "English"]]} />
                      <div className="flex items-center gap-2">
                        <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={updateCaseMutation.isPending}>
                          {updateCaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}{ui.cases.editAction}
                        </Button>
                        <Button type="button" variant="ghost" onClick={handleCancelEditCase}>
                          {ui.admin.resetConfirmCancel}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <button
                        type="button"
                        onClick={() => setLocation(`/cases/${item.id}`)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold text-stone-950 dark:text-stone-100">{item.title}</p>
                          <StatusPill>{translateToken(locale, item.status)}</StatusPill>
                        </div>
                        <p className="mt-1 truncate text-sm text-stone-500 dark:text-stone-400">{item.caseNumber} · {item.jurisdictionCode} · {item.courtLevel}</p>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0"
                          onClick={() => handleStartEditCase(item)}
                          aria-label={ui.cases.editMatterLabel}
                          title={ui.cases.editMatterLabel}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => setDeleteConfirmCaseId(item.id)}
                          aria-label={ui.cases.deleteMatterLabel}
                          title={ui.cases.deleteMatterLabel}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-5 py-10 text-sm leading-7 text-stone-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-300">{ui.cases.noMatters}</p>
            )}
          </div>
        </ShellCard>
      </div>
    );
  }

  function renderKnowledge() {
    const items = knowledgeQuery.data ?? [];
    return (
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <ShellCard title={ui.knowledge.uploadTitle} description={ui.knowledge.uploadDescription}>
            <form className="space-y-4" onSubmit={handleKnowledgeUpload}>
              <InputField label={ui.knowledge.titleLabel} value={knowledgeForm.title} onChange={value => setKnowledgeForm(current => ({ ...current, title: value }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label={ui.knowledge.documentType} value={knowledgeForm.documentType} onChange={value => setKnowledgeForm(current => ({ ...current, documentType: value as "statute" | "regulation" | "precedent" | "reference" | "other" }))} options={[["statute", ui.knowledge.documentTypes.statute], ["regulation", ui.knowledge.documentTypes.regulation], ["precedent", ui.knowledge.documentTypes.precedent], ["reference", ui.knowledge.documentTypes.reference], ["other", ui.knowledge.documentTypes.other]]} />
                <InputField label={ui.knowledge.jurisdictionCode} value={knowledgeForm.jurisdictionCode} onChange={value => setKnowledgeForm(current => ({ ...current, jurisdictionCode: value }))} />
                <InputField label={ui.knowledge.courtLevel} value={knowledgeForm.courtLevel} onChange={value => setKnowledgeForm(current => ({ ...current, courtLevel: value }))} />
                <InputField label={ui.knowledge.citation} value={knowledgeForm.citation} onChange={value => setKnowledgeForm(current => ({ ...current, citation: value }))} />
              </div>
              <InputField label={ui.knowledge.sourceReference} value={knowledgeForm.sourceReference} onChange={value => setKnowledgeForm(current => ({ ...current, sourceReference: value }))} />
              <FileField label={ui.knowledge.fileLabel} onChange={setKnowledgeFile} selectedFile={knowledgeFile} selectedPrefix={ui.common.selectedFile} accept=".pdf,.docx,.txt,.md,.html,.htm,.json,.jpg,.jpeg,.png,.tiff,.tif,.webp,.bmp,.gif,.mp3,.wav,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/json,image/*,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/mp3" hint={ui.knowledge.fileAcceptHint} />
              <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={uploadKnowledgeMutation.isPending}>
                {uploadKnowledgeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookCopy className="mr-2 h-4 w-4" />}{ui.knowledge.uploadAction}
              </Button>
            </form>
          </ShellCard>

          <ShellCard title={ui.knowledge.batchTitle} description={ui.knowledge.batchDescription}>
            <form className="space-y-4" onSubmit={handleKnowledgeBatchUpload}>
              <MultiFileField label={ui.knowledge.batchFileLabel} selectedFiles={knowledgeBatchFiles} onChange={setKnowledgeBatchFiles} selectedPrefix={ui.common.selectedFiles} accept=".pdf,.docx,.txt,.md,.html,.htm,.json,.jpg,.jpeg,.png,.tiff,.tif,.webp,.bmp,.gif,.mp3,.wav,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/json,image/*,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/mp3" hint={ui.knowledge.fileAcceptHint} />
              <p className="rounded-[1.2rem] border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-sm leading-6 text-stone-600 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-200">{ui.knowledge.batchHint}</p>
              <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={batchUploadKnowledgeMutation.isPending}>
                {batchUploadKnowledgeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}{ui.knowledge.batchAction}
              </Button>
            </form>
          </ShellCard>
        </div>

        <ShellCard title={ui.knowledge.repositoryTitle} description={ui.knowledge.repositoryDescription}>
          <div className="space-y-3">
            {items.length ? (
              items.map(item => (
                <div key={item.id} className="rounded-[1.25rem] border border-stone-200/80 bg-white p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(23,27,38,0.96)_0%,rgba(15,18,27,0.98)_100%)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-stone-950 dark:text-stone-100">{item.title}</p>
                        <StatusPill>{translateToken(locale, item.documentType)}</StatusPill>
                        <StatusPill>{translateToken(locale, item.processingStatus)}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{item.jurisdictionCode}{item.citation ? ` · ${item.citation}` : ""}</p>
                      {item.summary ? <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-200">{item.summary}</p> : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.knowledge.emptyRepository}</p>
            )}
          </div>
        </ShellCard>
      </div>
    );
  }

  function renderCaseWorkspace() {
    if (!caseId) return null;
    if (workspaceQuery.isLoading) {
      return <LoadingPanel label={ui.workspace.loading} />;
    }
    if (!workspaceQuery.data) {
      return (
        <ShellCard title={ui.workspace.notLoadedTitle} description={ui.workspace.notLoadedDescription}>
          <p className="text-sm text-stone-600 dark:text-stone-200">{ui.workspace.notLoadedMessage}</p>
        </ShellCard>
      );
    }

    const workspace = workspaceQuery.data;

    const tabLabels = locale === "el"
      ? { documents: "Έγγραφα & Αναζήτηση", draft: "Σχέδιο", review: "Έλεγχος", history: "Ιστορικό" }
      : { documents: "Documents & Search", draft: "Draft", review: "Review", history: "History" };

    const getProgressStep = () => {
      const gp = ui.workspace.generationProgress;
      const stage = jobStatusQuery.data?.stage;
      if (stage) {
        const stageMap: Record<string, string> = {
          preparing: gp.analyzing,
          analyzing: gp.reviewing,
          generating: gp.structuring,
          validating: gp.generating,
          saving: gp.finalizing,
        };
        return stageMap[stage] ?? gp.almostThere;
      }
      if (draftProgress < 20) return gp.analyzing;
      if (draftProgress < 40) return gp.reviewing;
      if (draftProgress < 60) return gp.structuring;
      if (draftProgress < 80) return gp.generating;
      if (draftProgress < 95) return gp.finalizing;
      return gp.almostThere;
    };

    const nextActions = [
      {
        label: locale === "el" ? "Έγγραφα υπόθεσης" : "Case documents",
        detail: workspace.documents.length
          ? locale === "el" ? `${workspace.documents.length} έγγραφα έχουν καταχωριστεί.` : `${workspace.documents.length} documents are registered.`
          : locale === "el" ? "Ανεβάστε δικόγραφα, αποδείξεις ή παραρτήματα πριν από τη σύνταξη." : "Upload pleadings, evidence, or annexes before drafting.",
        status: workspace.documents.length ? rt.labels.ready : rt.labels.needed,
      },
      {
        label: locale === "el" ? "Προσχέδιο απόφασης" : "Decision draft",
        detail: activeDraft
          ? locale === "el" ? `Υπάρχει προσχέδιο v${activeDraft.versionNo}.` : `Draft v${activeDraft.versionNo} is available.`
          : locale === "el" ? "Δημιουργήστε προσχέδιο όταν ο φάκελος είναι πλήρης." : "Generate a draft once the file is complete.",
        status: activeDraft ? rt.labels.ready : rt.labels.next,
      },
      {
        label: locale === "el" ? "Έλεγχος υπογραφής" : "Signature review",
        detail: caseReviewResult
          ? caseReviewResult.preSignatureReview?.readyForSignature
            ? locale === "el" ? "Ο τελευταίος έλεγχος δεν εμφανίζει εμπόδια υπογραφής." : "The latest review has no signature blockers."
            : locale === "el" ? "Ελέγξτε τα εμπόδια πριν από την έγκριση." : "Review blockers before approval."
          : locale === "el" ? "Εκτελέστε έλεγχο συνέπειας πριν από την τελική έγκριση." : "Run consistency review before final approval.",
        status: caseReviewResult?.preSignatureReview?.readyForSignature ? rt.labels.ready : rt.labels.review,
      },
    ];

    return (
      <div className="space-y-6">
        {isGeneratingDraft && (
          <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-stone-200/80 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 xl:-mx-8 xl:px-8 dark:border-white/10 dark:bg-[#151923]/95">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-stone-700 dark:text-stone-200" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-stone-800 dark:text-stone-100">
                    {ui.workspace.generateAction} — {getProgressStep()}
                    {jobStatusQuery.data?.streamedChars
                      ? ` · ${jobStatusQuery.data.streamedChars.toLocaleString()} ${ui.workspace.generationProgress.charsReceived}`
                      : ""}
                  </span>
                  <span className="shrink-0 tabular-nums text-stone-500 dark:text-stone-400">{Math.round(draftProgress)}% · {draftProgressElapsed}{ui.workspace.generationProgress.seconds}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200/80 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-stone-900 transition-all duration-500 ease-out dark:bg-stone-100"
                    style={{ width: `${draftProgress}%` }}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100"
                onClick={() => cancelDraftMutation.mutate({ caseId })}
                disabled={cancelDraftMutation.isPending}
              >
                <X className="mr-1 h-4 w-4" />
                {locale === "el" ? "Ακύρωση" : "Cancel"}
              </Button>
            </div>
          </div>
        )}
        <ShellCard
          title={workspace.case.title}
          description={`${workspace.case.caseNumber} · ${workspace.case.jurisdictionCode} · ${workspace.case.courtLevel}`}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100" onClick={() => handleStartEditCase(workspace.case)}>
                <Pencil className="mr-2 h-4 w-4" />{ui.cases.editAction}
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl border-stone-300/80 bg-white/92 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-rose-400 dark:hover:text-rose-300" onClick={() => setDeleteConfirmCaseId(workspace.case.id)}>
                <Trash2 className="mr-2 h-4 w-4" />{ui.cases.deleteAction}
              </Button>
              <Button className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" onClick={() => generateDraftMutation.mutate({ caseId })} disabled={isGeneratingDraft}>
                {isGeneratingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}{ui.workspace.generateAction}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <WorkspaceFact label={ui.workspace.status} value={translateToken(locale, workspace.case.status)} />
            <WorkspaceFact label={ui.workspace.caseType} value={workspace.case.caseType} />
            <WorkspaceFact label={ui.workspace.assignedJudge} value={workspace.case.assignedJudgeId ? `${rt.labels.userPrefix} #${workspace.case.assignedJudgeId}` : ui.workspace.unassigned} />
            <WorkspaceFact label={ui.workspace.created} value={formatTimestamp(workspace.case.createdAt)} />
          </div>
          {workspace.case.summary ? <p className="mt-5 rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-600 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(23,27,38,0.96)_0%,rgba(15,18,27,0.98)_100%)] dark:text-stone-200">{workspace.case.summary}</p> : null}
        </ShellCard>

        <div className="grid gap-3 lg:grid-cols-3">
          {nextActions.map(action => (
            <div key={action.label} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151923]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950 dark:text-stone-100">{action.label}</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">{action.detail}</p>
                </div>
                <StatusPill>{action.status}</StatusPill>
              </div>
            </div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-white p-1 sm:w-auto sm:inline-grid sm:grid-cols-4 dark:border-white/10 dark:bg-[#151923]">
            <TabsTrigger value="documents" className="rounded-lg text-sm">{tabLabels.documents}</TabsTrigger>
            <TabsTrigger value="draft" className="rounded-lg text-sm">{tabLabels.draft}</TabsTrigger>
            <TabsTrigger value="review" className="rounded-lg text-sm">{tabLabels.review}</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-sm">{tabLabels.history}</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6 mt-0">
            <ShellCard title={ui.workspace.searchTitle} description={ui.workspace.searchDescription}>
            <div className="flex gap-3">
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={ui.workspace.searchPlaceholder}
                className="h-12 w-full rounded-xl border border-stone-300/80 bg-white/94 px-4 text-sm text-stone-900 shadow-[0_10px_24px_-18px_rgba(31,41,55,0.18)] outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-400 dark:focus:bg-white/[0.08]"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-600 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(23,27,38,0.96)_0%,rgba(15,18,27,0.98)_100%)] dark:text-stone-200">
                <Search className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {searchResults.length ? (
                searchResults.map(result => (
                  <div key={`${result.sourceType}-${result.id}`} className="rounded-[1.35rem] border border-stone-200/80 bg-white/84 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{result.title}</p>
                      <StatusPill>{translateToken(locale, result.sourceType)}</StatusPill>
                    </div>
                    {result.snippet ? <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{result.snippet}</p> : null}
                  </div>
                ))
              ) : (
                <p className="rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(23,27,38,0.96)_0%,rgba(15,18,27,0.98)_100%)] dark:text-stone-300">{ui.workspace.searchHint}</p>
              )}
            </div>
          </ShellCard>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-0">
          <ShellCard
            title={rt.labels.savedReviewHistory}
            description={rt.labels.savedReviewHistoryDescription}
          >
            <div className="space-y-3">
              {reviewHistory.length ? (
                reviewHistory.map((snapshot: any, index: number) => {
                  const previousSnapshot = reviewHistory[index + 1] ?? null;

                  return (
                    <div key={snapshot.id} className="rounded-[1.25rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <StatusPill>{rt.labels.snapshot} #{snapshot.id}</StatusPill>
                            <StatusPill>{String(snapshot.reviewTemplateKey ?? "general")}</StatusPill>
                            <StatusPill>{rt.labels.draft} v{snapshot.draftVersionNo ?? rt.labels.manual}</StatusPill>
                            <StatusPill>{rt.labels.quality} {snapshot.qualityScore}/100</StatusPill>
                            <StatusPill>{snapshot.readyForSignature ? rt.labels.ready : rt.labels.blocked}</StatusPill>
                          </div>
                          <p className="text-sm text-stone-600 dark:text-stone-200">{formatTimestamp(snapshot.createdAt)}</p>
                          <p className="text-sm leading-6 text-stone-700 dark:text-stone-200">{snapshot.resultJson?.summary ?? rt.labels.savedReviewFallback}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                            onClick={() => setCaseReviewResult(toSavedReviewResult(snapshot))}
                          >
                            {rt.labels.openReview}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                            onClick={() => {
                              setCaseReviewResult(toSavedReviewResult(snapshot));
                              setComparisonReviewSnapshotId(previousSnapshot?.id ?? null);
                            }}
                            disabled={!previousSnapshot}
                          >
                            {rt.labels.comparePrevious}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                            onClick={() => exportReviewReportMutation.mutate({ caseId, reviewSnapshotId: snapshot.id, format: "docx" })}
                            disabled={exportReviewReportMutation.isPending}
                          >
                            {rt.labels.docxReport}
                          </Button>
                          <Button
                            className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                            onClick={() => exportReviewReportMutation.mutate({ caseId, reviewSnapshotId: snapshot.id, format: "pdf" })}
                            disabled={exportReviewReportMutation.isPending}
                          >
                            {rt.labels.signedPdf}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{rt.labels.savedReviewEmpty}</p>
              )}
            </div>
            {reviewHistory.length > 1 && selectedReviewSnapshot && comparisonReviewSnapshot && reviewComparison ? (
              <div className="mt-6 rounded-[1.4rem] border border-stone-200/80 bg-stone-50/90 p-5 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold tracking-[0.18em] text-stone-500 dark:text-stone-300">{rt.labels.reviewDiffTitle}</p>
                  <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{rt.labels.reviewDiffDescription}</p>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <SelectField
                    label={rt.labels.currentReview}
                    value={String(selectedReviewSnapshot.id)}
                    onChange={value => {
                      const snapshot = reviewHistory.find((item: any) => item.id === Number(value));
                      if (snapshot) {
                        setCaseReviewResult(toSavedReviewResult(snapshot));
                      }
                    }}
                    options={reviewHistory.map((snapshot: any) => [String(snapshot.id), formatReviewSnapshotOption(locale, snapshot)])}
                  />
                  <SelectField
                    label={rt.labels.compareAgainst}
                    value={String(comparisonReviewSnapshot.id)}
                    onChange={value => setComparisonReviewSnapshotId(Number(value))}
                    options={reviewHistory.filter((snapshot: any) => snapshot.id !== selectedReviewSnapshot.id).map((snapshot: any) => [String(snapshot.id), formatReviewSnapshotOption(locale, snapshot)])}
                  />
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill>{rt.labels.currentSnapshot} #{selectedReviewSnapshot.id}</StatusPill>
                      <StatusPill>{rt.labels.quality} {selectedReviewSnapshot.qualityScore}/100</StatusPill>
                      <StatusPill>{selectedReviewSnapshot.readyForSignature ? rt.labels.ready : rt.labels.blocked}</StatusPill>
                    </div>
                    <p className="mt-3 text-sm text-stone-600 dark:text-stone-200">{formatTimestamp(selectedReviewSnapshot.createdAt)}</p>
                    <p className="mt-3 text-sm leading-6 text-stone-700 dark:text-stone-200">{reviewComparison.currentReview.summary ?? rt.labels.currentReviewMissing}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill>{rt.labels.baselineSnapshot} #{comparisonReviewSnapshot.id}</StatusPill>
                      <StatusPill>{rt.labels.quality} {comparisonReviewSnapshot.qualityScore}/100</StatusPill>
                      <StatusPill>{comparisonReviewSnapshot.readyForSignature ? rt.labels.ready : rt.labels.blocked}</StatusPill>
                    </div>
                    <p className="mt-3 text-sm text-stone-600 dark:text-stone-200">{formatTimestamp(comparisonReviewSnapshot.createdAt)}</p>
                    <p className="mt-3 text-sm leading-6 text-stone-700 dark:text-stone-200">{reviewComparison.previousReview.summary ?? rt.labels.baselineReviewMissing}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.15rem] border border-stone-200/80 bg-white/95 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-300">{rt.labels.qualityDelta}</p>
                    <p className="mt-3 text-2xl font-semibold text-stone-950 dark:text-stone-50">{formatSignedDelta(reviewComparison.qualityScoreDelta)}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-stone-200/80 bg-white/95 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-300">{rt.labels.addedBlockers}</p>
                    <p className="mt-3 text-2xl font-semibold text-stone-950 dark:text-stone-50">{reviewComparison.blockerDiff.added.length}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-stone-200/80 bg-white/95 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-300">{rt.labels.resolvedBlockers}</p>
                    <p className="mt-3 text-2xl font-semibold text-stone-950 dark:text-stone-50">{reviewComparison.blockerDiff.removed.length}</p>
                  </div>
                  <div className="rounded-[1.15rem] border border-stone-200/80 bg-white/95 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-300">{rt.labels.findingChanges}</p>
                    <p className="mt-3 text-2xl font-semibold text-stone-950 dark:text-stone-50">{reviewComparison.findingChangeCount}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950 dark:text-stone-50">{rt.labels.currentFindings}</p>
                        <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-200">{rt.labels.currentFindingsDescription}</p>
                      </div>
                      <StatusPill>{rt.labels.currentSnapshot} #{selectedReviewSnapshot.id}</StatusPill>
                    </div>
                    <div className="mt-3 space-y-3">
                      {reviewComparison.findingComparison.currentRows.length ? reviewComparison.findingComparison.currentRows.map((row: any) => {
                        const highlight = getFindingHighlightMeta(row.status, locale);
                        return (
                          <div key={`current-${row.item.issue}-${row.status}`} className={`rounded-[1.05rem] border px-4 py-3 shadow-sm ${highlight.containerClass}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${highlight.badgeClass}`}>{highlight.label}</span>
                                <span className="inline-flex items-center rounded-full border border-stone-300/80 bg-white/80 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-stone-700 dark:border-stone-600/80 dark:bg-stone-900/50 dark:text-stone-100">{translateToken(locale, String(row.item.severity ?? "medium")).toUpperCase()}</span>
                              </div>
                              {row.changeSummary.length ? <p className="text-xs font-medium text-stone-600 dark:text-stone-200">{row.changeSummary.join(" · ")}</p> : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold leading-6 text-stone-950 dark:text-stone-50">{row.item.issue}</p>
                            {row.item.recommendedAction ? <p className="mt-1 text-sm leading-6 text-stone-700 dark:text-stone-200">{rt.labels.actionPrefix}: {row.item.recommendedAction}</p> : null}
                          </div>
                        );
                      }) : <p className="rounded-[1.05rem] border border-dashed border-stone-300/90 px-4 py-6 text-sm leading-6 text-stone-500 dark:border-stone-700/80 dark:text-stone-300">{rt.labels.noCurrentFindings}</p>}
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950 dark:text-stone-50">{rt.labels.baselineFindings}</p>
                        <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-200">{rt.labels.baselineFindingsDescription}</p>
                      </div>
                      <StatusPill>{rt.labels.baselineSnapshot} #{comparisonReviewSnapshot.id}</StatusPill>
                    </div>
                    <div className="mt-3 space-y-3">
                      {reviewComparison.findingComparison.previousRows.length ? reviewComparison.findingComparison.previousRows.map((row: any) => {
                        const highlight = getFindingHighlightMeta(row.status, locale);
                        return (
                          <div key={`baseline-${row.item.issue}-${row.status}`} className={`rounded-[1.05rem] border px-4 py-3 shadow-sm ${highlight.containerClass}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${highlight.badgeClass}`}>{highlight.label}</span>
                                <span className="inline-flex items-center rounded-full border border-stone-300/80 bg-white/80 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-stone-700 dark:border-stone-600/80 dark:bg-stone-900/50 dark:text-stone-100">{translateToken(locale, String(row.item.severity ?? "medium")).toUpperCase()}</span>
                              </div>
                              {row.changeSummary.length ? <p className="text-xs font-medium text-stone-600 dark:text-stone-200">{row.changeSummary.join(" · ")}</p> : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold leading-6 text-stone-950 dark:text-stone-50">{row.item.issue}</p>
                            {row.item.recommendedAction ? <p className="mt-1 text-sm leading-6 text-stone-700 dark:text-stone-200">{rt.labels.actionPrefix}: {row.item.recommendedAction}</p> : null}
                          </div>
                        );
                      }) : <p className="rounded-[1.05rem] border border-dashed border-stone-300/90 px-4 py-6 text-sm leading-6 text-stone-500 dark:border-stone-700/80 dark:text-stone-300">{rt.labels.noBaselineFindings}</p>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <p className="text-sm font-semibold text-stone-950 dark:text-stone-50">{rt.labels.newlyIntroduced}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700 dark:text-stone-200">
                      {(reviewComparison.blockerDiff.added.length ? reviewComparison.blockerDiff.added.map((item: string) => `${rt.labels.blockerPrefix}: ${item}`) : [])
                        .concat(reviewComparison.findingDiff.added.map((item: any) => `${rt.labels.findingPrefix}: [${translateToken(locale, String(item.severity ?? "medium")).toUpperCase()}] ${item.issue}`))
                        .concat(reviewComparison.missingEvidenceDiff.added.map((item: string) => `${rt.labels.missingEvidencePrefix}: ${item}`))
                        .concat(reviewComparison.missingLawDiff.added.map((item: string) => `${rt.labels.missingLawPrefix}: ${item}`))
                        .concat(reviewComparison.issueDiff.added.map((item: any) => `${rt.labels.issuePrefix}: ${item.question}`))
                        .slice(0, 8)
                        .map((line: string) => <li key={line}>• {line}</li>)}
                    </ul>
                    {!reviewComparison.blockerDiff.added.length && !reviewComparison.findingDiff.added.length && !reviewComparison.missingEvidenceDiff.added.length && !reviewComparison.missingLawDiff.added.length && !reviewComparison.issueDiff.added.length ? <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-300">{rt.labels.noNewReviewChanges}</p> : null}
                  </div>
                  <div className="rounded-[1.2rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)]">
                    <p className="text-sm font-semibold text-stone-950 dark:text-stone-50">{rt.labels.resolvedSinceBaseline}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700 dark:text-stone-200">
                      {(reviewComparison.blockerDiff.removed.length ? reviewComparison.blockerDiff.removed.map((item: string) => `${rt.labels.blockerPrefix}: ${item}`) : [])
                        .concat(reviewComparison.findingDiff.removed.map((item: any) => `${rt.labels.findingPrefix}: [${translateToken(locale, String(item.severity ?? "medium")).toUpperCase()}] ${item.issue}`))
                        .concat(reviewComparison.missingEvidenceDiff.removed.map((item: string) => `${rt.labels.missingEvidencePrefix}: ${item}`))
                        .concat(reviewComparison.missingLawDiff.removed.map((item: string) => `${rt.labels.missingLawPrefix}: ${item}`))
                        .concat(reviewComparison.issueDiff.removed.map((item: any) => `${rt.labels.issuePrefix}: ${item.question}`))
                        .slice(0, 8)
                        .map((line: string) => <li key={line}>• {line}</li>)}
                    </ul>
                    {!reviewComparison.blockerDiff.removed.length && !reviewComparison.findingDiff.removed.length && !reviewComparison.missingEvidenceDiff.removed.length && !reviewComparison.missingLawDiff.removed.length && !reviewComparison.issueDiff.removed.length ? <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-300">{rt.labels.noResolvedReviewChanges}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </ShellCard>
          </TabsContent>

          <TabsContent value="review" className="space-y-6 mt-0">
          <ShellCard
            title={rt.labels.approvalThreshold}
            description={rt.labels.approvalThresholdDescription}
          >
            {(() => {
              const inheritanceThreshold: any = approvalThresholdRows.find((row: any) => row.caseTypeKey === "inheritance") ?? approvalThresholdRows[0];
              if (!inheritanceThreshold) {
                return (
                  <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{rt.labels.approvalThresholdLoading}</p>
                );
              }
              const draftValues = thresholdDrafts[inheritanceThreshold.caseTypeKey] ?? {
                minimumQualityScore: String(inheritanceThreshold.minimumQualityScore ?? ""),
                requireReadyForSignature: Boolean(inheritanceThreshold.requireReadyForSignature),
                maxHighSeverityFindings: String(inheritanceThreshold.maxHighSeverityFindings ?? ""),
                maxMediumSeverityFindings: String(inheritanceThreshold.maxMediumSeverityFindings ?? ""),
              };
              return (
                <div className="rounded-[1.25rem] border border-stone-200/80 bg-white/95 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-950 dark:text-stone-50">{rt.labels.greekInheritanceLaw}</p>
                      <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-200">{rt.labels.greekInheritanceLawDescription}</p>
                    </div>
                    <StatusPill>{rt.labels.judgeRule}</StatusPill>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <InputField
                      label={rt.labels.minimumQualityScore}
                      value={draftValues.minimumQualityScore}
                      onChange={value =>
                        setThresholdDrafts(current => ({
                          ...current,
                          [inheritanceThreshold.caseTypeKey]: { ...draftValues, minimumQualityScore: value },
                        }))
                      }
                    />
                    <InputField
                      label={rt.labels.maxMediumSeverityFindings}
                      value={draftValues.maxMediumSeverityFindings}
                      onChange={value =>
                        setThresholdDrafts(current => ({
                          ...current,
                          [inheritanceThreshold.caseTypeKey]: { ...draftValues, maxMediumSeverityFindings: value },
                        }))
                      }
                    />
                    <InputField
                      label={rt.labels.maxHighSeverityFindings}
                      value={draftValues.maxHighSeverityFindings}
                      onChange={value =>
                        setThresholdDrafts(current => ({
                          ...current,
                          [inheritanceThreshold.caseTypeKey]: { ...draftValues, maxHighSeverityFindings: value },
                        }))
                      }
                    />
                    <label className="flex items-center gap-3 rounded-[1rem] border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-sm text-stone-700 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-200">
                      <input
                        type="checkbox"
                        checked={draftValues.requireReadyForSignature}
                        onChange={event =>
                          setThresholdDrafts(current => ({
                            ...current,
                            [inheritanceThreshold.caseTypeKey]: {
                              ...draftValues,
                              requireReadyForSignature: event.target.checked,
                            },
                          }))
                        }
                      />
                      {rt.labels.requirePreSignatureReadiness}
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                      onClick={() =>
                        saveReviewThresholdMutation.mutate({
                          caseTypeKey: "inheritance",
                          minimumQualityScore: Number(draftValues.minimumQualityScore || 0),
                          requireReadyForSignature: draftValues.requireReadyForSignature,
                          maxHighSeverityFindings: Number(draftValues.maxHighSeverityFindings || 0),
                          maxMediumSeverityFindings: Number(draftValues.maxMediumSeverityFindings || 0),
                        })
                      }
                      disabled={saveReviewThresholdMutation.isPending}
                    >
                      {rt.labels.saveThreshold}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </ShellCard>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-0">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <ShellCard title={ui.workspace.uploadTitle} description={ui.workspace.uploadDescription}>
              <form className="space-y-4" onSubmit={handleCaseDocumentUpload}>
                <InputField label={ui.workspace.documentTitle} value={caseDocumentTitle} onChange={setCaseDocumentTitle} />
                <SelectField label={ui.workspace.documentType} value={caseDocumentType} onChange={setCaseDocumentType} options={[["pleading", ui.workspace.documentTypes.pleading], ["evidence", ui.workspace.documentTypes.evidence], ["supporting", ui.workspace.documentTypes.supporting], ["reference", ui.workspace.documentTypes.reference], ["decision", ui.workspace.documentTypes.decision], ["other", ui.workspace.documentTypes.other]]} />
                <FileField label={ui.workspace.fileLabel} onChange={setCaseFile} selectedFile={caseFile} selectedPrefix={ui.common.selectedFile} accept=".pdf,.docx,.txt,.md,.html,.htm,.json,.jpg,.jpeg,.png,.tiff,.tif,.webp,.bmp,.gif,.mp3,.wav,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/json,image/*,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/mp3" hint={ui.workspace.fileAcceptHint} />
                <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={uploadCaseDocumentMutation.isPending}>
                  {uploadCaseDocumentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}{ui.workspace.uploadAction}
                </Button>
              </form>
            </ShellCard>

            <ShellCard title={ui.workspace.batchTitle} description={ui.workspace.batchDescription}>
              <form className="space-y-4" onSubmit={handleCaseBatchUpload}>
                <MultiFileField label={ui.workspace.batchFileLabel} selectedFiles={caseBatchFiles} onChange={setCaseBatchFiles} selectedPrefix={ui.common.selectedFiles} accept=".pdf,.docx,.txt,.md,.html,.htm,.json,.jpg,.jpeg,.png,.tiff,.tif,.webp,.bmp,.gif,.mp3,.wav,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/json,image/*,audio/mpeg,audio/wav,audio/wave,audio/x-wav,audio/mp3" hint={ui.workspace.fileAcceptHint} />
                <p className="rounded-[1.2rem] border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-sm leading-6 text-stone-600 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-200">{ui.workspace.batchHint}</p>
                <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={batchImportCaseDocumentsMutation.isPending}>
                  {batchImportCaseDocumentsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}{ui.workspace.batchAction}
                </Button>
              </form>
            </ShellCard>
          </div>

          <ShellCard title={ui.workspace.documentsTitle} description={ui.workspace.documentsDescription}>
            <div className="space-y-3">
              {(workspace.documents ?? []).length ? (
                workspace.documents.map((document: any) => (
                  <div key={document.id} className="rounded-[1.25rem] border border-stone-200/80 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-950">{document.title}</p>
                          <StatusPill>{translateToken(locale, document.documentType)}</StatusPill>
                          <StatusPill>{translateToken(locale, document.uploadStatus)}</StatusPill>
                        </div>
                        <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{document.fileName}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.workspace.emptyDocuments}</p>
              )}
            </div>
          </ShellCard>
          </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-6 mt-0">
          <ShellCard title={ui.workspace.caseCheckTitle} description={ui.workspace.caseCheckDescription}>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <form className="space-y-4" onSubmit={handleCaseReview}>
              {reviewJudgmentMutation.isPending && (
                <div className="sticky top-14 z-20 -mx-4 mb-2 border-b border-stone-200/80 bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 xl:-mx-8 xl:px-8 dark:border-white/10 dark:bg-[#151923]/95">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-stone-700 dark:text-stone-200" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium text-stone-800 dark:text-stone-100">{ui.workspace.caseCheckAction} — {locale === "el" ? "Ανάλυση" : "Analyzing"}</span>
                        <span className="shrink-0 tabular-nums text-stone-500 dark:text-stone-400">{Math.round(reviewProgress)}% · {reviewProgressElapsed}{ui.workspace.generationProgress.seconds}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200/80 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-stone-900 transition-all duration-500 ease-out dark:bg-stone-100"
                          style={{ width: `${reviewProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <FieldWrapper label={ui.workspace.caseCheckInputLabel}>
                <textarea
                  value={judgmentReviewText}
                  onChange={event => setJudgmentReviewText(event.target.value)}
                  placeholder={ui.workspace.caseCheckPlaceholder}
                  className="min-h-[220px] w-full rounded-[1.35rem] border border-stone-200/80 bg-white/95 px-4 py-3 text-sm leading-6 text-stone-800 shadow-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-100 dark:focus:border-white/20 dark:focus:ring-white/10"
                />
              </FieldWrapper>
              <p className="rounded-[1.2rem] border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-sm leading-6 text-stone-600 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-200">{ui.workspace.caseCheckHint}</p>
              <div className="rounded-[1.2rem] border border-stone-200/80 bg-white/92 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.workspace.reviewTemplateTitle}</p>
                <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.reviewTemplateDescription}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
                  <SelectField
                    label={ui.workspace.reviewTemplateLabel}
                    value={selectedReviewTemplate}
                    onChange={value => setSelectedReviewTemplate(value as "inheritance")}
                    options={[["inheritance", ui.workspace.reviewTemplateOptions.inheritance]]}
                  />
                  <TextAreaField
                    label={ui.workspace.reviewTemplateFocusLabel}
                    value={reviewTemplateFocus}
                    onChange={setReviewTemplateFocus}
                    placeholder={ui.workspace.reviewTemplateFocusPlaceholder}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{ui.workspace.caseCheckQuickActions}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => setJudgmentReviewText(latestDraftText)} disabled={!latestDraftText}>
                    {ui.workspace.useLatestDraft}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => setJudgmentReviewText(latestReasoningText)} disabled={!latestReasoningText}>
                    {ui.workspace.useReasoningOnly}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => setJudgmentReviewText("")} disabled={!judgmentReviewText}>
                    {ui.workspace.clearReviewText}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={reviewJudgmentMutation.isPending}>
                {reviewJudgmentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}{ui.workspace.caseCheckAction}
              </Button>
            </form>

            <div className="space-y-4">
              {caseReviewResult ? (
                <>
                  <div className="rounded-[1.35rem] border border-stone-200/80 bg-white p-5 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusPill>{ui.workspace.assessmentLabels[caseReviewResult.outcomeAssessment as keyof typeof ui.workspace.assessmentLabels] ?? caseReviewResult.outcomeAssessment}</StatusPill>
                      <StatusPill>{ui.workspace.reviewTemplateOptions[selectedReviewTemplate]}</StatusPill>
                      <StatusPill>{ui.workspace.confidence} {caseReviewResult.confidenceScore}</StatusPill>
                      <StatusPill>{ui.workspace.qualityScoreLabel} {caseReviewResult.decisionQuality?.score ?? "—"}/100</StatusPill>
                      <StatusPill>{caseReviewResult.preSignatureReview?.readyForSignature ? ui.workspace.readyForSignature : ui.workspace.notReadyForSignature}</StatusPill>
                      {reviewComparison ? (
                        <StatusPill>
                          {ui.workspace.sinceLastReview}{" "}
                          {reviewComparison.qualityScoreDelta > 0 ? "+" : ""}
                          {reviewComparison.qualityScoreDelta} · {reviewComparison.findingChangeCount} {ui.workspace.changedFindings}
                        </StatusPill>
                      ) : null}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-stone-700 dark:text-stone-200">{caseReviewResult.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                        onClick={() => setActiveTab("draft")}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {ui.workspace.viewDraft}
                      </Button>
                      <Button
                        className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                        onClick={() => {
                          const unreviewedFindings = (caseReviewResult.findings ?? []).filter((_: any, i: number) => !reviewedFindingIndices.has(i));
                          const reviewContext = unreviewedFindings.length
                            ? unreviewedFindings.map((f: any) => `[${(f.severity ?? "").toUpperCase()}] ${f.category ?? ""}: ${f.issue ?? ""}${f.explanation ? ` — ${f.explanation}` : ""}${f.recommendedAction ? ` (Action: ${f.recommendedAction})` : ""}`).join("\n")
                            : "Regenerate the draft incorporating all previous legal consistency review feedback.";
                          generateDraftMutation.mutate({ caseId, reviewContext });
                        }}
                        disabled={isGeneratingDraft}
                      >
                        {isGeneratingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {ui.workspace.newGeneration}
                      </Button>
                      {(caseReviewResult?.reviewSnapshotId ?? reviewHistory[0]?.id) ? (
                        <>
                          <Button
                            variant="outline"
                            className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                            onClick={() => exportReviewReportMutation.mutate({ caseId, reviewSnapshotId: caseReviewResult?.reviewSnapshotId ?? reviewHistory[0]?.id ?? 0, format: "docx" })}
                            disabled={exportReviewReportMutation.isPending}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {ui.workspace.exportReviewDocx}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                            onClick={() => exportReviewReportMutation.mutate({ caseId, reviewSnapshotId: caseReviewResult?.reviewSnapshotId ?? reviewHistory[0]?.id ?? 0, format: "pdf" })}
                            disabled={exportReviewReportMutation.isPending}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {ui.workspace.exportReviewPdf}
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {(caseReviewResult.decisionQuality?.score ?? 100) < 70 || !caseReviewResult.preSignatureReview?.readyForSignature || (caseReviewResult.findings ?? []).length > 0 ? (
                      <div className="mt-3 flex items-start gap-3 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{ui.workspace.reviewActionRequired}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <ShellCard title={ui.workspace.caseCheckIssues} description={ui.workspace.caseCheckSummary}>
                      <div className="space-y-3">
                        {(caseReviewResult.extractedIssues ?? []).length ? (caseReviewResult.extractedIssues ?? []).map((item: any, index: number) => (
                          <div key={`${item.question}-${index}`} className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{item.question}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{item.significance}</p>
                            {(item.supportingSources ?? []).length ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{item.supportingSources.join(" · ")}</p> : null}
                          </div>
                        )) : <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.caseCheckNoItems}</p>}
                      </div>
                    </ShellCard>
                    <ShellCard title={ui.workspace.caseCheckDecisionQuality} description={ui.workspace.caseCheckSummary}>
                      <div className="space-y-3 text-sm leading-6 text-stone-600 dark:text-stone-200">
                        <div className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{ui.workspace.qualityScoreLabel}</p>
                          <p className="mt-2 text-3xl font-semibold text-stone-950 dark:text-stone-50">{caseReviewResult.decisionQuality?.score ?? "—"}<span className="text-base font-medium text-stone-500 dark:text-stone-300">/100</span></p>
                          <p className="mt-2 text-sm font-medium text-stone-800 capitalize dark:text-stone-100">{translateToken(locale, String(caseReviewResult.decisionQuality?.band ?? ""))}</p>
                          <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{caseReviewResult.decisionQuality?.rationale ?? ui.workspace.caseCheckNoItems}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.workspace.caseCheckJurisdiction}</p>
                          <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{caseReviewResult.jurisdictionAndAdmissibility?.note ?? ui.workspace.caseCheckNoItems}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{translateToken(locale, String(caseReviewResult.jurisdictionAndAdmissibility?.status ?? ""))}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.workspace.caseCheckProportionality}</p>
                          <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{caseReviewResult.proportionalityReview?.note ?? ui.workspace.caseCheckNoItems}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{translateToken(locale, String(caseReviewResult.proportionalityReview?.status ?? ""))}</p>
                        </div>
                      </div>
                    </ShellCard>
                  </div>

                  <ShellCard title={ui.workspace.caseCheckFindings} description={ui.workspace.caseCheckSummary}>
                    <div className="space-y-3">
                      {(caseReviewResult.findings ?? []).length ? (caseReviewResult.findings ?? []).map((finding: any, index: number) => {
                        const isReviewed = reviewedFindingIndices.has(index);
                        const resolution = findingResolutionsMap.get(index);
                        const explanation = findingExplanations.get(index);
                        const isExplaining = explainFindingMutation.isPending && explainFindingMutation.variables?.findingIndex === index;
                        const statusClasses = (active: boolean, base: string) =>
                          `rounded-lg border px-2.5 py-1 text-xs font-medium transition ${active ? base : "border-stone-200 bg-transparent text-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"}`;
                        return (
                          <div key={`${finding.issue}-${index}`} className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill>{translateToken(locale, finding.category)}</StatusPill>
                              <StatusPill>{translateToken(locale, finding.severity)}</StatusPill>
                              <div className="ml-auto flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className={statusClasses(!isReviewed, "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200")}
                                  onClick={() => setReviewedFindingIndices(prev => {
                                    const next = new Set(prev);
                                    next.delete(index);
                                    return next;
                                  })}
                                >
                                  {ui.workspace.findingStatusReview}
                                </button>
                                <button
                                  type="button"
                                  className={statusClasses(isReviewed, "border-green-600 bg-green-600 text-white dark:border-green-600 dark:bg-green-600 dark:text-white")}
                                  onClick={() => setReviewedFindingIndices(prev => {
                                    const next = new Set(prev);
                                    next.add(index);
                                    return next;
                                  })}
                                >
                                  {ui.workspace.markFindingReviewed}
                                </button>
                              </div>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">{finding.issue}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{finding.explanation}</p>
                            {finding.recommendedAction ? <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">{finding.recommendedAction}</p> : null}
                            {(finding.supportingSources ?? []).length ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{finding.supportingSources.join(" · ")}</p> : null}

                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              <span className="mr-1 text-[11px] uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                                {ui.workspace.findingResolutionLabel}
                              </span>
                              <button
                                type="button"
                                className={statusClasses(resolution?.status === "addressed", "border-emerald-400 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-600")}
                                onClick={() => handleSetFindingResolution(index, "addressed", resolution?.note ?? null)}
                                disabled={setFindingResolutionMutation.isPending}
                              >
                                {ui.workspace.findingResolutionAddressed}
                              </button>
                              <button
                                type="button"
                                className={statusClasses(resolution?.status === "accepted", "border-stone-500 bg-stone-700 text-white dark:border-stone-400 dark:bg-stone-600")}
                                onClick={() => handleSetFindingResolution(index, "accepted", resolution?.note ?? null)}
                                disabled={setFindingResolutionMutation.isPending}
                              >
                                {ui.workspace.findingResolutionAccepted}
                              </button>
                              <button
                                type="button"
                                className={statusClasses(resolution?.status === "deferred", "border-amber-500 bg-amber-500 text-white dark:border-amber-500 dark:bg-amber-600")}
                                onClick={() => handleSetFindingResolution(index, "deferred", resolution?.note ?? null)}
                                disabled={setFindingResolutionMutation.isPending}
                              >
                                {ui.workspace.findingResolutionDeferred}
                              </button>
                              {resolution ? (
                                <button
                                  type="button"
                                  className="rounded-lg border border-stone-200 bg-transparent px-2.5 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
                                  onClick={() => handleClearFindingResolution(index)}
                                  disabled={clearFindingResolutionMutation.isPending}
                                >
                                  {ui.workspace.findingResolutionClear}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="ml-auto rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                                onClick={() => handleExplainFinding(index)}
                                disabled={isExplaining}
                              >
                                {isExplaining ? ui.workspace.findingExplainRunning : ui.workspace.findingExplain}
                              </button>
                            </div>

                            {resolution ? (
                              <textarea
                                value={resolution.note ?? ""}
                                onChange={event => handleSetFindingResolution(index, resolution.status, event.target.value)}
                                placeholder={ui.workspace.findingResolutionNotePlaceholder}
                                className="mt-2 min-h-[60px] w-full rounded-lg border border-stone-300/80 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-stone-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-400"
                              />
                            ) : null}

                            {explanation ? (
                              <div className="mt-3 rounded-lg border border-sky-200/80 bg-sky-50/60 p-3 text-sm leading-6 text-sky-900 dark:border-sky-900/40 dark:bg-sky-900/10 dark:text-sky-100">
                                <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
                                  {ui.workspace.findingExplanationTitle}
                                </p>
                                <p className="whitespace-pre-wrap">{explanation}</p>
                              </div>
                            ) : null}
                          </div>
                        );
                      }) : <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.caseCheckNoItems}</p>}
                    </div>
                  </ShellCard>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ShellCard title={ui.workspace.caseCheckMissingEvidence} description={ui.workspace.caseCheckSummary}>
                      <ul className="space-y-2 text-sm leading-6 text-stone-600 dark:text-stone-200">
                        {(caseReviewResult.missingEvidence ?? []).length ? (caseReviewResult.missingEvidence ?? []).map((item: string, index: number) => <li key={`${item}-${index}`} className="rounded-xl border border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">{item}</li>) : <li>{ui.workspace.caseCheckNoItems}</li>}
                      </ul>
                    </ShellCard>
                    <ShellCard title={ui.workspace.caseCheckMissingLaw} description={ui.workspace.caseCheckSummary}>
                      <ul className="space-y-2 text-sm leading-6 text-stone-600 dark:text-stone-200">
                        {(caseReviewResult.missingLaw ?? []).length ? (caseReviewResult.missingLaw ?? []).map((item: string, index: number) => <li key={`${item}-${index}`} className="rounded-xl border border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">{item}</li>) : <li>{ui.workspace.caseCheckNoItems}</li>}
                      </ul>
                    </ShellCard>
                  </div>

                  {/* Scrubbable Timeline */}
                  {(caseReviewResult.chronologicalEvents ?? []).length > 0 && (() => {
                    const events = caseReviewResult.chronologicalEvents ?? [];
                    const safeIndex = Math.min(Math.max(activeTimelineIndex, 0), events.length - 1);
                    const active = events[safeIndex];
                    const significanceColor = (s: string) => s === "high" ? "bg-rose-500" : s === "medium" ? "bg-amber-500" : "bg-stone-400 dark:bg-stone-500";
                    const significanceRing = (s: string) => s === "high" ? "ring-rose-400/60" : s === "medium" ? "ring-amber-400/60" : "ring-stone-400/60";
                    return (
                      <ShellCard
                        title={ui.workspace.chronologicalEventsTitle}
                        description={ui.workspace.chronologicalEventsDescription}
                        actions={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={handleExportTimelineCsv}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {ui.workspace.exportTimelineCsv}
                          </Button>
                        }
                      >
                        <div className="space-y-5">
                          <div
                            role="slider"
                            aria-valuemin={1}
                            aria-valuemax={events.length}
                            aria-valuenow={safeIndex + 1}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setActiveTimelineIndex(Math.min(safeIndex + 1, events.length - 1)); }
                              else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setActiveTimelineIndex(Math.max(safeIndex - 1, 0)); }
                              else if (e.key === "Home") { e.preventDefault(); setActiveTimelineIndex(0); }
                              else if (e.key === "End") { e.preventDefault(); setActiveTimelineIndex(events.length - 1); }
                            }}
                            className="relative py-4 outline-none focus-visible:ring-2 focus-visible:ring-stone-500/60 rounded-xl"
                          >
                            <div className="relative h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full">
                              <div
                                className="absolute top-0 left-0 h-1.5 bg-stone-900 dark:bg-stone-100 rounded-full transition-all duration-200"
                                style={{ width: events.length > 1 ? `${(safeIndex / (events.length - 1)) * 100}%` : "100%" }}
                              />
                              {events.map((event: any, index: number) => {
                                const pct = events.length > 1 ? (index / (events.length - 1)) * 100 : 50;
                                const isActive = index === safeIndex;
                                return (
                                  <button
                                    type="button"
                                    key={`scrub-${index}`}
                                    onClick={() => setActiveTimelineIndex(index)}
                                    aria-label={`${event.date} — ${event.event}`}
                                    title={`${event.date}`}
                                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white dark:border-stone-900 transition-all ${significanceColor(event.significance)} ${isActive ? `w-5 h-5 ring-4 ${significanceRing(event.significance)} shadow-lg` : "w-3.5 h-3.5 hover:scale-125"}`}
                                    style={{ left: `${pct}%` }}
                                  />
                                );
                              })}
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] font-medium tracking-wider uppercase text-stone-500 dark:text-stone-400">
                              <span>{events[0]?.date}</span>
                              <span className="tabular-nums">{safeIndex + 1} / {events.length}</span>
                              <span>{events[events.length - 1]?.date}</span>
                            </div>
                          </div>
                          {active ? (
                            <div className={`rounded-[1.25rem] border bg-white/70 p-4 shadow-sm transition-colors dark:bg-stone-800/50 ${active.significance === "high" ? "border-rose-200/80 dark:border-rose-900/50" : active.significance === "medium" ? "border-amber-200/80 dark:border-amber-900/50" : "border-stone-200/80 dark:border-stone-700/80"}`}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${significanceColor(active.significance)}`} />
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">{active.date}</span>
                                <span className="text-[10px] uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">· {translateToken(locale, String(active.significance ?? ""))}</span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-stone-800 dark:text-stone-200">{active.event}</p>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-2">
                            <Button type="button" variant="outline" className="rounded-xl" disabled={safeIndex === 0} onClick={() => setActiveTimelineIndex(Math.max(safeIndex - 1, 0))}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <p className="text-xs text-stone-500 dark:text-stone-400 text-center flex-1">{ui.workspace.chronologicalEventsDescription}</p>
                            <Button type="button" variant="outline" className="rounded-xl" disabled={safeIndex >= events.length - 1} onClick={() => setActiveTimelineIndex(Math.min(safeIndex + 1, events.length - 1))}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </ShellCard>
                    );
                  })()}

                  {caseReviewResult.appellateStressTest ? (
                    <ShellCard title={ui.workspace.appellateStressTest} description={ui.workspace.appellateStressTestDescription}>
                       <div className="space-y-4">
                         <div className="rounded-[1.25rem] border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-900/10">
                           <p className="text-xs uppercase tracking-[0.18em] text-rose-500 font-bold mb-2">{ui.workspace.strongestOpposingArgument}</p>
                           <p className="text-sm leading-6 text-stone-700 dark:text-stone-300">{caseReviewResult.appellateStressTest.strongestOpposingArgument}</p>
                         </div>
                         <div className="rounded-[1.25rem] border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                           <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 font-bold mb-2">{ui.workspace.rebuttalSuggestion}</p>
                           <p className="text-sm leading-6 text-stone-700 dark:text-stone-300">{caseReviewResult.appellateStressTest.rebuttalSuggestion}</p>
                         </div>
                       </div>
                    </ShellCard>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ShellCard title={ui.workspace.caseCheckCitations} description={ui.workspace.caseCheckSummary}>
                      <div className="space-y-3">
                        {(caseReviewResult.citationChecks ?? []).length ? (caseReviewResult.citationChecks ?? []).map((item: any, index: number) => (
                          <div key={`${item.citation}-${index}`} className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill>{translateToken(locale, String(item.status ?? ""))}</StatusPill>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">{item.citation}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{item.note}</p>
                            {(item.supportingSources ?? []).length ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{item.supportingSources.join(" · ")}</p> : null}
                          </div>
                        )) : <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.caseCheckNoItems}</p>}
                      </div>
                    </ShellCard>
                    <ShellCard title={ui.workspace.caseCheckContradictions} description={ui.workspace.caseCheckSummary}>
                      <div className="space-y-3">
                        {(caseReviewResult.contradictions ?? []).length ? (caseReviewResult.contradictions ?? []).map((item: any, index: number) => (
                          <div key={`${item.conflict}-${index}`} className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{item.conflict}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{item.impact}</p>
                            {(item.supportingSources ?? []).length ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{item.supportingSources.join(" · ")}</p> : null}
                          </div>
                        )) : <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.caseCheckNoItems}</p>}
                      </div>
                    </ShellCard>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ShellCard title={ui.workspace.caseCheckCredibility} description={ui.workspace.caseCheckSummary}>
                      <div className="space-y-3">
                        {(caseReviewResult.credibilitySignals ?? []).length ? (caseReviewResult.credibilitySignals ?? []).map((item: any, index: number) => (
                          <div key={`${item.sourceLabel}-${index}`} className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill>{translateToken(locale, String(item.assessment ?? ""))}</StatusPill>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">{item.sourceLabel}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{item.note}</p>
                            {(item.supportingSources ?? []).length ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{item.supportingSources.join(" · ")}</p> : null}
                          </div>
                        )) : <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.caseCheckNoItems}</p>}
                      </div>
                    </ShellCard>
                    <ShellCard title={ui.workspace.caseCheckPrecedent} description={ui.workspace.caseCheckSummary}>
                      <div className="space-y-3">
                        {(caseReviewResult.precedentAnalysis ?? []).length ? (caseReviewResult.precedentAnalysis ?? []).map((item: any, index: number) => (
                          <div key={`${item.precedent}-${index}`} className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill>{translateToken(locale, String(item.relation ?? ""))}</StatusPill>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">{item.precedent}</p>
                            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{item.principle}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{item.note}</p>
                          </div>
                        )) : <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.caseCheckNoItems}</p>}
                      </div>
                    </ShellCard>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ShellCard title={ui.workspace.caseCheckRatio} description={ui.workspace.caseCheckSummary}>
                      <ul className="space-y-2 text-sm leading-6 text-stone-600 dark:text-stone-200">
                        {(caseReviewResult.reasoningStructure?.ratioDecidendi ?? []).length ? (caseReviewResult.reasoningStructure?.ratioDecidendi ?? []).map((item: string, index: number) => <li key={`${item}-${index}`} className="rounded-xl border border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">{item}</li>) : <li>{ui.workspace.caseCheckNoItems}</li>}
                      </ul>
                    </ShellCard>
                    <ShellCard title={ui.workspace.caseCheckObiter} description={ui.workspace.caseCheckSummary}>
                      <ul className="space-y-2 text-sm leading-6 text-stone-600 dark:text-stone-200">
                        {(caseReviewResult.reasoningStructure?.obiterDicta ?? []).length ? (caseReviewResult.reasoningStructure?.obiterDicta ?? []).map((item: string, index: number) => <li key={`${item}-${index}`} className="rounded-xl border border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">{item}</li>) : <li>{ui.workspace.caseCheckNoItems}</li>}
                      </ul>
                    </ShellCard>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ShellCard title={ui.workspace.caseCheckFeedback} description={ui.workspace.caseCheckSummary}>
                      <ul className="space-y-2 text-sm leading-6 text-stone-600 dark:text-stone-200">
                        {(caseReviewResult.judgeFeedback ?? []).length ? (caseReviewResult.judgeFeedback ?? []).map((item: string, index: number) => <li key={`${item}-${index}`} className="rounded-xl border border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">{item}</li>) : <li>{ui.workspace.caseCheckNoItems}</li>}
                      </ul>
                    </ShellCard>
                    <ShellCard title={ui.workspace.caseCheckPreSignature} description={ui.workspace.caseCheckSummary}>
                      <div className="space-y-4 text-sm leading-6 text-stone-600 dark:text-stone-200">
                        <div>
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.workspace.caseCheckBlockers}</p>
                          <ul className="mt-2 space-y-2">
                            {(caseReviewResult.preSignatureReview?.blockers ?? []).length ? (caseReviewResult.preSignatureReview?.blockers ?? []).map((item: string, index: number) => <li key={`${item}-${index}`} className="rounded-xl border border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">{item}</li>) : <li>{ui.workspace.caseCheckNoItems}</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.workspace.caseCheckRecommendedActions}</p>
                          <ul className="mt-2 space-y-2">
                            {(caseReviewResult.preSignatureReview?.recommendedActions ?? []).length ? (caseReviewResult.preSignatureReview?.recommendedActions ?? []).map((item: string, index: number) => <li key={`${item}-${index}`} className="rounded-xl border border-stone-200/80 bg-stone-50/90 px-3 py-2 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">{item}</li>) : <li>{ui.workspace.caseCheckNoItems}</li>}
                          </ul>
                        </div>
                      </div>
                    </ShellCard>
                  </div>
                </>
              ) : (
                <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.workspace.caseCheckEmpty}</p>
              )}
            </div>
          </div>
        </ShellCard>
          </TabsContent>

          <TabsContent value="draft" className="space-y-6 mt-0">
          <div className={`flex flex-col lg:flex-row gap-6 ${activePdfUrl ? 'lg:flex-nowrap items-start' : ''}`}>
               <div className={`flex-1 min-w-0 ${activePdfUrl ? 'lg:max-w-[50%]' : ''}`}>
          <ShellCard
            title={ui.workspace.draftTitle}
            description={ui.workspace.draftDescription}
            actions={
              activeDraft ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                      onClick={() => {
                        if (approvalGateMessage) {
                          toast.error(approvalGateMessage);
                          return;
                        }
                        approveDraftMutation.mutate({ caseId, draftId: activeDraft.id });
                      }}
                      disabled={approveDraftMutation.isPending || activeDraft.status === "approved"}
                    >
                      {ui.workspace.approveDraft}
                    </Button>
                    <Button className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" onClick={() => exportDraftMutation.mutate({ caseId, draftId: activeDraft.id })} disabled={exportDraftMutation.isPending || (!localAutoApprove && activeDraft.status !== "approved")}>
                      {ui.workspace.exportDocx}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                      onClick={() => exportCaseBundleMutation.mutate({ caseId })}
                      disabled={exportCaseBundleMutation.isPending}
                    >
                      {exportCaseBundleMutation.isPending ? ui.workspace.exportBundleRunning : ui.workspace.exportBundle}
                    </Button>
                    {reviewHistory[0]?.id ? (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"
                          onClick={() => exportReviewReportMutation.mutate({ caseId, reviewSnapshotId: reviewHistory[0].id, format: "docx" })}
                          disabled={exportReviewReportMutation.isPending}
                        >
                          {rt.labels.reviewReportDocx}
                        </Button>
                        <Button
                          className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                          onClick={() => exportReviewReportMutation.mutate({ caseId, reviewSnapshotId: reviewHistory[0].id, format: "pdf" })}
                          disabled={exportReviewReportMutation.isPending}
                        >
                          {rt.labels.signedReviewPdf}
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 rounded-[1rem] border border-stone-200/80 bg-white/60 px-4 py-3 shadow-sm transition hover:bg-white/90 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                    <Switch
                      id="auto-approve"
                      checked={localAutoApprove}
                      onCheckedChange={checked => {
                        setLocalAutoApprove(checked);
                        toggleAutoApproveMutation.mutate({ autoApprove: checked });
                      }}
                      disabled={toggleAutoApproveMutation.isPending}
                    />
                    <div className="flex flex-col">
                      <label htmlFor="auto-approve" className="cursor-pointer text-sm font-semibold text-stone-800 dark:text-stone-200">{ui.workspace.autoApproveLabel}</label>
                      <span className="text-xs text-stone-500 dark:text-stone-400">{ui.workspace.autoApproveDescription}</span>
                    </div>
                  </div>
                  {activeDraft.status !== "approved" && !localAutoApprove ? <p className="text-xs leading-5 text-stone-500 dark:text-stone-300">{approvalGateMessage ?? ui.workspace.approvalGateHint}</p> : null}
                </div>
              ) : null
            }
          >
            {activeDraft ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill>{ui.workspace.version} {activeDraft.versionNo}</StatusPill>
                  <StatusPill>{translateToken(locale, activeDraft.status)}</StatusPill>
                  <StatusPill>{translateToken(locale, activeDraft.generationMode)}</StatusPill>
                </div>
                {activeDraft.sections?.map((section: any) => (
                  <div key={section.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4 md:p-5 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(23,27,38,0.96)_0%,rgba(15,18,27,0.98)_100%)]">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-stone-950">{section.sectionTitle}</h3>
                          <StatusPill>{ui.workspace.reviewOptions[section.reviewStatus as keyof typeof ui.workspace.reviewOptions] ?? translateToken(locale, section.reviewStatus)}</StatusPill>
                        </div>
                        <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{section.sectionKey}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className={`rounded-xl border-stone-300/80 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] ${section.reviewStatus === "reviewed" ? "bg-green-600 text-white hover:bg-green-700 border-green-600 dark:bg-green-500 dark:text-white dark:hover:bg-green-400 dark:border-green-500" : "bg-white/92 text-stone-700 hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]"}`} onClick={() => updateSectionMutation.mutate({ caseId, sectionId: section.id, reviewStatus: section.reviewStatus === "reviewed" ? "draft" : "reviewed", sectionText: section.sectionText })} disabled={updateSectionMutation.isPending}>
                          {ui.workspace.markReviewed}
                        </Button>
                        <Button className={`rounded-xl ${section.reviewStatus === "approved" ? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:text-white dark:hover:bg-green-400" : "bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"}`} onClick={() => updateSectionMutation.mutate({ caseId, sectionId: section.id, reviewStatus: section.reviewStatus === "approved" ? "draft" : "approved", sectionText: section.sectionText })} disabled={updateSectionMutation.isPending}>
                          {ui.workspace.approveSection}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {section.paragraphs?.map((paragraph: any) => {
                        const draftState = paragraphDrafts[paragraph.id] ?? {
                          paragraphText: paragraph.paragraphText,
                          rationale: paragraph.rationale ?? "",
                          confidenceScore: paragraph.confidenceScore ?? "0.500",
                          reviewStatus: paragraph.reviewStatus,
                        };
                        return (
                          <div key={paragraph.id} className="rounded-[1.25rem] border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,21,30,0.98)_0%,rgba(10,12,18,0.99)_100%)]">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <StatusPill>{ui.workspace.paragraph} {paragraph.paragraphOrder}</StatusPill>
                              <StatusPill>{ui.workspace.confidence} {draftState.confidenceScore}</StatusPill>
                            </div>
                            <textarea
                              value={draftState.paragraphText}
                              onChange={event =>
                                setParagraphDrafts(current => ({
                                  ...current,
                                  [paragraph.id]: {
                                    ...draftState,
                                    paragraphText: event.target.value,
                                  },
                                }))
                              }
                              className="min-h-[72px] w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm leading-6 text-stone-900 outline-none transition focus:border-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(23,27,38,0.96)_0%,rgba(15,18,27,0.98)_100%)] dark:text-stone-100 dark:focus:border-stone-400"
                            />
                            <div className="mt-3 flex flex-wrap items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <label className="block space-y-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500 dark:text-stone-300">{ui.workspace.rationale}</span>
                                  <textarea
                                    value={draftState.rationale}
                                    onChange={event =>
                                      setParagraphDrafts(current => ({
                                        ...current,
                                        [paragraph.id]: {
                                          ...draftState,
                                          rationale: event.target.value,
                                        },
                                      }))
                                    }
                                    className="min-h-[48px] w-full rounded-xl border border-stone-300/80 bg-white/94 px-4 py-2 text-sm leading-5 text-stone-900 shadow-[0_10px_24px_-18px_rgba(31,41,55,0.18)] outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-400 dark:focus:bg-white/[0.08]"
                                  />
                                </label>
                              </div>
                              <div className="w-28">
                                <InputField
                                  label={ui.workspace.confidence}
                                  value={draftState.confidenceScore}
                                  onChange={value =>
                                    setParagraphDrafts(current => ({
                                      ...current,
                                      [paragraph.id]: {
                                        ...draftState,
                                        confidenceScore: value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="w-36">
                                <SelectField
                                  label={ui.workspace.reviewStatus}
                                  value={draftState.reviewStatus}
                                  onChange={value =>
                                    setParagraphDrafts(current => ({
                                      ...current,
                                      [paragraph.id]: {
                                        ...draftState,
                                        reviewStatus: value as "draft" | "reviewed" | "approved",
                                      },
                                    }))
                                  }
                                  options={[["draft", ui.workspace.reviewOptions.draft], ["reviewed", ui.workspace.reviewOptions.reviewed], ["approved", ui.workspace.reviewOptions.approved]]}
                                />
                              </div>
                              <div className="self-end">
                                <Button
                                  className={`rounded-xl ${paragraph.reviewStatus !== "draft" ? "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:text-white dark:hover:bg-green-400" : "bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"}`}
                                  onClick={() => {
                                    const nextStatus = paragraph.reviewStatus !== "draft" ? "draft" : draftState.reviewStatus;
                                    setParagraphDrafts(current => ({
                                      ...current,
                                      [paragraph.id]: {
                                        ...draftState,
                                        reviewStatus: nextStatus,
                                      },
                                    }));
                                    updateParagraphMutation.mutate({
                                      caseId,
                                      paragraphId: paragraph.id,
                                      paragraphText: draftState.paragraphText,
                                      rationale: draftState.rationale || null,
                                      confidenceScore: draftState.confidenceScore || null,
                                      reviewStatus: nextStatus,
                                    });
                                  }}
                                  disabled={updateParagraphMutation.isPending}
                                >
                                  {updateParagraphMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{ui.workspace.saveParagraph}
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="rounded-[1rem] border border-stone-200/80 bg-stone-50/60 p-3 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{ui.workspace.reasoningTraceTitle}</p>
                                <p className="mt-2 text-sm leading-5 text-stone-700 dark:text-stone-200">{draftState.rationale?.trim() || ui.workspace.rationaleMissing}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <StatusPill>{ui.workspace.reviewOptions[draftState.reviewStatus]}</StatusPill>
                                  <StatusPill>{ui.workspace.confidence} {draftState.confidenceScore}</StatusPill>
                                </div>
                              </div>
                              <div className="rounded-[1rem] border border-stone-200/80 bg-stone-50/60 p-3 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{ui.workspace.evidenceTraceTitle}</p>
                                {(paragraph.annotations ?? []).length ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {paragraph.annotations.map((annotation: any) => (
                                      <div 
                                        key={annotation.id} 
                                        onClick={async () => {
                                          if (annotation.caseDocumentId && caseId) {
                                            try {
                                              const result = await utils.client.judgeAi.cases.downloadUrl.query({ caseId, documentId: annotation.caseDocumentId });
                                              setActivePdfUrl(result.url);
                                            } catch (err) {
                                              console.error("Failed to load PDF URL", err);
                                            }
                                          }
                                        }}
                                        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-stone-200/90 bg-white px-2.5 py-1.5 text-xs text-stone-700 shadow-sm cursor-pointer hover:bg-stone-50 transition-colors dark:border-stone-700/60 dark:bg-[linear-gradient(180deg,rgba(18,21,30,0.98)_0%,rgba(10,12,18,0.99)_100%)] dark:text-stone-200 dark:hover:bg-stone-800"
                                      >
                                        <span className="truncate font-semibold">{annotation.sourceLabel}</span>
                                        <StatusPill>{translateToken(locale, annotation.sourceType)}</StatusPill>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm leading-5 text-stone-500 dark:text-stone-300">{ui.workspace.traceEmpty}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <SectionAuthorNote
                      initialNote={section.authorNote ?? null}
                      saving={saveSectionNoteMutation.isPending && saveSectionNoteMutation.variables?.sectionId === section.id}
                      transcribing={transcribeSectionNoteMutation.isPending && transcribeSectionNoteMutation.variables?.sectionId === section.id}
                      onSave={text => saveSectionNoteMutation.mutate({ caseId: caseId!, sectionId: section.id, authorNote: text.length ? text : null })}
                      onClear={() => saveSectionNoteMutation.mutate({ caseId: caseId!, sectionId: section.id, authorNote: null })}
                      onTranscribe={(base64Audio, mimeType, existingText) =>
                        transcribeSectionNoteMutation.mutate({
                          caseId: caseId!,
                          sectionId: section.id,
                          base64Audio,
                          mimeType,
                          append: true,
                          existingNote: existingText || section.authorNote || null,
                        })
                      }
                      labels={{
                        title: ui.workspace.authorNoteTitle,
                        placeholder: ui.workspace.authorNotePlaceholder,
                        startRecording: ui.workspace.authorNoteStart,
                        stopRecording: ui.workspace.authorNoteStop,
                        transcribing: ui.workspace.authorNoteTranscribing,
                        saveNote: ui.workspace.authorNoteSave,
                        clearNote: ui.workspace.authorNoteClear,
                        unsupported: ui.workspace.authorNoteUnsupported,
                        permissionDenied: ui.workspace.authorNotePermissionDenied,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.workspace.emptyDraft}</p>
            )}
          </ShellCard>
          </div>
          {activePdfUrl && (
            <div className="w-full lg:w-1/2 flex flex-col rounded-[1.35rem] border border-stone-200/80 bg-white/50 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/50 sticky top-4 h-[calc(100vh-2rem)] overflow-hidden">
               <div className="flex justify-between items-center px-4 py-3 border-b border-stone-200/80 dark:border-stone-700/80 bg-white dark:bg-stone-900 z-10">
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                     <FileText className="w-4 h-4 text-stone-500" />
                     Document Viewer
                  </p>
                  <button onClick={() => setActivePdfUrl(null)} className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors bg-stone-100/50 hover:bg-stone-200/50 dark:bg-stone-800/50 dark:hover:bg-stone-700/50 rounded-full p-1.5">
                     <X className="w-4 h-4" />
                  </button>
               </div>
               <div className="flex-1 w-full bg-stone-100/30 dark:bg-black/20 p-2">
                 <iframe 
                   src={activePdfUrl} 
                   className="w-full h-full rounded-xl border border-stone-200/60 dark:border-stone-700/60 shadow-inner bg-white dark:bg-stone-900" 
                 />
               </div>
            </div>
          )}
          </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-0">
          <ShellCard title={ui.workspace.timelineTitle} description={ui.workspace.timelineDescription}>
            <div className="space-y-3">
              {(timelineQuery.data ?? []).length ? (
                timelineQuery.data?.map((item: any) => (
                  <div key={item.id} className="rounded-[1.35rem] border border-stone-200/80 bg-white/84 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-stone-900">{formatActivitySummary(locale, item)}</p>
                      <StatusPill>{rt.actionTypes[item.actionType as keyof typeof rt.actionTypes] ?? item.actionType}</StatusPill>
                    </div>
                    <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{formatTimestamp(item.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.workspace.emptyTimeline}</p>
              )}
            </div>
          </ShellCard>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  function renderHelp() {
    const helpCopy = locale === "el"
      ? {
          introTitle: "Γρήγορη εκκίνηση",
          introDescription: "Ακολουθήστε αυτή τη διαδρομή όταν χρησιμοποιείτε την πλατφόρμα για μια νέα ή ενεργή υπόθεση.",
          steps: [
            "Ανοίξτε ή δημιουργήστε υπόθεση από την ενότητα Υποθέσεις και συμπληρώστε τα βασικά στοιχεία της δικογραφίας.",
            "Ανεβάστε μόνιμο νομικό υλικό στη Βάση Γνώσης ώστε το σύστημα να βρίσκει σχετικούς νόμους, κανονισμούς και νομολογία.",
            "Ανεβάστε έγγραφα υπόθεσης, ελέγξτε για διπλότυπα και κατόπιν χρησιμοποιήστε την αναζήτηση για να εντοπίσετε κρίσιμα αποσπάσματα.",
            "Παράγετε το σχέδιο απόφασης, ελέγξτε τις πέντε ενότητες, βελτιώστε παραγράφους και εγκρίνετε το τελικό αποτέλεσμα πριν από την εξαγωγή DOCX.",
          ],
          functionsTitle: "Τι κάνει κάθε βασική λειτουργία",
          functionsDescription: "Η ενότητα αυτή εξηγεί με απλή γλώσσα πότε και γιατί χρησιμοποιείται κάθε εργαλείο.",
          functions: [
            { title: "Βάση Γνώσης", description: "Αποθηκεύει μόνιμα νόμους, κανονισμούς, νομολογία και υλικό αναφοράς που μπορεί να χρησιμοποιηθεί σε πολλές υποθέσεις.", example: "Παράδειγμα: ανεβάζετε έναν νόμο και σχετικές αποφάσεις ώστε να ανακτώνται σε μελλοντικές συντάξεις.", icon: BookCopy },
            { title: "Διαχείριση Υποθέσεων", description: "Οργανώνει τον αριθμό υπόθεσης, τη δικαιοδοσία, το επίπεδο δικαστηρίου, τον τύπο υπόθεσης και τη σύνοψη.", example: "Παράδειγμα: δημιουργείτε νέα διοικητική υπόθεση πριν ανεβάσετε δικόγραφα και αποδείξεις.", icon: Gavel },
            { title: "Αναζήτηση φακέλου", description: "Εντοπίζει σχετικά αποσπάσματα τόσο από τα έγγραφα της υπόθεσης όσο και από τη βάση νομικής γνώσης.", example: "Παράδειγμα: αναζητάτε μια διάταξη ή αναφορά σε κρίσιμο αποδεικτικό στοιχείο πριν από τη σύνταξη.", icon: Search },
            { title: "AI Drafting", description: "Παράγει δομημένο σχέδιο απόφασης με ακριβώς πέντε ενότητες: header, facts, issues, reasoning και operative part.", example: "Παράδειγμα: αφού συμπληρωθεί ο φάκελος, ζητάτε πρώτο προσχέδιο για να ξεκινήσει ο δικαστικός έλεγχος.", icon: Sparkles },
            { title: "Έλεγχος και ιχνηλασιμότητα", description: "Διατηρεί αιτιολόγηση, βαθμό βεβαιότητας, annotations και πλήρες timeline ενεργειών για κάθε υπόθεση.", example: "Παράδειγμα: εξετάζετε γιατί μια παράγραφος προτάθηκε και ποια πηγή υποστήριξε τη διατύπωση.", icon: ShieldCheck },
            { title: "Εξαγωγή DOCX", description: "Εξάγει μόνο εγκεκριμένα σχέδια σε μορφή DOCX για επίσημη περαιτέρω χρήση.", example: "Παράδειγμα: μετά την έγκριση, εξάγετε το τελικό κείμενο για αρχειοθέτηση ή περαιτέρω επεξεργασία.", icon: History },
          ],
          examplesTitle: "Παραδείγματα χρήσης",
          examplesDescription: "Τυπικά σενάρια που βοηθούν έναν νέο χρήστη να ξεκινήσει πιο γρήγορα.",
          examples: [
            { title: "Σενάριο 1: νέα υπόθεση", text: "Δημιουργήστε την υπόθεση, ανεβάστε δικόγραφα και αποδεικτικά, κάντε αναζήτηση στον φάκελο και έπειτα δημιουργήστε το πρώτο σχέδιο απόφασης." },
            { title: "Σενάριο 2: επαναλαμβανόμενο νομικό θέμα", text: "Περάστε πρώτα τους βασικούς νόμους και τη νομολογία στη Βάση Γνώσης ώστε η επόμενη παρόμοια υπόθεση να επωφεληθεί άμεσα από το ίδιο υλικό." },
            { title: "Σενάριο 3: τελικός έλεγχος", text: "Ελέγξτε τις παραγράφους, τις αιτιολογήσεις, τις παραπομπές και το timeline και μετά εγκρίνετε το σχέδιο πριν από την εξαγωγή DOCX." },
            { title: "Σενάριο 4: μαζική εισαγωγή", text: "Χρησιμοποιήστε τη μαζική εισαγωγή όταν πολλά εκθέματα, δικόγραφα και παραρτήματα φτάνουν μαζί ώστε η πλατφόρμα να τα κατηγοριοποιήσει και να τα καταγράψει σε μία ροή." },
            { title: "Σενάριο 5: έλεγχος απόφασης", text: "Επικολλήστε σχέδιο απόφασης στον ελεγκτή συνέπειας για να δείτε αν η αιτιολογία στηρίζεται, στηρίζεται εν μέρει, αντικρούεται ή στερείται επαρκούς νομικής ή αποδεικτικής βάσης." },
          ],
          guidanceTitle: "Οδηγίες καλής χρήσης",
          guidanceDescription: "Μικρές πρακτικές που βελτιώνουν την ποιότητα των αποτελεσμάτων και μειώνουν τα λάθη.",
          guidance: [
            "Ανεβάζετε καθαρά και σωστά ονομασμένα αρχεία ώστε η επεξεργασία και η αναζήτηση να λειτουργούν καλύτερα.",
            "Χρησιμοποιείτε τη Βάση Γνώσης για υλικό που πρέπει να παραμένει διαθέσιμο σε πολλές υποθέσεις.",
            "Ελέγχετε πάντα το reasoning και το operative part πριν από την τελική έγκριση του σχεδίου.",
            "Χρησιμοποιείτε τη μαζική εισαγωγή όταν φτάνουν μαζί μεγάλοι φάκελοι ώστε η κατηγοριοποίηση και ο έλεγχος διπλοτύπων να παραμένουν αποδοτικά.",
            "Εκτελείτε τον έλεγχο νομικής συνέπειας πριν από την τελική έγκριση όταν θέλετε έναν γρήγορο ποιοτικό έλεγχο απέναντι στις αποδείξεις και στο εφαρμοστέο δίκαιο.",
            "Χρησιμοποιείτε το timeline για να επιβεβαιώνετε ποιος έκανε τι και πότε σε κάθε κρίσιμο στάδιο.",
          ],
        }
      : {
          introTitle: "Quick start",
          introDescription: "Follow this path when using the platform for a new or active matter.",
          steps: [
            "Open or create a case from the Cases section and complete the core case metadata.",
            "Upload permanent legal materials to the Knowledge Base so the system can retrieve relevant statutes, regulations, and precedents.",
            "Upload case documents, review duplicate detection results, and use search to surface the most relevant passages.",
            "Generate the decision draft, review the five required sections, refine paragraphs, and approve the final result before DOCX export.",
          ],
          functionsTitle: "What each main function does",
          functionsDescription: "This section explains in simple language when and why each part of the platform should be used.",
          functions: [
            { title: "Knowledge Base", description: "Stores statutes, regulations, precedents, and reusable legal references for use across many cases.", example: "Example: upload a statute and leading decisions so they can be retrieved in later drafting sessions.", icon: BookCopy },
            { title: "Case Management", description: "Organizes the case number, jurisdiction, court level, case type, and working summary.", example: "Example: create a new administrative matter before uploading pleadings and evidence.", icon: Gavel },
            { title: "Case Record Search", description: "Finds relevant passages from both case documents and the permanent legal knowledge base.", example: "Example: search for a statutory article or a key evidentiary statement before refining the draft.", icon: Search },
            { title: "AI Drafting", description: "Generates a structured decision draft with exactly five sections: header, facts, issues, reasoning, and operative part.", example: "Example: once the file is complete, request a first draft to begin judicial review.", icon: Sparkles },
            { title: "Batch Import", description: "Imports many files in one action and automatically categorizes them so the user does not have to upload and classify each document manually.", example: "Example: import a full submission bundle and let the platform separate pleadings, evidence, and references automatically.", icon: BookOpen },
            { title: "Case Consistency Review", description: "Checks whether a draft or judgment is supported by the available evidence and the applicable legal materials.", example: "Example: paste a reasoning section to detect contradictions, weak support, and feedback points for the judge.", icon: Scale },
            { title: "Review and audit trail", description: "Preserves rationale, confidence, annotations, and a full activity timeline for each matter.", example: "Example: inspect why a paragraph was suggested and which source supported the wording.", icon: ShieldCheck },
            { title: "DOCX Export", description: "Exports only approved drafts into DOCX format for official downstream use.", example: "Example: after approval, export the final text for filing or formal editing.", icon: History },
          ],
          examplesTitle: "Usage examples",
          examplesDescription: "Typical scenarios that help a new user get productive faster.",
          examples: [
            { title: "Scenario 1: a new case", text: "Create the matter, upload pleadings and evidence, search the record, and then generate the first draft for review." },
            { title: "Scenario 2: a recurring legal issue", text: "Upload the core statutes and precedents to the Knowledge Base first so the next similar matter benefits from the same legal foundation." },
            { title: "Scenario 3: final review", text: "Inspect paragraphs, rationale, citations, and timeline entries, then approve the draft before DOCX export." },
            { title: "Scenario 4: large document intake", text: "Use batch import when many exhibits, pleadings, and annexes arrive together so the platform can categorize and register them in one pass." },
            { title: "Scenario 5: judgment validation", text: "Paste a draft judgment into the consistency checker to see whether the reasoning is supported, partly supported, contradicted, or missing legal or evidentiary basis." },
          ],
          guidanceTitle: "Good-use guidance",
          guidanceDescription: "Small practices that improve output quality and reduce mistakes.",
          guidance: [
                       "Upload clean, clearly named files so extraction and search work more reliably.",
            "Use the Knowledge Base for material that should remain available across many cases.",
            "Always review the reasoning and operative part before final approval of a draft.",
            "Use batch import when large document bundles arrive together so categorization and duplicate detection remain efficient.",
            "Run the legal consistency checker before final approval when you want a fast quality-control pass against the evidence and the applicable law.",
            "Use the timeline to confirm who performed each important action and when it happened.",
          ],
        };

    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <ShellCard title={helpCopy.introTitle} description={helpCopy.introDescription}>
            <div className="space-y-3">
              {helpCopy.steps.map((step, index) => (
                <div key={step} className="rounded-[1.35rem] border border-stone-200/80 bg-white/88 p-4 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1f2538_0%,#30374c_100%)] text-sm font-semibold text-stone-50 dark:bg-[linear-gradient(135deg,#f4efe2_0%,#dfd4bc_100%)] dark:text-stone-900">{index + 1}</div>
                    <p className="text-sm leading-7 text-stone-700 dark:text-stone-200">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard title={helpCopy.functionsTitle} description={helpCopy.functionsDescription}>
            <div className="grid gap-4 md:grid-cols-2">
              {helpCopy.functions.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-[1.4rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,242,234,0.96))] p-5 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1f2538_0%,#30374c_100%)] text-stone-50 shadow-[0_16px_28px_-18px_rgba(27,35,54,0.7)] dark:bg-[linear-gradient(135deg,#f4efe2_0%,#dfd4bc_100%)] dark:text-stone-900">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-stone-950 dark:text-stone-100">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-200">{item.description}</p>
                    <p className="mt-3 rounded-[1rem] border border-stone-200/80 bg-white/85 px-4 py-3 text-sm leading-6 text-stone-600 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,22,31,0.96)_0%,rgba(12,15,22,0.98)_100%)] dark:text-stone-200">{item.example}</p>
                  </div>
                );
              })}
            </div>
          </ShellCard>
        </div>

        <div className="space-y-6">
          <ShellCard title={helpCopy.examplesTitle} description={helpCopy.examplesDescription}>
            <div className="space-y-3">
              {helpCopy.examples.map(example => (
                <div key={example.title} className="rounded-[1.35rem] border border-stone-200/80 bg-white/88 p-5 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                  <p className="text-sm font-semibold text-stone-950 dark:text-stone-100">{example.title}</p>
                  <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-200">{example.text}</p>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard title={helpCopy.guidanceTitle} description={helpCopy.guidanceDescription}>
            <div className="space-y-3">
              {helpCopy.guidance.map(item => (
                <div key={item} className="rounded-[1.35rem] border border-stone-200/80 bg-white/88 px-4 py-4 text-sm leading-7 text-stone-700 shadow-sm dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-200">
                  {item}
                </div>
              ))}
            </div>
          </ShellCard>
        </div>
      </div>
    );
  }

  function renderUsageDashboard() {
    const [days, setDays] = [usageDashboardDays, setUsageDashboardDays];
    const query = usageStatsQuery;
    const data = query.data;
    return (
      <div className="space-y-6">
        <ShellCard
          title={ui.admin.usageTitle}
          description={ui.admin.usageDescription}
          actions={
            <select
              value={days}
              onChange={event => setDays(Number(event.target.value))}
              className="h-9 rounded-lg border border-stone-300/80 bg-white px-3 text-sm text-stone-900 shadow-sm focus:border-stone-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-100"
            >
              <option value={7}>{ui.admin.usageRange7}</option>
              <option value={30}>{ui.admin.usageRange30}</option>
              <option value={90}>{ui.admin.usageRange90}</option>
            </select>
          }
        >
          {query.isLoading ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">{ui.admin.usageLoading}</p>
          ) : data && data.totalRequests > 0 ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-700/80 dark:bg-[#151923]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">{ui.admin.usageRequests}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950 dark:text-stone-50">{data.totalRequests.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-700/80 dark:bg-[#151923]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">{ui.admin.usageTotalTokens}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950 dark:text-stone-50">{data.totalTokens.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-700/80 dark:bg-[#151923]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">{ui.admin.usageCompletion}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950 dark:text-stone-50">{data.totalCompletionTokens.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-700/80 dark:bg-[#151923]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">{ui.admin.usageCacheHit}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-950 dark:text-stone-50">{(data.cacheHitRate * 100).toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{data.totalCachedTokens.toLocaleString()} / {data.totalPromptTokens.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.admin.usageByDay}</p>
                <div className="space-y-1">
                  {data.byDay.map(row => {
                    const max = Math.max(...data.byDay.map(d => d.totalTokens), 1);
                    const pct = (row.totalTokens / max) * 100;
                    return (
                      <div key={row.day} className="flex items-center gap-3 text-xs">
                        <span className="w-24 shrink-0 font-medium text-stone-600 dark:text-stone-300">{row.day}</span>
                        <div className="relative h-3 flex-1 rounded-full bg-stone-100 dark:bg-stone-800">
                          <div
                            className="h-full rounded-full bg-stone-900 dark:bg-stone-100"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-28 shrink-0 text-right font-medium tabular-nums text-stone-700 dark:text-stone-200">
                          {row.totalTokens.toLocaleString()} ({row.requests})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.admin.usageByProvider}</p>
                <div className="overflow-hidden rounded-xl border border-stone-200/80 dark:border-stone-700/80">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
                      <tr>
                        <th className="px-3 py-2 text-left">{ui.admin.usageColProvider}</th>
                        <th className="px-3 py-2 text-right">{ui.admin.usageColRequests}</th>
                        <th className="px-3 py-2 text-right">{ui.admin.usageColTokens}</th>
                        <th className="px-3 py-2 text-right">{ui.admin.usageColCached}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byProvider.map(row => (
                        <tr key={row.providerName} className="border-t border-stone-200/80 dark:border-stone-700/80">
                          <td className="px-3 py-2 text-stone-900 dark:text-stone-100">{row.providerName}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-stone-700 dark:text-stone-200">{row.requests.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-stone-700 dark:text-stone-200">{row.totalTokens.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-stone-700 dark:text-stone-200">
                            {row.cachedTokens.toLocaleString()} ({row.totalTokens > 0 ? ((row.cachedTokens / row.totalTokens) * 100).toFixed(0) : 0}%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">{ui.admin.usageEmpty}</p>
          )}
        </ShellCard>
      </div>
    );
  }

  function renderAdmin() {
    const adminTabsCopy = locale === "el"
      ? { providers: "Πάροχοι AI", users: "Χρήστες", advanced: "Προηγμένες ρυθμίσεις" }
      : { providers: "AI Providers", users: "Users", advanced: "Advanced settings" };
    const isAdmin = user?.role === "admin";
    const tabColClass = isAdmin ? "grid-cols-4 sm:grid-cols-4" : "grid-cols-1";
    return (
      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className={`grid w-full ${tabColClass} gap-1 rounded-xl border border-stone-200 bg-white p-1 sm:w-auto sm:inline-grid dark:border-white/10 dark:bg-[#151923]`}>
          <TabsTrigger value="providers" className="rounded-lg text-sm">{adminTabsCopy.providers}</TabsTrigger>
          {isAdmin ? <TabsTrigger value="users" className="rounded-lg text-sm">{adminTabsCopy.users}</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="usage" className="rounded-lg text-sm">{ui.admin.usageTabLabel}</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="data" className="rounded-lg text-sm">{ui.admin.dataTabLabel}</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="providers" className="space-y-6 mt-0">
          <ShellCard title={ui.admin.providerTitle} description={ui.admin.providerDescription}>
            <form className="space-y-4" onSubmit={handleProviderSave}>
              <InputField label={ui.admin.configurationName} value={providerForm.name} onChange={value => setProviderForm(current => ({ ...current, name: value }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label={ui.admin.providerType} value={providerForm.providerType} onChange={value => {
                  const type = value as "openai" | "azure_openai" | "custom_openai_compatible" | "alibaba_cloud" | "kimi" | "deepseek";
                  setProviderTestResult(null);
                  if (type === "alibaba_cloud") {
                    setProviderForm(current => ({
                      ...current,
                      providerType: type,
                      name: current.name || "Alibaba Cloud Singapore",
                      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
                      model: "qwen-coder-plus",
                      apiKey: current.apiKey,
                      draftTemperature: "0.2",
                    }));
                  } else if (type === "kimi") {
                    setProviderForm(current => ({
                      ...current,
                      providerType: type,
                      name: current.name || "Kimi (Moonshot)",
                      endpoint: "https://api.moonshot.cn/v1",
                      model: "moonshot-v1-8k",
                      apiKey: current.apiKey,
                      draftTemperature: "0.2",
                    }));
                  } else if (type === "deepseek") {
                    setProviderForm(current => ({
                      ...current,
                      providerType: type,
                      name: current.name || "DeepSeek",
                      endpoint: "https://api.deepseek.com/v1",
                      model: "deepseek-chat",
                      apiKey: current.apiKey,
                      draftTemperature: "0.2",
                    }));
                  } else {
                    setProviderForm(current => ({ ...current, providerType: type }));
                  }
                }} options={[
                  ["openai", ui.admin.providerOptions.openai],
                  ["azure_openai", ui.admin.providerOptions.azure_openai],
                  ["custom_openai_compatible", ui.admin.providerOptions.custom_openai_compatible],
                  ["alibaba_cloud", ui.admin.providerOptions.alibaba_cloud],
                  ["kimi", ui.admin.providerOptions.kimi],
                  ["deepseek", ui.admin.providerOptions.deepseek],
                ]} />
                <InputField label={ui.admin.modelDeployment} value={providerForm.model} onChange={value => setProviderForm(current => ({ ...current, model: value }))} />
              </div>
              <InputField label={ui.admin.endpoint} value={providerForm.endpoint} onChange={value => setProviderForm(current => ({ ...current, endpoint: value }))} />
              <InputField label={ui.admin.apiKey} value={providerForm.apiKey} type="password" onChange={value => setProviderForm(current => ({ ...current, apiKey: value }))} />
              <Collapsible className="rounded-xl border border-stone-200 bg-stone-50/60 dark:border-white/10 dark:bg-white/[0.03]">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-stone-700 dark:text-stone-200">
                  <span>{adminTabsCopy.advanced}</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 px-4 pb-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputField label={ui.admin.azureApiVersion} value={providerForm.azureApiVersion} onChange={value => setProviderForm(current => ({ ...current, azureApiVersion: value }))} />
                    <InputField label={ui.admin.draftTemperature} value={providerForm.draftTemperature} onChange={value => setProviderForm(current => ({ ...current, draftTemperature: value }))} />
                  </div>
                  <InputField
                    label={ui.admin.maxTokens}
                    value={providerForm.maxTokens}
                    onChange={value => setProviderForm(current => ({ ...current, maxTokens: value }))}
                  />
                  <TextAreaField label={ui.admin.systemPrompt} value={providerForm.defaultSystemPrompt} onChange={value => setProviderForm(current => ({ ...current, defaultSystemPrompt: value }))} />
                </CollapsibleContent>
              </Collapsible>
              {providerTestResult && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${providerTestResult.ok ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"}`}>
                  {providerTestResult.message}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={saveProviderMutation.isPending}>
                  {saveProviderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}{ui.admin.saveProvider}
                </Button>
                <Button type="button" variant="outline" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100" disabled={testProviderMutation.isPending || !providerForm.endpoint || !providerForm.model} onClick={() => {
                  setProviderTestResult(null);
                  testProviderMutation.mutate({
                    providerType: providerForm.providerType,
                    endpoint: providerForm.endpoint,
                    model: providerForm.model,
                    apiKey: providerForm.apiKey || null,
                    azureApiVersion: providerForm.azureApiVersion || null,
                  });
                }}>
                  {testProviderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{ui.admin.testProvider}
                </Button>
              </div>
            </form>
          </ShellCard>

          <ShellCard title={ui.admin.configuredProvidersTitle} description={ui.admin.configuredProvidersDescription}>
            <div className="space-y-3">
              {(providerSettingsQuery.data ?? []).length ? (
                providerSettingsQuery.data?.map((provider: any) => (
                  <div key={provider.id} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{provider.name}</p>
                          <StatusPill>{provider.providerType}</StatusPill>
                          {provider.isActive ? <StatusPill>{ui.admin.active}</StatusPill> : null}
                        </div>
                        <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{provider.endpoint} · {provider.model}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => {
                          setProviderTestResult(null);
                          setProviderForm({
                            id: provider.id,
                            name: provider.name,
                            providerType: provider.providerType,
                            endpoint: provider.endpoint,
                            model: provider.model,
                            apiKey: "",
                            azureApiVersion: provider.azureApiVersion ?? "",
                            defaultSystemPrompt: provider.defaultSystemPrompt ?? "",
                            draftTemperature: provider.draftTemperature ?? "0.2",
                            maxTokens: provider.maxTokens != null ? String(provider.maxTokens) : "8000",
                          });
                        }}>
                          {ui.admin.editProvider}
                        </Button>
                        {!provider.isActive ? (
                          <Button variant="outline" size="sm" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => activateProviderMutation.mutate({ providerId: provider.id })} disabled={activateProviderMutation.isPending}>
                            {ui.admin.makeActive}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.admin.noProviders}</p>
              )}
            </div>
          </ShellCard>

          <ShellCard title={ui.admin.ocrTitle} description={ui.admin.ocrDescription}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="ocr-enabled"
                  checked={ocrSettingsQuery.data?.enabled ?? true}
                  onCheckedChange={checked => {
                    saveOcrSettingsMutation.mutate({ enabled: checked });
                  }}
                  disabled={saveOcrSettingsMutation.isPending || ocrSettingsQuery.isLoading}
                />
                <div className="flex flex-col">
                  <label htmlFor="ocr-enabled" className="cursor-pointer text-sm font-semibold text-stone-800 dark:text-stone-200">{ui.admin.ocrEnabled}</label>
                  <span className="text-xs text-stone-500 dark:text-stone-400">{ocrSettingsQuery.data?.provider ?? "tesseract"} · {ocrSettingsQuery.data?.language ?? "ell+eng"}</span>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ui.admin.ocrTest}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{ui.admin.ocrTestDescription}</p>
                <div className="mt-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/tiff,image/webp,image/bmp,image/gif"
                    onChange={event => {
                      const file = event.target.files?.[0] ?? null;
                      setOcrTestFile(file);
                      setOcrTestResult("");
                    }}
                    className="block w-full text-sm text-stone-700 file:mr-4 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-stone-50 dark:text-stone-200 dark:file:bg-stone-100 dark:file:text-stone-900"
                  />
                </div>
                {ocrTestFile ? (
                  <Button
                    className="mt-3 rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                    onClick={async () => {
                      if (!ocrTestFile) return;
                      const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = reader.result as string;
                          const base64Content = result.split(",")[1] ?? "";
                          resolve(base64Content);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(ocrTestFile);
                      });
                      testOcrMutation.mutate({ base64Image: base64 });
                    }}
                    disabled={testOcrMutation.isPending}
                  >
                    {testOcrMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {ui.admin.ocrTest}
                  </Button>
                ) : null}
                {ocrTestResult ? (
                  <div className="mt-3 rounded-[1.25rem] border border-stone-200/80 bg-white p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{ui.admin.ocrTestResult}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700 dark:text-stone-200">{ocrTestResult || ui.admin.ocrTestNoResult}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </ShellCard>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="usage" className="space-y-6 mt-0">
            {renderUsageDashboard()}
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="data" className="space-y-6 mt-0">
            <ShellCard title={ui.admin.dataTitle} description={ui.admin.dataDescription}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="flex flex-col gap-3 rounded-[1.25rem] border border-rose-200/70 bg-rose-50/60 p-5 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-700 dark:text-rose-200" />
                    <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">{ui.admin.resetFactoryTitle}</p>
                  </div>
                  <p className="text-sm leading-6 text-rose-800/90 dark:text-rose-100/85">{ui.admin.resetFactoryDescription}</p>
                  <Button
                    variant="outline"
                    className="mt-auto self-start rounded-xl border-rose-300 bg-white/90 text-rose-700 hover:bg-rose-100 hover:text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-50 dark:hover:bg-rose-500/30"
                    onClick={() => { setResetConfirmText(""); setResetScope("factory"); }}
                    disabled={resetSystemMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {ui.admin.resetFactoryAction}
                  </Button>
                </div>
                <div className="flex flex-col gap-3 rounded-[1.25rem] border border-amber-200/70 bg-amber-50/60 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-amber-700 dark:text-amber-200" />
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{ui.admin.resetProgramTitle}</p>
                  </div>
                  <p className="text-sm leading-6 text-amber-800/90 dark:text-amber-100/85">{ui.admin.resetProgramDescription}</p>
                  <Button
                    variant="outline"
                    className="mt-auto self-start rounded-xl border-amber-300 bg-white/90 text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-50 dark:hover:bg-amber-500/30"
                    onClick={() => { setResetConfirmText(""); setResetScope("program_data"); }}
                    disabled={resetSystemMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {ui.admin.resetProgramAction}
                  </Button>
                </div>
                <div className="flex flex-col gap-3 rounded-[1.25rem] border border-sky-200/70 bg-sky-50/60 p-5 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                    <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">{ui.admin.resetSettingsTitle}</p>
                  </div>
                  <p className="text-sm leading-6 text-sky-800/90 dark:text-sky-100/85">{ui.admin.resetSettingsDescription}</p>
                  <Button
                    variant="outline"
                    className="mt-auto self-start rounded-xl border-sky-300 bg-white/90 text-sky-800 hover:bg-sky-100 hover:text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-50 dark:hover:bg-sky-500/30"
                    onClick={() => { setResetConfirmText(""); setResetScope("settings"); }}
                    disabled={resetSystemMutation.isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {ui.admin.resetSettingsAction}
                  </Button>
                </div>
              </div>
            </ShellCard>
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="users" className="space-y-6 mt-0">
          <ShellCard title={ui.admin.userManagementTitle} description={ui.admin.userManagementDescription}>
            <div className="space-y-3">
              {(usersQuery.data ?? []).length ? (
                usersQuery.data?.map((account: any) => (
                  <div key={account.id} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{account.name || ui.admin.unnamedUser}</p>
                          <StatusPill>{translateToken(locale, account.role)}</StatusPill>
                          <StatusPill>{translateToken(locale, account.status)}</StatusPill>
                        </div>
                        <p className="mt-2 text-sm text-stone-600 dark:text-stone-200">{account.email || account.openId}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => updateUserMutation.mutate({ userId: account.id, role: account.role === "admin" ? "judge" : "admin" })} disabled={updateUserMutation.isPending || account.id === user?.id}>
                          {ui.admin.toggleRole}
                        </Button>
                        <Button variant="outline" className="rounded-xl border-stone-300/80 bg-white/92 text-stone-700 shadow-[0_10px_26px_-18px_rgba(31,41,55,0.2)] hover:bg-stone-100/95 hover:text-stone-950 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(26,31,43,0.98)_0%,rgba(17,20,29,0.99)_100%)] dark:text-stone-100 dark:hover:bg-[linear-gradient(180deg,rgba(36,42,57,0.98)_0%,rgba(24,28,38,0.99)_100%)]" onClick={() => updateUserMutation.mutate({ userId: account.id, status: account.status === "active" ? "suspended" : "active" })} disabled={updateUserMutation.isPending || account.id === user?.id}>
                          {account.status === "active" ? ui.admin.suspend : ui.admin.reactivate}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.admin.noUsers}</p>
              )}
            </div>
          </ShellCard>
          </TabsContent>
        ) : null}
      </Tabs>
    );
  }

  const title = caseId
    ? workspaceQuery.data?.case?.title ?? copy.shell.casesTitle
    : location === "/cases"
      ? copy.shell.casesTitle
      : location === "/knowledge"
        ? copy.shell.knowledgeTitle
        : location === "/help"
          ? copy.shell.helpTitle
          : location === "/admin"
            ? copy.shell.adminTitle
            : copy.shell.overviewTitle;

  const description = caseId
    ? workspaceQuery.data?.case?.summary || copy.shell.workspaceDescription
    : location === "/cases"
      ? copy.shell.casesDescription
      : location === "/knowledge"
        ? copy.shell.knowledgeDescription
        : location === "/help"
          ? copy.shell.helpDescription
          : location === "/admin"
            ? copy.shell.adminDescription
            : copy.shell.overviewDescription;


  const navLabels = copy.nav;
  const breadcrumbs: Array<{ label: string; path?: string }> = caseId
    ? [
        { label: navLabels.cases, path: "/cases" },
        { label: workspaceQuery.data?.case?.title ?? `#${caseId}` },
      ]
    : location === "/cases"
      ? [{ label: navLabels.cases }]
      : location === "/knowledge"
        ? [{ label: navLabels.knowledge }]
        : location === "/help"
          ? [{ label: navLabels.help }]
          : location === "/admin"
            ? [{ label: navLabels.admin }]
            : [{ label: navLabels.overview }];

  return (
      <DashboardLayout
      navGroups={navGroups}
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={actions}
    >

      {!isAuthenticated ? null : caseId ? renderCaseWorkspace() : location === "/cases" ? renderCases() : location === "/knowledge" ? renderKnowledge() : location === "/help" ? renderHelp() : location === "/admin" ? renderAdmin() : renderOverview()}

      <AlertDialog
        open={resetScope !== null}
        onOpenChange={open => {
          if (!open) {
            setResetScope(null);
            setResetConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ui.admin.resetConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetScope === "factory"
                ? ui.admin.resetFactoryDescription
                : resetScope === "program_data"
                  ? ui.admin.resetProgramDescription
                  : resetScope === "settings"
                    ? ui.admin.resetSettingsDescription
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-200">{ui.admin.resetConfirmBody}</p>
            <Input
              autoFocus
              value={resetConfirmText}
              onChange={event => setResetConfirmText(event.target.value)}
              placeholder={ui.admin.resetConfirmType}
              className="h-11 rounded-lg border-stone-300/80 bg-white text-sm dark:border-white/10 dark:bg-white/[0.05]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetSystemMutation.isPending}>{ui.admin.resetConfirmCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                handleConfirmReset();
              }}
              disabled={resetConfirmText !== "RESET" || resetSystemMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500"
            >
              {resetSystemMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {ui.admin.resetConfirmRun}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showKeyboardHelp} onOpenChange={open => setShowKeyboardHelp(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              {ui.shortcuts.helpTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>{ui.shortcuts.helpDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2">
            {ui.shortcuts.entries.map(([keys, description]) => (
              <li key={keys} className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]">
                <span className="text-stone-700 dark:text-stone-200">{description}</span>
                <kbd className="rounded-md border border-stone-300 bg-white px-2 py-0.5 font-mono text-xs text-stone-800 shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-stone-100">{keys}</kbd>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{ui.shortcuts.close}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmCaseId !== null} onOpenChange={open => { if (!open) setDeleteConfirmCaseId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ui.cases.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{ui.cases.deleteConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCaseMutation.isPending}>{ui.cases.deleteConfirmCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                if (deleteConfirmCaseId) deleteCaseMutation.mutate({ caseId: deleteConfirmCaseId });
              }}
              disabled={deleteCaseMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500"
            >
              {deleteCaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {ui.cases.deleteConfirmRun}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
