-- Alagoas Motos — usuários internos, revogação de sessão e auditoria
-- Execute no SQL Editor do mesmo projeto apontado por NEXT_PUBLIC_SUPABASE_URL.

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('consultor', 'oficina', 'admin')),
  session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT app_users_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT app_users_password_bcrypt CHECK (
    password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_lower
  ON public.app_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_app_users_role
  ON public.app_users (role);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_users FROM anon, authenticated;

DROP POLICY IF EXISTS deny_public_app_users ON public.app_users;
CREATE POLICY deny_public_app_users
  ON public.app_users
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event TEXT NOT NULL CHECK (event IN ('login_success', 'login_failed', 'logout')),
  email TEXT,
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_email_created
  ON public.auth_audit_log (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created
  ON public.auth_audit_log (created_at DESC);

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_audit_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.auth_audit_log_id_seq FROM anon, authenticated;

DROP POLICY IF EXISTS deny_public_auth_audit_log ON public.auth_audit_log;
CREATE POLICY deny_public_auth_audit_log
  ON public.auth_audit_log
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTAS INICIAIS
-- 1. Rode `npm run auth:hashes` com as três variáveis descritas no README.
-- 2. Substitua cada <HASH_BCRYPT_...> abaixo pelo hash completo de 60 caracteres.
-- 3. Somente então remova o comentário do bloco INSERT e execute-o.
-- Nunca coloque senhas em texto puro neste arquivo.
-- ═════════════════════════════════════════════════════════════════════════════

/*
INSERT INTO public.app_users (id, email, password_hash, name, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'consultor@alagoasmotos.com', '<HASH_BCRYPT_CONSULTOR>', 'Consultor', 'consultor'),
  ('00000000-0000-0000-0000-000000000002', 'oficina@alagoasmotos.com', '<HASH_BCRYPT_OFICINA>', 'Oficina', 'oficina'),
  ('00000000-0000-0000-0000-000000000003', 'administrativo@alagoasmotos.com', '<HASH_BCRYPT_ADMIN>', 'Administrativo', 'admin')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  session_version = public.app_users.session_version + 1;
*/

-- Para revogar imediatamente todas as sessões de uma conta:
-- UPDATE public.app_users
-- SET session_version = session_version + 1
-- WHERE email = 'consultor@alagoasmotos.com';
