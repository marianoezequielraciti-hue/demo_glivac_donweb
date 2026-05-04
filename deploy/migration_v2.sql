-- Migration v2: expiry_date in products, client_id in fiados
-- Run this on the MySQL database

-- Add expiry_date column to products (if not exists)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS expiration_date DATE NULL;

-- Add client_id and items to fiados (if not exists)
ALTER TABLE fiados
  ADD COLUMN IF NOT EXISTS client_id VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS items JSON NULL;

-- Add username to user_profiles for employee code login (may already exist)
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username VARCHAR(100) NULL;
