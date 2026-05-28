-- LIFE DENTAL CRM core tables and compatibility columns

-- Existing appointment UI stores operational fields directly on appointments.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS complaint TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS treatment TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_reason TEXT;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_manager_id UUID;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  role TEXT DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'doctor')),
  specialization TEXT,
  avatar_url TEXT,
  color_code TEXT DEFAULT '#2563eb',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) DEFAULT 0,
  duration_minutes INTEGER DEFAULT 60,
  color_code TEXT DEFAULT '#2563eb',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT DEFAULT 'phone',
  interested_service TEXT,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'thinking', 'scheduled', 'came', 'not_came', 'lost', 'converted', 'rejected')),
  assigned_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  next_contact_at TIMESTAMPTZ,
  preferred_date DATE,
  preferred_time TIME,
  converted_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  converted_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  lost_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at TIMESTAMPTZ,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'call' CHECK (type IN ('call', 'whatsapp', 'sms', 'email', 'note')),
  direction TEXT DEFAULT 'outgoing' CHECK (direction IN ('incoming', 'outgoing')),
  summary TEXT NOT NULL,
  result TEXT,
  next_contact_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treatment_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'proposed' CHECK (status IN ('draft', 'proposed', 'thinking', 'accepted', 'in_progress', 'completed', 'declined')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT DEFAULT 'cash' CHECK (method IN ('cash', 'card', 'transfer', 'insurance', 'other')),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all services" ON services FOR ALL USING (true);
CREATE POLICY "Allow all leads" ON leads FOR ALL USING (true);
CREATE POLICY "Allow all tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all contact_history" ON contact_history FOR ALL USING (true);
CREATE POLICY "Allow all treatment_plans" ON treatment_plans FOR ALL USING (true);
CREATE POLICY "Allow all payments" ON payments FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_contact_at ON leads(next_contact_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
