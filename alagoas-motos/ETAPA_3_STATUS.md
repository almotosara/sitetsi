# Status — Etapa 3 (em andamento)

Trabalho feito nesta sessão em cima da Etapa 2:

## Corrigido: heurística de cruzamento modelo → grupo de mão de obra
A função antiga (`findGrupoMaoDeObra`, substring simples) errava em alguns casos:
- **Bug real**: modelos com hífen no próprio nome (ex: `X-ADV`) eram cortados errado pela
  lógica que tentava remover o intervalo de anos (`"X-ADV (2022 ~ 2024)"` virava só `"X"`,
  que batia com qualquer grupo contendo "X"). Corrigido: só separa em `" - "` (dash com
  espaço dos dois lados), não em qualquer hífen.
- **Match "primeiro que bater" causava falso positivo**: `X-ADV` batia com o grupo `ADV/
  PCX150/...` (errado) antes de chegar no grupo certo `X-ADV/ CB 1000R/...`. Corrigido:
  agora prioriza match exato, e entre matches por substring escolhe o token mais específico
  (mais longo), não o primeiro da lista.
- **Adicionado um 2º passo (fallback) por sobreposição de palavras**, pra pegar nomes com
  ordem diferente da tabela de mão de obra: `"CB 500 Hornet"` ↔ `"HORNET 500"`,
  `"AFRICA TW 1100 DCT"` ↔ `"CRF 1100L AFRICA TWIN"`, `"XRE 300 Sahara"` ↔ `"SAHARA 300"`.

Resultado: de 9 modelos que não achavam grupo nenhum, restou **1 caso genuíno sem solução
automática**: `FAN START CARGO 2025` — a Honda "Fan" não é citada por esse nome em nenhum
grupo da tabela de mão de obra (nem CG160, nem nada parecido textualmente). Não dá pra
inferir com segurança sem confirmação humana de qual grupo tarifário ela usa. Continuará
retornando `—` na tela ao invés de um valor estimado errado.

## Checado (dados)
- 3.390 peças no total; **0 com `valor_unitario` nulo**, mas **262 com `valor_unitario =
  0`** (~7,7%). Pode ser peça de garantia/cortesia real, ou lacuna da extração — não dá pra
  saber sem comparar com a planilha original linha a linha, que não está disponível aqui
  (só o JSON já extraído foi fornecido). Recomendo ao próximo agente (ou ao usuário) cruzar
  uma amostra dessas 262 linhas contra a planilha Honda original antes de confiar 100% nelas
  em orçamento pro cliente.

## Ainda pendente (não abordado nesta sessão, por falta de acesso/ambiente)
- **Build real** (`npm install && npm run build`): este ambiente não tem acesso à internet
  para instalar pacotes npm, então o build não foi testado de ponta a ponta aqui. Validar
  isso é o próximo passo antes de considerar o projeto pronto pra produção.
- **Responsividade mobile**: não trabalhada em nenhuma tela do app ainda.
- **Sidebar da oficina collapsible** igual ao painel de leads principal — ainda é só um
  `<aside>` fixo (era opcional desde a Etapa 2).
