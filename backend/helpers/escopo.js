// ============================================================
// HELPERS - ESCOPO DE TRANSPORTADORA (MULTI-TENANCY)
// ============================================================

const banco = require("../banco");

function obterIdTransportadora(requisicao) {
  return requisicao.usuario.transportadora_id;
}

function usuarioEhDonoSistema(requisicao) {
  return requisicao.usuario.perfil === "dono";
}

const MAPA_TABELA_TRANSPORTADORA = {
  motoristas: "motoristas",
  veiculos: "veiculos",
  viagens: "viagens",
  despesas: "despesas"
};

async function transportadoraIdParaPost(requisicao, corpo) {
  if (usuarioEhDonoSistema(requisicao)) {
    const id = parseInt(corpo && corpo.transportadora_id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return { erro: "Informe transportadora_id para cadastrar como dono do sistema." };
    }
    const ok = await banco.query("SELECT 1 FROM transportadoras WHERE id=$1", [id]);
    if (ok.rows.length === 0) {
      return { erro: "Transportadora não encontrada." };
    }
    return { id };
  }
  const idJwt = obterIdTransportadora(requisicao);
  if (idJwt == null) {
    return { erro: "Sessão sem transportadora vinculada." };
  }
  return { id: idJwt };
}

async function transportadoraEscopoMutacao(requisicao, chaveTabela, idRecurso) {
  const nomeTabela = MAPA_TABELA_TRANSPORTADORA[chaveTabela];
  if (!nomeTabela) return null;
  if (usuarioEhDonoSistema(requisicao)) {
    const r = await banco.query(`SELECT transportadora_id FROM ${nomeTabela} WHERE id=$1`, [idRecurso]);
    if (r.rows.length === 0) return null;
    return r.rows[0].transportadora_id;
  }
  return obterIdTransportadora(requisicao);
}

module.exports = {
  obterIdTransportadora,
  usuarioEhDonoSistema,
  MAPA_TABELA_TRANSPORTADORA,
  transportadoraIdParaPost,
  transportadoraEscopoMutacao
};
