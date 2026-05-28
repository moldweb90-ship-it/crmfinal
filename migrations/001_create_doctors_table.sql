-- Table for Doctors (LIFE DENTAL)
CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  bio TEXT,
  photo_url TEXT,
  color_code TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Allow authenticated access
CREATE POLICY "Allow all for authenticated" ON doctors FOR ALL USING (true);
