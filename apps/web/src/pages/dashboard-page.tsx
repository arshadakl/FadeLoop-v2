import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchAccounts } from "../api/accounts";
import { fetchCampaigns, fetchDeliveries } from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";

function StatCard({
  title,
  value,
  sub,
  badge,
  icon,
}: {
  title: string;
  value: string | number;
  sub?: string | undefined;
  badge?:
    | { text: string; variant?: "success" | "neutral" | "warning" }
    | undefined;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-2xs hover:border-muted-foreground/30 transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          {title}
        </span>
        <div className="w-8 h-8 rounded-lg bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold font-heading tabular-nums text-foreground tracking-tight">
            {value}
          </p>
          {badge && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                badge.variant === "success"
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : badge.variant === "warning"
                    ? "bg-warning/15 text-warning border border-warning/25"
                    : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0 animate-pulse">
      <div className="w-2 h-2 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-muted rounded-full w-32" />
        <div className="h-2.5 bg-muted rounded-full w-20" />
      </div>
      <div className="h-5 w-14 bg-muted rounded-full" />
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
        <h1 className="text-2xl font-bold font-heading text-foreground tracking-tight">
          Overview
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Instagram direct message & comment automation performance
        </p>
      </div>

      {/* KPI stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Replies Sent"
          value={isLoading ? "—" : totalSent}
          sub={
            successRate !== null
              ? `${successRate}% delivery rate`
              : "Ready for events"
          }
          badge={
            successRate !== null
              ? { text: `${successRate}%`, variant: "success" }
              : undefined
          }
          icon={
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Replies Sent</title>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          }
        />
        <StatCard
          title="Active Automations"
          value={isLoading ? "—" : activeCampaigns}
          sub={
            campaigns.length > 0
              ? `${campaigns.length} total campaigns`
              : "No campaigns"
          }
          badge={
            activeCampaigns > 0
              ? { text: `${activeCampaigns} active`, variant: "success" }
              : undefined
          }
          icon={
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Active Automations</title>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />
        <StatCard
          title="Connected Accounts"
          value={isLoading ? "—" : connectedAccounts}
          sub={
            connectedAccounts > 0
              ? "Meta Graph connected"
              : "Connect an account"
          }
          icon={
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Connected Accounts</title>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          title="Delivery Health"
          value={isLoading ? "—" : totalFailed === 0 ? "Optimal" : totalFailed}
          sub={
            totalFailed > 0
              ? `${totalFailed} failed events logged`
              : "Zero failure rate"
          }
          badge={
            totalFailed > 0
              ? { text: "Review logs", variant: "warning" }
              : { text: "100% Ok", variant: "success" }
          }
          icon={
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Delivery Health</title>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />
      </div>

      {/* Content grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Campaign performance */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold font-heading text-foreground text-sm">
                Campaign Performance
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sorted by automated replies sent
              </p>
            </div>
            <Link
              to="/campaigns"
              className="text-xs text-primary hover:underline font-semibold transition-colors"
            >
              Manage all →
            </Link>
          </div>

          <div className="divide-y divide-border">
            {campaignsQuery.isPending ? (
              <div className="px-5 py-2">
                {["skel-c1", "skel-c2", "skel-c3", "skel-c4"].map((k) => (
                  <SkeletonRow key={k} />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No campaigns yet.{" "}
                  <Link
                    to="/campaigns"
                    className="text-primary hover:underline font-medium"
                  >
                    Create one →
                  </Link>
                </p>
              </div>
            ) : (
              topCampaigns.map(({ campaign, revision, sentCount }, i) => (
                <div
                  key={campaign.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {revision.matchMode === "any_comment"
                          ? "Any comment"
                          : revision.keywords.length > 0
                            ? revision.keywords.slice(0, 3).join(", ")
                            : `Campaign ${i + 1}`}
                      </span>
                      {sentCount > 0 && i === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-semibold shrink-0">
                          Top
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${campaign.status === "published" ? "bg-primary" : "bg-muted-foreground"}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {campaign.status === "published" ? "Active" : "Paused"}{" "}
                        · {new Date(campaign.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold font-heading text-foreground tabular-nums leading-none">
                      {sentCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      sent
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold font-heading text-foreground text-sm">
                Recent Activity
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Latest delivery events
              </p>
            </div>
            <Link
              to="/deliveries"
              className="text-xs text-primary hover:underline font-semibold transition-colors"
            >
              All logs →
            </Link>
          </div>

          <div className="divide-y divide-border">
            {deliveriesQuery.isPending ? (
              <div className="px-5 py-2">
                {["skel-d1", "skel-d2", "skel-d3", "skel-d4", "skel-d5"].map(
                  (k) => (
                    <SkeletonRow key={k} />
                  ),
                )}
              </div>
            ) : recentDeliveries.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No activity yet. Active campaigns log here.
                </p>
              </div>
            ) : (
              recentDeliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      d.status === "sent"
                        ? "bg-primary"
                        : d.status === "failed"
                          ? "bg-destructive"
                          : "bg-warning"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
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
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0 ${
                      d.status === "sent"
                        ? "bg-primary/15 text-primary border border-primary/25"
                        : d.status === "failed"
                          ? "bg-destructive/15 text-destructive border border-destructive/25"
                          : "bg-warning/15 text-warning border border-warning/25"
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
