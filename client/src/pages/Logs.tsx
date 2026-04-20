import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { repairMojibakeObject } from "@/lib/textEncoding";
import { trpc } from "@/lib/trpc";
import { ClipboardCopy, FileText, Home, PenTool, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
    <section className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#151923] md:p-6 ${className}`}>
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

const copyByLocale = {
  en: {
    pageTitle: "Application Logs",
    pageDescription: "View recent server logs and application activity in real time.",
    system: "System",
    logs: "Logs",
    work: "Work",
    dashboard: "Dashboard",
    judgeStyle: "Judge Style",
    serverLogs: "Server Logs",
    linesLoaded: (count: number, status: string) => `${count} lines loaded. Auto-refresh is ${status}.`,
    on: "on",
    off: "off",
    pause: "Pause",
    resume: "Resume",
    copy: "Copy",
    noLogs: "No logs available yet.",
    copied: "Logs copied to clipboard",
    copyFailed: "Failed to copy logs",
  },
  el: {
    pageTitle: "Αρχεία καταγραφής εφαρμογής",
    pageDescription: "Δείτε πρόσφατα αρχεία καταγραφής διακομιστή και δραστηριότητα εφαρμογής σε πραγματικό χρόνο.",
    system: "Σύστημα",
    logs: "Καταγραφές",
    work: "Εργασία",
    dashboard: "Πίνακας ελέγχου",
    judgeStyle: "Ύφος δικαστή",
    serverLogs: "Αρχεία καταγραφής διακομιστή",
    linesLoaded: (count: number, status: string) => `Φορτώθηκαν ${count} γραμμές. Η αυτόματη ανανέωση είναι ${status}.`,
    on: "ενεργή",
    off: "ανενεργή",
    pause: "Παύση",
    resume: "Συνέχεια",
    copy: "Αντιγραφή",
    noLogs: "Δεν υπάρχουν ακόμη αρχεία καταγραφής.",
    copied: "Οι καταγραφές αντιγράφηκαν στο πρόχειρο",
    copyFailed: "Η αντιγραφή καταγραφών απέτυχε",
  },
} as const;

export default function LogsPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const copy = repairMojibakeObject(copyByLocale[locale]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  const logsQuery = trpc.judgeAi.admin.logs.useQuery(
    { lines: 500 },
    {
      refetchInterval: autoRefresh ? 2000 : false,
      enabled: Boolean(user),
    }
  );

  const logs = logsQuery.data ?? [];

  useEffect(() => {
    if (shouldScrollToBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, shouldScrollToBottom]);

  const handleCopy = async () => {
    const text = logs.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(copy.copied);
    } catch {
      toast.error(copy.copyFailed);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setShouldScrollToBottom(isAtBottom);
  };

  return (
    <DashboardLayout
      title={copy.pageTitle}
      description={copy.pageDescription}
      breadcrumbs={[
        { label: copy.system },
        { label: copy.logs },
      ]}
      navGroups={[
        {
          id: "work",
          label: copy.work,
          items: [
            { icon: Home, label: copy.dashboard, path: "/" },
            { icon: PenTool, label: copy.judgeStyle, path: "/judge-style" },
          ],
        },
        {
          id: "system",
          label: copy.system,
          items: [{ icon: FileText, label: copy.logs, path: "/logs" }],
        },
      ]}
    >
      <ShellCard
        title={copy.serverLogs}
        description={copy.linesLoaded(logs.length, autoRefresh ? copy.on : copy.off)}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-md border-stone-200 bg-white text-stone-700 hover:bg-stone-100 hover:text-stone-900 dark:border-white/10 dark:bg-white/5 dark:text-stone-100 dark:hover:bg-white/10"
              onClick={() => setAutoRefresh(v => !v)}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? copy.pause : copy.resume}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-md border-stone-200 bg-white text-stone-700 hover:bg-stone-100 hover:text-stone-900 dark:border-white/10 dark:bg-white/5 dark:text-stone-100 dark:hover:bg-white/10"
              onClick={handleCopy}
            >
              <ClipboardCopy className="mr-2 h-4 w-4" />
              {copy.copy}
            </Button>
          </>
        }
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[calc(100vh-280px)] overflow-auto rounded-lg border border-stone-200 bg-stone-950 p-4 font-mono text-xs leading-5 text-stone-200 dark:border-white/10"
        >
          {logs.length === 0 ? (
            <p className="text-stone-500">{copy.noLogs}</p>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all py-0.5">
                {highlightLogLine(line)}
              </div>
            ))
          )}
        </div>
      </ShellCard>
    </DashboardLayout>
  );
}

function highlightLogLine(line: string): React.ReactNode {
  // Colorize log level tags
  if (line.includes(" [ERROR] ")) {
    const parts = line.split(" [ERROR] ");
    return (
      <>
        <span className="text-stone-400">{parts[0]}</span>
        <span className="rounded bg-red-500/20 px-1 text-red-400"> [ERROR] </span>
        <span className="text-red-300">{parts.slice(1).join(" [ERROR] ")}</span>
      </>
    );
  }
  if (line.includes(" [WARN] ")) {
    const parts = line.split(" [WARN] ");
    return (
      <>
        <span className="text-stone-400">{parts[0]}</span>
        <span className="rounded bg-amber-500/20 px-1 text-amber-400"> [WARN] </span>
        <span className="text-amber-300">{parts.slice(1).join(" [WARN] ")}</span>
      </>
    );
  }
  if (line.includes(" [INFO] ")) {
    const parts = line.split(" [INFO] ");
    return (
      <>
        <span className="text-stone-400">{parts[0]}</span>
        <span className="rounded bg-blue-500/20 px-1 text-blue-400"> [INFO] </span>
        <span className="text-stone-200">{parts.slice(1).join(" [INFO] ")}</span>
      </>
    );
  }
  if (line.includes(" [DEBUG] ")) {
    const parts = line.split(" [DEBUG] ");
    return (
      <>
        <span className="text-stone-400">{parts[0]}</span>
        <span className="rounded bg-purple-500/20 px-1 text-purple-400"> [DEBUG] </span>
        <span className="text-stone-300">{parts.slice(1).join(" [DEBUG] ")}</span>
      </>
    );
  }
  return <span className="text-stone-300">{line}</span>;
}
