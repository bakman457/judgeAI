import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { repairMojibakeObject } from "@/lib/textEncoding";
import { APP_VERSION } from "@shared/const";
import { Languages, MoonStar, SunMedium } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CSSProperties, Fragment } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

export type DashboardNavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  roles?: Array<"judge" | "admin">;
};

export type DashboardNavGroup = {
  id: string;
  label?: string;
  items: DashboardNavItem[];
};

export type Breadcrumb = {
  label: string;
  path?: string;
};

type DashboardLayoutProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  navGroups: DashboardNavGroup[];
};

const copyByLocale = {
  en: {
    productName: "Judge AI",
    light: "Light",
    dark: "Dark",
    judgeFallback: "Judge",
    version: "Version",
    roles: {
      admin: "Administrator",
      judge: "Judge",
    },
  },
  el: {
    productName: "Judge AI",
    light: "Φωτεινό",
    dark: "Σκούρο",
    judgeFallback: "Δικαστής",
    version: "Έκδοση",
    roles: {
      admin: "Διαχειριστής",
      judge: "Δικαστής",
    },
  },
} as const;

const DEFAULT_WIDTH = 260;

export default function DashboardLayout({
  children,
  title,
  description,
  actions,
  breadcrumbs,
  navGroups,
}: DashboardLayoutProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  const role = user?.role ?? "admin";
  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.roles || item.roles.includes(role)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${DEFAULT_WIDTH}px` } as CSSProperties}
    >
      <DashboardLayoutContent
        navGroups={filteredGroups}
        title={title}
        description={description}
        actions={actions}
        breadcrumbs={breadcrumbs}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  navGroups: DashboardNavGroup[];
};

function DashboardLayoutContent({
  children,
  title,
  description,
  actions,
  breadcrumbs,
  navGroups,
}: DashboardLayoutContentProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { locale, setLocale } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const copy = repairMojibakeObject(copyByLocale[locale]);

  const headerControls = (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-lg border border-stone-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/5">
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={
            locale === "en"
              ? "inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-50 dark:bg-stone-100 dark:text-stone-900"
              : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10"
          }
        >
          <Languages className="h-3.5 w-3.5" />
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale("el")}
          className={
            locale === "el"
              ? "inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-50 dark:bg-stone-100 dark:text-stone-900"
              : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10"
          }
        >
          ΕΛ
        </button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-lg p-0 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? copy.light : copy.dark}
      >
        {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-stone-50 text-stone-900 dark:bg-[#0f131b] dark:text-stone-100">
      <Sidebar
        collapsible="icon"
        className="border-r border-stone-200 bg-white dark:border-white/10 dark:bg-[#151923]"
      >
        <SidebarHeader className="border-b border-stone-200 px-3 py-6 dark:border-white/10">
          <div className="flex flex-col items-center justify-center gap-3">
            <img
              src="/logo.png"
              alt="Judge AI Logo"
              className="w-[90%] aspect-square object-cover object-center rounded-3xl group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:rounded-xl"
            />
            <span className="text-base font-bold tracking-tight text-stone-900 group-data-[collapsible=icon]:hidden dark:text-stone-50">
              {copy.productName}
            </span>
            <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[0.65rem] font-semibold text-stone-500 group-data-[collapsible=icon]:hidden dark:border-white/10 dark:text-stone-400">
              {copy.version} {APP_VERSION}
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 px-2 py-3">
          {navGroups.map((group, index) => (
            <SidebarGroup key={group.id} className={index > 0 ? "mt-2" : ""}>
              {group.label ? (
                <SidebarGroupLabel className="px-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
                  {group.label}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map(item => {
                    const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.label}
                          onClick={() => setLocation(item.path)}
                          className="h-9 rounded-md px-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-950 data-[active=true]:bg-stone-900 data-[active=true]:text-stone-50 data-[active=true]:hover:bg-stone-800 data-[active=true]:hover:text-stone-50 dark:text-stone-300 dark:hover:bg-white/8 dark:hover:text-stone-50 dark:data-[active=true]:bg-stone-100 dark:data-[active=true]:text-stone-900 dark:data-[active=true]:hover:bg-stone-200"
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-stone-200 p-2 dark:border-white/10">
          <div className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-8 w-8 border border-stone-200 dark:border-white/10">
              <AvatarFallback className="bg-stone-900 text-xs font-semibold text-stone-50 dark:bg-stone-100 dark:text-stone-900">
                {user?.name?.charAt(0).toUpperCase() ?? "J"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-xs font-semibold text-stone-900 dark:text-stone-50">{user?.name || copy.judgeFallback}</p>
              <p className="truncate text-[0.65rem] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">{copy.roles[user?.role as keyof typeof copy.roles] ?? user?.role}</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/95 px-4 backdrop-blur dark:border-white/10 dark:bg-[#151923]/95">
          <SidebarTrigger className="h-8 w-8 rounded-md text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10" />
          <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
            {(breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : title ? [{ label: title }] : []).map((crumb, index, arr) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <span className="text-stone-300 dark:text-stone-600">/</span> : null}
                {crumb.path && index < arr.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setLocation(crumb.path!)}
                    className="truncate text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={index === arr.length - 1 ? "truncate font-medium text-stone-900 dark:text-stone-50" : "truncate text-stone-500 dark:text-stone-400"}>
                    {crumb.label}
                  </span>
                )}
              </Fragment>
            ))}
          </nav>
          {!isMobile ? <div className="flex items-center gap-2">{actions}{headerControls}</div> : headerControls}
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] overflow-x-hidden px-4 py-5 md:px-6 md:py-6 xl:px-8">
          {description ? (
            <p className="mb-5 max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300">{description}</p>
          ) : null}
          {isMobile && actions ? <div className="mb-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
