-- Migration 0007: Add partial index on campaigns(media_id) for published posts
-- Enables O(1) media lookup when Meta webhooks provide only mediaId or reference a Facebook Page ID.
-- Filtered with WHERE status = 'published' to ensure zero index write overhead for paused campaigns.

CREATE INDEX idx_campaigns_published_media_lookup ON campaigns(media_id) WHERE status = 'published';
