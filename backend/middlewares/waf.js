const sqlInjectionPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/i,
  /(--|;|\/\*|\*\/|xp_|sp_)/i,
  /('|(\\')|(%27)|(%23)|(%2D%2D))/i,
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bOR\b.*=.*|\bAND\b.*=.*)/i
];

const xssPatterns = [
  /<script[^>]*>.*?<\/script>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i
];

const CAMPOS_OCULTOS_WAF = new Set([
  "anexoCupomBase64",
  "senha",
  "senhaAtual",
  "novaSenha",
  "senhaUsuario",
  "token"
]);

function sanitizarConteudoParaWaf(valor) {
  if (Array.isArray(valor)) {
    return valor.map(sanitizarConteudoParaWaf);
  }

  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(function ([chave, conteudo]) {
        if (CAMPOS_OCULTOS_WAF.has(chave)) {
          return [chave, "[oculto]"];
        }
        return [chave, sanitizarConteudoParaWaf(conteudo)];
      })
    );
  }

  return valor;
}

function montarResumoRequisicao(requisicao) {
  return {
    timestamp: new Date().toISOString(),
    ip: requisicao.ip,
    method: requisicao.method,
    path: requisicao.path,
    query: sanitizarConteudoParaWaf(requisicao.query),
    params: sanitizarConteudoParaWaf(requisicao.params),
    body: sanitizarConteudoParaWaf(requisicao.body),
    usuario: requisicao.usuario?.email || "nao autenticado",
    user_agent: requisicao.get("user-agent")
  };
}

function detectarPadrao(conteudo, padroes) {
  return padroes.some(function (pattern) {
    pattern.lastIndex = 0;
    return pattern.test(conteudo);
  });
}

function detectarSqlInjection(requisicao, resposta, proximo) {
  try {
    const conteudo = JSON.stringify({
      body: sanitizarConteudoParaWaf(requisicao.body),
      query: sanitizarConteudoParaWaf(requisicao.query),
      params: sanitizarConteudoParaWaf(requisicao.params)
    });

    if (detectarPadrao(conteudo, sqlInjectionPatterns)) {
      console.error("Tentativa de SQL Injection detectada", montarResumoRequisicao(requisicao));
      return resposta.status(400).json({ mensagem: "Requisicao invalida detectada." });
    }

    proximo();
  } catch (erro) {
    console.error("Falha ao analisar requisicao no WAF SQL:", {
      timestamp: new Date().toISOString(),
      path: requisicao.path,
      method: requisicao.method,
      erro: erro.message
    });
    return resposta.status(400).json({ mensagem: "Requisicao invalida." });
  }
}

function detectarXss(requisicao, resposta, proximo) {
  try {
    const conteudo = JSON.stringify({
      body: sanitizarConteudoParaWaf(requisicao.body),
      query: sanitizarConteudoParaWaf(requisicao.query),
      params: sanitizarConteudoParaWaf(requisicao.params)
    });

    if (detectarPadrao(conteudo, xssPatterns)) {
      console.error("Tentativa de XSS detectada", montarResumoRequisicao(requisicao));
      return resposta.status(400).json({ mensagem: "Conteudo invalido detectado." });
    }

    proximo();
  } catch (erro) {
    console.error("Falha ao analisar requisicao no WAF XSS:", {
      timestamp: new Date().toISOString(),
      path: requisicao.path,
      method: requisicao.method,
      erro: erro.message
    });
    return resposta.status(400).json({ mensagem: "Requisicao invalida." });
  }
}

module.exports = {
  detectarSqlInjection,
  detectarXss
};
