import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const FoundationPage = lazy(() => import("../pages/foundation-page"));
const LoginPage = lazy(() => import("../pages/login-page"));
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
            <p role="status" className="p-6">
              Loading workspace…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<FoundationPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="*"
              element={
                <main className="p-6">
                  <h1>Page not found</h1>
                  <a href="/">Return to workspace</a>
                </main>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
