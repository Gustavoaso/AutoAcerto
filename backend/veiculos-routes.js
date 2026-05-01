const express = require("express");
const router = express.Router();
const banco = require("./banco");

// ==================== ROTAS VEÍCULOS ====================

// GET - Listar todos os veículos
router.get("/veiculos", async (req, res) => {
  try {
    const resultado = await banco.query("SELECT * FROM veiculos ORDER BY id");
    res.json(resultado.rows);
  } catch (error) {
    console.error("Erro ao listar veículos:", error);
    res.status(500).json({ erro: "Erro ao buscar veículos" });
  }
});

// GET - Obter veículo por ID
router.get("/veiculos/:id", async (req, res) => {
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
router.post("/veiculos", async (req, res) => {
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
router.put("/veiculos/:id", async (req, res) => {
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
router.delete("/veiculos/:id", async (req, res) => {
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

module.exports = router;