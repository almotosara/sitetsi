-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- A leitura permanece pública porque /api/revisoes e a oficina usam a anon key.
-- Escritas passam a ser exclusivas do service role, usado somente pela rota
-- autenticada /api/admin/mao-de-obra.

ALTER TABLE public.rev_mao_de_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rev_mao_de_obra_full_access ON public.rev_mao_de_obra;
DROP POLICY IF EXISTS rev_mao_de_obra_public_read ON public.rev_mao_de_obra;

REVOKE INSERT, UPDATE, DELETE ON public.rev_mao_de_obra FROM anon, authenticated;
GRANT SELECT ON public.rev_mao_de_obra TO anon, authenticated;
GRANT ALL ON public.rev_mao_de_obra TO service_role;

CREATE POLICY rev_mao_de_obra_public_read
  ON public.rev_mao_de_obra
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- A estrutura atual já possui todos os campos necessários:
-- id, modelos, tmo_hora_valor, revisao_geral_valor e ordem.
-- Portanto, esta migração não cria colunas novas; apenas endurece as permissões.
