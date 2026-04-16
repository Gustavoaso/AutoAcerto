const path = require("path");
const express = require("express");
const cors = require("cors");
const banco = require("./banco");

const app = express();
const porta = 3000;

app.use(cors());
app.use(express.json());
app.use("/frontend", express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (requisicao, resposta) => {
  resposta.json({ mensagem: "API AutoAcerto funcionando." });
});

app.post("/motoristas", async (requisicao, resposta) => {
  const {
    nome,
    cpf,
    telefone,
    cnh,
    validadeCnh,
    status,
    endereco,
    observacoes
  } = requisicao.body;

  if (!nome || !cpf || !telefone || !cnh || !validadeCnh || !status) {
    return resposta.status(400).json({
      mensagem: "Preencha todos os campos obrigatórios."
    });
  }

  const sql = `
    INSERT INTO motoristas (
      nome, cpf, telefone, cnh, validade_cnh, status, endereco, observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `;

  const valores = [
    nome,
    cpf,
    telefone,
    cnh,
    validadeCnh,
    status,
    endereco || "",
    observacoes || ""
  ];

  try {
    const resultado = await banco.query(sql, valores);

    return resposta.status(201).json({
      mensagem: "Motorista cadastrado com sucesso.",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({
        mensagem: "Já existe um motorista cadastrado com esse CPF."
      });
    }

    console.error("Erro ao salvar motorista:", erro.message);
    return resposta.status(500).json({
      mensagem: "Erro ao salvar motorista no banco de dados."
    });
  }
});

app.get("/motoristas", async (requisicao, resposta) => {
  try {
    const resultado = await banco.query("SELECT * FROM motoristas ORDER BY id DESC");
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar motoristas:", erro.message);
    return resposta.status(500).json({
      mensagem: "Erro ao buscar motoristas."
    });
  }
});

app.get("/motoristas/:id", async (requisicao, resposta) => {
  const { id } = requisicao.params;

  try {
    const resultado = await banco.query("SELECT * FROM motoristas WHERE id = $1", [id]);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Motorista não encontrado." });
    }

    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar motorista." });
  }
});

app.put("/motoristas/:id", async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const {
    nome,
    cpf,
    telefone,
    cnh,
    validadeCnh,
    status,
    endereco,
    observacoes
  } = requisicao.body;

  if (!nome || !cpf || !telefone || !cnh || !validadeCnh || !status) {
    return resposta.status(400).json({
      mensagem: "Preencha todos os campos obrigatórios."
    });
  }

  const sql = `
    UPDATE motoristas SET
      nome = $1, cpf = $2, telefone = $3, cnh = $4,
      validade_cnh = $5, status = $6, endereco = $7, observacoes = $8
    WHERE id = $9
    RETURNING *
  `;

  const valores = [nome, cpf, telefone, cnh, validadeCnh, status, endereco || "", observacoes || "", id];

  try {
    const resultado = await banco.query(sql, valores);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Motorista não encontrado." });
    }

    return resposta.json({
      mensagem: "Motorista atualizado com sucesso.",
      motorista: resultado.rows[0]
    });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({
        mensagem: "Já existe um motorista cadastrado com esse CPF."
      });
    }

    console.error("Erro ao atualizar motorista:", erro.message);
    return resposta.status(500).json({
      mensagem: "Erro ao atualizar motorista no banco de dados."
    });
  }
});

app.post("/veiculos", async (requisicao, resposta) => {
  const { modelo, placa, tipo, capacidade, proprietario, status, observacoes } = requisicao.body;

  if (!modelo || !placa || !tipo || !capacidade || !proprietario || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    INSERT INTO veiculos (modelo, placa, tipo, capacidade, proprietario, status, observacoes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;

  const valores = [modelo, placa.toUpperCase(), tipo, capacidade, proprietario, status, observacoes || ""];

  try {
    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Veículo cadastrado com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um veículo cadastrado com essa placa." });
    }
    console.error("Erro ao salvar veículo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar veículo no banco de dados." });
  }
});

app.get("/veiculos", async (requisicao, resposta) => {
  try {
    const resultado = await banco.query("SELECT * FROM veiculos ORDER BY id DESC");
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar veículos:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veículos." });
  }
});

app.get("/veiculos/:id", async (requisicao, resposta) => {
  const { id } = requisicao.params;

  try {
    const resultado = await banco.query("SELECT * FROM veiculos WHERE id = $1", [id]);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Veículo não encontrado." });
    }

    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar veículo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veículo." });
  }
});

app.put("/veiculos/:id", async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { modelo, placa, tipo, capacidade, proprietario, status, observacoes } = requisicao.body;

  if (!modelo || !placa || !tipo || !capacidade || !proprietario || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    UPDATE veiculos SET
      modelo = $1, placa = $2, tipo = $3, capacidade = $4,
      proprietario = $5, status = $6, observacoes = $7
    WHERE id = $8
    RETURNING *
  `;

  const valores = [modelo, placa.toUpperCase(), tipo, capacidade, proprietario, status, observacoes || "", id];

  try {
    const resultado = await banco.query(sql, valores);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Veículo não encontrado." });
    }

    return resposta.json({ mensagem: "Veículo atualizado com sucesso.", veiculo: resultado.rows[0] });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um veículo cadastrado com essa placa." });
    }
    console.error("Erro ao atualizar veículo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar veículo no banco de dados." });
  }
});

app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
