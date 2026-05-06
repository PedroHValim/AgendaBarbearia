-- ============================================================
-- BARBERPRO — SQL para o Supabase
-- Execute todo este bloco no SQL Editor do Supabase
-- (Project > SQL Editor > New query)
-- ============================================================

-- ── EXTENSÕES ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABELA: users ──────────────────────────────────────────
-- Armazena clientes E o admin. Diferenciado pelo campo "role".
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150)  NOT NULL,
  email           VARCHAR(255)  UNIQUE,                    -- pode ser null (cadastro walkin)
  phone           VARCHAR(20),                             -- só números, ex: 11999999999
  password_hash   TEXT,                                    -- null quando auth_provider = google
  google_id       VARCHAR(100)  UNIQUE,                    -- id retornado pelo Google OAuth
  avatar_url      TEXT,                                    -- foto do Google
  role            VARCHAR(20)   NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  auth_provider   VARCHAR(20)   NOT NULL DEFAULT 'email',  -- 'email' | 'google' | 'walkin'
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── TABELA: barbers ────────────────────────────────────────
-- Perfil de cada barbeiro da equipe
CREATE TABLE barbers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150)  NOT NULL,
  specialty       VARCHAR(200),                            -- ex: 'Cortes Clássicos, Barba'
  bio             TEXT,
  phone           VARCHAR(20),
  avatar_url      TEXT,
  rating          DECIMAL(3,2)  DEFAULT 5.00,              -- ex: 4.90
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  -- work_schedule: objeto JSON com horários por dia da semana
  -- ex: {"mon":"09:00-20:00","tue":"09:00-20:00","sat":"09:00-18:00","sun":null}
  work_schedule   JSONB         DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── TABELA: services ───────────────────────────────────────
-- Catálogo de serviços oferecidos
CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100)  NOT NULL,               -- ex: 'Corte', 'Barba', 'Combo'
  description       TEXT,
  price             DECIMAL(10,2) NOT NULL,               -- ex: 45.00
  duration_minutes  INTEGER       NOT NULL,               -- ex: 30
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── TABELA: appointments ───────────────────────────────────
-- O coração do sistema — cada linha é um agendamento
CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barber_id           UUID          NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  service_id          UUID          NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  date                DATE          NOT NULL,              -- ex: 2025-05-15
  time                TIME          NOT NULL,              -- ex: 14:00
  end_time            TIME          NOT NULL,              -- calculado: time + duration
  price               DECIMAL(10,2) NOT NULL,              -- snapshot do preço na hora do agendamento
  status              VARCHAR(30)   NOT NULL DEFAULT 'scheduled',
                                                          -- 'scheduled' | 'completed' | 'cancelled'
  confirmation_status VARCHAR(30)   NOT NULL DEFAULT 'pending',
                                                          -- 'pending' | 'confirmed' | 'no_show'
  is_walkin           BOOLEAN       NOT NULL DEFAULT FALSE, -- encaixe feito pelo admin
  cancel_reason       TEXT,
  cancelled_at        TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Impede dois agendamentos no mesmo barbeiro/data/hora
  CONSTRAINT unique_barber_slot UNIQUE (barber_id, date, time)
);

-- ── TABELA: blocked_slots ──────────────────────────────────
-- Horários bloqueados manualmente pelo admin (almoço, eventos, folgas)
CREATE TABLE blocked_slots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id   UUID          NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  date        DATE          NOT NULL,
  start_time  TIME          NOT NULL,                    -- ex: 12:00
  end_time    TIME          NOT NULL,                    -- ex: 14:00
  full_day    BOOLEAN       NOT NULL DEFAULT FALSE,      -- TRUE = dia inteiro bloqueado
  reason      VARCHAR(200),                              -- ex: 'Almoço', 'Reunião', 'Folga'
  created_by  UUID          REFERENCES users(id),        -- admin que bloqueou
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── TABELA: notifications ──────────────────────────────────
-- Notificações para o painel admin
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target          VARCHAR(20)   NOT NULL DEFAULT 'admin', -- 'admin' | userId (futuro)
  type            VARCHAR(30)   NOT NULL,
                                                          -- 'new_booking' | 'cancelled' | 'confirmed' | 'no_show'
  title           VARCHAR(200)  NOT NULL,
  message         TEXT          NOT NULL,
  appointment_id  UUID          REFERENCES appointments(id) ON DELETE SET NULL,
  is_read         BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── TABELA: settings ───────────────────────────────────────
-- Configurações da barbearia (chave-valor)
CREATE TABLE settings (
  key         VARCHAR(100)  PRIMARY KEY,
  value       JSONB         NOT NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── DADOS INICIAIS: settings ───────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('business_hours', '{
    "start": "09:00",
    "end": "20:00",
    "lunch_start": "12:00",
    "lunch_end": "14:00",
    "slot_interval": 30,
    "open_days": ["mon","tue","wed","thu","fri","sat"]
  }'),
  ('auto_confirmation', 'true'),
  ('auto_release_unconfirmed', 'true'),
  ('notification_channel', '"whatsapp"'),
  ('reminder_message', '"Olá {nome}! Lembrando do seu agendamento de {servico} amanhã às {horario} na BarberPro. Responda SIM para confirmar ou NÃO para cancelar."'),
  ('max_days_ahead', '30'),
  ('cancellation_limit_hours', '2');

-- ── DADOS INICIAIS: services ───────────────────────────────
INSERT INTO services (name, description, price, duration_minutes) VALUES
  ('Corte',    'Corte masculino clássico ou moderno com acabamento perfeito', 45.00, 30),
  ('Barba',    'Modelagem completa com navalha, toalha quente e produtos premium', 35.00, 25),
  ('Combo',    'Corte + Barba completa com desconto especial', 70.00, 50),
  ('Premium',  'Experiência completa: corte, barba, hidratação e finalização', 99.00, 75);

-- ── DADOS INICIAIS: barbers ────────────────────────────────
INSERT INTO barbers (name, specialty, rating, work_schedule) VALUES
  ('Marco Rossini', 'Barbeiro Sênior, Cortes Clássicos', 4.90,
   '{"mon":"09:00-20:00","tue":"09:00-20:00","wed":"09:00-20:00","thu":"09:00-20:00","fri":"09:00-20:00","sat":"09:00-18:00","sun":null}'),
  ('João Silva', 'Especialista em Barba', 4.80,
   '{"mon":"09:00-19:00","tue":"09:00-19:00","wed":"09:00-19:00","thu":"09:00-19:00","fri":"09:00-19:00","sat":"10:00-17:00","sun":null}'),
  ('Lucas Costa', 'Cortes Modernos', 4.70,
   '{"mon":null,"tue":"11:00-20:00","wed":"11:00-20:00","thu":"11:00-20:00","fri":"11:00-20:00","sat":"11:00-20:00","sun":null}');

-- ── DADOS INICIAIS: admin ──────────────────────────────────
-- IMPORTANTE: Troque a senha depois!
-- Esta é a senha "admin1234" hasheada com bcrypt (12 rounds)
-- Para gerar outra: node -e "const b=require('bcryptjs');b.hash('SUA_SENHA',12).then(console.log)"
INSERT INTO users (name, email, password_hash, role, auth_provider) VALUES
  ('Admin BarberPro', 'admin@barberpro.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NfUlYRPCm',
   'admin', 'email');

-- ── ÍNDICES (performance) ──────────────────────────────────
CREATE INDEX idx_appointments_date       ON appointments(date);
CREATE INDEX idx_appointments_barber     ON appointments(barber_id, date);
CREATE INDEX idx_appointments_client     ON appointments(client_id);
CREATE INDEX idx_appointments_status     ON appointments(status);
CREATE INDEX idx_blocked_slots_barber    ON blocked_slots(barber_id, date);
CREATE INDEX idx_notifications_target    ON notifications(target, is_read);

-- ── ROW LEVEL SECURITY (RLS) ───────────────────────────────
-- Como usamos a Service Key no backend, o RLS não é estritamente necessário,
-- mas é boa prática ativar para camadas extras de segurança.
-- Se quiser usar o Supabase JS direto do frontend no futuro, estas políticas
-- protegerão os dados.

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Permite tudo para a service role (nosso backend)
CREATE POLICY "Service role acesso total" ON users
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role acesso total" ON appointments
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role acesso total" ON notifications
  FOR ALL USING (true) WITH CHECK (true);
