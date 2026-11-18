import { useQuery } from "@tanstack/react-query";
import { fetchDeliveries } from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Button } from "../components/ui/button";

export default function DeliveriesPage() {
  const deliveriesQuery = useQuery({
    queryKey: ["deliveries"],
    queryFn: ({ signal }) => fetchDeliveries(undefined, signal),
    refetchInterval: 10_000,
  });

  const deliveries = deliveriesQuery.data?.deliveries ?? [];
  const totalSent = deliveries.filter((d) => d.status === "sent").length;
  const totalFailed = deliveries.filter((d) => d.status === "failed").length;
  const totalRetryable = deliveries.filter(
    (d) => d.status === "retryable",
  ).length;
  const successRate =
    totalSent + totalFailed > 0
      ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
      : null;

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Delivery Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time audit log of automated private replies to Instagram
              comments.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void deliveriesQuery.refetch()}
            disabled={deliveriesQuery.isFetching}
            className="flex items-center gap-1.5 self-start text-xs"
          >
            <svg
              className={`w-3.5 h-3.5 ${deliveriesQuery.isFetching ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {deliveriesQuery.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {/* Aggregate stats */}
        {!deliveriesQuery.isPending && deliveries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="text-xl font-bold text-foreground tabular-nums">
                {totalSent}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Sent</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="text-xl font-bold text-foreground tabular-nums">
                {totalFailed}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Failed</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="text-xl font-bold text-foreground tabular-nums">
                {totalRetryable}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Retrying</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-3">
              <p className="text-xl font-bold text-foreground tabular-nums">
                {successRate !== null ? `${successRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Success rate
              </p>
            </div>
          </div>
        )}

        {/* Audit Log Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {deliveriesQuery.isPending ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading delivery activity…
            </div>
          ) : deliveriesQuery.isError ? (
            <div className="p-12 text-center text-sm text-destructive">
              Failed to load delivery logs.
            </div>
          ) : deliveries.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-10 h-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              </div>
              <h3 className="font-semibold text-base text-foreground">
                No Deliveries Recorded Yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                When users comment matching keywords on your published
                campaigns, automated replies will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Provider Msg ID</th>
                    <th className="py-3 px-4">Attempts</th>
                    <th className="py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {deliveries.map((d) => {
                    const statusBadgeClass =
                      d.status === "sent"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : d.status === "retryable"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : d.status === "failed"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-muted text-muted-foreground border-border";

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded font-medium border text-[11px] ${statusBadgeClass}`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {d.recipient_username ? (
                            <a
                              href={`https://instagram.com/${d.recipient_username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
                            >
                              @{d.recipient_username}
                              <span className="text-[10px] text-muted-foreground">
                                ↗
                              </span>
                            </a>
                          ) : (
                            <span
                              className="font-mono text-[11px] text-foreground truncate max-w-[180px] block"
                              title={d.action_key}
                            >
                              {d.action_key.length > 22
                                ? `${d.action_key.slice(0, 20)}…`
                                : d.action_key}
                            </span>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Acct: {d.account_id.slice(0, 10)}…
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {d.provider_message_id ? (
                            <span
                              className="text-primary font-medium cursor-help"
                              title={d.provider_message_id}
                            >
                              {d.provider_message_id.length > 14
                                ? `${d.provider_message_id.slice(0, 10)}…`
                                : d.provider_message_id}
                            </span>
                          ) : d.error_code ? (
                            <span
                              className="text-destructive font-semibold cursor-help"
                              title={d.error_code}
                            >
                              {d.error_code.length > 18
                                ? `${d.error_code.slice(0, 15)}…`
                                : d.error_code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground tabular-nums">
                          {d.attempt_count}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(d.occurred_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
