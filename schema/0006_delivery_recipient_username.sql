-- Migration 0006: Add recipient_username to delivery_outcomes
-- Captures commenter @username to surface directly in the Delivery Audit & Activity log.

ALTER TABLE delivery_outcomes ADD COLUMN recipient_username TEXT;
