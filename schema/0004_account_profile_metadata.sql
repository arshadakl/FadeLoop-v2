-- Migration 0004: Account Profile Metadata (Username, Display Name, Profile Picture)
ALTER TABLE instagram_accounts ADD COLUMN username TEXT;
ALTER TABLE instagram_accounts ADD COLUMN name TEXT;
ALTER TABLE instagram_accounts ADD COLUMN profile_picture_url TEXT;

