/** Texts of the online game, in PT-BR (D063). */
export const ONLINE_TEXT = Object.freeze({
  opponentAway: 'Adversário desconectado — ele tem 60 s para voltar',
  opponentBack: 'Adversário voltou',
  reconnecting: 'Reconectando…',
  reconnected: 'Conectado de novo',
  connectionLost: 'Conexão perdida',
  endedWhileAway: 'A partida terminou enquanto você estava fora',
  replaced: 'A partida continua em outra aba',
  timeUp: 'Tempo esgotado — aguardando o servidor',
  simFailed: 'Falha na simulação — jogue de novo',
  conceding: 'Desistência enviada…',
  yourTurn: 'Sua vez',
  opponentTurn: 'Vez do adversário',
  backToMenu: 'Voltar ao menu',
  you: 'você',
});

/** The end of an online match as this client sees it (docs/protocol.md, match_end). */
export function onlineEndText({ reason, won }) {
  switch (reason) {
    case 'WIN': return won ? 'Vitória!' : 'Derrota';
    case 'CONCEDE': return won ? 'Vitória — o adversário desistiu' : 'Você desistiu';
    case 'ABANDON': return won ? 'Vitória por W.O.' : 'Derrota por W.O.';
    default: return 'Partida cancelada, sem resultado';
  }
}
