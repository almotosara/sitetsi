-- Alagoas Motos — notas por área do detalhamento TSI
-- Execute uma vez no SQL Editor antes de reimportar a planilha Resultados TSI 2.0.

ALTER TABLE public.tsi_data
  ADD COLUMN IF NOT EXISTS detalhamento JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tsi_data_detalhamento_object'
      AND conrelid = 'public.tsi_data'::regclass
  ) THEN
    ALTER TABLE public.tsi_data
      ADD CONSTRAINT tsi_data_detalhamento_object
      CHECK (jsonb_typeof(detalhamento) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.tsi_data.detalhamento IS
  'Notas brutas 0–10 por área: satisfação, infraestrutura, consultor, qualidade, entrega, custo-benefício, recomendação, retorno, agendamento e recepção.';
