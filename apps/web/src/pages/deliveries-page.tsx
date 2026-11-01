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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#EDEEEC]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Delivery Audit & Activity
            </h1>
            <p className="text-sm text-[#5D686A] mt-1">
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
        <div className="bg-white rounded border border-[#EDEEEC] overflow-hidden shadow-2xs">
          {deliveriesQuery.isPending ? (
            <div className="p-12 text-center text-sm text-[#5D686A]">
              Loading delivery activity…
            </div>
          ) : deliveriesQuery.isError ? (
            <div className="p-12 text-center text-sm text-[#B91C1C]">
              Failed to load delivery logs.
            </div>
          ) : deliveriesQuery.data.deliveries.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-10 h-10 rounded bg-[#F0F0EF] text-[#5D686A] flex items-center justify-center mx-auto mb-3 text-base">
                📋
              </div>
              <h3 className="font-semibold text-base text-[#212121]">
                No Deliveries Recorded Yet
              </h3>
              <p className="text-sm text-[#5D686A] max-w-sm mx-auto mt-1">
                When users comment matching keywords on your published
                campaigns, automated replies will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#EDEEEC] bg-[#F6F6F6] text-[#5D686A] font-medium">
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Action / Recipient Key</th>
                    <th className="py-2.5 px-4">Provider Message ID</th>
                    <th className="py-2.5 px-4">Attempts</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEEEC] text-[#212121]">
                  {deliveriesQuery.data.deliveries.map((d) => {
                    const statusBadgeClass =
                      d.status === "sent"
                        ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                        : d.status === "retryable"
                          ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                          : d.status === "failed"
                            ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                            : "bg-[#F0F0EF] text-[#5D686A] border-[#EDEEEC]";

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-[#F9F9F8] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded font-medium border text-[11px] ${statusBadgeClass}`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <div className="text-[#212121] font-semibold">
                            {d.action_key}
                          </div>
                          <div className="text-[10px] text-[#5D686A]">
                            Account: {d.account_id}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {d.provider_message_id ? (
                            <span className="text-[#0E3B57] font-medium">
                              {d.provider_message_id}
                            </span>
                          ) : d.error_code ? (
                            <span className="text-[#B91C1C] font-semibold">
                              {d.error_code}
                            </span>
                          ) : (
                            <span className="text-[#8E9596]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#5D686A]">
                          {d.attempt_count}
                        </td>
                        <td className="py-3 px-4 text-[#5D686A]">
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
