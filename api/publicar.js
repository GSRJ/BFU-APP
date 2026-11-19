/* Publica o GBD dos agentes: grava gbd/gbd-dados.json no repositório.
   O token do GitHub nunca sai daqui. Variáveis necessárias na Vercel:
   GITHUB_TOKEN    token fino, só neste repositório, permissão Contents: Read and write
   PUBLICAR_SENHA  senha que você digita no montador (12 caracteres ou mais) */
const REPO = process.env.GBD_REPO || 'GSRJ/BFU-APP';
const CAMINHO = 'gbd/gbd-dados.json';
const RAMO = process.env.GBD_RAMO || 'main';

const igual = (a, b) => {
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

module.exports = async (req, res) => {
  const senha = process.env.PUBLICAR_SENHA, token = process.env.GITHUB_TOKEN;
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'GET') return res.status(200).json({ pronto: !!(senha && token && senha.length >= 12) });
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });
  if (!token) return res.status(500).json({ erro: 'falta a variável GITHUB_TOKEN na Vercel' });
  if (!senha) return res.status(500).json({ erro: 'falta a variável PUBLICAR_SENHA na Vercel' });
  if (senha.length < 12) return res.status(500).json({ erro: 'a PUBLICAR_SENHA precisa ter 12 caracteres ou mais' });

  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch (e) { return res.status(400).json({ erro: 'corpo inválido' }); } }
  if (!corpo || typeof corpo !== 'object') return res.status(400).json({ erro: 'corpo inválido' });
  if (!igual(corpo.senha, senha)) return res.status(401).json({ erro: 'senha incorreta' });

  const dados = corpo.dados;
  if (!dados || typeof dados !== 'object' || !dados.dias || !Object.keys(dados.dias).length)
    return res.status(400).json({ erro: 'dados sem nenhum dia' });

  const texto = JSON.stringify(dados);
  if (texto.length > 4 * 1024 * 1024) return res.status(413).json({ erro: 'arquivo grande demais' });

  const h = {
    authorization: 'Bearer ' + token,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'bfu-app-gbd',
  };
  const url = `https://api.github.com/repos/${REPO}/contents/${CAMINHO}`;

  try {
    let sha;
    const atual = await fetch(`${url}?ref=${encodeURIComponent(RAMO)}`, { headers: h });
    if (atual.ok) sha = (await atual.json()).sha;
    else if (atual.status === 401 || atual.status === 403) return res.status(502).json({ erro: 'o token do GitHub não tem permissão de escrita neste repositório' });
    else if (atual.status !== 404) return res.status(502).json({ erro: 'o GitHub respondeu ' + atual.status + ' ao ler o arquivo' });

    const dias = Object.keys(dados.dias).sort();
    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...h, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: `Atualiza o GBD dos agentes: ${dias.length} dias, de ${dias[0]} a ${dias[dias.length - 1]}`,
        content: Buffer.from(texto, 'utf8').toString('base64'),
        branch: RAMO,
        ...(sha ? { sha } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ erro: j.message || 'o GitHub respondeu ' + r.status });
    return res.status(200).json({
      ok: true, dias: dias.length, de: dias[0], ate: dias[dias.length - 1],
      commit: ((j.commit && j.commit.sha) || '').slice(0, 7),
    });
  } catch (e) {
    return res.status(502).json({ erro: 'não falou com o GitHub: ' + (e && e.message ? e.message : 'erro') });
  }
};
