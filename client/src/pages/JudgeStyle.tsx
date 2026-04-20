import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/contexts/LocaleContext";
import { fileToBase64 } from "@/lib/fileUpload";
import { repairMojibakeObject } from "@/lib/textEncoding";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Brain,
  FileText,
  Gavel,
  Home,
  Loader2,
  PenTool,
  Plus,
  Scale,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/* ─── Reusable ShellCard ─── */
function ShellCard({
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
    <section
      className={`rounded-[1.85rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(250,247,240,0.97)_100%)] p-6 shadow-[0_26px_90px_-56px_rgba(29,37,56,0.3)] ring-1 ring-white/70 backdrop-blur-xl dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(22,26,36,0.98)_0%,rgba(13,16,24,0.99)_100%)] dark:ring-white/5 dark:shadow-[0_28px_90px_-54px_rgba(0,0,0,0.78)] xl:p-7 ${className}`}
    >
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[1.35rem] font-semibold tracking-tight text-stone-950 dark:text-stone-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-[0.98rem] leading-7 text-stone-600 dark:text-stone-200">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ─── Status pill ─── */
function StatusPill({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" }) {
  const classes = {
    default: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[variant]}`}>
      {children}
    </span>
  );
}

const copyByLocale = {
  en: {
    work: "Work",
    system: "System",
    dashboard: "Dashboard",
    cases: "Cases",
    knowledgeBase: "Knowledge Base",
    judgeStyle: "Judge Style",
    logs: "Logs",
    pageDescription: "Upload past judgments and build a personalized writing style profile for AI-generated drafts.",
    styleProfiles: "Style Profiles",
    styleProfilesDescription: "Create and manage profiles that capture your judicial writing style.",
    newProfile: "New Profile",
    profileNamePlaceholder: "Profile name (e.g., Inheritance Law Style)",
    create: "Create",
    loadingProfiles: "Loading profiles...",
    noProfiles: "No style profiles yet. Create one to get started.",
    analyzed: "Analyzed",
    pending: "Pending",
    judgmentsUploaded: (count: number) => `${count} judgment${count === 1 ? "" : "s"} uploaded`,
    updated: (date: string) => `Updated ${date}`,
    deleteProfileConfirm: "Delete this profile and all its judgments?",
    profileCreated: "Profile created",
    profileDeleted: "Profile deleted",
    judgmentsExtracted: (count: number) => `${count} judgments extracted and uploaded`,
    judgmentUploaded: "Judgment uploaded",
    judgmentRemoved: "Judgment removed",
    analysisStarted: "Style analysis started. This may take a few minutes.",
    uploadFailed: "Upload failed",
    selectedProfileDescription: (count: number) => `${count} judgment document${count === 1 ? "" : "s"} uploaded.`,
    analyzeTitleReady: "Analyze uploaded judgments to extract writing style",
    analyzeTitleDisabled: "Upload at least 3 judgments to enable analysis",
    analyzeStyle: "Analyze Style",
    analysisRequirement: "Upload at least 3 past judgments to enable AI style analysis. You can upload a single file containing multiple judgments and use \"split automatically\".",
    extractedStyleProfile: "Extracted Style Profile",
    uploadJudgment: "Upload Judgment",
    splitAutomatically: "This file contains multiple judgments - split automatically",
    titlePlaceholder: "Title / Case name",
    caseTypePlaceholder: "Case type (optional)",
    jurisdictionPlaceholder: "Jurisdiction (optional)",
    upload: "Upload",
    selectedFile: "Selected",
    uploadedJudgments: "Uploaded Judgments",
    loadingJudgments: "Loading judgments...",
    noJudgments: "No judgments uploaded yet.",
    unknownType: "Unknown type",
    removeJudgmentConfirm: "Remove this judgment?",
    howItWorks: "How It Works",
    howItWorksDescription: "Build a personalized writing style in 3 steps.",
    step1Title: "Create a profile",
    step1Description: "Give it a descriptive name like \"Inheritance Law Style\" or \"Estate Division Tone\".",
    step2Title: "Upload past judgments",
    step2Description: "Upload at least 3 finalized judgments (PDF, DOCX, TXT). You can also upload a single file containing multiple judgments - the AI will split them automatically.",
    step3Title: "Run AI analysis",
    step3Description: "The AI analyzes tone, structure, reasoning depth, and terminology. Future drafts will match your style automatically.",
    tips: "Tips",
    tipsDescription: "Get the best results from style analysis.",
    tip1: "Use judgments from the same court level and case type for consistency.",
    tip2: "PDF and DOCX files work best. Ensure text is selectable, not scanned images.",
    tip3: "The more judgments you upload, the more accurate the style capture.",
  },
  el: {
    work: "Εργασία",
    system: "Σύστημα",
    dashboard: "Πίνακας ελέγχου",
    cases: "Υποθέσεις",
    knowledgeBase: "Βάση γνώσης",
    judgeStyle: "Ύφος δικαστή",
    logs: "Καταγραφές",
    pageDescription: "Μεταφορτώστε παλαιότερες αποφάσεις και δημιουργήστε εξατομικευμένο προφίλ συγγραφικού ύφους για σχέδια που παράγει η AI.",
    styleProfiles: "Προφίλ ύφους",
    styleProfilesDescription: "Δημιουργήστε και διαχειριστείτε προφίλ που αποτυπώνουν το δικαστικό συγγραφικό σας ύφος.",
    newProfile: "Νέο προφίλ",
    profileNamePlaceholder: "Όνομα προφίλ (π.χ. Ύφος κληρονομικού δικαίου)",
    create: "Δημιουργία",
    loadingProfiles: "Φόρτωση προφίλ...",
    noProfiles: "Δεν υπάρχουν ακόμη προφίλ ύφους. Δημιουργήστε ένα για να ξεκινήσετε.",
    analyzed: "Αναλύθηκε",
    pending: "Σε αναμονή",
    judgmentsUploaded: (count: number) => `${count} απόφαση${count === 1 ? "" : "εις"} μεταφορτώθηκαν`,
    updated: (date: string) => `Ενημερώθηκε ${date}`,
    deleteProfileConfirm: "Να διαγραφεί αυτό το προφίλ και όλες οι αποφάσεις του;",
    profileCreated: "Το προφίλ δημιουργήθηκε",
    profileDeleted: "Το προφίλ διαγράφηκε",
    judgmentsExtracted: (count: number) => `Εξήχθησαν και μεταφορτώθηκαν ${count} αποφάσεις`,
    judgmentUploaded: "Η απόφαση μεταφορτώθηκε",
    judgmentRemoved: "Η απόφαση αφαιρέθηκε",
    analysisStarted: "Η ανάλυση ύφους ξεκίνησε. Μπορεί να διαρκέσει λίγα λεπτά.",
    uploadFailed: "Η μεταφόρτωση απέτυχε",
    selectedProfileDescription: (count: number) => `${count} έγγραφο${count === 1 ? "" : "α"} αποφάσεων μεταφορτώθηκαν.`,
    analyzeTitleReady: "Ανάλυση των μεταφορτωμένων αποφάσεων για εξαγωγή συγγραφικού ύφους",
    analyzeTitleDisabled: "Μεταφορτώστε τουλάχιστον 3 αποφάσεις για να ενεργοποιηθεί η ανάλυση",
    analyzeStyle: "Ανάλυση ύφους",
    analysisRequirement: "Μεταφορτώστε τουλάχιστον 3 παλαιότερες αποφάσεις για να ενεργοποιηθεί η ανάλυση ύφους AI. Μπορείτε να μεταφορτώσετε ένα αρχείο με πολλές αποφάσεις και να χρησιμοποιήσετε τον αυτόματο διαχωρισμό.",
    extractedStyleProfile: "Εξαγμένο προφίλ ύφους",
    uploadJudgment: "Μεταφόρτωση απόφασης",
    splitAutomatically: "Το αρχείο περιέχει πολλές αποφάσεις - αυτόματος διαχωρισμός",
    titlePlaceholder: "Τίτλος / όνομα υπόθεσης",
    caseTypePlaceholder: "Τύπος υπόθεσης (προαιρετικό)",
    jurisdictionPlaceholder: "Δικαιοδοσία (προαιρετικό)",
    upload: "Μεταφόρτωση",
    selectedFile: "Επιλεγμένο",
    uploadedJudgments: "Μεταφορτωμένες αποφάσεις",
    loadingJudgments: "Φόρτωση αποφάσεων...",
    noJudgments: "Δεν έχουν μεταφορτωθεί ακόμη αποφάσεις.",
    unknownType: "Άγνωστος τύπος",
    removeJudgmentConfirm: "Να αφαιρεθεί αυτή η απόφαση;",
    howItWorks: "Πώς λειτουργεί",
    howItWorksDescription: "Δημιουργήστε εξατομικευμένο ύφος σε 3 βήματα.",
    step1Title: "Δημιουργία προφίλ",
    step1Description: "Δώστε ένα περιγραφικό όνομα, όπως \"Ύφος κληρονομικού δικαίου\" ή \"Τόνος διανομής περιουσίας\".",
    step2Title: "Μεταφόρτωση παλαιότερων αποφάσεων",
    step2Description: "Μεταφορτώστε τουλάχιστον 3 τελικές αποφάσεις (PDF, DOCX, TXT). Μπορείτε επίσης να μεταφορτώσετε ένα αρχείο με πολλές αποφάσεις και η AI θα τις διαχωρίσει αυτόματα.",
    step3Title: "Εκτέλεση ανάλυσης AI",
    step3Description: "Η AI αναλύει τόνο, δομή, βάθος αιτιολογίας και ορολογία. Τα μελλοντικά σχέδια θα προσαρμόζονται αυτόματα στο ύφος σας.",
    tips: "Συμβουλές",
    tipsDescription: "Βελτιώστε τα αποτελέσματα της ανάλυσης ύφους.",
    tip1: "Χρησιμοποιήστε αποφάσεις από το ίδιο επίπεδο δικαστηρίου και τον ίδιο τύπο υπόθεσης για συνέπεια.",
    tip2: "Τα αρχεία PDF και DOCX λειτουργούν καλύτερα. Βεβαιωθείτε ότι το κείμενο είναι επιλέξιμο και όχι σαρωμένη εικόνα.",
    tip3: "Όσο περισσότερες αποφάσεις μεταφορτώνετε, τόσο ακριβέστερη γίνεται η αποτύπωση ύφους.",
  },
} as const;

/* ─── Main Page ─── */
export default function JudgeStylePage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const copy = repairMojibakeObject(copyByLocale[locale]);
  const utils = trpc.useUtils();

  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCaseType, setUploadCaseType] = useState("");
  const [uploadJurisdiction, setUploadJurisdiction] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const profilesQuery = trpc.judgeAi.judgeStyle.listProfiles.useQuery(undefined, {
    enabled: Boolean(user),
  });

  const judgmentsQuery = trpc.judgeAi.judgeStyle.listJudgments.useQuery(
    { profileId: selectedProfileId ?? 0 },
    { enabled: selectedProfileId !== null }
  );

  const createProfileMutation = trpc.judgeAi.judgeStyle.createProfile.useMutation({
    onSuccess: () => {
      toast.success(copy.profileCreated);
      setIsCreatingProfile(false);
      setNewProfileName("");
      utils.judgeAi.judgeStyle.listProfiles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProfileMutation = trpc.judgeAi.judgeStyle.deleteProfile.useMutation({
    onSuccess: () => {
      toast.success(copy.profileDeleted);
      setSelectedProfileId(null);
      utils.judgeAi.judgeStyle.listProfiles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadJudgmentMutation = trpc.judgeAi.judgeStyle.uploadJudgment.useMutation({
    onSuccess: (data) => {
      toast.success(data.count > 1 ? copy.judgmentsExtracted(data.count) : copy.judgmentUploaded);
      setUploadFile(null);
      setUploadTitle("");
      setUploadCaseType("");
      setUploadJurisdiction("");
      setSplitMode(false);
      setIsUploading(false);
      utils.judgeAi.judgeStyle.listProfiles.invalidate();
      if (selectedProfileId) {
        utils.judgeAi.judgeStyle.listJudgments.invalidate({ profileId: selectedProfileId });
      }
    },
    onError: (err) => {
      toast.error(err.message);
      setIsUploading(false);
    },
  });

  const deleteJudgmentMutation = trpc.judgeAi.judgeStyle.deleteJudgment.useMutation({
    onSuccess: () => {
      toast.success(copy.judgmentRemoved);
      utils.judgeAi.judgeStyle.listProfiles.invalidate();
      if (selectedProfileId) {
        utils.judgeAi.judgeStyle.listJudgments.invalidate({ profileId: selectedProfileId });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const generateProfileMutation = trpc.judgeAi.judgeStyle.generateProfile.useMutation({
    onSuccess: () => {
      toast.success(copy.analysisStarted);
      utils.judgeAi.judgeStyle.listProfiles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const profiles = profilesQuery.data ?? [];
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );
  const judgments = judgmentsQuery.data ?? [];

  const navGroups = [
    {
      id: "work",
      label: copy.work,
      items: [
        { icon: Home, label: copy.dashboard, path: "/" },
        { icon: Scale, label: copy.cases, path: "/cases" },
        { icon: BookOpen, label: copy.knowledgeBase, path: "/knowledge" },
        { icon: PenTool, label: copy.judgeStyle, path: "/judge-style" },
      ],
    },
    {
      id: "system",
      label: copy.system,
      items: [
        { icon: FileText, label: copy.logs, path: "/logs" },
      ],
    },
  ];

  const handleUpload = async () => {
    if (!uploadFile || !selectedProfileId || (!splitMode && !uploadTitle.trim())) return;
    setIsUploading(true);
    try {
      const base64 = await fileToBase64(uploadFile);
      uploadJudgmentMutation.mutate({
        profileId: selectedProfileId,
        title: uploadTitle.trim() || uploadFile.name,
        fileName: uploadFile.name,
        mimeType: uploadFile.type || "application/octet-stream",
        base64Content: base64,
        caseType: uploadCaseType.trim() || null,
        jurisdictionCode: uploadJurisdiction.trim() || null,
        judgmentDate: null,
        tags: null,
        splitMode,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.uploadFailed);
      setIsUploading(false);
    }
  };

  const canAnalyze = selectedProfile && (selectedProfile.judgmentCount ?? 0) >= 3;

  return (
    <DashboardLayout
      title={copy.judgeStyle}
      description={copy.pageDescription}
      breadcrumbs={[{ label: copy.work }, { label: copy.judgeStyle }]}
      navGroups={navGroups}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ─── Left: Profiles list ─── */}
        <div className="space-y-6">
          <ShellCard
            title={copy.styleProfiles}
            description={copy.styleProfilesDescription}
            actions={
              <Button
                onClick={() => setIsCreatingProfile(true)}
                disabled={isCreatingProfile}
                className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                <Plus className="mr-2 h-4 w-4" />
                {copy.newProfile}
              </Button>
            }
          >
            {isCreatingProfile && (
              <div className="mb-4 flex gap-2">
                <Input
                  placeholder={copy.profileNamePlaceholder}
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="rounded-xl"
                />
                <Button
                  onClick={() => {
                    if (newProfileName.trim()) {
                      createProfileMutation.mutate({ name: newProfileName.trim() });
                    }
                  }}
                  disabled={createProfileMutation.isPending || !newProfileName.trim()}
                  className="rounded-xl"
                >
                  {createProfileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    copy.create
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreatingProfile(false);
                    setNewProfileName("");
                  }}
                  className="rounded-xl"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {profilesQuery.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.loadingProfiles}
              </div>
            ) : profiles.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-500">
                {copy.noProfiles}
              </p>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => {
                  const isSelected = profile.id === selectedProfileId;
                  const hasProfile = Boolean(profile.profileJson);
                  return (
                    <div
                      key={profile.id}
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={`cursor-pointer rounded-[1.25rem] border p-4 transition ${
                        isSelected
                          ? "border-stone-400 bg-stone-100 dark:border-stone-500 dark:bg-stone-800/60"
                          : "border-stone-200 bg-stone-50 hover:bg-stone-100/80 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:hover:bg-stone-800/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                              {profile.name}
                            </p>
                            <StatusPill variant={hasProfile ? "success" : "default"}>
                              {hasProfile ? copy.analyzed : copy.pending}
                            </StatusPill>
                          </div>
                          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-300">
                            {copy.judgmentsUploaded(profile.judgmentCount ?? 0)}
                            {profile.updatedAt
                              ? ` · ${copy.updated(new Date(profile.updatedAt).toLocaleDateString())}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0 text-stone-400 hover:text-rose-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(copy.deleteProfileConfirm)) {
                              deleteProfileMutation.mutate({ profileId: profile.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ShellCard>

          {/* ─── Profile detail / judgments ─── */}
          {selectedProfile && (
            <ShellCard
              title={selectedProfile.name}
              description={copy.selectedProfileDescription(selectedProfile.judgmentCount ?? 0)}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={!canAnalyze || generateProfileMutation.isPending}
                    onClick={() =>
                      generateProfileMutation.mutate({ profileId: selectedProfile.id })
                    }
                    title={
                      canAnalyze
                        ? copy.analyzeTitleReady
                        : copy.analyzeTitleDisabled
                    }
                  >
                    {generateProfileMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="mr-2 h-4 w-4" />
                    )}
                    {copy.analyzeStyle}
                  </Button>
                </div>
              }
            >
              {!canAnalyze && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  {copy.analysisRequirement}
                </div>
              )}

              {/* Profile analysis preview */}
              {selectedProfile.profileJson && typeof selectedProfile.profileJson === "object" && (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    <Brain className="h-4 w-4" />
                    {copy.extractedStyleProfile}
                  </h4>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-white/70 p-3 text-xs leading-5 text-stone-700 dark:bg-stone-900/60 dark:text-stone-200">
                    {JSON.stringify(selectedProfile.profileJson, null, 2)}
                  </pre>
                </div>
              )}

              {/* Upload new judgment */}
              <div className="mb-6 rounded-[1.25rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(244,239,230,0.9))] p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                <h4 className="mb-3 text-sm font-semibold text-stone-800 dark:text-stone-100">
                  {copy.uploadJudgment}
                </h4>
                <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
                  <input
                    type="checkbox"
                    checked={splitMode}
                    onChange={(e) => setSplitMode(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 accent-stone-900 dark:accent-stone-100"
                  />
                  {copy.splitAutomatically}
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder={copy.titlePlaceholder}
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="rounded-xl"
                    disabled={splitMode}
                  />
                  <Input
                    placeholder={copy.caseTypePlaceholder}
                    value={uploadCaseType}
                    onChange={(e) => setUploadCaseType(e.target.value)}
                    className="rounded-xl"
                  />
                  <Input
                    placeholder={copy.jurisdictionPlaceholder}
                    value={uploadJurisdiction}
                    onChange={(e) => setUploadJurisdiction(e.target.value)}
                    className="rounded-xl"
                  />
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md,.html"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-stone-700 file:mr-4 file:rounded-xl file:border-0 file:bg-[linear-gradient(135deg,#1f2538_0%,#30374c_100%)] file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-stone-50 dark:text-stone-200 dark:file:bg-[linear-gradient(135deg,#f4efe2_0%,#dfd4bc_100%)] dark:file:text-stone-900"
                    />
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={
                        isUploading || !uploadFile || (!splitMode && !uploadTitle.trim())
                      }
                      onClick={handleUpload}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-1 h-4 w-4" />
                      )}
                      {copy.upload}
                    </Button>
                  </div>
                </div>
                {uploadFile && (
                  <p className="mt-2 text-xs text-stone-500">
                    {copy.selectedFile}: {uploadFile.name} ({Math.round(uploadFile.size / 1024)} KB)
                  </p>
                )}
              </div>

              {/* Judgments list */}
              <h4 className="mb-3 text-sm font-semibold text-stone-800 dark:text-stone-100">
                {copy.uploadedJudgments}
              </h4>
              {judgmentsQuery.isLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-stone-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.loadingJudgments}
                </div>
              ) : judgments.length === 0 ? (
                <p className="py-4 text-center text-sm text-stone-500">
                  {copy.noJudgments}
                </p>
              ) : (
                <div className="space-y-2">
                  {judgments.map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700/80 dark:bg-stone-900/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                          {j.title}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-300">
                          {j.mimeType} · {j.caseType || copy.unknownType}
                          {j.jurisdictionCode ? ` · ${j.jurisdictionCode}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0 text-stone-400 hover:text-rose-600"
                        onClick={() => {
                          if (confirm(copy.removeJudgmentConfirm)) {
                            deleteJudgmentMutation.mutate({ judgmentId: j.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ShellCard>
          )}
        </div>

        {/* ─── Right: Info panel ─── */}
        <div className="space-y-6">
          <ShellCard title={copy.howItWorks} description={copy.howItWorksDescription}>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-stone-50 dark:bg-stone-100 dark:text-stone-900">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {copy.step1Title}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-300">
                    {copy.step1Description}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-stone-50 dark:bg-stone-100 dark:text-stone-900">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {copy.step2Title}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-300">
                    {copy.step2Description}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-stone-50 dark:bg-stone-100 dark:text-stone-900">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {copy.step3Title}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-300">
                    {copy.step3Description}
                  </p>
                </div>
              </div>
            </div>
          </ShellCard>

          <ShellCard title={copy.tips} description={copy.tipsDescription}>
            <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-200">
              <li className="flex gap-2">
                <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                {copy.tip1}
              </li>
              <li className="flex gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                {copy.tip2}
              </li>
              <li className="flex gap-2">
                <Brain className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                {copy.tip3}
              </li>
            </ul>
          </ShellCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
