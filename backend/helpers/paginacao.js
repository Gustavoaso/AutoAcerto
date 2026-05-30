// ============================================================
// HELPER - PAGINAÇÃO
// Utilitários para paginação de resultados
// ============================================================

/**
 * Extrai e valida parâmetros de paginação da query string
 * @param {Object} query - req.query
 * @returns {Object} { pagina, limite, offset }
 */
function obterParametrosPaginacao(query) {
  const LIMITE_PADRAO = 50;
  const LIMITE_MAXIMO = 100;
  const PAGINA_PADRAO = 1;

  let pagina = parseInt(query.pagina || query.page, 10);
  let limite = parseInt(query.limite || query.limit, 10);

  // Validação de página
  if (!Number.isInteger(pagina) || pagina < 1) {
    pagina = PAGINA_PADRAO;
  }

  // Validação de limite
  if (!Number.isInteger(limite) || limite < 1) {
    limite = LIMITE_PADRAO;
  }

  // Limite máximo para evitar sobrecarga
  if (limite > LIMITE_MAXIMO) {
    limite = LIMITE_MAXIMO;
  }

  // Calcular offset
  const offset = (pagina - 1) * limite;

  return {
    pagina,
    limite,
    offset
  };
}

/**
 * Monta resposta paginada com metadados
 * @param {Array} dados - Dados da página atual
 * @param {number} totalRegistros - Total de registros no banco
 * @param {number} pagina - Página atual
 * @param {number} limite - Limite por página
 * @returns {Object} Resposta paginada
 */
function montarRespostaPaginada(dados, totalRegistros, pagina, limite) {
  const totalPaginas = Math.ceil(totalRegistros / limite);
  
  return {
    dados,
    paginacao: {
      paginaAtual: pagina,
      itensPorPagina: limite,
      totalItens: totalRegistros,
      totalPaginas,
      temProxima: pagina < totalPaginas,
      temAnterior: pagina > 1
    }
  };
}

/**
 * Adiciona cláusulas LIMIT e OFFSET à query SQL
 * @param {string} sql - Query SQL base
 * @param {number} limite - Limite de registros
 * @param {number} offset - Offset para paginação
 * @param {number} proximoIndice - Próximo índice de placeholder ($N)
 * @returns {Object} { sql, valores }
 */
function adicionarPaginacaoSQL(sql, limite, offset, proximoIndice = 1) {
  const sqlPaginado = `${sql} LIMIT $${proximoIndice} OFFSET $${proximoIndice + 1}`;
  const valores = [limite, offset];
  
  return {
    sql: sqlPaginado,
    valores
  };
}

module.exports = {
  obterParametrosPaginacao,
  montarRespostaPaginada,
  adicionarPaginacaoSQL
};
