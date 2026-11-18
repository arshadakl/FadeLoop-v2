import { Link, useLocation, useNavigate } from "react-router-dom";
import { useOwner } from "../../features/auth/hooks/use-owner";
import { useTheme } from "../../hooks/use-theme";
import { cn } from "../../lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Grid</title>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconZap({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Zap</title>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Users</title>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconInbox({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Inbox</title>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Moon</title>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Sun</title>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconLogOut({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Sign out</title>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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
  const { session, logout } = useOwner();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      {/* Desktop Sidebar (hidden on mobile, permanent on lg+) */}
      <aside className="hidden lg:flex w-60 flex-col bg-sidebar border-r border-sidebar-border lg:sticky lg:top-0 lg:h-dvh shrink-0">
        {/* Logo */}
        <div className="h-[64px] flex items-center px-4 border-b border-sidebar-border shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="w-4 h-4 text-primary-foreground"
                aria-hidden="true"
              >
                <path d="M10 2L3 10h4v8l6-8h-4L10 2z" fill="currentColor" />
              </svg>
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-base font-bold text-foreground tracking-tight font-heading">
                FadeLoop
              </p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Studio
              </p>
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
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-primary/15 text-primary font-semibold"
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

        {/* Desktop Footer (Theme & Account) */}
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
            <span>
              {theme === "dark"
                ? "Dark mode"
                : theme === "light"
                  ? "Light mode"
                  : "System"}
            </span>
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

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Top Bar */}
        <header className="lg:hidden h-14 flex items-center justify-between px-4 bg-sidebar border-b border-sidebar-border sticky top-0 z-20">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="w-3.5 h-3.5 text-primary-foreground"
                aria-hidden="true"
              >
                <path d="M10 2L3 10h4v8l6-8h-4L10 2z" fill="currentColor" />
              </svg>
            </div>
            <span className="text-base font-bold font-heading text-foreground tracking-tight">
              FadeLoop
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <IconMoon className="w-4 h-4" />
              ) : (
                <IconSun className="w-4 h-4" />
              )}
            </button>

            {session.data && (
              <button
                type="button"
                onClick={() => {
                  logout.mutate(undefined, {
                    onSuccess: () => navigate("/login", { replace: true }),
                  });
                }}
                disabled={logout.isPending}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <IconLogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Page Content with bottom padding on mobile for snackbar */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Snack Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-3 inset-x-3 sm:inset-x-6 max-w-md mx-auto z-40 lg:hidden bg-card/95 backdrop-blur-md border border-border/90 shadow-xl rounded-2xl px-2 py-1.5 flex items-center justify-around"
      >
        {navItems.map((item) => {
          const active = item.exact
            ? location.pathname === item.path || location.pathname === "/"
            : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-medium transition-all duration-150 gap-0.5",
                active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  active && "bg-primary/15 text-primary",
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
              </div>
              <span className="leading-tight tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
