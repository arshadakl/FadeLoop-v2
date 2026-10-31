import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAccountMedia, fetchAccounts } from "../api/accounts";
import {
  createCampaign,
  fetchCampaigns,
  toggleCampaignStatus,
} from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Button } from "../components/ui/button";

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [isManualMediaInput, setIsManualMediaInput] = useState(false);
  const [matchMode, setMatchMode] = useState<"exact_keyword" | "any_comment">(
    "exact_keyword",
  );
  const [keywordsText, setKeywordsText] = useState("");
  const [replyTemplate, setReplyTemplate] = useState(
    "Hey! Thanks for commenting. Here is the link you requested:",
  );
  const [resourceUrl, setResourceUrl] = useState(
    "https://example.com/guide.pdf",
  );

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: ({ signal }) => fetchAccounts(signal),
  });

  const mediaQuery = useQuery({
    queryKey: ["account-media", selectedAccountId],
    queryFn: ({ signal }) => fetchAccountMedia(selectedAccountId, signal),
    enabled: Boolean(selectedAccountId),
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: ({ signal }) => fetchCampaigns(undefined, signal),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const keywords =
        matchMode === "exact_keyword"
          ? keywordsText
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : [];
      return createCampaign({
        accountId: selectedAccountId,
        mediaId: mediaId.trim(),
        status: "published",
        matchMode,
        keywords,
        replyTemplate: replyTemplate.trim(),
        resourceUrl: resourceUrl.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setIsEditorOpen(false);
      setFormError(null);
      setMediaId("");
      setKeywordsText("");
    },
    onError: (err: Error) => {
      setFormError(err.message || "Failed to create campaign");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({
      campaignId,
      status,
    }: {
      campaignId: string;
      status: "published" | "paused";
    }) => toggleCampaignStatus(campaignId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const accounts = accountsQuery.data?.accounts || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Automation Campaigns
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure keyword triggers for Instagram posts and reels to
              deliver instant private replies.
            </p>
          </div>

          <Button
            onClick={() => {
              const first = accounts[0];
              if (first && !selectedAccountId) {
                setSelectedAccountId(first.account_id);
              }
              setIsEditorOpen(true);
            }}
            className="bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            + New Campaign
          </Button>
        </div>

        {/* Campaign Creation Drawer / Modal */}
        {isEditorOpen && (
          <div className="p-6 glass-panel rounded-2xl border border-primary/30 space-y-6 glow-primary">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Create New Automation Campaign
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Private replies will only be delivered to eligible comments on
                  this post/reel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-muted-foreground hover:text-white text-sm px-2 py-1"
              >
                ✕ Cancel
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Form Controls */}
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="select-account"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Target Instagram Account
                  </label>
                  <select
                    id="select-account"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  >
                    {accounts.length === 0 ? (
                      <option value="">No accounts connected</option>
                    ) : (
                      accounts.map((a) => (
                        <option key={a.account_id} value={a.account_id}>
                          Account ID: {a.account_id} ({a.status})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="input-media-id"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Select Instagram Post or Reel
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualMediaInput(!isManualMediaInput)}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      {isManualMediaInput
                        ? "← Select from Posts/Reels"
                        : "Enter Media ID manually"}
                    </button>
                  </div>

                  {!isManualMediaInput ? (
                    <div className="space-y-2">
                      {mediaQuery.isLoading ? (
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-border/60 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Loading recent Posts and Reels...
                        </div>
                      ) : mediaQuery.isError ? (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                          Could not fetch media list. You can enter the Media ID
                          manually.
                        </div>
                      ) : (mediaQuery.data?.media.length || 0) === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-border/60 text-center text-xs text-muted-foreground">
                          No posts or reels found on this account.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-2 rounded-xl bg-slate-950/60 border border-border/80">
                          {mediaQuery.data?.media.map((item) => {
                            const isSelected = mediaId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setMediaId(item.id)}
                                className={`group relative text-left rounded-lg overflow-hidden border transition-all p-1.5 flex flex-col gap-1.5 ${
                                  isSelected
                                    ? "border-primary bg-primary/10 ring-2 ring-primary/50 shadow-md shadow-primary/20"
                                    : "border-border/60 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900"
                                }`}
                              >
                                <div className="relative aspect-square w-full rounded-md overflow-hidden bg-slate-800">
                                  {item.thumbnail_url ? (
                                    <img
                                      src={item.thumbnail_url}
                                      alt={item.caption || "Instagram media"}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                      No preview
                                    </div>
                                  )}
                                  {item.media_type === "VIDEO" && (
                                    <span className="absolute top-1 right-1 bg-black/80 backdrop-blur-sm text-[10px] font-semibold text-white px-1.5 py-0.5 rounded shadow">
                                      ▶ Reel
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="absolute bottom-1 left-1 bg-primary text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded shadow">
                                      ✓ Selected
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug px-0.5">
                                  {item.caption || `Media ID: ${item.id}`}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {mediaId && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                          <span>
                            Selected ID:{" "}
                            <span className="text-white font-mono">
                              {mediaId}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setMediaId("")}
                            className="text-rose-400 hover:underline text-[11px]"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        id="input-media-id"
                        type="text"
                        placeholder="e.g. 18012345678901234"
                        value={mediaId}
                        onChange={(e) => setMediaId(e.target.value)}
                        className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Meta enforces strictly ONE published campaign per
                        post/reel.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-300 mb-1.5">
                    Match Mode
                  </span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        checked={matchMode === "exact_keyword"}
                        onChange={() => setMatchMode("exact_keyword")}
                      />
                      Exact Keywords
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        checked={matchMode === "any_comment"}
                        onChange={() => setMatchMode("any_comment")}
                      />
                      Any Comment
                    </label>
                  </div>
                </div>

                {matchMode === "exact_keyword" && (
                  <div>
                    <label
                      htmlFor="input-keywords"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Trigger Keywords (comma separated)
                    </label>
                    <input
                      id="input-keywords"
                      type="text"
                      placeholder="e.g. guide, link, send, info"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                      className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="input-reply-template"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Private Reply Template
                  </label>
                  <textarea
                    id="input-reply-template"
                    rows={3}
                    value={replyTemplate}
                    onChange={(e) => setReplyTemplate(e.target.value)}
                    className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-resource-url"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Resource / Action URL (optional)
                  </label>
                  <input
                    id="input-resource-url"
                    type="url"
                    placeholder="https://yourbrand.com/resource"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={
                      createMutation.isPending ||
                      !selectedAccountId ||
                      !mediaId.trim() ||
                      !replyTemplate.trim()
                    }
                    className="w-full bg-primary hover:bg-primary-hover text-white"
                  >
                    {createMutation.isPending
                      ? "Publishing Campaign…"
                      : "Publish Campaign"}
                  </Button>
                </div>
              </div>

              {/* Live Preview Simulator */}
              <div className="flex flex-col justify-center items-center p-6 bg-slate-950/60 rounded-xl border border-border/80">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">
                  Instagram Direct Reply Preview
                </span>

                <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-border p-4 shadow-xl space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                      IG
                    </div>
                    <span className="text-xs font-semibold text-white">
                      Your Instagram Account
                    </span>
                  </div>

                  <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl p-3 text-xs text-slate-200 leading-relaxed">
                    <p>
                      {replyTemplate ||
                        "Your message preview will appear here…"}
                    </p>
                    {resourceUrl && (
                      <p className="mt-2 text-indigo-400 underline break-all">
                        {resourceUrl}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground block text-right">
                    Delivered instantly · Just now
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Existing Campaigns List */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-200">
            Active & Paused Campaigns
          </h2>

          {campaignsQuery.isPending ? (
            <div className="p-8 text-center text-sm text-muted-foreground glass-card rounded-xl">
              Loading campaigns…
            </div>
          ) : campaignsQuery.isError ? (
            <div className="p-8 text-center text-sm text-rose-400 glass-card rounded-xl">
              Failed to load campaigns.
            </div>
          ) : campaignsQuery.data.campaigns.length === 0 ? (
            <div className="p-12 text-center glass-card rounded-xl border border-dashed border-border/80">
              <h3 className="font-semibold text-lg text-white">
                No Campaigns Configured
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2 mb-6">
                Create your first campaign to begin automatically delivering
                links and replies to commenters.
              </p>
              <Button
                onClick={() => setIsEditorOpen(true)}
                className="bg-primary hover:bg-primary-hover text-white"
              >
                + Create Campaign
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaignsQuery.data.campaigns.map(({ campaign, revision }) => (
                <div
                  key={campaign.id}
                  className="p-5 glass-card rounded-xl flex flex-col justify-between border border-border space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">
                        Post ID: {campaign.mediaId}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          campaign.status === "published"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-500/15 text-slate-400 border border-slate-500/20"
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-300">
                        Trigger:{" "}
                      </span>
                      {revision.matchMode === "any_comment" ? (
                        <span className="text-xs text-indigo-400 font-medium">
                          Any comment
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {revision.keywords.map((k) => (
                            <span
                              key={k}
                              className="text-[11px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-border"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-lg border border-border/50 text-xs text-slate-300">
                      <p className="line-clamp-3">{revision.replyTemplate}</p>
                      {revision.resourceUrl && (
                        <p className="text-primary text-[11px] mt-1 truncate">
                          {revision.resourceUrl}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Updated{" "}
                      {new Date(campaign.updatedAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          campaignId: campaign.id,
                          status:
                            campaign.status === "published"
                              ? "paused"
                              : "published",
                        })
                      }
                      disabled={toggleStatusMutation.isPending}
                      className="text-xs h-7 px-2.5"
                    >
                      {campaign.status === "published" ? "Pause" : "Publish"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
