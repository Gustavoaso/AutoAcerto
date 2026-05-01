const express = require("express");
const cors = require("cors");
const banco = require("./banco");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ==================== ROTAS VEÍCULOS ====================

// GET - Listar todos os veículos
app.get("/veiculos", async (req, res) => {
  try {
    const resultado = await banco.query("SELECT * FROM veiculos ORDER BY id");
    res.json(resultado.rows);
  } catch (error) {
    console.error("Erro ao listar veículos:", error);
    res.status(500).json({ erro: "Erro ao buscar veículos" });
  }
});

// GET - Obter veículo por ID
app.get("/veiculos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await banco.query("SELECT * FROM veiculos WHERE id = $1", [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Veículo não encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar veículo:", error);
    res.status(500).json({ erro: "Erro ao buscar veículo" });
  }
});

// POST - Criar novo veículo
app.post("/veiculos", async (req, res) => {
  try {
    const {
      modelo,
      placa,
      tipo,
      capacidade,
      proprietario,
      status,
      observacoes
    } = req.body;

    const resultado = await banco.query(
      `INSERT INTO veiculos
       (modelo, placa, tipo, capacidade, proprietario, status, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [modelo, placa, tipo, capacidade, proprietario, status, observacoes]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error("Erro ao criar veículo:", error);

    // Erro de unicidade (placa duplicada)
    if (error.code === '23505') {
      return res.status(400).json({ erro: "Placa já cadastrada" });
    }

    res.status(500).json({ erro: "Erro ao criar veículo" });
  }
});

// PUT - Atualizar veículo
app.put("/veiculos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      modelo,
      placa,
      tipo,
      capacidade,
      proprietario,
      status,
      observacoes
    } = req.body;

    const resultado = await banco.query(
      `UPDATE veiculos
       SET modelo = $1, placa = $2, tipo = $3, capacidade = $4,
           proprietario = $5, status = $6, observacoes = $7
       WHERE id = $7
       RETURNING *`,
      [modelo, placa, tipo, capacidade, proprietario, status, observacoes, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Veículo não encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar veículo:", error);

    // Erro de unicidade (placa duplicada)
    if (error.code === '23505') {
      return res.status(400).json({ erro: "Placa já cadastrada" });
    }

    res.status(500).json({ erro: "Erro ao atualizar veículo" });
  }
});

// DELETE - Deletar veículo
app.delete("/veiculos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await banco.query("DELETE FROM veiculos WHERE id = $1 RETURNING *", [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Veículo não encontrado" });
    }

    res.json({ mensagem: "Veículo excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir veículo:", error);
    res.status(500).json({ erro: "Erro ao excluir veículo" });
  }
});

// ==================== ROTAS MOTORISTAS ====================

// GET - Listar todos os motoristas
app.get("/motoristas", async (req, res) => {
  try {
    const resultado = await banco.query("SELECT * FROM motoristas ORDER BY id");
    res.json(resultado.rows);
  } catch (error) {
    console.error("Erro ao listar motoristas:", error);
    res.status(500).json({ erro: "Erro ao buscar motoristas" });
  }
});

// GET - Obter motorista por ID
app.get("/motoristas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await banco.query("SELECT * FROM motoristas WHERE id = $1", [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Motorista não encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar motorista:", error);
    res.status(500).json({ erro: "Erro ao buscar motorista" });
  }
});

// POST - Criar novo motorista
app.post("/motoristas", async (req, res) => {
  try {
    const {
      nome,
      cpf,
      telefone,
      cnh,
      validade_cnh,
      status,
      endereco,
      observacoes
    } = req.body;

    const resultado = await banco.query(
      `INSERT INTO motoristas
       (nome, cpf, telefone, cnh, validade_cnh, status, endereco, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nome, cpf, telefone, cnh, validade_cnh, status, endereco, observacoes]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error("Erro ao criar motorista:", error);

    // Erro de unicidade (CPF duplicado)
    if (error.code === '23505') {
      return res.status(400).json({ erro: "CPF já cadastrado" });
    }

    res.status(500).json({ erro: "Erro ao criar motorista" });
  }
});

// PUT - Atualizar motorista
app.put("/motoristas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      cpf,
      telefone,
      cnh,
      validade_cnh,
      status,
      endereco,
      observacoes
    } = req.body;

    const resultado = await banco.query(
      `UPDATE motoristas
       SET nome = $1, cpf = $2, telefone = $3, cnh = $4, validade_cnh = $5,
           status = $6, endereco = $7, observacoes = $8
       WHERE id = $8
       RETURNING *`,
      [nome, cpf, telefone, cnh, validade_cnh, status, endereco, observacoes, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Motorista não encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar motorista:", error);

    // Erro de unicidade (CPF duplicado)
    if (error.code === '23505') {
      return res.status(400).json({ erro: "CPF já cadastrado" });
    }

    res.status(500).json({ erro: "Erro ao atualizar motorista" });
  }
});

// DELETE - Deletar motorista
app.delete("/motoristas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await banco.query("DELETE FROM motoristas WHERE id = $1 RETURNING *", [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: "Motorista não encontrado" });
    }

    res.json({ mensagem: "Motorista excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir motorista:", error);
    res.status(500).json({ erro: "Erro ao excluir motorista" });
  }
});

// ==================== INICIALIZAÇÃO ====================
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log("Rotas disponíveis:");
  console.log("  GET    /veiculos");
  console.log("  POST   /veiculos");
  console.log("  PUT    /veiculos/:id");
  console.log("  DELETE /veiculos/:id");
  console.log("  GET    /motoristas");
  console.log("  POST   /motoristas");
  console.log("  PUT    /motoristas/:id");
  console.log("  DELETE /motoristas/:id");
});

module.exports = app;