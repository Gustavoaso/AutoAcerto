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
    if (!payload.transportadora_id) {
      return resposta.status(401).json({ mensagem: "Sessão inválida. Faça login novamente." });
    }
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

function exigirAdminOuDono(requisicao, resposta, proximo) {
  autenticar(requisicao, resposta, function () {
    if (requisicao.usuario.perfil !== "admin" && requisicao.usuario.perfil !== "dono") {
      return resposta.status(403).json({ mensagem: "Acesso restrito a administradores." });
    }
    proximo();
  });
}

function exigirDonoSistema(requisicao, resposta, proximo) {
  autenticar(requisicao, resposta, function () {
    if (requisicao.usuario.perfil !== "dono") {
      return resposta.status(403).json({ mensagem: "Acesso restrito ao dono do sistema." });
    }
    proximo();
  });
}

function obterIdTransportadora(requisicao) {
  return requisicao.usuario.transportadora_id;
}

function usuarioEhDonoSistema(requisicao) {
  return requisicao.usuario.perfil === "dono";
}

async function motoristaPertenceTransportadora(motoristaId, transportadoraId) {
  if (!motoristaId) return true;
  const resultado = await banco.query(
    "SELECT id FROM motoristas WHERE id=$1 AND transportadora_id=$2",
    [motoristaId, transportadoraId]
  );
  return resultado.rows.length > 0;
}

async function veiculoPertenceTransportadora(veiculoId, transportadoraId) {
  const resultado = await banco.query(
    "SELECT id FROM veiculos WHERE id=$1 AND transportadora_id=$2",
    [veiculoId, transportadoraId]
  );
  return resultado.rows.length > 0;
}

async function viagemPertenceTransportadora(viagemId, transportadoraId) {
  const resultado = await banco.query(
    "SELECT id FROM viagens WHERE id=$1 AND transportadora_id=$2",
    [viagemId, transportadoraId]
  );
  return resultado.rows.length > 0;
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
      SELECT u.*, m.nome AS motorista_nome, t.nome AS transportadora_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id AND m.transportadora_id = u.transportadora_id
      LEFT JOIN transportadoras t ON u.transportadora_id = t.id
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
      transportadora_id: usuario.transportadora_id,
      transportadora_nome: usuario.transportadora_nome,
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
// TRANSPORTADORAS — DONO DO SISTEMA
// ============================================================

app.get("/transportadoras", exigirDonoSistema, async (requisicao, resposta) => {
  try {
    const sql = `
      SELECT
        t.id, t.nome, t.cnpj, t.ativo, t.data_cadastro,
        COUNT(u.id) FILTER (WHERE u.perfil = 'admin') AS total_admins
      FROM transportadoras t
      LEFT JOIN usuarios u ON u.transportadora_id = t.id
      GROUP BY t.id
      ORDER BY t.id DESC
    `;
    const resultado = await banco.query(sql);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar transportadoras:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar transportadoras." });
  }
});

app.post("/transportadoras", exigirDonoSistema, async (requisicao, resposta) => {
  const {
    nomeTransportadora,
    cnpj,
    nomeUsuario,
    emailUsuario,
    senhaUsuario
  } = requisicao.body;

  if (!nomeTransportadora || !nomeUsuario || !emailUsuario || !senhaUsuario) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");

    const resultadoTransportadora = await cliente.query(`
      INSERT INTO transportadoras (nome, cnpj, ativo)
      VALUES ($1, $2, TRUE)
      RETURNING id
    `, [nomeTransportadora, cnpj || null]);

    const transportadoraId = resultadoTransportadora.rows[0].id;
    const senhaHash = await bcrypt.hash(senhaUsuario, 10);

    const resultadoUsuario = await cliente.query(`
      INSERT INTO usuarios (transportadora_id, nome, email, senha_hash, perfil, motorista_id, ativo)
      VALUES ($1, $2, $3, $4, 'admin', NULL, TRUE)
      RETURNING id
    `, [transportadoraId, nomeUsuario, emailUsuario, senhaHash]);

    await cliente.query("COMMIT");

    return resposta.status(201).json({
      mensagem: "Transportadora e administrador criados com sucesso.",
      transportadora_id: transportadoraId,
      usuario_id: resultadoUsuario.rows[0].id
    });
  } catch (erro) {
    await cliente.query("ROLLBACK");
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "Já existe um usuário cadastrado com esse e-mail." });
    }
    console.error("Erro ao criar transportadora:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao criar transportadora." });
  } finally {
    cliente.release();
  }
});

// ============================================================
// USUÁRIOS
// ============================================================

app.get("/usuarios", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT
        u.id, u.nome, u.email, u.perfil, u.ativo, u.motorista_id,
        m.nome AS motorista_nome,
        t.nome AS transportadora_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id AND m.transportadora_id = u.transportadora_id
      LEFT JOIN transportadoras t ON u.transportadora_id = t.id
    `;
    const valores = [];

    if (!donoSistema) {
      sql += " WHERE u.transportadora_id = $1";
      valores.push(transportadoraId);
    }

    sql += " ORDER BY u.id DESC";

    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar usuários:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuários." });
  }
});

app.post("/usuarios", exigirAdmin, async (requisicao, resposta) => {
  const { nome, email, senha, perfil, motorista_id, ativo } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!nome || !email || !senha || !perfil) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  if (perfil !== "admin" && perfil !== "motorista") {
    return resposta.status(400).json({ mensagem: "Perfil inválido para esta transportadora." });
  }

  if (perfil === "motorista" && !motorista_id) {
    return resposta.status(400).json({ mensagem: "Vincule um motorista para usuários do perfil motorista." });
  }

  try {
    const motoristaValido = await motoristaPertenceTransportadora(motorista_id, transportadoraId);
    if (!motoristaValido) {
      return resposta.status(400).json({ mensagem: "Motorista não encontrado para esta transportadora." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const sql = `
      INSERT INTO usuarios (transportadora_id, nome, email, senha_hash, perfil, motorista_id, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const valores = [transportadoraId, nome, email, senhaHash, perfil, motorista_id || null, ativo !== false];
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
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!nome || !email || !perfil) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  if (perfil !== "admin" && perfil !== "motorista") {
    return resposta.status(400).json({ mensagem: "Perfil inválido para esta transportadora." });
  }

  if (perfil === "motorista" && !motorista_id) {
    return resposta.status(400).json({ mensagem: "Vincule um motorista para usuários do perfil motorista." });
  }

  try {
    const motoristaValido = await motoristaPertenceTransportadora(motorista_id, transportadoraId);
    if (!motoristaValido) {
      return resposta.status(400).json({ mensagem: "Motorista não encontrado para esta transportadora." });
    }

    let sql;
    let valores;

    if (senha) {
      const senhaHash = await bcrypt.hash(senha, 10);
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, senha_hash=$3, perfil=$4, motorista_id=$5, ativo=$6
        WHERE id=$7 AND transportadora_id=$8 RETURNING id
      `;
      valores = [nome, email, senhaHash, perfil, motorista_id || null, ativo !== false, id, transportadoraId];
    } else {
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, perfil=$3, motorista_id=$4, ativo=$5
        WHERE id=$6 AND transportadora_id=$7 RETURNING id
      `;
      valores = [nome, email, perfil, motorista_id || null, ativo !== false, id, transportadoraId];
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
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!senhaAtual || !novaSenha) {
    return resposta.status(400).json({ mensagem: "Informe a senha atual e a nova senha." });
  }

  try {
    const resultado = await banco.query(
      "SELECT senha_hash FROM usuarios WHERE id=$1 AND transportadora_id=$2",
      [idUsuario, transportadoraId]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, resultado.rows[0].senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "Senha atual incorreta." });
    }

    const novaHash = await bcrypt.hash(novaSenha, 10);
    await banco.query(
      "UPDATE usuarios SET senha_hash=$1 WHERE id=$2 AND transportadora_id=$3",
      [novaHash, idUsuario, transportadoraId]
    );

    return resposta.json({ mensagem: "Senha alterada com sucesso." });
  } catch (erro) {
    console.error("Erro ao alterar senha:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao alterar senha." });
  }
});

// ============================================================
// MOTORISTAS
// ============================================================

app.post("/motoristas", exigirAdmin, async (requisicao, resposta) => {
  const { nome, cpf, telefone, cnh, status } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!nome || !cpf || !telefone || !cnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    INSERT INTO motoristas (transportadora_id, nome, cpf, telefone, cnh, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const valores = [transportadoraId, nome, cpf, telefone, cnh, status];

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

app.get("/motoristas", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT m.*, t.nome AS transportadora_nome
      FROM motoristas m
      LEFT JOIN transportadoras t ON m.transportadora_id = t.id
    `;
    const valores = [];

    if (!donoSistema) {
      sql += " WHERE m.transportadora_id=$1";
      valores.push(transportadoraId);
    }

    sql += " ORDER BY m.id DESC";

    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar motoristas:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar motoristas." });
  }
});

app.get("/motoristas/:id", exigirAdminOuDono, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT m.*, t.nome AS transportadora_nome
      FROM motoristas m
      LEFT JOIN transportadoras t ON m.transportadora_id = t.id
      WHERE m.id = $1
    `;
    const valores = [id];

    if (!donoSistema) {
      sql += " AND m.transportadora_id=$2";
      valores.push(transportadoraId);
    }

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Motorista não encontrado." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar motorista." });
  }
});

app.put("/motoristas/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { nome, cpf, telefone, cnh, status } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!nome || !cpf || !telefone || !cnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  const sql = `
    UPDATE motoristas SET
      nome=$1, cpf=$2, telefone=$3, cnh=$4, status=$5
    WHERE id=$6 AND transportadora_id=$7
    RETURNING *
  `;
  const valores = [nome, cpf, telefone, cnh, status, id, transportadoraId];

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

app.post("/veiculos", exigirAdmin, async (req, res) => {
  const { modelo, placa, proprietario, status } = req.body;
  const transportadoraId = obterIdTransportadora(req);

  const modeloTratado       = (modelo || "").trim();
  const placaTratada        = (placa || "").trim().toUpperCase();
  const proprietarioTratado = (proprietario || "").trim();
  const statusTratado       = (status || "").trim();

  if (!modeloTratado || !placaTratada || !proprietarioTratado || !statusTratado) {
    const pendentes = [];
    if (!modeloTratado) pendentes.push("modelo");
    if (!placaTratada) pendentes.push("placa");
    if (!proprietarioTratado) pendentes.push("proprietario");
    if (!statusTratado) pendentes.push("status");
    return res.status(400).json({ mensagem: "Preencha os campos obrigatorios: " + pendentes.join(", ") + "." });
  }

  const sql = `
    INSERT INTO veiculos (transportadora_id, modelo, placa, proprietario, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;
  const valores = [transportadoraId, modeloTratado, placaTratada, proprietarioTratado, statusTratado];

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

app.get("/veiculos", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT v.*, t.nome AS transportadora_nome
      FROM veiculos v
      LEFT JOIN transportadoras t ON v.transportadora_id = t.id
    `;
    const valores = [];

    if (!donoSistema) {
      sql += " WHERE v.transportadora_id=$1";
      valores.push(transportadoraId);
    }

    sql += " ORDER BY v.id DESC";

    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar veículos:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veículos." });
  }
});

app.get("/veiculos/:id", exigirAdminOuDono, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT v.*, t.nome AS transportadora_nome
      FROM veiculos v
      LEFT JOIN transportadoras t ON v.transportadora_id = t.id
      WHERE v.id = $1
    `;
    const valores = [id];

    if (!donoSistema) {
      sql += " AND v.transportadora_id=$2";
      valores.push(transportadoraId);
    }

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Veículo não encontrado." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar veículo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veículo." });
  }
});

app.put("/veiculos/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { modelo, placa, proprietario, status } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  const modeloTratado       = (modelo || "").trim();
  const placaTratada        = (placa || "").trim().toUpperCase();
  const proprietarioTratado = (proprietario || "").trim();
  const statusTratado       = (status || "").trim();

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
      modelo=$1, placa=$2, proprietario=$3, status=$4
    WHERE id=$5 AND transportadora_id=$6
    RETURNING *
  `;
  const valores = [modeloTratado, placaTratada, proprietarioTratado, statusTratado, id, transportadoraId];

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

app.post("/viagens", exigirAdmin, async (requisicao, resposta) => {
  const { origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !dataChegada || !valorFrete || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  try {
    const motoristaValido = await motoristaPertenceTransportadora(motoristaId, transportadoraId);
    const veiculoValido = await veiculoPertenceTransportadora(veiculoId, transportadoraId);

    if (!motoristaValido || !veiculoValido) {
      return resposta.status(400).json({ mensagem: "Motorista ou veículo não encontrado para esta transportadora." });
    }

    const sql = `
      INSERT INTO viagens (transportadora_id, origem, destino, motorista_id, veiculo_id, data_saida, data_chegada, valor_frete, status, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const valores = [transportadoraId, origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes || ""];

    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Viagem cadastrada com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    console.error("Erro ao salvar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar viagem no banco de dados." });
  }
});

app.get("/viagens", autenticar, async (requisicao, resposta) => {
  const usuario = requisicao.usuario;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  let sql = `
    SELECT
      v.id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.status, v.observacoes, v.data_cadastro,
      v.motorista_id, v.veiculo_id,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM viagens v
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = v.transportadora_id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id AND ve.transportadora_id = v.transportadora_id
    LEFT JOIN transportadoras t ON v.transportadora_id = t.id
  `;
  const valores = [];

  if (!donoSistema) {
    sql += " WHERE v.transportadora_id = $1";
    valores.push(transportadoraId);
  }

  if (usuario.perfil === "motorista" && usuario.motorista_id) {
    sql += " AND v.motorista_id = $2";
    valores.push(usuario.motorista_id);
  } else if (usuario.perfil === "motorista") {
    return resposta.json([]);
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
  const usuario = requisicao.usuario;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  let sql = `
    SELECT
      v.id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.status, v.observacoes, v.data_cadastro,
      v.motorista_id, v.veiculo_id,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM viagens v
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = v.transportadora_id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id AND ve.transportadora_id = v.transportadora_id
    LEFT JOIN transportadoras t ON v.transportadora_id = t.id
    WHERE v.id = $1
  `;
  const valores = [id];

  if (!donoSistema) {
    sql += " AND v.transportadora_id = $2";
    valores.push(transportadoraId);
  }

  if (usuario.perfil === "motorista") {
    if (!usuario.motorista_id) {
      return resposta.status(404).json({ mensagem: "Viagem não encontrada." });
    }
    sql += " AND v.motorista_id = $3";
    valores.push(usuario.motorista_id);
  }

  try {
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem não encontrada." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar viagem." });
  }
});

app.put("/viagens/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !dataChegada || !valorFrete || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  try {
    const motoristaValido = await motoristaPertenceTransportadora(motoristaId, transportadoraId);
    const veiculoValido = await veiculoPertenceTransportadora(veiculoId, transportadoraId);

    if (!motoristaValido || !veiculoValido) {
      return resposta.status(400).json({ mensagem: "Motorista ou veículo não encontrado para esta transportadora." });
    }

    const sql = `
      UPDATE viagens SET
        origem=$1, destino=$2, motorista_id=$3, veiculo_id=$4,
        data_saida=$5, data_chegada=$6, valor_frete=$7, status=$8, observacoes=$9
      WHERE id=$10 AND transportadora_id=$11
      RETURNING *
    `;
    const valores = [origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, status, observacoes || "", id, transportadoraId];

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

app.post("/despesas", exigirAdmin, async (requisicao, resposta) => {
  const { viagemId, descricao, categoria, dataDespesa, valor } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!viagemId || !descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  try {
    const viagemValida = await viagemPertenceTransportadora(viagemId, transportadoraId);
    if (!viagemValida) {
      return resposta.status(400).json({ mensagem: "Viagem não encontrada para esta transportadora." });
    }

    const sql = `
      INSERT INTO despesas (transportadora_id, viagem_id, descricao, categoria, data_despesa, valor)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const valores = [transportadoraId, viagemId, descricao, categoria, dataDespesa, valor];

    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Despesa cadastrada com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    console.error("Erro ao salvar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar despesa no banco de dados." });
  }
});

app.get("/despesas", exigirAdmin, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);

  const sql = `
    SELECT
      d.id, d.viagem_id, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id AND v.transportadora_id = d.transportadora_id
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id AND ve.transportadora_id = d.transportadora_id
    WHERE d.transportadora_id = $1
    ORDER BY d.id DESC
  `;
  const valores = [transportadoraId];

  try {
    const resultado = await banco.query(sql, valores);
    return resposta.json(resultado.rows);
  } catch (erro) {
    console.error("Erro ao buscar despesas:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar despesas." });
  }
});

app.get("/despesas/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);

  const sql = `
    SELECT
      d.id, d.viagem_id, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      ve.modelo AS veiculo_modelo,
      ve.placa AS veiculo_placa
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id AND v.transportadora_id = d.transportadora_id
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve ON v.veiculo_id = ve.id AND ve.transportadora_id = d.transportadora_id
    WHERE d.id = $1 AND d.transportadora_id = $2
  `;
  try {
    const resultado = await banco.query(sql, [id, transportadoraId]);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Despesa nao encontrada." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar despesa." });
  }
});

app.put("/despesas/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { viagemId, descricao, categoria, dataDespesa, valor } = requisicao.body;
  const transportadoraId = obterIdTransportadora(requisicao);

  if (!viagemId || !descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  try {
    const viagemValida = await viagemPertenceTransportadora(viagemId, transportadoraId);
    if (!viagemValida) {
      return resposta.status(400).json({ mensagem: "Viagem não encontrada para esta transportadora." });
    }

    const sql = `
      UPDATE despesas SET
        viagem_id=$1, descricao=$2, categoria=$3,
        data_despesa=$4, valor=$5
      WHERE id=$6 AND transportadora_id=$7
      RETURNING *
    `;
    const valores = [viagemId, descricao, categoria, dataDespesa, valor, id, transportadoraId];

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
