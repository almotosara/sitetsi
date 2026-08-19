// ==UserScript==
// @name         MicroWork Cloud DMS - Sincronizar Agendamentos (Alagoas Motos)
// @namespace    alagoasmotos
// @version      1.3.0
// @description  Lê a listagem de agendamentos do MicroWork e envia ao painel da Alagoas Motos.
// @match        https://microworkcloud.com.br/cloud/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      alagoasmotos.netlify.app
// @connect      *.netlify.app
// ==/UserScript==

(function () {
  'use strict';

  const CHAVE_ENDPOINT = 'am_agendamentos_endpoint';
  const CHAVE_TOKEN = 'am_agendamentos_token';
  const ID_BOTAO = 'am-sync-agendamentos';
  const ENDPOINT_PADRAO = 'https://alagoasmotos.netlify.app/api/agendamentos/sync';
  let ultimoAssinatura = '';
  let timerDebounce = 0;
  let sincronizando = false;

  GM_addStyle(`
    #${ID_BOTAO}{position:fixed;right:22px;bottom:22px;z-index:2147483647;display:flex;align-items:center;gap:8px;
      min-height:42px;padding:0 15px;border:1px solid rgba(255,255,255,.22);border-radius:12px;background:#20242a;
      color:#fff;font:700 12px/1.2 Arial,sans-serif;box-shadow:0 13px 35px rgba(0,0,0,.3);cursor:pointer;transition:.18s ease}
    #${ID_BOTAO}:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(0,0,0,.35)}
    #${ID_BOTAO} i{width:9px;height:9px;border-radius:50%;background:#a6abb2;box-shadow:0 0 0 4px rgba(166,171,178,.14)}
    #${ID_BOTAO}[data-state="ok"] i{background:#34b876;box-shadow:0 0 0 4px rgba(52,184,118,.14)}
    #${ID_BOTAO}[data-state="loading"] i{background:#e8a52e;animation:am-pulse 1s infinite}
    #${ID_BOTAO}[data-state="error"] i{background:#e34b50;box-shadow:0 0 0 4px rgba(227,75,80,.14)}
    #${ID_BOTAO}[data-state="partial"] i{background:#e8a52e;box-shadow:0 0 0 4px rgba(232,165,46,.14)}
    @keyframes am-pulse{50%{opacity:.35}}
  `);

  function valorCelula(row, indice) {
    const celula = row.querySelector(`td[data-kendo-grid-column-index="${indice}"]`);
    return celula ? celula.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function converterDataHora(valor) {
    const m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return {
      data_agendamento: `${m[3]}-${m[2]}-${m[1]}`,
      hora_agendamento: `${m[4]}:${m[5]}:${m[6] || '00'}`,
    };
  }

  function coletarLinhas() {
    const rows = Array.from(document.querySelectorAll('tr.k-master-row[data-kendo-grid-item-index]'));
    return rows.map((row) => {
      const quando = converterDataHora(valorCelula(row, 3));
      if (!quando) return null;
      const statusCell = row.querySelector('td[data-kendo-grid-column-index="4"]');
      const statusLabel = statusCell && statusCell.querySelector('.label');
      return {
        empresa: valorCelula(row, 1),
        numero_agendamento: valorCelula(row, 2),
        ...quando,
        situacao: statusLabel ? statusLabel.textContent.trim() : valorCelula(row, 4),
        tipo_os: valorCelula(row, 5) || null,
        placa: valorCelula(row, 6) || null,
        modelo: valorCelula(row, 7) || null,
        pessoa: valorCelula(row, 8),
        telefone: valorCelula(row, 9) || null,
        celular: valorCelula(row, 10) || null,
        consultor: valorCelula(row, 11) || null,
      };
    }).filter((item) => item && item.empresa && item.numero_agendamento && item.pessoa);
  }

  function totalDaListagem(quantidadeVisivel) {
    const candidatos = Array.from(document.querySelectorAll('.k-pager-info, kendo-pager, .k-pager-wrap, .k-grid-pager'));
    for (const el of candidatos.reverse()) {
      const m = el.textContent.match(/\b\d+\s*-\s*\d+\s+de\s+(\d+)\s+itens?\b/i);
      if (m) return Number(m[1]);
    }
    return quantidadeVisivel;
  }

  function getConfig() {
    const endpointSalvo = String(GM_getValue(CHAVE_ENDPOINT, '') || '').trim().replace(/\/$/, '');
    return {
      endpoint: !endpointSalvo || /SEU-SITE/i.test(endpointSalvo) ? ENDPOINT_PADRAO : endpointSalvo,
      token: String(GM_getValue(CHAVE_TOKEN, '') || '').trim(),
    };
  }

  function configurar() {
    const atual = getConfig();
    const endpoint = window.prompt('URL do endpoint de sincronização:', atual.endpoint || ENDPOINT_PADRAO);
    if (endpoint === null) return false;
    if (!/^https:\/\/.+\/api\/agendamentos\/sync$/i.test(endpoint.trim())) {
      window.alert('Informe uma URL HTTPS terminando em /api/agendamentos/sync.');
      return false;
    }
    const tokenInformado = window.prompt('Cole somente o VALOR de AGENDAMENTOS_SYNC_TOKEN (sem o nome da variável e sem =):', atual.token);
    if (tokenInformado === null) return false;
    const token = tokenInformado.trim().replace(/^AGENDAMENTOS_SYNC_TOKEN\s*=\s*/i, '');
    if (token.length < 16) {
      window.alert('O token parece curto demais. Use o mesmo valor forte configurado no servidor.');
      return false;
    }
    GM_setValue(CHAVE_ENDPOINT, endpoint.trim());
    GM_setValue(CHAVE_TOKEN, token);
    atualizarBotao('idle', 'Pronto para sincronizar');
    agendarSincronizacao(true);
    return true;
  }

  function interpretarResposta(status, responseText, statusText) {
    let json = null;
    try { json = JSON.parse(responseText || '{}'); } catch {}
    if (status >= 200 && status < 300) return json || {};
    if (status === 401) {
      throw new Error('Token não autorizado (401). No Netlify, use AGENDAMENTOS_SYNC_TOKEN somente no campo Key, o token somente no campo Value e publique um novo deploy');
    }
    const detalhe = (json && json.error) || statusText || `A API respondeu HTTP ${status || 0}`;
    const codigo = json && json.code ? ` [${json.code}]` : '';
    throw new Error(`${detalhe}${codigo}`);
  }

  function requestComTampermonkey(url, token, payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: JSON.stringify(payload),
        onload: (res) => {
          try { resolve(interpretarResposta(res.status, res.responseText, res.statusText)); }
          catch (erro) { reject(erro); }
        },
        onerror: (res) => {
          const detalhe = [res && res.status, res && res.statusText, res && res.error].filter(Boolean).join(' · ');
          reject(new Error(`GM_NETWORK:${detalhe || 'conexão recusada pelo navegador/extensão'}`));
        },
        ontimeout: () => reject(new Error('GM_NETWORK:tempo esgotado')),
        onabort: () => reject(new Error('GM_NETWORK:requisição cancelada')),
      });
    });
  }

  async function requestComFetch(url, token, payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      // text/plain mantém a chamada como CORS simples e evita que proxies ou
      // extensões bloqueiem o preflight causado pelo header Authorization.
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ ...payload, sync_token: token }),
        signal: controller.signal,
      });
      return interpretarResposta(res.status, await res.text(), res.statusText);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function requestJson(url, token, payload) {
    try {
      return await requestComTampermonkey(url, token, payload);
    } catch (erroGm) {
      const mensagemGm = erroGm instanceof Error ? erroGm.message : String(erroGm || '');
      if (!mensagemGm.startsWith('GM_NETWORK:')) throw erroGm;
      console.warn('[Alagoas Motos · Agendamentos] Canal Tampermonkey indisponível; tentando CORS simples.', mensagemGm);
      try {
        return await requestComFetch(url, token, payload);
      } catch (erroFetch) {
        const mensagemFetch = erroFetch instanceof Error ? erroFetch.message : String(erroFetch || 'falha desconhecida');
        throw new Error(`A conexão foi bloqueada pelos dois canais. Endpoint: ${url}. Tampermonkey: ${mensagemGm.replace('GM_NETWORK:', '')}. Fetch: ${mensagemFetch}`);
      }
    }
  }

  function garantirBotao() {
    let botao = document.getElementById(ID_BOTAO);
    if (botao) return botao;
    botao = document.createElement('button');
    botao.id = ID_BOTAO;
    botao.type = 'button';
    botao.innerHTML = '<i></i><span>Agendamentos: aguardando</span>';
    botao.title = 'Clique para sincronizar agora';
    botao.addEventListener('click', () => sincronizar(true));
    document.body.appendChild(botao);
    return botao;
  }

  function atualizarBotao(estado, texto, titulo) {
    const botao = garantirBotao();
    botao.dataset.state = estado;
    botao.querySelector('span').textContent = texto;
    if (titulo) botao.title = titulo;
  }

  async function sincronizar(forcar) {
    if (sincronizando) return;
    const linhas = coletarLinhas();
    if (!linhas.length) {
      atualizarBotao('idle', 'Abra a listagem de agendamentos', 'Nenhuma linha de agendamento encontrada nesta tela.');
      return;
    }

    const total = totalDaListagem(linhas.length);
    const completo = total === linhas.length;
    const assinatura = JSON.stringify(linhas);
    if (!forcar && assinatura === ultimoAssinatura) return;

    let config = getConfig();
    if (!config.endpoint || !config.token) {
      atualizarBotao('error', 'Configurar sincronização', 'Clique para informar a URL e o token.');
      if (forcar && configurar()) config = getConfig();
      else return;
    }

    sincronizando = true;
    atualizarBotao('loading', `Enviando ${linhas.length} agendamento${linhas.length > 1 ? 's' : ''}…`);
    try {
      await requestJson(config.endpoint, config.token, {
        origem: 'microwork-dom',
        capturado_em: new Date().toISOString(),
        completo,
        agendamentos: linhas,
      });
      ultimoAssinatura = assinatura;
      if (completo) {
        atualizarBotao('ok', `${linhas.length} sincronizado${linhas.length > 1 ? 's' : ''}`, `Listagem completa: ${linhas.length} de ${total}. Clique para sincronizar novamente.`);
      } else {
        atualizarBotao('partial', `${linhas.length} de ${total} sincronizados`, 'Há mais páginas na listagem. Sincronize cada página ou aumente a quantidade de itens exibidos.');
      }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro || 'Erro desconhecido');
      const textoBotao = /agendamentos_dms|tabela de agendamentos/i.test(mensagem)
        ? 'Criar tabela no Supabase'
        : /chave (secret|pública)|SUPABASE_|gravação/i.test(mensagem)
          ? 'Configurar chave Supabase'
          : 'Erro ao sincronizar';
      console.error('[Alagoas Motos · Agendamentos]', mensagem);
      atualizarBotao('error', textoBotao, `${mensagem} Clique para tentar novamente.`);
      if (forcar) window.alert(`Não foi possível sincronizar os agendamentos.\n\n${mensagem}`);
    } finally {
      sincronizando = false;
    }
  }

  function agendarSincronizacao(forcar) {
    window.clearTimeout(timerDebounce);
    timerDebounce = window.setTimeout(() => sincronizar(Boolean(forcar)), 1800);
  }

  GM_registerMenuCommand('Configurar sincronização de agendamentos', configurar);
  GM_registerMenuCommand('Mostrar endpoint configurado', () => window.alert(`Endpoint atual:\n${getConfig().endpoint}`));
  GM_registerMenuCommand('Sincronizar agendamentos agora', () => sincronizar(true));

  garantirBotao();
  const observer = new MutationObserver(() => agendarSincronizacao(false));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  agendarSincronizacao(false);
})();
