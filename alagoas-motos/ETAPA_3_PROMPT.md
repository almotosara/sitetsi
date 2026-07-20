# Prompt para o próximo agente Claude — ETAPA 3 de 3

Contexto: projeto Next.js (App Router + Supabase) "Alagoas Motos". Login `oficina@alagoasmotos.com`
(senha `Oficina@01`) renderiza `components/oficina-shell.tsx`, um painel separado do painel de
leads normal, com dados de revisão/manutenção Honda vindos de `public/data/revisoes.json`.

## O que foi feito na Etapa 2 (pronta)
- **Nova aba "Consulta de Valores"**: busca por código ou descrição em `valores_mercadoria`
  (~3 mil itens), só renderiza resultados depois que o usuário digita algo, limitada a 50
  linhas visíveis por vez, com aviso de quantos resultados existem no total.
- **Estimativa de mão de obra**: quando `mao_de_obra_valor` é `null` e a revisão não é grátis,
  o código tenta achar o grupo certo em `mao_de_obra` (função `findGrupoMaoDeObra` em
  `oficina-shell.tsx`) comparando o nome do modelo (sem ano/parênteses) contra os tokens de
  cada grupo (separados por "/"), e calcula `tmo_horas × valor_hora_do_grupo`. Mostra um badge
  laranja "estimado" ao lado do valor quando isso acontece.
- **Highlight do termo buscado**: componente `<Highlight>` marca a parte do texto que bateu com
  a busca (usado nos nomes de modelo e na tabela de valores).
- **Revisões em abas**: em vez de empilhar todas as revisões de um modelo, agora há uma barra de
  abas horizontais (1ª · Xkm, 2ª · Ykm...) e só a revisão selecionada é renderizada.
- **Skeleton de loading**: substituído o texto "Carregando dados…" por blocos pulsantes
  (`<Skeleton>`), consistente com o resto do app.
- Visual já usava as variáveis CSS certas (`--bg-main`, `--card-bg`, etc.) e fonte Rajdhani —
  mantido.

## O que NÃO foi feito (ficou pra depois, era opcional na Etapa 2)
- **Sidebar da oficina não foi convertida pro componente collapsible** do painel de leads
  (`components/sidebar.tsx`). Ela ganhou só uma barrinha de destaque no item ativo. Se quiser
  handle de colapsar/expandir igual ao painel principal, ainda está pendente.

## Pontos de atenção para validar nesta Etapa 3 (o que ficou pra cá desde a Etapa 1)
1. **Qualidade da extração dos dados** (`public/data/revisoes.json`): o parser das planilhas
   Honda pode ter capturado algo errado em sheets com formato ligeiramente diferente — vale
   conferir alguns modelos manualmente contra a planilha original, principalmente:
   - Modelos cujo `mao_de_obra_valor` ficou `null` sem ser `mao_de_obra_gratis: true` (são os
     que agora dependem da estimativa — se o cruzamento por nome do grupo falhar silenciosamente,
     o app mostra "—" sem avisar; seria bom logar/expor quais modelos não bateram com nenhum
     grupo de `mao_de_obra`, pra facilitar auditoria).
   - Peças com `valor_unitario` ou `total` nulos/zerados.
2. **Heurística de cruzamento modelo → grupo de mão de obra** (`findGrupoMaoDeObra` em
   `components/oficina-shell.tsx`): é baseada em substring matching normalizado (maiúsculas,
   sem espaços/pontuação, removendo sufixo "I"). Funcionou bem nos ~49 modelos testados
   manualmente, mas não foi validada contra todos. Vale revisar casos como grupos genéricos
   ("MOTORES E MÁQUINAS") que podem casar por acidente com algum modelo.
3. **Responsividade mobile**: não foi trabalhada ainda (nem na oficina, nem no restante do app).
4. **Empacotamento final para deploy**: confirmar que o zip final builda limpo (`npm install &&
   npm run build`) antes de entregar — isso ainda não foi testado neste ambiente (sem acesso a
   npm/rede aqui).
5. Sidebar collapsible da oficina (ver acima), se quiser fechar esse gap.

## Arquivos alterados nesta Etapa 2
- `components/oficina-shell.tsx` (reescrito)
