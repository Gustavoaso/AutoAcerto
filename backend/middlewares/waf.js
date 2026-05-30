// ============================================================
// MIDDLEWARE - WEB APPLICATION FIREWALL (WAF)
// Detecta e bloqueia tentativas de SQL Injection e ataques comuns
// ============================================================

/**
 * Padrões de SQL Injection conhecidos
 */
const sqlInjectionPatterns = [
  // Comandos SQL perigosos
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/gi,
  
  // Comentários SQL e delimitadores
  /(--|;|\/\*|\*\/|xp_|sp_)/gi,
  
  // Caracteres de escape e quotes
  /('|(\\')|(--)|(%27)|(%23)|(%2D%2D))/gi,
  
  // UNION-based injection
  /(\bUNION\b.*\bSELECT\b)/gi,
  
  // Boolean-based blind injection
  /(\bOR\b.*=.*|AND.*=.*)/gi
];

/**
 * Padrões de XSS conhecidos
 */
const xssPatterns = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi
];

/**
 * Middleware para detectar SQL Injection
 */
function detectarSqlInjection(requisicao, resposta, proximo) {
  try {
    // Serializar body e query params para análise
    const conteudo = JSON.stringify({
      body: requisicao.body,
      query: requisicao.query,
      params: requisicao.params
    });
    
    // Verificar padrões de SQL Injection
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(conteudo)) {
        // ✅ SEGURANÇA: Registrar tentativa de ataque
        console.error('🚨 Tentativa de SQL Injection detectada', {
          timestamp: new Date().toISOString(),
          ip: requisicao.ip,
          method: requisicao.method,
          path: requisicao.path,
          body: requisicao.body,
          query: requisicao.query,
          usuario: requisicao.usuario?.email || 'não autenticado',
          user_agent: requisicao.get('user-agent')
        });
        
        return resposta.status(400).json({ 
          mensagem: 'Requisição inválida detectada' 
        });
      }
    }
    
    proximo();
  } catch (erro) {
    console.error('Erro no WAF:', erro);
    proximo(); // Em caso de erro, permitir requisição (fail-open)
  }
}

/**
 * Middleware para detectar XSS
 */
function detectarXss(requisicao, resposta, proximo) {
  try {
    const conteudo = JSON.stringify({
      body: requisicao.body,
      query: requisicao.query
    });
    
    for (const pattern of xssPatterns) {
      if (pattern.test(conteudo)) {
        console.error('🚨 Tentativa de XSS detectada', {
          timestamp: new Date().toISOString(),
          ip: requisicao.ip,
          path: requisicao.path,
          usuario: requisicao.usuario?.email || 'não autenticado'
        });
        
        return resposta.status(400).json({ 
          mensagem: 'Conteúdo inválido detectado' 
        });
      }
    }
    
    proximo();
  } catch (erro) {
    console.error('Erro no WAF XSS:', erro);
    proximo();
  }
}

module.exports = {
  detectarSqlInjection,
  detectarXss
};
