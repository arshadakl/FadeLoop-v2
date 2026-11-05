import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type AccountMetadata,
  deleteAccount,
  fetchAccounts,
  fetchAccountWebhookStatus,
  initiateInstagramOAuthConnect,
  subscribeAccountWebhooks,
} from "../api/accounts";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";

function AccountItem({
  acc,
  onReconnect,
  onDelete,
  isConnecting,
}: {
  acc: AccountMetadata;
  onReconnect: () => void;
  onDelete: () => void;
  isConnecting: boolean;
}) {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const webhookQuery = useQuery({
    queryKey: ["webhook-status", acc.account_id],
    queryFn: ({ signal }) => fetchAccountWebhookStatus(acc.account_id, signal),
    enabled: acc.status === "connected",
    retry: 1,
  });

  const syncWebhookMutation = useMutation({
    mutationFn: () => subscribeAccountWebhooks(acc.account_id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["webhook-status", acc.account_id],
      });
      setActionMessage(
        `✓ Webhooks synced successfully! (${data.subscribedFields.join(", ")})`,
      );
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err) => {
      setActionMessage(
        `✕ Sync failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const isExpired = acc.token_expires_at
    ? acc.token_expires_at < Date.now()
    : true;
  const daysRemaining = acc.token_expires_at
    ? Math.max(
        0,
        Math.floor((acc.token_expires_at - Date.now()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  const isSubscribed =
    webhookQuery.data?.subscribed &&
    webhookQuery.data.subscribedFields.includes("comments");

  return (
    <div className="p-4 bg-card rounded border border-border flex flex-col gap-3 shadow-2xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          {acc.profile_picture_url ? (
            <img
              src={acc.profile_picture_url}
              alt={acc.username ? `@${acc.username}` : "Instagram Account"}
              className="w-12 h-12 rounded-full object-cover border border-border shrink-0 shadow-2xs"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm shrink-0">
              {acc.username ? acc.username.slice(0, 2).toUpperCase() : "IG"}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-base text-foreground tracking-tight truncate max-w-[200px] sm:max-w-none">
                {acc.username ? `@${acc.username}` : `ID: ${acc.account_id}`}
              </span>

              {acc.name && (
                <span className="text-xs text-muted-foreground font-medium truncate max-w-[150px] sm:max-w-none">
                  ({acc.name})
                </span>
              )}

              <span
                className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
                  acc.status === "connected" && !isExpired
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {isExpired ? "Token Expired" : acc.status}
              </span>

              {webhookQuery.isLoading ? (
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground animate-pulse shrink-0">
                  Checking webhook…
                </span>
              ) : isSubscribed ? (
                <span
                  className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-medium shrink-0"
                  title={`Subscribed fields: ${webhookQuery.data?.subscribedFields.join(", ")}`}
                >
                  <span>⚡</span>
                  <span>Webhooks Active</span>
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 font-medium shrink-0">
                  <span>⚠️</span>
                  <span>Webhook Not Subscribed</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-2xs font-mono text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
                ID: {acc.account_id}
              </span>
              <span className="text-xs text-muted-foreground">
                {isExpired
                  ? "Reconnection required to resume automated replies"
                  : `Token active · ${daysRemaining} days remaining`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t border-border/40 lg:border-t-0 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncWebhookMutation.mutate()}
            disabled={syncWebhookMutation.isPending || isExpired}
            className="text-xs h-7 px-2.5 whitespace-nowrap"
            title="Subscribe account to Meta Graph webhook events (comments, messages)"
          >
            {syncWebhookMutation.isPending ? "Syncing…" : "⚡ Sync Webhooks"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onReconnect}
            disabled={isConnecting}
            className="text-xs h-7 px-2.5 whitespace-nowrap"
          >
            Reconnect
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-xs h-7 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive whitespace-nowrap"
            title="Disconnect and delete this Instagram account"
          >
            Disconnect
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`text-xs px-3 py-1.5 rounded border ${
            actionMessage.startsWith("✓")
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          {actionMessage}
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isConnectedNotice = searchParams.get("connected") === "true";
  const errorMessage = searchParams.get("error");
  const [accountToDelete, setAccountToDelete] =
    useState<AccountMetadata | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => deleteAccount(accountId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setAccountToDelete(null);
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
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
          <div className="p-3.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center justify-between">
            <span>
              ✓ Instagram account connected successfully! Webhooks subscribed
              and 60-day token sealed at rest.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            Failed to connect Instagram account ({errorMessage}). Please verify
            Meta app settings and try again.
          </div>
        )}

        {/* Account List */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Connected Accounts
          </h2>

          {accountsQuery.isPending ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card rounded border border-border">
              Loading connected accounts…
            </div>
          ) : accountsQuery.isError ? (
            <div className="p-8 text-center text-sm text-destructive bg-destructive/10 rounded border border-destructive/20">
              Failed to load accounts. Please check your session.
            </div>
          ) : accountsQuery.data.accounts.length === 0 ? (
            <div className="p-12 text-center bg-card rounded border border-dashed border-border">
              <div className="w-10 h-10 rounded bg-foreground text-background font-bold flex items-center justify-center mx-auto mb-3 text-sm">
                IG
              </div>
              <h3 className="font-semibold text-base text-foreground">
                No Instagram Accounts Connected
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-5">
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
            <div className="flex flex-col gap-3">
              {accountsQuery.data.accounts.map((acc) => (
                <AccountItem
                  key={acc.account_id}
                  acc={acc}
                  onReconnect={() => connectMutation.mutate()}
                  onDelete={() => setAccountToDelete(acc)}
                  isConnecting={connectMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* Meta Webhook Requirement Guide */}
        <div className="p-4 rounded-lg bg-card border border-border space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">ℹ️</span>
            <h3 className="font-semibold text-sm text-foreground">
              Meta Webhook Configuration Requirement
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            For Meta to deliver comment and messaging events in real-time, Meta
            requires two separate levels of subscription:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-muted/40 border border-border/60 space-y-1">
              <span className="font-medium text-foreground">
                1. Account Subscription
              </span>
              <p className="text-muted-foreground">
                Subscribes your Instagram Account via Meta Graph API (
                <code className="px-1 py-0.5 bg-muted rounded">
                  subscribed_apps
                </code>
                ). FadeLoop automatically triggers this during connection, or
                you can click <strong>⚡ Sync Webhooks</strong> above.
              </p>
            </div>
            <div className="p-3 rounded bg-muted/40 border border-border/60 space-y-1">
              <span className="font-medium text-foreground">
                2. Meta App Dashboard
              </span>
              <p className="text-muted-foreground">
                In your Meta App Dashboard under{" "}
                <em>Webhooks &rarr; Instagram</em>, verify that your Callback
                URL is configured and both{" "}
                <code className="px-1 py-0.5 bg-muted rounded">comments</code>{" "}
                and{" "}
                <code className="px-1 py-0.5 bg-muted rounded">messages</code>{" "}
                fields are subscribed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Account Modal */}
      <ConfirmDialog
        isOpen={accountToDelete !== null}
        title={
          accountToDelete?.username
            ? `Disconnect @${accountToDelete.username}?`
            : `Disconnect Account ${accountToDelete?.account_id}?`
        }
        description="Are you sure you want to disconnect this Instagram account? All active campaigns, webhook triggers, and automated reply settings for this account will be permanently removed. This action cannot be undone."
        confirmText="Disconnect Account"
        cancelText="Keep Connected"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (accountToDelete) {
            deleteMutation.mutate(accountToDelete.account_id);
          }
        }}
        onCancel={() => setAccountToDelete(null)}
      />
    </DashboardLayout>
  );
}
