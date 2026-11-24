// Tabela de tempos da ESTIMATIVA DE TREM.
// Um trecho por linha: estação; estação; minutos. Cada trecho vale nos dois sentidos.
// Viagens entre estações distantes somam os trechos do caminho.
// A página usa sempre esta tabela. A fonte é a imagem fonte-linha11.jpg, ao lado deste arquivo.
//
// Linha 11: tempo médio de percurso entre estações vizinhas, tirado da matriz
// "Tempo de percurso entre estações da Linha 11". Todos os pares da matriz são a
// soma destes trechos (conferido nos 136 pares), então a página dá os mesmos tempos.
window.TEMPOS_PADRAO = `
BFU; LUZ; 5:00
LUZ; BAS; 4:00
BAS; TAT; 6:30
TAT; ITQ; 12:00
ITQ; DBO; 3:00
DBO; JBO; 2:30
JBO; GUA; 3:00
GUA; AGN; 4:30
AGN; FVC; 3:00
FVC; POA; 4:30
POA; CVN; 2:30
CVN; SUZ; 3:00
SUZ; JPB; 7:00
JPB; BCB; 4:00
BCB; MDC; 4:30
MDC; EST; 3:00
`;

// Nome por extenso de cada sigla, usado nos menus, no aviso e na voz.
window.NOMES_ESTACOES = {
  BFU: 'Palmeiras-Barra Funda', LUZ: 'Luz', BAS: 'Brás', TAT: 'Tatuapé',
  ITQ: 'Corinthians-Itaquera', DBO: 'Dom Bosco', JBO: 'José Bonifácio', GUA: 'Guaianases',
  AGN: 'Antonio Gianetti Neto', FVC: 'Ferraz de Vasconcelos', POA: 'Poá', CVN: 'Calmon Viana',
  SUZ: 'Suzano', JPB: 'Jundiapeba', BCB: 'Braz Cubas', MDC: 'Mogi das Cruzes', EST: 'Estudantes'
};
