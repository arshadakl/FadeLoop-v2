import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { fetchAccounts, initiateInstagramOAuthConnect } from "../api/accounts";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Button } from "../components/ui/button";

export default function AccountsPage() {
  const [searchParams] = useSearchParams();
  const isConnectedNotice = searchParams.get("connected") === "true";
  const errorMessage = searchParams.get("error");

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: ({ signal }) => fetchAccounts(signal),
  });

  const connectMutation = useMutation({
    mutationFn: () => initiateInstagramOAuthConnect(),
    onSuccess: (authorizeUrl) => {
      // Redirect browser to Meta Instagram OAuth authorization dialog
      window.location.href = authorizeUrl;
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Instagram Accounts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect and manage Instagram professional or creator accounts for
              automated direct replies.
            </p>
          </div>

          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            {connectMutation.isPending
              ? "Opening Meta Auth…"
              : "+ Connect Instagram Account"}
          </Button>
        </div>

        {/* Notifications */}
        {isConnectedNotice && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
            <span>
              Instagram account connected successfully! 60-day long-lived access
              token is sealed at rest.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-rose-400 text-sm">
            Failed to connect Instagram account ({errorMessage}). Please try
            again.
          </div>
        )}

        {/* Account List */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-200">
            Connected Accounts
          </h2>

          {accountsQuery.isPending ? (
            <div className="p-8 text-center text-sm text-muted-foreground glass-card rounded-xl">
              Loading connected accounts…
            </div>
          ) : accountsQuery.isError ? (
            <div className="p-8 text-center text-sm text-rose-400 glass-card rounded-xl">
              Failed to load accounts. Please check your session.
            </div>
          ) : accountsQuery.data.accounts.length === 0 ? (
            <div className="p-12 text-center glass-card rounded-xl border border-dashed border-border/80">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-4 text-xl">
                IG
              </div>
              <h3 className="font-semibold text-lg text-white">
                No Instagram Accounts Connected
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2 mb-6">
                Connect your Instagram account to enable keyword triggers and
                automated private replies to post comments.
              </p>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="bg-primary hover:bg-primary-hover text-white"
              >
                Connect Instagram Account
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {accountsQuery.data.accounts.map((acc) => {
                const isExpired = acc.token_expires_at
                  ? acc.token_expires_at < Date.now()
                  : true;
                const daysRemaining = acc.token_expires_at
                  ? Math.max(
                      0,
                      Math.floor(
                        (acc.token_expires_at - Date.now()) /
                          (1000 * 60 * 60 * 24),
                      ),
                    )
                  : 0;

                return (
                  <div
                    key={acc.account_id}
                    className="p-5 glass-card rounded-xl flex items-center justify-between border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-sm">
                        @
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            Account ID: {acc.account_id}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              acc.status === "connected" && !isExpired
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {isExpired ? "Token Expired" : acc.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isExpired
                            ? "Reconnection required to resume automated replies"
                            : `Token active · ${daysRemaining} days remaining`}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending}
                      className="text-xs h-8"
                    >
                      Reconnect
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
