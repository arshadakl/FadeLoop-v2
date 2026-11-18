import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useOwner } from "../../features/auth/hooks/use-owner";
import { useTheme } from "../../hooks/use-theme";
import { cn } from "../../lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconZap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconInbox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconLogOut({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: IconGrid, exact: true },
  { label: "Campaigns", path: "/campaigns", icon: IconZap, exact: false },
  { label: "Accounts", path: "/accounts", icon: IconUsers, exact: false },
  { label: "Deliveries", path: "/deliveries", icon: IconInbox, exact: false },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { session, logout } = useOwner();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden cursor-default"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 flex flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-dvh",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="h-[60px] flex items-center px-4 border-b border-sidebar-border shrink-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 group"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-primary-foreground" aria-hidden="true">
                <path d="M10 2L3 10h4v8l6-8h-4L10 2z" fill="currentColor" />
              </svg>
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-bold text-foreground tracking-tight">FadeLoop</p>
              <p className="text-[10px] text-muted-foreground font-medium">Automation</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground/70 px-3 mb-2 tracking-widest">
            Menu
          </p>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const active = item.exact
                ? location.pathname === item.path || location.pathname === "/"
                : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3 border-t border-sidebar-border shrink-0 space-y-0.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {theme === "dark" ? (
              <IconMoon className="w-[18px] h-[18px] shrink-0" />
            ) : (
              <IconSun className="w-[18px] h-[18px] shrink-0" />
            )}
            <span>{theme === "dark" ? "Dark mode" : theme === "light" ? "Light mode" : "System"}</span>
          </button>

          {session.data && (
            <>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <span className="text-[9px] text-primary font-bold">W</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono truncate">
                  {session.data.workspaceId.slice(0, 12)}…
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout.mutate(undefined, {
                    onSuccess: () => navigate("/login", { replace: true }),
                  });
                }}
                disabled={logout.isPending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <IconLogOut className="w-[18px] h-[18px] shrink-0" />
                Sign out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden h-14 flex items-center justify-between px-4 bg-sidebar border-b border-sidebar-border sticky top-0 z-20">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Open sidebar"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5 text-primary-foreground" aria-hidden="true">
                <path d="M10 2L3 10h4v8l6-8h-4L10 2z" fill="currentColor" />
              </svg>
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight">FadeLoop</span>
          </Link>
          <div className="w-9" />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
