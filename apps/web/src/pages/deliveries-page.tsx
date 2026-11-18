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
  const totalRetryable = deliveries.filter((d) => d.status === "retryable").length;
  const successRate =
    totalSent + totalFailed > 0
      ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
      : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Delivery Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time audit of automated private replies
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void deliveriesQuery.refetch()}
            disabled={deliveriesQuery.isFetching}
            className="flex items-center gap-1.5 self-start rounded-xl text-xs"
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

        {/* Stat tiles */}
        {!deliveriesQuery.isPending && deliveries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Sent",
                value: totalSent,
                dot: "bg-success",
              },
              {
                label: "Failed",
                value: totalFailed,
                dot: "bg-destructive",
              },
              {
                label: "Retrying",
                value: totalRetryable,
                dot: "bg-warning",
              },
              {
                label: "Success rate",
                value: successRate !== null ? `${successRate}%` : "—",
                dot: "bg-primary",
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="bg-card border border-border rounded-2xl px-5 py-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${tile.dot}`} />
                  <p className="text-xs text-muted-foreground font-medium">{tile.label}</p>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{tile.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Audit Log Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
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
              <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              </div>
              <h3 className="font-semibold text-base text-foreground">No deliveries yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1.5">
                When users comment on published campaigns, automated replies appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3.5 px-5 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="py-3.5 px-5 text-xs font-semibold text-muted-foreground">Recipient</th>
                    <th className="py-3.5 px-5 text-xs font-semibold text-muted-foreground">Provider ID</th>
                    <th className="py-3.5 px-5 text-xs font-semibold text-muted-foreground">Attempts</th>
                    <th className="py-3.5 px-5 text-xs font-semibold text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {deliveries.map((d) => {
                    const statusClass =
                      d.status === "sent"
                        ? "bg-success/10 text-success"
                        : d.status === "retryable"
                          ? "bg-warning/10 text-warning"
                          : d.status === "failed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground";

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full font-semibold text-[11px] ${statusClass}`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          {d.recipient_username ? (
                            <a
                              href={`https://instagram.com/${d.recipient_username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                              @{d.recipient_username}
                              <span className="text-[10px] text-muted-foreground">↗</span>
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
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            {d.account_id.slice(0, 10)}…
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[11px]">
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
                        <td className="py-3.5 px-5 text-muted-foreground tabular-nums">
                          {d.attempt_count}
                        </td>
                        <td className="py-3.5 px-5 text-muted-foreground">
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
