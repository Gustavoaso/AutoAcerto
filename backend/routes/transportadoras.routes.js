const express = require("express");
const bcrypt = require("bcryptjs");
const banco = require("../banco");
const { normalizarEmail, emailValido, cnpjValido } = require("../validacoes");
const { exigirDonoSistema } = require("../middlewares/autenticacao");
const { normalizarIdsExclusao, placeholderIds, responderExclusao } = require("../helpers/exclusao");

const router = express.Router();

router.get("/", exigirDonoSistema, async (requisicao, resposta) => {
  try {
    const sql = `
      SELECT
        t.id, t.nome, t.cnpj, t.ativo, t.data_cadastro,
        COUNT(u.id) FILTER (WHERE u.perfil = 'admin') AS total_admins
      FROM transportadoras t
      LEFT JOIN usuarios u ON u.transportadora_id = t.id
      GROUP BY t.id
      ORDER BY t.id DESC
    `;
    const resultado = await banco.query(sql);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar transportadoras:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar transportadoras." });
  }
});

router.get("/:id", exigirDonoSistema, async (requisicao, resposta) => {
  try {
    const { id } = requisicao.params;
    const sql = `
      SELECT
        t.id, t.nome, t.cnpj, t.ativo, t.data_cadastro,
        COUNT(u.id) FILTER (WHERE u.perfil = 'admin') AS total_admins
      FROM transportadoras t
      LEFT JOIN usuarios u ON u.transportadora_id = t.id
      WHERE t.id = $1
      GROUP BY t.id
    `;
    const resultado = await banco.query(sql, [id]);
    
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Transportadora não encontrada." });
    }
    
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar transportadora:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar transportadora." });
  }
});

router.post("/", exigirDonoSistema, async (requisicao, resposta) => {
  const {
    nomeTransportadora,
    cnpj,
    nomeUsuario,
    emailUsuario,
    senhaUsuario
  } = requisicao.body;
  const nomeTransportadoraTratado = String(nomeTransportadora || "").trim();
  const nomeUsuarioTratado = String(nomeUsuario || "").trim();
  const emailUsuarioNormalizado = normalizarEmail(emailUsuario);
  const cnpjTratado = cnpj ? String(cnpj).trim() : null;

  if (!nomeTransportadoraTratado || !nomeUsuarioTratado || !emailUsuarioNormalizado) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  if (!emailValido(emailUsuarioNormalizado)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido para o administrador." });
  }

  if (cnpjTratado && !cnpjValido(cnpjTratado)) {
    return resposta.status(400).json({ mensagem: "CNPJ informado é inválido." });
  }

  if (String(senhaUsuario).length < 8) {
    return resposta.status(400).json({ mensagem: "A senha do administrador deve ter pelo menos 8 caracteres." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");

    const resultadoTransportadora = await cliente.query(`
      INSERT INTO transportadoras (nome, cnpj, ativo)
      VALUES ($1, $2, TRUE)
      RETURNING id
    `, [nomeTransportadoraTratado, cnpjTratado]);

    const transportadoraId = resultadoTransportadora.rows[0].id;
    const senhaHash = await bcrypt.hash(senhaUsuario, 10);

    const resultadoUsuario = await cliente.query(`
      INSERT INTO usuarios (transportadora_id, nome, email, senha_hash, perfil, motorista_id, ativo)
      VALUES ($1, $2, $3, $4, 'admin', NULL, TRUE)
      RETURNING id
    `, [transportadoraId, nomeUsuarioTratado, emailUsuarioNormalizado, senhaHash]);

    await cliente.query("COMMIT");

    return resposta.status(201).json({
      mensagem: "Transportadora e administrador criados com sucesso.",
      transportadora_id: transportadoraId,
      usuario_id: resultadoUsuario.rows[0].id
    });
  } catch (erro) {
    await cliente.query("ROLLBACK");
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um usuário cadastrado com esse e-mail." });
    }
    console.error("Erro ao criar transportadora:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao criar transportadora." });
  } finally {
    cliente.release();
  }
});

router.put("/:id", exigirDonoSistema, async (requisicao, resposta) => {
  try {
    const { id } = requisicao.params;
    const { nome, cnpj, ativo } = requisicao.body;
    const cnpjTratado = cnpj ? String(cnpj).trim() : null;
    
    if (cnpjTratado && !cnpjValido(cnpjTratado)) {
      return resposta.status(400).json({ mensagem: "CNPJ informado é inválido." });
    }

    const sql = `
      UPDATE transportadoras
      SET nome = $1, cnpj = $2, ativo = $3
      WHERE id = $4
      RETURNING id
    `;
    const resultado = await banco.query(sql, [nome, cnpjTratado, ativo, id]);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Transportadora não encontrada." });
    }

    return resposta.json({ mensagem: "Transportadora atualizada com sucesso." });
  } catch (erro) {
    console.error("Erro ao atualizar transportadora:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar transportadora." });
  }
});

router.delete(["/", "/:id"], exigirDonoSistema, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos uma transportadora para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, 1);
    const viagens = await cliente.query(`SELECT id FROM viagens WHERE transportadora_id IN (${marcadores})`, ids);
    const idsViagens = viagens.rows.map((linha) => linha.id);

    if (idsViagens.length > 0) {
      await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${placeholderIds(idsViagens, 1)})`, idsViagens);
    }

    await cliente.query(`DELETE FROM despesas WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM viagens WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM usuarios WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM veiculos WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM motoristas WHERE transportadora_id IN (${marcadores})`, ids);
    const resultado = await cliente.query(`DELETE FROM transportadoras WHERE id IN (${marcadores})`, ids);

    await cliente.query("COMMIT");
    return responderExclusao(resposta, resultado, "Transportadora(s) excluida(s) com sucesso.", "Nenhuma transportadora encontrada para exclusao.");
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir transportadora(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir transportadora(s)." });
  } finally {
    cliente.release();
  }
});

module.exports = router;
