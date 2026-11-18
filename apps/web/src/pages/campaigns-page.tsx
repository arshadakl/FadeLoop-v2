import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAccountMedia, fetchAccounts } from "../api/accounts";
import {
  createCampaign,
  fetchCampaigns,
  fetchDeliveries,
} from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Button } from "../components/ui/button";

interface CampaignRowProps {
  campaign: {
    id: string;
    accountId: string;
    mediaId: string;
    status: "published" | "paused";
    createdAt: number | string;
    updatedAt: number | string;
  };
  revision: {
    matchMode: "exact_keyword" | "any_comment";
    keywords: string[];
    replyTemplate: string;
    resourceUrl?: string | null;
    confirmationButtonEnabled?: boolean;
    confirmationButtonText?: string | null;
    confirmationPromptText?: string | null;
    commentReplyText?: string | null;
  };
  sentCount: number;
  onEdit: () => void;
}

function CampaignRow({
  campaign,
  revision,
  sentCount,
  onEdit,
}: CampaignRowProps) {
  const mediaQuery = useQuery({
    queryKey: ["account-media", campaign.accountId],
    queryFn: ({ signal }) => fetchAccountMedia(campaign.accountId, signal),
    staleTime: 5 * 60 * 1000,
  });

  const item = mediaQuery.data?.media.find((m) => m.id === campaign.mediaId);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors">
      {/* Left: Thumbnail & Media Information */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
          {item?.thumbnail_url || item?.media_url ? (
            <img
              src={item.thumbnail_url || item.media_url}
              alt={item.caption || "Post thumbnail"}
              className="w-full h-full object-cover"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-muted-foreground bg-muted/60">
              Media
            </div>
          )}
          {item?.media_type === "VIDEO" && (
            <span className="absolute bottom-0.5 right-0.5 bg-black/85 text-[8px] font-bold text-white px-1 rounded">
              Reel
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate max-w-md">
              {item?.caption || `Media ID: ${campaign.mediaId}`}
            </p>
            {item?.permalink && (
              <a
                href={item.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground text-xs shrink-0 transition-colors"
                title="View on Instagram"
              >
                ↗
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-[11px] text-muted-foreground">
              ID: {campaign.mediaId.slice(0, 10)}…
            </span>
            <span className="text-muted-foreground/30">•</span>

            {revision.matchMode === "any_comment" ? (
              <span className="text-[11px] font-semibold text-primary bg-primary/15 border border-primary/25 px-2 py-0.5 rounded-full">
                Any comment
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full border border-border truncate max-w-[240px]">
                Trigger:{" "}
                <strong className="text-foreground font-semibold">
                  {revision.keywords.slice(0, 3).join(", ")}
                </strong>
                {revision.keywords.length > 3
                  ? ` +${revision.keywords.length - 3}`
                  : ""}
              </span>
            )}

            {revision.confirmationButtonEnabled && (
              <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                2-step: {revision.confirmationButtonText || "Send Me"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Status badge, sent metric & Edit button */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
        <div className="flex items-center gap-2.5">
          {sentCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 bg-muted text-foreground rounded-full border border-border tabular-nums">
              {sentCount} sent
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              campaign.status === "published"
                ? "bg-primary/15 text-primary border border-primary/25"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                campaign.status === "published"
                  ? "bg-primary"
                  : "bg-muted-foreground"
              }`}
            />
            {campaign.status === "published" ? "Published" : "Paused"}
          </span>

          <span className="text-[11px] font-mono text-muted-foreground hidden lg:inline-block">
            {new Date(campaign.updatedAt).toLocaleDateString()}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="text-xs font-semibold h-8 px-3 rounded-lg hover:border-primary hover:text-primary transition-colors"
        >
          Edit
        </Button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 8;

export default function CampaignsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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
  const [commentReplyText, setCommentReplyText] = useState(
    "Sent to your DM! Check your inbox 📩",
  );

  // 2-Step interactive confirmation button ("Send Me") flow - ALWAYS default true
  const [confirmationButtonEnabled, setConfirmationButtonEnabled] =
    useState(true);
  const [confirmationButtonText, setConfirmationButtonText] =
    useState("Send Me");
  const [confirmationPromptText, setConfirmationPromptText] = useState(
    "Tap below to receive your link 👇",
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

  const deliveriesQuery = useQuery({
    queryKey: ["deliveries"],
    queryFn: ({ signal }) => fetchDeliveries(undefined, signal),
    staleTime: 60_000,
  });

  const campaignSentCounts = (deliveriesQuery.data?.deliveries ?? []).reduce<
    Record<string, number>
  >((acc, d) => {
    if (d.campaign_id && d.status === "sent") {
      acc[d.campaign_id] = (acc[d.campaign_id] || 0) + 1;
    }
    return acc;
  }, {});

  const selectedMedia = mediaQuery.data?.media.find((m) => m.id === mediaId);

  const accounts = accountsQuery.data?.accounts || [];

  // Automatically select the first connected account when accounts list arrives
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0 && accounts[0]) {
      setSelectedAccountId(accounts[0].account_id);
    }
  }, [accounts, selectedAccountId]);

  // Sort campaigns latest first (by updatedAt descending)
  const sortedCampaigns = [...(campaignsQuery.data?.campaigns ?? [])].sort(
    (a, b) =>
      new Date(b.campaign.updatedAt).getTime() -
      new Date(a.campaign.updatedAt).getTime(),
  );

  const totalCampaigns = sortedCampaigns.length;
  const totalPages = Math.ceil(totalCampaigns / PAGE_SIZE) || 1;
  const paginatedCampaigns = sortedCampaigns.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleOpenCreate = () => {
    setFormError(null);
    const first = accounts[0];
    if (first && !selectedAccountId) {
      setSelectedAccountId(first.account_id);
    }
    setMediaId("");
    setIsManualMediaInput(false);
    setMatchMode("exact_keyword");
    setKeywordsText("");
    setReplyTemplate(
      "Hey! Thanks for commenting. Here is the link you requested:",
    );
    setResourceUrl("https://example.com/guide.pdf");
    setCommentReplyText("Sent to your DM! Check your inbox 📩");
    setConfirmationButtonEnabled(true);
    setConfirmationButtonText("Send Me");
    setConfirmationPromptText("Tap below to receive your link 👇");
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setFormError(null);
  };

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
        confirmationButtonEnabled,
        confirmationButtonText:
          confirmationButtonText.trim().slice(0, 20) || "Send Me",
        confirmationPromptText: confirmationPromptText.trim() || undefined,
        commentReplyText: commentReplyText.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      handleCloseEditor();
    },
    onError: (err: Error) => {
      setFormError(err.message || "Failed to create campaign");
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">
              Automation Campaigns
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Deliver instant private links and comment replies to Instagram
              commenters.
            </p>
          </div>

          <Button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New Automation</span>
          </Button>
        </div>

        {/* Campaign Creation Drawer / Modal */}
        {isEditorOpen && (
          <div className="p-6 bg-card rounded-xl border border-border shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-semibold font-heading text-foreground">
                  Create New Automation Campaign
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Private replies will only be delivered to eligible comments on
                  this post/reel.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditor}
                className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-muted transition-colors"
              >
                ✕ Cancel
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {formError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Form Controls */}
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="select-account"
                    className="block text-xs font-semibold text-muted-foreground mb-1.5"
                  >
                    Connected Instagram account
                  </label>
                  <select
                    id="select-account"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
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
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Target post or reel
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualMediaInput(!isManualMediaInput)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {isManualMediaInput
                        ? "Select from media"
                        : "Enter media ID manually"}
                    </button>
                  </div>

                  {!isManualMediaInput ? (
                    <div className="space-y-2">
                      {mediaQuery.isLoading ? (
                        <div className="p-4 rounded-lg border border-border bg-background text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Loading recent Instagram posts…
                        </div>
                      ) : mediaQuery.isError ? (
                        <div className="p-3 rounded-lg border border-border bg-background text-xs text-muted-foreground">
                          Could not fetch media list. You can enter the Media ID
                          manually.
                        </div>
                      ) : (mediaQuery.data?.media.length ?? 0) === 0 ? (
                        <div className="p-3 rounded-lg border border-border bg-background text-xs text-muted-foreground text-center">
                          No recent posts found for this account.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 border border-border rounded-lg bg-background">
                          {mediaQuery.data?.media.map((item) => {
                            const isSelected = mediaId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setMediaId(item.id)}
                                className={`group relative rounded-md border text-left overflow-hidden flex flex-col transition-colors p-1.5 ${
                                  isSelected
                                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                                    : "border-border bg-background hover:border-muted-foreground"
                                }`}
                              >
                                <div className="relative aspect-square w-full rounded overflow-hidden bg-muted mb-1.5">
                                  {item.thumbnail_url || item.media_url ? (
                                    <img
                                      src={item.thumbnail_url || item.media_url}
                                      alt={item.caption || "Instagram media"}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                                      Post
                                    </div>
                                  )}
                                  {item.media_type === "VIDEO" && (
                                    <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-bold text-white px-1 rounded">
                                      Reel
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] line-clamp-2 text-foreground font-medium leading-tight">
                                  {item.caption || `Post ${item.id}`}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedMedia && (
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border flex items-center justify-between">
                          <span className="truncate">
                            Selected:{" "}
                            <strong>
                              {selectedMedia.caption || selectedMedia.id}
                            </strong>
                          </span>
                          {selectedMedia.permalink && (
                            <a
                              href={selectedMedia.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-[11px] ml-2 shrink-0 font-medium"
                            >
                              View
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        id="input-media-id"
                        type="text"
                        placeholder="e.g. 17912345678901234"
                        value={mediaId}
                        onChange={(e) => setMediaId(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Find the Media ID via Meta Graph API or your Instagram
                        feed.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Trigger mode
                  </span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="createMatchMode"
                        checked={matchMode === "exact_keyword"}
                        onChange={() => setMatchMode("exact_keyword")}
                      />
                      <span>Exact Keywords</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="createMatchMode"
                        checked={matchMode === "any_comment"}
                        onChange={() => setMatchMode("any_comment")}
                      />
                      <span>Any Comment</span>
                    </label>
                  </div>
                </div>

                {matchMode === "exact_keyword" && (
                  <div>
                    <label
                      htmlFor="input-keywords"
                      className="block text-xs font-medium text-foreground mb-1.5"
                    >
                      Trigger Keywords (comma separated)
                    </label>
                    <input
                      id="input-keywords"
                      type="text"
                      placeholder="e.g. guide, link, send, price"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Case-insensitive match against incoming comments.
                    </p>
                  </div>
                )}

                {/* 2-Step Interactive Opt-in ("Send Me" button) */}
                <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmationButtonEnabled}
                      onChange={(e) =>
                        setConfirmationButtonEnabled(e.target.checked)
                      }
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                    />
                    <div>
                      <span className="block text-xs font-semibold text-foreground">
                        Enable 2-Step interactive "Send Me" button (Recommended)
                      </span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        Sends a quick reply button first. When tapped, Instagram
                        opens a 24-hour interaction window and delivers your
                        link without triggering Meta spam flags.
                      </span>
                    </div>
                  </label>

                  {confirmationButtonEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-primary/15">
                      <div>
                        <label
                          htmlFor="input-btn-text"
                          className="block text-[11px] font-medium text-foreground mb-1"
                        >
                          Button Text (max 20 chars)
                        </label>
                        <input
                          id="input-btn-text"
                          type="text"
                          maxLength={20}
                          value={confirmationButtonText}
                          onChange={(e) =>
                            setConfirmationButtonText(e.target.value)
                          }
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                          placeholder="Send Me"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="input-prompt-text"
                          className="block text-[11px] font-medium text-foreground mb-1"
                        >
                          Opening Prompt
                        </label>
                        <input
                          id="input-prompt-text"
                          type="text"
                          value={confirmationPromptText}
                          onChange={(e) =>
                            setConfirmationPromptText(e.target.value)
                          }
                          className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                          placeholder="Tap below to receive your link."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="input-reply-template"
                    className="block text-xs font-medium text-foreground mb-1.5"
                  >
                    Private Reply Message / Body
                  </label>
                  <textarea
                    id="input-reply-template"
                    rows={3}
                    value={replyTemplate}
                    onChange={(e) => setReplyTemplate(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-resource-url"
                    className="block text-xs font-medium text-foreground mb-1.5"
                  >
                    Target Link or Resource URL (optional)
                  </label>
                  <input
                    id="input-resource-url"
                    type="url"
                    placeholder="https://yourbrand.com/resource"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-comment-reply"
                    className="block text-xs font-medium text-foreground mb-1.5"
                  >
                    Public Comment Reply (Optional)
                  </label>
                  <input
                    id="input-comment-reply"
                    type="text"
                    placeholder="e.g. Sent to your DM, check your inbox."
                    value={commentReplyText}
                    onChange={(e) => setCommentReplyText(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Automatically posted as a public reply directly under the
                    user’s comment on Instagram.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={
                      createMutation.isPending ||
                      !selectedAccountId ||
                      !mediaId.trim() ||
                      !replyTemplate.trim() ||
                      (matchMode === "exact_keyword" && !keywordsText.trim())
                    }
                    className="w-full"
                  >
                    {createMutation.isPending
                      ? "Publishing Campaign…"
                      : "Publish Automation"}
                  </Button>
                </div>
              </div>

              {/* Live Preview Simulator */}
              <div className="flex flex-col justify-center items-center p-6 bg-muted/30 rounded-xl border border-border">
                <span className="text-xs font-semibold text-muted-foreground mb-4">
                  Direct message preview
                </span>

                <div className="w-full max-w-xs rounded-xl bg-background border border-border p-4 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                      ig
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      Your Connected Account
                    </span>
                  </div>

                  {confirmationButtonEnabled ? (
                    <div className="space-y-2">
                      <div className="bg-muted rounded-lg p-2.5 text-xs text-foreground">
                        <p>
                          {confirmationPromptText ||
                            "Tap below to receive your link."}
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <span className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-md shadow-xs">
                          {confirmationButtonText || "Send Me"}
                        </span>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 text-xs text-foreground mt-2">
                        <p>{replyTemplate}</p>
                        {resourceUrl && (
                          <p className="mt-1 font-medium underline break-all text-primary">
                            {resourceUrl}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 text-xs text-foreground">
                      <p>
                        {replyTemplate ||
                          "Your message preview will appear here…"}
                      </p>
                      {resourceUrl && (
                        <p className="mt-1 font-medium underline break-all text-primary">
                          {resourceUrl}
                        </p>
                      )}
                    </div>
                  )}

                  <span className="text-[10px] text-muted-foreground block text-right">
                    Delivered instantly · Just now
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns List (Row format, latest first, 8 per page pagination) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold font-heading text-foreground">
              Configured Automations ({totalCampaigns})
            </h2>
            {totalCampaigns > 0 && (
              <span className="text-xs text-muted-foreground">
                Showing {paginatedCampaigns.length} of {totalCampaigns}
              </span>
            )}
          </div>

          {campaignsQuery.isPending ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card rounded-xl border border-border">
              Loading campaigns…
            </div>
          ) : campaignsQuery.isError ? (
            <div className="p-8 text-center text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
              Failed to load campaigns.
            </div>
          ) : totalCampaigns === 0 ? (
            <div className="p-12 text-center bg-card rounded-xl border border-dashed border-border">
              <h3 className="font-semibold font-heading text-base text-foreground">
                No Automations Configured
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-5">
                Create your first campaign to begin automatically delivering
                links and replies to commenters.
              </p>
              <Button onClick={handleOpenCreate}>+ Create Campaign</Button>
            </div>
          ) : (
            <>
              {/* Row style list container */}
              <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden shadow-2xs">
                {paginatedCampaigns.map(({ campaign, revision }) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    revision={revision}
                    sentCount={campaignSentCounts[campaign.id] ?? 0}
                    onEdit={() => navigate(`/campaigns/${campaign.id}/edit`)}
                  />
                ))}
              </div>

              {/* Pagination controls when items > 8 */}
              {totalCampaigns > PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 px-1 text-xs text-muted-foreground">
                  <div>
                    Showing{" "}
                    <span className="font-semibold text-foreground">
                      {(currentPage - 1) * PAGE_SIZE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-foreground">
                      {Math.min(currentPage * PAGE_SIZE, totalCampaigns)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-foreground">
                      {totalCampaigns}
                    </span>{" "}
                    campaigns
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-3 text-xs"
                    >
                      Previous
                    </Button>
                    <span className="px-2 text-xs font-medium text-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="h-8 px-3 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
