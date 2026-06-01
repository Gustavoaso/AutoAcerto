const jwt = require("jsonwebtoken");

// O segredo do JWT deve ser configurado via variável de ambiente.
// Reutilizamos a checagem que havia no servidor.js
const SEGREDO_JWT = process.env.JWT_SECRET;

function autenticar(requisicao, resposta, proximo) {
  const cabecalho = requisicao.headers["authorization"] || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) {
    return resposta.status(401).json({ mensagem: "Token de autenticação não informado." });
  }

  try {
    const payload = jwt.verify(token, SEGREDO_JWT);
    const transportadoraOk = payload.transportadora_id != null || payload.perfil === "dono";
    if (!transportadoraOk) {
      return resposta.status(401).json({ mensagem: "Sessão inválida. Faça login novamente." });
    }
    requisicao.usuario = payload;
    proximo();
  } catch (erro) {
    return resposta.status(401).json({ mensagem: "Token inválido ou expirado." });
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
    if (requisicao.usuario.perfil !== "admin" && requisicao.usuario.perfil !== "dono" && requisicao.usuario.perfil !== "motorista") {
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
