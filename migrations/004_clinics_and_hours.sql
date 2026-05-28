-- LIFE DENTAL branches and appointment branch assignment

CREATE TABLE IF NOT EXISTS clinics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Кишинёв',
  color_code TEXT DEFAULT '#14b8a6',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL;
ALTER TABLE work_shifts ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL;

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all clinics" ON clinics FOR ALL USING (true);

INSERT INTO clinics (name, phone, address, city, color_code)
SELECT 'LIFE DENTAL Zelinski', '+373 69 214 434', 'г. Кишинёв, ул. Николай Зелинский, 35', 'Кишинёв', '#14b8a6'
WHERE NOT EXISTS (SELECT 1 FROM clinics WHERE phone = '+373 69 214 434');

INSERT INTO clinics (name, phone, address, city, color_code)
SELECT 'LIFE DENTAL Russo', '+373 78 580 028', 'г. Кишинёв, ул. Алеку Руссо 57/2', 'Кишинёв', '#38bdf8'
WHERE NOT EXISTS (SELECT 1 FROM clinics WHERE phone = '+373 78 580 028');
