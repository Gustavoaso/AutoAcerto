const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const banco = require("../banco");
const { normalizarEmail, emailValido } = require("../validacoes");
const { autenticar } = require("../middlewares/autenticacao");
const {
  FRONTEND_URL,
  SUPORTE_EMAIL,
  diagnosticarMailer,
  mailerConfigurado,
  enviarEmail,
  montarEmailRecuperacaoSenha,
  montarEmailContato
} = require("../helpers/mailer");

const router = express.Router();

const SEGREDO_JWT = process.env.JWT_SECRET;
const NOME_COOKIE_SESSAO = "autoacerto_token";
const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;
const DURACAO_TOKEN_RECUPERACAO_MS = 60 * 60 * 1000;

function opcoesCookieSessao(requisicao) {
  const origem = String(requisicao.headers.origin || "").trim();
  const frontendConfigurado = String(FRONTEND_URL || "").trim();
  let origemFrontend = "";

  if (frontendConfigurado) {
    try {
      origemFrontend = new URL(frontendConfigurado).origin;
    } catch {
      origemFrontend = frontendConfigurado;
    }
  }

  const ambienteSeguro = requisicao.secure || String(requisicao.headers["x-forwarded-proto"] || "").includes("https");
  const cruzandoOrigem = Boolean(origem && origemFrontend && origem !== origemFrontend);

  return {
    httpOnly: true,
    secure: ambienteSeguro,
    sameSite: cruzandoOrigem ? "none" : "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_MS
  };
}

function hashToken(valor) {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." }
});

const limitadorRecuperacaoSenha = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: "Muitas tentativas de recuperacao. Aguarde alguns minutos e tente novamente." }
});

const limitadorContato = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: "Muitas mensagens enviadas. Aguarde alguns minutos e tente novamente." }
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
    const resultado = await banco.query(
      `SELECT u.*, m.nome AS motorista_nome, t.nome AS transportadora_nome
       FROM usuarios u
       LEFT JOIN motoristas m ON u.motorista_id = m.id
         AND (u.transportadora_id IS NULL OR m.transportadora_id = u.transportadora_id)
       LEFT JOIN transportadoras t ON u.transportadora_id = t.id
       WHERE u.email = $1`,
      [emailNormalizado]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha invalidos." });
    }

    const usuario = resultado.rows[0];

    if (!usuario.ativo) {
      return resposta.status(403).json({ mensagem: "Usuario inativo. Entre em contato com o administrador." });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha invalidos." });
    }

    const payload = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      transportadora_id: usuario.transportadora_id,
      transportadora_nome: usuario.transportadora_nome,
      motorista_id: usuario.motorista_id,
      token_version: usuario.token_version || 0
    };

    const token = jwt.sign(payload, SEGREDO_JWT, { expiresIn: "8h" });
    resposta.cookie(NOME_COOKIE_SESSAO, token, opcoesCookieSessao(requisicao));

    return resposta.json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: payload,
      sessao_expira_em: new Date(Date.now() + DURACAO_SESSAO_MS).toISOString()
    });
  } catch (erro) {
    console.error("Erro no login:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao processar login." });
  }
});

router.post("/logout", (requisicao, resposta) => {
  resposta.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao(requisicao));

  return resposta.json({ mensagem: "Logout realizado com sucesso." });
});

router.post("/recuperar-senha", limitadorRecuperacaoSenha, async (requisicao, resposta) => {
  const emailNormalizado = normalizarEmail(requisicao.body && requisicao.body.email);

  if (!emailNormalizado || !emailValido(emailNormalizado)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
  }

  if (!mailerConfigurado()) {
    const diagnostico = diagnosticarMailer();
    return resposta.status(503).json({ mensagem: "Recuperacao de senha indisponivel neste ambiente. Campos ausentes: " + diagnostico.faltando.join(", ") });
  }

  try {
    const resultado = await banco.query(
      "SELECT id, nome, email, ativo FROM usuarios WHERE email = $1",
      [emailNormalizado]
    );

    if (resultado.rows.length > 0 && resultado.rows[0].ativo) {
      const usuario = resultado.rows[0];
      const tokenBruto = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(tokenBruto);
      const expiraEm = new Date(Date.now() + DURACAO_TOKEN_RECUPERACAO_MS);

      await banco.query(
        "UPDATE recuperacao_senha SET usado_em = CURRENT_TIMESTAMP WHERE usuario_id = $1 AND usado_em IS NULL",
        [usuario.id]
      );

      await banco.query(
        `INSERT INTO recuperacao_senha (usuario_id, token_hash, expira_em)
         VALUES ($1, $2, $3)`,
        [usuario.id, tokenHash, expiraEm.toISOString()]
      );

      const linkRedefinicao = `${FRONTEND_URL}/resetar-senha.html?token=${encodeURIComponent(tokenBruto)}`;
      const html = montarEmailRecuperacaoSenha({
        nome: usuario.nome,
        linkRedefinicao
      });

      await enviarEmail(usuario.email, "AutoAcerto - Recuperacao de senha", html);
    }

    return resposta.json({
      mensagem: "Se existir uma conta com esse e-mail, enviaremos as instrucoes de recuperacao."
    });
  } catch (erro) {
    console.error("Erro ao solicitar recuperacao de senha:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao processar a recuperacao de senha." });
  }
});

router.post("/resetar-senha", limitadorRecuperacaoSenha, async (requisicao, resposta) => {
  const token = String((requisicao.body && requisicao.body.token) || "").trim();
  const novaSenha = String((requisicao.body && requisicao.body.novaSenha) || "");

  if (!token || token.length < 32) {
    return resposta.status(400).json({ mensagem: "Token de recuperacao invalido." });
  }

  if (novaSenha.length < 8) {
    return resposta.status(400).json({ mensagem: "A nova senha deve ter pelo menos 8 caracteres." });
  }

  const tokenHash = hashToken(token);
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");

    const resultado = await cliente.query(
      `SELECT r.id, r.usuario_id
       FROM recuperacao_senha r
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.token_hash = $1
         AND r.usado_em IS NULL
         AND r.expira_em > CURRENT_TIMESTAMP
         AND u.ativo = TRUE
       ORDER BY r.id DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (resultado.rows.length === 0) {
      await cliente.query("ROLLBACK");
      return resposta.status(400).json({ mensagem: "Token invalido ou expirado." });
    }

    const recuperacao = resultado.rows[0];
    const novaHash = await bcrypt.hash(novaSenha, 10);

    await cliente.query(
      "UPDATE usuarios SET senha_hash = $1, token_version = token_version + 1 WHERE id = $2",
      [novaHash, recuperacao.usuario_id]
    );

    await cliente.query(
      "UPDATE recuperacao_senha SET usado_em = CURRENT_TIMESTAMP WHERE usuario_id = $1 AND usado_em IS NULL",
      [recuperacao.usuario_id]
    );

    await cliente.query("COMMIT");

    return resposta.json({ mensagem: "Senha redefinida com sucesso." });
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao redefinir senha:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao redefinir senha." });
  } finally {
    cliente.release();
  }
});

router.post("/contato", limitadorContato, async (requisicao, resposta) => {
  const nome = String((requisicao.body && requisicao.body.nome) || "").trim();
  const email = normalizarEmail(requisicao.body && requisicao.body.email);
  const mensagem = String((requisicao.body && requisicao.body.mensagem) || "").trim();

  if (!nome || !email || !mensagem) {
    return resposta.status(400).json({ mensagem: "Preencha nome, e-mail e mensagem." });
  }

  if (!emailValido(email)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
  }

  if (mensagem.length < 10) {
    return resposta.status(400).json({ mensagem: "Escreva uma mensagem com mais detalhes." });
  }

  if (!mailerConfigurado()) {
    const diagnostico = diagnosticarMailer();
    return resposta.status(503).json({ mensagem: "Canal de contato indisponivel neste ambiente. Campos ausentes: " + diagnostico.faltando.join(", ") });
  }

  try {
    const html = montarEmailContato({ nome, email, mensagem });
    await enviarEmail(SUPORTE_EMAIL, "AutoAcerto - Novo contato pelo site", html);
    return resposta.json({ mensagem: "Mensagem enviada com sucesso. Nosso time retornara em breve." });
  } catch (erro) {
    console.error("Erro ao enviar contato:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao enviar mensagem para o time." });
  }
});

router.get("/me", autenticar, async (requisicao, resposta) => {
  try {
    const resultado = await banco.query(
      `SELECT
         u.id,
         u.nome,
         u.email,
         u.perfil,
         u.transportadora_id,
         u.motorista_id,
         u.token_version,
         t.nome AS transportadora_nome
       FROM usuarios u
       LEFT JOIN transportadoras t ON u.transportadora_id = t.id
       WHERE u.id = $1`,
      [requisicao.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuario nao encontrado." });
    }

    return resposta.json({
      usuario: {
        ...resultado.rows[0],
        assinatura_resumo: requisicao.usuario.assinatura_resumo || null
      },
      sessao_expira_em: requisicao.usuario.token_exp || null
    });
  } catch (erro) {
    console.error("Erro ao buscar sessao atual:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar sessao atual." });
  }
});

module.exports = router;
