# Autenticação segura — configuração no Supabase

> Faça esta configuração **antes do primeiro deploy** do código novo. As contas antigas estavam no código e deixam de ser usadas após esta migração.

## 1. Instalar dependências

```bash
npm install
```

O projeto passa a usar `bcryptjs`, que é JavaScript puro e não exige compilação nativa.

## 2. Criar as tabelas protegidas

No painel do mesmo projeto configurado em `NEXT_PUBLIC_SUPABASE_URL`, abra **SQL Editor → New query**, cole todo o conteúdo de [`supabase-auth-usuarios.sql`](./supabase-auth-usuarios.sql) e execute.

O script cria:

- `app_users`: usuários internos, hash bcrypt, perfil e versão de sessão;
- `auth_audit_log`: auditoria de login bem-sucedido, falho e logout;
- índices, validações, RLS e policies restritivas;
- bloqueio explícito para os papéis públicos `anon` e `authenticated`.

Não crie policy pública de leitura ou escrita para essas tabelas. O backend acessa ambas exclusivamente com a chave Secret/service role.

## 3. Gerar os três hashes bcrypt

Use senhas fortes e diferentes. Elas são lidas apenas de variáveis temporárias do terminal e não são gravadas no projeto.

### PowerShell (Windows)

```powershell
$env:AUTH_PASSWORD_CONSULTOR="SENHA_FORTE_DO_CONSULTOR"
$env:AUTH_PASSWORD_OFICINA="SENHA_FORTE_DA_OFICINA"
$env:AUTH_PASSWORD_ADMIN="SENHA_FORTE_DO_ADMIN"
npm run auth:hashes
```

### Bash

```bash
AUTH_PASSWORD_CONSULTOR='SENHA_FORTE_DO_CONSULTOR' \
AUTH_PASSWORD_OFICINA='SENHA_FORTE_DA_OFICINA' \
AUTH_PASSWORD_ADMIN='SENHA_FORTE_DO_ADMIN' \
npm run auth:hashes
```

O comando imprime um `INSERT ... ON CONFLICT`. Copie somente esse SQL e execute no SQL Editor. Nunca salve as senhas ou hashes num arquivo `.env` versionado.

## 4. Variáveis de ambiente

Confirme no ambiente local e no provedor de deploy:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=CHAVE_PUBLICA_USADA_PELO_RESTANTE_DO_SITE
SUPABASE_SECRET_KEY=sb_secret_...
SESSION_SECRET=SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
```

Para projetos antigos, `SUPABASE_SERVICE_ROLE_KEY` continua sendo aceito como fallback. Use apenas uma chave Secret/service role no servidor; nunca coloque essa chave em variável `NEXT_PUBLIC_*`.

Gere `SESSION_SECRET` com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

No Netlify, marque `SUPABASE_SECRET_KEY` e `SESSION_SECRET` como valores secretos e disponibilize-os em **Production** e nos contextos de deploy que realmente serão usados.

## 5. Validar

1. Faça um novo deploy depois de criar as contas e configurar as variáveis.
2. Apague o cookie antigo `am_session` ou simplesmente abra uma janela anônima.
3. Teste consultor, oficina e administrativo.
4. Confirme que somente o administrativo abre `/admin`.
5. Verifique em `auth_audit_log` os eventos de login e logout.
6. Confirme em **Database → Tables → app_users/auth_audit_log** que RLS permanece habilitado e que não há policy permissiva para `anon`/`authenticated`.

Para revogar todas as sessões de uma conta, incremente a versão:

```sql
UPDATE public.app_users
SET session_version = session_version + 1
WHERE email = 'consultor@alagoasmotos.com';
```
