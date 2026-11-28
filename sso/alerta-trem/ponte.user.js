// ==UserScript==
// @name         BFU · Ponte SIGO e sinótico para o Alerta trem
// @namespace    https://appbfu.vercel.app/
// @version      1.0.0
// @description  Lê os pedidos de acompanhamento PCD do SIGO e a imagem do sinótico do CIMG e entrega ao Alerta trem do BFU. Só lê o que já aparece na tela; não altera nada nos sistemas.
// @author       AAS Gerson
// @match        https://sigo.triviatrens.com.br/*
// @match        https://appintranet.cptm.sp.gov.br/Operacao/CIMG_CCO/Painel/TempoReal/*
// @match        https://appbfu.vercel.app/sso/alerta-trem/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      appintranet.cptm.sp.gov.br
// @run-at       document-idle
// @noframes
// @updateURL    https://appbfu.vercel.app/sso/alerta-trem/ponte.user.js
// @downloadURL  https://appbfu.vercel.app/sso/alerta-trem/ponte.user.js
// ==/UserScript==

(function () {
  'use strict';
  const VERSAO = '1.0.0';
  const host = location.hostname;

  /* selo discreto no canto, para saber que a ponte está ligada naquela aba */
  function selo(txt) {
    let s = document.getElementById('bfuPonteSelo');
    if (!s) {
      s = document.createElement('div');
      s.id = 'bfuPonteSelo';
      s.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;background:#141414;color:#FFC61A;font:700 12px/1.2 system-ui,sans-serif;padding:7px 10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;opacity:.92';
      document.body.appendChild(s);
    }
    s.textContent = 'BFU · ' + txt;
  }
  const agora = () => new Date().toLocaleTimeString('pt-BR').slice(0, 5);

  /* ---------- SIGO: lê a tabela do Acompanhamento PCD ---------- */
  if (host === 'sigo.triviatrens.com.br') {
    let ultimo = '';
    const ler = () => {
      if (!/pcd\/support/.test(location.hash)) return;
      const hd = [...document.querySelectorAll('table thead th')].map(t => t.innerText.trim());
      if (!hd.length) return;
      const col = n => hd.findIndex(h => h.toLowerCase() === n.toLowerCase());
      const ix = { st: col('Status'), tipo: col('Tipo de Atendimento'), reg: col('Registro'), hora: col('Hora'), linha: col('Linha'), ori: col('Origem'), dest: col('Destino'), viag: col('Viagem'), trem: col('Trem'), porta: col('Porta'), obs: col('Observação') };
      const lista = [];
      document.querySelectorAll('table tbody tr').forEach(tr => {
        if (tr.children.length < hd.length - 1) return; // linha de detalhe
        const c = [...tr.children].map(td => td.innerText.trim().replace(/\s+/g, ' '));
        const g = k => (ix[k] >= 0 ? c[ix[k]] || '' : '');
        const t = tr.textContent.replace(/\s+/g, ' ');
        const m = t.match(/Carro:\s*(\S+?)(?=Hora:|Viagem:|Trem:|Porta:|$)/);
        const p = { status: g('st'), tipo: g('tipo'), registro: g('reg'), hora: g('hora'), linha: g('linha'), origem: g('ori'), destino: g('dest'), viagem: g('viag'), trem: g('trem'), porta: g('porta'), obs: g('obs'), carro: m ? m[1] : '' };
        p.id = [p.registro, p.hora, p.trem, p.origem, p.destino].join('|');
        if (p.registro || p.trem) lista.push(p);
      });
      const j = JSON.stringify(lista);
      selo('SIGO lido às ' + agora() + ' · ' + lista.length + ' pedidos');
      if (j !== ultimo) { ultimo = j; GM_setValue('sigo', { t: Date.now(), lista }); }
      else GM_setValue('sigoVivo', Date.now());
    };
    setInterval(ler, 5000);
    setTimeout(ler, 1500);
    return;
  }

  /* ---------- CIMG: avisa o endereço de cada imagem nova do sinótico ---------- */
  if (host === 'appintranet.cptm.sp.gov.br') {
    let ultima = '';
    const ver = () => {
      const img = document.getElementById('imgPainel');
      if (!img || !img.complete || !img.naturalWidth) return;
      const src = new URL(img.src, location.href).href;
      if (src === ultima) return;
      ultima = src;
      const painel = (location.pathname.match(/TempoReal\/(\w+)/) || [])[1] || '';
      GM_setValue('cimg', { t: Date.now(), src, painel, w: img.naturalWidth, h: img.naturalHeight });
      selo('sinótico enviado às ' + agora());
    };
    new MutationObserver(ver).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['src'] });
    document.addEventListener('load', ver, true);
    setInterval(ver, 3000);
    return;
  }

  /* ---------- Alerta trem: recebe os dados e entrega à página ---------- */
  const enviar = msg => window.postMessage(Object.assign({ bfuPonte: msg.tipo }, msg), location.origin);
  enviar({ tipo: 'ola', versao: VERSAO });

  const mandaPedidos = v => { if (v && v.lista) enviar({ tipo: 'pedidos', t: v.t, lista: v.lista }); };
  let pedindo = '';
  const mandaImagem = v => {
    if (!v || !v.src || v.src === pedindo) return;
    pedindo = v.src;
    GM_xmlhttpRequest({
      method: 'GET', url: v.src, responseType: 'blob', timeout: 20000,
      onload: r => { if (r.status === 200 && r.response) enviar({ tipo: 'imagem', t: v.t, painel: v.painel, blob: r.response }); else enviar({ tipo: 'erro', msg: 'O CIMG respondeu ' + r.status + ' ao pedir a imagem.' }); },
      onerror: () => enviar({ tipo: 'erro', msg: 'Não consegui baixar a imagem do sinótico. O CIMG está aberto e logado?' }),
      ontimeout: () => enviar({ tipo: 'erro', msg: 'A imagem do sinótico demorou demais para chegar.' })
    });
  };
  GM_addValueChangeListener('sigo', (k, a, v) => mandaPedidos(v));
  GM_addValueChangeListener('sigoVivo', (k, a, v) => enviar({ tipo: 'sigoVivo', t: v }));
  GM_addValueChangeListener('cimg', (k, a, v) => mandaImagem(v));
  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.bfuPonteQuer !== 'tudo') return;
    enviar({ tipo: 'ola', versao: VERSAO });
    mandaPedidos(GM_getValue('sigo'));
    pedindo = '';
    mandaImagem(GM_getValue('cimg'));
  });
  mandaPedidos(GM_getValue('sigo'));
  mandaImagem(GM_getValue('cimg'));
})();
