-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gender TEXT, -- 'male', 'female'
  birth_date DATE,
  address TEXT,
  notes TEXT,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  debt DECIMAL(10, 2) DEFAULT 0,
  last_visit DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  service_name TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'planned', -- 'planned', 'confirmed', 'completed', 'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Shifts Table
CREATE TABLE IF NOT EXISTS work_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doctor_id, date) -- One shift per doctor per day
);

-- Enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated (for MVP)
CREATE POLICY "Allow all patients" ON patients FOR ALL USING (true);
CREATE POLICY "Allow all appointments" ON appointments FOR ALL USING (true);
CREATE POLICY "Allow all shifts" ON work_shifts FOR ALL USING (true);
