-- ==========================================================================
-- Agendamentos do MicroWork Cloud DMS para painel interno e modo TV.
-- Execute uma única vez no SQL Editor do mesmo projeto Supabase do site.
-- A tabela não é acessível diretamente pelo navegador: leitura e escrita
-- passam pelas rotas protegidas do Next.js usando a service role.
-- ==========================================================================

create table if not exists public.agendamentos_dms (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  numero_agendamento text not null,
  data_agendamento date not null,
  hora_agendamento time not null,
  situacao text not null default 'Agendado',
  tipo_os text,
  placa text,
  modelo text,
  pessoa text not null,
  telefone text,
  celular text,
  consultor text,
  origem text not null default 'microwork-dom',
  ativo boolean not null default true,
  capturado_em timestamptz,
  sincronizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (empresa, numero_agendamento)
);

create index if not exists agendamentos_dms_data_hora_idx
  on public.agendamentos_dms (data_agendamento, hora_agendamento);
create index if not exists agendamentos_dms_ativos_idx
  on public.agendamentos_dms (data_agendamento, ativo);

alter table public.agendamentos_dms enable row level security;

revoke all on public.agendamentos_dms from anon, authenticated;
grant all on public.agendamentos_dms to service_role;

comment on table public.agendamentos_dms is
  'Cópia operacional dos agendamentos exibidos no MicroWork Cloud DMS.';
