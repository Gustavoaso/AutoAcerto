const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const banco = require("../banco");
const { normalizarEmail, emailValido } = require("../validacoes");
const { autenticar, exigirAdmin, exigirAdminOuDono } = require("../middlewares/autenticacao");
const { obterIdTransportadora, usuarioEhDonoSistema, obterFiltroTransportadora, transportadoraIdParaPost } = require("../helpers/escopo");
const { motoristaPertenceTransportadora } = require("../helpers/validacoes-db");
const { normalizarIdsExclusao, placeholderIds, responderExclusao } = require("../helpers/exclusao");

const router = express.Router();

const limitadorSenha = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: "Muitas tentativas de alteracao de senha. Aguarde alguns minutos e tente novamente." }
});

router.get("/", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);
  const filtroTransportadoraId = obterFiltroTransportadora(requisicao);

  try {
    let sql = `
      SELECT
        u.id, u.nome, u.email, u.perfil, u.ativo, u.motorista_id,
        m.nome AS motorista_nome,
        t.nome AS transportadora_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id
        AND (u.transportadora_id IS NULL OR m.transportadora_id = u.transportadora_id)
      LEFT JOIN transportadoras t ON u.transportadora_id = t.id
    `;
    const valores = [];

    if (!donoSistema || filtroTransportadoraId) {
      sql += " WHERE u.transportadora_id = $1";
      valores.push(filtroTransportadoraId || transportadoraId);
    }

    sql += " ORDER BY u.id DESC";

    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar usuários:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuários." });
  }
});

router.get("/:id", exigirAdminOuDono, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT
        u.id, u.nome, u.email, u.perfil, u.ativo, u.motorista_id,
        m.nome AS motorista_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id
        AND (u.transportadora_id IS NULL OR m.transportadora_id = u.transportadora_id)
      WHERE u.id = $1
    `;
    const valores = [id];
    if (!donoSistema) {
      sql += " AND u.transportadora_id = $2";
      valores.push(transportadoraId);
    }
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar usuário:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuário." });
  }
});

router.post("/", exigirAdmin, async (requisicao, resposta) => {
  const { nome, email, senha, perfil, motorista_id, ativo } = requisicao.body;
  const emailNormalizado = normalizarEmail(email);

  if (!nome || !emailNormalizado || !senha || !perfil) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  if (!emailValido(emailNormalizado)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
  }

  if (String(senha).length < 8) {
    return resposta.status(400).json({ mensagem: "A senha deve ter pelo menos 8 caracteres." });
  }

  if (perfil !== "admin" && perfil !== "motorista") {
    return resposta.status(400).json({ mensagem: "Perfil inválido para esta transportadora." });
  }

  if (perfil === "motorista" && !motorista_id) {
    return resposta.status(400).json({ mensagem: "Vincule um motorista para usuários do perfil motorista." });
  }

  try {
    const escopo = await transportadoraIdParaPost(requisicao, requisicao.body);
    if (escopo.erro) {
      return resposta.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const motoristaValido = await motoristaPertenceTransportadora(motorista_id, transportadoraId);
    if (!motoristaValido) {
      return resposta.status(400).json({ mensagem: "Motorista não encontrado para esta transportadora." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const sql = `
      INSERT INTO usuarios (transportadora_id, nome, email, senha_hash, perfil, motorista_id, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const valores = [transportadoraId, nome, emailNormalizado, senhaHash, perfil, motorista_id || null, ativo !== false];
    const resultado = await banco.query(sql, valores);

    return resposta.status(201).json({
      mensagem: "Usuário criado com sucesso.",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um usuário cadastrado com esse e-mail." });
    }
    console.error("Erro ao criar usuário:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao criar usuário." });
  }
});

router.put("/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { nome, email, motorista_id, ativo } = requisicao.body;
  const emailNormalizado = normalizarEmail(email);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (!nome || !emailNormalizado) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  try {
    if (!emailValido(emailNormalizado)) {
      return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
    }

    let usuarioAtual;
    if (donoSistema) {
      usuarioAtual = await banco.query(
        "SELECT perfil, transportadora_id FROM usuarios WHERE id=$1",
        [id]
      );
    } else {
      usuarioAtual = await banco.query(
        "SELECT perfil, transportadora_id FROM usuarios WHERE id=$1 AND transportadora_id=$2",
        [id, obterIdTransportadora(requisicao)]
      );
    }

    if (usuarioAtual.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    const perfilAtual = usuarioAtual.rows[0].perfil;
    const transportadoraAlvo = usuarioAtual.rows[0].transportadora_id;

    if (perfilAtual === "dono") {
      return resposta.status(400).json({ mensagem: "O perfil master não pode ser alterado por esta rota." });
    }

    const motoristaIdFinal = perfilAtual === "motorista" ? motorista_id : null;

    if (perfilAtual === "motorista" && !motoristaIdFinal) {
      return resposta.status(400).json({ mensagem: "Vincule um motorista para usuários do perfil motorista." });
    }

    const motoristaValido = await motoristaPertenceTransportadora(motoristaIdFinal, transportadoraAlvo);
    if (!motoristaValido) {
      return resposta.status(400).json({ mensagem: "Motorista não encontrado para esta transportadora." });
    }

    let sql;
    let valores;
    if (donoSistema) {
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, motorista_id=$3, ativo=$4, token_version = token_version + 1
        WHERE id=$5 RETURNING id
      `;
      valores = [nome, emailNormalizado, motoristaIdFinal || null, ativo !== false, id];
    } else {
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, motorista_id=$3, ativo=$4, token_version = token_version + 1
        WHERE id=$5 AND transportadora_id=$6 RETURNING id
      `;
      valores = [nome, emailNormalizado, motoristaIdFinal || null, ativo !== false, id, transportadoraAlvo];
    }
    const resultado = await banco.query(sql, valores);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    return resposta.json({ mensagem: "Usuário atualizado com sucesso." });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um usuário cadastrado com esse e-mail." });
    }
    console.error("Erro ao atualizar usuário:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar usuário." });
  }
});

router.patch("/senha", limitadorSenha, autenticar, async (requisicao, resposta) => {
  const { senhaAtual, novaSenha } = requisicao.body;
  const idUsuario = requisicao.usuario.id;

  if (!senhaAtual || !novaSenha) {
    return resposta.status(400).json({ mensagem: "Informe a senha atual e a nova senha." });
  }

  if (String(novaSenha).length < 8) {
    return resposta.status(400).json({ mensagem: "A nova senha deve ter pelo menos 8 caracteres." });
  }

  try {
    const resultado = await banco.query(
      "SELECT senha_hash FROM usuarios WHERE id=$1",
      [idUsuario]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, resultado.rows[0].senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "Senha atual incorreta." });
    }

    const novaHash = await bcrypt.hash(novaSenha, 10);
    await banco.query(
      "UPDATE usuarios SET senha_hash=$1, token_version = token_version + 1 WHERE id=$2",
      [novaHash, idUsuario]
    );

    return resposta.json({ mensagem: "Senha alterada com sucesso." });
  } catch (erro) {
    console.error("Erro ao alterar senha:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao alterar senha." });
  }
});

router.delete(["/", "/:id"], exigirAdmin, async (requisicao, resposta) => {
  let ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos um usuário para excluir." });
  }

  ids = ids.filter((uid) => uid !== requisicao.usuario.id);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Você não pode excluir o próprio usuário logado." });
  }

  try {
    let resultado;
    if (donoSistema) {
      resultado = await banco.query(
        `DELETE FROM usuarios WHERE id IN (${placeholderIds(ids, 1)}) AND perfil <> 'dono'`,
        ids
      );
    } else {
      const valores = [transportadoraId, ...ids];
      resultado = await banco.query(
        `DELETE FROM usuarios WHERE transportadora_id=$1 AND id IN (${placeholderIds(ids, 2)}) AND perfil NOT IN ('dono')`,
        valores
      );
    }
    return responderExclusao(resposta, resultado, "Usuario(s) excluido(s) com sucesso.", "Nenhum usuario encontrado para exclusao.");
  } catch (erro) {
    console.error("Erro ao excluir usuário(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir usuário(s)." });
  }
});

module.exports = router;
