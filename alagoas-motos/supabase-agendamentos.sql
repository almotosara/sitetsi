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

-- Também repara instalações antigas/incompletas sem apagar dados.
alter table public.agendamentos_dms add column if not exists empresa text;
alter table public.agendamentos_dms add column if not exists numero_agendamento text;
alter table public.agendamentos_dms add column if not exists data_agendamento date;
alter table public.agendamentos_dms add column if not exists hora_agendamento time;
alter table public.agendamentos_dms add column if not exists situacao text default 'Agendado';
alter table public.agendamentos_dms add column if not exists tipo_os text;
alter table public.agendamentos_dms add column if not exists placa text;
alter table public.agendamentos_dms add column if not exists modelo text;
alter table public.agendamentos_dms add column if not exists pessoa text;
alter table public.agendamentos_dms add column if not exists telefone text;
alter table public.agendamentos_dms add column if not exists celular text;
alter table public.agendamentos_dms add column if not exists consultor text;
alter table public.agendamentos_dms add column if not exists origem text default 'microwork-dom';
alter table public.agendamentos_dms add column if not exists ativo boolean default true;
alter table public.agendamentos_dms add column if not exists capturado_em timestamptz;
alter table public.agendamentos_dms add column if not exists sincronizado_em timestamptz default now();
alter table public.agendamentos_dms add column if not exists criado_em timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agendamentos_dms'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (empresa, numero_agendamento)'
  ) then
    alter table public.agendamentos_dms
      add constraint agendamentos_dms_empresa_numero_key unique (empresa, numero_agendamento);
  end if;
end $$;

create index if not exists agendamentos_dms_data_hora_idx
  on public.agendamentos_dms (data_agendamento, hora_agendamento);
create index if not exists agendamentos_dms_ativos_idx
  on public.agendamentos_dms (data_agendamento, ativo);

alter table public.agendamentos_dms enable row level security;

revoke all on public.agendamentos_dms from anon, authenticated;
grant all on public.agendamentos_dms to service_role;

comment on table public.agendamentos_dms is
  'Cópia operacional dos agendamentos exibidos no MicroWork Cloud DMS.';
