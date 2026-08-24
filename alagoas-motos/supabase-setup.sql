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
  lembrete_em TIMESTAMPTZ,
  lembrete_texto TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instalações existentes: mantém o script idempotente.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lembrete_em TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lembrete_texto TEXT;

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
  detalhamento  JSONB NOT NULL DEFAULT '{}'::jsonb,
  importado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instalações existentes: armazena as notas 0–10 de cada área da pesquisa.
ALTER TABLE tsi_data
  ADD COLUMN IF NOT EXISTS detalhamento JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Tabela de clientes fiéis
CREATE TABLE IF NOT EXISTS clientes_fieis (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,
  nome        TEXT NOT NULL,
  whatsapp    TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.1 Tabela de reenvio de pesquisas TSI
CREATE TABLE IF NOT EXISTS tsi_resend (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL,
  os                TEXT,
  cliente           TEXT,
  veiculo           TEXT,
  email             TEXT,
  celular           TEXT,
  data_envio_email  TEXT,
  data_envio_sms    TEXT,
  data_reenvio      TEXT,
  importado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
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
ALTER TABLE tsi_resend ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "user_full_access_tsi_resend" ON tsi_resend
  FOR ALL USING (user_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001');

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_criado ON leads(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_leads_lembrete_em ON leads(lembrete_em) WHERE lembrete_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tsi_user ON tsi_data(user_id);
CREATE INDEX IF NOT EXISTS idx_fieis_user ON clientes_fieis(user_id);
CREATE INDEX IF NOT EXISTS idx_tsi_resend_user ON tsi_resend(user_id);

-- 8. Inserir settings padrão
INSERT INTO user_settings (user_id, goal)
VALUES ('00000000-0000-0000-0000-000000000001', 150)
ON CONFLICT (user_id) DO NOTHING;
-- ═══════════════════════════════════════════════════════════════════
-- 9. Chat entre Consultor e Oficina
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_messages (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id           UUID NOT NULL,
  texto               TEXT NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  lido                BOOLEAN NOT NULL DEFAULT false,
  apagada_para_todos  BOOLEAN NOT NULL DEFAULT false,
  apagada_para        TEXT[] NOT NULL DEFAULT '{}'
);

-- Se a tabela já existia antes (instalação antiga), rode este bloco pra adicionar as colunas novas:
-- ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS apagada_para_todos BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS apagada_para TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- As duas contas fixas do sistema (consultor e oficina) compartilham
-- o mesmo canal de chat, então a policy libera leitura/escrita geral
-- para qualquer um dos dois user_ids conhecidos do app.
CREATE POLICY "chat_full_access" ON chat_messages
  FOR ALL USING (
    sender_id IN (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    )
  )
  WITH CHECK (
    sender_id IN (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    )
  );

CREATE INDEX IF NOT EXISTS idx_chat_criado ON chat_messages(criado_em ASC);

-- Habilita Realtime para a tabela (necessário pra atualização instantânea no chat)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
