<div align="center">
  <img src="public/alagoas-motos-logo.webp" alt="Alagoas Motos" width="360" />

  <h1>Alagoas Motos · Painel Operacional</h1>

  <p>
    Leads, pesquisas TSI, clientes fiéis, oficina, revisões e agendamentos<br />
    reunidos em uma experiência responsiva para desktop, tablet, celular e TV.
  </p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs" />
    <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white" />
    <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
  </p>
</div>

---

## Sobre o projeto

O painel centraliza rotinas comerciais e de pós-venda da Alagoas Motos. O projeto foi construído com Next.js App Router, TypeScript e Supabase, com foco em leitura rápida de indicadores, operação segura e boa usabilidade em qualquer tamanho de tela.

### Principais módulos

- **Dashboard de leads:** indicadores, metas, evolução e lembretes vinculados a clientes.
- **Leads:** filtros, paginação, WhatsApp, exportação, detecção de duplicatas e funil interativo.
- **TSI:** painel analítico, detalhamento por blocos, matriz de oportunidades, voz do cliente e reenvios.
- **Clientes fiéis:** consulta e acompanhamento da base recorrente.
- **Oficina:** catálogo de motos, revisões, peças, T.M.O., manuais e abertura assistida de O.S.
- **Agendamentos:** sincronização com MicroWork CloudDMS e visualização dedicada para a TV da recepção.
- **Admin:** dock inferior e edição protegida de valores de mão de obra por grupo de modelos.

## Experiência visual

- Fonte **SUSE** carregada localmente;
- temas claro e escuro por meio de `[data-theme='dark']`;
- background aurora vermelho animado em WebGL;
- componentes responsivos, áreas de toque de no mínimo 48 px e suporte a `prefers-reduced-motion`;
- badges semânticas, estados de carregamento e gráficos adaptáveis.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn, CSS Modules |
| Movimento e ícones | Framer Motion, Lucide React, GSAP |
| Dados | Supabase/PostgreSQL |
| Relatórios | SheetJS (`xlsx`) |
| Autenticação | Cookie HTTP-only assinado com HMAC-SHA256 e senhas bcrypt |
| Deploy | Netlify + Next.js Runtime |

## Como executar

### Requisitos

- Node.js 20 ou superior;
- npm;
- um projeto Supabase;
- variáveis de ambiente configuradas.

### Instalação

```bash
git clone <URL_DO_REPOSITORIO>
cd alagoas-motos
npm install
cp .env.example .env.local
npm run dev
```

O ambiente local abre por padrão em `http://localhost:8080`.

## Variáveis de ambiente

Use `.env.example` como referência. Nunca versione `.env.local`, chaves secretas ou senhas.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=CHAVE_PUBLICA_DO_SUPABASE
SUPABASE_SECRET_KEY=sb_secret_...
SESSION_SECRET=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
AGENDAMENTOS_SYNC_TOKEN=TOKEN_FORTE_E_EXCLUSIVO
TV_ACCESS_TOKEN=OUTRO_TOKEN_FORTE_E_EXCLUSIVO
```

> `NEXT_PUBLIC_SUPABASE_ANON_KEY` é pública/publishable. `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `AGENDAMENTOS_SYNC_TOKEN` e `TV_ACCESS_TOKEN` são segredos de servidor e nunca devem usar o prefixo `NEXT_PUBLIC_`.

Para projetos Supabase antigos, `SUPABASE_SERVICE_ROLE_KEY` permanece aceito como fallback da chave administrativa.

## Configuração do Supabase

Execute os scripts necessários no **SQL Editor** do Supabase. Para uma instalação nova, use esta ordem:

1. `supabase-setup.sql` — estrutura principal de leads e pesquisas;
2. `supabase-revisoes.sql` — catálogo, revisões, serviços e mão de obra;
3. `supabase-agendamentos.sql` — agendamentos sincronizados;
4. `supabase-lead-reminders.sql` — lembretes vinculados aos leads;
5. `supabase-auth-usuarios.sql` — usuários internos e auditoria de autenticação;
6. `supabase-rev-mao-de-obra-admin.sql` — escrita de mão de obra restrita ao backend administrativo;
7. `supabase-tsi-detalhamento.sql` — notas por área usadas no detalhamento Top2Box.

O passo a passo completo da autenticação está em [AUTENTICACAO-SUPABASE-LEIA-ME.md](AUTENTICACAO-SUPABASE-LEIA-ME.md). Para a TV e o userscript de sincronização, consulte [AGENDAMENTOS-TV-LEIA-ME.md](AGENDAMENTOS-TV-LEIA-ME.md).

### Criar as contas iniciais com bcrypt

Defina temporariamente as três senhas no terminal e gere os hashes:

```bash
AUTH_PASSWORD_CONSULTOR='senha-forte' \
AUTH_PASSWORD_OFICINA='outra-senha-forte' \
AUTH_PASSWORD_ADMIN='mais-uma-senha-forte' \
npm run auth:hashes
```

O comando imprime um SQL seguro para inserir ou atualizar as três contas em `app_users`. As senhas em texto puro não são gravadas no projeto.

## Scripts

```bash
npm run dev          # desenvolvimento na porta 8080
npm run build        # build de produção
npm run start        # servidor de produção
npm run lint         # análise estática, após configurar o ESLint
npm run auth:hashes  # gera hashes bcrypt das contas iniciais
```

Para validar os tipos diretamente:

```bash
npx tsc --noEmit
```

## Estrutura resumida

```text
app/
├── admin/                 # painel administrativo
├── api/                   # autenticação, revisões e agendamentos
├── auth/                  # login e tratamento de erro
└── tv/agendamentos/       # painel da recepção
components/
├── admin/                 # editor administrativo
├── oficina/               # views da oficina
├── ui/                    # componentes reutilizáveis no padrão shadcn
└── views/                 # dashboard, leads, TSI e relatórios
lib/                       # autenticação, Supabase e regras de negócio
public/                    # logos, fontes, imagens e PWA
scripts/                   # utilitários locais
userscript/                # integração do MicroWork via Tampermonkey
```

## Segurança

- Sessões em cookie `HttpOnly`, `SameSite=Lax` e assinatura HMAC-SHA256;
- expiração e `session_version` para revogação global de sessões;
- senhas armazenadas somente como hash bcrypt;
- rate limit no login e logs básicos de auditoria;
- tabelas de autenticação bloqueadas para `anon` e `authenticated` via RLS;
- atualizações de mão de obra autorizadas somente para o papel `admin` por rota server-side.

## Deploy no Netlify

1. Configure todas as variáveis em **Site configuration → Environment variables**;
2. marque os valores sensíveis como secretos;
3. disponibilize as variáveis nos contextos de Production e Preview necessários;
4. execute as migrações no Supabase;
5. publique um novo deploy.

Depois do deploy, valide login, permissões de `/admin`, sincronização dos agendamentos, temas claro/escuro e as telas de oficina em desktop e mobile.

---

<div align="center">
  Desenvolvido para a operação da <strong>Alagoas Motos</strong>.
</div>
