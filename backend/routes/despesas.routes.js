const express = require("express");
const banco = require("../banco");
const { TIPOS_DESPESA, CATEGORIAS_DESPESA, valorMonetarioValido, dataValida, dataMaiorOuIgual, dataNaoFutura } = require("../validacoes");
const { autenticar, exigirAdmin, exigirAdminOuDono, exigirAdminOuMotorista } = require("../middlewares/autenticacao");
const { autorizarAcessoDespesa } = require("../middlewares/autorizacao");
const { obterIdTransportadora, usuarioEhDonoSistema, obterFiltroTransportadora, transportadoraEscopoMutacao } = require("../helpers/escopo");
const { normalizarIdsExclusao, placeholderIds, responderExclusao } = require("../helpers/exclusao");
const { obterParametrosPaginacao, montarRespostaPaginada } = require("../helpers/paginacao");
const { notificarAdministradoresTransportadora } = require("../helpers/notificacoes");

const router = express.Router();

router.post("/", exigirAdminOuMotorista, async (requisicao, resposta) => {
  const { tipoDespesa, viagemId, veiculoId, descricao, categoria, dataDespesa, valor, observacoes, anexoCupomNome, anexoCupomTipo, anexoCupomBase64 } = requisicao.body;
  const tipoDespesaFinal = String(tipoDespesa || "").trim().toLowerCase();
  const categoriaTratada = String(categoria || "").trim().toLowerCase();
  const usuario = requisicao.usuario;
  const anexoNomeTratado = anexoCupomNome ? String(anexoCupomNome).trim().slice(0, 255) : null;
  const anexoTipoTratado = anexoCupomTipo ? String(anexoCupomTipo).trim().slice(0, 100) : null;
  const anexoBase64Tratado = anexoCupomBase64 ? String(anexoCupomBase64).trim() : null;
  const observacoesTratadas = observacoes ? String(observacoes).trim() : null;

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

  if (tipoDespesaFinal === "veiculo" && !dataNaoFutura(dataDespesa)) {
    return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser futura." });
  }

  if (usuario.perfil === "motorista" && tipoDespesaFinal !== "viagem") {
    return resposta.status(400).json({ mensagem: "Motoristas podem registrar apenas despesas de viagem." });
  }

  if (tipoDespesaFinal === "viagem" && !viagemId) {
    return resposta.status(400).json({ mensagem: "Informe a viagem da despesa." });
  }

  if (tipoDespesaFinal === "veiculo" && !veiculoId) {
    return resposta.status(400).json({ mensagem: "Informe o veiculo da despesa." });
  }

  if (anexoBase64Tratado) {
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(anexoBase64Tratado)) {
      return resposta.status(400).json({ mensagem: "O anexo do cupom deve ser uma imagem valida." });
    }

    if (anexoBase64Tratado.length > 7 * 1024 * 1024) {
      return resposta.status(400).json({ mensagem: "A imagem do cupom excede o tamanho permitido." });
    }
  }

  try {
    let tid;
    let viagemIdFinal = null;
    let veiculoIdFinal = null;

    if (tipoDespesaFinal === "viagem") {
      const vr = await banco.query("SELECT transportadora_id, motorista_id, data_saida, data_chegada, status FROM viagens WHERE id=$1", [viagemId]);
      if (vr.rows.length === 0) {
        return resposta.status(400).json({ mensagem: "Viagem não encontrada." });
      }
      if (vr.rows[0].status !== "em andamento") {
        return resposta.status(400).json({ mensagem: "Despesas so podem ser lancadas em viagens em andamento." });
      }
      if (usuario.perfil === "motorista" && vr.rows[0].motorista_id !== usuario.motorista_id) {
        return resposta.status(403).json({ mensagem: "Voce so pode registrar despesas para suas proprias viagens." });
      }
      if (!dataMaiorOuIgual(dataDespesa, vr.rows[0].data_saida)) {
        return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser anterior a data de saida da viagem." });
      }
      if (vr.rows[0].data_chegada && !dataMaiorOuIgual(vr.rows[0].data_chegada, dataDespesa)) {
        return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser posterior a data final da viagem." });
      }
      if (!dataNaoFutura(dataDespesa)) {
        return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser futura." });
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
      INSERT INTO despesas (transportadora_id, viagem_id, veiculo_id, tipo_despesa, descricao, categoria, data_despesa, valor, observacoes, anexo_cupom_nome, anexo_cupom_tipo, anexo_cupom_base64)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;
    const valores = [tid, viagemIdFinal, veiculoIdFinal, tipoDespesaFinal, descricao, categoriaTratada, dataDespesa, valor, observacoesTratadas, anexoNomeTratado, anexoTipoTratado, anexoBase64Tratado];

    const resultado = await banco.query(sql, valores);
    const despesaId = resultado.rows[0].id;

    notificarAdministradoresTransportadora({
      transportadoraId: tid,
      tipo: "despesa_criada",
      titulo: "Nova despesa registrada",
      mensagem: "Uma despesa de " + categoriaTratada + " no valor de R$ " + Number(valor).toFixed(2).replace(".", ",") + " foi registrada.",
      url: "ver-despesa.html?id=" + despesaId,
      dados: {
        despesa_id: despesaId,
        viagem_id: viagemIdFinal,
        veiculo_id: veiculoIdFinal,
        categoria: categoriaTratada,
        valor: Number(valor)
      }
    }).catch(function (erro) {
      console.error("Erro ao criar notificacao de despesa:", erro.message);
    });

    return resposta.status(201).json({ mensagem: "Despesa cadastrada com sucesso.", id: despesaId });
  } catch (erro) {
    console.error("Erro ao salvar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar despesa no banco de dados." });
  }
});

router.get("/", autenticar, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);
  const filtroTransportadoraId = obterFiltroTransportadora(requisicao);
  const usuario = requisicao.usuario;
  
  // ✅ PAGINAÇÃO
  const { pagina, limite, offset } = obterParametrosPaginacao(requisicao.query);

  // Query para contar total de registros
  let sqlCount = "SELECT COUNT(*) as total FROM despesas d";
  const valoresCount = [];

  if (!donoSistema || filtroTransportadoraId) {
    sqlCount += " WHERE d.transportadora_id = $1";
    valoresCount.push(filtroTransportadoraId || transportadoraId);
  }

  if (usuario.perfil === "motorista" && usuario.motorista_id) {
    sqlCount += (valoresCount.length > 0 ? " AND " : " WHERE ") + "d.viagem_id IN (SELECT id FROM viagens WHERE motorista_id = $" + (valoresCount.length + 1) + ")";
    valoresCount.push(usuario.motorista_id);
  } else if (usuario.perfil === "motorista") {
    return resposta.json(montarRespostaPaginada([], 0, pagina, limite));
  }

  // Query para buscar dados paginados
  let sql = `
    SELECT
      d.id, d.viagem_id, d.veiculo_id, d.tipo_despesa, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.observacoes, d.data_cadastro,
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

  if (!donoSistema || filtroTransportadoraId) {
    sql += " WHERE d.transportadora_id = $1";
    valores.push(filtroTransportadoraId || transportadoraId);
  }

  if (usuario.perfil === "motorista" && usuario.motorista_id) {
    sql += (valores.length > 0 ? " AND " : " WHERE ") + "d.viagem_id IN (SELECT id FROM viagens WHERE motorista_id = $" + (valores.length + 1) + ")";
    valores.push(usuario.motorista_id);
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

router.get("/:id", autenticar, autorizarAcessoDespesa, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  let sql = `
    SELECT
      d.id, d.viagem_id, d.veiculo_id, d.tipo_despesa, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.observacoes, d.data_cadastro, d.anexo_cupom_nome, d.anexo_cupom_tipo, d.anexo_cupom_base64,
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
  const { tipoDespesa, viagemId, veiculoId, descricao, categoria, dataDespesa, valor, observacoes } = requisicao.body;
  const tipoDespesaFinal = String(tipoDespesa || "").trim().toLowerCase();
  const categoriaTratada = String(categoria || "").trim().toLowerCase();
  const observacoesTratadas = observacoes ? String(observacoes).trim() : null;

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

  if (tipoDespesaFinal === "veiculo" && !dataNaoFutura(dataDespesa)) {
    return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser futura." });
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
      const vr = await banco.query("SELECT transportadora_id, data_saida, data_chegada, status FROM viagens WHERE id=$1", [viagemId]);
      if (vr.rows.length === 0 || vr.rows[0].transportadora_id !== transportadoraId) {
        return resposta.status(400).json({ mensagem: "Viagem invalida para o escopo desta despesa." });
      }
      if (vr.rows[0].status !== "em andamento") {
        return resposta.status(400).json({ mensagem: "Despesas so podem ser lancadas em viagens em andamento." });
      }
      if (!dataMaiorOuIgual(dataDespesa, vr.rows[0].data_saida)) {
        return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser anterior a data de saida da viagem." });
      }
      if (vr.rows[0].data_chegada && !dataMaiorOuIgual(vr.rows[0].data_chegada, dataDespesa)) {
        return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser posterior a data final da viagem." });
      }
      if (!dataNaoFutura(dataDespesa)) {
        return resposta.status(400).json({ mensagem: "A data da despesa nao pode ser futura." });
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
        descricao=$4, categoria=$5, data_despesa=$6, valor=$7, observacoes=$8
      WHERE id=$9 AND transportadora_id=$10
      RETURNING *
    `;
    const valores = [viagemIdFinal, veiculoIdFinal, tipoDespesaFinal, descricao, categoriaTratada, dataDespesa, valor, observacoesTratadas, id, transportadoraId];

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
