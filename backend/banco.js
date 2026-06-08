const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const banco = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const DONO_SISTEMA_NOME  = process.env.DONO_SISTEMA_NOME  || "Dono AutoAcerto";
const DONO_SISTEMA_EMAIL = process.env.DONO_SISTEMA_EMAIL || "dono@autoacerto.com";

// No desenvolvimento, exigimos a senha do dono para garantir que o ambiente seja configurado de forma segura.
// Em produção, se o banco já estiver seeded (com o usuário dono criado), a senha não é necessária no startup.
// Portanto, se não for produção e não estiver configurada, lançamos um erro. Se for produção, apenas emitimos um alerta.
const DONO_SISTEMA_SENHA = process.env.DONO_SISTEMA_SENHA || null;

if (!DONO_SISTEMA_SENHA) {
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️ AVISO: DONO_SISTEMA_SENHA não configurada. O usuário dono não será criado automaticamente se não existir.");
  } else {
    throw new Error(
      "DONO_SISTEMA_SENHA não configurada no .env. Configure esta variável de ambiente para que o sistema possa subir de forma segura no desenvolvimento."
    );
  }
}

banco.connect()
  .then(() => console.log("Banco de dados PostgreSQL conectado com sucesso."))
  .catch((erro) => console.error("Erro ao conectar no banco de dados:", erro.message));

async function criarTabelas() {
  await banco.query(`
    CREATE TABLE IF NOT EXISTS transportadoras (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cnpj VARCHAR(18),
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS motoristas (
      id SERIAL PRIMARY KEY,
      transportadora_id INTEGER REFERENCES transportadoras(id),
      nome VARCHAR(255) NOT NULL,
      cpf VARCHAR(14) NOT NULL UNIQUE,
      telefone VARCHAR(15) NOT NULL,
      cnh VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS veiculos (
      id SERIAL PRIMARY KEY,
      transportadora_id INTEGER REFERENCES transportadoras(id),
      modelo VARCHAR(255) NOT NULL,
      placa VARCHAR(10) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL,
      ano INTEGER,
      observacoes TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS viagens (
      id SERIAL PRIMARY KEY,
      transportadora_id INTEGER REFERENCES transportadoras(id),
      origem VARCHAR(255) NOT NULL,
      destino VARCHAR(255) NOT NULL,
      motorista_id INTEGER REFERENCES motoristas(id),
      veiculo_id INTEGER REFERENCES veiculos(id),
      data_saida DATE NOT NULL,
      data_chegada DATE NOT NULL,
      valor_frete NUMERIC(10,2) NOT NULL,
      km_inicial INTEGER,
      km_final INTEGER,
      status VARCHAR(30) NOT NULL,
      observacoes TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS despesas (
      id SERIAL PRIMARY KEY,
      transportadora_id INTEGER REFERENCES transportadoras(id),
      viagem_id INTEGER REFERENCES viagens(id),
      veiculo_id INTEGER REFERENCES veiculos(id),
      tipo_despesa VARCHAR(20) NOT NULL DEFAULT 'viagem',
      descricao VARCHAR(255) NOT NULL,
      categoria VARCHAR(30) NOT NULL,
      data_despesa DATE NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      transportadora_id INTEGER REFERENCES transportadoras(id),
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      perfil VARCHAR(20) NOT NULL DEFAULT 'motorista',
      motorista_id INTEGER REFERENCES motoristas(id) ON DELETE SET NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      token_version INTEGER NOT NULL DEFAULT 0,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS recuperacao_senha (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token_hash VARCHAR(128) NOT NULL,
      expira_em TIMESTAMP NOT NULL,
      usado_em TIMESTAMP,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS assinaturas_pendentes (
      id SERIAL PRIMARY KEY,
      referencia_externa VARCHAR(120) NOT NULL UNIQUE,
      gateway VARCHAR(40) NOT NULL DEFAULT 'mercado_pago',
      plano_codigo VARCHAR(40) NOT NULL,
      plano_nome VARCHAR(120) NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      nome_transportadora VARCHAR(255) NOT NULL,
      cnpj VARCHAR(18),
      nome_admin VARCHAR(255) NOT NULL,
      email_admin VARCHAR(255) NOT NULL,
      senha_hash_admin VARCHAR(255) NOT NULL,
      mercado_pago_preapproval_id VARCHAR(120),
      stripe_checkout_session_id VARCHAR(120),
      stripe_customer_id VARCHAR(120),
      stripe_subscription_id VARCHAR(120),
      status VARCHAR(40) NOT NULL DEFAULT 'aguardando_pagamento',
      provisionado_em TIMESTAMP,
      boas_vindas_email_enviado_em TIMESTAMP,
      boas_vindas_email_erro TEXT,
      transportadora_id INTEGER REFERENCES transportadoras(id),
      usuario_admin_id INTEGER REFERENCES usuarios(id),
      ultimo_payload JSONB,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS assinaturas (
      id SERIAL PRIMARY KEY,
      transportadora_id INTEGER NOT NULL REFERENCES transportadoras(id) ON DELETE CASCADE,
      plano_codigo VARCHAR(40) NOT NULL,
      plano_nome VARCHAR(120) NOT NULL,
      gateway VARCHAR(40) NOT NULL DEFAULT 'mercado_pago',
      gateway_assinatura_id VARCHAR(120) NOT NULL UNIQUE,
      referencia_externa VARCHAR(120) NOT NULL UNIQUE,
      status VARCHAR(40) NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      stripe_customer_id VARCHAR(120),
      stripe_price_id VARCHAR(120),
      proxima_cobranca_em TIMESTAMP,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      email_pagador VARCHAR(255),
      ultimo_payload JSONB,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await garantirEstruturaMultiTransportadora();
  await garantirEstruturaVeiculos();
  await garantirEstruturaViagens();
  await garantirEstruturaDespesas();
  await garantirEstruturaUsuarios();
  await garantirEstruturaAssinaturas();
  await criarIndices();
  await garantirConstraintsDominio();
}

async function criarIndices() {
  await banco.query("CREATE INDEX IF NOT EXISTS idx_motoristas_transportadora ON motoristas(transportadora_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_veiculos_transportadora ON veiculos(transportadora_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_viagens_transportadora ON viagens(transportadora_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_viagens_motorista ON viagens(motorista_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_viagens_veiculo ON viagens(veiculo_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_despesas_transportadora ON despesas(transportadora_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_despesas_viagem ON despesas(viagem_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_despesas_veiculo ON despesas(veiculo_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_usuarios_transportadora ON usuarios(transportadora_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_usuarios_motorista ON usuarios(motorista_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_recuperacao_usuario ON recuperacao_senha(usuario_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_recuperacao_token_hash ON recuperacao_senha(token_hash)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_assinaturas_pendentes_email_admin ON assinaturas_pendentes(email_admin)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_assinaturas_pendentes_preapproval ON assinaturas_pendentes(mercado_pago_preapproval_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_assinaturas_pendentes_checkout_session ON assinaturas_pendentes(stripe_checkout_session_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_assinaturas_pendentes_subscription ON assinaturas_pendentes(stripe_subscription_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_assinaturas_transportadora ON assinaturas(transportadora_id)");
  await banco.query("CREATE INDEX IF NOT EXISTS idx_assinaturas_gateway_assinatura ON assinaturas(gateway_assinatura_id)");
}

async function adicionarConstraint(nome, sql) {
  const existente = await banco.query("SELECT 1 FROM pg_constraint WHERE conname = $1", [nome]);
  if (existente.rows.length > 0) return;

  try {
    await banco.query(`ALTER TABLE ${sql.tabela} ADD CONSTRAINT ${nome} CHECK (${sql.check})`);
  } catch (erro) {
    console.warn("Constraint " + nome + ":", erro.message);
  }
}

async function garantirConstraintsDominio() {
  // Normalizar registros legados com acento para evitar violação da constraint atualizada
  try {
    await banco.query("UPDATE veiculos SET status = 'manutencao' WHERE status = 'manutenção'");
  } catch (erro) {
    console.error("Erro ao migrar status de veículos legados:", erro.message);
  }

  // Dropar a constraint antiga para garantir que seja recriada com as novas regras
  try {
    await banco.query("ALTER TABLE veiculos DROP CONSTRAINT IF EXISTS veiculos_status_chk");
  } catch (erro) {
    console.warn("Erro ao dropar constraint veiculos_status_chk:", erro.message);
  }

  await adicionarConstraint("motoristas_status_chk", {
    tabela: "motoristas",
    check: "status IN ('ativo', 'inativo')"
  });

  await adicionarConstraint("veiculos_status_chk", {
    tabela: "veiculos",
    check: "status IN ('ativo', 'inativo', 'em viagem', 'manutencao')"
  });

  await adicionarConstraint("veiculos_ano_chk", {
    tabela: "veiculos",
    check: "ano IS NULL OR (ano >= 1950 AND ano <= 2100)"
  });

  await adicionarConstraint("viagens_status_chk", {
    tabela: "viagens",
    check: "status IN ('em andamento', 'finalizada', 'cancelada')"
  });

  await adicionarConstraint("viagens_valor_frete_chk", {
    tabela: "viagens",
    check: "valor_frete > 0"
  });

  await adicionarConstraint("viagens_km_chk", {
    tabela: "viagens",
    check: "(km_inicial IS NULL OR km_inicial >= 0) AND (km_final IS NULL OR km_final >= 0) AND (km_inicial IS NULL OR km_final IS NULL OR km_final >= km_inicial)"
  });

  await adicionarConstraint("despesas_tipo_chk", {
    tabela: "despesas",
    check: "tipo_despesa IN ('viagem', 'veiculo')"
  });

  await adicionarConstraint("despesas_categoria_chk", {
    tabela: "despesas",
    check: "categoria IN ('combustivel', 'pedagio', 'alimentacao', 'manutencao', 'outros')"
  });

  await adicionarConstraint("despesas_valor_chk", {
    tabela: "despesas",
    check: "valor > 0"
  });
}

async function garantirEstruturaVeiculos() {
  await banco.query("ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS ano INTEGER");
  await banco.query("ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS observacoes TEXT");
  await banco.query("ALTER TABLE veiculos DROP COLUMN IF EXISTS proprietario");
}

async function garantirEstruturaViagens() {
  await banco.query("ALTER TABLE viagens ADD COLUMN IF NOT EXISTS km_inicial INTEGER");
  await banco.query("ALTER TABLE viagens ADD COLUMN IF NOT EXISTS km_final INTEGER");
  await banco.query("ALTER TABLE viagens ALTER COLUMN data_chegada DROP NOT NULL");
}

async function garantirEstruturaDespesas() {
  await banco.query("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS veiculo_id INTEGER REFERENCES veiculos(id)");
  await banco.query("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS tipo_despesa VARCHAR(20) NOT NULL DEFAULT 'viagem'");
  await banco.query("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS anexo_cupom_nome VARCHAR(255)");
  await banco.query("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS anexo_cupom_tipo VARCHAR(100)");
  await banco.query("ALTER TABLE despesas ADD COLUMN IF NOT EXISTS anexo_cupom_base64 TEXT");
}

async function garantirEstruturaUsuarios() {
  await banco.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0");
}

async function garantirEstruturaAssinaturas() {
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS gateway VARCHAR(40) NOT NULL DEFAULT 'mercado_pago'");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS plano_codigo VARCHAR(40) NOT NULL DEFAULT 'essencial'");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS plano_nome VARCHAR(120) NOT NULL DEFAULT 'Plano Essencial'");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) NOT NULL DEFAULT 0");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS mercado_pago_preapproval_id VARCHAR(120)");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(120)");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(120)");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(120)");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'aguardando_pagamento'");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS provisionado_em TIMESTAMP");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS boas_vindas_email_enviado_em TIMESTAMP");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS boas_vindas_email_erro TEXT");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS transportadora_id INTEGER REFERENCES transportadoras(id)");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS usuario_admin_id INTEGER REFERENCES usuarios(id)");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS ultimo_payload JSONB");
  await banco.query("ALTER TABLE assinaturas_pendentes ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  await banco.query("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(120)");
  await banco.query("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(120)");
  await banco.query("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE");
  await banco.query("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS email_pagador VARCHAR(255)");
  await banco.query("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS ultimo_payload JSONB");
  await banco.query("ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
}

async function adicionarColunaTransportadora(nomeTabela) {
  await banco.query(`
    ALTER TABLE ${nomeTabela}
    ADD COLUMN IF NOT EXISTS transportadora_id INTEGER REFERENCES transportadoras(id)
  `);
}

async function garantirEstruturaMultiTransportadora() {
  await adicionarColunaTransportadora("motoristas");
  await adicionarColunaTransportadora("veiculos");
  await adicionarColunaTransportadora("viagens");
  await adicionarColunaTransportadora("despesas");
  await adicionarColunaTransportadora("usuarios");

  const registrosSemTransportadora = await banco.query(`
    SELECT
      (SELECT COUNT(*) FROM motoristas WHERE transportadora_id IS NULL) +
      (SELECT COUNT(*) FROM veiculos WHERE transportadora_id IS NULL) +
      (SELECT COUNT(*) FROM viagens WHERE transportadora_id IS NULL) +
      (SELECT COUNT(*) FROM despesas WHERE transportadora_id IS NULL) +
      (SELECT COUNT(*) FROM usuarios WHERE transportadora_id IS NULL AND perfil IS DISTINCT FROM 'dono') AS total
  `);

  if (Number(registrosSemTransportadora.rows[0].total) > 0) {
    let resultadoTransportadora = await banco.query(`
      SELECT id FROM transportadoras
      WHERE nome = 'Transportadora Principal'
      ORDER BY id
      LIMIT 1
    `);

    if (resultadoTransportadora.rows.length === 0) {
      resultadoTransportadora = await banco.query(`
        INSERT INTO transportadoras (nome, cnpj, ativo)
        VALUES ('Transportadora Principal', NULL, TRUE)
        RETURNING id
      `);
    }

    const idTransportadoraPadrao = resultadoTransportadora.rows[0].id;

    await banco.query("UPDATE motoristas SET transportadora_id=$1 WHERE transportadora_id IS NULL", [idTransportadoraPadrao]);
    await banco.query("UPDATE veiculos SET transportadora_id=$1 WHERE transportadora_id IS NULL", [idTransportadoraPadrao]);
    await banco.query("UPDATE viagens SET transportadora_id=$1 WHERE transportadora_id IS NULL", [idTransportadoraPadrao]);
    await banco.query("UPDATE despesas SET transportadora_id=$1 WHERE transportadora_id IS NULL", [idTransportadoraPadrao]);
    await banco.query(
      "UPDATE usuarios SET transportadora_id=$1 WHERE transportadora_id IS NULL AND perfil IS DISTINCT FROM 'dono'",
      [idTransportadoraPadrao]
    );
  }

  await banco.query("ALTER TABLE motoristas ALTER COLUMN transportadora_id SET NOT NULL");
  await banco.query("ALTER TABLE veiculos ALTER COLUMN transportadora_id SET NOT NULL");
  await banco.query("ALTER TABLE viagens ALTER COLUMN transportadora_id SET NOT NULL");
  await banco.query("ALTER TABLE despesas ALTER COLUMN transportadora_id SET NOT NULL");
  await banco.query("ALTER TABLE usuarios ALTER COLUMN transportadora_id DROP NOT NULL");

  await criarUsuarioDonoSistema();
  await garantirConstraintUsuarioMaster();
}

async function garantirConstraintUsuarioMaster() {
  await banco.query("UPDATE usuarios SET transportadora_id = NULL WHERE perfil = 'dono'");
  await banco.query("ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_transportadora_perfil_chk");
  try {
    await banco.query(`
      ALTER TABLE usuarios ADD CONSTRAINT usuarios_transportadora_perfil_chk
      CHECK (
        (perfil = 'dono' AND transportadora_id IS NULL)
        OR (perfil IS DISTINCT FROM 'dono' AND transportadora_id IS NOT NULL)
      )
    `);
  } catch (erro) {
    console.warn("Constraint usuarios_transportadora_perfil_chk:", erro.message);
  }
}

async function criarUsuarioDonoSistema() {
  const resultado = await banco.query("SELECT id FROM usuarios WHERE perfil='dono' LIMIT 1");
  if (resultado.rows.length > 0) {
    await banco.query("UPDATE usuarios SET transportadora_id=NULL, motorista_id=NULL WHERE perfil='dono'");
    return;
  }

  if (!DONO_SISTEMA_SENHA) {
    console.warn("Usuario dono nao criado: configure DONO_SISTEMA_SENHA no ambiente.");
    return;
  }

  const usuarioExistente = await banco.query("SELECT id FROM usuarios WHERE email=$1", [DONO_SISTEMA_EMAIL]);
  if (usuarioExistente.rows.length > 0) {
    await banco.query(
      "UPDATE usuarios SET perfil='dono', transportadora_id=NULL, motorista_id=NULL, ativo=TRUE WHERE id=$1",
      [usuarioExistente.rows[0].id]
    );
    console.log("Usuário dono do sistema atualizado:", DONO_SISTEMA_EMAIL);
    return;
  }

  const senhaHash = await bcrypt.hash(DONO_SISTEMA_SENHA, 10);

  await banco.query(`
    INSERT INTO usuarios (transportadora_id, nome, email, senha_hash, perfil, motorista_id, ativo)
    VALUES (NULL, $1, $2, $3, 'dono', NULL, TRUE)
  `, [DONO_SISTEMA_NOME, DONO_SISTEMA_EMAIL, senhaHash]);

  console.log("Usuário dono do sistema criado:", DONO_SISTEMA_EMAIL);
}

banco.inicializar = criarTabelas;

module.exports = banco;
