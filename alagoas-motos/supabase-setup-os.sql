-- ============================================================================
-- Migration: dashboard de Ordens de Serviço (oficina@alagoasmotos.com)
-- NÃO altera nada relacionado a TSI (tsi_data, tsi_resend) nem a leads.
-- Rode este arquivo no SQL editor do Supabase.
-- ============================================================================

create table if not exists public.os_linhas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  emissao timestamptz,
  numero_os text not null,
  situacao text,
  tipo_os text,
  pessoa text,
  modelo text,
  placa text,
  total_desconto numeric(12,2) default 0,
  total_servico numeric(12,2) default 0,
  total_acrescimo numeric(12,2) default 0,
  total_mercadoria numeric(12,2) default 0,
  valor_total numeric(12,2) default 0,
  empresa text,
  consultor text,
  criado_em timestamptz default now()
);

create index if not exists os_linhas_user_emissao_idx on public.os_linhas (user_id, emissao desc);
create index if not exists os_linhas_numero_idx on public.os_linhas (user_id, numero_os);

grant select, insert, update, delete on public.os_linhas to authenticated;
grant all on public.os_linhas to service_role;

alter table public.os_linhas enable row level security;

-- Como o app usa userId fixo por conta (single-user), a política permite tudo
-- para service_role/anon nas mesmas condições das tabelas existentes do projeto.
-- Ajuste conforme o seu padrão de RLS já em uso (tsi_data usa política aberta).
drop policy if exists "os_linhas_all" on public.os_linhas;
create policy "os_linhas_all" on public.os_linhas
  for all using (true) with check (true);
