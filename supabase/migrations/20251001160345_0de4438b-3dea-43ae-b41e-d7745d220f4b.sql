-- Phase 1: Add parent_id to categories for hierarchical structure
ALTER TABLE categories ADD COLUMN parent_id uuid REFERENCES categories(id) ON DELETE CASCADE;

-- Phase 1: Add formatted_content to notes for cleaned-up version
ALTER TABLE notes ADD COLUMN formatted_content text;

-- Phase 2: Add note_type enum
CREATE TYPE note_type AS ENUM ('original', 'extracted');

-- Phase 2: Add note_type and parent_note_id to notes
ALTER TABLE notes ADD COLUMN note_type note_type DEFAULT 'original' NOT NULL;
ALTER TABLE notes ADD COLUMN parent_note_id uuid REFERENCES notes(id) ON DELETE CASCADE;

-- Create index for better performance on hierarchical queries
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_notes_parent_note_id ON notes(parent_note_id);
CREATE INDEX idx_notes_note_type ON notes(note_type);