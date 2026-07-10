-- ============================================
-- Alagoas Motos — Script de criação das tabelas
-- Execute este SQL no Supabase SQL Editor
-- (https://supabase.com/dashboard → SQL Editor → New query)
-- ============================================

-- 1. Tabela de leads
CREATE TABLE IF NOT EXISTS leads (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  nome        TEXT NOT NULL,
  telefone    TEXT,
  origem      TEXT NOT NULL DEFAULT 'Website',
  data        DATE,
  os          TEXT,
  nf          TEXT,
  modelo      TEXT,
  cpf         TEXT,
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'Novo',
  obs         TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de dados TSI
CREATE TABLE IF NOT EXISTS tsi_data (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL,
  os            TEXT,
  loja          TEXT,
  t2b           NUMERIC,
  tsi           NUMERIC,
  cilindrada    TEXT,
  tipo          TEXT,
  comentario    TEXT,
  data          TEXT,
  importado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de clientes fiéis
CREATE TABLE IF NOT EXISTS clientes_fieis (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  nome        TEXT NOT NULL,
  whatsapp    TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de configurações do usuário
CREATE TABLE IF NOT EXISTS user_settings (
  user_id          UUID PRIMARY KEY,
  goal             INTEGER NOT NULL DEFAULT 150,
  tsi_updated_at   TEXT,
  display_name     TEXT,
  avatar_url       TEXT,
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.1 Se a tabela user_settings já existia antes (instalação antiga),
--     rode este bloco no SQL Editor do Supabase para adicionar as colunas novas:
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_name TEXT;
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 5. Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsi_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_fieis ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS — permite acesso completo ao usuário fixo
CREATE POLICY "user_full_access_leads" ON leads
  FOR ALL USING (user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "user_full_access_tsi_data" ON tsi_data
  FOR ALL USING (user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "user_full_access_clientes_fieis" ON clientes_fieis
  FOR ALL USING (user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "user_full_access_user_settings" ON user_settings
  FOR ALL USING (user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001');

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_criado ON leads(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_tsi_user ON tsi_data(user_id);
CREATE INDEX IF NOT EXISTS idx_fieis_user ON clientes_fieis(user_id);

-- 8. Inserir settings padrão
INSERT INTO user_settings (user_id, goal)
VALUES ('00000000-0000-0000-0000-000000000001', 150)
ON CONFLICT (user_id) DO NOTHING;