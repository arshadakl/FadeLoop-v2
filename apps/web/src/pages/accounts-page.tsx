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
      <div className="space-y-8 font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#EDEEEC]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Instagram Accounts
            </h1>
            <p className="text-sm text-[#5D686A] mt-1">
              Connect and manage Instagram professional or creator accounts for
              automated direct replies.
            </p>
          </div>

          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="flex items-center gap-1.5"
          >
            <span>+</span>
            <span>
              {connectMutation.isPending
                ? "Connecting..."
                : "Connect Instagram"}
            </span>
          </Button>
        </div>

        {/* Notifications */}
        {isConnectedNotice && (
          <div className="p-3.5 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-sm flex items-center justify-between">
            <span>
              ✓ Instagram account connected successfully! 60-day long-lived
              access token is sealed at rest.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm">
            Failed to connect Instagram account ({errorMessage}). Please verify
            Meta app settings and try again.
          </div>
        )}

        {/* Account List */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#212121]">
            Connected Accounts
          </h2>

          {accountsQuery.isPending ? (
            <div className="p-8 text-center text-sm text-[#5D686A] bg-white rounded border border-[#EDEEEC]">
              Loading connected accounts…
            </div>
          ) : accountsQuery.isError ? (
            <div className="p-8 text-center text-sm text-[#B91C1C] bg-[#FEF2F2] rounded border border-[#FECACA]">
              Failed to load accounts. Please check your session.
            </div>
          ) : accountsQuery.data.accounts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded border border-dashed border-[#EDEEEC]">
              <div className="w-10 h-10 rounded bg-[#212121] text-white font-bold flex items-center justify-center mx-auto mb-3 text-sm">
                IG
              </div>
              <h3 className="font-semibold text-base text-[#212121]">
                No Instagram Accounts Connected
              </h3>
              <p className="text-sm text-[#5D686A] max-w-md mx-auto mt-1 mb-5">
                Connect your professional or creator account to enable keyword
                triggers and automated replies.
              </p>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
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
                    className="p-4 bg-white rounded border border-[#EDEEEC] flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded bg-[#212121] flex items-center justify-center font-bold text-xs text-white">
                        IG
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#212121]">
                            ID: {acc.account_id}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.2 rounded font-medium ${
                              acc.status === "connected" && !isExpired
                                ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                                : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
                            }`}
                          >
                            {isExpired ? "Token Expired" : acc.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#5D686A] mt-0.5">
                          {isExpired
                            ? "Reconnection required to resume automated replies"
                            : `Token active · ${daysRemaining} days remaining (auto-refreshed nightly)`}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending}
                      className="text-xs h-7 px-2.5"
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
