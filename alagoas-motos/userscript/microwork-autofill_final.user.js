// ==UserScript==
// @name         MicroWork Cloud DMS - Autofill (painel Alagoas Motos)
// @namespace    alagoasmotos
// @version      0.12.0
// @description  Autofill automático da OS, disparado só pelo painel da oficina (via parâmetros am_* na URL). Sem menu manual dentro do MicroWork.
// v0.7: seletor de placa/chassi corrigido para o HTML real (kendo-autocomplete
//   com placeholder="placa"/"chassi", sem <label>). Antes, quando o operador
//   digitava só no campo chassi (placa não identificada), o script continuava
//   olhando o campo placa vazio e nunca disparava o autofill; agora checa os
//   dois campos e usa o que tiver conteúdo (placa tem prioridade).
// v0.8: mercadorias específicas da 2ª revisão por família de modelo (POP,
//   BIZ125, PCX160, ELITE, ADV, X-ADV, TITAN, START/FAN/CARGO, NXR160/BROS,
//   XRE190, TRX420, TWISTER, SAHARA/XRE300) — sem SILICONE em nenhuma, sem
//   arruela do dreno na BIZ. "Revisão totalmente configurada" agora exige
//   tipo de ordem + serviço + mercadorias específicas; sem isso o confirm()
//   continua avisando que vai usar valores base da 1ª revisão.
// v0.9: troca de óleo avulsa (tipo 7 / serviço 24) e o fallback genérico de
//   mercadorias agora usam o ÓLEO CERTO por família de modelo — antes o
//   código ficava sempre fixo em 1002 (óleo de moto normal), inclusive nas
//   scooters (PCX, Elite, ADV, X-ADV, SH150i), que usam o óleo de scooter
//   082332MB024. Quantidade por modelo também revisada (TRX420 2,7L,
//   Twister/Sahara/XRE300 1,6L, etc.).
// v0.9.1: leitura do parâmetro am_tipo (vindo do botão "Serviço avulso >
//   Troca de óleo" do painel da oficina) agora tolera espaço/maiúsculas
//   extras. Se o balão ainda aparecer como "1ª revisão" ao clicar em
//   "Troca de óleo" no painel, é sinal de que este arquivo está
//   desatualizado no Tampermonkey — reinstale-o (o Tampermonkey NÃO
//   atualiza sozinho porque este script não tem @updateURL).
// v0.10: revisões da 3ª em diante: tipo de ordem 5 (REVISÃO PERIÓDICA),
//   preenchimento do campo "Valor Hora" (mão de obra vinda do painel /api/revisoes),
//   segundo item de serviço de cortesia (tipo 36 / serviço 2718 = óleo grátis)
//   quando a revisão está dentro da garantia, vínculo de cada mercadoria ao
//   serviço certo via "Serviço aplicação" (óleo -> 2718, resto -> serviço de km),
//   e modo "revisão geral" (fora da garantia: um único serviço pago, óleo como
//   mercadoria normal) recebido via am_geral/am_mo na URL.
// v0.11: removido o menu manual (botão flutuante 🔧, overlay de categorias/
//   modelos/revisões e a leitura de mão de obra direto da API do painel via
//   fetch). Esse fluxo nunca era usado em produção — o painel sempre abre a
//   OS com os parâmetros am_modelo/am_rev/am_km/am_mo/am_geral/am_tipo já na
//   URL, então o script só precisa do listener desses parâmetros + do
//   balãozinho "Preencher agora". Reduz ~440 linhas (CATEGORIAS, ICONS,
//   CSS/HTML do menu, render dos 3 painéis, fetch em PAINEL_API_URL) sem
//   tirar nenhuma funcionalidade usada. Continuam intactos: REVISOES_POR_MODELO
//   (usado por amAcharChaveModelo pra casar o nome do modelo vindo da URL) e
//   toda a lógica de configurarCfgParaSelecao.
// v0.12: código de "Serviço" da 3ª revisão em diante deixou de ser tabela
//   fixa no script (SERVICO_KM_POR_REVISAO com TODO/null). Agora vem pelo
//   parâmetro am_servico_km na URL, preenchido pelo painel a partir do campo
//   "Código de Serviço (MicroWork)" no admin — mesmo lugar de onde já vinha
//   a mão de obra (am_mo). 1ª e 2ª revisão continuam fixas no script (1784/
//   1842), porque são o mesmo template em toda moto e não dependem do admin.
//   Enquanto o campo estiver vazio no admin pra uma revisão, o script segue
//   avisando com confirm() antes de preencher, exatamente como antes.
// @match        https://microworkcloud.com.br/cloud/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // CONFIGURAÇÃO — valores padrão usados pelo autofill.
  // O menu (mais abaixo) sobrescreve CFG.tipoCortesiaCodigo,
  // CFG.servicoCortesiaCodigo, CFG.mercadorias etc. de acordo com a
  // moto/revisão escolhida.
  // ═══════════════════════════════════════════════════════════════════
  const CFG = {
    fabricanteCodigo: '4',
    fabricanteMatch: '4 -', // início do texto da opção, evita mismatch por acento (Ô)
    // "Tipo de ordem de serviço": muda por revisão (1ª = 2, 2ª = 4, ...)
    tipoCortesiaCodigo: '2',
    tipoCortesia: '2 - 1ª REVISÃO GRATUITA EXPRESSO',
    // "Serviço": código específico por km da revisão (ex: 1000km = 1784)
    servicoCortesiaCodigo: '1784',
    servicoCortesiaMatch: '(1784)', // busca por código evita erro de acentuação (Ó)
    tmo: '1',
    vendedores: ['MACIEL ALVES DOS SANTOS', 'KAWANNY SILVA DA PAZ'],
    // Lista de itens de mercadoria a adicionar, na ordem. Cada item vira uma
    // linha na grid (clica "Salvar" entre eles, "Salvar e Fechar" no último).
    // Valores padrão = itens da 1ª revisão (mesmos para todas as revisões
    // por enquanto, só a quantidade do óleo 1002 muda por modelo).
    mercadorias: [
      { codigo: '1002', match: '1002', quantidade: '1' },
      { codigo: '1003', match: '1003', quantidade: '1' },
      { codigo: '1007', match: '1007', quantidade: '1' },
      { codigo: '90401KRMR20', match: '90401KRMR20', quantidade: '1' },
    ],
    formaPagamento: 'DINHEIRO',
    // ── novidades v0.10 ──────────────────────────────────────────────
    // "Valor Hora" (mão de obra) do serviço principal, já em formato BR
    // ('185,90') ou null quando não se aplica (1ª/2ª revisão = cortesia).
    valorHora: null,
    // true = revisão geral (cliente fora da garantia): um serviço só, pago.
    geral: false,
    // Segundo item de serviço (cortesia do óleo). null = não adicionar.
    // { tipoCodigo, tipoMatch, servicoCodigo, servicoMatch, tmo, valor }
    segundoServico: null,
  };


  // ═══════════════════════════════════════════════════════════════════
  // UTILITÁRIOS GERAIS  (idênticos ao script original)
  // ═══════════════════════════════════════════════════════════════════

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Dispara eventos nativos compatíveis com Angular (necessário pois Angular
  // "escuta" os eventos reais do DOM, e setar .value direto não dispara nada sozinho)
  function setValorInput(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  // Igual ao setValorInput, mas também dispara blur/focusout — necessário pros
  // kendo-maskedtextbox/numerictextbox (como o TMO), que só gravam o valor no
  // modelo Angular quando o campo perde o foco. Não usar em campos de autocomplete
  // (o blur fecha o dropdown antes de escolher a opção).
  function setValorInputComBlur(input, valor) {
    setValorInput(input, valor);
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    input.dispatchEvent(new Event('focusout', { bubbles: true }));
  }

  // Formata um número em reais no padrão que os campos monetários do Kendo
  // (MicroWork) aceitam: vírgula decimal, sem separador de milhar e sem "R$".
  // Ex.: 185.9 -> '185,90'  |  0 -> '0,00'
  function formatarMoedaBR(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(2).replace('.', ',');
  }

  // Localiza o campo "Valor Hora" do modal de item de serviço. O MicroWork
  // não usa <label for>, então tentamos pelo texto do rótulo (mesmo padrão do
  // resto do script) e, como plano B, por aria-label/placeholder.
  function acharCampoValorHora() {
    const porLabel =
      inputPorLabel('Valor Hora') ||
      inputPorLabel('Valor hora') ||
      inputPorLabel('Vlr Hora') ||
      inputPorLabel('Valor da hora');
    if (porLabel) return porLabel;
    return (
      document.querySelector('input[aria-label*="alor" i][aria-label*="ora" i]') ||
      document.querySelector('input[placeholder*="alor" i][placeholder*="ora" i]') ||
      null
    );
  }

  // Digita num kendo-dateinput (datepicker/timepicker) dígito por dígito, simulando digitação
  // real. IMPORTANTE: KeyboardEvent sintético (dispatchEvent) NÃO insere caractere nenhum
  // sozinho — o navegador só "digita" de verdade em resposta a eventos reais de teclado, então
  // se o componente não escreve o valor manualmente no handler de keydown, nada acontece (foi
  // o que aconteceu: campo ficava selecionado e não mudava). execCommand('insertText') passa
  // pelo pipeline real de edição do navegador e dispara eventos 'input' nativos de verdade,
  // que é isso que o Kendo escuta pra atualizar o valor internamente.
  async function digitarMascarado(input, digitos) {
    input.focus();
    await sleep(100);
    input.setSelectionRange(0, input.value.length); // seleciona o conteúdo atual do campo
    await sleep(80);
    if (input.value.length) document.execCommand('delete', false, null);
    await sleep(80);
    for (const d of digitos) {
      document.execCommand('insertText', false, d);
      await sleep(120); // simula digitação real; rápido demais faz o parser do Kendo perder dígito
    }
    await sleep(150);
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    input.dispatchEvent(new Event('focusout', { bubbles: true }));
  }

  // Encontra o <input> associado a um <label> pelo texto (procura no container pai mais próximo)
  function inputPorLabel(textoLabel, { seletorInput = 'input', containerAncestralNivel = 3 } = {}) {
    const labels = Array.from(document.querySelectorAll('label, div, span'))
      .filter((el) => el.children.length === 0 && el.textContent.trim() === textoLabel);
    for (const label of labels) {
      let container = label;
      for (let i = 0; i < containerAncestralNivel; i++) {
        if (!container.parentElement) break;
        container = container.parentElement;
        const input = container.querySelector(seletorInput);
        if (input) return input;
      }
    }
    return null;
  }

  // Espera uma opção aparecer numa lista Kendo (autocomplete/dropdown) e retorna o elemento
  function esperarOpcaoKendo(textoContem, timeoutMs = 5000) {
    const alvo = textoContem.toUpperCase();
    return new Promise((resolve, reject) => {
      const checar = () => {
        const opcoes = Array.from(document.querySelectorAll('.k-list-item, [role="option"], li[role="option"]'));
        return opcoes.find((el) => el.textContent && el.textContent.toUpperCase().includes(alvo));
      };
      const jaExiste = checar();
      if (jaExiste) return resolve(jaExiste);
      const obs = new MutationObserver(() => {
        const achou = checar();
        if (achou) { obs.disconnect(); resolve(achou); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error(`Opção "${textoContem}" não apareceu na lista em ${timeoutMs}ms`)); }, timeoutMs);
    });
  }

  // Digita num combobox Kendo e clica na opção que contém o texto informado
  async function preencherComboKendo(input, textoBusca, textoOpcao) {
    input.focus();
    setValorInput(input, textoBusca);
    await sleep(400); // dá tempo do Kendo filtrar/chamar a API antes de procurar a opção
    const opcao = await esperarOpcaoKendo(textoOpcao);
    opcao.click();
    await sleep(200);
  }

  // Clica num elemento kendo-dropdownlist (abre popup) e seleciona a opção pelo texto
  async function selecionarDropdownKendo(elDropdown, textoOpcao) {
    const clicavel = elDropdown.querySelector('.k-input-inner') || elDropdown;
    clicavel.click();
    await sleep(300);
    const opcao = await esperarOpcaoKendo(textoOpcao);
    opcao.click();
    await sleep(200);
  }

  function clicarPorTitulo(titulo) {
    const el = document.querySelector(`[title="${titulo}"]`);
    if (!el) throw new Error(`Botão com title="${titulo}" não encontrado`);
    el.click();
  }

  // Clica um elemento disparando a sequência completa de eventos de mouse
  // (pointerdown/mousedown/mouseup/click). Botões Kendo (diretiva
  // kendoButton) às vezes não reagem a um .click() sintético puro — o
  // componente escuta os eventos de mouse reais pra acionar o handler
  // Angular, então simular só "click" pode não disparar o (click) do
  // Angular corretamente.
  function clicarElementoComEventosMouse(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  // Clica num botão pelo texto. Restringe a busca ao dialog/modal Kendo
  // visível mais recente quando houver um aberto (evita pegar um botão
  // de mesmo texto escondido em outro lugar da página), aceita match
  // parcial de texto (o textContent do <button> pode trazer espaços/
  // quebras de linha extras ao redor do texto real) e ignora botões
  // desabilitados.
  function clicarBotaoPorTexto(texto) {
    const alvo = texto.trim().toUpperCase();
    const dialogs = Array.from(document.querySelectorAll('kendo-dialog, .k-dialog, .k-window'));
    const escopo = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document;
    const btns = Array.from(escopo.querySelectorAll('button'));
    const candidatos = btns.filter((b) => {
      const t = b.textContent.replace(/\s+/g, ' ').trim().toUpperCase();
      return t === alvo || t.includes(alvo);
    });
    // Prefere match exato sobre match parcial (ex: "Salvar" exato antes de "Salvar e Fechar")
    const exato = candidatos.find((b) => b.textContent.replace(/\s+/g, ' ').trim().toUpperCase() === alvo);
    const btn = exato || candidatos[0];
    if (!btn) throw new Error(`Botão com texto "${texto}" não encontrado`);
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      throw new Error(`Botão "${texto}" está desabilitado — verifique se os campos obrigatórios foram preenchidos`);
    }
    clicarElementoComEventosMouse(btn);
  }

  function clicarAbaPorTexto(texto) {
    const abas = Array.from(document.querySelectorAll('[role="tab"] .k-link, li[role="tab"]'));
    const aba = abas.find((a) => a.textContent.trim() === texto);
    if (!aba) throw new Error(`Aba "${texto}" não encontrada`);
    aba.click();
  }

  // ═══════════════════════════════════════════════════════════════════
  // ETAPAS DO FLUXO — cada uma isolada, pra testar separadamente
  // (idênticas ao script original)
  // ═══════════════════════════════════════════════════════════════════

  // 1. Fabricante (aba Geral) — sempre "4 - MOTO HONDA DA AMAZÔNIA LTDA"
  async function passo1_fabricante() {
    const input = inputPorLabel('Fabricante');
    if (!input) throw new Error('Campo "Fabricante" não encontrado (verifique se está na aba Geral)');
    await preencherComboKendo(input, CFG.fabricanteCodigo, CFG.fabricanteMatch);
  }

  // 2. Copia a hora de "Data e hora emissão" para "Data previsão entrega"
  async function passo2_horaEntrega() {
    const campoEmissao = inputPorLabel('Data e hora emissão');
    const campoPrevisao = inputPorLabel('Data previsão entrega', { seletorInput: 'input[id^="timepicker"]' });
    if (!campoEmissao) throw new Error('Campo "Data e hora emissão" não encontrado');
    if (!campoPrevisao) throw new Error('Campo de hora (timepicker) de "Data previsão entrega" não encontrado');
    const valorEmissao = campoEmissao.value || campoEmissao.textContent || '';
    const match = valorEmissao.match(/(\d{2}):(\d{2})/);
    if (!match) throw new Error(`Não consegui extrair a hora de "${valorEmissao}"`);
    const horas = (parseInt(match[1], 10) + 1) % 24;
    const minutos = match[2];
    const digitos = `${String(horas).padStart(2, '0')}${minutos}`; // ex: "1541" (sem ":")
    await digitarMascarado(campoPrevisao, digitos);
  }

  // 3. Aba Serviços → adicionar o(s) item(ns) de serviço.
  //    - Serviço 1 ("principal"): tipo de ordem + serviço do km da revisão,
  //      TMO e, quando a revisão é paga, o campo "Valor Hora" (mão de obra
  //      vinda do painel / /api/revisoes).
  //    - Serviço 2 (opcional, CFG.segundoServico): cortesia do óleo
  //      (tipo 36 / serviço 2718 / TMO 1 / Valor Hora 0), usada nas revisões
  //      da 3ª em diante quando o cliente está DENTRO da garantia.
  async function passo3_servicoCortesia() {
    clicarAbaPorTexto('Serviços');
    await sleep(500);
    clicarPorTitulo('Inserir item de solicitação/cortesia');
    await sleep(600);

    // ── Serviço 1 ────────────────────────────────────────────────────
    await preencherItemServico({
      tipoCodigo: CFG.tipoCortesiaCodigo,
      tipoMatch: CFG.tipoCortesia,
      servicoCodigo: CFG.servicoCortesiaCodigo,
      servicoMatch: CFG.servicoCortesiaMatch,
      tmo: CFG.tmo,
      valorHora: CFG.valorHora,
    });

    const seg = CFG.segundoServico;
    if (!seg) {
      await sleep(300);
      clicarBotaoPorTexto('Salvar e Fechar');
      await sleep(500);
      return;
    }

    // ── Serviço 2 (cortesia do óleo) ─────────────────────────────────
    // "Salvar" grava a linha e mantém/reabre o formulário para o próximo item
    // (mesmo comportamento da grid de mercadorias).
    await sleep(300);
    clicarBotaoPorTexto('Salvar');
    await sleep(900);

    // Se o formulário tiver fechado depois do "Salvar", reabre.
    let tipoInput = inputPorLabel('Tipo de ordem de serviço', { seletorInput: 'input[kendosearchbar]' });
    if (!tipoInput) {
      clicarPorTitulo('Inserir item de solicitação/cortesia');
      await sleep(700);
    }

    await preencherItemServico({
      tipoCodigo: seg.tipoCodigo,
      tipoMatch: seg.tipoMatch,
      servicoCodigo: seg.servicoCodigo,
      servicoMatch: seg.servicoMatch,
      tmo: seg.tmo,
      valorHora: seg.valor,
    });

    await sleep(300);
    clicarBotaoPorTexto('Salvar e Fechar');
    await sleep(500);
  }

  // Preenche UM item de serviço no modal já aberto (não salva).
  async function preencherItemServico({ tipoCodigo, tipoMatch, servicoCodigo, servicoMatch, tmo, valorHora }) {
    // Tipo de ordem de serviço: busca pelo código (evita problema de match por acento)
    const tipoInput = inputPorLabel('Tipo de ordem de serviço', { seletorInput: 'input[kendosearchbar]' });
    if (!tipoInput) throw new Error('Campo "Tipo de ordem de serviço" não encontrado no modal');
    await preencherComboKendo(tipoInput, tipoCodigo, tipoMatch);
    await sleep(400);

    // IMPORTANTE: o Angular recria o <input> de "Serviço" ao habilitar o campo após
    // selecionar o Tipo — por isso reconsultamos pelo label em vez de reusar referência antiga
    const servicoInput = inputPorLabel('Serviço', { seletorInput: 'input[kendosearchbar]' });
    if (!servicoInput) throw new Error('Campo "Serviço" não encontrado no modal');
    await preencherComboKendo(servicoInput, servicoCodigo, servicoMatch);

    // TMO
    const horaInput = document.querySelector('input[aria-placeholder="999:99"]');
    if (horaInput) setValorInputComBlur(horaInput, '001:00');
    const tmoInput = document.querySelector('input[role="spinbutton"][aria-valuemax]');
    if (tmoInput) setValorInputComBlur(tmoInput, tmo);

    // Valor Hora (mão de obra). Só mexe no campo quando há valor definido —
    // nas revisões de cortesia (1ª/2ª) o campo continua intocado, como antes.
    if (valorHora != null && valorHora !== '') {
      await sleep(200);
      const valorHoraInput = acharCampoValorHora();
      if (!valorHoraInput) {
        console.warn('[autofill] Campo "Valor Hora" não encontrado — preencha manualmente:', valorHora);
        alert('Não encontrei o campo "Valor Hora" na tela.\nPreencha manualmente: ' + valorHora);
      } else {
        setValorInputComBlur(valorHoraInput, String(valorHora));
      }
    }
  }

  // 4. Aba Mercadorias → adicionar cada item da lista (CFG.mercadorias)
  // Fluxo real do sistema: clica "+" uma vez, depois para cada item digita
  // o código + quantidade e clica "Salvar" (isso grava a linha e limpa o
  // campo, mas mantém a mesma tela aberta). No ÚLTIMO item, clica
  // "Salvar e Fechar" pra confirmar tudo e fechar o modal.
  async function passo4_mercadoria() {
    clicarAbaPorTexto('Mercadorias');
    await sleep(500);

    const btnAdd = Array.from(document.querySelectorAll('kendo-grid button')).find((b) => b.querySelector('.fa-plus'));
    if (!btnAdd) throw new Error('Botão "+" de adicionar mercadoria não encontrado');
    btnAdd.click();
    await sleep(600);

    // Vendedor: só preenche se estiver vazio (uma vez só, vale pra tela toda)
    const vendedorInput = inputPorLabel('Vendedor');
    if (vendedorInput && !vendedorInput.value) {
      await preencherComboKendo(vendedorInput, CFG.vendedores[0].split(' ')[0], CFG.vendedores[0]);
    }

    const itens = CFG.mercadorias; // [{ codigo, match, quantidade }, ...]
    if (!itens || itens.length === 0) throw new Error('CFG.mercadorias está vazio — nada para adicionar');

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const ultimoItem = i === itens.length - 1;

      // Reconsulta o campo a cada iteração — o Angular recria o input
      // depois de cada "Salvar", então uma referência antiga pode ficar stale
      const mercadoriaInput = inputPorLabel('Mercadoria') || document.querySelector('input[placeholder="código ou descrição"]');
      if (!mercadoriaInput) throw new Error(`Campo de busca de mercadoria não encontrado (item ${i + 1}: ${item.codigo})`);
      await preencherComboKendo(mercadoriaInput, item.codigo, item.match);

      const qtdInput = inputPorLabel('Quantidade') || Array.from(document.querySelectorAll('input[role="spinbutton"]')).find((el) => !el.disabled);
      if (!qtdInput) throw new Error(`Campo "Quantidade" não encontrado (item ${i + 1}: ${item.codigo})`);
      setValorInputComBlur(qtdInput, String(item.quantidade));

      // "Serviço aplicação": vincula esta mercadoria a um dos serviços da OS.
      // Só é preenchido quando o item pede (ex.: óleo -> serviço 2718 de cortesia).
      // Sem isso, o sistema mantém o vínculo padrão (serviço principal).
      if (item.servicoAplicacao) {
        await sleep(250);
        const aplInput =
          inputPorLabel('Serviço aplicação', { seletorInput: 'input[kendosearchbar]' }) ||
          inputPorLabel('Serviço aplicação') ||
          inputPorLabel('Serviço de aplicação', { seletorInput: 'input[kendosearchbar]' }) ||
          inputPorLabel('Aplicação', { seletorInput: 'input[kendosearchbar]' });
        if (!aplInput) {
          console.warn('[autofill] Campo "Serviço aplicação" não encontrado — vincule manualmente o item', item.codigo, 'ao serviço', item.servicoAplicacao.codigo);
          alert(`Não encontrei o campo "Serviço aplicação".\nVincule manualmente a mercadoria ${item.codigo} ao serviço ${item.servicoAplicacao.codigo}.`);
        } else {
          await preencherComboKendo(aplInput, item.servicoAplicacao.codigo, item.servicoAplicacao.match);
        }
      }

      await sleep(400);

      if (ultimoItem) {
        clicarBotaoPorTexto('Salvar e Fechar');
        await sleep(600);
      } else {
        clicarBotaoPorTexto('Salvar');
        // Espera mais aqui: precisa dar tempo da grid atualizar (nova linha
        // aparece) e do campo de mercadoria ser limpo/recriado pelo Angular
        // antes de digitar o próximo item — clicar rápido demais no próximo
        // item faz o autocomplete anterior ainda estar "fechando" e o valor
        // do item seguinte não é reconhecido corretamente.
        await sleep(900);
      }
    }
  }

  // 5. Aba Forma Recebimento → sempre "1 - DINHEIRO"
  async function passo5_formaPagamento() {
    clicarAbaPorTexto('Forma Recebimento');
    await sleep(500);
    const dropdown = document.querySelector('kendo-dropdownlist');
    if (!dropdown) throw new Error('Dropdown de forma de pagamento não encontrado');
    await selecionarDropdownKendo(dropdown, CFG.formaPagamento);
  }

  // 6. Aba CheckList → pergunta se já foi vistoriado
  async function passo6_checklist() {
    clicarAbaPorTexto('CheckList');
    await sleep(500);
    const jaVistoriado = confirm('O veículo já foi vistoriado (checklist feito)?\n\nOK = Sim, foi vistoriado\nCancelar = Não foi vistoriado');
    if (!jaVistoriado) {
      const label = Array.from(document.querySelectorAll('label.mw-checkbox-label'))
        .find((l) => l.textContent.trim() === 'Veículo não vistoriado');
      if (!label) throw new Error('Checkbox "Veículo não vistoriado" não encontrado');
      label.click();
    } else {
      const campoChecklist = document.querySelector('input[placeholder="número checklist"]');
      if (!campoChecklist) throw new Error('Campo "número checklist" não encontrado');
      setValorInput(campoChecklist, '*');
      await sleep(500);
      // Seleciona o primeiro (mais recente) item que aparecer na lista
      const opcao = document.querySelector('.k-list-item, [role="option"]');
      if (opcao) opcao.click();
      else throw new Error('Nenhum checklist apareceu na lista — selecione manualmente');
    }
  }

  // Roda tudo em sequência, parando e avisando em qual passo travou
  async function rodarTudo() {
    const passos = [
      ['Fabricante', passo1_fabricante],
      ['Hora de entrega', passo2_horaEntrega],
      ['Serviço de cortesia', passo3_servicoCortesia],
      ['Mercadoria', passo4_mercadoria],
      ['Forma de pagamento', passo5_formaPagamento],
      ['Checklist', passo6_checklist],
    ];
    for (const [nome, fn] of passos) {
      try {
        await fn();
        console.log(`[autofill] ✅ ${nome} OK`);
      } catch (e) {
        console.error(`[autofill] ❌ Falhou em "${nome}":`, e);
        alert(`Travou na etapa "${nome}":\n${e.message}\n\nOs passos anteriores já foram aplicados. Corrija manualmente essa parte e me avise qual etapa falhou.`);
        return;
      }
    }
    alert('Preenchimento aplicado com sucesso! Confira antes de salvar a OS.');
  }

  const REVISOES_POR_MODELO = {
  "POP110i (2016 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000 KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000 KM OU 12 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:30",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12 000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18 000 KM OU 24 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24 000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30 000KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "POP110i ES (2025)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000 KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000 KM OU 12 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:30",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12 000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "KIT REVISÃO 12.000 / 24.000 KM",
      "km_meses": null
    },
    {
      "numero": 5,
      "titulo_raw": "4º REVISÃO 18 000 KM OU 24 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "5º REVISÃO 24 000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "KIT REVISÃO 12.000 / 24.000 KM",
      "km_meses": null
    },
    {
      "numero": 8,
      "titulo_raw": "6º REVISÃO 30 000KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 9,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "BIZ110i (2016 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)  TMO  00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:30",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12 000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18 000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24 000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30 000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "BIZ125 (2018 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12 000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18 000 KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24  000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30 00KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "3000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "BIZ 125 EX • BIZ 125 ES (2025)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12 000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18 000 KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24  000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30 00KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "3000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO )",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "ELITE 125 (2025)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000 KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12 000  KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18 000  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": null
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24 000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30 000 KM  OU  36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "PCX 160 (2023 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "ELITE 125 (2019 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 4000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "4000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 8000 KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "8000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 12000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 16000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "16000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 20000KM  OU  36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "20000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 24000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 42 meses"
    }
  ],
  "PCX 150 (2019 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "ADV (2021 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "X-ADV (2022 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) ( TMO 18 Min )",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO) ( TMO 24 Min )",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "SH 300i (2016 ~ 2021)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CG160 START (2016 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CG160 FAN-TITAN 2016 - 2024": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CG 160 TITAN (2025)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "FAN START CARGO 2025": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) TMO 00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "NXR160 BROS ESDD (2016 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "NXR160 CBS_ABS (2025)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "XRE 190 (2016 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) TMO  00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)  TMO 00:50",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "XRE 190 (2025 )": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) TMO  00:20",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)  TMO 00:50",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CRF 250 2024": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 150 KM OU 1 MES ( O QUE OCORRER PRIMEIRO) ( 100 MIN)",
      "km_meses": "150 KM ou 1 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 1000 KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) ( 600 MIN )",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 2000 KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO) ( 200 MIN )",
      "km_meses": "2000 KM ou 12 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "TRX420 QUADRICICLO ( 2008-2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 150 KM OU 1 MES ( O QUE OCORRER PRIMEIRO) ( 100 MIN)",
      "km_meses": "150 KM ou 1 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 1000 KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) ( 600 MIN )",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 2000 KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO) ( 200 MIN )",
      "km_meses": "2000 KM ou 12 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CB 250F TWISTER (2016 ~ 2022)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CB 300F TWISTER (2023 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "XRE 300 (2019 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "XRE 300 Sahara (2025)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "XR 300L Tornado (2025)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000KM OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000 KM OU 36 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 36 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36 000KM OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CB 500F (2020 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CB 500X ( 2020 - 2024 )": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CB 650R (2020 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CBR 650R (2020 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "NC 750X (2022 ~ 2024)": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) ( TMO 18 Min )",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO) ( TMO 24 Min )",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ],
  "CBR 1000 RR-R FIR(2022 ~2024": [
    {
      "numero": 1,
      "titulo_raw": "1º REVISÃO 1000KM OU 6 MESES ( O QUE OCORRER PRIMEIRO) ( TMO 18 Min )",
      "km_meses": "1000 KM ou 6 meses"
    },
    {
      "numero": 2,
      "titulo_raw": "2º REVISÃO 6000KM OU 12 MESES ( O QUE OCORRER PRIMEIRO) ( TMO 24 Min )",
      "km_meses": "6000 KM ou 12 meses"
    },
    {
      "numero": 3,
      "titulo_raw": "3º REVISÃO 12000KM  OU 18 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "12000 KM ou 18 meses"
    },
    {
      "numero": 4,
      "titulo_raw": "4º REVISÃO 18000KM  OU 24 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "18000 KM ou 24 meses"
    },
    {
      "numero": 5,
      "titulo_raw": "5º REVISÃO 24000 KM  OU 30 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "24000 KM ou 30 meses"
    },
    {
      "numero": 6,
      "titulo_raw": "6º REVISÃO 30000KM  OU 12 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "30000 KM ou 12 meses"
    },
    {
      "numero": 7,
      "titulo_raw": "7º REVISÃO 36000 KM  OU 42 MESES ( O QUE OCORRER PRIMEIRO)",
      "km_meses": "36000 KM ou 42 meses"
    }
  ]
};
  // ═══════════════════════════════════════════════════════════════════
  // MAPEAMENTO SERVIÇO/MERCADORIA — códigos internos do MicroWork Cloud.
  // Só "Troca de óleo" está configurado por enquanto (mesmos códigos do
  // script original). As demais revisões usam o mesmo serviço/mercadoria
  // base de troca de óleo até você me passar os códigos específicos de
  // cada revisão (kit de revisão, vela, filtro etc.) cadastrados no DMS.
  // ═══════════════════════════════════════════════════════════════════
  // Óleo (código + quantidade) por família de modelo. Motos "normais" usam
  // o óleo 1002; scooters (PCX, Elite, ADV, X-ADV, SH150i) usam o óleo de
  // scooter 082332MB024. Casa contra o nome do modelo NORMALIZADO (ver
  // amNorm mais abaixo) — a primeira regra que bater vence, por isso as
  // mais específicas (X-ADV antes de ADV, BIZ125EX antes de BIZ125) vêm
  // primeiro. Usado tanto na troca de óleo avulsa quanto no fallback
  // genérico de mercadorias das revisões ainda não configuradas.
  const OLEO_POR_MODELO = [
    { contem: ['BIZ125EX'], codigo: '1002', quantidade: '0,9' },       // "nova biz"
    { contem: ['BIZ125'], codigo: '1002', quantidade: '0,9' },
    { contem: ['BIZ110I'], codigo: '1002', quantidade: '0,8' }, // "biz 110"
    { contem: ['POP'], codigo: '1002', quantidade: '0,8' },
    { contem: ['PCX160'], codigo: '082332MB024', quantidade: '0,8' },
    { contem: ['PCX150'], codigo: '082332MB024', quantidade: '0,8' },
    { contem: ['ELITE'], codigo: '082332MB024', quantidade: '0,8' },
    { contem: ['XADV'], codigo: '082332MB024', quantidade: '0,8' },
    { contem: ['ADV'], exceto: ['XADV'], codigo: '082332MB024', quantidade: '0,8' },
    { contem: ['SH150'], codigo: '082332MB024', quantidade: '0,8' },
    { contem: ['TRX420'], codigo: '1002', quantidade: '2,7' },
    { contem: ['TWISTER'], codigo: '1002', quantidade: '1,6' },
    { contem: ['SAHARA'], codigo: '1002', quantidade: '1,6' },
    { contem: ['XRE300'], codigo: '1002', quantidade: '1,6' },
    // demais modelos (CG160 TITAN/START/FAN/CARGO, NXR160/BROS, XRE190 etc.)
    // usam 1002 na quantidade padrão de 1L até confirmar o contrário.
  ];

  function oleoParaModelo(nomeModelo) {
    const n = amNorm(nomeModelo || '');
    for (const r of OLEO_POR_MODELO) {
      if (r.exceto && r.exceto.some((e) => n.includes(e))) continue;
      if (r.contem.every((c) => n.includes(c))) return { codigo: r.codigo, quantidade: r.quantidade };
    }
    return { codigo: '1002', quantidade: '1' }; // padrão caso o modelo ainda não tenha sido configurado
  }

  // Mantido por compatibilidade — só a quantidade (assume código 1002).
  function quantidadeOleoParaModelo(nomeModelo) {
    return oleoParaModelo(nomeModelo).quantidade;
  }

  // "Tipo de ordem de serviço" por número de revisão.
  // 1ª revisão = código 2 ("2 - 1ª REVISÃO GRATUITA EXPRESSO")
  // 2ª revisão = código 4
  // 3ª em diante (dentro OU fora da garantia) = código 5 ("REVISÃO PERIÓDICA")
  const TIPO_ORDEM_POR_REVISAO = {
    1: { codigo: '2', match: '2 -' },
    2: { codigo: '4', match: '4 -' },
  };

  // A partir da 3ª revisão o tipo é sempre 5 — inclusive na "revisão geral"
  // (fora de garantia), que não tem tipo de ordem próprio no MicroWork.
  const TIPO_ORDEM_REVISAO_PERIODICA = { codigo: '5', match: '5 -' };

  function tipoOrdemParaRevisao(numero) {
    if (numero >= 3) return TIPO_ORDEM_REVISAO_PERIODICA;
    return TIPO_ORDEM_POR_REVISAO[numero] || null;
  }

  // Serviço de cortesia do óleo, adicionado como SEGUNDO item de serviço nas
  // revisões da 3ª em diante quando o cliente está dentro da garantia.
  // Tipo de ordem 36, serviço 2718, TMO 1, Valor Hora 0 (grátis).
  const SERVICO_OLEO_CORTESIA = {
    tipoCodigo: '36',
    tipoMatch: '36 -',
    servicoCodigo: '2718',
    servicoMatch: '(2718)',
    tmo: '1',
    valor: '0,00',
  };

  // "Serviço" por número de revisão — código específico pelo km da
  // revisão (ex: REVISÃO 1000 KM = código 1784, REVISÃO 6000 KM = 1842...).
  // O TMO é o mesmo (CFG.tmo) pra todas.
  //
  // 1ª e 2ª revisão usam o mesmo template de cortesia em toda moto Honda
  // (confirmado, não muda por modelo/ano), então ficam fixos aqui. Da 3ª em
  // diante o código depende do que está cadastrado no MicroWork Cloud pra
  // cada km — em vez de chutar ou deixar hardcoded, ele vem pronto do
  // painel via URL (parâmetro am_servico_km), que por sua vez lê o campo
  // "Código de Serviço" cadastrado no admin pra cada revisão (mesmo lugar
  // de onde já vem a mão de obra em am_mo). Ver amInit mais abaixo.
  const SERVICO_KM_REVISAO_1_2 = {
    1: { codigo: '1784', match: '(1784)' },  // REVISÃO 1000 KM — confirmado
    2: { codigo: '1842', match: '(1842)' },  // REVISÃO 6000 KM — confirmado
  };

  // codigoDoPainel = valor de am_servico_km, já resolvido pelo admin pra
  // essa revisão específica. null/undefined = ainda não cadastrado no
  // admin — nesse caso configuradoCompletamente fica false e o confirm()
  // avisa o operador antes de preencher a OS.
  function servicoKmParaRevisao(numero, codigoDoPainel) {
    const fixo = SERVICO_KM_REVISAO_1_2[numero];
    if (fixo) return fixo;
    const codigo = codigoDoPainel ? String(codigoDoPainel).trim() : '';
    if (!codigo) return null;
    return { codigo, match: `(${codigo})` };
  }

  const TROCA_OLEO = {
    tipoOrdem: { codigo: '7', match: '7 -' },
    servico: { codigo: '24', match: '(24)' },
    tmo: '1',
  };


  // Mercadorias específicas por família de modelo, por número de revisão.
  // "contem"/"exceto" casam contra o nome do modelo NORMALIZADO (maiúsculas,
  // sem acento, só A-Z0-9 — ver amNorm mais abaixo). A primeira regra que
  // bater vence, então regras mais específicas (ex: X-ADV antes de ADV)
  // devem vir primeiro dentro da lista de cada revisão.
  const MERCADORIAS_POR_REVISAO = {
    2: [
      { contem: ['BIZ125EX'], itens: [
        { codigo: '1002', quantidade: '0,9' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
        { codigo: '0123AK62305', quantidade: '1' },
      ] },
      { contem: ['BIZ125'], itens: [
        { codigo: '1002', quantidade: '0,9' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
        { codigo: '0123AK62305', quantidade: '1' },
      ] },
      { contem: ['POP'], itens: [
        { codigo: '1002', quantidade: '0,8' }, { codigo: '0123AK62305', quantidade: '1' },
        { codigo: '1003', quantidade: '1' }, { codigo: '1007', quantidade: '1' },
      ] },
      { contem: ['PCX160'], itens: [
        { codigo: '082332MB024', quantidade: '0,8' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['ELITE'], itens: [
        { codigo: '082332MB024', quantidade: '0,8' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['XADV'], itens: [
        { codigo: '082332MB024', quantidade: '0,8' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
        { codigo: '15410MFJD02', quantidade: '1' },
      ] },
      { contem: ['ADV'], exceto: ['XADV'], itens: [
        { codigo: '082332MB024', quantidade: '0,8' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '90401KRMR20', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['CG160TITAN'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['TITAN'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['CARGO'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['START'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['FAN'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['NXR160'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['BROS'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['XRE190'], itens: [
        { codigo: '1002', quantidade: '1' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: '0123BKRE305', quantidade: '1' },
        { codigo: 'GRA005', quantidade: '1' },
      ] },
      { contem: ['TRX420'], itens: [
        { codigo: '1002', quantidade: '2,7' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'H1541HM5A10', quantidade: '1' },
      ] },
      { contem: ['TWISTER'], itens: [
        { codigo: '1002', quantidade: '1,6' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
        { codigo: 'H1541HM5A10', quantidade: '1' }, { codigo: '91302KF0003', quantidade: '1' },
      ] },
      { contem: ['SAHARA'], itens: [
        { codigo: '1002', quantidade: '1,6' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
        { codigo: 'H1541HM5A10', quantidade: '1' }, { codigo: '91302KF0003', quantidade: '1' },
      ] },
      { contem: ['XRE300'], itens: [
        { codigo: '1002', quantidade: '1,6' }, { codigo: '1003', quantidade: '1' },
        { codigo: '1007', quantidade: '1' }, { codigo: 'GRA005', quantidade: '1' },
        { codigo: 'H1541HM5A10', quantidade: '1' }, { codigo: '91302KF0003', quantidade: '1' },
      ] },
    ],
    // demais revisões (1, 3, 4...) ainda usam a lista genérica em CFG.mercadorias
  };

  function mercadoriasEspecificasParaModeloRevisao(nomeModelo, numero) {
    const regras = MERCADORIAS_POR_REVISAO[numero];
    if (!regras) return null;
    const n = amNorm(nomeModelo || '');
    for (const r of regras) {
      if (r.exceto && r.exceto.some((e) => n.includes(e))) continue;
      if (r.contem.every((c) => n.includes(c))) {
        return r.itens.map((it) => ({ codigo: it.codigo, match: it.codigo, quantidade: it.quantidade }));
      }
    }
    return null;
  }

  function configurarCfgParaSelecao(selecao) {
    // Estado "limpo" a cada seleção — evita herdar Valor Hora/segundo serviço
    // de uma seleção anterior (o menu pode ser usado várias vezes na mesma aba).
    CFG.valorHora = null;
    CFG.geral = false;
    CFG.segundoServico = null;

    // Mercadorias: por padrão os mesmos 4 itens genéricos da 1ª revisão
    // (usados quando ainda não há uma tabela específica pra esse
    // modelo/revisão em MERCADORIAS_POR_REVISAO). O código e a quantidade
    // do óleo mudam conforme a família do modelo (scooter x moto normal).
    const oleo = oleoParaModelo(selecao.modelo || '');
    CFG.mercadorias = [
      { codigo: oleo.codigo, match: oleo.codigo, quantidade: oleo.quantidade },
      { codigo: '1003', match: '1003', quantidade: '1' },
      { codigo: '1007', match: '1007', quantidade: '1' },
      { codigo: '90401KRMR20', match: '90401KRMR20', quantidade: '1' },
    ];
    let mercadoriasConfiguradas = true; // Por padrão true, generic 4-item list é válido
    if (selecao.tipo === 'revisao') {
      const regrasDaRevisao = MERCADORIAS_POR_REVISAO[selecao.numero];
      if (regrasDaRevisao) {
        const especificas = mercadoriasEspecificasParaModeloRevisao(selecao.modelo, selecao.numero);
        if (especificas) {
          CFG.mercadorias = especificas;
          mercadoriasConfiguradas = true;
        } else {
          // Existe tabela para essa revisão, mas modelo não deu match
          mercadoriasConfiguradas = false;
        }
      }
    }

    if (selecao.tipo === 'troca_oleo') {
      // Troca de óleo avulsa: inalterada (tipo 7 / serviço 24 / TMO 1 / só o óleo)
      CFG.tipoCortesiaCodigo = TROCA_OLEO.tipoOrdem.codigo;
      CFG.tipoCortesia = TROCA_OLEO.tipoOrdem.match;
      CFG.servicoCortesiaCodigo = TROCA_OLEO.servico.codigo;
      CFG.servicoCortesiaMatch = TROCA_OLEO.servico.match;
      CFG.tmo = TROCA_OLEO.tmo;
      CFG.mercadorias = [{ codigo: oleo.codigo, match: oleo.codigo, quantidade: oleo.quantidade }];
      return { configuradoCompletamente: true };
    }

    if (selecao.tipo === 'troca_peca') {
      // Fluxo "troca de peça avulsa" (v0.13)
      CFG.tipoCortesiaCodigo = (selecao.tipoOs || '7');
      CFG.tipoCortesia = CFG.tipoCortesiaCodigo + ' -';
      CFG.servicoCortesiaCodigo = (selecao.servicoCodigo || '1775');
      CFG.servicoCortesiaMatch = `(${CFG.servicoCortesiaCodigo})`;
      CFG.tmo = (selecao.tmo || '1');
      const mo = Number(selecao.maoDeObra);
      CFG.valorHora = (Number.isFinite(mo) && mo > 0) ? formatarMoedaBR(mo) : null;
      
      if (selecao.pecaCodigo) {
        CFG.mercadorias = [{ 
          codigo: selecao.pecaCodigo, 
          match: selecao.pecaCodigo, 
          quantidade: '1',
          valor: selecao.pecaValor ? formatarMoedaBR(selecao.pecaValor) : undefined
        }];
      } else {
        CFG.mercadorias = [];
      }
      return { configuradoCompletamente: true };
    }

    if (selecao.tipo === 'revisao') {
      const numero = selecao.numero;
      const tipoOrdem = tipoOrdemParaRevisao(numero);
      const servicoKm = servicoKmParaRevisao(numero, selecao.servicoKmCodigo);
      const ehGeral = numero >= 3 && selecao.geral === true;
      CFG.geral = ehGeral;

      if (tipoOrdem) {
        CFG.tipoCortesiaCodigo = tipoOrdem.codigo;
        CFG.tipoCortesia = tipoOrdem.match;
      } else {
        CFG.tipoCortesiaCodigo = TIPO_ORDEM_POR_REVISAO[1].codigo;
        CFG.tipoCortesia = TIPO_ORDEM_POR_REVISAO[1].match;
      }

      if (servicoKm) {
        CFG.servicoCortesiaCodigo = servicoKm.codigo;
        CFG.servicoCortesiaMatch = servicoKm.match;
      } else {
        // Código do km desta revisão ainda não cadastrado no admin (campo
        // "Código de Serviço" vazio) — usa o da 1ª como base temporária e
        // devolve configuradoCompletamente=false (o confirm() avisa o
        // operador antes de qualquer preenchimento).
        CFG.servicoCortesiaCodigo = SERVICO_KM_REVISAO_1_2[1].codigo;
        CFG.servicoCortesiaMatch = SERVICO_KM_REVISAO_1_2[1].match;
      }

      // 1ª e 2ª revisão: cortesia total — nada de Valor Hora nem 2º serviço.
      if (numero < 3) {
        return {
          configuradoCompletamente: Boolean(tipoOrdem && servicoKm && mercadoriasConfiguradas),
        };
      }

      // 3ª em diante: mão de obra é cobrada (Valor Hora do painel).
      const mo = Number(selecao.maoDeObra);
      const temMaoDeObra = Number.isFinite(mo) && mo > 0;
      CFG.valorHora = temMaoDeObra ? formatarMoedaBR(mo) : null;

      const servicoPrincipal = servicoKm
        ? { codigo: servicoKm.codigo, match: servicoKm.match }
        : null;

      if (ehGeral) {
        // Fora da garantia: um único serviço (o de km, pago) e o óleo entra
        // como mercadoria comum, vinculada ao próprio serviço principal.
        CFG.segundoServico = null;
        CFG.mercadorias = CFG.mercadorias.map((it) => ({ ...it, servicoAplicacao: undefined }));
      } else {
        // Dentro da garantia: serviço de km (pago) + cortesia do óleo (2718),
        // com o óleo vinculado ao 2718 e o resto ao serviço de km.
        CFG.segundoServico = SERVICO_OLEO_CORTESIA;
        const codigosOleo = new Set(['1002', '082332MB024', oleo.codigo]);
        CFG.mercadorias = CFG.mercadorias.map((it) =>
          codigosOleo.has(it.codigo)
            ? {
                ...it,
                servicoAplicacao: {
                  codigo: SERVICO_OLEO_CORTESIA.servicoCodigo,
                  match: SERVICO_OLEO_CORTESIA.servicoMatch,
                },
              }
            : servicoPrincipal
              ? { ...it, servicoAplicacao: servicoPrincipal }
              : { ...it, servicoAplicacao: undefined }
        );
      }

      return {
        configuradoCompletamente: Boolean(
          tipoOrdem && servicoKm && mercadoriasConfiguradas && temMaoDeObra
        ),
      };
    }

    return { configuradoCompletamente: false };
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTEGRAÇÃO COM O PAINEL DA OFICINA (dashboard Alagoas Motos)
  //
  // O dashboard abre a OS assim:
  //   https://microworkcloud.com.br/cloud/?am_modelo=...&am_rev=2&am_km=...&am_auto=1#/servico/os/inserir
  //
  // Aqui a gente lê esses parâmetros, casa o modelo com as chaves de
  // REVISOES_POR_MODELO e fica AGUARDANDO a placa/chassi do veículo ser
  // informada na tela. Assim que o veículo é identificado, o autofill roda
  // sozinho (ou pelo botão do balão, se o operador preferir).
  // ═══════════════════════════════════════════════════════════════════

  function amNorm(s) {
    return String(s || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '');
  }

  // Casa o nome do modelo vindo do dashboard com a chave usada no menu.
  function amAcharChaveModelo(nomeExterno) {
    const alvo = amNorm(nomeExterno);
    if (!alvo) return null;
    const chaves = Object.keys(REVISOES_POR_MODELO);
    let melhor = null;
    let melhorScore = 0;
    for (const chave of chaves) {
      const k = amNorm(chave);
      if (k === alvo) return chave;
      let score = 0;
      if (k.includes(alvo) || alvo.includes(k)) score = Math.min(k.length, alvo.length);
      else {
        // sobreposição de prefixos alfanuméricos (ex: CB300F vs CB300FTWISTER)
        let i = 0;
        while (i < k.length && i < alvo.length && k[i] === alvo[i]) i++;
        score = i >= 5 ? i : 0;
      }
      if (score > melhorScore) { melhorScore = score; melhor = chave; }
    }
    return melhor;
  }

  function amParams() {
    const p = new URLSearchParams(location.search);
    // fallback: parâmetros dentro do hash (#/rota?am_modelo=...)
    if (!p.get('am_modelo') && location.hash.includes('?')) {
      const h = new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1));
      if (h.get('am_modelo')) return h;
    }
    return p;
  }

  // Campos que identificam o veículo na tela de OS.
  // Confirmado em tela: dois <input kendosearchbar> dentro de <kendo-autocomplete>,
  // sem <label> associado — só placeholder="placa" e placeholder="chassi" mesmo.
  function amCampoPlaca() {
    return document.querySelector('input[kendosearchbar][placeholder="placa" i]')
      || document.querySelector('input[placeholder="placa" i]');
  }
  function amCampoChassi() {
    return document.querySelector('input[kendosearchbar][placeholder="chassi" i]')
      || document.querySelector('input[placeholder="chassi" i]');
  }
  // Mantido por compatibilidade (usado só internamente): primeiro campo existente na tela.
  function amCampoVeiculo() {
    return amCampoPlaca() || amCampoChassi();
  }

  // Placa é o fluxo principal; chassi é o fallback quando a placa não é identificada
  // (inclusive busca parcial com "%", ex.: %TR038882). Por isso não basta olhar o
  // primeiro campo que existir na tela — tem que ver qual dos dois tem conteúdo.
  function amValorVeiculo() {
    const placa = amCampoPlaca();
    const vPlaca = placa ? String(placa.value || '').trim() : '';
    if (vPlaca) return vPlaca;
    const chassi = amCampoChassi();
    const vChassi = chassi ? String(chassi.value || '').trim() : '';
    if (vChassi) return vChassi;
    return '';
  }

  const amBanner = document.createElement('div');
  amBanner.id = 'am-banner';
  amBanner.style.cssText = [
    'position:fixed', 'left:24px', 'bottom:24px', 'z-index:999999',
    'max-width:330px', 'padding:14px 16px', 'border-radius:14px',
    'background:#12191f', 'color:#eaf2ee', 'border:1px solid #0f7a5a',
    'box-shadow:0 12px 32px rgba(0,0,0,.45)', 'font:500 13px/1.45 system-ui, sans-serif',
    'display:none',
  ].join(';');
  amBanner.innerHTML = `
    <div style="font-weight:700;font-size:13.5px;margin-bottom:4px">Autofill Alagoas Motos</div>
    <div id="am-banner-txt" style="opacity:.85;font-size:12.5px"></div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button id="am-banner-run" style="flex:1;background:#0f7a5a;color:#fff;border:none;border-radius:9px;padding:8px 10px;font-weight:700;font-size:12.5px;cursor:pointer">Preencher agora</button>
      <button id="am-banner-close" style="background:transparent;color:#9fb3ab;border:1px solid #2b3a35;border-radius:9px;padding:8px 10px;font-size:12.5px;cursor:pointer">Cancelar</button>
    </div>`;
  document.body.appendChild(amBanner);

  function amMostrar(texto) {
    amBanner.style.display = 'block';
    document.getElementById('am-banner-txt').textContent = texto;
  }
  function amEsconder() { amBanner.style.display = 'none'; }

  (function amInit() {
    const p = amParams();
    const modeloParam = p.get('am_modelo');
    if (!modeloParam) return;

    const tipoParam = (p.get('am_tipo') || 'revisao').trim().toLowerCase();
    const ehTrocaOleo = tipoParam === 'troca_oleo' || tipoParam === 'oleo';
    const numero = parseInt(p.get('am_rev') || '1', 10) || 1;
    const kmMeses = p.get('am_km') || '';
    // am_mo = mão de obra (R$) da revisão, am_geral = 1 quando é revisão geral,
    // am_servico_km = código do cadastro "Serviço" do MicroWork pra essa revisão
    // (vem do campo "Código de Serviço" do admin — mesma origem da mão de obra).
    const moParam = parseFloat(p.get('am_mo') || '');
    const maoDeObra = Number.isFinite(moParam) ? moParam : null;
    const geral = p.get('am_geral') === '1';
    const servicoKmCodigo = (p.get('am_servico_km') || '').trim() || null;
    const chave = amAcharChaveModelo(modeloParam);
    
    let selecao;
    if (tipoParam === 'troca_peca' || tipoParam === 'peca') {
      selecao = {
        tipo: 'troca_peca',
        modelo: chave || modeloParam,
        tipoOs: p.get('am_tipo_os') || '7',
        servicoCodigo: p.get('am_servico') || '1775',
        tmo: p.get('am_tmo') || '1',
        maoDeObra: parseFloat(p.get('am_mo') || '0'),
        pecaCodigo: p.get('am_peca_codigo'),
        pecaDesc: p.get('am_peca_desc'),
        pecaValor: parseFloat(p.get('am_peca_valor') || '0')
      };
    } else if (ehTrocaOleo) {
      selecao = { tipo: 'troca_oleo', modelo: chave || modeloParam, km_meses: kmMeses };
    } else {
      selecao = {
        tipo: 'revisao',
        numero,
        modelo: chave || modeloParam,
        km_meses: kmMeses,
        maoDeObra,
        geral,
        servicoKmCodigo,
      };
    }

    console.log('[Autofill AM] Seleção recebida do dashboard:', selecao, '(param:', modeloParam, ')');

    let rodou = false;
    let cancelado = false;

    async function executar() {
      if (rodou || cancelado) return;
      rodou = true;
      amMostrar('Preenchendo a OS…');
      const resultado = configurarCfgParaSelecao(selecao);
      if (!resultado.configuradoCompletamente) {
        const seguir = confirm(
          `A ${numero}ª revisão ainda não está totalmente configurada.\n\n` +
          (numero >= 3 && !CFG.valorHora
            ? `• Sem valor de mão de obra: o campo "Valor Hora" NÃO será preenchido.\n`
            : '') +
          `• Códigos de serviço/mercadoria podem estar faltando — uso os da 1ª revisão como base.\n\n` +
          `Confira as abas Serviços/Mercadorias antes de salvar.\n\nQuer rodar mesmo assim?`
        );
        if (!seguir) { rodou = false; amMostrar('Cancelado. Clique em "Preencher agora" quando quiser.'); return; }
      }
      if (!location.hash.includes('/servico/os/')) {
        alert('Abra a tela de Ordem de Serviço antes de rodar o preenchimento automático.');
        rodou = false;
        return;
      }
      try {
        await rodarTudo();
        amEsconder();
      } catch (e) {
        console.error('[Autofill AM]', e);
        amMostrar('Erro no preenchimento: ' + (e && e.message ? e.message : e));
        rodou = false;
      }
    }

    document.getElementById('am-banner-run').onclick = executar;
    document.getElementById('am-banner-close').onclick = () => { cancelado = true; amEsconder(); };

    const rotulo = selecao.tipo === 'troca_peca'
      ? `Troca de peça — ${selecao.pecaDesc || selecao.modelo}`
      : ehTrocaOleo
      ? `Troca de óleo (avulsa) — ${selecao.modelo}`
      : `${numero}ª revisão${geral ? ' (GERAL — fora da garantia)' : ''} — ${selecao.modelo}${kmMeses ? ` (${kmMeses})` : ''}`;
    amMostrar(`${rotulo}. Informe a placa ou o chassi do veículo — o preenchimento começa sozinho.`);

    if (!chave) {
      console.warn('[Autofill AM] Modelo "' + modeloParam + '" não encontrado no menu; usando o nome recebido.');
    }

    // Aguarda o veículo ser identificado (placa/chassi preenchidos e estáveis)
    const autoRodar = p.get('am_auto') !== '0';
    let ultimoValor = '';
    let estavelDesde = 0;

    const timer = setInterval(() => {
      if (rodou || cancelado) { clearInterval(timer); return; }
      if (!autoRodar) return;
      const valor = amValorVeiculo();
      if (valor.length >= 5) {
        if (valor === ultimoValor) {
          if (Date.now() - estavelDesde >= 1200) {
            clearInterval(timer);
            amMostrar(`Veículo ${valor} identificado. Preenchendo…`);
            executar();
          }
        } else {
          ultimoValor = valor;
          estavelDesde = Date.now();
        }
      } else {
        ultimoValor = '';
      }
    }, 600);
  })();

})();
