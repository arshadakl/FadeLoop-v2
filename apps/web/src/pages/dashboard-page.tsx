import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchAccounts } from "../api/accounts";
import { fetchCampaigns, fetchDeliveries } from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";

function StatCard({
  title,
  value,
  sub,
  accentClass,
  icon,
}: {
  title: string;
  value: string | number;
  sub?: string | undefined;
  accentClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-muted rounded w-32" />
        <div className="h-2.5 bg-muted rounded w-24" />
      </div>
      <div className="h-5 w-12 bg-muted rounded" />
    </div>
  );
}

export default function DashboardPage() {
  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: ({ signal }) => fetchCampaigns(undefined, signal),
  });
  const deliveriesQuery = useQuery({
    queryKey: ["deliveries"],
    queryFn: ({ signal }) => fetchDeliveries(undefined, signal),
    refetchInterval: 30_000,
  });
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: ({ signal }) => fetchAccounts(signal),
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const deliveries = deliveriesQuery.data?.deliveries ?? [];
  const accounts = accountsQuery.data?.accounts ?? [];

  const totalSent = deliveries.filter((d) => d.status === "sent").length;
  const totalFailed = deliveries.filter((d) => d.status === "failed").length;
  const activeCampaigns = campaigns.filter(
    (c) => c.campaign.status === "published",
  ).length;
  const connectedAccounts = accounts.length;
  const successRate =
    totalSent + totalFailed > 0
      ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
      : null;

  // Per-campaign sent delivery counts
  const campaignSentCounts = deliveries.reduce<Record<string, number>>(
    (acc, d) => {
      if (d.campaign_id && d.status === "sent") {
        acc[d.campaign_id] = (acc[d.campaign_id] || 0) + 1;
      }
      return acc;
    },
    {},
  );

  const topCampaigns = [...campaigns]
    .map((c) => ({
      ...c,
      sentCount: campaignSentCounts[c.campaign.id] ?? 0,
    }))
    .sort((a, b) => b.sentCount - a.sentCount)
    .slice(0, 6);

  const recentDeliveries = deliveries.slice(0, 7);

  const isLoading =
    campaignsQuery.isPending ||
    deliveriesQuery.isPending ||
    accountsQuery.isPending;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your Instagram automation performance
        </p>
      </div>

      {/* KPI stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Replies Sent"
          value={isLoading ? "—" : totalSent}
          sub={
            successRate !== null
              ? `${successRate}% success rate`
              : undefined
          }
          accentClass="bg-primary/10 text-primary"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          }
        />
        <StatCard
          title="Active Campaigns"
          value={isLoading ? "—" : activeCampaigns}
          sub={campaigns.length > 0 ? `${campaigns.length} total` : undefined}
          accentClass="bg-emerald-500/10 text-emerald-500"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />
        <StatCard
          title="Connected Accounts"
          value={isLoading ? "—" : connectedAccounts}
          accentClass="bg-blue-500/10 text-blue-500"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          title="Failed Deliveries"
          value={isLoading ? "—" : totalFailed}
          sub={totalFailed > 0 ? "Check deliveries log" : "No failures"}
          accentClass={
            totalFailed > 0
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-500"
          }
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          }
        />
      </div>

      {/* Content grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Campaign performance */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">
              Campaign Performance
            </h2>
            <Link
              to="/campaigns"
              className="text-xs text-primary hover:underline font-medium"
            >
              Manage →
            </Link>
          </div>

          <div className="divide-y divide-border">
            {campaignsQuery.isPending ? (
              <div className="px-5 py-2">
                {[...Array(4)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No campaigns yet.{" "}
                  <Link to="/campaigns" className="text-primary hover:underline">
                    Create one →
                  </Link>
                </p>
              </div>
            ) : (
              topCampaigns.map(({ campaign, revision, sentCount }, i) => (
                <div
                  key={campaign.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      campaign.status === "published"
                        ? "bg-emerald-500"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {revision.matchMode === "any_comment"
                          ? "Any comment"
                          : revision.keywords.length > 0
                            ? revision.keywords.slice(0, 3).join(", ")
                            : `Campaign ${i + 1}`}
                      </span>
                      {sentCount > 0 && i === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-semibold shrink-0">
                          Top
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {campaign.status === "published" ? "Active" : "Paused"} ·{" "}
                      {new Date(campaign.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {sentCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">sent</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">
              Recent Activity
            </h2>
            <Link
              to="/deliveries"
              className="text-xs text-primary hover:underline font-medium"
            >
              All logs →
            </Link>
          </div>

          <div className="divide-y divide-border">
            {deliveriesQuery.isPending ? (
              <div className="px-5 py-2">
                {[...Array(5)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            ) : recentDeliveries.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No activity yet. Active campaigns will log here.
                </p>
              </div>
            ) : (
              recentDeliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      d.status === "sent"
                        ? "bg-emerald-500"
                        : d.status === "failed"
                          ? "bg-destructive"
                          : "bg-warning"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {d.recipient_username
                        ? `@${d.recipient_username}`
                        : d.action_key.length > 20
                          ? `${d.action_key.slice(0, 18)}…`
                          : d.action_key}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(d.occurred_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-medium border shrink-0 ${
                      d.status === "sent"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : d.status === "failed"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-warning/10 text-warning border-warning/20"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
