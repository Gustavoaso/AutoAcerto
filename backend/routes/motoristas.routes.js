const express = require("express");
const banco = require("../banco");
const { STATUS_MOTORISTA, normalizarStatus, cpfValido } = require("../validacoes");
const { exigirAdmin, exigirAdminOuDono } = require("../middlewares/autenticacao");
const { autorizarAcessoMotorista } = require("../middlewares/autorizacao");
const { obterIdTransportadora, usuarioEhDonoSistema, obterFiltroTransportadora, transportadoraIdParaPost, transportadoraEscopoMutacao } = require("../helpers/escopo");
const { normalizarIdsExclusao, placeholderIds, responderExclusao } = require("../helpers/exclusao");
const { obterParametrosPaginacao, montarRespostaPaginada } = require("../helpers/paginacao");

const router = express.Router();

function normalizarCpf(cpf) {
  return String(cpf || "").replace(/\D/g, "");
}

router.post("/", exigirAdmin, async (requisicao, resposta) => {
  const { nome, cpf, telefone, cnh, status } = requisicao.body;
  const statusTratado = normalizarStatus(status);
  const cpfTratado = normalizarCpf(cpf);

  if (!nome || !cpf || !telefone || !cnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  if (!STATUS_MOTORISTA.has(statusTratado)) {
    return resposta.status(400).json({ mensagem: "Status de motorista invalido." });
  }

  if (!cpfValido(cpfTratado)) {
    return resposta.status(400).json({ mensagem: "CPF informado é inválido." });
  }

  try {
    const escopo = await transportadoraIdParaPost(requisicao, requisicao.body);
    if (escopo.erro) {
      return resposta.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const sql = `
      INSERT INTO motoristas (transportadora_id, nome, cpf, telefone, cnh, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const valores = [transportadoraId, nome, cpfTratado, telefone, cnh, statusTratado];

    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Motorista cadastrado com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um motorista cadastrado com esse CPF." });
    }
    console.error("Erro ao salvar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar motorista no banco de dados." });
  }
});

router.get("/", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);
  const filtroTransportadoraId = obterFiltroTransportadora(requisicao);
  
  // ✅ PAGINAÇÃO
  const { pagina, limite, offset } = obterParametrosPaginacao(requisicao.query);

  // Query para contar total de registros
  let sqlCount = "SELECT COUNT(*) as total FROM motoristas m";
  const valoresCount = [];

  if (!donoSistema || filtroTransportadoraId) {
    sqlCount += " WHERE m.transportadora_id = $1";
    valoresCount.push(filtroTransportadoraId || transportadoraId);
  }

  // Query para buscar dados paginados
  try {
    let sql = `
      SELECT m.*, t.nome AS transportadora_nome
      FROM motoristas m
      LEFT JOIN transportadoras t ON m.transportadora_id = t.id
    `;
    const valores = [];

    if (!donoSistema || filtroTransportadoraId) {
      sql += " WHERE m.transportadora_id=$1";
      valores.push(filtroTransportadoraId || transportadoraId);
    }

    sql += " ORDER BY m.id DESC";
    
    // Adicionar LIMIT e OFFSET
    const proximoIndice = valores.length + 1;
    sql += ` LIMIT $${proximoIndice} OFFSET $${proximoIndice + 1}`;
    valores.push(limite, offset);

    // Executar ambas as queries
    const [resultadoCount, resultadoDados] = await Promise.all([
      banco.query(sqlCount, valoresCount),
      banco.query(sql, valores)
    ]);

    const totalRegistros = parseInt(resultadoCount.rows[0].total, 10);
    
    return resposta.json(montarRespostaPaginada(resultadoDados.rows, totalRegistros, pagina, limite));
  } catch (erro) {
    console.error("Erro ao buscar motoristas:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar motoristas." });
  }
});

router.get("/:id", exigirAdminOuDono, autorizarAcessoMotorista, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT m.*, t.nome AS transportadora_nome
      FROM motoristas m
      LEFT JOIN transportadoras t ON m.transportadora_id = t.id
      WHERE m.id = $1
    `;
    const valores = [id];

    if (!donoSistema) {
      sql += " AND m.transportadora_id=$2";
      valores.push(transportadoraId);
    }

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Motorista não encontrado." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar motorista." });
  }
});

router.put("/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { nome, cpf, telefone, cnh, status } = requisicao.body;
  const statusTratado = normalizarStatus(status);
  const cpfTratado = normalizarCpf(cpf);

  if (!nome || !cpf || !telefone || !cnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  if (!STATUS_MOTORISTA.has(statusTratado)) {
    return resposta.status(400).json({ mensagem: "Status de motorista invalido." });
  }

  if (!cpfValido(cpfTratado)) {
    return resposta.status(400).json({ mensagem: "CPF informado é inválido." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "motoristas", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Motorista não encontrado." });
    }

    const sql = `
      UPDATE motoristas SET
        nome=$1, cpf=$2, telefone=$3, cnh=$4, status=$5
      WHERE id=$6 AND transportadora_id=$7
      RETURNING *
    `;
    const valores = [nome, cpfTratado, telefone, cnh, statusTratado, id, transportadoraId];

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Motorista não encontrado." });
    }
    return resposta.json({ mensagem: "Motorista atualizado com sucesso.", motorista: resultado.rows[0] });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um motorista cadastrado com esse CPF." });
    }
    console.error("Erro ao atualizar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar motorista no banco de dados." });
  }
});

router.delete(["/", "/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos um motorista para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, donoSistema ? 1 : 2);

    if (donoSistema) {
      const viagens = await cliente.query(`SELECT id FROM viagens WHERE motorista_id IN (${marcadores})`, ids);
      const idsViagens = viagens.rows.map((linha) => linha.id);

      if (idsViagens.length > 0) {
        const mV = placeholderIds(idsViagens, 1);
        await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${mV})`, idsViagens);
        await cliente.query(`DELETE FROM viagens WHERE id IN (${mV})`, idsViagens);
      }

      await cliente.query(`UPDATE usuarios SET motorista_id=NULL WHERE motorista_id IN (${marcadores})`, ids);
      const resultado = await cliente.query(`DELETE FROM motoristas WHERE id IN (${marcadores})`, ids);

      await cliente.query("COMMIT");
      return responderExclusao(resposta, resultado, "Motorista(s) excluido(s) com sucesso.", "Nenhum motorista encontrado para exclusao.");
    }

    const valores = [transportadoraId, ...ids];
    const viagens = await cliente.query(`SELECT id FROM viagens WHERE transportadora_id=$1 AND motorista_id IN (${marcadores})`, valores);
    const idsViagens = viagens.rows.map((linha) => linha.id);

    if (idsViagens.length > 0) {
      await cliente.query(
        `DELETE FROM despesas WHERE transportadora_id=$1 AND viagem_id IN (${placeholderIds(idsViagens, 2)})`,
        [transportadoraId, ...idsViagens]
      );
      await cliente.query(
        `DELETE FROM viagens WHERE transportadora_id=$1 AND id IN (${placeholderIds(idsViagens, 2)})`,
        [transportadoraId, ...idsViagens]
      );
    }

    await cliente.query(`UPDATE usuarios SET motorista_id=NULL WHERE transportadora_id=$1 AND motorista_id IN (${marcadores})`, valores);
    const resultado = await cliente.query(`DELETE FROM motoristas WHERE transportadora_id=$1 AND id IN (${marcadores})`, valores);

    await cliente.query("COMMIT");
    return responderExclusao(resposta, resultado, "Motorista(s) excluido(s) com sucesso.", "Nenhum motorista encontrado para exclusao.");
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir motorista(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir motorista(s)." });
  } finally {
    cliente.release();
  }
});

module.exports = router;
