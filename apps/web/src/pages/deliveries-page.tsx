import { useQuery } from "@tanstack/react-query";
import { fetchDeliveries } from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";

export default function DeliveriesPage() {
  const deliveriesQuery = useQuery({
    queryKey: ["deliveries"],
    queryFn: ({ signal }) => fetchDeliveries(undefined, signal),
    refetchInterval: 10_000, // Poll every 10s for new comment delivery activity
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Delivery Audit & Activity
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time audit log of automated private replies to Instagram
              comments.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void deliveriesQuery.refetch()}
            disabled={deliveriesQuery.isFetching}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs text-slate-300 hover:text-white hover:bg-muted/50 transition-colors flex items-center gap-1.5 self-start"
          >
            <span>↻</span>
            <span>
              {deliveriesQuery.isFetching ? "Refreshing…" : "Refresh Activity"}
            </span>
          </button>
        </div>

        {/* Audit Log Table */}
        <div className="glass-panel rounded-2xl border border-border overflow-hidden">
          {deliveriesQuery.isPending ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading delivery activity…
            </div>
          ) : deliveriesQuery.isError ? (
            <div className="p-12 text-center text-sm text-rose-400">
              Failed to load delivery logs.
            </div>
          ) : deliveriesQuery.data.deliveries.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/40 text-muted-foreground flex items-center justify-center mx-auto mb-3 text-lg">
                📋
              </div>
              <h3 className="font-semibold text-white">
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
                  <tr className="border-b border-border/80 bg-slate-900/40 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Comment & Account</th>
                    <th className="py-3 px-4">Provider Message ID</th>
                    <th className="py-3 px-4">Attempts</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-slate-300">
                  {deliveriesQuery.data.deliveries.map((d) => {
                    const statusBadgeClass =
                      d.status === "sent"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : d.status === "retryable"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                          : d.status === "failed"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
                            : "bg-slate-500/15 text-slate-400 border-slate-500/25";

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-slate-900/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border text-[11px] ${statusBadgeClass}`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <div className="text-white">{d.action_key}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Account: {d.account_id}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          {d.provider_message_id ? (
                            <span className="text-indigo-400">
                              {d.provider_message_id}
                            </span>
                          ) : d.error_code ? (
                            <span className="text-rose-400 font-semibold">
                              {d.error_code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">{d.attempt_count}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">
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
