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
  const [commentReplyText, setCommentReplyText] = useState(
    "Sent to your DM! Check your inbox 📩",
  );

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
      setCommentReplyText(
        revision.commentReplyText?.trim() ||
          "Sent to your DM! Check your inbox 📩",
      );
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
        <div className="p-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2.5">
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading campaign details…</span>
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
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            ← Back to Campaigns
          </Link>
          <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
            Failed to load campaign. The campaign may have been removed or does
            not exist.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isPublished = status === "published";

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-8 font-sans">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
          >
            ← Back to Campaigns
          </Link>
        </div>

        {/* Page Header with Status Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">
              Edit Automation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure keywords, interactive buttons, and delivery content for
              this post.
            </p>
          </div>

          {/* Quick Status Bar */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                isPublished
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPublished ? "bg-primary" : "bg-muted-foreground"
                }`}
              />
              {isPublished ? "Active Automation" : "Automation Paused"}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatus(isPublished ? "paused" : "published")}
              className="text-xs font-semibold h-8 px-3 rounded-lg"
            >
              {isPublished ? "Pause" : "Resume"}
            </Button>
          </div>
        </div>

        {/* Target Post Preview Card */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Target Instagram Post</span>
            {matchedMedia?.permalink && (
              <a
                href={matchedMedia.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                View on Instagram
              </a>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-4 pt-1">
            {/* Thumbnail */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
              {matchedMedia?.thumbnail_url || matchedMedia?.media_url ? (
                <img
                  src={matchedMedia.thumbnail_url || matchedMedia.media_url}
                  alt={matchedMedia.caption || "Instagram media preview"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground p-2 text-center bg-muted/60">
                  <span className="font-semibold text-[10px]">Media</span>
                </div>
              )}
              {matchedMedia?.media_type === "VIDEO" && (
                <span className="absolute bottom-1 right-1 bg-black/85 text-[9px] font-bold text-white px-1.5 py-0.5 rounded">
                  Reel
                </span>
              )}
            </div>

            {/* Media Information */}
            <div className="flex-1 space-y-2 min-w-0">
              <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                {matchedMedia?.caption ||
                  "No caption provided on this Instagram post."}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Media ID:{" "}
                  <strong className="text-foreground">{mediaId}</strong>
                </span>
                <span>•</span>
                <span>
                  Account:{" "}
                  <strong className="text-foreground">
                    {accountId.slice(0, 10)}…
                  </strong>
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Target media is locked for this campaign to maintain
                deduplication integrity and prevent collision errors.
              </p>
            </div>
          </div>
        </div>

        {formError && (
          <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
            {formError}
          </div>
        )}

        {/* Main Editor Grid */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Form Settings (3 Cols) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Card 1: Trigger Matching */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-4 shadow-2xs">
              <h2 className="text-sm font-semibold font-heading text-foreground">
                Comment trigger rule
              </h2>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="editMatchMode"
                    checked={matchMode === "exact_keyword"}
                    onChange={() => setMatchMode("exact_keyword")}
                    className="accent-primary"
                  />
                  <span>Exact Keywords</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="editMatchMode"
                    checked={matchMode === "any_comment"}
                    onChange={() => setMatchMode("any_comment")}
                    className="accent-primary"
                  />
                  <span>Any Comment</span>
                </label>
              </div>

              {matchMode === "exact_keyword" && (
                <div className="pt-1">
                  <label
                    htmlFor="input-edit-keywords"
                    className="block text-xs font-semibold text-foreground mb-1.5"
                  >
                    Trigger Keywords (comma separated)
                  </label>
                  <input
                    id="input-edit-keywords"
                    type="text"
                    placeholder="e.g. guide, link, send, price, pdf"
                    value={keywordsText}
                    onChange={(e) => setKeywordsText(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Triggers when a commenter writes any of these words
                    (case-insensitive).
                  </p>
                </div>
              )}
            </div>

            {/* Card 2: 2-Step Interactive Opt-in ("Send Me" button) */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold font-heading text-foreground">
                  Interactive opt-in flow
                </h2>
                <span className="text-[11px] font-semibold text-primary bg-primary/15 border border-primary/25 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmationButtonEnabled}
                  onChange={(e) =>
                    setConfirmationButtonEnabled(e.target.checked)
                  }
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary accent-primary"
                />
                <div>
                  <span className="block text-xs font-semibold text-foreground">
                    Enable 2-Step “Send Me” quick reply button
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Sends an interactive button first. When tapped by the user,
                    Instagram opens a 24-hour interaction window and delivers
                    your link without triggering Meta spam flags.
                  </span>
                </div>
              </label>

              {confirmationButtonEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div>
                    <label
                      htmlFor="input-edit-btn-text"
                      className="block text-xs font-semibold text-foreground mb-1"
                    >
                      Button Text (max 20 chars)
                    </label>
                    <input
                      id="input-edit-btn-text"
                      type="text"
                      maxLength={20}
                      value={confirmationButtonText}
                      onChange={(e) =>
                        setConfirmationButtonText(e.target.value)
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      placeholder="Send Me"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="input-edit-prompt-text"
                      className="block text-xs font-semibold text-foreground mb-1"
                    >
                      Opening Prompt Message
                    </label>
                    <input
                      id="input-edit-prompt-text"
                      type="text"
                      value={confirmationPromptText}
                      onChange={(e) =>
                        setConfirmationPromptText(e.target.value)
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      placeholder="Tap below to receive your link."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Card 3: Direct Message Content */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-4 shadow-2xs">
              <h2 className="text-sm font-semibold font-heading text-foreground">
                Direct message payload
              </h2>

              <div>
                <label
                  htmlFor="input-edit-reply-template"
                  className="block text-xs font-semibold text-foreground mb-1.5"
                >
                  Direct Message Text
                </label>
                <textarea
                  id="input-edit-reply-template"
                  rows={4}
                  value={replyTemplate}
                  onChange={(e) => setReplyTemplate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div>
                <label
                  htmlFor="input-edit-resource-url"
                  className="block text-xs font-semibold text-foreground mb-1.5"
                >
                  Target Link or Resource URL (optional)
                </label>
                <input
                  id="input-edit-resource-url"
                  type="url"
                  placeholder="https://yourbrand.com/guide.pdf"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Card 4: Public Comment Reply */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-3 shadow-2xs">
              <h2 className="text-sm font-semibold font-heading text-foreground">
                Public comment reply (Optional)
              </h2>

              <div>
                <label
                  htmlFor="input-edit-comment-reply"
                  className="block text-xs font-semibold text-foreground mb-1.5"
                >
                  Public Comment Reply Text
                </label>
                <input
                  id="input-edit-comment-reply"
                  type="text"
                  placeholder="e.g. Sent to your DM, check your inbox."
                  value={commentReplyText}
                  onChange={(e) => setCommentReplyText(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Automatically posted under the commenter’s comment on
                  Instagram to confirm the DM was sent.
                </p>
              </div>
            </div>

            {/* Save Actions */}
            <div className="pt-2 flex items-center gap-3">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={
                  updateMutation.isPending ||
                  !replyTemplate.trim() ||
                  (matchMode === "exact_keyword" && !keywordsText.trim())
                }
                className="flex-1 h-10 font-semibold"
              >
                {updateMutation.isPending ? "Saving Changes…" : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/campaigns")}
                disabled={updateMutation.isPending}
                className="h-10 px-5 font-semibold"
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Live Simulator (2 Cols Sticky) */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 flex flex-col justify-center items-center p-6 bg-card rounded-xl border border-border shadow-2xs">
              <span className="text-xs font-semibold text-muted-foreground mb-4">
                Direct message preview
              </span>

              <div className="w-full max-w-xs rounded-xl bg-background border border-border p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-2.5 border-b border-border">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                    ig
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    Your Instagram Page
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
                      <p>{replyTemplate || "Your message will appear here…"}</p>
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

        {/* Danger Zone: Delete Campaign */}
        <div className="pt-8 border-t border-border">
          <div className="p-5 rounded-xl border border-destructive/20 bg-destructive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold font-heading text-destructive">
                Danger zone: delete campaign
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently stop this automation and delete its configuration.
                Historical delivery audit events are preserved.
              </p>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="font-semibold text-xs h-8 px-3 rounded-lg"
            >
              Delete Campaign
            </Button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmDialog
          isOpen={confirmDelete}
          title="Delete Automation Campaign?"
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
