// ============================================================
// MIDDLEWARE - AUTORIZAÇÃO GRANULAR
// Controle de acesso baseado em perfil e ownership
// ============================================================

const banco = require("../banco");

/**
 * Autoriza acesso a uma viagem específica
 * Valida ownership baseado no perfil do usuário
 */
async function autorizarAcessoViagem(requisicao, resposta, proximo) {
  const { id } = requisicao.params;
  const usuario = requisicao.usuario;
  
  try {
    // Buscar viagem com dados de ownership
    const resultado = await banco.query(
      'SELECT transportadora_id, motorista_id FROM viagens WHERE id = $1',
      [id]
    );
    
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: 'Viagem não encontrada' });
    }
    
    const { transportadora_id, motorista_id } = resultado.rows[0];
    
    // ✅ Dono do sistema: acesso total
    if (usuario.perfil === 'dono') {
      return proximo();
    }
    
    // ✅ Admin: apenas da sua transportadora
    if (usuario.perfil === 'admin') {
      if (transportadora_id !== usuario.transportadora_id) {
        console.warn('🚨 Tentativa de acesso cross-transportadora', {
          timestamp: new Date().toISOString(),
          usuario_id: usuario.id,
          usuario_email: usuario.email,
          usuario_transportadora: usuario.transportadora_id,
          viagem_id: id,
          viagem_transportadora: transportadora_id
        });
        
        return resposta.status(403).json({ 
          mensagem: 'Acesso negado: viagem de outra transportadora' 
        });
      }
      return proximo();
    }
    
    // ✅ Motorista: apenas suas viagens
    if (usuario.perfil === 'motorista') {
      if (motorista_id !== usuario.motorista_id) {
        // ✅ SEGURANÇA: Log de tentativa de IDOR
        console.warn('🚨 Tentativa de IDOR detectada', {
          timestamp: new Date().toISOString(),
          tipo: 'viagem',
          usuario_id: usuario.id,
          usuario_email: usuario.email,
          usuario_motorista_id: usuario.motorista_id,
          viagem_id: id,
          viagem_motorista_id: motorista_id,
          ip: requisicao.ip,
          user_agent: requisicao.get('user-agent')
        });
        
        return resposta.status(403).json({ 
          mensagem: 'Acesso negado: você só pode ver suas próprias viagens' 
        });
      }
      return proximo();
    }
    
    return resposta.status(403).json({ mensagem: 'Perfil não autorizado' });
    
  } catch (erro) {
    console.error('Erro na autorização de viagem:', erro);
    return resposta.status(500).json({ mensagem: 'Erro ao verificar permissões' });
  }
}

/**
 * Autoriza acesso a uma despesa específica
 */
async function autorizarAcessoDespesa(requisicao, resposta, proximo) {
  const { id } = requisicao.params;
  const usuario = requisicao.usuario;
  
  try {
    const resultado = await banco.query(`
      SELECT d.transportadora_id, v.motorista_id
      FROM despesas d
      LEFT JOIN viagens v ON d.viagem_id = v.id
      WHERE d.id = $1
    `, [id]);
    
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: 'Despesa não encontrada' });
    }
    
    const { transportadora_id, motorista_id } = resultado.rows[0];
    
    if (usuario.perfil === 'dono') {
      return proximo();
    }
    
    if (usuario.perfil === 'admin') {
      if (transportadora_id !== usuario.transportadora_id) {
        console.warn('🚨 Tentativa de acesso cross-transportadora (despesa)', {
          timestamp: new Date().toISOString(),
          usuario_id: usuario.id,
          despesa_id: id
        });
        return resposta.status(403).json({ 
          mensagem: 'Acesso negado: despesa de outra transportadora' 
        });
      }
      return proximo();
    }
    
    if (usuario.perfil === 'motorista') {
      // Motorista só vê despesas das suas viagens
      if (motorista_id !== usuario.motorista_id) {
        console.warn('🚨 Tentativa de IDOR detectada (despesa)', {
          timestamp: new Date().toISOString(),
          usuario_id: usuario.id,
          despesa_id: id
        });
        return resposta.status(403).json({ 
          mensagem: 'Acesso negado: você só pode ver despesas das suas viagens' 
        });
      }
      return proximo();
    }
    
    return resposta.status(403).json({ mensagem: 'Perfil não autorizado' });
    
  } catch (erro) {
    console.error('Erro na autorização de despesa:', erro);
    return resposta.status(500).json({ mensagem: 'Erro ao verificar permissões' });
  }
}

/**
 * Autoriza acesso a um motorista específico
 */
async function autorizarAcessoMotorista(requisicao, resposta, proximo) {
  const { id } = requisicao.params;
  const usuario = requisicao.usuario;
  
  try {
    const resultado = await banco.query(
      'SELECT transportadora_id FROM motoristas WHERE id = $1',
      [id]
    );
    
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: 'Motorista não encontrado' });
    }
    
    const { transportadora_id } = resultado.rows[0];
    
    if (usuario.perfil === 'dono') {
      return proximo();
    }
    
    if (usuario.perfil === 'admin' || usuario.perfil === 'motorista') {
      if (transportadora_id !== usuario.transportadora_id) {
        return resposta.status(403).json({ 
          mensagem: 'Acesso negado: motorista de outra transportadora' 
        });
      }
      return proximo();
    }
    
    return resposta.status(403).json({ mensagem: 'Perfil não autorizado' });
    
  } catch (erro) {
    console.error('Erro na autorização de motorista:', erro);
    return resposta.status(500).json({ mensagem: 'Erro ao verificar permissões' });
  }
}

/**
 * Autoriza acesso a um veículo específico
 */
async function autorizarAcessoVeiculo(requisicao, resposta, proximo) {
  const { id } = requisicao.params;
  const usuario = requisicao.usuario;
  
  try {
    const resultado = await banco.query(
      'SELECT transportadora_id FROM veiculos WHERE id = $1',
      [id]
    );
    
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: 'Veículo não encontrado' });
    }
    
    const { transportadora_id } = resultado.rows[0];
    
    if (usuario.perfil === 'dono') {
      return proximo();
    }
    
    if (usuario.perfil === 'admin' || usuario.perfil === 'motorista') {
      if (transportadora_id !== usuario.transportadora_id) {
        return resposta.status(403).json({ 
          mensagem: 'Acesso negado: veículo de outra transportadora' 
        });
      }
      return proximo();
    }
    
    return resposta.status(403).json({ mensagem: 'Perfil não autorizado' });
    
  } catch (erro) {
    console.error('Erro na autorização de veículo:', erro);
    return resposta.status(500).json({ mensagem: 'Erro ao verificar permissões' });
  }
}

module.exports = {
  autorizarAcessoViagem,
  autorizarAcessoDespesa,
  autorizarAcessoMotorista,
  autorizarAcessoVeiculo
};
