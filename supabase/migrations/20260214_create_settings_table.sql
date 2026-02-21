-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read settings (Public Dashboard needs this)
CREATE POLICY "Enable read access for all users" ON settings
  FOR SELECT USING (true);

-- Policy: Only authenticated users can update settings (Admin Dashboard)
CREATE POLICY "Enable update for authenticated users only" ON settings
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can insert (if needed)
CREATE POLICY "Enable insert for authenticated users only" ON settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insert default setting for service_card_style
INSERT INTO settings (key, value)
VALUES ('service_card_style', '"editorial"')
ON CONFLICT (key) DO NOTHING;
