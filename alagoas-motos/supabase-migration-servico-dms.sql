-- ============================================================
-- Migração aditiva: código de serviço do MicroWork Cloud por revisão.
-- Rode este arquivo UMA VEZ no Supabase SQL Editor se o banco já existe
-- (ou seja, se você já rodou supabase-revisoes.sql antes e não quer
-- perder o que já foi digitado no admin).
--
-- NÃO rode supabase-revisoes.sql de novo pra adicionar essa coluna —
-- ele começa com DROP TABLE e apaga tudo que já foi cadastrado.
-- Esse arquivo aqui só adiciona a coluna, sem mexer no resto.
-- ============================================================

ALTER TABLE rev_revisoes
  ADD COLUMN IF NOT EXISTS servico_dms_codigo TEXT;

COMMENT ON COLUMN rev_revisoes.servico_dms_codigo IS
  'Código do cadastro "Serviço" do MicroWork Cloud correspondente ao km desta revisão (ex: 1784, 1842). NULL = ainda não informado.';
