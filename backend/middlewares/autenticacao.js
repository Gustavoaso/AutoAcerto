const jwt = require("jsonwebtoken");
const banco = require("../banco");

const SEGREDO_JWT = process.env.JWT_SECRET;
const NOME_COOKIE_SESSAO = "autoacerto_token";

function extrairTokenCookie(cookieHeader) {
  if (!cookieHeader) return null;

  const cookies = String(cookieHeader).split(";");
  for (const item of cookies) {
    const [nome, ...resto] = item.trim().split("=");
    if (nome === NOME_COOKIE_SESSAO) {
      return decodeURIComponent(resto.join("="));
    }
  }

  return null;
}

async function autenticar(requisicao, resposta, proximo) {
  const cabecalho = requisicao.headers.authorization || "";
  const tokenBearer = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  const tokenCookie = extrairTokenCookie(requisicao.headers.cookie);
  const token = tokenBearer || tokenCookie;

  if (!token) {
    return resposta.status(401).json({ mensagem: "Token de autenticacao nao informado." });
  }

  try {
    const payload = jwt.verify(token, SEGREDO_JWT);
    const resultado = await banco.query(
      `SELECT id, nome, email, perfil, transportadora_id, motorista_id, ativo, token_version
       FROM usuarios
       WHERE id = $1`,
      [payload.id]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(401).json({ mensagem: "Sessao invalida. Faca login novamente." });
    }

    const usuarioAtual = resultado.rows[0];
    const tokenVersionValida = Number(payload.token_version || 0) === Number(usuarioAtual.token_version || 0);
    const transportadoraOk = usuarioAtual.transportadora_id != null || usuarioAtual.perfil === "dono";

    if (!usuarioAtual.ativo || !tokenVersionValida || !transportadoraOk) {
      return resposta.status(401).json({ mensagem: "Sessao invalida. Faca login novamente." });
    }

    requisicao.usuario = {
      id: usuarioAtual.id,
      nome: usuarioAtual.nome,
      email: usuarioAtual.email,
      perfil: usuarioAtual.perfil,
      transportadora_id: usuarioAtual.transportadora_id,
      motorista_id: usuarioAtual.motorista_id,
      token_version: usuarioAtual.token_version,
      token_exp: typeof payload.exp === "number" ? new Date(payload.exp * 1000).toISOString() : null
    };

    proximo();
  } catch {
    return resposta.status(401).json({ mensagem: "Token invalido ou expirado." });
  }
}

function exigirAdmin(requisicao, resposta, proximo) {
  autenticar(requisicao, resposta, function () {
    if (requisicao.usuario.perfil !== "admin" && requisicao.usuario.perfil !== "dono") {
      return resposta.status(403).json({ mensagem: "Acesso restrito a administradores." });
    }
    proximo();
  });
}

const exigirAdminOuDono = exigirAdmin;

function exigirAdminOuMotorista(requisicao, resposta, proximo) {
  autenticar(requisicao, resposta, function () {
    if (
      requisicao.usuario.perfil !== "admin" &&
      requisicao.usuario.perfil !== "dono" &&
      requisicao.usuario.perfil !== "motorista"
    ) {
      return resposta.status(403).json({ mensagem: "Perfil nao autorizado." });
    }
    proximo();
  });
}

function exigirDonoSistema(requisicao, resposta, proximo) {
  autenticar(requisicao, resposta, function () {
    if (requisicao.usuario.perfil !== "dono") {
      return resposta.status(403).json({ mensagem: "Acesso restrito ao dono do sistema." });
    }
    proximo();
  });
}

module.exports = {
  autenticar,
  exigirAdmin,
  exigirAdminOuDono,
  exigirAdminOuMotorista,
  exigirDonoSistema
};
