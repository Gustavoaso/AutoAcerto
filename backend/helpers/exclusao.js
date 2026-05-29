// ============================================================
// HELPERS - EXCLUSÃO EM MASSA E PLACEHOLDERS SQL
// ============================================================

function normalizarIdsExclusao(requisicao) {
  const origem = Array.isArray(requisicao.body && requisicao.body.ids)
    ? requisicao.body.ids
    : [requisicao.params.id];

  const ids = origem
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  return [...new Set(ids)];
}

function placeholderIds(ids, inicio) {
  return ids.map((_, indice) => "$" + (inicio + indice)).join(", ");
}

function responderExclusao(resposta, resultado, mensagemSucesso, mensagemNaoEncontrado) {
  if (resultado.rowCount === 0) {
    return resposta.status(404).json({ mensagem: mensagemNaoEncontrado });
  }

  return resposta.json({ mensagem: mensagemSucesso, total: resultado.rowCount });
}

module.exports = {
  normalizarIdsExclusao,
  placeholderIds,
  responderExclusao
};
