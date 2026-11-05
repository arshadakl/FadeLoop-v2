import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchAccountMedia } from "../api/accounts";
import {
  deleteCampaign,
  fetchCampaignById,
  updateCampaign,
} from "../api/campaigns";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form states
  const [status, setStatus] = useState<"published" | "paused">("published");
  const [matchMode, setMatchMode] = useState<"exact_keyword" | "any_comment">(
    "exact_keyword",
  );
  const [keywordsText, setKeywordsText] = useState("");
  const [replyTemplate, setReplyTemplate] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [commentReplyText, setCommentReplyText] = useState("");

  // 2-Step interactive "Send Me" button flow (Default: enabled)
  const [confirmationButtonEnabled, setConfirmationButtonEnabled] =
    useState(true);
  const [confirmationButtonText, setConfirmationButtonText] =
    useState("Send Me");
  const [confirmationPromptText, setConfirmationPromptText] = useState(
    "Tap below to receive your link 👇",
  );

  const campaignQuery = useQuery({
    queryKey: ["campaign", id],
    queryFn: ({ signal }) => fetchCampaignById(id || "", signal),
    enabled: Boolean(id),
  });

  const accountId = campaignQuery.data?.campaign.accountId || "";
  const mediaId = campaignQuery.data?.campaign.mediaId || "";

  const mediaQuery = useQuery({
    queryKey: ["account-media", accountId],
    queryFn: ({ signal }) => fetchAccountMedia(accountId, signal),
    enabled: Boolean(accountId),
  });

  const matchedMedia = mediaQuery.data?.media.find((m) => m.id === mediaId);

  // Pre-populate form when campaign data arrives
  useEffect(() => {
    if (campaignQuery.data) {
      const { campaign, revision } = campaignQuery.data;
      setStatus(campaign.status);
      setMatchMode(revision.matchMode);
      setKeywordsText(revision.keywords ? revision.keywords.join(", ") : "");
      setReplyTemplate(revision.replyTemplate);
      setResourceUrl(revision.resourceUrl || "");
      setCommentReplyText(revision.commentReplyText || "");
      setConfirmationButtonEnabled(
        revision.confirmationButtonEnabled !== undefined
          ? Boolean(revision.confirmationButtonEnabled)
          : true,
      );
      setConfirmationButtonText(
        revision.confirmationButtonText?.trim() || "Send Me",
      );
      setConfirmationPromptText(
        revision.confirmationPromptText?.trim() ||
          "Tap below to receive your link 👇",
      );
    }
  }, [campaignQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing campaign ID");
      const keywords =
        matchMode === "exact_keyword"
          ? keywordsText
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : [];
      return updateCampaign(id, {
        status,
        matchMode,
        keywords,
        replyTemplate: replyTemplate.trim(),
        resourceUrl: resourceUrl.trim() || null,
        confirmationButtonEnabled,
        confirmationButtonText:
          confirmationButtonText.trim().slice(0, 20) || "Send Me",
        confirmationPromptText: confirmationPromptText.trim() || null,
        commentReplyText: commentReplyText.trim() || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      navigate("/campaigns");
    },
    onError: (err: Error) => {
      setFormError(err.message || "Failed to update campaign");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Missing campaign ID");
      return deleteCampaign(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      navigate("/campaigns");
    },
    onError: (err: Error) => {
      alert(err.message || "Failed to delete campaign");
      setConfirmDelete(false);
    },
  });

  if (campaignQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading campaign details…
        </div>
      </DashboardLayout>
    );
  }

  if (campaignQuery.isError || !campaignQuery.data) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to Campaigns
          </Link>
          <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded">
            Failed to load campaign. The campaign may have been deleted.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-8 font-sans">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            ← Back to Campaigns
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Edit Automation Campaign
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Update keyword triggers, private reply message, and interactive
              2-step button flow.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded font-medium ${
                status === "published"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              {status === "published" ? "● Active / Published" : "⏸ Paused"}
            </span>
          </div>
        </div>

        {/* Selected Post Preview Card (Prominent Header) */}
        <div className="p-4 rounded-md border border-border bg-card shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <span>🎯</span>
              <span>Target Post / Reel Preview</span>
            </span>
            {matchedMedia?.permalink && (
              <a
                href={matchedMedia.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-normal inline-flex items-center gap-1"
              >
                View on Instagram ↗
              </a>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-4 pt-1">
            {/* Thumbnail */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-md overflow-hidden bg-muted border border-border shrink-0">
              {matchedMedia?.thumbnail_url || matchedMedia?.media_url ? (
                <img
                  src={matchedMedia.thumbnail_url || matchedMedia.media_url}
                  alt={matchedMedia.caption || "Instagram media preview"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground p-2 text-center">
                  <span>📸</span>
                  <span className="text-[10px] mt-1">No thumbnail</span>
                </div>
              )}
              {matchedMedia?.media_type === "VIDEO" && (
                <span className="absolute bottom-1 right-1 bg-black/85 text-[10px] font-bold text-white px-1.5 py-0.5 rounded">
                  ▶ Reel
                </span>
              )}
            </div>

            {/* Media Information */}
            <div className="flex-1 space-y-2 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-3 leading-snug">
                {matchedMedia?.caption ||
                  "No caption provided on this Instagram media."}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono pt-1">
                <span>
                  Media ID:{" "}
                  <strong className="text-foreground">{mediaId}</strong>
                </span>
                <span>•</span>
                <span>
                  Account ID:{" "}
                  <strong className="text-foreground">{accountId}</strong>
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Note: The target post is locked for existing campaigns to
                preserve delivery deduplication and prevent duplicate automation
                conflicts.
              </p>
            </div>
          </div>
        </div>

        {formError && (
          <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            {formError}
          </div>
        )}

        {/* Main Editor Grid */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Form Controls */}
          <div className="space-y-5">
            {/* Status Control */}
            <div>
              <span className="block text-xs font-medium text-foreground mb-1.5">
                Campaign Status
              </span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === "published"}
                    onChange={() => setStatus("published")}
                  />
                  <span>Published (Active)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === "paused"}
                    onChange={() => setStatus("paused")}
                  />
                  <span>Paused</span>
                </label>
              </div>
            </div>

            {/* Match Mode */}
            <div>
              <span className="block text-xs font-medium text-foreground mb-1.5">
                Trigger Match Mode
              </span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="matchMode"
                    checked={matchMode === "exact_keyword"}
                    onChange={() => setMatchMode("exact_keyword")}
                  />
                  <span>Exact Keywords</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="radio"
                    name="matchMode"
                    checked={matchMode === "any_comment"}
                    onChange={() => setMatchMode("any_comment")}
                  />
                  <span>Any Comment</span>
                </label>
              </div>
            </div>

            {/* Keywords */}
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
                  className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Triggers if the user comments with any of these words
                  (case-insensitive).
                </p>
              </div>
            )}

            {/* 2-Step Interactive Opt-in ("Send Me" button) */}
            <div className="p-3.5 rounded border border-primary/20 bg-primary/5 dark:bg-primary/10 space-y-3">
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
                    Sends an interactive Quick Reply button first. When tapped,
                    Instagram opens a 24-hour interaction window and delivers
                    the link without triggering Meta link-spam flags.
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
                      className="w-full bg-card border border-border rounded px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
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
                      className="w-full bg-card border border-border rounded px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                      placeholder="Tap below to receive your link 👇"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Private Reply Text */}
            <div>
              <label
                htmlFor="input-reply-template"
                className="block text-xs font-medium text-foreground mb-1.5"
              >
                Private Reply Message / Body
              </label>
              <textarea
                id="input-reply-template"
                rows={4}
                value={replyTemplate}
                onChange={(e) => setReplyTemplate(e.target.value)}
                className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Resource URL */}
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
                className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Public Comment Reply */}
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
                placeholder="e.g. Sent to your DM! Check your inbox 📩"
                value={commentReplyText}
                onChange={(e) => setCommentReplyText(e.target.value)}
                className="w-full bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Automatically posted as a public reply directly under the user's
                comment on Instagram.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-3">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={
                  updateMutation.isPending ||
                  !replyTemplate.trim() ||
                  (matchMode === "exact_keyword" && !keywordsText.trim())
                }
                className="flex-1"
              >
                {updateMutation.isPending ? "Saving Changes…" : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/campaigns")}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Live Preview Simulator */}
          <div className="flex flex-col justify-center items-center p-6 bg-muted/40 rounded-md border border-border">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">
              Instagram Direct Message Simulation
            </span>

            <div className="w-full max-w-xs rounded-md bg-card border border-border p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <div className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
                  IG
                </div>
                <span className="text-xs font-semibold text-foreground">
                  Your Connected Account
                </span>
              </div>

              {confirmationButtonEnabled ? (
                <div className="space-y-2">
                  <div className="bg-muted rounded-md p-2.5 text-xs text-foreground">
                    <p>
                      {confirmationPromptText ||
                        "Tap below to receive your link 👇"}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <span className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded shadow-xs">
                      {confirmationButtonText || "Send Me"}
                    </span>
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded-md p-2.5 text-xs text-foreground mt-2">
                    <p>{replyTemplate}</p>
                    {resourceUrl && (
                      <p className="mt-1 font-medium underline break-all text-primary">
                        {resourceUrl}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-primary/10 border border-primary/30 rounded-md p-2.5 text-xs text-foreground">
                  <p>
                    {replyTemplate || "Your message preview will appear here…"}
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

        {/* Danger Zone: Delete Campaign */}
        <div className="pt-8 border-t border-border">
          <div className="p-4 rounded-md border border-destructive/20 bg-destructive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-destructive">
                Delete Campaign
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete this automation campaign and its delivery
                history. This action cannot be undone.
              </p>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              Delete Campaign
            </Button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmDialog
          isOpen={confirmDelete}
          title="Delete Campaign?"
          description="Are you sure you want to delete this campaign? Automated replies for this post will stop immediately and this cannot be undone."
          confirmText="Delete Campaign"
          cancelText="Cancel"
          isDestructive={true}
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      </div>
    </DashboardLayout>
  );
}
