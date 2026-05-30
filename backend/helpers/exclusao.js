// ============================================================
// HELPERS - EXCLUSÃO EM MASSA E PLACEHOLDERS SQL
// ============================================================

/**
 * Normaliza e valida IDs para exclusão em massa
 * @param {Object} requisicao - Objeto de requisição Express
 * @returns {Array<number>} Array de IDs validados
 * @throws {Error} Se IDs forem inválidos
 */
function normalizarIdsExclusao(requisicao) {
  const origem = Array.isArray(requisicao.body && requisicao.body.ids)
    ? requisicao.body.ids
    : [requisicao.params.id];

  // ✅ SEGURANÇA: Validação rigorosa de IDs
  const ids = origem.map((id) => {
    const parsed = parseInt(id, 10);
    
    // Rejeitar se não for número inteiro positivo válido
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 2147483647) {
      throw new Error(`ID inválido: ${id}`);
    }
    
    return parsed;
  });

  // Remover duplicatas
  return [...new Set(ids)];
}

/**
 * Gera placeholders SQL parametrizados de forma segura
 * @param {Array<number>} ids - Array de IDs validados
 * @param {number} inicio - Índice inicial do placeholder
 * @returns {string} String de placeholders ($1, $2, ...)
 * @throws {Error} Se IDs forem inválidos ou excederem limite
 */
function placeholderIds(ids, inicio) {
  // ✅ SEGURANÇA: Validação defensiva (defesa em profundidade)
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('IDs deve ser array não vazio');
  }
  
  // Validar que todos são inteiros positivos
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error('Todos os IDs devem ser inteiros positivos');
  }
  
  // ✅ SEGURANÇA: Limite de IDs para prevenir DoS
  if (ids.length > 1000) {
    throw new Error('Máximo de 1000 IDs por requisição');
  }
  
  return ids.map((_, indice) => `$${inicio + indice}`).join(", ");
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
