import { hash } from 'bcryptjs'

const accounts = [
  {
    env: 'AUTH_PASSWORD_CONSULTOR',
    email: 'consultor@alagoasmotos.com',
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Consultor',
    role: 'consultor',
  },
  {
    env: 'AUTH_PASSWORD_OFICINA',
    email: 'oficina@alagoasmotos.com',
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Oficina',
    role: 'oficina',
  },
  {
    env: 'AUTH_PASSWORD_ADMIN',
    email: 'administrativo@alagoasmotos.com',
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Administrativo',
    role: 'admin',
  },
]

const missing = accounts.filter((account) => !process.env[account.env])
if (missing.length) {
  console.error(`Defina antes de executar: ${missing.map((account) => account.env).join(', ')}`)
  console.error('Exemplo (bash): AUTH_PASSWORD_CONSULTOR="..." AUTH_PASSWORD_OFICINA="..." AUTH_PASSWORD_ADMIN="..." npm run auth:hashes')
  process.exitCode = 1
} else {
  const withHashes = await Promise.all(accounts.map(async (account) => ({
    ...account,
    passwordHash: await hash(process.env[account.env], 12),
  })))

  const values = withHashes.map((account) => (
    `  ('${account.id}', '${account.email}', '${account.passwordHash}', '${account.name}', '${account.role}')`
  )).join(',\n')

  console.log('-- Cole no SQL Editor do Supabase após executar supabase-auth-usuarios.sql:')
  console.log('INSERT INTO public.app_users (id, email, password_hash, name, role)')
  console.log('VALUES')
  console.log(values)
  console.log('ON CONFLICT (email) DO UPDATE SET')
  console.log('  password_hash = EXCLUDED.password_hash,')
  console.log('  name = EXCLUDED.name,')
  console.log('  role = EXCLUDED.role,')
  console.log('  session_version = public.app_users.session_version + 1;')
}
