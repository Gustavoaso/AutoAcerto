const express = require("express");
const banco = require("../banco");
const { STATUS_VEICULO, normalizarStatus } = require("../validacoes");
const { exigirAdmin, exigirAdminOuDono } = require("../middlewares/autenticacao");
const { obterIdTransportadora, usuarioEhDonoSistema, transportadoraIdParaPost, transportadoraEscopoMutacao } = require("../helpers/escopo");
const { normalizarIdsExclusao, placeholderIds, responderExclusao } = require("../helpers/exclusao");

const router = express.Router();

router.post("/", exigirAdmin, async (req, res) => {
  const { modelo, placa, status, ano, observacoes } = req.body;

  const modeloTratado = (modelo || "").trim();
  const placaTratada = (placa || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const statusTratado = normalizarStatus(status);
  let anoTratado = null;
  if (ano !== undefined && ano !== null && String(ano).trim() !== "") {
    const n = parseInt(String(ano), 10);
    if (!isNaN(n)) anoTratado = n;
  }
  const observacoesTratadas = (observacoes || "").trim() || null;

  if (!modeloTratado || !placaTratada || !statusTratado) {
    const pendentes = [];
    if (!modeloTratado) pendentes.push("modelo");
    if (!placaTratada) pendentes.push("placa");
    if (!statusTratado) pendentes.push("status");
    return res.status(400).json({ mensagem: "Preencha os campos obrigatorios: " + pendentes.join(", ") + "." });
  }

  if (placaTratada.length !== 7) {
    return res.status(400).json({ mensagem: "Informe uma placa valida com 7 caracteres." });
  }

  if (!STATUS_VEICULO.has(statusTratado)) {
    return res.status(400).json({ mensagem: "Status de veiculo invalido." });
  }

  if (anoTratado !== null && (anoTratado < 1950 || anoTratado > 2100)) {
    return res.status(400).json({ mensagem: "Ano do veiculo invalido." });
  }

  try {
    const escopo = await transportadoraIdParaPost(req, req.body);
    if (escopo.erro) {
      return res.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const sql = `
      INSERT INTO veiculos (transportadora_id, modelo, placa, status, ano, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const valores = [transportadoraId, modeloTratado, placaTratada, statusTratado, anoTratado, observacoesTratadas];

    const resultado = await banco.query(sql, valores);
    return res.status(201).json({ mensagem: "Veículo cadastrado com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    if (erro.code === "23505") {
      return res.status(400).json({ mensagem: "Já existe um veículo cadastrado com essa placa." });
    }
    console.error("Erro ao salvar veiculo:", erro.message);
    return res.status(500).json({ mensagem: "Erro ao salvar veiculo no banco de dados." });
  }
});

router.get("/", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT v.*, t.nome AS transportadora_nome
      FROM veiculos v
      LEFT JOIN transportadoras t ON v.transportadora_id = t.id
    `;
    const valores = [];

    if (!donoSistema) {
      sql += " WHERE v.transportadora_id=$1";
      valores.push(transportadoraId);
    }

    sql += " ORDER BY v.id DESC";

    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar veículos:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veículos." });
  }
});

router.get("/:id", exigirAdminOuDono, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT v.*, t.nome AS transportadora_nome
      FROM veiculos v
      LEFT JOIN transportadoras t ON v.transportadora_id = t.id
      WHERE v.id = $1
    `;
    const valores = [id];

    if (!donoSistema) {
      sql += " AND v.transportadora_id=$2";
      valores.push(transportadoraId);
    }

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Veículo não encontrado." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar veículo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veículo." });
  }
});

router.put("/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { modelo, placa, status, ano, observacoes } = requisicao.body;

  const modeloTratado = (modelo || "").trim();
  const placaTratada = (placa || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const statusTratado = normalizarStatus(status);
  let anoTratado = null;
  if (ano !== undefined && ano !== null && String(ano).trim() !== "") {
    const n = parseInt(String(ano), 10);
    if (!isNaN(n)) anoTratado = n;
  }
  const observacoesTratadas = (observacoes || "").trim() || null;

  if (!modeloTratado || !placaTratada || !statusTratado) {
    const pendentes = [];
    if (!modeloTratado) pendentes.push("modelo");
    if (!placaTratada) pendentes.push("placa");
    if (!statusTratado) pendentes.push("status");
    return resposta.status(400).json({ mensagem: "Preencha os campos obrigatorios: " + pendentes.join(", ") + "." });
  }

  if (placaTratada.length !== 7) {
    return resposta.status(400).json({ mensagem: "Informe uma placa valida com 7 caracteres." });
  }

  if (!STATUS_VEICULO.has(statusTratado)) {
    return resposta.status(400).json({ mensagem: "Status de veiculo invalido." });
  }

  if (anoTratado !== null && (anoTratado < 1950 || anoTratado > 2100)) {
    return resposta.status(400).json({ mensagem: "Ano do veiculo invalido." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "veiculos", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Veículo não encontrado." });
    }

    const sql = `
      UPDATE veiculos SET
        modelo=$1, placa=$2, status=$3, ano=$4, observacoes=$5
      WHERE id=$6 AND transportadora_id=$7
      RETURNING *
    `;
    const valores = [modeloTratado, placaTratada, statusTratado, anoTratado, observacoesTratadas, id, transportadoraId];

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Veículo não encontrado." });
    }
    return resposta.json({ mensagem: "Veículo atualizado com sucesso.", veiculo: resultado.rows[0] });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um veículo cadastrado com essa placa." });
    }
    console.error("Erro ao atualizar veículo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar veículo no banco de dados." });
  }
});

router.delete(["/", "/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos um veículo para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, donoSistema ? 1 : 2);

    if (donoSistema) {
      const viagens = await cliente.query(`SELECT id FROM viagens WHERE veiculo_id IN (${marcadores})`, ids);
      const idsViagens = viagens.rows.map((linha) => linha.id);

      if (idsViagens.length > 0) {
        const mV = placeholderIds(idsViagens, 1);
        await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${mV})`, idsViagens);
        await cliente.query(`DELETE FROM viagens WHERE id IN (${mV})`, idsViagens);
      }

      const resultado = await cliente.query(`DELETE FROM veiculos WHERE id IN (${marcadores})`, ids);

      await cliente.query("COMMIT");
      return responderExclusao(resposta, resultado, "Veiculo(s) excluido(s) com sucesso.", "Nenhum veiculo encontrado para exclusao.");
    }

    const valores = [transportadoraId, ...ids];
    const viagens = await cliente.query(`SELECT id FROM viagens WHERE transportadora_id=$1 AND veiculo_id IN (${marcadores})`, valores);
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

    const resultado = await cliente.query(`DELETE FROM veiculos WHERE transportadora_id=$1 AND id IN (${marcadores})`, valores);

    await cliente.query("COMMIT");
    return responderExclusao(resposta, resultado, "Veiculo(s) excluido(s) com sucesso.", "Nenhum veiculo encontrado para exclusao.");
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir veículo(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir veículo(s)." });
  } finally {
    cliente.release();
  }
});

module.exports = router;
