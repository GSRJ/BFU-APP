// Acesso ao ApoioSSO por matrícula.
// A lista guarda só o SHA-256 de "bfu-apoio-sso:" + matrícula, para o número não aparecer no site.
// Para liberar alguém: calcule o hash (veja LEIA-ME.txt) e acrescente na lista abaixo.
// Tirar um hash da lista bloqueia a pessoa na próxima vez que ela abrir o ApoioSSO.
const APOIO_LIBERADOS = [
  '8b1dc07700e1e532db524f3a44e6398afc44c696d767b2dd2ecf7d38839dbe77'
];
const APOIO_CHAVE = 'apoio-sso-acesso';

async function apoioHash(mat) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bfu-apoio-sso:' + mat));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function apoioLiberado() {
  try { return APOIO_LIBERADOS.includes(localStorage.getItem(APOIO_CHAVE)); } catch (e) { return false; }
}
async function apoioEntrar(mat) {
  const h = await apoioHash(String(mat).replace(/\D/g, ''));
  if (!APOIO_LIBERADOS.includes(h)) return false;
  try { localStorage.setItem(APOIO_CHAVE, h); } catch (e) {}
  return true;
}
function apoioSair() { try { localStorage.removeItem(APOIO_CHAVE); } catch (e) {} }
