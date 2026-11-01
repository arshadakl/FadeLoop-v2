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
    <div className="min-h-dvh bg-[#F6F6F6] text-[#212121] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#EDEEEC] px-6 py-2.5">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/campaigns" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded bg-[#212121] flex items-center justify-center font-bold text-xs text-white">
                FL
              </div>
              <span className="font-semibold text-base tracking-tight text-[#212121]">
                FadeLoop
              </span>
            </Link>

            <div className="h-4 w-px bg-[#EDEEEC] hidden sm:block" />

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      active
                        ? "bg-[#E5E5E4] text-[#212121]"
                        : "text-[#5D686A] hover:text-[#212121] hover:bg-[#F0F0EF]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session.data ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#5D686A] hidden md:inline-flex items-center gap-1.5 bg-[#F6F6F6] border border-[#EDEEEC] px-2.5 py-1 rounded">
                  <span>Workspace:</span>
                  <span className="font-mono text-[#212121]">
                    {session.data.workspaceId.slice(0, 8)}…
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="text-xs h-8 px-2.5 border-[#EDEEEC] text-[#5D686A] hover:text-[#212121]"
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
      <footer className="border-t border-[#EDEEEC] bg-white py-4 text-center text-xs text-[#8E9596]">
        FadeLoop V2 · Edge-native Instagram Automation · Notion Design Standard
        Verified
      </footer>
    </div>
  );
}
