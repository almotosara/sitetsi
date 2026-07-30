// ==UserScript==
// @name         MicroWork Cloud DMS - Menu de Revisão + Autofill
// @namespace    alagoasmotos
// @version      0.9.1
// @description  Menu de seleção de moto/revisão + autofill automático + integração com o dashboard da oficina (abre a OS já com a moto/revisão e dispara ao informar placa/chassi)
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

  // 3. Aba Serviços → adicionar serviço de cortesia (Troca de Óleo)
  async function passo3_servicoCortesia() {
    clicarAbaPorTexto('Serviços');
    await sleep(500);
    clicarPorTitulo('Inserir item de solicitação/cortesia');
    await sleep(600);

    // Tipo de ordem de serviço: busca pelo código (evita problema de match por acento)
    const tipoInput = inputPorLabel('Tipo de ordem de serviço', { seletorInput: 'input[kendosearchbar]' });
    if (!tipoInput) throw new Error('Campo "Tipo de ordem de serviço" não encontrado no modal');
    await preencherComboKendo(tipoInput, CFG.tipoCortesiaCodigo, CFG.tipoCortesia);
    await sleep(400);

    // IMPORTANTE: o Angular recria o <input> de "Serviço" ao habilitar o campo após
    // selecionar o Tipo — por isso reconsultamos pelo label em vez de reusar referência antiga
    const servicoInput = inputPorLabel('Serviço', { seletorInput: 'input[kendosearchbar]' });
    if (!servicoInput) throw new Error('Campo "Serviço" não encontrado no modal');
    await preencherComboKendo(servicoInput, CFG.servicoCortesiaCodigo, CFG.servicoCortesiaMatch);

    // TMO = 1
    const horaInput = document.querySelector('input[aria-placeholder="999:99"]');
    if (horaInput) setValorInputComBlur(horaInput, '001:00');
    const tmoInput = document.querySelector('input[role="spinbutton"][aria-valuemax]');
    if (tmoInput) setValorInputComBlur(tmoInput, CFG.tmo);

    await sleep(300);
    clicarBotaoPorTexto('Salvar e Fechar');
    await sleep(500);
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

  // ═══════════════════════════════════════════════════════════════════
  // MENU DE SELEÇÃO — categorias / modelos / revisões
  // ═══════════════════════════════════════════════════════════════════
  const CATEGORIAS = [
    {
      id: "populares",
      nome: "Populares",
      icone: "star",
      modelos: [
        "POP110i (2016 ~ 2024)",
        "POP110i ES (2025)",
        "BIZ110i (2016 ~ 2024)",
        "BIZ125 (2018 ~ 2024)",
        "BIZ 125 EX • BIZ 125 ES (2025)",
        "CG160 START (2016 ~ 2024)",
        "CG160 FAN-TITAN 2016 - 2024",
        "CG 160 TITAN (2025)",
        "FAN START CARGO 2025",
        "CB 300F TWISTER (2023 ~ 2024)"
      ]
    },
    {
      id: "scooter",
      nome: "Scooter",
      icone: "scooter",
      modelos: [
        "ELITE 125 (2025)",
        "ELITE 125 (2019 ~ 2024)",
        "PCX 160 (2023 ~ 2024)",
        "PCX 150 (2019 ~ 2024)",
        "ADV (2021 ~ 2024)",
        "X-ADV (2022 ~ 2024)",
        "SH 300i (2016 ~ 2021)"
      ]
    },
    {
      id: "quadriciclo",
      nome: "Quadriciclo",
      icone: "quad",
      modelos: [
        "TRX420 QUADRICICLO ( 2008-2024)"
      ]
    },
    {
      id: "baixa",
      nome: "Baixa Cilindrada",
      icone: "low",
      modelos: [
        "POP110i (2016 ~ 2024)",
        "POP110i ES (2025)",
        "BIZ110i (2016 ~ 2024)",
        "BIZ125 (2018 ~ 2024)",
        "BIZ 125 EX • BIZ 125 ES (2025)"
      ]
    },
    {
      id: "media",
      nome: "Média (até 300)",
      icone: "mid",
      modelos: [
        "NXR160 BROS ESDD (2016 ~ 2024)",
        "NXR160 CBS_ABS (2025)",
        "XRE 190 (2016 ~ 2024)",
        "XRE 190 (2025 )",
        "CRF 250 2024",
        "CB 250F TWISTER (2016 ~ 2022)",
        "CB 300F TWISTER (2023 ~ 2024)",
        "XRE 300 (2019 ~ 2024)",
        "XRE 300 Sahara (2025)",
        "XR 300L Tornado (2025)"
      ]
    },
    {
      id: "alta",
      nome: "Alta (acima de 300)",
      icone: "high",
      modelos: [
        "CB 500F (2020 ~ 2024)",
        "CB 500X ( 2020 - 2024 )",
        "CB 650R (2020 ~ 2024)",
        "CBR 650R (2020 ~ 2024)",
        "NC 750X (2022 ~ 2024)",
        "CBR 1000 RR-R FIR(2022 ~2024",
        "X-ADV (2022 ~ 2024)",
        "SH 300i (2016 ~ 2021)"
      ]
    }
  ];

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

  const ICONS = {
    star:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l2.9 6.6L22 9.3l-5 4.8L18.2 22 12 18.3 5.8 22 7 14.1 2 9.3l7.1-.7L12 2z"/></svg>',
    scooter:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 18h6l3-8h4M9 10h4"/></svg>',
    quad:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="17" r="2.3"/><circle cx="19" cy="17" r="2.3"/><path d="M7 17h10M9 17V9h6v8M9 9L6 6M15 9l3-3"/></svg>',
    low:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="17" r="2.3"/><circle cx="17" cy="17" r="2.3"/><path d="M6 17h5l2-6h4M11 11H8"/></svg>',
    mid:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5.5" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M5.5 17h6l2.5-7h4.5M11.5 10H9"/></svg>',
    high:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="17" r="2.5"/><path d="M5 17h5l3-8h6M13 9h-3"/><path d="M16 9l3 8"/></svg>'
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
  const TIPO_ORDEM_POR_REVISAO = {
    1: { codigo: '2', match: '2 -' },
    2: { codigo: '4', match: '4 -' },
    // demais revisões ainda não configuradas — usa o mesmo da 1ª como base
  };

  // "Serviço" por número de revisão — código específico pelo km da
  // revisão (ex: REVISÃO 1000 KM = código 1784, REVISÃO 6000 KM = 1842...).
  // O TMO é o mesmo (CFG.tmo) pra todas.
  const SERVICO_KM_POR_REVISAO = {
    1: { codigo: '1784', match: '(1784)' },  // REVISÃO 1000 KM
    2: { codigo: '1842', match: '(1842)' },  // REVISÃO 6000 KM
    // demais revisões ainda não configuradas — usa o código da 1ª como base
  };

  // Troca de óleo avulsa (fora de revisão):
  // Tipo de ordem de serviço = 7, Serviço = 24, TMO = 1,
  // e a única mercadoria é o óleo (1002).
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
    let mercadoriasConfiguradas = false;
    if (selecao.tipo === 'revisao') {
      const especificas = mercadoriasEspecificasParaModeloRevisao(selecao.modelo, selecao.numero);
      if (especificas) {
        CFG.mercadorias = especificas;
        mercadoriasConfiguradas = true;
      }
    }

    if (selecao.tipo === 'troca_oleo') {
      // Troca de óleo avulsa:
      //   Tipo de ordem de serviço = 7
      //   Serviço                  = 24
      //   TMO                      = 1
      //   Mercadoria               = só o óleo, código e qtd conforme o modelo
      CFG.tipoCortesiaCodigo = TROCA_OLEO.tipoOrdem.codigo;
      CFG.tipoCortesia = TROCA_OLEO.tipoOrdem.match;
      CFG.servicoCortesiaCodigo = TROCA_OLEO.servico.codigo;
      CFG.servicoCortesiaMatch = TROCA_OLEO.servico.match;
      CFG.tmo = TROCA_OLEO.tmo;
      CFG.mercadorias = [{ codigo: oleo.codigo, match: oleo.codigo, quantidade: oleo.quantidade }];
      return { configuradoCompletamente: true };
    }


    if (selecao.tipo === 'revisao') {
      const tipoOrdem = TIPO_ORDEM_POR_REVISAO[selecao.numero];
      const servicoKm = SERVICO_KM_POR_REVISAO[selecao.numero];

      if (tipoOrdem) {
        CFG.tipoCortesiaCodigo = tipoOrdem.codigo;
        CFG.tipoCortesia = tipoOrdem.match;
      } else {
        // Ainda não configurado — usa o código da 1ª revisão como base temporária
        CFG.tipoCortesiaCodigo = TIPO_ORDEM_POR_REVISAO[1].codigo;
        CFG.tipoCortesia = TIPO_ORDEM_POR_REVISAO[1].match;
      }

      if (servicoKm) {
        CFG.servicoCortesiaCodigo = servicoKm.codigo;
        CFG.servicoCortesiaMatch = servicoKm.match;
      } else {
        // Ainda não configurado — usa o código da 1ª revisão como base temporária
        CFG.servicoCortesiaCodigo = SERVICO_KM_POR_REVISAO[1].codigo;
        CFG.servicoCortesiaMatch = SERVICO_KM_POR_REVISAO[1].match;
      }

      if (tipoOrdem && servicoKm && mercadoriasConfiguradas) {
        // Revisão totalmente configurada: tipo, serviço E mercadorias
        // específicas do modelo/revisão.
        return { configuradoCompletamente: true };
      }
      // Falta tipo de ordem, serviço e/ou mercadorias específicas —
      // o confirm() do banner avisa o operador que vai usar valores base.
      return { configuradoCompletamente: false };
    }

    return { configuradoCompletamente: false };
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTILOS DO MENU
  // ═══════════════════════════════════════════════════════════════════
  const css = `
    #mr-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 999998;
      width: 56px; height: 56px; border-radius: 50%;
      background: #e8756a; color: #fff; border: none;
      font-size: 24px; cursor: pointer;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
      display:flex; align-items:center; justify-content:center;
    }
    #mr-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      z-index: 999999; display: none;
      align-items: center; justify-content: center;
    }
    #mr-overlay.mr-show { display: flex; }
    .mr-shell {
      display:flex; background:#f2f1ee; border-radius:6px;
      box-shadow:0 20px 50px rgba(0,0,0,0.4); overflow:hidden;
      max-height: 80vh; font-family: 'Segoe UI', Roboto, Arial, sans-serif;
    }
    .mr-close {
      position:absolute; top:-14px; right:-14px;
      width:32px; height:32px; border-radius:50%;
      background:#fff; border:none; cursor:pointer;
      font-size:16px; font-weight:bold; color:#3a3a3a;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    }
    .mr-wrap { position: relative; }
    .mr-col-cat {
      width:190px; background:#f2f1ee; display:flex; flex-direction:column;
      border-right:1px solid #dcdad5; overflow-y:auto;
    }
    .mr-cat-item {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 20px; cursor:pointer; font-size:14px; color:#3a3a3a;
      border-bottom:1px solid #dcdad5; position:relative; transition:background .15s;
    }
    .mr-cat-item:hover { background:#e5e3df; }
    .mr-cat-item.active { background:#fff; font-weight:600; }
    .mr-cat-item.active::before {
      content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:#e8756a;
    }
    .mr-cat-icon { color:#8b8b88; flex-shrink:0; }
    .mr-cat-item.active .mr-cat-icon { color:#e8756a; }

    .mr-col-mod {
      width:230px; background:#e9e7e3; display:flex; flex-direction:column;
      border-right:1px solid #dcdad5; overflow-y:auto;
    }
    .mr-mod-item {
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 18px; cursor:pointer; font-size:13.5px; color:#3a3a3a;
      border-bottom:1px solid #dcdad5; transition:background .15s;
    }
    .mr-mod-item:hover { background:#dedcd7; }
    .mr-mod-item.active { background:#e8756a; color:#fff; font-weight:600; }
    .mr-mod-item .mr-chev { color:#8b8b88; font-size:12px; }
    .mr-mod-item.active .mr-chev { color:#fff; }
    .mr-empty { padding:30px 18px; font-size:13px; color:#8b8b88; text-align:center; }

    .mr-col-serv {
      width:290px; background:#fff; display:flex; flex-direction:column; overflow-y:auto;
    }
    .mr-serv-item {
      display:flex; align-items:center; justify-content:space-between;
      padding:15px 20px; cursor:pointer; font-size:13.5px; color:#3a3a3a;
      border-bottom:1px solid #dcdad5; transition:background .15s;
    }
    .mr-serv-item:hover { background:#f7f6f4; }
    .mr-serv-item.active { background:#e8756a; color:#fff; }
    .mr-serv-info { display:flex; flex-direction:column; gap:2px; }
    .mr-serv-nome { font-weight:500; }
    .mr-serv-sub { font-size:11px; color:#8b8b88; }
    .mr-serv-item.active .mr-serv-sub { color:#fce8e5; }
    .mr-serv-item .mr-chev { color:#8b8b88; font-size:12px; }
    .mr-serv-item.active .mr-chev { color:#fff; }
    .mr-serv-badge {
      font-size:10px; padding:2px 6px; border-radius:8px;
      background:#f0c14b; color:#3a2a00; margin-left:6px; white-space:nowrap;
    }
  `;

  const styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  // ═══════════════════════════════════════════════════════════════════
  // HTML — botão flutuante + overlay do menu
  // ═══════════════════════════════════════════════════════════════════
  const fab = document.createElement('button');
  fab.id = 'mr-fab';
  fab.title = 'Abrir menu de revisão';
  fab.textContent = '🔧';
  document.body.appendChild(fab);

  const overlay = document.createElement('div');
  overlay.id = 'mr-overlay';
  overlay.innerHTML = `
    <div class="mr-wrap">
      <button class="mr-close" id="mr-close-btn">✕</button>
      <div class="mr-shell">
        <div class="mr-col-cat" id="mr-col-categorias"></div>
        <div class="mr-col-mod" id="mr-col-modelos"></div>
        <div class="mr-col-serv" id="mr-col-servicos"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  fab.addEventListener('click', () => overlay.classList.add('mr-show'));
  document.getElementById('mr-close-btn').addEventListener('click', () => overlay.classList.remove('mr-show'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('mr-show'); });

  // ═══════════════════════════════════════════════════════════════════
  // ESTADO E RENDER DO MENU
  // ═══════════════════════════════════════════════════════════════════
  let categoriaAtivaId = null;
  let modeloAtivoNome = null;
  let servicoAtivoId = null;

  function renderCategorias() {
    const el = document.getElementById('mr-col-categorias');
    el.innerHTML = '';
    CATEGORIAS.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'mr-cat-item' + (cat.id === categoriaAtivaId ? ' active' : '');
      div.innerHTML = `<span>${cat.nome}</span><span class="mr-cat-icon">${ICONS[cat.icone] || ''}</span>`;
      div.onclick = () => {
        categoriaAtivaId = cat.id;
        modeloAtivoNome = null;
        servicoAtivoId = null;
        renderCategorias(); renderModelos(); renderServicos();
      };
      el.appendChild(div);
    });
  }

  function renderModelos() {
    const el = document.getElementById('mr-col-modelos');
    el.innerHTML = '';
    if (!categoriaAtivaId) {
      el.innerHTML = '<div class="mr-empty">Selecione um tipo de moto</div>';
      return;
    }
    const cat = CATEGORIAS.find(c => c.id === categoriaAtivaId);
    if (!cat || cat.modelos.length === 0) {
      el.innerHTML = '<div class="mr-empty">Nenhum modelo cadastrado</div>';
      return;
    }
    cat.modelos.forEach(modeloNome => {
      const div = document.createElement('div');
      div.className = 'mr-mod-item' + (modeloNome === modeloAtivoNome ? ' active' : '');
      div.innerHTML = `<span>${modeloNome}</span><span class="mr-chev">›</span>`;
      div.onclick = () => {
        modeloAtivoNome = modeloNome;
        servicoAtivoId = null;
        renderModelos(); renderServicos();
      };
      el.appendChild(div);
    });
  }

  function renderServicos() {
    const el = document.getElementById('mr-col-servicos');
    el.innerHTML = '';
    if (!modeloAtivoNome) {
      el.innerHTML = '<div class="mr-empty">Selecione um modelo para ver os serviços</div>';
      return;
    }
    const revisoes = REVISOES_POR_MODELO[modeloAtivoNome] || [];

    const trocaOleo = document.createElement('div');
    trocaOleo.className = 'mr-serv-item' + (servicoAtivoId === 'troca_oleo' ? ' active' : '');
    trocaOleo.innerHTML = `
      <div class="mr-serv-info">
        <span class="mr-serv-nome">Troca de óleo</span>
        <span class="mr-serv-sub">Serviço avulso</span>
      </div>
      <span class="mr-chev">›</span>
    `;
    trocaOleo.onclick = () => {
      servicoAtivoId = 'troca_oleo';
      renderServicos();
      onServicoSelecionado({ tipo: 'troca_oleo', modelo: modeloAtivoNome });
    };
    el.appendChild(trocaOleo);

    if (revisoes.length === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'mr-empty';
      vazio.textContent = 'Nenhuma revisão cadastrada para este modelo';
      el.appendChild(vazio);
      return;
    }

    revisoes.forEach(rev => {
      const id = 'rev_' + rev.numero;
      const div = document.createElement('div');
      div.className = 'mr-serv-item' + (servicoAtivoId === id ? ' active' : '');
      const ordinal = rev.numero + 'ª revisão';
      const sub = rev.km_meses || '';
      const badge = rev.numero > 1 ? '<span class="mr-serv-badge">config. pendente</span>' : '';
      div.innerHTML = `
        <div class="mr-serv-info">
          <span class="mr-serv-nome">${ordinal}${badge}</span>
          <span class="mr-serv-sub">${sub}</span>
        </div>
        <span class="mr-chev">›</span>
      `;
      div.onclick = () => {
        servicoAtivoId = id;
        renderServicos();
        onServicoSelecionado({ tipo: 'revisao', numero: rev.numero, modelo: modeloAtivoNome, km_meses: rev.km_meses });
      };
      el.appendChild(div);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CALLBACK — ao selecionar um serviço/revisão no menu:
  // configura o CFG do autofill e roda o fluxo completo automaticamente
  // ═══════════════════════════════════════════════════════════════════
  async function onServicoSelecionado(selecao) {
    console.log('[Menu Revisão] Seleção:', selecao);
    const resultado = configurarCfgParaSelecao(selecao);

    const rotulo = selecao.tipo === 'troca_oleo'
      ? `Troca de óleo — ${selecao.modelo}`
      : `${selecao.numero}ª revisão — ${selecao.modelo} (${selecao.km_meses || ''})`;

    console.log(`[Menu Revisão] Selecionado: ${rotulo}`);
    overlay.classList.remove('mr-show');

    if (!resultado.configuradoCompletamente) {
      const seguir = confirm(
        `Ainda não tenho os códigos de serviço/mercadoria específicos desta revisão ` +
        `cadastrados no MicroWork (isso depende de você me passar os códigos internos ` +
        `de cada kit de revisão).\n\nVou usar os mesmos códigos da "Troca de óleo" como ` +
        `base — você pode ajustar manualmente na aba Serviços/Mercadorias depois.\n\n` +
        `Quer rodar mesmo assim?`
      );
      if (!seguir) return;
    }

    if (!location.hash.includes('/servico/os/')) {
      alert('Abra uma Ordem de Serviço antes de rodar o preenchimento automático.');
      return;
    }

    await rodarTudo();
  }

  // ═══════════════════════════════════════════════════════════════════
  // INIT DO MENU
  // ═══════════════════════════════════════════════════════════════════
  renderCategorias();
  renderModelos();
  renderServicos();

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
    const chave = amAcharChaveModelo(modeloParam);
    const selecao = ehTrocaOleo
      ? { tipo: 'troca_oleo', modelo: chave || modeloParam, km_meses: kmMeses }
      : {
          tipo: 'revisao',
          numero,
          modelo: chave || modeloParam,
          km_meses: kmMeses,
        };

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
          `Ainda não tenho os códigos específicos da ${numero}ª revisão cadastrados no MicroWork.\n\n` +
          `Vou usar os códigos da 1ª revisão / troca de óleo como base — confira a aba ` +
          `Serviços/Mercadorias antes de salvar.\n\nQuer rodar mesmo assim?`
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

    const rotulo = ehTrocaOleo
      ? `Troca de óleo (avulsa) — ${selecao.modelo}`
      : `${numero}ª revisão — ${selecao.modelo}${kmMeses ? ` (${kmMeses})` : ''}`;
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
