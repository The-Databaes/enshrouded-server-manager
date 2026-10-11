import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { SiteHeader } from "@/components/app-shell/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/** Sidebar + header chrome that wraps every page. */
export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    // The sidebar is `fixed` to the viewport, so shift it below the custom
    // title bar; the wrapper fills the scroll area rather than the window.
    <SidebarProvider className="min-h-full">
      <AppSidebar className="top-(--titlebar-height) h-[calc(100svh-var(--titlebar-height))]" />
      <SidebarInset className="min-w-0 bg-transparent">
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

/** Consistent page title block (Cinzel heading, ember rule, muted description, actions). */
export const PageHeader = ({
  title,
  description,
  actions,
}: PageHeaderProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[0.06em]">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        <div className="rule-ember mt-2 w-40" />
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
};
