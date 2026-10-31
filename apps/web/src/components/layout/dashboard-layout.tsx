import { Link, useLocation } from "react-router-dom";
import { useOwner } from "../../features/auth/hooks/use-owner";
import { Button } from "../ui/button";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { session, logout } = useOwner();
  const location = useLocation();

  const navItems = [
    { label: "Campaigns", path: "/campaigns" },
    { label: "Accounts", path: "/accounts" },
    { label: "Deliveries", path: "/deliveries" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-border px-6 py-3.5 transition-all">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/campaigns" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-bold text-white shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                FL
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                FadeLoop
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/15 text-primary border border-primary/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {session.data ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground hidden sm:inline-block">
                  Workspace:{" "}
                  <span className="text-slate-300 font-mono">
                    {session.data.workspaceId.slice(0, 8)}…
                  </span>
                </span>
                <Button
                  variant="outline"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="text-xs h-8 px-3 border-border hover:bg-muted"
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" className="text-xs h-8 px-3">
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

      {/* Subtle Footer */}
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        FadeLoop V2 · Edge-native Instagram Delivery Automation · Free-tier
        Guardrails Verified
      </footer>
    </div>
  );
}
