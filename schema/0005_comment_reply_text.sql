-- FadeLoop V2: Migration 0005 - Public Comment Reply Text
-- Adds optional public comment reply message to campaign revisions
-- When a user comments matching keywords, in addition to the DM, FadeLoop will post
-- this public reply under their comment (e.g. "Sent to your DM! Check your inbox 📩").

ALTER TABLE campaign_revisions ADD COLUMN comment_reply_text TEXT;

