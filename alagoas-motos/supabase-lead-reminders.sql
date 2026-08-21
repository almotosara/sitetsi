-- Alagoas Motos — lembretes vinculados a leads
-- Execute uma vez no Supabase SQL Editor em instalações já existentes.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lembrete_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_texto TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_lembrete_em
  ON public.leads (lembrete_em)
  WHERE lembrete_em IS NOT NULL;

COMMENT ON COLUMN public.leads.lembrete_em IS 'Data e hora do próximo contato com o lead.';
COMMENT ON COLUMN public.leads.lembrete_texto IS 'Motivo ou orientação do lembrete de contato.';
