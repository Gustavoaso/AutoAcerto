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
const DONO_SISTEMA_SENHA = process.env.DONO_SISTEMA_SENHA || "autoacerto123";

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
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await garantirEstruturaMultiTransportadora();
  await garantirEstruturaVeiculos();
}

async function garantirEstruturaVeiculos() {
  await banco.query("ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS ano INTEGER");
  await banco.query("ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS observacoes TEXT");
  await banco.query("ALTER TABLE veiculos DROP COLUMN IF EXISTS proprietario");
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

criarTabelas().catch((erro) => console.error("Erro ao criar tabelas:", erro.message));

module.exports = banco;
