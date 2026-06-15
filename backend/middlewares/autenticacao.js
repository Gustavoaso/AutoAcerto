const jwt = require("jsonwebtoken");
const banco = require("../banco");
const { assinaturaPermiteMutacao, montarResumoAssinatura } = require("../helpers/assinaturas");

const SEGREDO_JWT = process.env.JWT_SECRET;
const NOME_COOKIE_SESSAO = "autoacerto_token";

const METODOS_SOMENTE_LEITURA = new Set(["GET", "HEAD", "OPTIONS"]);
const ROTAS_MUTACAO_SEMPRE_PERMITIDAS = [
  /^\/assinaturas\/portal(?:\/|$)/,
  /^\/assinaturas\/reativar(?:\/|$)/,
  /^\/auth\/logout(?:\/|$)/,
  /^\/auth\/me(?:\/|$)/,
  /^\/usuarios\/senha(?:\/|$)/,
  /^\/notificacoes(?:\/|$)/
];

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

function mutacaoSemprePermitida(requisicao) {
  const caminho = requisicao.originalUrl ? requisicao.originalUrl.split("?")[0] : "";
  return ROTAS_MUTACAO_SEMPRE_PERMITIDAS.some(function (regex) {
    return regex.test(caminho);
  });
}

async function obterAssinaturaAtualTransportadora(transportadoraId) {
  if (!transportadoraId) return null;

  const resultado = await banco.query(
    `SELECT id, transportadora_id, plano_codigo, plano_nome, status, valor, gateway,
            gateway_assinatura_id, referencia_externa, stripe_customer_id, stripe_price_id,
            proxima_cobranca_em, cancel_at_period_end, email_pagador,
            pagamento_pendente_em, bloqueada_em, cancelada_em, data_cadastro, data_atualizacao
     FROM assinaturas
     WHERE transportadora_id = $1
     ORDER BY data_atualizacao DESC, id DESC
     LIMIT 1`,
    [transportadoraId]
  );

  return resultado.rows[0] || null;
}

function responderAssinaturaBloqueada(resposta, decisao) {
  return resposta.status(402).json({
    mensagem: decisao.mensagem,
    codigo: decisao.codigo,
    data_limite_regularizacao: decisao.data_limite_regularizacao || null
  });
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

    if (usuarioAtual.perfil !== "dono" && usuarioAtual.transportadora_id != null) {
      const assinatura = await obterAssinaturaAtualTransportadora(usuarioAtual.transportadora_id);
      requisicao.usuario.assinatura = assinatura;
      requisicao.usuario.assinatura_resumo = montarResumoAssinatura(assinatura);

      if (
        !METODOS_SOMENTE_LEITURA.has(String(requisicao.method || "").toUpperCase()) &&
        !mutacaoSemprePermitida(requisicao)
      ) {
        const decisao = assinaturaPermiteMutacao(assinatura);
        if (!decisao.permitido) {
          return responderAssinaturaBloqueada(resposta, decisao);
        }
      }
    }

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
