const express = require("express");
const banco = require("../banco");
const { STATUS_VIAGEM, normalizarStatus, valorMonetarioValido, dataValida, dataMaiorOuIgual, obterDataHojeIso } = require("../validacoes");
const { autenticar, exigirAdmin, exigirAdminOuMotorista } = require("../middlewares/autenticacao");
const { autorizarAcessoViagem } = require("../middlewares/autorizacao");
const { obterIdTransportadora, usuarioEhDonoSistema, obterFiltroTransportadora, transportadoraIdParaPost, transportadoraEscopoMutacao } = require("../helpers/escopo");
const { motoristaPertenceTransportadora, veiculoPertenceTransportadora } = require("../helpers/validacoes-db");
const { normalizarIdsExclusao, placeholderIds, responderExclusao } = require("../helpers/exclusao");
const { obterParametrosPaginacao, montarRespostaPaginada } = require("../helpers/paginacao");

const router = express.Router();

router.post("/", exigirAdmin, async (requisicao, resposta) => {
  const { origem, destino, motoristaId, veiculoId, dataSaida, valorFrete, kmInicial, observacoes } = requisicao.body;
  const statusTratado = "em andamento";

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !valorFrete || kmInicial == null) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const kmInicialNum = parseInt(kmInicial, 10);

  if (!Number.isInteger(kmInicialNum) || kmInicialNum < 0) {
    return resposta.status(400).json({ mensagem: "Informe o KM inicial da viagem corretamente." });
  }

  if (!valorMonetarioValido(valorFrete)) {
    return resposta.status(400).json({ mensagem: "Informe um valor de frete valido." });
  }

  if (!dataValida(dataSaida)) {
    return resposta.status(400).json({ mensagem: "Informe uma data valida para a viagem." });
  }

  try {
    const escopo = await transportadoraIdParaPost(requisicao, requisicao.body);
    if (escopo.erro) {
      return resposta.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const motoristaValido = await motoristaPertenceTransportadora(motoristaId, transportadoraId);
    const veiculoValido = await veiculoPertenceTransportadora(veiculoId, transportadoraId);

    if (!motoristaValido || !veiculoValido) {
      return resposta.status(400).json({ mensagem: "Motorista ou veículo não encontrado para esta transportadora." });
    }

    const sql = `
      INSERT INTO viagens (transportadora_id, origem, destino, motorista_id, veiculo_id, data_saida, data_chegada, valor_frete, km_inicial, km_final, status, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, NULL, $9, $10)
      RETURNING id
    `;
    const valores = [transportadoraId, origem, destino, motoristaId, veiculoId, dataSaida, valorFrete, kmInicialNum, statusTratado, observacoes || ""];

    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Viagem cadastrada com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    console.error("Erro ao salvar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar viagem no banco de dados." });
  }
});

router.get("/", autenticar, async (requisicao, resposta) => {
  const usuario = requisicao.usuario;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);
  const filtroTransportadoraId = obterFiltroTransportadora(requisicao);
  
  // ✅ PAGINAÇÃO
  const { pagina, limite, offset } = obterParametrosPaginacao(requisicao.query);

  // Query para contar total de registros
  let sqlCount = "SELECT COUNT(*) as total FROM viagens v";
  const valoresCount = [];

  if (!donoSistema || filtroTransportadoraId) {
    sqlCount += " WHERE v.transportadora_id = $1";
    valoresCount.push(filtroTransportadoraId || transportadoraId);
  }

  if (usuario.perfil === "motorista" && usuario.motorista_id) {
    sqlCount += (valoresCount.length > 0 ? " AND " : " WHERE ") + "v.motorista_id = $" + (valoresCount.length + 1);
    valoresCount.push(usuario.motorista_id);
  } else if (usuario.perfil === "motorista") {
    return resposta.json(montarRespostaPaginada([], 0, pagina, limite));
  }

  // Query para buscar dados paginados
  let sql = `
    SELECT
      v.id, v.transportadora_id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.km_inicial, v.km_final, v.status, v.observacoes, v.data_cadastro,
      v.motorista_id, v.veiculo_id,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM viagens v
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = v.transportadora_id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id AND ve.transportadora_id = v.transportadora_id
    LEFT JOIN transportadoras t ON v.transportadora_id = t.id
  `;
  const valores = [];

  if (!donoSistema || filtroTransportadoraId) {
    sql += " WHERE v.transportadora_id = $1";
    valores.push(filtroTransportadoraId || transportadoraId);
  }

  if (usuario.perfil === "motorista" && usuario.motorista_id) {
    sql += (valores.length > 0 ? " AND " : " WHERE ") + "v.motorista_id = $" + (valores.length + 1);
    valores.push(usuario.motorista_id);
  }

  sql += " ORDER BY v.id DESC";
  
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
    console.error("Erro ao buscar viagens:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar viagens." });
  }
});

router.patch("/:id/finalizar", exigirAdminOuMotorista, autorizarAcessoViagem, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { dataChegada, kmFinal } = requisicao.body;
  const dataChegadaFinal = dataChegada || obterDataHojeIso();
  const kmFinalNum = parseInt(kmFinal, 10);

  if (!dataValida(dataChegadaFinal)) {
    return resposta.status(400).json({ mensagem: "Informe uma data de chegada valida." });
  }

  if (!Number.isInteger(kmFinalNum) || kmFinalNum < 0) {
    return resposta.status(400).json({ mensagem: "Informe o KM final da viagem corretamente." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "viagens", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Viagem nao encontrada." });
    }

    const viagemAtual = await banco.query(
      "SELECT status, data_saida, km_inicial FROM viagens WHERE id=$1 AND transportadora_id=$2",
      [id, transportadoraId]
    );

    if (viagemAtual.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem nao encontrada." });
    }

    const viagem = viagemAtual.rows[0];

    if (viagem.status !== "em andamento") {
      return resposta.status(400).json({ mensagem: "Somente viagens em andamento podem ser concluidas." });
    }

    if (!dataMaiorOuIgual(dataChegadaFinal, viagem.data_saida)) {
      return resposta.status(400).json({ mensagem: "A data de chegada nao pode ser anterior a data de saida." });
    }

    if (viagem.km_inicial != null && kmFinalNum < viagem.km_inicial) {
      return resposta.status(400).json({ mensagem: "O KM final nao pode ser menor que o KM inicial." });
    }

    const resultado = await banco.query(
      `UPDATE viagens
       SET data_chegada=$1, km_final=$2, status='finalizada'
       WHERE id=$3 AND transportadora_id=$4
       RETURNING *`,
      [dataChegadaFinal, kmFinalNum, id, transportadoraId]
    );

    return resposta.json({ mensagem: "Viagem concluida com sucesso.", viagem: resultado.rows[0] });
  } catch (erro) {
    console.error("Erro ao concluir viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao concluir viagem." });
  }
});

router.get("/:id", autenticar, autorizarAcessoViagem, async (requisicao, resposta) => {
  const { id } = requisicao.params;

  // ✅ SEGURANÇA: Usuário já foi autorizado pelo middleware
  let sql = `
    SELECT
      v.id, v.transportadora_id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.km_inicial, v.km_final, v.status, v.observacoes, v.data_cadastro,
      v.motorista_id, v.veiculo_id,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM viagens v
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = v.transportadora_id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id AND ve.transportadora_id = v.transportadora_id
    LEFT JOIN transportadoras t ON v.transportadora_id = t.id
    WHERE v.id = $1
  `;
  const valores = [id];

  try {
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem não encontrada." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar viagem." });
  }
});

router.put("/:id", exigirAdminOuMotorista, autorizarAcessoViagem, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, kmInicial, kmFinal, status, observacoes } = requisicao.body;
  const statusTratado = normalizarStatus(status);
  const usuario = requisicao.usuario;

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !valorFrete || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  if (statusTratado === "finalizada") {
    return resposta.status(400).json({ mensagem: "Use a acao de concluir viagem para finalizar uma viagem em andamento." });
  }

  let kmInicialNum = null;
  let kmFinalNum = null;

  if (kmInicial !== undefined && kmInicial !== null && kmInicial !== "") {
    kmInicialNum = parseInt(kmInicial, 10);
  }

  if (kmFinal !== undefined && kmFinal !== null && kmFinal !== "") {
    kmFinalNum = parseInt(kmFinal, 10);
  }

  if (
    (kmInicialNum !== null && (!Number.isInteger(kmInicialNum) || kmInicialNum < 0)) ||
    (kmFinalNum !== null && (!Number.isInteger(kmFinalNum) || kmFinalNum < 0))
  ) {
    return resposta.status(400).json({ mensagem: "Informe KM inicial e KM final validos." });
  }

  if (kmInicialNum !== null && kmFinalNum !== null && kmFinalNum < kmInicialNum) {
    return resposta.status(400).json({ mensagem: "O KM final nao pode ser menor que o KM inicial." });
  }

  if (!STATUS_VIAGEM.has(statusTratado)) {
    return resposta.status(400).json({ mensagem: "Status de viagem invalido." });
  }

  if (!valorMonetarioValido(valorFrete)) {
    return resposta.status(400).json({ mensagem: "Informe um valor de frete valido." });
  }

  if (!dataValida(dataSaida)) {
    return resposta.status(400).json({ mensagem: "Informe uma data valida para a viagem." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "viagens", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Viagem não encontrada." });
    }

    const viagemAtual = await banco.query(
      "SELECT status, data_chegada, km_final, motorista_id, veiculo_id, valor_frete FROM viagens WHERE id=$1 AND transportadora_id=$2",
      [id, transportadoraId]
    );

    if (viagemAtual.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem nao encontrada." });
    }

    const atual = viagemAtual.rows[0];
    let motoristaIdFinal = motoristaId;
    let veiculoIdFinal = veiculoId;
    let valorFreteFinal = valorFrete;
    let dataChegadaFinal = atual.data_chegada;
    let kmFinalAtual = atual.km_final;

    if (usuario.perfil === "motorista") {
      motoristaIdFinal = atual.motorista_id;
      veiculoIdFinal = atual.veiculo_id;
      valorFreteFinal = atual.valor_frete;
    }

    if (atual.status !== "em andamento") {
      if (!dataChegada || !dataValida(dataChegada)) {
        return resposta.status(400).json({ mensagem: "Informe a data de chegada da viagem." });
      }
      if (!dataMaiorOuIgual(dataChegada, dataSaida)) {
        return resposta.status(400).json({ mensagem: "A data de chegada nao pode ser anterior a data de saida." });
      }
      dataChegadaFinal = dataChegada;
      kmFinalAtual = kmFinalNum != null ? kmFinalNum : atual.km_final;
    }

    const motoristaValido = await motoristaPertenceTransportadora(motoristaIdFinal, transportadoraId);
    const veiculoValido = await veiculoPertenceTransportadora(veiculoIdFinal, transportadoraId);

    if (!motoristaValido || !veiculoValido) {
      return resposta.status(400).json({ mensagem: "Motorista ou veículo não encontrado para esta transportadora." });
    }

    const sql = `
      UPDATE viagens SET
        origem=$1, destino=$2, motorista_id=$3, veiculo_id=$4,
        data_saida=$5, data_chegada=$6, valor_frete=$7,
        km_inicial=COALESCE($8, km_inicial), km_final=$9,
        status=$10, observacoes=$11
      WHERE id=$12 AND transportadora_id=$13
      RETURNING *
    `;
    const valores = [
      origem, destino, motoristaIdFinal, veiculoIdFinal, dataSaida, dataChegadaFinal, valorFreteFinal,
      kmInicialNum, kmFinalAtual, statusTratado, observacoes || "", id, transportadoraId
    ];

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem não encontrada." });
    }
    return resposta.json({ mensagem: "Viagem atualizada com sucesso.", viagem: resultado.rows[0] });
  } catch (erro) {
    console.error("Erro ao atualizar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar viagem no banco de dados." });
  }
});

router.delete(["/", "/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos uma viagem para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, donoSistema ? 1 : 2);

    if (donoSistema) {
      await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${marcadores})`, ids);
      const resultado = await cliente.query(`DELETE FROM viagens WHERE id IN (${marcadores})`, ids);
      await cliente.query("COMMIT");
      return responderExclusao(resposta, resultado, "Viagem(ns) excluida(s) com sucesso.", "Nenhuma viagem encontrada para exclusao.");
    }

    const valores = [transportadoraId, ...ids];
    await cliente.query(`DELETE FROM despesas WHERE transportadora_id=$1 AND viagem_id IN (${marcadores})`, valores);
    const resultado = await cliente.query(`DELETE FROM viagens WHERE transportadora_id=$1 AND id IN (${marcadores})`, valores);

    await cliente.query("COMMIT");
    return responderExclusao(resposta, resultado, "Viagem(ns) excluida(s) com sucesso.", "Nenhuma viagem encontrada para exclusao.");
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir viagem(ns):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir viagem(ns)." });
  } finally {
    cliente.release();
  }
});

module.exports = router;
