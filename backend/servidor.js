const path    = require("path");
const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const banco   = require("./banco");

const app   = express();
const porta = 3000;
const SEGREDO_JWT = process.env.JWT_SECRET || "autoacerto_segredo_dev";

app.use(cors());
app.use(express.json());
app.use("/frontend", express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (requisicao, resposta) => {
  resposta.json({ mensagem: "API AutoAcerto funcionando." });
});

// ============================================================
// MIDDLEWARE — AUTENTICAÇÃO
// ============================================================

function autenticar(requisicao, resposta, proximo) {
  const cabecalho = requisicao.headers["authorization"] || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) {
    return resposta.status(401).json({ mensagem: "Token de autenticação não informado." });
  }

  try {
    const payload = jwt.verify(token, SEGREDO_JWT);
    requisicao.usuario = payload;
    proximo();
  } catch (erro) {
    return resposta.status(401).json({ mensagem: "Token inválido ou expirado." });
  }
}

function exigirAdmin(requisicao, resposta, proximo) {
  autenticar(requisicao, resposta, function () {
    if (requisicao.usuario.perfil !== "admin") {
      return resposta.status(403).json({ mensagem: "Acesso restrito a administradores." });
    }
    proximo();
  });
}

// ============================================================
// AUTH — LOGIN
// ============================================================

app.post("/auth/login", async (requisicao, resposta) => {
  const { email, senha } = requisicao.body;

  if (!email || !senha) {
    return resposta.status(400).json({ mensagem: "Informe e-mail e senha." });
  }

  try {
    const sql = `
      SELECT u.*, m.nome AS motorista_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id
      WHERE u.email = $1
    `;
    const resultado = await banco.query(sql, [email]);

    if (resultado.rows.length === 0) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha inválidos." });
    }

    const usuario = resultado.rows[0];

    if (!usuario.ativo) {
      return resposta.status(403).json({ mensagem: "Usuário inativo. Entre em contato com o administrador." });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha inválidos." });
    }

    const payload = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      motorista_id: usuario.motorista_id
    };

    const token = jwt.sign(payload, SEGREDO_JWT, { expiresIn: "8h" });

    return resposta.json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: payload
    });
  } catch (erro) {
    console.error("Erro no login:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao processar login." });
  }
});

// ============================================================
// USUÁRIOS
// ============================================================

app.get("/usuarios", exigirAdmin, async (requisicao, resposta) => {
  try {
    const sql = `
      SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.motorista_id, m.nome AS motorista_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id
      ORDER BY u.id DESC
    `;
    const resultado = await banco.query(sql);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar usuários:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuários." });
  }
});

app.post("/usuarios", exigirAdmin, async (requisicao, resposta) => {
  const { nome, email, senha, perfil, motorista_id, ativo } = requisicao.body;

  if (!nome || !email || !senha || !perfil) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    const sql = `
      INSERT INTO usuarios (nome, email, senha_hash, perfil, motorista_id, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const valores = [nome, email, senhaHash, perfil, motorista_id || null, ativo !== false];
    const resultado = await banco.query(sql, valores);

    return resposta.status(201).json({
      mensagem: "Usuário criado com sucesso.",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um usuário cadastrado com esse e-mail." });
    }
    console.error("Erro ao criar usuário:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao criar usuário." });
  }
});

app.put("/usuarios/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { nome, email, senha, perfil, motorista_id, ativo } = requisicao.body;

  if (!nome || !email || !perfil) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  try {
    let sql;
    let valores;

    if (senha) {
      const senhaHash = await bcrypt.hash(senha, 10);
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, senha_hash=$3, perfil=$4, motorista_id=$5, ativo=$6
        WHERE id=$7 RETURNING id
      `;
      valores = [nome, email, senhaHash, perfil, motorista_id || null, ativo !== false, id];
    } else {
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, perfil=$3, motorista_id=$4, ativo=$5
        WHERE id=$6 RETURNING id
      `;
      valores = [nome, email, perfil, motorista_id || null, ativo !== false, id];
    }

    const resultado = await banco.query(sql, valores);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    return resposta.json({ mensagem: "Usuário atualizado com sucesso." });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um usuário cadastrado com esse e-mail." });
    }
    console.error("Erro ao atualizar usuário:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar usuário." });
  }
});

app.patch("/usuarios/senha", autenticar, async (requisicao, resposta) => {
  const { senhaAtual, novaSenha } = requisicao.body;
  const idUsuario = requisicao.usuario.id;

  if (!senhaAtual || !novaSenha) {
    return resposta.status(400).json({ mensagem: "Informe a senha atual e a nova senha." });
  }

  try {
    const resultado = await banco.query("SELECT senha_hash FROM usuarios WHERE id=$1", [idUsuario]);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, resultado.rows[0].senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "Senha atual incorreta." });
    }

    const novaHash = await bcrypt.hash(novaSenha, 10);
    await banco.query("UPDATE usuarios SET senha_hash=$1 WHERE id=$2", [novaHash, idUsuario]);

    return resposta.json({ mensagem: "Senha alterada com sucesso." });
  } catch (erro) {
    console.error("Erro ao alterar senha:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao alterar senha." });
  }
});

// ============================================================
// MOTORISTAS
// ============================================================

app.post("/motoristas", autenticar, async (requisicao, resposta) => {
  const { nome, cpf, telefone, cnh, validadeCnh, status, endereco, observacoes } = requisicao.body;

  if (!nome || !cpf || !telefone || !cnh || !validadeCnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    INSERT INTO motoristas (nome, cpf, telefone, cnh, validade_cnh, status, endereco, observacoes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `;
  const valores = [nome, cpf, telefone, cnh, validadeCnh, status, endereco || "", observacoes || ""];

  try {
    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Motorista cadastrado com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um motorista cadastrado com esse CPF." });
    }
    console.error("Erro ao salvar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar motorista no banco de dados." });
  }
});

app.get("/motoristas", autenticar, async (requisicao, resposta) => {
  try {
    const resultado = await banco.query("SELECT * FROM motoristas ORDER BY id DESC");
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar motoristas:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar motoristas." });
  }
});

app.get("/motoristas/:id", autenticar, async (requisicao, resposta) => {
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

app.put("/motoristas/:id", autenticar, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { nome, cpf, telefone, cnh, validadeCnh, status, endereco, observacoes } = requisicao.body;

  if (!nome || !cpf || !telefone || !cnh || !validadeCnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    UPDATE motoristas SET
      nome=$1, cpf=$2, telefone=$3, cnh=$4,
      validade_cnh=$5, status=$6, endereco=$7, observacoes=$8
    WHERE id=$9
    RETURNING *
  `;
  const valores = [nome, cpf, telefone, cnh, validadeCnh, status, endereco || "", observacoes || "", id];

  try {
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Motorista não encontrado." });
    }
    return resposta.json({ mensagem: "Motorista atualizado com sucesso.", motorista: resultado.rows[0] });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um motorista cadastrado com esse CPF." });
    }
    console.error("Erro ao atualizar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar motorista no banco de dados." });
  }
});

// ============================================================
// VEÍCULOS
// ============================================================

app.post("/veiculos", autenticar, async (req, res) => {
  const { modelo, placa, proprietario, status, observacoes } = req.body;

  const modeloTratado       = (modelo || "").trim();
  const placaTratada        = (placa || "").trim().toUpperCase();
  const proprietarioTratado = (proprietario || "").trim();
  const statusTratado       = (status || "").trim();
  const observacoesTratadas = (observacoes || "").trim();

  if (!modeloTratado || !placaTratada || !proprietarioTratado || !statusTratado) {
    const pendentes = [];
    if (!modeloTratado) pendentes.push("modelo");
    if (!placaTratada) pendentes.push("placa");
    if (!proprietarioTratado) pendentes.push("proprietario");
    if (!statusTratado) pendentes.push("status");
    return res.status(400).json({ mensagem: "Preencha os campos obrigatorios: " + pendentes.join(", ") + "." });
  }

  const sql = `
    INSERT INTO veiculos (modelo, placa, proprietario, status, observacoes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;
  const valores = [modeloTratado, placaTratada, proprietarioTratado, statusTratado, observacoesTratadas];

  try {
    const resultado = await banco.query(sql, valores);
    return res.status(201).json({ mensagem: "Veículo cadastrado com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    if (erro.code === "23505") {
      return res.status(400).json({ mensagem: "Já existe um veículo cadastrado com essa placa." });
    }
    console.error("ERRO SQL VEICULOS:", erro);
    return res.status(500).json({ mensagem: "Erro ao salvar veículo no banco de dados.", detalhe: erro.message });
  }
});

app.get("/veiculos", autenticar, async (requisicao, resposta) => {
  try {
    const resultado = await banco.query("SELECT * FROM veiculos ORDER BY id DESC");
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar veículos:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veículos." });
  }
});

app.get("/veiculos/:id", autenticar, async (requisicao, resposta) => {
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

app.put("/veiculos/:id", autenticar, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { modelo, placa, proprietario, status, observacoes } = requisicao.body;

  const modeloTratado       = (modelo || "").trim();
  const placaTratada        = (placa || "").trim().toUpperCase();
  const proprietarioTratado = (proprietario || "").trim();
  const statusTratado       = (status || "").trim();
  const observacoesTratadas = (observacoes || "").trim();

  if (!modeloTratado || !placaTratada || !proprietarioTratado || !statusTratado) {
    const pendentes = [];
    if (!modeloTratado) pendentes.push("modelo");
    if (!placaTratada) pendentes.push("placa");
    if (!proprietarioTratado) pendentes.push("proprietario");
    if (!statusTratado) pendentes.push("status");
    return resposta.status(400).json({ mensagem: "Preencha os campos obrigatorios: " + pendentes.join(", ") + "." });
  }

  const sql = `
    UPDATE veiculos SET
      modelo=$1, placa=$2, proprietario=$3, status=$4, observacoes=$5
    WHERE id=$6
    RETURNING *
  `;
  const valores = [modeloTratado, placaTratada, proprietarioTratado, statusTratado, observacoesTratadas, id];

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

// ============================================================
// VIAGENS
// ============================================================

app.post("/viagens", autenticar, async (requisicao, resposta) => {
  const { origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes } = requisicao.body;

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !dataChegada || !valorFrete || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    INSERT INTO viagens (origem, destino, motorista_id, veiculo_id, data_saida, data_chegada, valor_frete, status, observacoes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;
  const valores = [origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes || ""];

  try {
    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Viagem cadastrada com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    console.error("Erro ao salvar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar viagem no banco de dados." });
  }
});

app.get("/viagens", autenticar, async (requisicao, resposta) => {
  const usuario = requisicao.usuario;

  let sql = `
    SELECT
      v.id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.status, v.observacoes, v.data_cadastro,
      v.motorista_id, v.veiculo_id,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa
    FROM viagens v
    LEFT JOIN motoristas m ON v.motorista_id = m.id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
  `;
  const valores = [];

  if (usuario.perfil === "motorista" && usuario.motorista_id) {
    sql += " WHERE v.motorista_id = $1";
    valores.push(usuario.motorista_id);
  }

  sql += " ORDER BY v.id DESC";

  try {
    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar viagens:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar viagens." });
  }
});

app.get("/viagens/:id", autenticar, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const sql = `
    SELECT
      v.id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.status, v.observacoes, v.data_cadastro,
      v.motorista_id, v.veiculo_id,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa
    FROM viagens v
    LEFT JOIN motoristas m ON v.motorista_id = m.id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
    WHERE v.id = $1
  `;
  try {
    const resultado = await banco.query(sql, [id]);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem não encontrada." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar viagem." });
  }
});

app.put("/viagens/:id", autenticar, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes } = requisicao.body;

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !dataChegada || !valorFrete || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    UPDATE viagens SET
      origem=$1, destino=$2, motorista_id=$3, veiculo_id=$4,
      data_saida=$5, data_chegada=$6, valor_frete=$7, status=$8, observacoes=$9
    WHERE id=$10
    RETURNING *
  `;
  const valores = [origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes || "", id];

  try {
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem não encontrada." });
    }
    return resposta.json({ mensagem: "Viagem atualizada com sucesso.", viagem: resultado.rows[0] });
  } catch (erro) {
    console.error("Erro ao atualizar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar viagem no banco de dados." });
  }
});

// ============================================================
// DESPESAS
// ============================================================

app.post("/despesas", autenticar, async (requisicao, resposta) => {
  const { viagemId, descricao, categoria, dataDespesa, valor, observacoes } = requisicao.body;

  if (!viagemId || !descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  const sql = `
    INSERT INTO despesas (viagem_id, descricao, categoria, data_despesa, valor, observacoes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const valores = [viagemId, descricao, categoria, dataDespesa, valor, observacoes || ""];

  try {
    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Despesa cadastrada com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    console.error("Erro ao salvar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar despesa no banco de dados." });
  }
});

app.get("/despesas", autenticar, async (requisicao, resposta) => {
  const usuario = requisicao.usuario;

  let sql = `
    SELECT
      d.id, d.viagem_id, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.observacoes, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id
    LEFT JOIN motoristas m ON v.motorista_id = m.id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
  `;
  const valores = [];

  if (usuario.perfil === "motorista" && usuario.motorista_id) {
    sql += " WHERE v.motorista_id = $1";
    valores.push(usuario.motorista_id);
  }

  sql += " ORDER BY d.id DESC";

  try {
    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar despesas:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar despesas." });
  }
});

app.get("/despesas/:id", autenticar, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const sql = `
    SELECT
      d.id, d.viagem_id, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.observacoes, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id
    LEFT JOIN motoristas m ON v.motorista_id = m.id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id
    WHERE d.id = $1
  `;
  try {
    const resultado = await banco.query(sql, [id]);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Despesa nao encontrada." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar despesa." });
  }
});

app.put("/despesas/:id", autenticar, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { viagemId, descricao, categoria, dataDespesa, valor, observacoes } = requisicao.body;

  if (!viagemId || !descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  const sql = `
    UPDATE despesas SET
      viagem_id=$1, descricao=$2, categoria=$3,
      data_despesa=$4, valor=$5, observacoes=$6
    WHERE id=$7
    RETURNING *
  `;
  const valores = [viagemId, descricao, categoria, dataDespesa, valor, observacoes || "", id];

  try {
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Despesa nao encontrada." });
    }
    return resposta.json({ mensagem: "Despesa atualizada com sucesso.", despesa: resultado.rows[0] });
  } catch (erro) {
    console.error("Erro ao atualizar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar despesa no banco de dados." });
  }
});

app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
