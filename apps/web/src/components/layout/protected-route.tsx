import { Navigate, useLocation } from "react-router-dom";
import { useOwner } from "../../features/auth/hooks/use-owner";

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

/**
 * Route guard that requires active owner session.
 * Unauthenticated users are redirected to /login with state preserved.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session } = useOwner();
  const location = useLocation();

  if (session.isPending || session.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground font-sans">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Verifying workspace session…</span>
        </div>
      </div>
    );
  }

  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
