import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../components/layout/protected-route";

const FoundationPage = lazy(() => import("../pages/foundation-page"));
const LoginPage = lazy(() => import("../pages/login-page"));
const CampaignsPage = lazy(() => import("../pages/campaigns-page"));
const EditCampaignPage = lazy(() => import("../pages/edit-campaign-page"));
const AccountsPage = lazy(() => import("../pages/accounts-page"));
const DeliveriesPage = lazy(() => import("../pages/deliveries-page"));

function AuthCallbackHandler() {
  useEffect(() => {
    window.location.replace(
      `/api/auth/instagram/callback${window.location.search}`,
    );
  }, []);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground font-sans">
      Completing Instagram authentication…
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground font-sans">
              Loading workspace…
            </div>
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <CampaignsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns"
              element={
                <ProtectedRoute>
                  <CampaignsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/:id/edit"
              element={
                <ProtectedRoute>
                  <EditCampaignPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounts"
              element={
                <ProtectedRoute>
                  <AccountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deliveries"
              element={
                <ProtectedRoute>
                  <DeliveriesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/foundation" element={<FoundationPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackHandler />} />
            <Route
              path="/api/auth/instagram/callback"
              element={<AuthCallbackHandler />}
            />
            <Route
              path="*"
              element={
                <main className="min-h-screen bg-[#0B0F19] text-white flex flex-col items-center justify-center p-6 text-center">
                  <h1 className="text-2xl font-bold mb-2">Page not found</h1>
                  <p className="text-sm text-slate-400 mb-6">
                    The requested page does not exist.
                  </p>
                  <a
                    href="/campaigns"
                    className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors"
                  >
                    Return to dashboard
                  </a>
                </main>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
