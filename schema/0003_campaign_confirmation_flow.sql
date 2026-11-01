-- FadeLoop V2: Migration 0003 - Campaign Interactive Confirmation Button & Anti-Spam Flow
-- Adds configuration for 2-step interactive DM confirmation ("Send Me" button)
-- This flow prompts the commenter with a Quick Reply button before sending links/coupons,
-- opening Meta's 24-hour interaction window and protecting accounts against spam classification.

ALTER TABLE campaign_revisions ADD COLUMN confirmation_button_enabled INTEGER NOT NULL DEFAULT 0 CHECK (confirmation_button_enabled IN (0, 1));
ALTER TABLE campaign_revisions ADD COLUMN confirmation_button_text TEXT NOT NULL DEFAULT 'Send Me';
ALTER TABLE campaign_revisions ADD COLUMN confirmation_prompt_text TEXT;
