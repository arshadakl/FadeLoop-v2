import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

  // 2-Step interactive confirmation button ("Send Me") flow
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

  // Automatically select the first connected account when accounts list arrives
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0 && accounts[0]) {
      setSelectedAccountId(accounts[0].account_id);
    }
  }, [accounts, selectedAccountId]);

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#EDEEEC]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121]">
              Automation Campaigns
            </h1>
            <p className="text-sm text-[#5D686A] mt-1">
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
            className="flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New Automation</span>
          </Button>
        </div>

        {/* Campaign Creation Drawer / Modal */}
        {isEditorOpen && (
          <div className="p-6 bg-white rounded-md border border-[#EDEEEC] shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#EDEEEC] pb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#212121]">
                  Create New Automation Campaign
                </h2>
                <p className="text-xs text-[#5D686A] mt-0.5">
                  Private replies will only be delivered to eligible comments on
                  this post/reel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-xs text-[#5D686A] hover:text-[#212121] px-2 py-1 rounded hover:bg-[#F0F0EF]"
              >
                ✕ Cancel
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                {formError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Form Controls */}
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="select-account"
                    className="block text-xs font-medium text-[#212121] mb-1.5"
                  >
                    Connected Instagram Account
                  </label>
                  <select
                    id="select-account"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-white border border-[#EDEEEC] rounded px-3 py-1.5 text-sm text-[#212121] focus:border-[#97CAEE] focus:outline-none"
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
                      className="block text-xs font-medium text-[#212121]"
                    >
                      Target Post or Reel
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualMediaInput(!isManualMediaInput)}
                      className="text-xs text-[#0E3B57] hover:underline font-medium"
                    >
                      {isManualMediaInput
                        ? "← Select from Media"
                        : "Enter Media ID manually"}
                    </button>
                  </div>

                  {!isManualMediaInput ? (
                    <div className="space-y-2">
                      {mediaQuery.isLoading ? (
                        <div className="p-4 rounded border border-[#EDEEEC] bg-[#F6F6F6] text-center text-xs text-[#5D686A] flex items-center justify-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-[#97CAEE] border-t-transparent rounded-full animate-spin" />
                          Loading recent Posts and Reels...
                        </div>
                      ) : mediaQuery.isError ? (
                        <div className="p-3 rounded bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#B45309]">
                          Could not fetch media list. You can enter the Media ID
                          manually.
                        </div>
                      ) : (mediaQuery.data?.media.length || 0) === 0 ? (
                        <div className="p-4 rounded border border-[#EDEEEC] bg-[#F6F6F6] text-center text-xs text-[#5D686A]">
                          No posts or reels found on this account.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-2 rounded border border-[#EDEEEC] bg-[#F6F6F6]">
                          {mediaQuery.data?.media.map((item) => {
                            const isSelected = mediaId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setMediaId(item.id)}
                                className={`group relative text-left rounded overflow-hidden border transition-all p-1.5 flex flex-col gap-1 ${
                                  isSelected
                                    ? "border-[#97CAEE] bg-[#DFEFFE] ring-1 ring-[#97CAEE]"
                                    : "border-[#EDEEEC] bg-white hover:border-[#D0D0CE]"
                                }`}
                              >
                                <div className="relative aspect-square w-full rounded overflow-hidden bg-[#E5E5E4]">
                                  {item.thumbnail_url ? (
                                    <img
                                      src={item.thumbnail_url}
                                      alt={item.caption || "Instagram media"}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-[#8E9596]">
                                      No preview
                                    </div>
                                  )}
                                  {item.media_type === "VIDEO" && (
                                    <span className="absolute top-1 right-1 bg-[#212121]/80 text-[10px] font-semibold text-white px-1.5 py-0.2 rounded">
                                      ▶ Reel
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="absolute bottom-1 left-1 bg-[#97CAEE] text-[#0E3B57] font-bold text-[10px] px-1.5 py-0.2 rounded">
                                      ✓ Selected
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#5D686A] line-clamp-2 leading-tight px-0.5">
                                  {item.caption || `Media ID: ${item.id}`}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {mediaId && (
                        <div className="flex items-center justify-between text-xs text-[#5D686A] px-1">
                          <span>
                            Selected ID:{" "}
                            <span className="font-mono text-[#212121] font-semibold">
                              {mediaId}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setMediaId("")}
                            className="text-[#B91C1C] hover:underline text-[11px]"
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
                        className="w-full bg-white border border-[#EDEEEC] rounded px-3 py-1.5 text-sm text-[#212121] focus:border-[#97CAEE] focus:outline-none"
                      />
                      <p className="text-[11px] text-[#5D686A] mt-1">
                        Meta enforces strictly ONE published campaign per
                        post/reel.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#212121] mb-1.5">
                    Match Mode
                  </span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-[#212121] cursor-pointer">
                      <input
                        type="radio"
                        checked={matchMode === "exact_keyword"}
                        onChange={() => setMatchMode("exact_keyword")}
                      />
                      Exact Keywords
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#212121] cursor-pointer">
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
                      className="block text-xs font-medium text-[#212121] mb-1.5"
                    >
                      Trigger Keywords (comma separated)
                    </label>
                    <input
                      id="input-keywords"
                      type="text"
                      placeholder="e.g. guide, link, send, info"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                      className="w-full bg-white border border-[#EDEEEC] rounded px-3 py-1.5 text-sm text-[#212121] focus:border-[#97CAEE] focus:outline-none"
                    />
                  </div>
                )}

                {/* 2-Step Interactive Opt-in ("Send Me" button) */}
                <div className="p-3.5 rounded border border-[#DFEFFE] bg-[#F6FAFE] space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmationButtonEnabled}
                      onChange={(e) =>
                        setConfirmationButtonEnabled(e.target.checked)
                      }
                      className="mt-0.5 rounded border-[#EDEEEC] text-[#97CAEE] focus:ring-[#97CAEE]"
                    />
                    <div>
                      <span className="block text-xs font-semibold text-[#0E3B57]">
                        Enable 2-Step interactive "Send Me" button (Recommended)
                      </span>
                      <span className="block text-[11px] text-[#5D686A] mt-0.5 leading-snug">
                        Sends a Quick Reply button first. When the user taps it,
                        Instagram opens a 24-hour interaction window and
                        delivers the link without triggering Meta spam flags.
                      </span>
                    </div>
                  </label>

                  {confirmationButtonEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#DFEFFE]">
                      <div>
                        <label
                          htmlFor="input-btn-text"
                          className="block text-[11px] font-medium text-[#212121] mb-1"
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
                          className="w-full bg-white border border-[#EDEEEC] rounded px-2.5 py-1 text-xs text-[#212121] focus:border-[#97CAEE] focus:outline-none"
                          placeholder="Send Me"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="input-prompt-text"
                          className="block text-[11px] font-medium text-[#212121] mb-1"
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
                          className="w-full bg-white border border-[#EDEEEC] rounded px-2.5 py-1 text-xs text-[#212121] focus:border-[#97CAEE] focus:outline-none"
                          placeholder="Tap below to receive your link 👇"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="input-reply-template"
                    className="block text-xs font-medium text-[#212121] mb-1.5"
                  >
                    Private Reply Message / Body
                  </label>
                  <textarea
                    id="input-reply-template"
                    rows={3}
                    value={replyTemplate}
                    onChange={(e) => setReplyTemplate(e.target.value)}
                    className="w-full bg-white border border-[#EDEEEC] rounded px-3 py-1.5 text-sm text-[#212121] focus:border-[#97CAEE] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-resource-url"
                    className="block text-xs font-medium text-[#212121] mb-1.5"
                  >
                    Target Link or Resource URL (optional)
                  </label>
                  <input
                    id="input-resource-url"
                    type="url"
                    placeholder="https://yourbrand.com/resource"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    className="w-full bg-white border border-[#EDEEEC] rounded px-3 py-1.5 text-sm text-[#212121] focus:border-[#97CAEE] focus:outline-none"
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
                    className="w-full"
                  >
                    {createMutation.isPending
                      ? "Publishing Campaign…"
                      : "Publish Automation"}
                  </Button>
                </div>
              </div>

              {/* Live Preview Simulator */}
              <div className="flex flex-col justify-center items-center p-6 bg-[#F6F6F6] rounded border border-[#EDEEEC]">
                <span className="text-xs uppercase tracking-wider text-[#5D686A] font-semibold mb-4">
                  Instagram Direct Message Simulation
                </span>

                <div className="w-full max-w-xs rounded-md bg-white border border-[#EDEEEC] p-4 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EDEEEC]">
                    <div className="w-6 h-6 rounded bg-[#212121] flex items-center justify-center text-[10px] text-white font-bold">
                      IG
                    </div>
                    <span className="text-xs font-semibold text-[#212121]">
                      Your Connected Account
                    </span>
                  </div>

                  {confirmationButtonEnabled ? (
                    <div className="space-y-2">
                      <div className="bg-[#F0F0EF] rounded-md p-2.5 text-xs text-[#212121]">
                        <p>
                          {confirmationPromptText ||
                            "Tap below to receive your link 👇"}
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <span className="inline-block bg-[#97CAEE] text-[#0E3B57] text-xs font-semibold px-3 py-1 rounded shadow-xs">
                          {confirmationButtonText || "Send Me"}
                        </span>
                      </div>
                      <div className="bg-[#DFEFFE] border border-[#97CAEE]/40 rounded-md p-2.5 text-xs text-[#0E3B57] mt-2">
                        <p>{replyTemplate}</p>
                        {resourceUrl && (
                          <p className="mt-1 font-medium underline break-all">
                            {resourceUrl}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#DFEFFE] border border-[#97CAEE]/40 rounded-md p-2.5 text-xs text-[#0E3B57]">
                      <p>
                        {replyTemplate ||
                          "Your message preview will appear here…"}
                      </p>
                      {resourceUrl && (
                        <p className="mt-1 font-medium underline break-all">
                          {resourceUrl}
                        </p>
                      )}
                    </div>
                  )}

                  <span className="text-[10px] text-[#8E9596] block text-right">
                    Delivered instantly · Just now
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Existing Campaigns List */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#212121]">
            Active & Paused Campaigns
          </h2>

          {campaignsQuery.isPending ? (
            <div className="p-8 text-center text-sm text-[#5D686A] bg-white rounded border border-[#EDEEEC]">
              Loading campaigns…
            </div>
          ) : campaignsQuery.isError ? (
            <div className="p-8 text-center text-sm text-[#B91C1C] bg-[#FEF2F2] rounded border border-[#FECACA]">
              Failed to load campaigns.
            </div>
          ) : campaignsQuery.data.campaigns.length === 0 ? (
            <div className="p-12 text-center bg-white rounded border border-dashed border-[#EDEEEC]">
              <h3 className="font-semibold text-base text-[#212121]">
                No Automations Configured
              </h3>
              <p className="text-sm text-[#5D686A] max-w-md mx-auto mt-1 mb-5">
                Create your first campaign to begin automatically delivering
                links and replies to commenters.
              </p>
              <Button onClick={() => setIsEditorOpen(true)}>
                + Create Campaign
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaignsQuery.data.campaigns.map(({ campaign, revision }) => (
                <div
                  key={campaign.id}
                  className="p-4 bg-white rounded border border-[#EDEEEC] flex flex-col justify-between shadow-2xs hover:border-[#D0D0CE] transition-colors space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#5D686A]">
                        Media: {campaign.mediaId}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          campaign.status === "published"
                            ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                            : "bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]"
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>

                    {revision.confirmationButtonEnabled && (
                      <div className="inline-flex items-center gap-1 bg-[#F0F7FD] border border-[#97CAEE]/40 text-[#0E3B57] text-[11px] font-medium px-2 py-0.5 rounded">
                        <span>⚡ 2-Step Opt-in:</span>
                        <span className="font-semibold">
                          "{revision.confirmationButtonText || "Send Me"}"
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-xs font-semibold text-[#212121]">
                        Trigger:{" "}
                      </span>
                      {revision.matchMode === "any_comment" ? (
                        <span className="text-xs text-[#0E3B57] font-medium">
                          Any comment
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {revision.keywords.map((k) => (
                            <span
                              key={k}
                              className="text-[11px] px-1.5 py-0.5 bg-[#F0F0EF] text-[#212121] rounded border border-[#EDEEEC]"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 bg-[#F6F6F6] rounded border border-[#EDEEEC] text-xs text-[#212121]">
                      <p className="line-clamp-3">{revision.replyTemplate}</p>
                      {revision.resourceUrl && (
                        <p className="text-[#0E3B57] text-[11px] mt-1 font-medium underline truncate">
                          {revision.resourceUrl}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#EDEEEC] flex items-center justify-between">
                    <span className="text-[11px] text-[#8E9596]">
                      Updated{" "}
                      {new Date(campaign.updatedAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
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
