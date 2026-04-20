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
  SelectField,
  ShellCard,
  TextAreaField,
  WorkspaceFact,
} from "./home/components";
import type { CaseReviewResult, ReviewSnapshot } from "./home/reviewUtils";

const localizedCopy = {
  en: {
    nav: {
      overview: "Overview",
      cases: "Cases",
      knowledge: "Knowledge Base",
      help: "Help",
      admin: "Administration",
      logs: "Logs",
      judgeStyle: "Judge Style",
    },
    shell: {
      knowledgeBaseAction: "Knowledge base",
      openCasesAction: "Open cases",
      eyebrow: "Authoritative drafting environment",
      overviewTitle: "Judicial decision drafting platform",
      overviewDescription:
        "An elegant, role-aware judicial workspace for secure case handling, legal knowledge retrieval, and AI-assisted decision drafting.",
      casesTitle: "Case management",
      casesDescription:
        "Create, classify, and review judicial matters before drafting and approval.",
      knowledgeTitle: "Legal knowledge repository",
      knowledgeDescription:
        "Upload and maintain searchable statutes, regulations, precedents, and reusable references.",
      helpTitle: "Help and user guidance",
      helpDescription:
        "Learn how to upload materials, manage matters, generate drafts, review outputs, and use every major function with practical examples.",
      adminTitle: "Administrative control centre",
      adminDescription:
        "Configure AI providers, roles, and platform governance from a protected administrative space.",
      workspaceDescription:
        "Review evidence, search legal materials, refine the structured draft, and preserve an auditable activity trail.",
    },
    overview: {
      activeCases: "Active cases",
      activeCasesDetail: "Securely managed matters available to the judicial workspace.",
      knowledgeItems: "Knowledge items",
      knowledgeItemsDetail: "Persistent legislation, precedents, and reference materials.",
      draftReady: "Draft-ready matters",
      draftReadyDetail: "Cases currently in review or approved for decision output.",
      indexedDocuments: "Indexed documents",
      indexedDocumentsDetail: "Uploaded materials contributing to search and drafting context.",
      intakeTitle: "Submission intake dashboard",
      intakeDescription:
        "Prioritize newly received matters, surface operational deadline risks, and move quickly from intake to judicial review.",
      priorityNow: "Priority matters",
      priorityNowDetail: "Cases requiring immediate triage because they are new, stalled, or close to a review window.",
      dueSoon: "Due soon",
      dueSoonDetail: "Matters approaching the operational deadline window for document review, drafting, or judicial review.",
      overdue: "Overdue",
      overdueDetail: "Cases whose current workflow stage has exceeded the recommended operational handling window.",
      priorityQueueTitle: "Prioritized intake queue",
      priorityQueueDescription:
        "Queue ranking uses case stage and time since last update so clerks and judges can address the most urgent matters first.",
      noIntakeQueue: "No active matters are waiting in the intake queue.",
      deadlineOnTrack: "On track",
      intakePriorityCritical: "Critical",
      intakePriorityHigh: "High",
      intakePriorityNormal: "Normal",
      intakeCreatedSummary: "Initial intake is still pending and the matter should be reviewed for document completeness.",
      intakeDocumentsSummary: "Document review is active and the uploaded bundle should be validated and categorized.",
      intakeDraftingSummary: "The file is ready for structured drafting and should move into the reasoning workflow.",
      intakeReviewSummary: "A judicial reviewer should assess the current draft and consistency findings soon.",
      intakeApprovedSummary: "The matter is approved and should be exported, closed, or archived according to practice.",
      focusTitle: "Judicial activity focus",
      focusDescription:
        "Move from intake to structured drafting with auditable steps and a stable knowledge foundation.",
      curateLawTitle: "1. Curate the law",
      curateLawDescription:
        "Upload statutes, regulations, precedents, and reusable guidance into the permanent knowledge base.",
      assembleCaseTitle: "2. Assemble the case",
      assembleCaseDescription:
        "Create the matter, add pleadings and evidence, and track document processing and duplicate detection.",
      refineDraftTitle: "3. Refine the draft",
      refineDraftDescription:
        "Generate five structured sections, review every paragraph, approve the result, and export to DOCX.",
      recentMattersTitle: "Recent matters",
      recentMattersDescription:
        "Open a matter to upload case documents, run search, and manage structured draft review.",
      updatedPrefix: "Updated",
      noCases:
        "No cases have been created yet. Use the case management area to register the first judicial matter.",
      searchPlaceholder: "Search by title, number, court, or type…",
      filterAll: "All priorities",
      filterCritical: "Critical only",
      filterHigh: "High + critical",
      filterNormal: "Normal only",
      clearFilters: "Clear filters",
      exportCsv: "Export CSV",
      advanceStage: "Advance",
      customizeTitle: "Customize",
      customizeLabel: "Show sections",
      sectionFocus: "Focus pipeline",
      sectionIntake: "Intake dashboard",
      sectionRecent: "Recent matters",
      sectionKnowledge: "Knowledge snapshot",
      sectionGovernance: "Governance",
      sectionThroughput: "Throughput analytics",
      throughputTitle: "Throughput analytics",
      throughputDescription: "Closed-decision output and queue health over rolling windows.",
      throughputApproved7: "Approved last 7 days",
      throughputApproved30: "Approved last 30 days",
      throughputAvgAge: "Avg. age of open matters (days)",
      throughputOpenCount: "Open matters",
      throughputApproved7Detail: "Decisions finalised in the last rolling week.",
      throughputApproved30Detail: "Decisions finalised in the last rolling month.",
      throughputAvgAgeDetail: "Mean age of matters that are still being worked on.",
      throughputOpenCountDetail: "Active matters not yet approved or archived.",
      noMattersMatchingFilter: "No matters match the current search or filters.",
      knowledgeSnapshotTitle: "Knowledge base snapshot",
      knowledgeSnapshotDescription:
        "A persistent library of applicable law and reusable reference documents.",
      noKnowledge: "No legal reference material has been uploaded yet.",
      governanceTitle: "Governance and access",
      governanceDescription:
        "Role separation is enforced through protected procedures and UI-aware navigation.",
      currentRole: "Current role",
      providerConfiguration: "Provider configuration",
      providerDescription:
        "Administrators can configure the AI endpoint, model, and credential without code changes.",
      openWorkspace: "Open workspace",
      noMatters: "No matters available yet.",
      guest: "guest",
    },
  },
  el: {
    nav: {
      overview: "Επισκόπηση",
      cases: "Υποθέσεις",
      knowledge: "Βάση Γνώσης",
      help: "Βοήθεια",
      admin: "Διαχείριση",
      logs: "Αρχεία καταγραφής",
      judgeStyle: "Στυλ Δικαστή",
    },
    shell: {
      knowledgeBaseAction: "Βάση γνώσης",
      openCasesAction: "Άνοιγμα υποθέσεων",
      eyebrow: "Αυθεντικό περιβάλλον σύνταξης",
      overviewTitle: "Πλατφόρμα σύνταξης δικαστικών αποφάσεων",
      overviewDescription:
        "Ένα κομψό, ασφαλές και προσανατολισμένο στους ρόλους δικαστικό περιβάλλον για διαχείριση υποθέσεων, ανάκτηση νομικής γνώσης και σύνταξη αποφάσεων με υποστήριξη AI.",
      casesTitle: "Διαχείριση υποθέσεων",
      casesDescription:
        "Δημιουργήστε, ταξινομήστε και παρακολουθήστε δικαστικές υποθέσεις πριν από τη σύνταξη και την έγκριση.",
      knowledgeTitle: "Αποθετήριο νομικής γνώσης",
      knowledgeDescription:
        "Ανεβάστε και διατηρήστε αναζητήσιμους νόμους, κανονισμούς, νομολογία και χρήσιμες αναφορές.",
      helpTitle: "Βοήθεια και καθοδήγηση χρήστη",
      helpDescription:
        "Μάθετε πώς να μεταφορτώνετε υλικό, να διαχειρίζεστε υποθέσεις, να παράγετε σχέδια, να ελέγχετε αποτελέσματα και να χρησιμοποιείτε κάθε βασική λειτουργία με πρακτικά παραδείγματα.",
      adminTitle: "Κέντρο διοικητικού ελέγχου",
      adminDescription:
        "Ρυθμίστε παρόχους AI, ρόλους και κανόνες διακυβέρνησης από προστατευμένο διοικητικό χώρο.",
      workspaceDescription:
        "Εξετάστε αποδεικτικά στοιχεία, αναζητήστε νομικό υλικό, βελτιώστε το δομημένο σχέδιο και διατηρήστε πλήρες ίχνος ενεργειών.",
    },
    overview: {
      activeCases: "Ενεργές υποθέσεις",
      activeCasesDetail: "Ασφαλώς διαχειριζόμενες υποθέσεις διαθέσιμες στο δικαστικό περιβάλλον.",
      knowledgeItems: "Στοιχεία γνώσης",
      knowledgeItemsDetail: "Μόνιμη νομοθεσία, νομολογία και έγγραφα αναφοράς.",
      draftReady: "Υποθέσεις έτοιμες για σχέδιο",
      draftReadyDetail: "Υποθέσεις που βρίσκονται σε έλεγχο ή έχουν εγκριθεί για τελική απόφαση.",
      indexedDocuments: "Ευρετηριασμένα έγγραφα",
      indexedDocumentsDetail: "Ανεβασμένο υλικό που τροφοδοτεί την αναζήτηση και το πλαίσιο σύνταξης.",
      intakeTitle: "Πίνακας καταχώρισης υποβολών",
      intakeDescription:
        "Ιεραρχήστε τις νέες υποθέσεις, εντοπίστε έγκαιρα λειτουργικούς κινδύνους προθεσμιών και μεταφέρετε γρήγορα την εργασία από την καταχώριση στον δικαστικό έλεγχο.",
      priorityNow: "Υποθέσεις προτεραιότητας",
      priorityNowDetail: "Υποθέσεις που χρειάζονται άμεση διαλογή επειδή είναι νέες, έχουν καθυστερήσει ή πλησιάζουν παράθυρο ελέγχου.",
      dueSoon: "Λήγουν σύντομα",
      dueSoonDetail: "Υποθέσεις που πλησιάζουν το λειτουργικό παράθυρο προθεσμίας για έλεγχο εγγράφων, σύνταξη ή δικαστικό έλεγχο.",
      overdue: "Εκπρόθεσμες",
      overdueDetail: "Υποθέσεις των οποίων το τρέχον στάδιο έχει ξεπεράσει το προτεινόμενο λειτουργικό παράθυρο χειρισμού.",
      priorityQueueTitle: "Ουρά προτεραιοποίησης",
      priorityQueueDescription:
        "Η κατάταξη της ουράς βασίζεται στο στάδιο της υπόθεσης και στον χρόνο από την τελευταία ενημέρωση, ώστε γραμματεία και δικαστές να αντιμετωπίζουν πρώτα τα πιο επείγοντα θέματα.",
      noIntakeQueue: "Δεν υπάρχουν ενεργές υποθέσεις σε αναμονή στην ουρά καταχώρισης.",
      deadlineOnTrack: "Εντός προθεσμίας",
      intakePriorityCritical: "Κρίσιμη",
      intakePriorityHigh: "Υψηλή",
      intakePriorityNormal: "Κανονική",
      intakeCreatedSummary: "Η αρχική καταχώριση εκκρεμεί και η υπόθεση πρέπει να ελεγχθεί ως προς την πληρότητα των εγγράφων.",
      intakeDocumentsSummary: "Ο έλεγχος εγγράφων είναι ενεργός και το υλικό πρέπει να επικυρωθεί και να κατηγοριοποιηθεί.",
      intakeDraftingSummary: "Ο φάκελος είναι έτοιμος για δομημένη σύνταξη και πρέπει να περάσει στο στάδιο αιτιολόγησης.",
      intakeReviewSummary: "Δικαστικός ελεγκτής πρέπει σύντομα να αξιολογήσει το τρέχον σχέδιο και τα ευρήματα συνέπειας.",
      intakeApprovedSummary: "Η υπόθεση έχει εγκριθεί και πρέπει να εξαχθεί, να κλείσει ή να αρχειοθετηθεί σύμφωνα με την πρακτική.",
      focusTitle: "Εστίαση δικαστικής δραστηριότητας",
      focusDescription:
        "Μεταβείτε από την καταχώριση στη δομημένη σύνταξη με ελέγξιμα βήματα και σταθερή νομική βάση γνώσης.",
      curateLawTitle: "1. Οργανώστε το δίκαιο",
      curateLawDescription:
        "Ανεβάστε νόμους, κανονισμούς, νομολογία και επαναχρησιμοποιήσιμες οδηγίες στη μόνιμη βάση γνώσης.",
      assembleCaseTitle: "2. Συγκροτήστε την υπόθεση",
      assembleCaseDescription:
        "Δημιουργήστε την υπόθεση, προσθέστε δικόγραφα και αποδεικτικά στοιχεία, και παρακολουθήστε επεξεργασία και διπλότυπα.",
      refineDraftTitle: "3. Βελτιώστε το σχέδιο",
      refineDraftDescription:
        "Παράγετε πέντε δομημένες ενότητες, ελέγξτε κάθε παράγραφο, εγκρίνετε το αποτέλεσμα και εξάγετε σε DOCX.",
      recentMattersTitle: "Πρόσφατες υποθέσεις",
      recentMattersDescription:
        "Ανοίξτε μια υπόθεση για μεταφόρτωση εγγράφων, αναζήτηση πηγών και διαχείριση του δομημένου σχεδίου.",
      updatedPrefix: "Ενημερώθηκε",
      noCases:
        "Δεν έχουν δημιουργηθεί ακόμη υποθέσεις. Χρησιμοποιήστε τη διαχείριση υποθέσεων για να καταχωρίσετε την πρώτη υπόθεση.",
      searchPlaceholder: "Αναζήτηση τίτλου, αριθμού, δικαστηρίου ή τύπου…",
      filterAll: "Όλες οι προτεραιότητες",
      filterCritical: "Μόνο κρίσιμες",
      filterHigh: "Υψηλή + κρίσιμη",
      filterNormal: "Μόνο κανονικές",
      clearFilters: "Καθαρισμός φίλτρων",
      exportCsv: "Εξαγωγή CSV",
      advanceStage: "Προώθηση",
      customizeTitle: "Προσαρμογή",
      customizeLabel: "Εμφάνιση ενοτήτων",
      sectionFocus: "Ροή εργασιών",
      sectionIntake: "Πίνακας καταχώρισης",
      sectionRecent: "Πρόσφατες υποθέσεις",
      sectionKnowledge: "Στιγμιότυπο γνώσης",
      sectionGovernance: "Διακυβέρνηση",
      sectionThroughput: "Αναλυτικά ροής",
      throughputTitle: "Αναλυτικά ροής",
      throughputDescription: "Ολοκληρωμένες αποφάσεις και κατάσταση ουράς σε κυλιόμενα παράθυρα.",
      throughputApproved7: "Εγκρίσεις τελευταίων 7 ημερών",
      throughputApproved30: "Εγκρίσεις τελευταίων 30 ημερών",
      throughputAvgAge: "Μέση ηλικία ενεργών υποθέσεων (ημέρες)",
      throughputOpenCount: "Ενεργές υποθέσεις",
      throughputApproved7Detail: "Αποφάσεις που οριστικοποιήθηκαν την τελευταία εβδομάδα.",
      throughputApproved30Detail: "Αποφάσεις που οριστικοποιήθηκαν τον τελευταίο μήνα.",
      throughputAvgAgeDetail: "Μέσος όρος ηλικίας υποθέσεων που εκκρεμούν.",
      throughputOpenCountDetail: "Ενεργές υποθέσεις που δεν έχουν εγκριθεί ή αρχειοθετηθεί.",
      noMattersMatchingFilter: "Καμία υπόθεση δεν ταιριάζει στα τρέχοντα κριτήρια.",
      knowledgeSnapshotTitle: "Στιγμιότυπο βάσης γνώσης",
      knowledgeSnapshotDescription:
        "Μόνιμη βιβλιοθήκη εφαρμοστέου δικαίου και επαναχρησιμοποιήσιμων εγγράφων αναφοράς.",
      noKnowledge: "Δεν έχει ανέβει ακόμη νομικό υλικό αναφοράς.",
      governanceTitle: "Διακυβέρνηση και πρόσβαση",
      governanceDescription:
        "Ο διαχωρισμός ρόλων εφαρμόζεται μέσω προστατευμένων διαδικασιών και πλοήγησης που αναγνωρίζει τον χρήστη.",
      currentRole: "Τρέχων ρόλος",
      providerConfiguration: "Ρύθμιση παρόχου",
      providerDescription:
        "Οι διαχειριστές μπορούν να ρυθμίσουν endpoint, μοντέλο και διαπιστευτήρια AI χωρίς αλλαγές κώδικα.",
      openWorkspace: "Άνοιγμα χώρου εργασίας",
      noMatters: "Δεν υπάρχουν ακόμη διαθέσιμες υποθέσεις.",
      guest: "επισκέπτης",
    },
  },
} as const;

const localizedInterface = {
  en: {
    cases: {
      createTitle: "Create case",
      createDescription: "Register a judicial matter with the metadata required to route documents, search, and drafting workflows.",
      registryTitle: "Case registry",
      registryDescription: "Select a matter to upload documents, search sources, and drive decision drafting.",
      caseNumber: "Case number",
      jurisdictionCode: "Jurisdiction code",
      courtLevel: "Court level",
      caseType: "Case type",
      caseTitle: "Case title",
      summary: "Summary",
      languageCode: "Draft language",
      createAction: "Create case",
      noMatters: "No matters available yet.",
      editTitle: "Edit case",
      editAction: "Save changes",
      deleteAction: "Delete",
      deleteConfirmTitle: "Delete case",
      deleteConfirmBody: "This will permanently remove the case and all associated documents, drafts, and reviews. This cannot be undone.",
      deleteConfirmCancel: "Cancel",
      deleteConfirmRun: "Delete case",
    },
    knowledge: {
      uploadTitle: "Upload legal material",
      uploadDescription: "Add statutes, regulations, precedents, and reference documents to the permanent searchable legal repository.",
      titleLabel: "Title",
      documentType: "Document type",
      jurisdictionCode: "Jurisdiction code",
      courtLevel: "Court level",
      citation: "Citation",
      sourceReference: "Source reference",
      fileLabel: "Knowledge document",
      uploadAction: "Upload material",
      batchTitle: "Batch import legal repository",
      batchDescription: "Upload multiple files at once. Judge AI will inspect each file, infer the most likely legal-material category, and register duplicates automatically.",
      batchFileLabel: "Knowledge files for batch import",
      batchAction: "Run batch import",
      batchHint: "Ideal for legislation packs, precedent folders, and mixed legal references delivered as one bundle.",
      repositoryTitle: "Persistent legal repository",
      repositoryDescription: "These documents remain available across all cases and can be surfaced during drafting and search.",
      emptyRepository: "The legal repository is empty.",
      documentTypes: {
        statute: "Statute",
        regulation: "Regulation",
        precedent: "Precedent",
        reference: "Reference",
        other: "Other",
      },
    },
    workspace: {
      loading: "Loading case workspace",
      notLoadedTitle: "Case workspace",
      notLoadedDescription: "The requested matter could not be loaded.",
      notLoadedMessage: "The case may not exist or you may not have access to it.",
      generateAction: "Generate decision draft",
      generationProgress: {
        analyzing: "Analyzing case documents...",
        reviewing: "Reviewing legal principles...",
        structuring: "Structuring decision sections...",
        generating: "Generating paragraph rationales...",
        finalizing: "Finalizing draft output...",
        almostThere: "Almost there...",
        elapsed: "Elapsed",
        seconds: "s",
      },
      status: "Status",
      caseType: "Case type",
      assignedJudge: "Assigned judge",
      unassigned: "Unassigned",
      created: "Created",
      searchTitle: "Search the case record",
      searchDescription: "Surface relevant case-file and knowledge-base passages while drafting.",
      searchPlaceholder: "Search legislation, precedent, evidence, or references",
      searchHint: "Enter at least two characters to search the indexed materials for this matter.",
      uploadTitle: "Upload case material",
      uploadDescription: "Pleadings, evidence, and supporting documents are validated, hashed, indexed, and checked for duplicates during upload.",
      documentTitle: "Document title",
      documentType: "Document type",
      fileLabel: "Case document",
      uploadAction: "Upload case document",
      batchTitle: "Batch import case file",
      batchDescription: "Drop a multi-file selection into one import action. Judge AI will infer whether each file is a pleading, evidence set, supporting annex, reference, or prior decision.",
      batchFileLabel: "Case files for batch import",
      batchAction: "Import and categorize files",
      batchHint: "Use this workflow when a lawyer or clerk sends many exhibits and pleadings together.",
      documentsTitle: "Case documents",
      documentsDescription: "Document uploads retain processing and duplicate detection status, supporting a controlled evidentiary workflow.",
      emptyDocuments: "No case documents uploaded yet.",
      caseCheckTitle: "Judgment and legal consistency review",
      caseCheckDescription: "Compare the proposed judgment or current draft against the case file, applicable law, and knowledge-base material to identify contradictions, evidentiary gaps, and reasoning weaknesses.",
      caseCheckInputLabel: "Judgment text to review",
      caseCheckPlaceholder: "Paste a judgment, reasoning section, or leave this field empty to review the latest generated draft.",
      caseCheckHint: "If you leave the text empty, Judge AI will analyze the latest draft already stored for this matter.",
      caseCheckQuickActions: "Quick actions",
      useLatestDraft: "Use latest draft",
      useReasoningOnly: "Use reasoning section",
      clearReviewText: "Clear text",
      reviewTemplateTitle: "Review template",
      reviewTemplateDescription: "Choose the review lens that best matches the matter. Templates change the legal-consistency checklist used by Judge AI.",
      reviewTemplateLabel: "Template type",
      reviewTemplateFocusLabel: "Additional review focus",
      reviewTemplateFocusPlaceholder: "Optional: add special points to test, such as proportionality, witness credibility, damages, or procedural fairness.",
      caseCheckAction: "Run legal consistency review",
      caseCheckSummary: "Review summary",
      caseCheckFindings: "Key findings",
      caseCheckIssues: "Core issues and legal questions",
      caseCheckMissingEvidence: "Potential evidentiary gaps",
      caseCheckMissingLaw: "Potential legal gaps",
      caseCheckFeedback: "Feedback for the judge",
      caseCheckCitations: "Citation and authority verification",
      caseCheckCredibility: "Evidence credibility signals",
      caseCheckContradictions: "Contradictions and conflicts",
      caseCheckPrecedent: "Precedent support and distinguishability",
      caseCheckRatio: "Ratio decidendi",
      caseCheckObiter: "Obiter dicta",
      caseCheckJurisdiction: "Jurisdiction and admissibility",
      caseCheckProportionality: "Remedy and sanction proportionality",
      caseCheckDecisionQuality: "Decision quality score",
      caseCheckPreSignature: "Final pre-signature review",
      caseCheckBlockers: "Signature blockers",
      caseCheckRecommendedActions: "Recommended actions before signature",
      qualityScoreLabel: "Quality score",
      readyForSignature: "Ready for signature",
      notReadyForSignature: "Not ready for signature",
      caseCheckNoItems: "No specific items were identified in this section.",
      caseCheckEmpty: "No review has been generated yet. Run the checker to inspect whether the proposed judgment is supported by law and evidence.",
      assessmentLabels: {
        supported: "Supported",
        partially_supported: "Partially supported",
        contradicted: "Contradicted",
        insufficient_basis: "Insufficient basis",
      },
      reviewTemplateOptions: {
        inheritance: "Greek inheritance law",
      },
      draftTitle: "Structured decision draft",
      draftDescription: "The AI-assisted draft is organized into the required five sections and exposes paragraph-level rationale, confidence, and inline source annotations.",
      approveDraft: "Approve draft",
      exportDocx: "Export DOCX",
      reviewBeforeApproval: "Run the legal consistency review before approval.",
      resolveReviewBlockers: "Resolve the pre-signature review blockers before approval.",
      approvalGateHint: "Approval now depends on the quality review confirming that the draft is ready for signature.",
      autoApproveLabel: "Auto-approve all drafts",
      autoApproveDescription: "Bypass quality thresholds and allow immediate approval and DOCX export.",
      version: "Version",
      markReviewed: "Mark reviewed",
      approveSection: "Approve section",
      paragraph: "Paragraph",
      confidence: "Confidence",
      rationale: "AI rationale",
      reviewStatus: "Review status",
      saveParagraph: "Save paragraph",
      annotationsTitle: "Evidence and law annotations",
      traceTitle: "Evidence-to-reasoning trace",
      reasoningTraceTitle: "Reasoning basis",
      evidenceTraceTitle: "Supporting evidence and law",
      rationaleMissing: "No reasoning note has been recorded for this paragraph yet.",
      traceEmpty: "No supporting evidence or legal annotation is linked to this paragraph yet.",
      emptyDraft: "No draft exists for this matter yet. Upload the relevant material, then generate the structured decision draft.",
      timelineTitle: "Case timeline",
      timelineDescription: "All uploads, generation events, edits, approvals, and exports are tracked for auditability.",
      emptyTimeline: "No activity has been recorded yet for this case.",
      documentTypes: {
        pleading: "Pleading",
        evidence: "Evidence",
        supporting: "Supporting",
        reference: "Reference",
        decision: "Decision",
        other: "Other",
      },
      reviewOptions: {
        draft: "Draft",
        reviewed: "Reviewed",
        approved: "Approved",
      },
    },
    admin: {
      restrictedTitle: "Administration",
      restrictedDescription: "This area is restricted to administrators.",
      restrictedMessage: "You are signed in as a judge. Administrative controls for users and AI provider configuration are hidden and protected.",
      providerTitle: "AI provider configuration",
      providerDescription: "Configure the model provider, endpoint, and credentials without changing code.",
      configurationName: "Configuration name",
      providerType: "Provider type",
      modelDeployment: "Model / deployment",
      endpoint: "Endpoint",
      apiKey: "API key",
      azureApiVersion: "Azure API version",
      draftTemperature: "Draft temperature",
      maxTokens: "Max tokens per response",
      systemPrompt: "Default system prompt",
      saveProvider: "Save provider",
      testProvider: "Test connectivity",
      testProviderSuccess: "Connection successful",
      testProviderFail: "Connection failed",
      configuredProvidersTitle: "Configured providers",
      configuredProvidersDescription: "One provider can be marked active for case drafting operations.",
      active: "active",
      makeActive: "Make active",
      editProvider: "Edit",
      noProviders: "No AI providers configured yet.",
      userManagementTitle: "User and role management",
      userManagementDescription: "Judge and admin distinctions are visible in the interface and enforced through protected routes and procedures.",
      unnamedUser: "Unnamed user",
      toggleRole: "Toggle role",
      suspend: "Suspend",
      reactivate: "Reactivate",
      noUsers: "No user accounts available.",
      providerOptions: {
        openai: "OpenAI",
        azure_openai: "Azure OpenAI",
        custom_openai_compatible: "Custom compatible",
        alibaba_cloud: "Alibaba Cloud (Singapore)",
        kimi: "Kimi (Moonshot)",
        deepseek: "DeepSeek",
      },
      dataTabLabel: "Data",
      dataTitle: "Data management",
      dataDescription: "Destructive operations. Used when decommissioning a workspace, rotating provider credentials, or preparing a fresh demo environment.",
      resetFactoryTitle: "Factory reset",
      resetFactoryDescription: "Wipes every case, draft, document, knowledge entry, provider configuration, and user preference. Sessions for other users are revoked. Seeded providers reappear on next start.",
      resetFactoryAction: "Run factory reset",
      resetProgramTitle: "Erase program data only",
      resetProgramDescription: "Clears cases, drafts, documents, knowledge base, and audit logs. Provider settings, thresholds, and preferences remain intact.",
      resetProgramAction: "Erase program data",
      resetSettingsTitle: "Clear settings only",
      resetSettingsDescription: "Removes configured AI providers, review thresholds, and user auto-approve flags. Cases and knowledge base are untouched.",
      resetSettingsAction: "Clear settings",
      resetConfirmTitle: "Confirm destructive action",
      resetConfirmBody: "This cannot be undone. Type RESET below to confirm.",
      resetConfirmType: "Type RESET to confirm",
      resetConfirmCancel: "Cancel",
      resetConfirmRun: "Run reset",
    },
    shortcuts: {
      helpTitle: "Keyboard shortcuts",
      helpDescription: "Quick navigation without leaving the keyboard.",
      entries: [
        ["g o", "Go to Overview"],
        ["g c", "Go to Cases"],
        ["g k", "Go to Knowledge base"],
        ["g a", "Go to Administration (admin only)"],
        ["n", "Start a new case"],
        ["?", "Open this shortcut list"],
        ["Esc", "Close dialogs"],
      ] as Array<readonly [string, string]>,
      close: "Close",
    },
    common: {
      selectedFile: "Selected file",
      selectedFiles: "Selected files",
    },
  },
  el: {
    cases: {
      createTitle: "Δημιουργία υπόθεσης",
      createDescription: "Καταχωρίστε μια δικαστική υπόθεση με τα μεταδεδομένα που απαιτούνται για έγγραφα, αναζήτηση και ροές σύνταξης.",
      registryTitle: "Μητρώο υποθέσεων",
      registryDescription: "Επιλέξτε μια υπόθεση για μεταφόρτωση εγγράφων, αναζήτηση πηγών και σύνταξη απόφασης.",
      caseNumber: "Αριθμός υπόθεσης",
      jurisdictionCode: "Κωδικός δικαιοδοσίας",
      courtLevel: "Βαθμός δικαστηρίου",
      caseType: "Τύπος υπόθεσης",
      caseTitle: "Τίτλος υπόθεσης",
      summary: "Σύνοψη",
      languageCode: "Γλώσσα σύνταξης",
      createAction: "Δημιουργία υπόθεσης",
      noMatters: "Δεν υπάρχουν ακόμη διαθέσιμες υποθέσεις.",
      editTitle: "Επεξεργασία υπόθεσης",
      editAction: "Αποθήκευση αλλαγών",
      deleteAction: "Διαγραφή",
      deleteConfirmTitle: "Διαγραφή υπόθεσης",
      deleteConfirmBody: "Αυτό θα αφαιρέσει οριστικά την υπόθεση και όλα τα συσχετιζόμενα έγγραφα, σχέδια και ελέγχους. Δεν μπορεί να αναιρεθεί.",
      deleteConfirmCancel: "Ακύρωση",
      deleteConfirmRun: "Διαγραφή υπόθεσης",
    },
    knowledge: {
      uploadTitle: "Μεταφόρτωση νομικού υλικού",
      uploadDescription: "Προσθέστε νόμους, κανονισμούς, νομολογία και έγγραφα αναφοράς στο μόνιμο αναζητήσιμο νομικό αποθετήριο.",
      titleLabel: "Τίτλος",
      documentType: "Τύπος εγγράφου",
      jurisdictionCode: "Κωδικός δικαιοδοσίας",
      courtLevel: "Βαθμός δικαστηρίου",
      citation: "Παραπομπή",
      sourceReference: "Αναφορά πηγής",
      fileLabel: "Έγγραφο γνώσης",
      uploadAction: "Μεταφόρτωση υλικού",
      batchTitle: "Μαζική εισαγωγή νομικού αποθετηρίου",
      batchDescription: "Μεταφορτώστε πολλά αρχεία μαζί. Το Judge AI θα εξετάσει κάθε αρχείο, θα εκτιμήσει την πιθανότερη κατηγορία νομικού υλικού και θα καταγράψει αυτόματα τα διπλότυπα.",
      batchFileLabel: "Αρχεία γνώσης για μαζική εισαγωγή",
      batchAction: "Εκτέλεση μαζικής εισαγωγής",
      batchHint: "Ιδανικό για πακέτα νομοθεσίας, φακέλους νομολογίας και μικτά νομικά αρχεία που παραδίδονται μαζί.",
      repositoryTitle: "Μόνιμο νομικό αποθετήριο",
      repositoryDescription: "Αυτά τα έγγραφα παραμένουν διαθέσιμα σε όλες τις υποθέσεις και μπορούν να εμφανίζονται κατά τη σύνταξη και την αναζήτηση.",
      emptyRepository: "Το νομικό αποθετήριο είναι κενό.",
      documentTypes: {
        statute: "Νόμος",
        regulation: "Κανονισμός",
        precedent: "Νομολογία",
        reference: "Αναφορά",
        other: "Άλλο",
      },
    },
    workspace: {
      loading: "Φόρτωση χώρου υπόθεσης",
      notLoadedTitle: "Χώρος υπόθεσης",
      notLoadedDescription: "Δεν ήταν δυνατή η φόρτωση της ζητούμενης υπόθεσης.",
      notLoadedMessage: "Η υπόθεση ίσως δεν υπάρχει ή δεν έχετε δικαίωμα πρόσβασης.",
      generateAction: "Παραγωγή σχεδίου απόφασης",
      generationProgress: {
        analyzing: "Ανάλυση εγγράφων υπόθεσης...",
        reviewing: "Ανασκόπηση νομικών αρχών...",
        structuring: "Δομήση τμημάτων απόφασης...",
        generating: "Δημιουργία αιτιολογιών παραγράφων...",
        finalizing: "Οριστικοποίηση σχεδίου...",
        almostThere: "Σχεδόν έτοιμο...",
        elapsed: "Διάρκεια",
        seconds: "δ",
      },
      status: "Κατάσταση",
      caseType: "Τύπος υπόθεσης",
      assignedJudge: "Ανατεθειμένος δικαστής",
      unassigned: "Χωρίς ανάθεση",
      created: "Δημιουργήθηκε",
      searchTitle: "Αναζήτηση στο αρχείο της υπόθεσης",
      searchDescription: "Εντοπίστε σχετικά αποσπάσματα από τον φάκελο και τη βάση γνώσης κατά τη σύνταξη.",
      searchPlaceholder: "Αναζήτηση σε νομοθεσία, νομολογία, αποδείξεις ή αναφορές",
      searchHint: "Πληκτρολογήστε τουλάχιστον δύο χαρακτήρες για αναζήτηση στο ευρετηριασμένο υλικό της υπόθεσης.",
      uploadTitle: "Μεταφόρτωση υλικού υπόθεσης",
      uploadDescription: "Δικόγραφα, αποδεικτικά στοιχεία και υποστηρικτικά έγγραφα επικυρώνονται, κατακερματίζονται, ευρετηριάζονται και ελέγχονται για διπλότυπα κατά τη μεταφόρτωση.",
      documentTitle: "Τίτλος εγγράφου",
      documentType: "Τύπος εγγράφου",
      fileLabel: "Έγγραφο υπόθεσης",
      uploadAction: "Μεταφόρτωση εγγράφου υπόθεσης",
      batchTitle: "Μαζική εισαγωγή φακέλου υπόθεσης",
      batchDescription: "Ρίξτε πολλά αρχεία σε μία ενέργεια. Το Judge AI θα εκτιμήσει αν κάθε αρχείο είναι δικόγραφο, αποδεικτικό, υποστηρικτικό παράρτημα, αναφορά ή προηγούμενη απόφαση.",
      batchFileLabel: "Αρχεία υπόθεσης για μαζική εισαγωγή",
      batchAction: "Εισαγωγή και κατηγοριοποίηση αρχείων",
      batchHint: "Χρησιμοποιήστε αυτή τη ροή όταν ο δικηγόρος ή ο γραμματέας στέλνει μαζί πολλά αποδεικτικά και δικόγραφα.",
      documentsTitle: "Έγγραφα υπόθεσης",
      documentsDescription: "Οι μεταφορτώσεις εγγράφων διατηρούν κατάσταση επεξεργασίας και ελέγχου διπλοτύπων, στηρίζοντας ελεγχόμενη αποδεικτική ροή.",
      emptyDocuments: "Δεν έχουν μεταφορτωθεί ακόμη έγγραφα υπόθεσης.",
      caseCheckTitle: "Έλεγχος απόφασης και νομικής συνέπειας",
      caseCheckDescription: "Συγκρίνετε την προτεινόμενη απόφαση ή το τρέχον σχέδιο με τον φάκελο, το εφαρμοστέο δίκαιο και το υλικό της βάσης γνώσης για να εντοπίσετε αντιφάσεις, αποδεικτικά κενά και αδυναμίες αιτιολογίας.",
      caseCheckInputLabel: "Κείμενο απόφασης προς έλεγχο",
      caseCheckPlaceholder: "Επικολλήστε απόφαση ή αιτιολογία ή αφήστε το πεδίο κενό για έλεγχο του τελευταίου παραγόμενου σχεδίου.",
      caseCheckHint: "Αν αφήσετε το κείμενο κενό, το Judge AI θα αναλύσει το τελευταίο σχέδιο που είναι ήδη αποθηκευμένο για αυτή την υπόθεση.",
      caseCheckQuickActions: "Γρήγορες ενέργειες",
      useLatestDraft: "Χρήση τελευταίου σχεδίου",
      useReasoningOnly: "Χρήση ενότητας αιτιολογίας",
      clearReviewText: "Καθαρισμός κειμένου",
      reviewTemplateTitle: "Πρότυπο ελέγχου",
      reviewTemplateDescription: "Επιλέξτε το κατάλληλο πρίσμα ελέγχου για την υπόθεση. Τα πρότυπα αλλάζουν τη λίστα νομικών ελέγχων που χρησιμοποιεί το Judge AI.",
      reviewTemplateLabel: "Τύπος προτύπου",
      reviewTemplateFocusLabel: "Πρόσθετη εστίαση ελέγχου",
      reviewTemplateFocusPlaceholder: "Προαιρετικό: προσθέστε ειδικά σημεία προς έλεγχο, όπως αναλογικότητα, αξιοπιστία μαρτύρων, αποζημίωση ή δικονομική δικαιοσύνη.",
      caseCheckAction: "Εκτέλεση ελέγχου νομικής συνέπειας",
      caseCheckSummary: "Σύνοψη ελέγχου",
      caseCheckFindings: "Κύρια ευρήματα",
      caseCheckIssues: "Βασικά ζητήματα και νομικά ερωτήματα",
      caseCheckMissingEvidence: "Πιθανά αποδεικτικά κενά",
      caseCheckMissingLaw: "Πιθανά νομικά κενά",
      caseCheckFeedback: "Παρατηρήσεις προς τον δικαστή",
      caseCheckCitations: "Έλεγχος παραπομπών και πηγών",
      caseCheckCredibility: "Ενδείξεις αξιοπιστίας αποδείξεων",
      caseCheckContradictions: "Αντιφάσεις και συγκρούσεις",
      caseCheckPrecedent: "Υποστήριξη και διάκριση νομολογίας",
      caseCheckRatio: "Ratio decidendi",
      caseCheckObiter: "Obiter dicta",
      caseCheckJurisdiction: "Δικαιοδοσία και παραδεκτό",
      caseCheckProportionality: "Αναλογικότητα θεραπείας ή κύρωσης",
      caseCheckDecisionQuality: "Βαθμολογία ποιότητας απόφασης",
      caseCheckPreSignature: "Τελικός έλεγχος πριν την υπογραφή",
      caseCheckBlockers: "Εμπόδια για υπογραφή",
      caseCheckRecommendedActions: "Συνιστώμενες ενέργειες πριν την υπογραφή",
      qualityScoreLabel: "Βαθμολογία ποιότητας",
      readyForSignature: "Έτοιμο για υπογραφή",
      notReadyForSignature: "Δεν είναι έτοιμο για υπογραφή",
      caseCheckNoItems: "Δεν εντοπίστηκαν ειδικά στοιχεία σε αυτή την ενότητα.",
      caseCheckEmpty: "Δεν έχει παραχθεί ακόμη έλεγχος. Εκτελέστε τον ελεγκτή για να δείτε αν η προτεινόμενη απόφαση στηρίζεται στο δίκαιο και στις αποδείξεις.",
      assessmentLabels: {
        supported: "Στηρίζεται",
        partially_supported: "Στηρίζεται εν μέρει",
        contradicted: "Αντικρούεται",
        insufficient_basis: "Ανεπαρκής βάση",
      },
      reviewTemplateOptions: {
        inheritance: "Κληρονομικό δίκαιο",
      },
      draftTitle: "Δομημένο σχέδιο απόφασης",
      draftDescription: "Το σχέδιο με υποστήριξη AI οργανώνεται στις πέντε απαιτούμενες ενότητες και εμφανίζει αιτιολόγηση, βαθμό βεβαιότητας και εσωτερικές παραπομπές ανά παράγραφο.",
      approveDraft: "Έγκριση σχεδίου",
      exportDocx: "Εξαγωγή DOCX",
      reviewBeforeApproval: "Εκτελέστε τον έλεγχο νομικής συνέπειας πριν από την έγκριση.",
      resolveReviewBlockers: "Επιλύστε τα εμπόδια του τελικού ελέγχου πριν από την έγκριση.",
      approvalGateHint: "Η έγκριση εξαρτάται πλέον από τον έλεγχο ποιότητας που επιβεβαιώνει ότι το σχέδιο είναι έτοιμο για υπογραφή.",
      autoApproveLabel: "Αυτόματη έγκριση όλων των σχεδίων",
      autoApproveDescription: "Παράκαμψη ορίων ποιότητας και άμεση έγκριση και εξαγωγή DOCX.",
      version: "Έκδοση",
      markReviewed: "Σήμανση ως ελεγμένο",
      approveSection: "Έγκριση ενότητας",
      paragraph: "Παράγραφος",
      confidence: "Βεβαιότητα",
      rationale: "Αιτιολόγηση AI",
      reviewStatus: "Κατάσταση ελέγχου",
      saveParagraph: "Αποθήκευση παραγράφου",
      annotationsTitle: "Παραπομπές σε αποδείξεις και δίκαιο",
      traceTitle: "Ίχνος αποδείξεων προς αιτιολογία",
      reasoningTraceTitle: "Βάση αιτιολογίας",
      evidenceTraceTitle: "Υποστηρικτικές αποδείξεις και δίκαιο",
      rationaleMissing: "Δεν έχει καταγραφεί ακόμη σημείωμα αιτιολογίας για αυτή την παράγραφο.",
      traceEmpty: "Δεν έχει συνδεθεί ακόμη υποστηρικτικό αποδεικτικό ή νομική παραπομπή με αυτή την παράγραφο.",
      emptyDraft: "Δεν υπάρχει ακόμη σχέδιο για αυτή την υπόθεση. Μεταφορτώστε το σχετικό υλικό και έπειτα δημιουργήστε το δομημένο σχέδιο απόφασης.",
      timelineTitle: "Χρονολόγιο υπόθεσης",
      timelineDescription: "Όλες οι μεταφορτώσεις, οι ενέργειες παραγωγής, οι επεξεργασίες, οι εγκρίσεις και οι εξαγωγές καταγράφονται για ελεγκτική ιχνηλασιμότητα.",
      emptyTimeline: "Δεν έχει καταγραφεί ακόμη δραστηριότητα για αυτή την υπόθεση.",
      documentTypes: {
        pleading: "Δικόγραφο",
        evidence: "Αποδεικτικό",
        supporting: "Υποστηρικτικό",
        reference: "Αναφορά",
        decision: "Απόφαση",
        other: "Άλλο",
      },
      reviewOptions: {
        draft: "Πρόχειρο",
        reviewed: "Ελεγμένο",
        approved: "Εγκεκριμένο",
      },
    },
    admin: {
      restrictedTitle: "Διαχείριση",
      restrictedDescription: "Αυτή η περιοχή είναι διαθέσιμη μόνο σε διαχειριστές.",
      restrictedMessage: "Έχετε συνδεθεί ως δικαστής. Τα διοικητικά εργαλεία για χρήστες και ρυθμίσεις παρόχου AI είναι κρυφά και προστατευμένα.",
      providerTitle: "Ρύθμιση παρόχου AI",
      providerDescription: "Ρυθμίστε τον πάροχο μοντέλου, το endpoint και τα διαπιστευτήρια χωρίς αλλαγές κώδικα.",
      configurationName: "Όνομα ρύθμισης",
      providerType: "Τύπος παρόχου",
      modelDeployment: "Μοντέλο / ανάπτυξη",
      endpoint: "Endpoint",
      apiKey: "Κλειδί API",
      azureApiVersion: "Έκδοση Azure API",
      draftTemperature: "Θερμοκρασία σχεδίου",
      maxTokens: "Μέγιστα tokens ανά απάντηση",
      systemPrompt: "Προεπιλεγμένο system prompt",
      saveProvider: "Αποθήκευση παρόχου",
      testProvider: "Δοκιμή σύνδεσης",
      testProviderSuccess: "Σύνδεση επιτυχής",
      testProviderFail: "Αποτυχία σύνδεσης",
      configuredProvidersTitle: "Ρυθμισμένοι πάροχοι",
      configuredProvidersDescription: "Ένας πάροχος μπορεί να οριστεί ενεργός για λειτουργίες σύνταξης.",
      active: "ενεργός",
      makeActive: "Ορισμός ως ενεργού",
      editProvider: "Επεξεργασία",
      noProviders: "Δεν έχουν ρυθμιστεί ακόμη πάροχοι AI.",
      userManagementTitle: "Διαχείριση χρηστών και ρόλων",
      userManagementDescription: "Οι διακρίσεις μεταξύ δικαστή και διαχειριστή είναι ορατές στο περιβάλλον και επιβάλλονται μέσω προστατευμένων διαδρομών και διαδικασιών.",
      unnamedUser: "Χρήστης χωρίς όνομα",
      toggleRole: "Αλλαγή ρόλου",
      suspend: "Αναστολή",
      reactivate: "Επανενεργοποίηση",
      noUsers: "Δεν υπάρχουν διαθέσιμοι λογαριασμοί χρηστών.",
      providerOptions: {
        openai: "OpenAI",
        azure_openai: "Azure OpenAI",
        custom_openai_compatible: "Συμβατός προσαρμοσμένος",
        alibaba_cloud: "Alibaba Cloud (Σιγκαπούρη)",
        kimi: "Kimi (Moonshot)",
        deepseek: "DeepSeek",
      },
      dataTabLabel: "Δεδομένα",
      dataTitle: "Διαχείριση δεδομένων",
      dataDescription: "Μη αναστρέψιμες ενέργειες. Χρησιμοποιήστε τις κατά τον παροπλισμό, την εναλλαγή διαπιστευτηρίων ή την προετοιμασία νέου περιβάλλοντος επίδειξης.",
      resetFactoryTitle: "Εργοστασιακή επαναφορά",
      resetFactoryDescription: "Διαγράφει κάθε υπόθεση, σχέδιο, έγγραφο, καταχώριση γνώσης, ρύθμιση παρόχου και προτίμηση χρήστη. Οι άλλες συνεδρίες ακυρώνονται. Οι προκαθορισμένοι πάροχοι ξαναδημιουργούνται στην επόμενη εκκίνηση.",
      resetFactoryAction: "Εκτέλεση εργοστασιακής επαναφοράς",
      resetProgramTitle: "Διαγραφή μόνο δεδομένων προγράμματος",
      resetProgramDescription: "Καθαρίζει υποθέσεις, σχέδια, έγγραφα, νομική βάση γνώσης και αρχεία καταγραφής. Ρυθμίσεις παρόχων, όρια και προτιμήσεις διατηρούνται.",
      resetProgramAction: "Διαγραφή δεδομένων προγράμματος",
      resetSettingsTitle: "Εκκαθάριση μόνο ρυθμίσεων",
      resetSettingsDescription: "Αφαιρεί τους διαμορφωμένους παρόχους AI, τα όρια ελέγχου και την αυτόματη έγκριση χρηστών. Υποθέσεις και νομική βάση γνώσης δεν επηρεάζονται.",
      resetSettingsAction: "Εκκαθάριση ρυθμίσεων",
      resetConfirmTitle: "Επιβεβαίωση μη αναστρέψιμης ενέργειας",
      resetConfirmBody: "Αυτή η ενέργεια δεν αναιρείται. Πληκτρολογήστε RESET για επιβεβαίωση.",
      resetConfirmType: "Πληκτρολογήστε RESET για επιβεβαίωση",
      resetConfirmCancel: "Ακύρωση",
      resetConfirmRun: "Εκτέλεση επαναφοράς",
    },
    shortcuts: {
      helpTitle: "Συντομεύσεις πληκτρολογίου",
      helpDescription: "Γρήγορη πλοήγηση χωρίς ποντίκι.",
      entries: [
        ["g o", "Μετάβαση στην Επισκόπηση"],
        ["g c", "Μετάβαση στις Υποθέσεις"],
        ["g k", "Μετάβαση στη Βάση Γνώσης"],
        ["g a", "Μετάβαση στη Διαχείριση (μόνο admin)"],
        ["n", "Δημιουργία νέας υπόθεσης"],
        ["?", "Άνοιγμα λίστας συντομεύσεων"],
        ["Esc", "Κλείσιμο διαλόγων"],
      ] as Array<readonly [string, string]>,
      close: "Κλείσιμο",
    },
    common: {
      selectedFile: "Επιλεγμένο αρχείο",
      selectedFiles: "Επιλεγμένα αρχεία",
    },
  },
} as const;

const runtimeCopy = {
  en: {
    toast: {
      draftStarted: "Draft generation started",
      draftGenerated: "Structured draft generated",
      draftFailed: "Draft generation failed",
      draftCancelled: "Draft generation cancelled",
      caseCreated: "Case created",
      caseUpdated: "Case updated",
      caseDeleted: "Case deleted",
      knowledgeDuplicate: "Duplicate legal material recorded",
      knowledgeUploaded: "Knowledge document uploaded",
      caseDocumentDuplicate: "Duplicate case document detected",
      caseDocumentUploaded: "Case document uploaded",
      batchImportCompleted: (imported: number, duplicates: number) => `Batch import completed: ${imported} imported, ${duplicates} duplicates`,
      reviewCompleted: "Legal consistency review completed",
      paragraphSaved: "Paragraph saved",
      sectionStatusUpdated: "Section review status updated",
      draftApproved: "Draft approved",
      docxExportCreated: "DOCX export created",
      downloadLinkFailed: "Failed to retrieve download link",
      thresholdSaved: "Approval threshold saved",
      autoApproveEnabled: "Auto-approve enabled",
      autoApproveDisabled: "Auto-approve disabled",
      reviewReportExported: "Review report exported",
      signedPdfExported: "Signed PDF review report exported",
      providerSaved: "AI provider settings saved",
      activeProviderUpdated: "Active AI provider updated",
      userUpdated: "User updated",
      chooseKnowledgeFile: "Choose a knowledge-base file to upload",
      chooseCaseFile: "Choose a case document to upload",
      chooseKnowledgeFiles: "Choose one or more knowledge files to import",
      chooseCaseFiles: "Choose one or more case files to import",
      uploadFailed: "Upload failed",
      batchUploadFailed: "Batch upload failed",
      batchImportFailed: "Batch import failed",
      noCasesToExport: "No matters to export",
    },
    labels: {
      ready: "Ready",
      review: "Review",
      needed: "Needed",
      next: "Next",
      snapshot: "Snapshot",
      draft: "Draft",
      manual: "manual",
      quality: "Quality",
      blocked: "Blocked",
      openReview: "Open review",
      comparePrevious: "Compare previous",
      docxReport: "DOCX report",
      signedPdf: "Signed PDF",
      savedReviewFallback: "Saved judicial-quality review.",
      savedReviewHistory: "Saved review history",
      savedReviewHistoryDescription: "Each legal-consistency review is stored by draft version so judges can reopen prior findings, compare successive reviews side by side, and export formal reports in DOCX or signed PDF.",
      savedReviewEmpty: "Run the legal consistency review to start building a saved history for this matter.",
      reviewDiffTitle: "Successive review diff",
      reviewDiffDescription: "Compare the currently opened saved review with an earlier snapshot to see how quality score, blockers, findings, and reasoning gaps changed across draft versions.",
      currentReview: "Current review",
      compareAgainst: "Compare against",
      currentSnapshot: "Current snapshot",
      baselineSnapshot: "Baseline snapshot",
      currentFindings: "Current findings",
      currentFindingsDescription: "Highlighted rows show what is new or what changed compared with the baseline review.",
      baselineFindings: "Baseline findings",
      baselineFindingsDescription: "Resolved rows are highlighted so judges can see which earlier concerns no longer appear in the current review.",
      noCurrentFindings: "No findings were captured in the current saved review.",
      noBaselineFindings: "No findings were captured in the baseline saved review.",
      currentReviewMissing: "Current saved review summary unavailable.",
      baselineReviewMissing: "Baseline saved review summary unavailable.",
      qualityDelta: "Quality delta",
      addedBlockers: "Added blockers",
      resolvedBlockers: "Resolved blockers",
      findingChanges: "Finding changes",
      newlyIntroduced: "Newly introduced since baseline",
      resolvedSinceBaseline: "Resolved since baseline",
      blockerPrefix: "Blocker",
      findingPrefix: "Finding",
      missingEvidencePrefix: "Missing evidence",
      missingLawPrefix: "Missing law",
      issuePrefix: "Issue",
      noNewReviewChanges: "No new blockers, findings, or reasoning gaps were introduced in the selected review.",
      noResolvedReviewChanges: "No blockers, findings, or legal-analysis gaps were resolved between these two saved reviews.",
      actionPrefix: "Action",
      approvalThreshold: "Approval threshold",
      approvalThresholdDescription: "Configure the review score and blocker tolerance that an inheritance-law draft must satisfy before final approval is allowed.",
      approvalThresholdLoading: "Approval threshold is loading or has not been initialized yet.",
      greekInheritanceLaw: "Greek inheritance law",
      greekInheritanceLawDescription: "Applied whenever a saved review is used to approve an inheritance-law draft.",
      judgeRule: "Judge rule",
      minimumQualityScore: "Minimum quality score",
      maxMediumSeverityFindings: "Maximum medium-severity findings",
      maxHighSeverityFindings: "Maximum high-severity findings",
      requirePreSignatureReadiness: "Require pre-signature readiness",
      saveThreshold: "Save threshold",
      new: "New",
      resolved: "Resolved",
      changed: "Changed",
      stable: "Stable",
      severityChanged: (from: string, to: string) => `Severity ${from} -> ${to}`,
      recommendedActionUpdated: "Recommended action updated",
      newFinding: "New finding",
      resolvedOrRemoved: "Resolved or removed",
      reviewReportDocx: "Review report DOCX",
      reviewReportPdf: "Review report PDF",
      signedReviewPdf: "Signed review PDF",
      userPrefix: "User",
    },
    status: {
      created: "Created",
      document_review: "Document review",
      drafting: "Drafting",
      under_review: "Under review",
      approved: "Approved",
      archived: "Archived",
      system_generated: "System generated",
      judge_edited: "Judge edited",
      reviewed: "Reviewed",
      draft: "Draft",
      ai: "AI",
      manual: "Manual",
      hybrid: "Hybrid",
      processed: "Processed",
      uploaded: "Uploaded",
      failed: "Failed",
      duplicate: "Duplicate",
      active: "Active",
      suspended: "Suspended",
      admin: "Admin",
      judge: "Judge",
      supported: "Supported",
      partially_supported: "Partially supported",
      contradicted: "Contradicted",
      insufficient_basis: "Insufficient basis",
      strong: "Strong",
      adequate: "Adequate",
      weak: "Weak",
      incomplete: "Incomplete",
      ready: "Ready",
      blocked: "Blocked",
      low: "Low",
      medium: "Medium",
      high: "High",
      critical: "Critical",
      pleading: "Pleading",
      evidence: "Evidence",
      supporting: "Supporting",
      reference: "Reference",
      decision: "Decision",
      other: "Other",
      statute: "Statute",
      regulation: "Regulation",
      precedent: "Precedent",
      case_document: "Case document",
      knowledge_document: "Knowledge document",
      general: "General",
      inheritance: "Greek inheritance law",
    },
    actionTypes: {
      "case.created": "Case created",
      "case.status_changed": "Case status changed",
      "case.archived": "Case archived",
      "case_document.duplicate_detected": "Duplicate document detected",
      "case_document.uploaded": "Case document uploaded",
      "draft.created": "Draft created",
      "draft.generated": "AI draft generated",
      "draft.paragraph_updated": "Draft paragraph updated",
      "draft.section_status_changed": "Draft section status changed",
      "draft.approved": "Draft approved",
      "case.review_generated": "Case review generated",
      "decision.exported": "Decision exported",
      "case.review_report_exported": "Review report exported",
      "knowledge_document.batch_uploaded": "Knowledge batch uploaded",
    },
  },
  el: {
    toast: {
      draftStarted: "Η παραγωγή σχεδίου ξεκίνησε",
      draftGenerated: "Το δομημένο σχέδιο δημιουργήθηκε",
      draftFailed: "Η παραγωγή σχεδίου απέτυχε",
      draftCancelled: "Η παραγωγή σχεδίου ακυρώθηκε",
      caseCreated: "Η υπόθεση δημιουργήθηκε",
      caseUpdated: "Η υπόθεση ενημερώθηκε",
      caseDeleted: "Η υπόθεση διαγράφηκε",
      knowledgeDuplicate: "Καταγράφηκε διπλότυπο νομικό υλικό",
      knowledgeUploaded: "Το έγγραφο γνώσης μεταφορτώθηκε",
      caseDocumentDuplicate: "Εντοπίστηκε διπλότυπο έγγραφο υπόθεσης",
      caseDocumentUploaded: "Το έγγραφο υπόθεσης μεταφορτώθηκε",
      batchImportCompleted: (imported: number, duplicates: number) => `Η μαζική εισαγωγή ολοκληρώθηκε: ${imported} εισήχθησαν, ${duplicates} διπλότυπα`,
      reviewCompleted: "Ο έλεγχος νομικής συνέπειας ολοκληρώθηκε",
      paragraphSaved: "Η παράγραφος αποθηκεύτηκε",
      sectionStatusUpdated: "Η κατάσταση ενότητας ενημερώθηκε",
      draftApproved: "Το σχέδιο εγκρίθηκε",
      docxExportCreated: "Η εξαγωγή DOCX δημιουργήθηκε",
      downloadLinkFailed: "Αποτυχία ανάκτησης συνδέσμου λήψης",
      thresholdSaved: "Το όριο έγκρισης αποθηκεύτηκε",
      autoApproveEnabled: "Η αυτόματη έγκριση ενεργοποιήθηκε",
      autoApproveDisabled: "Η αυτόματη έγκριση απενεργοποιήθηκε",
      reviewReportExported: "Η έκθεση ελέγχου εξήχθη",
      signedPdfExported: "Η υπογεγραμμένη έκθεση PDF εξήχθη",
      providerSaved: "Οι ρυθμίσεις παρόχου AI αποθηκεύτηκαν",
      activeProviderUpdated: "Ο ενεργός πάροχος AI ενημερώθηκε",
      userUpdated: "Ο χρήστης ενημερώθηκε",
      chooseKnowledgeFile: "Επιλέξτε αρχείο βάσης γνώσης για μεταφόρτωση",
      chooseCaseFile: "Επιλέξτε έγγραφο υπόθεσης για μεταφόρτωση",
      chooseKnowledgeFiles: "Επιλέξτε ένα ή περισσότερα αρχεία γνώσης για εισαγωγή",
      chooseCaseFiles: "Επιλέξτε ένα ή περισσότερα αρχεία υπόθεσης για εισαγωγή",
      uploadFailed: "Η μεταφόρτωση απέτυχε",
      batchUploadFailed: "Η μαζική μεταφόρτωση απέτυχε",
      batchImportFailed: "Η μαζική εισαγωγή απέτυχε",
      noCasesToExport: "Δεν υπάρχουν υποθέσεις για εξαγωγή",
    },
    labels: {
      ready: "Έτοιμο",
      review: "Έλεγχος",
      needed: "Απαιτείται",
      next: "Επόμενο",
      snapshot: "Στιγμιότυπο",
      draft: "Σχέδιο",
      manual: "χειροκίνητο",
      quality: "Ποιότητα",
      blocked: "Με εμπόδια",
      openReview: "Άνοιγμα ελέγχου",
      comparePrevious: "Σύγκριση με προηγούμενο",
      docxReport: "Έκθεση DOCX",
      signedPdf: "Υπογεγραμμένο PDF",
      savedReviewFallback: "Αποθηκευμένος έλεγχος δικαστικής ποιότητας.",
      savedReviewHistory: "Ιστορικό αποθηκευμένων ελέγχων",
      savedReviewHistoryDescription: "Κάθε έλεγχος νομικής συνέπειας αποθηκεύεται ανά έκδοση σχεδίου, ώστε ο δικαστής να ανοίγει παλαιότερα ευρήματα, να συγκρίνει διαδοχικούς ελέγχους και να εξάγει επίσημες εκθέσεις σε DOCX ή υπογεγραμμένο PDF.",
      savedReviewEmpty: "Εκτελέστε έλεγχο νομικής συνέπειας για να δημιουργηθεί ιστορικό αποθηκευμένων ελέγχων για την υπόθεση.",
      reviewDiffTitle: "Σύγκριση διαδοχικών ελέγχων",
      reviewDiffDescription: "Συγκρίνετε τον ανοιχτό αποθηκευμένο έλεγχο με παλαιότερο στιγμιότυπο για να δείτε αλλαγές στη βαθμολογία ποιότητας, στα εμπόδια, στα ευρήματα και στα κενά αιτιολογίας ανά έκδοση σχεδίου.",
      currentReview: "Τρέχων έλεγχος",
      compareAgainst: "Σύγκριση με",
      currentSnapshot: "Τρέχον στιγμιότυπο",
      baselineSnapshot: "Βασικό στιγμιότυπο",
      currentFindings: "Τρέχοντα ευρήματα",
      currentFindingsDescription: "Οι επισημασμένες σειρές δείχνουν τι είναι νέο ή τι άλλαξε σε σύγκριση με τον βασικό έλεγχο.",
      baselineFindings: "Ευρήματα βάσης",
      baselineFindingsDescription: "Οι επιλυμένες σειρές επισημαίνονται ώστε ο δικαστής να βλέπει ποιες προηγούμενες ανησυχίες δεν εμφανίζονται πλέον στον τρέχοντα έλεγχο.",
      noCurrentFindings: "Δεν καταγράφηκαν ευρήματα στον τρέχοντα αποθηκευμένο έλεγχο.",
      noBaselineFindings: "Δεν καταγράφηκαν ευρήματα στον βασικό αποθηκευμένο έλεγχο.",
      currentReviewMissing: "Δεν υπάρχει σύνοψη για τον τρέχοντα αποθηκευμένο έλεγχο.",
      baselineReviewMissing: "Δεν υπάρχει σύνοψη για τον βασικό αποθηκευμένο έλεγχο.",
      qualityDelta: "Μεταβολή ποιότητας",
      addedBlockers: "Νέα εμπόδια",
      resolvedBlockers: "Επιλυμένα εμπόδια",
      findingChanges: "Αλλαγές ευρημάτων",
      newlyIntroduced: "Νέα στοιχεία μετά τη βάση",
      resolvedSinceBaseline: "Επιλύθηκαν μετά τη βάση",
      blockerPrefix: "Εμπόδιο",
      findingPrefix: "Εύρημα",
      missingEvidencePrefix: "Αποδεικτικό κενό",
      missingLawPrefix: "Νομικό κενό",
      issuePrefix: "Ζήτημα",
      noNewReviewChanges: "Δεν προστέθηκαν νέα εμπόδια, ευρήματα ή κενά αιτιολογίας στον επιλεγμένο έλεγχο.",
      noResolvedReviewChanges: "Δεν επιλύθηκαν εμπόδια, ευρήματα ή κενά νομικής ανάλυσης μεταξύ αυτών των δύο αποθηκευμένων ελέγχων.",
      actionPrefix: "Ενέργεια",
      approvalThreshold: "Όριο έγκρισης",
      approvalThresholdDescription: "Ρυθμίστε τη βαθμολογία ελέγχου και την ανοχή εμποδίων που πρέπει να πληροί ένα σχέδιο κληρονομικού δικαίου πριν επιτραπεί η τελική έγκριση.",
      approvalThresholdLoading: "Το όριο έγκρισης φορτώνεται ή δεν έχει αρχικοποιηθεί ακόμη.",
      greekInheritanceLaw: "Ελληνικό κληρονομικό δίκαιο",
      greekInheritanceLawDescription: "Εφαρμόζεται όταν ένας αποθηκευμένος έλεγχος χρησιμοποιείται για την έγκριση σχεδίου κληρονομικού δικαίου.",
      judgeRule: "Κανόνας δικαστή",
      minimumQualityScore: "Ελάχιστη βαθμολογία ποιότητας",
      maxMediumSeverityFindings: "Μέγιστος αριθμός ευρημάτων μεσαίας σοβαρότητας",
      maxHighSeverityFindings: "Μέγιστος αριθμός ευρημάτων υψηλής σοβαρότητας",
      requirePreSignatureReadiness: "Απαίτηση ετοιμότητας πριν την υπογραφή",
      saveThreshold: "Αποθήκευση ορίου",
      new: "Νέο",
      resolved: "Επιλύθηκε",
      changed: "Άλλαξε",
      stable: "Σταθερό",
      severityChanged: (from: string, to: string) => `Σοβαρότητα ${from} -> ${to}`,
      recommendedActionUpdated: "Η προτεινόμενη ενέργεια ενημερώθηκε",
      newFinding: "Νέο εύρημα",
      resolvedOrRemoved: "Επιλύθηκε ή αφαιρέθηκε",
      reviewReportDocx: "Έκθεση ελέγχου DOCX",
      reviewReportPdf: "Έκθεση ελέγχου PDF",
      signedReviewPdf: "Υπογεγραμμένη έκθεση PDF",
      userPrefix: "Χρήστης",
    },
    status: {
      created: "Δημιουργήθηκε",
      document_review: "Έλεγχος εγγράφων",
      drafting: "Σύνταξη",
      under_review: "Υπό έλεγχο",
      approved: "Εγκρίθηκε",
      archived: "Αρχειοθετήθηκε",
      system_generated: "Παραγωγή συστήματος",
      judge_edited: "Επεξεργασία δικαστή",
      reviewed: "Ελεγμένο",
      draft: "Προσχέδιο",
      ai: "AI",
      manual: "Χειροκίνητο",
      hybrid: "Υβριδικό",
      processed: "Επεξεργάστηκε",
      uploaded: "Μεταφορτώθηκε",
      failed: "Απέτυχε",
      duplicate: "Διπλότυπο",
      active: "Ενεργός",
      suspended: "Σε αναστολή",
      admin: "Διαχειριστής",
      judge: "Δικαστής",
      supported: "Στηρίζεται",
      partially_supported: "Στηρίζεται εν μέρει",
      contradicted: "Αντικρούεται",
      insufficient_basis: "Ανεπαρκής βάση",
      strong: "Ισχυρό",
      adequate: "Επαρκές",
      weak: "Αδύναμο",
      incomplete: "Ελλιπές",
      ready: "Έτοιμο",
      blocked: "Με εμπόδια",
      low: "Χαμηλή",
      medium: "Μεσαία",
      high: "Υψηλή",
      critical: "Κρίσιμη",
      pleading: "Δικόγραφο",
      evidence: "Αποδεικτικό",
      supporting: "Υποστηρικτικό",
      reference: "Αναφορά",
      decision: "Απόφαση",
      other: "Άλλο",
      statute: "Νόμος",
      regulation: "Κανονισμός",
      precedent: "Νομολογία",
      case_document: "Έγγραφο υπόθεσης",
      knowledge_document: "Έγγραφο γνώσης",
      general: "Γενικός",
      inheritance: "Ελληνικό κληρονομικό δίκαιο",
    },
    actionTypes: {
      "case.created": "Δημιουργία υπόθεσης",
      "case.status_changed": "Αλλαγή κατάστασης υπόθεσης",
      "case.archived": "Αρχειοθέτηση υπόθεσης",
      "case_document.duplicate_detected": "Εντοπισμός διπλότυπου εγγράφου",
      "case_document.uploaded": "Μεταφόρτωση εγγράφου υπόθεσης",
      "draft.created": "Δημιουργία σχεδίου",
      "draft.generated": "Παραγωγή σχεδίου AI",
      "draft.paragraph_updated": "Ενημέρωση παραγράφου σχεδίου",
      "draft.section_status_changed": "Αλλαγή κατάστασης ενότητας σχεδίου",
      "draft.approved": "Έγκριση σχεδίου",
      "case.review_generated": "Παραγωγή ελέγχου υπόθεσης",
      "decision.exported": "Εξαγωγή απόφασης",
      "case.review_report_exported": "Εξαγωγή έκθεσης ελέγχου",
      "knowledge_document.batch_uploaded": "Μαζική μεταφόρτωση γνώσης",
    },
  },
} as const;

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
  const [providerForm, setProviderForm] = useState(defaultProviderForm);
  const [providerTestResult, setProviderTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [paragraphDrafts, setParagraphDrafts] = useState<Record<number, { paragraphText: string; rationale: string; confidenceScore: string; reviewStatus: "draft" | "reviewed" | "approved" }>>({});
  const [draftProgress, setDraftProgress] = useState(0);
  const [draftProgressElapsed, setDraftProgressElapsed] = useState(0);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [reviewProgressElapsed, setReviewProgressElapsed] = useState(0);
  const [intakeSearch, setIntakeSearch] = useState("");
  const [intakePriorityFilter, setIntakePriorityFilter] = useState<"all" | "critical" | "high" | "normal">("all");
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
  }, [jobStatusQuery.data?.status]);

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

  const reviewJudgmentMutation = trpc.judgeAi.cases.reviewJudgment.useMutation({
    onSuccess: async result => {
      toast.success(rt.toast.reviewCompleted);
      setCaseReviewResult(result);
      await utils.judgeAi.cases.workspace.invalidate();
      await utils.judgeAi.cases.timeline.invalidate();
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

  const exportDraftMutation = trpc.judgeAi.drafts.exportDocx.useMutation({
    onSuccess: async exported => {
      toast.success(rt.toast.docxExportCreated);
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

  const activeDraft = useMemo(() => workspaceQuery.data?.latestDraft ?? null, [workspaceQuery.data]);
  const latestDraftText = useMemo(
    () => activeDraft?.sections.map((section: any) => `${section.sectionTitle}\n${section.sectionText}`).join("\n\n") ?? "",
    [activeDraft],
  );
  const latestReasoningText = useMemo(
    () => activeDraft?.sections.find((section: any) => section.sectionKey === "reasoning")?.sectionText ?? "",
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
                    </div>
                    {displayedIntake.length ? (
                      displayedIntake.map(item => (
                        <div key={item.id} className="rounded-[1.35rem] border border-stone-200/80 bg-white/92 px-4 py-4 shadow-[0_14px_34px_-24px_rgba(31,41,55,0.2)] dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,29,40,0.98)_0%,rgba(15,18,27,0.99)_100%)]">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-stone-950 dark:text-stone-100 break-words">{item.title}</p>
                                <StatusPill>{intakePriorityLabels[item.priorityLevel as keyof typeof intakePriorityLabels]}</StatusPill>
                                <StatusPill>{intakeDeadlineLabels[item.deadlineState as keyof typeof intakeDeadlineLabels]}</StatusPill>
                              </div>
                              <p className="mt-2 text-sm text-stone-600 dark:text-stone-200 break-words">{item.caseNumber} · {item.caseType} · {item.courtLevel}</p>
                              <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-200">{intakeStageSummary[item.status as keyof typeof intakeStageSummary] ?? copy.overview.intakeReviewSummary}</p>
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
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0" onClick={() => handleStartEditCase(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" onClick={() => setDeleteConfirmCaseId(item.id)}>
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
              <FileField label={ui.knowledge.fileLabel} onChange={setKnowledgeFile} selectedFile={knowledgeFile} selectedPrefix={ui.common.selectedFile} />
              <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={uploadKnowledgeMutation.isPending}>
                {uploadKnowledgeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookCopy className="mr-2 h-4 w-4" />}{ui.knowledge.uploadAction}
              </Button>
            </form>
          </ShellCard>

          <ShellCard title={ui.knowledge.batchTitle} description={ui.knowledge.batchDescription}>
            <form className="space-y-4" onSubmit={handleKnowledgeBatchUpload}>
              <MultiFileField label={ui.knowledge.batchFileLabel} selectedFiles={knowledgeBatchFiles} onChange={setKnowledgeBatchFiles} selectedPrefix={ui.common.selectedFiles} />
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
                  <span className="truncate font-medium text-stone-800 dark:text-stone-100">{ui.workspace.generateAction} — {getProgressStep()}</span>
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

        <Tabs defaultValue="documents" className="space-y-6">
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
                <FileField label={ui.workspace.fileLabel} onChange={setCaseFile} selectedFile={caseFile} selectedPrefix={ui.common.selectedFile} />
                <Button type="submit" className="rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200" disabled={uploadCaseDocumentMutation.isPending}>
                  {uploadCaseDocumentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}{ui.workspace.uploadAction}
                </Button>
              </form>
            </ShellCard>

            <ShellCard title={ui.workspace.batchTitle} description={ui.workspace.batchDescription}>
              <form className="space-y-4" onSubmit={handleCaseBatchUpload}>
                <MultiFileField label={ui.workspace.batchFileLabel} selectedFiles={caseBatchFiles} onChange={setCaseBatchFiles} selectedPrefix={ui.common.selectedFiles} />
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
              {isReviewing && (
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
                    </div>
                    <p className="mt-4 text-sm leading-7 text-stone-700 dark:text-stone-200">{caseReviewResult.summary}</p>
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
                      {(caseReviewResult.findings ?? []).length ? (caseReviewResult.findings ?? []).map((finding: any, index: number) => (
                        <div key={`${finding.issue}-${index}`} className="rounded-[1.25rem] border border-stone-200/80 bg-stone-50/90 p-4 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill>{translateToken(locale, finding.category)}</StatusPill>
                            <StatusPill>{translateToken(locale, finding.severity)}</StatusPill>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">{finding.issue}</p>
                          <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-200">{finding.explanation}</p>
                          {(finding.supportingSources ?? []).length ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-300">{finding.supportingSources.join(" · ")}</p> : null}
                        </div>
                      )) : <p className="text-sm leading-6 text-stone-600 dark:text-stone-200">{ui.workspace.caseCheckNoItems}</p>}
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
                {activeDraft.sections.map((section: any) => (
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
                      {section.paragraphs.map((paragraph: any) => {
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
                                      <div key={annotation.id} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-stone-200/90 bg-white px-2.5 py-1.5 text-xs text-stone-700 shadow-sm dark:border-stone-700/60 dark:bg-[linear-gradient(180deg,rgba(18,21,30,0.98)_0%,rgba(10,12,18,0.99)_100%)] dark:text-stone-200">
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-[1.35rem] border border-dashed border-stone-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,239,230,0.86))] px-5 py-10 text-sm leading-7 text-stone-500 dark:border-stone-700/80 dark:bg-[linear-gradient(180deg,rgba(24,28,39,0.96)_0%,rgba(16,19,28,0.98)_100%)] dark:text-stone-300">{ui.workspace.emptyDraft}</p>
            )}
          </ShellCard>
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

  function renderAdmin() {
    const adminTabsCopy = locale === "el"
      ? { providers: "Πάροχοι AI", users: "Χρήστες", advanced: "Προηγμένες ρυθμίσεις" }
      : { providers: "AI Providers", users: "Users", advanced: "Advanced settings" };
    const isAdmin = user?.role === "admin";
    const tabColClass = isAdmin ? "grid-cols-3 sm:grid-cols-3" : "grid-cols-1";
    return (
      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className={`grid w-full ${tabColClass} gap-1 rounded-xl border border-stone-200 bg-white p-1 sm:w-auto sm:inline-grid dark:border-white/10 dark:bg-[#151923]`}>
          <TabsTrigger value="providers" className="rounded-lg text-sm">{adminTabsCopy.providers}</TabsTrigger>
          {isAdmin ? <TabsTrigger value="users" className="rounded-lg text-sm">{adminTabsCopy.users}</TabsTrigger> : null}
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
        </TabsContent>

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
