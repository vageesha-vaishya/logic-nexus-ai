-- supabase/migrations/20260225_create_user_preferences.sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  custom_widgets JSONB,
  customization_applied BOOLEAN DEFAULT false,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role)
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_role ON user_preferences(role);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can only see their own preferences
CREATE POLICY user_preferences_self_read ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_preferences_self_write ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_preferences_self_insert ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_self_delete ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);
