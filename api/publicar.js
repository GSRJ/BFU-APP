/* Publica o GBD dos agentes: grava o arquivo do turno no repositório.
   O token do GitHub nunca sai daqui. Variáveis na Vercel:
   GITHUB_TOKEN            token fino, só neste repositório, Contents: Read and write
   PUBLICAR_SENHA          senha do turno da tarde (12 caracteres ou mais)
   PUBLICAR_SENHA_MANHA    senha do turno da manhã
   PUBLICAR_SENHA_NOITE    senha do turno da noite
   Cada turno só grava o próprio arquivo, com a própria senha.
   Junto com o GBD vai o estado do montador (ausências, edições, confirmações), cifrado
   com a senha do turno, para qualquer aparelho com a senha abrir o montador igual. */
const crypto = require('crypto');
const REPO = process.env.GBD_REPO || 'GSRJ/BFU-APP';
const RAMO = process.env.GBD_RAMO || 'main';
const TURNOS = {
  tarde: { arquivo: 'gbd/gbd-dados.json', estado: 'gbd/estado-tarde.cifrado.json', senha: 'PUBLICAR_SENHA', rotulo: 'Tarde' },
  manha: { arquivo: 'gbd/gbd-dados-manha.json', estado: 'gbd/estado-manha.cifrado.json', senha: 'PUBLICAR_SENHA_MANHA', rotulo: 'Manhã' },
  noite: { arquivo: 'gbd/gbd-dados-noite.json', estado: 'gbd/estado-noite.cifrado.json', senha: 'PUBLICAR_SENHA_NOITE', rotulo: 'Noite' },
};

const igual = (a, b) => {
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const senhaOk = s => !!s && s.length >= 12;
const chave = (senha, turno) => crypto.scryptSync(senha, 'bfu-gbd-estado-' + turno, 32);
function cifrar(obj, senha, turno, em) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', chave(senha, turno), iv);
  const dados = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { v: 1, em, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), dados: dados.toString('base64') };
}
function decifrar(arq, senha, turno) {
  const d = crypto.createDecipheriv('aes-256-gcm', chave(senha, turno), Buffer.from(arq.iv, 'base64'));
  d.setAuthTag(Buffer.from(arq.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(arq.dados, 'base64')), d.final()]).toString('utf8'));
}

module.exports = async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'GET') {
    const turnos = {};
    for (const [t, c] of Object.entries(TURNOS)) turnos[t] = !!(token && senhaOk(process.env[c.senha]));
    return res.status(200).json({ pronto: turnos.tarde, turnos });
  }
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });

  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { return res.status(400).json({ erro: 'corpo inválido' }); } }
  if (!corpo || typeof corpo !== 'object') return res.status(400).json({ erro: 'corpo inválido' });

  const turno = corpo.turno || 'tarde';
  const conf = TURNOS[turno];
  if (!conf) return res.status(400).json({ erro: 'turno desconhecido' });

  const senha = process.env[conf.senha];
  if (!token) return res.status(500).json({ erro: 'falta a variável GITHUB_TOKEN na Vercel' });
  if (!senha) return res.status(500).json({ erro: `falta a variável ${conf.senha} na Vercel` });
  if (!senhaOk(senha)) return res.status(500).json({ erro: `a ${conf.senha} precisa ter 12 caracteres ou mais` });
  if (!igual(corpo.senha, senha)) return res.status(401).json({ erro: 'senha incorreta' });

  const h = {
    authorization: 'Bearer ' + token,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'bfu-app-gbd',
  };
  const urlDe = arq => `https://api.github.com/repos/${REPO}/contents/${arq}`;
  async function lerArquivo(arq) {
    const r = await fetch(`${urlDe(arq)}?ref=${encodeURIComponent(RAMO)}`, { headers: { ...h, accept: 'application/vnd.github.raw+json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('o GitHub respondeu ' + r.status + ' ao ler o arquivo');
    return r.text();
  }
  async function gravar(arq, texto, msg) {
    let sha;
    const atual = await fetch(`${urlDe(arq)}?ref=${encodeURIComponent(RAMO)}`, { headers: h });
    if (atual.ok) sha = (await atual.json()).sha;
    else if (atual.status === 401 || atual.status === 403) throw new Error('o token do GitHub não tem permissão de escrita neste repositório');
    else if (atual.status !== 404) throw new Error('o GitHub respondeu ' + atual.status + ' ao ler o arquivo');
    const r = await fetch(urlDe(arq), {
      method: 'PUT',
      headers: { ...h, 'content-type': 'application/json' },
      body: JSON.stringify({ message: msg, content: Buffer.from(texto, 'utf8').toString('base64'), branch: RAMO, ...(sha ? { sha } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || 'o GitHub respondeu ' + r.status);
    return j;
  }

  /* trazer o estado do montador publicado por último */
  if (corpo.acao === 'ler-estado') {
    try {
      const t = await lerArquivo(conf.estado);
      if (!t) return res.status(200).json({ ok: true, estado: null });
      const arq = JSON.parse(t);
      let estado;
      try { estado = decifrar(arq, senha, turno); } catch (e) { return res.status(409).json({ erro: 'o estado salvo foi cifrado com outra senha; publique de novo para atualizar' }); }
      return res.status(200).json({ ok: true, em: arq.em, estado });
    } catch (e) {
      return res.status(502).json({ erro: 'não falou com o GitHub: ' + (e && e.message ? e.message : 'erro') });
    }
  }

  const dados = corpo.dados;
  if (!dados || typeof dados !== 'object' || !dados.dias || !Object.keys(dados.dias).length)
    return res.status(400).json({ erro: 'dados sem nenhum dia' });
  dados.turno = conf.rotulo;      /* o rótulo do turno vem daqui, não de quem publicou */
  dados.turnoId = turno;

  const texto = JSON.stringify(dados);
  if (texto.length > 4 * 1024 * 1024) return res.status(413).json({ erro: 'arquivo grande demais' });

  try {
    const dias = Object.keys(dados.dias).sort();
    const j = await gravar(conf.arquivo, texto, `Atualiza o GBD da ${conf.rotulo.toLowerCase()}: ${dias.length} dias, de ${dias[0]} a ${dias[dias.length - 1]}`);
    let estadoEm = null;
    if (corpo.estado && typeof corpo.estado === 'object') {
      estadoEm = new Date().toISOString();
      const arq = JSON.stringify(cifrar(corpo.estado, senha, turno, estadoEm));
      if (arq.length > 4 * 1024 * 1024) return res.status(413).json({ erro: 'estado do montador grande demais' });
      await gravar(conf.estado, arq, `Atualiza o estado do montador da ${conf.rotulo.toLowerCase()}`);
    }
    return res.status(200).json({
      ok: true, turno, dias: dias.length, de: dias[0], ate: dias[dias.length - 1], estadoEm,
      commit: ((j.commit && j.commit.sha) || '').slice(0, 7),
    });
  } catch (e) {
    return res.status(502).json({ erro: 'não falou com o GitHub: ' + (e && e.message ? e.message : 'erro') });
  }
};
