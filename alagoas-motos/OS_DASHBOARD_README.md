# Dashboard de Ordens de Serviço — mudanças aplicadas

Esta entrega adiciona a **Dashboard de O.S.** como tela principal da conta
`oficina@alagoasmotos.com`, sem tocar em nada de TSI/consultor.

## Arquivos novos
- `lib/os-types.ts` — tipos da linha de O.S.
- `lib/os-parser.ts` — parser da planilha `.xlsx` do Microwork Cloud (Relatório de O.S. por data), tratando cabeçalhos `Empresa:`/`Consultor:` e ignorando subtotais.
- `components/os/OSDashboard.tsx` — dashboard escura estilo "Stakent", isolada do tema claro/escuro do restante do sistema (usa `className="os-dashboard"` como escopo).
- `app/actions-os.ts` — server actions `getOsLinhas` / `replaceOsLinhas` gravando em `public.os_linhas` no Supabase (userId fixo da conta oficina).
- `supabase-setup-os.sql` — migração da tabela `os_linhas` + grants + RLS.

## Arquivos modificados
- `components/oficina-shell.tsx` — agora é um wrapper fino que renderiza `OSDashboard`. O manual de manutenção anterior virou uma **aba secundária** (renderiza `OficinaManualShell`).
- `components/oficina-manual-shell.tsx` — é o antigo `oficina-shell.tsx`, apenas renomeado (função exportada agora se chama `OficinaManualShell`). Nenhum comportamento foi alterado.
- `package.json` — adicionada dependência `recharts` (sparklines dos cards).

## Nada de TSI foi tocado
Confirmados intactos: `components/app-shell.tsx`, `components/views/tsi-*.tsx`, tabelas `tsi_data`/`tsi_resend`, actions `getTsiData`/`replaceTsiData`/`getTsiResend`/`replaceTsiResend`/`markTsiResendSent`.

## Como rodar
1. `pnpm install` (ou npm/yarn) para pegar `recharts`.
2. Rode `supabase-setup-os.sql` no SQL editor do Supabase.
3. `pnpm dev`, logue como `oficina@alagoasmotos.com` → a Dashboard de O.S. abre por padrão.
4. Clique em **Importar planilha** e selecione o `.xlsx` exportado do Microwork Cloud.

## Persistência

A versão do preview no Lovable usa `localStorage` (sem backend). No projeto
Next.js entregue no zip, os componentes já estão prontos para trocar o
`localStorage` pelas server actions `getOsLinhas`/`replaceOsLinhas` — basta
substituir as duas chamadas em `OSDashboard.tsx` (`useEffect` inicial e
`persist`) pelas actions. A estrutura do modelo é a mesma, então isso é
trivial e não muda a UI.

## Escopo desta planilha (limitação conhecida)
A planilha do Microwork **não traz peças item-a-item**. Por isso:
- "Serviços e valores" = tabela detalhada por linha (é o que a planilha oferece).
- "Materiais utilizados" = **resumo por Tipo O.S.** (linhas + soma de `Total Mercadoria`), com filtro por modelo.

Quando o Microwork exportar granularidade de peça, essas abas podem ser refinadas.
