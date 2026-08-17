// ==UserScript==
// @name         MicroWork Cloud DMS - Sincronizar Agendamentos (Alagoas Motos)
// @namespace    alagoasmotos
// @version      1.0.0
// @description  Lê a listagem de agendamentos do MicroWork e envia ao painel da Alagoas Motos.
// @match        https://microworkcloud.com.br/cloud/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  const CHAVE_ENDPOINT = 'am_agendamentos_endpoint';
  const CHAVE_TOKEN = 'am_agendamentos_token';
  const ID_BOTAO = 'am-sync-agendamentos';
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
    return {
      endpoint: String(GM_getValue(CHAVE_ENDPOINT, '') || '').trim().replace(/\/$/, ''),
      token: String(GM_getValue(CHAVE_TOKEN, '') || '').trim(),
    };
  }

  function configurar() {
    const atual = getConfig();
    const endpoint = window.prompt('URL do endpoint de sincronização:', atual.endpoint || 'https://SEU-SITE.netlify.app/api/agendamentos/sync');
    if (endpoint === null) return false;
    if (!/^https:\/\/.+\/api\/agendamentos\/sync$/i.test(endpoint.trim())) {
      window.alert('Informe uma URL HTTPS terminando em /api/agendamentos/sync.');
      return false;
    }
    const token = window.prompt('Token AGENDAMENTOS_SYNC_TOKEN configurado no site:', atual.token);
    if (token === null) return false;
    if (token.trim().length < 16) {
      window.alert('O token parece curto demais. Use o mesmo valor forte configurado no servidor.');
      return false;
    }
    GM_setValue(CHAVE_ENDPOINT, endpoint.trim());
    GM_setValue(CHAVE_TOKEN, token.trim());
    atualizarBotao('idle', 'Pronto para sincronizar');
    agendarSincronizacao(true);
    return true;
  }

  function requestJson(url, token, payload) {
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
          let json = null;
          try { json = JSON.parse(res.responseText || '{}'); } catch {}
          if (res.status >= 200 && res.status < 300) resolve(json || {});
          else reject(new Error((json && json.error) || `HTTP ${res.status}`));
        },
        onerror: () => reject(new Error('Falha de rede')),
        ontimeout: () => reject(new Error('Tempo esgotado')),
      });
    });
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
      atualizarBotao('error', 'Erro ao sincronizar', `${erro.message}. Clique para tentar novamente.`);
    } finally {
      sincronizando = false;
    }
  }

  function agendarSincronizacao(forcar) {
    window.clearTimeout(timerDebounce);
    timerDebounce = window.setTimeout(() => sincronizar(Boolean(forcar)), 1800);
  }

  GM_registerMenuCommand('Configurar sincronização de agendamentos', configurar);
  GM_registerMenuCommand('Sincronizar agendamentos agora', () => sincronizar(true));

  garantirBotao();
  const observer = new MutationObserver(() => agendarSincronizacao(false));
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  agendarSincronizacao(false);
})();
