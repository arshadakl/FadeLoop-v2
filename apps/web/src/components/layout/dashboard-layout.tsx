import { Link, useLocation } from "react-router-dom";
import { useOwner } from "../../features/auth/hooks/use-owner";
import { useTheme } from "../../hooks/use-theme";
import { Button } from "../ui/button";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { session, logout } = useOwner();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { label: "Campaigns", path: "/campaigns" },
    { label: "Accounts", path: "/accounts" },
    { label: "Deliveries", path: "/deliveries" },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-6 py-2.5">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/campaigns" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded bg-foreground text-background flex items-center justify-center font-bold text-xs">
                FL
              </div>
              <span className="font-semibold text-base tracking-tight text-foreground">
                FadeLoop
              </span>
            </Link>

            <div className="h-4 w-px bg-border hidden sm:block" />

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Current theme: ${theme}. Click to toggle.`}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted border border-border text-xs flex items-center gap-1 transition-colors"
              aria-label="Toggle theme"
            >
              <span className="text-sm">{theme === "dark" ? "🌙" : "☀️"}</span>
              <span className="hidden sm:inline capitalize text-[11px] font-medium">
                {theme}
              </span>
            </button>

            {session.data ? (
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1.5 bg-muted border border-border px-2.5 py-1 rounded">
                  <span>Workspace:</span>
                  <span className="font-mono text-foreground font-medium">
                    {session.data.workspaceId.slice(0, 8)}…
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="text-xs h-8 px-2.5 border-border text-muted-foreground hover:text-foreground"
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="text-xs h-8 px-3"
              >
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Clean Notion Footer */}
      <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground">
        FadeLoop V2 · Edge-native Instagram Automation · Notion Design Standard
        Verified
      </footer>
    </div>
  );
}
