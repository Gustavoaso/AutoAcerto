const express = require("express");
const banco = require("../banco");
const { TIPOS_DESPESA, CATEGORIAS_DESPESA, valorMonetarioValido, dataValida } = require("../validacoes");
const { exigirAdmin, exigirAdminOuDono } = require("../middlewares/autenticacao");
const { autorizarAcessoDespesa } = require("../middlewares/autorizacao");
const { obterIdTransportadora, usuarioEhDonoSistema, transportadoraEscopoMutacao } = require("../helpers/escopo");
const { normalizarIdsExclusao, placeholderIds, responderExclusao } = require("../helpers/exclusao");
const { obterParametrosPaginacao, montarRespostaPaginada } = require("../helpers/paginacao");

const router = express.Router();

router.post("/", exigirAdmin, async (requisicao, resposta) => {
  const { tipoDespesa, viagemId, veiculoId, descricao, categoria, dataDespesa, valor } = requisicao.body;
  const tipoDespesaFinal = String(tipoDespesa || "").trim().toLowerCase();
  const categoriaTratada = String(categoria || "").trim().toLowerCase();

  if (!descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  if (!TIPOS_DESPESA.has(tipoDespesaFinal)) {
    return resposta.status(400).json({ mensagem: "Tipo de despesa invalido." });
  }

  if (!CATEGORIAS_DESPESA.has(categoriaTratada)) {
    return resposta.status(400).json({ mensagem: "Categoria de despesa invalida." });
  }

  if (!valorMonetarioValido(valor)) {
    return resposta.status(400).json({ mensagem: "Informe um valor de despesa valido." });
  }

  if (!dataValida(dataDespesa)) {
    return resposta.status(400).json({ mensagem: "Informe uma data valida para a despesa." });
  }

  if (tipoDespesaFinal === "viagem" && !viagemId) {
    return resposta.status(400).json({ mensagem: "Informe a viagem da despesa." });
  }

  if (tipoDespesaFinal === "veiculo" && !veiculoId) {
    return resposta.status(400).json({ mensagem: "Informe o veiculo da despesa." });
  }

  try {
    let tid;
    let viagemIdFinal = null;
    let veiculoIdFinal = null;

    if (tipoDespesaFinal === "viagem") {
      const vr = await banco.query("SELECT transportadora_id FROM viagens WHERE id=$1", [viagemId]);
      if (vr.rows.length === 0) {
        return resposta.status(400).json({ mensagem: "Viagem não encontrada." });
      }
      tid = vr.rows[0].transportadora_id;
      viagemIdFinal = viagemId;
    } else {
      const veiculo = await banco.query("SELECT transportadora_id FROM veiculos WHERE id=$1", [veiculoId]);
      if (veiculo.rows.length === 0) {
        return resposta.status(400).json({ mensagem: "Veículo não encontrado." });
      }
      tid = veiculo.rows[0].transportadora_id;
      veiculoIdFinal = veiculoId;
    }

    if (!usuarioEhDonoSistema(requisicao)) {
      if (tid !== obterIdTransportadora(requisicao)) {
        return resposta.status(400).json({ mensagem: "Viagem/Veículo não encontrada(o) para esta transportadora." });
      }
    }

    const sql = `
      INSERT INTO despesas (transportadora_id, viagem_id, veiculo_id, tipo_despesa, descricao, categoria, data_despesa, valor)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const valores = [tid, viagemIdFinal, veiculoIdFinal, tipoDespesaFinal, descricao, categoriaTratada, dataDespesa, valor];

    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Despesa cadastrada com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    console.error("Erro ao salvar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar despesa no banco de dados." });
  }
});

router.get("/", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);
  
  // ✅ PAGINAÇÃO
  const { pagina, limite, offset } = obterParametrosPaginacao(requisicao.query);

  // Query para contar total de registros
  let sqlCount = "SELECT COUNT(*) as total FROM despesas d";
  const valoresCount = [];

  if (!donoSistema) {
    sqlCount += " WHERE d.transportadora_id = $1";
    valoresCount.push(transportadoraId);
  }

  // Query para buscar dados paginados
  let sql = `
    SELECT
      d.id, d.viagem_id, d.veiculo_id, d.tipo_despesa, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      COALESCE(ve_despesa.modelo, ve_viagem.modelo) AS veiculo_modelo,
      COALESCE(ve_despesa.placa, ve_viagem.placa) AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id AND v.transportadora_id = d.transportadora_id
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_viagem ON v.veiculo_id = ve_viagem.id AND ve_viagem.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_despesa ON d.veiculo_id = ve_despesa.id AND ve_despesa.transportadora_id = d.transportadora_id
    LEFT JOIN transportadoras t ON d.transportadora_id = t.id
  `;
  const valores = [];

  if (!donoSistema) {
    sql += " WHERE d.transportadora_id = $1";
    valores.push(transportadoraId);
  }

  sql += " ORDER BY d.id DESC";
  
  // Adicionar LIMIT e OFFSET
  const proximoIndice = valores.length + 1;
  sql += ` LIMIT $${proximoIndice} OFFSET $${proximoIndice + 1}`;
  valores.push(limite, offset);

  try {
    // Executar ambas as queries
    const [resultadoCount, resultadoDados] = await Promise.all([
      banco.query(sqlCount, valoresCount),
      banco.query(sql, valores)
    ]);

    const totalRegistros = parseInt(resultadoCount.rows[0].total, 10);
    
    return resposta.json(montarRespostaPaginada(resultadoDados.rows, totalRegistros, pagina, limite));
  } catch (erro) {
    console.error("Erro ao buscar despesas:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar despesas." });
  }
});

router.get("/:id", exigirAdminOuDono, autorizarAcessoDespesa, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  let sql = `
    SELECT
      d.id, d.viagem_id, d.veiculo_id, d.tipo_despesa, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      COALESCE(ve_despesa.modelo, ve_viagem.modelo) AS veiculo_modelo,
      COALESCE(ve_despesa.placa, ve_viagem.placa) AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id AND v.transportadora_id = d.transportadora_id
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_viagem ON v.veiculo_id = ve_viagem.id AND ve_viagem.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_despesa ON d.veiculo_id = ve_despesa.id AND ve_despesa.transportadora_id = d.transportadora_id
    LEFT JOIN transportadoras t ON d.transportadora_id = t.id
    WHERE d.id = $1
  `;
  const valores = [id];

  if (!donoSistema) {
    sql += " AND d.transportadora_id = $2";
    valores.push(transportadoraId);
  }
  try {
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Despesa nao encontrada." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar despesa." });
  }
});

router.put("/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { tipoDespesa, viagemId, veiculoId, descricao, categoria, dataDespesa, valor } = requisicao.body;
  const tipoDespesaFinal = String(tipoDespesa || "").trim().toLowerCase();
  const categoriaTratada = String(categoria || "").trim().toLowerCase();

  if (!descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  if (!TIPOS_DESPESA.has(tipoDespesaFinal)) {
    return resposta.status(400).json({ mensagem: "Tipo de despesa invalido." });
  }

  if (!CATEGORIAS_DESPESA.has(categoriaTratada)) {
    return resposta.status(400).json({ mensagem: "Categoria de despesa invalida." });
  }

  if (!valorMonetarioValido(valor)) {
    return resposta.status(400).json({ mensagem: "Informe um valor de despesa valido." });
  }

  if (!dataValida(dataDespesa)) {
    return resposta.status(400).json({ mensagem: "Informe uma data valida para a despesa." });
  }

  if (tipoDespesaFinal === "viagem" && !viagemId) {
    return resposta.status(400).json({ mensagem: "Informe a viagem da despesa." });
  }

  if (tipoDespesaFinal === "veiculo" && !veiculoId) {
    return resposta.status(400).json({ mensagem: "Informe o veiculo da despesa." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "despesas", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Despesa nao encontrada." });
    }

    let viagemIdFinal = null;
    let veiculoIdFinal = null;

    if (tipoDespesaFinal === "viagem") {
      const vr = await banco.query("SELECT transportadora_id FROM viagens WHERE id=$1", [viagemId]);
      if (vr.rows.length === 0 || vr.rows[0].transportadora_id !== transportadoraId) {
        return resposta.status(400).json({ mensagem: "Viagem invalida para o escopo desta despesa." });
      }
      viagemIdFinal = viagemId;
    } else {
      const veiculo = await banco.query("SELECT transportadora_id FROM veiculos WHERE id=$1", [veiculoId]);
      if (veiculo.rows.length === 0 || veiculo.rows[0].transportadora_id !== transportadoraId) {
        return resposta.status(400).json({ mensagem: "Veiculo invalido para o escopo desta despesa." });
      }
      veiculoIdFinal = veiculoId;
    }

    const sql = `
      UPDATE despesas SET
        viagem_id=$1, veiculo_id=$2, tipo_despesa=$3,
        descricao=$4, categoria=$5, data_despesa=$6, valor=$7
      WHERE id=$8 AND transportadora_id=$9
      RETURNING *
    `;
    const valores = [viagemIdFinal, veiculoIdFinal, tipoDespesaFinal, descricao, categoriaTratada, dataDespesa, valor, id, transportadoraId];

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Despesa nao encontrada." });
    }
    return resposta.json({ mensagem: "Despesa atualizada com sucesso.", despesa: resultado.rows[0] });
  } catch (erro) {
    console.error("Erro ao atualizar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar despesa no banco de dados." });
  }
});

router.delete(["/", "/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos uma despesa para excluir." });
  }

  try {
    let resultado;
    if (donoSistema) {
      resultado = await banco.query(
        `DELETE FROM despesas WHERE id IN (${placeholderIds(ids, 1)})`,
        ids
      );
    } else {
      const valores = [transportadoraId, ...ids];
      resultado = await banco.query(
        `DELETE FROM despesas WHERE transportadora_id=$1 AND id IN (${placeholderIds(ids, 2)})`,
        valores
      );
    }
    return responderExclusao(resposta, resultado, "Despesa(s) excluida(s) com sucesso.", "Nenhuma despesa encontrada para exclusao.");
  } catch (erro) {
    console.error("Erro ao excluir despesa(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir despesa(s)." });
  }
});

module.exports = router;
