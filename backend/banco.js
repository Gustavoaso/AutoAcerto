const { Pool } = require("pg");

const banco = new Pool({
  host: "localhost",
  port: 5432,
  database: "autoacerto",
  user: "postgres",
  password: "123456"
});

banco.connect()
  .then(() => console.log("Banco de dados PostgreSQL conectado com sucesso."))
  .catch((erro) => console.error("Erro ao conectar no banco de dados:", erro.message));

async function criarTabelas() {
  await banco.query(`
    CREATE TABLE IF NOT EXISTS motoristas (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      cpf VARCHAR(14) NOT NULL UNIQUE,
      telefone VARCHAR(15) NOT NULL,
      cnh VARCHAR(50) NOT NULL,
      validade_cnh DATE NOT NULL,
      status VARCHAR(20) NOT NULL,
      endereco TEXT,
      observacoes TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS veiculos (
      id SERIAL PRIMARY KEY,
      modelo VARCHAR(255) NOT NULL,
      placa VARCHAR(10) NOT NULL UNIQUE,
      proprietario VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL,
      observacoes TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS viagens (
      id SERIAL PRIMARY KEY,
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
      viagem_id INTEGER REFERENCES viagens(id),
      descricao VARCHAR(255) NOT NULL,
      categoria VARCHAR(30) NOT NULL,
      data_despesa DATE NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      observacoes TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await banco.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      perfil VARCHAR(20) NOT NULL DEFAULT 'motorista',
      motorista_id INTEGER REFERENCES motoristas(id) ON DELETE SET NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

criarTabelas().catch((erro) => console.error("Erro ao criar tabelas:", erro.message));

module.exports = banco;
