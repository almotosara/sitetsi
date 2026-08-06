# Painel administrativo de Valores e Mercadorias — passo a passo

## 1. Criar as tabelas e importar os dados (Supabase)

1. Entre em https://supabase.com/dashboard → seu projeto → **SQL Editor** → **New query**.
2. Abra o arquivo `supabase-revisoes.sql` (na raiz do projeto), copie **tudo** e cole no editor.
3. Clique em **Run**. Ele cria as tabelas, libera o acesso, liga o Realtime e importa
   todos os 46 modelos, 322 revisões, ~3.000 mercadorias do catálogo e 2.556 itens
   que estavam no `public/data/revisoes.json`.

> Rodar o arquivo de novo apaga e recria só essas tabelas `rev_*` (os dados de leads,
> TSI, chat etc. não são tocados). Depois que você começar a editar valores, **não rode
> de novo**, senão as edições voltam ao valor original.

## 2. Publicar no Netlify

1. Descompacte o zip e suba o projeto (arrastar a pasta no Netlify, ou `git push` se
   estiver ligado ao repositório).
2. Em **Site settings → Environment variables**, confirme que existem:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. O `netlify.toml` já está configurado (`npm run build` + plugin Next.js).

## 3. Acessar o painel

- URL: `https://SEU-SITE.netlify.app/admin`
- Login: `administrativo@alagoasmotos.com`
- Senha: `AL@Adm01`

O usuário administrativo cai direto no painel ao logar. As outras contas (consultor e
oficina) não conseguem abrir `/admin` nem digitando a URL — são redirecionadas.

### O que dá pra fazer no painel
- **Revisões**: escolher modelo → revisão, editar km, meses, mão de obra (com opção
  "gratuita"), editar código/descrição/quantidade/valor unitário de cada mercadoria,
  adicionar mercadoria (do catálogo ou cadastrando uma nova) e remover mercadoria da
  revisão (sem apagar do catálogo).
- **Serviços avulsos**: mesmo controle (mão de obra + mercadorias), com criar/excluir
  serviço. Já vem com "Troca de óleo" de exemplo.
- **Catálogo de mercadorias**: busca por código/descrição, edição do valor padrão e
  cadastro de mercadoria nova. O mesmo código é reaproveitado entre revisões.

Toda edição é salva ao sair do campo (blur) e aparece **na hora** na aba
"Ver valores de revisões" da oficina, sem recarregar a página (Supabase Realtime).

## 4. Endpoint público de dados

**URL final: `https://SEU-SITE.netlify.app/api/revisoes`**

- Método `GET`, sem login, sem cache (`Cache-Control: no-store`), CORS liberado.
- Retorna sempre o estado atual do banco.

Formato:

```json
{
  "atualizado_em": "2026-08-03T18:00:00.000Z",
  "modelos": [
    {
      "modelo": "Pop 110i ES (2025 a 2027)",
      "periodo": "2025-2026",
      "revisoes": [
        {
          "numero": 1,
          "km": 1000,
          "meses": 6,
          "tmo_horas": null,
          "pecas": [
            { "codigo": "1002", "descricao": "ÓLEO PRÓ HONDA 10W30", "quantidade": 0.8, "valor_unitario": 64.99, "total": 51.99 }
          ],
          "servicos": [{ "servico": "...", "acao": "..." }],
          "pecas_total": 91.02,
          "mao_de_obra_gratis": true,
          "mao_de_obra_valor": null,
          "total": 91.02
        }
      ]
    }
  ],
  "servicos_avulsos": [
    { "nome": "Troca de oleo", "mao_de_obra_valor": null, "mercadorias": [], "pecas_total": 0, "total": 0 }
  ],
  "mao_de_obra": [{ "modelos": "POP 110i", "tmo_hora_valor": 80, "revisao_geral_valor": 120 }],
  "valores_mercadoria": [{ "codigo": "1002", "descricao": "ÓLEO PRÓ HONDA 10W30", "valor": 64.99 }]
}
```

A estrutura de `modelos`, `mao_de_obra` e `valores_mercadoria` é **idêntica** à do antigo
`public/data/revisoes.json`, então qualquer consumidor que já lia aquele arquivo funciona
só trocando a URL.

## 5. O que mudou no código

| Arquivo | Mudança |
| --- | --- |
| `supabase-revisoes.sql` | **novo** — schema + dados + Realtime |
| `lib/revisoes-db.ts` | **novo** — monta o JSON a partir do banco |
| `app/api/revisoes/route.ts` | **novo** — endpoint público |
| `app/admin/page.tsx` | **novo** — rota protegida do painel |
| `components/admin/admin-panel.tsx` | **novo** — interface do painel |
| `lib/auth.ts` | conta `administrativo@alagoasmotos.com` com papel `admin` |
| `middleware.ts` | protege `/admin`, libera `/api/revisoes`, manda o admin pro painel |
| `app/page.tsx` | admin logado é redirecionado para `/admin` |
| `components/oficina-shell.tsx` | passou a ler `/api/revisoes` + Realtime |

`public/data/revisoes.json` continua no projeto apenas como backup — o app não usa mais.

## 6. Observações

- O userscript (`userscript/microwork-autofill_final.user.js`) **não foi alterado**,
  conforme combinado. Para integrá-lo, aponte-o para a URL do item 4.
- O controle de acesso do painel usa o mesmo mecanismo de login por cookie que o app já
  tinha. As tabelas `rev_*` aceitam escrita com a anon key (mesmo padrão das outras
  tabelas do projeto); se quiser endurecer isso depois, é trocar as políticas por
  autenticação Supabase real.

---

## Novidades desta versão (painel da oficina)

### 1. Card "Prazo de garantia das revisões" (aba Consulta de Revisão)
No topo da aba, antes da grade de motos. O consultor informa a **data de compra**
(e opcionalmente o modelo) e vê a linha do tempo das revisões com a data limite
de cada uma, quais venceram e qual é a **próxima revisão ainda coberta**.
Os meses vêm do próprio `/api/revisoes` (campo `meses` de cada revisão); sem
modelo selecionado usa o prazo mais comum da base como referência.
É só informativo — não grava nada.

### 2. Nova aba "Calculadora de TMO" (troca de peça avulsa)
Calcula `mão de obra = valor_hora_do_grupo × TMO_da_peça` e o total com a peça.
A peça pode vir do cadastro (`valores_mercadoria`) ou ser digitada manualmente;
o valor da hora vem do grupo de mão de obra do modelo (`rev_mao_de_obra`) ou manual.

O botão **"Abrir OS desta troca"** abre o MicroWork com estes parâmetros novos
(gerados por `urlTrocaPeca()` em `lib/motos-catalog.ts`):

| Parâmetro | Conteúdo |
|---|---|
| `am_tipo=troca_peca` | identifica o fluxo (≠ `revisao` / `troca_oleo`) |
| `am_modelo` | modelo da moto, quando selecionado |
| `am_peca_codigo` | código da mercadoria (ausente se valor manual) |
| `am_peca_desc` | descrição da peça |
| `am_peca_valor` | valor unitário da peça (número puro, ponto decimal) |
| `am_mo` | mão de obra já calculada → campo **Valor Hora** |
| `am_tipo_os=7` | tipo de OS: `7 - EXTERNO EXPRESSO` |
| `am_servico=1775` | serviço `TROCA DE PEÇAS (1775)` |
| `am_tmo=1` | TMO fixo do MicroWork para esse serviço |
| `am_auto=1` | liga o autofill |

O userscript `userscript/microwork-autofill_final.user.js` **ainda não trata**
`am_tipo=troca_peca` — esse é o próximo passo.

### 3. Sidebar redesenhada
Sem GSAP, transições mais suaves, grupos ("Oficina" / "Ferramentas"), indicador
de item ativo e tooltip quando recolhida. Mantém colapsar, avatar/conta,
toggle de tema e sair.
