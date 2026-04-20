import { Toaster } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LocaleProvider } from "./contexts/LocaleContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const JudgeStyle = lazy(() => import("./pages/JudgeStyle"));
const Logs = lazy(() => import("./pages/Logs"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-6 text-stone-500" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/cases" component={Home} />
        <Route path="/cases/:caseId" component={Home} />
        <Route path="/knowledge" component={Home} />
        <Route path="/help" component={Home} />
        <Route path="/admin" component={Home} />
        <Route path="/judge-style" component={JudgeStyle} />
        <Route path="/logs" component={Logs} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LocaleProvider>
        <ThemeProvider defaultTheme="light" switchable>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}

export default App;
