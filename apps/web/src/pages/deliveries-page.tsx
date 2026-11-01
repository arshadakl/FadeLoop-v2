import { useQuery } from "@tanstack/react-query";
import { fetchDeliveries } from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Button } from "../components/ui/button";

export default function DeliveriesPage() {
  const deliveriesQuery = useQuery({
    queryKey: ["deliveries"],
    queryFn: ({ signal }) => fetchDeliveries(undefined, signal),
    refetchInterval: 10_000, // Poll every 10s for new comment delivery activity
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Delivery Audit & Activity
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
            <span>↻</span>
            <span>
              {deliveriesQuery.isFetching ? "Refreshing…" : "Refresh Activity"}
            </span>
          </Button>
        </div>

        {/* Audit Log Table */}
        <div className="bg-card rounded border border-border overflow-hidden shadow-2xs">
          {deliveriesQuery.isPending ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading delivery activity…
            </div>
          ) : deliveriesQuery.isError ? (
            <div className="p-12 text-center text-sm text-destructive">
              Failed to load delivery logs.
            </div>
          ) : deliveriesQuery.data.deliveries.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-10 h-10 rounded bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3 text-base">
                📋
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
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Action / Recipient Key</th>
                    <th className="py-2.5 px-4">Provider Message ID</th>
                    <th className="py-2.5 px-4">Attempts</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {deliveriesQuery.data.deliveries.map((d) => {
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
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <div className="text-foreground font-semibold">
                            {d.action_key}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Account: {d.account_id}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {d.provider_message_id ? (
                            <span className="text-primary font-medium">
                              {d.provider_message_id}
                            </span>
                          ) : d.error_code ? (
                            <span className="text-destructive font-semibold">
                              {d.error_code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {d.attempt_count}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(d.occurred_at).toLocaleString()}
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
