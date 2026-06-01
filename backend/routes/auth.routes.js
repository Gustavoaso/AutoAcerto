const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const banco = require("../banco");
const { normalizarEmail, emailValido } = require("../validacoes");
const { autenticar } = require("../middlewares/autenticacao");

const router = express.Router();

// O segredo já foi validado no servidor.js e no middleware
const SEGREDO_JWT = process.env.JWT_SECRET;

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." }
});

router.post("/login", limitadorLogin, async (requisicao, resposta) => {
  const { email, senha } = requisicao.body;
  const emailNormalizado = normalizarEmail(email);

  if (!emailNormalizado || !senha) {
    return resposta.status(400).json({ mensagem: "Informe e-mail e senha." });
  }

  if (!emailValido(emailNormalizado)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
  }

  try {
    const sql = `
      SELECT u.*, m.nome AS motorista_nome, t.nome AS transportadora_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id
        AND (u.transportadora_id IS NULL OR m.transportadora_id = u.transportadora_id)
      LEFT JOIN transportadoras t ON u.transportadora_id = t.id
      WHERE u.email = $1
    `;
    const resultado = await banco.query(sql, [emailNormalizado]);

    if (resultado.rows.length === 0) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha inválidos." });
    }

    const usuario = resultado.rows[0];

    if (!usuario.ativo) {
      return resposta.status(403).json({ mensagem: "Usuário inativo. Entre em contato com o administrador." });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha inválidos." });
    }

    const payload = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      transportadora_id: usuario.transportadora_id,
      transportadora_nome: usuario.transportadora_nome,
      motorista_id: usuario.motorista_id
    };

    const token = jwt.sign(payload, SEGREDO_JWT, { expiresIn: "8h" });

    return resposta.json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: payload
    });
  } catch (erro) {
    console.error("Erro no login:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao processar login." });
  }
});

router.get("/me", autenticar, async (requisicao, resposta) => {
  try {
    const sql = `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.perfil,
        u.transportadora_id,
        u.motorista_id,
        t.nome AS transportadora_nome
      FROM usuarios u
      LEFT JOIN transportadoras t ON u.transportadora_id = t.id
      WHERE u.id = $1
    `;
    const resultado = await banco.query(sql, [requisicao.usuario.id]);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuario nao encontrado." });
    }

    return resposta.json({ usuario: resultado.rows[0] });
  } catch (erro) {
    console.error("Erro ao buscar sessao atual:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar sessao atual." });
  }
});

module.exports = router;
