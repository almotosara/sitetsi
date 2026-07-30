# Prompt para agente Claude — pendências do painel da oficina (Alagoas Motos)

## Contexto do que já foi feito

O painel da oficina (`components/oficina-shell.tsx`) agora abre uma **galeria de motos com foto**,
no estilo do site oficial alagoasmotos.com.br, no lugar da lista de texto de revisões.

Arquivos novos/alterados:

- `lib/motos-catalog.ts` — categorias (City, Scooter, Street, Trail/Adventure, Big Trail/Esportivas,
  Outros), mapeamento **modelo do `revisoes.json` → foto em `/public/motos/*.webp`**,
  `nomeCurto()`, `anosDoModelo()` e `urlOrdemServico()` (monta a URL do MicroWork Cloud).
- `lib/revisoes-calc.ts` — `fmtBRL()`, `estimarMaoDeObra()`, `totalRevisao()` (extraído do shell).
- `components/oficina/motos-view.tsx` — galeria + tela de detalhe com os botões
  **“Abrir ordem de serviço”** e **“Ver valores de revisões”** (área marcada em azul no print).
- `public/motos/*.webp` — fotos enviadas, convertidas e renomeadas por slug.
- `userscript/microwork-autofill_final.user.js` — v0.6, agora lê os parâmetros da URL e dispara o
  autofill quando a placa/chassi é informada.

Handshake dashboard → MicroWork:

```
https://microworkcloud.com.br/cloud/?am_modelo=<modelo>&am_rev=<n>&am_km=<texto>&am_auto=1#/servico/os/inserir
```

O userscript casa `am_modelo` com as chaves de `REVISOES_POR_MODELO` (normalização alfanumérica +
melhor prefixo), mostra um balão no canto inferior esquerdo e **fica esperando o campo de
placa/chassi ficar estável (≥5 caracteres por 1,2s)** para chamar `rodarTudo()`. Há também o botão
“Preencher agora” caso o operador prefira acionar manualmente.

## Pendências que precisam ser feitas COM acesso real ao MicroWork Cloud

Não consigo validar isso sem estar logado no sistema — precisa ser conferido em tela:

1. **Seletor do campo de placa/chassi.**
   Em `microwork-autofill_final.user.js`, função `amCampoVeiculo()`, hoje tento nesta ordem:
   `inputPorLabel('Placa')`, `inputPorLabel('Chassi')`, `inputPorLabel('Veículo')`,
   `input[placeholder*="placa"]`, `input[placeholder*="chassi"]`.
   **Tarefa:** abrir `#/servico/os/inserir`, inspecionar o campo real e ajustar o seletor
   (label exato / `formcontrolname` / `id` do Kendo). Se o veículo for escolhido por um combobox
   Kendo em vez de digitação livre, trocar a checagem de “valor estável” por um listener no
   `change` do componente.

2. **Códigos de serviço/mercadoria por revisão.**
   `configurarCfgParaSelecao()` ainda cai no fallback da 1ª revisão para várias revisões/modelos
   (o script avisa com `confirm()`). **Tarefa:** completar as tabelas de códigos por
   modelo × número da revisão.

3. **Timing dos combos Kendo.**
   Os `sleep()` foram calibrados sem rede real. Se algum autocomplete falhar, aumentar os tempos em
   `preencherComboKendo()` / `esperarOpcaoKendo()`.

4. **Fotos faltando.**
   Modelos sem foto correspondente caem numa imagem genérica com `opacity: .45`
   (`visualDoModelo().temFotoPropria === false`). **Tarefa:** completar `public/motos/` e o mapa em
   `lib/motos-catalog.ts` conforme novas fotos chegarem.

5. **Duplicidade nos dados.**
   `public/data/revisoes.json` tem “SH 150i (2017 ~ 2019)” repetido. A UI já tolera (key com índice),
   mas o ideal é limpar o JSON na origem.

## Como rodar

```bash
npm install
npm run dev
```

O userscript fica em `userscript/microwork-autofill_final.user.js` (instalar no Tampermonkey).
