-- Add image_url column to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);