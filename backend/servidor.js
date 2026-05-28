const path    = require("path");
const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const banco   = require("./banco");

const app   = express();
const porta = process.env.PORT || 3000;
const corsOriginsConfigurado = Boolean(process.env.CORS_ORIGINS);
const origensPermitidas = (process.env.CORS_ORIGINS || [
  "https://autoacerto.com.br",
  "https://www.autoacerto.com.br",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
].join(","))
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);

function origemCorsPermitida(origem) {
  if (origensPermitidas.includes(origem)) return true;
  if (corsOriginsConfigurado) return false;

  try {
    const host = new URL(origem).hostname;
    return host.endsWith(".vercel.app");
  } catch (erro) {
    return false;
  }
}
const SEGREDO_JWT = process.env.JWT_SECRET || (
  process.env.NODE_ENV === "production"
    ? crypto.randomBytes(32).toString("hex")
    : "autoacerto_segredo_dev"
);

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("JWT_SECRET nao configurado. Tokens serao invalidados a cada reinicio.");
}

app.use(cors({
  origin: function (origem, callback) {
    if (!origem || origemCorsPermitida(origem)) {
      return callback(null, true);
    }
    return callback(new Error("Origem nao permitida pelo CORS."));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(function normalizarEntrada(requisicao, resposta, proximo) {
  if (requisicao.body && typeof requisicao.body === "object") {
    requisicao.body = normalizarCorpoEntrada(requisicao.body);
  }
  proximo();
});
app.use("/frontend", express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (requisicao, resposta) => {
  resposta.json({ mensagem: "API AutoAcerto funcionando." });
});

// ============================================================
// MIDDLEWARE ? AUTENTICAÃ‡ÃƒO
// ============================================================

function autenticar(requisicao, resposta, proximo) {
  const cabecalho = requisicao.headers["authorization"] || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) {
    return resposta.status(401).json({ mensagem: "Token de autenticaÃ§Ã£o nÃ£o informado." });
  }

  try {
    const payload = jwt.verify(token, SEGREDO_JWT);
    const transportadoraOk = payload.transportadora_id != null || payload.perfil === "dono";
    if (!transportadoraOk) {
      return resposta.status(401).json({ mensagem: "SessÃ£o invÃ¡lida. FaÃ§a login novamente." });
    }
    requisicao.usuario = payload;
    proximo();
  } catch (erro) {
    return resposta.status(401).json({ mensagem: "Token invÃ¡lido ou expirado." });
  }
}

function exigirAdmin(requisicao, resposta, proximo) {
  autenticar(requisicao, resposta, function () {
    if (requisicao.usuario.perfil !== "admin" && requisicao.usuario.perfil !== "dono") {
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

const MAPA_TABELA_TRANSPORTADORA = {
  motoristas: "motoristas",
  veiculos: "veiculos",
  viagens: "viagens",
  despesas: "despesas"
};

async function transportadoraIdParaPost(requisicao, corpo) {
  if (usuarioEhDonoSistema(requisicao)) {
    const id = parseInt(corpo && corpo.transportadora_id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return { erro: "Informe transportadora_id para cadastrar como dono do sistema." };
    }
    const ok = await banco.query("SELECT 1 FROM transportadoras WHERE id=$1", [id]);
    if (ok.rows.length === 0) {
      return { erro: "Transportadora nÃ£o encontrada." };
    }
    return { id };
  }
  const idJwt = obterIdTransportadora(requisicao);
  if (idJwt == null) {
    return { erro: "SessÃ£o sem transportadora vinculada." };
  }
  return { id: idJwt };
}

async function transportadoraEscopoMutacao(requisicao, chaveTabela, idRecurso) {
  const nomeTabela = MAPA_TABELA_TRANSPORTADORA[chaveTabela];
  if (!nomeTabela) return null;
  if (usuarioEhDonoSistema(requisicao)) {
    const r = await banco.query(`SELECT transportadora_id FROM ${nomeTabela} WHERE id=$1`, [idRecurso]);
    if (r.rows.length === 0) return null;
    return r.rows[0].transportadora_id;
  }
  return obterIdTransportadora(requisicao);
}

function normalizarIdsExclusao(requisicao) {
  const origem = Array.isArray(requisicao.body && requisicao.body.ids)
    ? requisicao.body.ids
    : [requisicao.params.id];

  const ids = origem
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  return [...new Set(ids)];
}

function placeholderIds(ids, inicio) {
  return ids.map((_, indice) => "$" + (inicio + indice)).join(", ");
}

function normalizarCorpoEntrada(valor, chave) {
  if (Array.isArray(valor)) {
    return valor.map((item) => normalizarCorpoEntrada(item, chave));
  }

  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([nomeCampo, conteudo]) => [
        nomeCampo,
        normalizarCorpoEntrada(conteudo, nomeCampo)
      ])
    );
  }

  if (typeof valor === "string") {
    if (String(chave || "").toLowerCase().includes("senha")) {
      return valor;
    }
    return valor.trim().slice(0, 5000);
  }

  return valor;
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
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
// AUTH ? LOGIN
// ============================================================

app.post("/auth/login", async (requisicao, resposta) => {
  const { email, senha } = requisicao.body;
  const emailNormalizado = normalizarEmail(email);

  if (!emailNormalizado || !senha) {
    return resposta.status(400).json({ mensagem: "Informe e-mail e senha." });
  }

  if (!emailValido(emailNormalizado)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
  }

  try {
    const sql = `
      SELECT u.*, m.nome AS motorista_nome, t.nome AS transportadora_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id
        AND (u.transportadora_id IS NULL OR m.transportadora_id = u.transportadora_id)
      LEFT JOIN transportadoras t ON u.transportadora_id = t.id
      WHERE u.email = $1
    `;
    const resultado = await banco.query(sql, [emailNormalizado]);

    if (resultado.rows.length === 0) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha invÃ¡lidos." });
    }

    const usuario = resultado.rows[0];

    if (!usuario.ativo) {
      return resposta.status(403).json({ mensagem: "UsuÃ¡rio inativo. Entre em contato com o administrador." });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "E-mail ou senha invÃ¡lidos." });
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
// TRANSPORTADORAS ? DONO DO SISTEMA
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

app.get("/transportadoras/:id", exigirDonoSistema, async (requisicao, resposta) => {
  try {
    const { id } = requisicao.params;
    const sql = `
      SELECT
        t.id, t.nome, t.cnpj, t.ativo, t.data_cadastro,
        COUNT(u.id) FILTER (WHERE u.perfil = 'admin') AS total_admins
      FROM transportadoras t
      LEFT JOIN usuarios u ON u.transportadora_id = t.id
      WHERE t.id = $1
      GROUP BY t.id
    `;
    const resultado = await banco.query(sql, [id]);
    
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Transportadora nÃ£o encontrada." });
    }
    
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar transportadora:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar transportadora." });
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
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatÃ³rios." });
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
      return resposta.status(400).json({ mensagem: "JÃ¡ existe um usuÃ¡rio cadastrado com esse e-mail." });
    }
    console.error("Erro ao criar transportadora:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao criar transportadora." });
  } finally {
    cliente.release();
  }
});

app.put("/transportadoras/:id", exigirDonoSistema, async (requisicao, resposta) => {
  try {
    const { id } = requisicao.params;
    const { nome, cnpj, ativo } = requisicao.body;

    if (!nome) {
      return resposta.status(400).json({ mensagem: "O nome da transportadora Ã© obrigatÃ³rio." });
    }

    const sql = `
      UPDATE transportadoras
      SET nome = $1, cnpj = $2, ativo = $3
      WHERE id = $4
      RETURNING id
    `;
    const resultado = await banco.query(sql, [nome, cnpj || null, ativo, id]);

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Transportadora nÃ£o encontrada." });
    }

    return resposta.json({ mensagem: "Transportadora atualizada com sucesso." });
  } catch (erro) {
    console.error("Erro ao atualizar transportadora:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar transportadora." });
  }
});

// ============================================================
// USUÃRIOS
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
      LEFT JOIN motoristas m ON u.motorista_id = m.id
        AND (u.transportadora_id IS NULL OR m.transportadora_id = u.transportadora_id)
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
    console.error("Erro ao buscar usuÃ¡rios:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuÃ¡rios." });
  }
});

app.get("/usuarios/:id", exigirAdminOuDono, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  try {
    let sql = `
      SELECT
        u.id, u.nome, u.email, u.perfil, u.ativo, u.motorista_id,
        m.nome AS motorista_nome
      FROM usuarios u
      LEFT JOIN motoristas m ON u.motorista_id = m.id
        AND (u.transportadora_id IS NULL OR m.transportadora_id = u.transportadora_id)
      WHERE u.id = $1
    `;
    const valores = [id];
    if (!donoSistema) {
      sql += " AND u.transportadora_id = $2";
      valores.push(transportadoraId);
    }
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "UsuÃ¡rio nÃ£o encontrado." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar usuÃ¡rio:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar usuÃ¡rio." });
  }
});

app.post("/usuarios", exigirAdmin, async (requisicao, resposta) => {
  const { nome, email, senha, perfil, motorista_id, ativo } = requisicao.body;
  const emailNormalizado = normalizarEmail(email);

  if (!nome || !emailNormalizado || !senha || !perfil) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatÃ³rios." });
  }

  if (!emailValido(emailNormalizado)) {
    return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
  }

  if (String(senha).length < 8) {
    return resposta.status(400).json({ mensagem: "A senha deve ter pelo menos 8 caracteres." });
  }

  if (perfil !== "admin" && perfil !== "motorista") {
    return resposta.status(400).json({ mensagem: "Perfil invÃ¡lido para esta transportadora." });
  }

  if (perfil === "motorista" && !motorista_id) {
    return resposta.status(400).json({ mensagem: "Vincule um motorista para usuÃ¡rios do perfil motorista." });
  }

  try {
    const escopo = await transportadoraIdParaPost(requisicao, requisicao.body);
    if (escopo.erro) {
      return resposta.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const motoristaValido = await motoristaPertenceTransportadora(motorista_id, transportadoraId);
    if (!motoristaValido) {
      return resposta.status(400).json({ mensagem: "Motorista nÃ£o encontrado para esta transportadora." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const sql = `
      INSERT INTO usuarios (transportadora_id, nome, email, senha_hash, perfil, motorista_id, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const valores = [transportadoraId, nome, emailNormalizado, senhaHash, perfil, motorista_id || null, ativo !== false];
    const resultado = await banco.query(sql, valores);

    return resposta.status(201).json({
      mensagem: "UsuÃ¡rio criado com sucesso.",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "JÃ¡ existe um usuÃ¡rio cadastrado com esse e-mail." });
    }
    console.error("Erro ao criar usuÃ¡rio:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao criar usuÃ¡rio." });
  }
});

app.put("/usuarios/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { nome, email, motorista_id, ativo } = requisicao.body;
  const emailNormalizado = normalizarEmail(email);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (!nome || !emailNormalizado) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatórios." });
  }

  try {
    if (!emailValido(emailNormalizado)) {
      return resposta.status(400).json({ mensagem: "Informe um e-mail valido." });
    }

    let usuarioAtual;
    if (donoSistema) {
      usuarioAtual = await banco.query(
        "SELECT perfil, transportadora_id FROM usuarios WHERE id=$1",
        [id]
      );
    } else {
      usuarioAtual = await banco.query(
        "SELECT perfil, transportadora_id FROM usuarios WHERE id=$1 AND transportadora_id=$2",
        [id, obterIdTransportadora(requisicao)]
      );
    }

    if (usuarioAtual.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Usuário não encontrado." });
    }

    const perfilAtual = usuarioAtual.rows[0].perfil;
    const transportadoraAlvo = usuarioAtual.rows[0].transportadora_id;

    if (perfilAtual === "dono") {
      return resposta.status(400).json({ mensagem: "O perfil master não pode ser alterado por esta rota." });
    }

    const motoristaIdFinal = perfilAtual === "motorista" ? motorista_id : null;

    if (perfilAtual === "motorista" && !motoristaIdFinal) {
      return resposta.status(400).json({ mensagem: "Vincule um motorista para usuários do perfil motorista." });
    }

    const motoristaValido = await motoristaPertenceTransportadora(motoristaIdFinal, transportadoraAlvo);
    if (!motoristaValido) {
      return resposta.status(400).json({ mensagem: "Motorista não encontrado para esta transportadora." });
    }

    let sql;
    let valores;
    if (donoSistema) {
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, motorista_id=$3, ativo=$4
        WHERE id=$5 RETURNING id
      `;
      valores = [nome, emailNormalizado, motoristaIdFinal || null, ativo !== false, id];
    } else {
      sql = `
        UPDATE usuarios SET nome=$1, email=$2, motorista_id=$3, ativo=$4
        WHERE id=$5 AND transportadora_id=$6 RETURNING id
      `;
      valores = [nome, emailNormalizado, motoristaIdFinal || null, ativo !== false, id, transportadoraAlvo];
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

  if (String(novaSenha).length < 8) {
    return resposta.status(400).json({ mensagem: "A nova senha deve ter pelo menos 8 caracteres." });
  }

  try {
    const resultado = await banco.query(
      "SELECT senha_hash FROM usuarios WHERE id=$1",
      [idUsuario]
    );

    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "UsuÃ¡rio nÃ£o encontrado." });
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, resultado.rows[0].senha_hash);
    if (!senhaCorreta) {
      return resposta.status(401).json({ mensagem: "Senha atual incorreta." });
    }

    const novaHash = await bcrypt.hash(novaSenha, 10);
    await banco.query(
      "UPDATE usuarios SET senha_hash=$1 WHERE id=$2",
      [novaHash, idUsuario]
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

  if (!nome || !cpf || !telefone || !cnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatÃ³rios." });
  }

  try {
    const escopo = await transportadoraIdParaPost(requisicao, requisicao.body);
    if (escopo.erro) {
      return resposta.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const sql = `
      INSERT INTO motoristas (transportadora_id, nome, cpf, telefone, cnh, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const valores = [transportadoraId, nome, cpf, telefone, cnh, status];

    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Motorista cadastrado com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "JÃ¡ existe um motorista cadastrado com esse CPF." });
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
      return resposta.status(404).json({ mensagem: "Motorista nÃ£o encontrado." });
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

  if (!nome || !cpf || !telefone || !cnh || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatÃ³rios." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "motoristas", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Motorista nÃ£o encontrado." });
    }

    const sql = `
      UPDATE motoristas SET
        nome=$1, cpf=$2, telefone=$3, cnh=$4, status=$5
      WHERE id=$6 AND transportadora_id=$7
      RETURNING *
    `;
    const valores = [nome, cpf, telefone, cnh, status, id, transportadoraId];

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Motorista nÃ£o encontrado." });
    }
    return resposta.json({ mensagem: "Motorista atualizado com sucesso.", motorista: resultado.rows[0] });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "JÃ¡ existe um motorista cadastrado com esse CPF." });
    }
    console.error("Erro ao atualizar motorista:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar motorista no banco de dados." });
  }
});

// ============================================================
// VEÃCULOS
// ============================================================

app.post("/veiculos", exigirAdmin, async (req, res) => {
  const { modelo, placa, status, ano, observacoes } = req.body;

  const modeloTratado = (modelo || "").trim();
  const placaTratada = (placa || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const statusTratado = (status || "").trim();
  let anoTratado = null;
  if (ano !== undefined && ano !== null && String(ano).trim() !== "") {
    const n = parseInt(String(ano), 10);
    if (!isNaN(n)) anoTratado = n;
  }
  const observacoesTratadas = (observacoes || "").trim() || null;

  if (!modeloTratado || !placaTratada || !statusTratado) {
    const pendentes = [];
    if (!modeloTratado) pendentes.push("modelo");
    if (!placaTratada) pendentes.push("placa");
    if (!statusTratado) pendentes.push("status");
    return res.status(400).json({ mensagem: "Preencha os campos obrigatorios: " + pendentes.join(", ") + "." });
  }

  try {
    const escopo = await transportadoraIdParaPost(req, req.body);
    if (escopo.erro) {
      return res.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const sql = `
      INSERT INTO veiculos (transportadora_id, modelo, placa, status, ano, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const valores = [transportadoraId, modeloTratado, placaTratada, statusTratado, anoTratado, observacoesTratadas];

    const resultado = await banco.query(sql, valores);
    return res.status(201).json({ mensagem: "VeÃ­culo cadastrado com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    if (erro.code === "23505") {
      return res.status(400).json({ mensagem: "JÃ¡ existe um veÃ­culo cadastrado com essa placa." });
    }
    console.error("ERRO SQL VEICULOS:", erro);
    return res.status(500).json({ mensagem: "Erro ao salvar veÃ­culo no banco de dados.", detalhe: erro.message });
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
    console.error("Erro ao buscar veÃ­culos:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veÃ­culos." });
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
      return resposta.status(404).json({ mensagem: "VeÃ­culo nÃ£o encontrado." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar veÃ­culo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar veÃ­culo." });
  }
});

app.put("/veiculos/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { modelo, placa, status, ano, observacoes } = requisicao.body;

  const modeloTratado = (modelo || "").trim();
  const placaTratada = (placa || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  const statusTratado = (status || "").trim();
  let anoTratado = null;
  if (ano !== undefined && ano !== null && String(ano).trim() !== "") {
    const n = parseInt(String(ano), 10);
    if (!isNaN(n)) anoTratado = n;
  }
  const observacoesTratadas = (observacoes || "").trim() || null;

  if (!modeloTratado || !placaTratada || !statusTratado) {
    const pendentes = [];
    if (!modeloTratado) pendentes.push("modelo");
    if (!placaTratada) pendentes.push("placa");
    if (!statusTratado) pendentes.push("status");
    return resposta.status(400).json({ mensagem: "Preencha os campos obrigatorios: " + pendentes.join(", ") + "." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "veiculos", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "VeÃ­culo nÃ£o encontrado." });
    }

    const sql = `
      UPDATE veiculos SET
        modelo=$1, placa=$2, status=$3, ano=$4, observacoes=$5
      WHERE id=$6 AND transportadora_id=$7
      RETURNING *
    `;
    const valores = [modeloTratado, placaTratada, statusTratado, anoTratado, observacoesTratadas, id, transportadoraId];

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "VeÃ­culo nÃ£o encontrado." });
    }
    return resposta.json({ mensagem: "VeÃ­culo atualizado com sucesso.", veiculo: resultado.rows[0] });
  } catch (erro) {
    if (erro.code === "23505") {
      return resposta.status(400).json({ mensagem: "JÃ¡ existe um veÃ­culo cadastrado com essa placa." });
    }
    console.error("Erro ao atualizar veÃ­culo:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao atualizar veÃ­culo no banco de dados." });
  }
});

// ============================================================
// VIAGENS
// ============================================================

app.post("/viagens", exigirAdmin, async (requisicao, resposta) => {
  const { origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, kmInicial, kmFinal, status, observacoes } = requisicao.body;

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !dataChegada || !valorFrete || kmInicial == null || kmFinal == null || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatÃ³rios." });
  }

  const kmInicialNum = parseInt(kmInicial, 10);
  const kmFinalNum = parseInt(kmFinal, 10);

  if (!Number.isInteger(kmInicialNum) || !Number.isInteger(kmFinalNum) || kmInicialNum < 0 || kmFinalNum < 0) {
    return resposta.status(400).json({ mensagem: "Informe os KM da viagem corretamente." });
  }

  if (kmFinalNum < kmInicialNum) {
    return resposta.status(400).json({ mensagem: "O KM final nÃƒÂ£o pode ser menor que o KM inicial." });
  }

  try {
    const escopo = await transportadoraIdParaPost(requisicao, requisicao.body);
    if (escopo.erro) {
      return resposta.status(400).json({ mensagem: escopo.erro });
    }
    const transportadoraId = escopo.id;

    const motoristaValido = await motoristaPertenceTransportadora(motoristaId, transportadoraId);
    const veiculoValido = await veiculoPertenceTransportadora(veiculoId, transportadoraId);

    if (!motoristaValido || !veiculoValido) {
      return resposta.status(400).json({ mensagem: "Motorista ou veÃ­culo nÃ£o encontrado para esta transportadora." });
    }

    const sql = `
      INSERT INTO viagens (transportadora_id, origem, destino, motorista_id, veiculo_id, data_saida, data_chegada, valor_frete, km_inicial, km_final, status, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;
    const valores = [transportadoraId, origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, kmInicialNum, kmFinalNum, status, observacoes || ""];

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
      v.id, v.transportadora_id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.km_inicial, v.km_final, v.status, v.observacoes, v.data_cadastro,
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
      v.id, v.transportadora_id, v.origem, v.destino, v.data_saida, v.data_chegada,
      v.valor_frete, v.km_inicial, v.km_final, v.status, v.observacoes, v.data_cadastro,
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
      return resposta.status(404).json({ mensagem: "Viagem nÃ£o encontrada." });
    }
    sql += " AND v.motorista_id = $3";
    valores.push(usuario.motorista_id);
  }

  try {
    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem nÃ£o encontrada." });
    }
    return resposta.json(resultado.rows[0]);
  } catch (erro) {
    console.error("Erro ao buscar viagem:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao buscar viagem." });
  }
});

app.put("/viagens/:id", exigirAdmin, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const { origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, kmInicial, kmFinal, status, observacoes } = requisicao.body;

  if (!origem || !destino || !motoristaId || !veiculoId || !dataSaida || !dataChegada || !valorFrete || !status) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  let kmInicialNum = null;
  let kmFinalNum = null;

  if (kmInicial !== undefined && kmInicial !== null && kmInicial !== "") {
    kmInicialNum = parseInt(kmInicial, 10);
  }

  if (kmFinal !== undefined && kmFinal !== null && kmFinal !== "") {
    kmFinalNum = parseInt(kmFinal, 10);
  }

  if (
    (kmInicialNum !== null && (!Number.isInteger(kmInicialNum) || kmInicialNum < 0)) ||
    (kmFinalNum !== null && (!Number.isInteger(kmFinalNum) || kmFinalNum < 0))
  ) {
    return resposta.status(400).json({ mensagem: "Informe KM inicial e KM final validos." });
  }

  if (kmInicialNum !== null && kmFinalNum !== null && kmFinalNum < kmInicialNum) {
    return resposta.status(400).json({ mensagem: "O KM final nao pode ser menor que o KM inicial." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "viagens", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Viagem nÃ£o encontrada." });
    }

    const motoristaValido = await motoristaPertenceTransportadora(motoristaId, transportadoraId);
    const veiculoValido = await veiculoPertenceTransportadora(veiculoId, transportadoraId);

    if (!motoristaValido || !veiculoValido) {
      return resposta.status(400).json({ mensagem: "Motorista ou veÃ­culo nÃ£o encontrado para esta transportadora." });
    }

    const sql = `
      UPDATE viagens SET
        origem=$1, destino=$2, motorista_id=$3, veiculo_id=$4,
        data_saida=$5, data_chegada=$6, valor_frete=$7,
        km_inicial=COALESCE($8, km_inicial), km_final=COALESCE($9, km_final),
        status=$10, observacoes=$11
      WHERE id=$12 AND transportadora_id=$13
      RETURNING *
    `;
    const valores = [origem, destino, motoristaId, veiculoId, dataSaida, dataChegada, valorFrete, kmInicialNum, kmFinalNum, status, observacoes || "", id, transportadoraId];

    const resultado = await banco.query(sql, valores);
    if (resultado.rows.length === 0) {
      return resposta.status(404).json({ mensagem: "Viagem nÃ£o encontrada." });
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
  const { tipoDespesa, viagemId, veiculoId, descricao, categoria, dataDespesa, valor } = requisicao.body;
  const tipoDespesaFinal = tipoDespesa === "veiculo" ? "veiculo" : "viagem";

  if (!descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  if (tipoDespesaFinal === "viagem" && !viagemId) {
    return resposta.status(400).json({ mensagem: "Informe a viagem da despesa." });
  }

  if (tipoDespesaFinal === "veiculo" && !veiculoId) {
    return resposta.status(400).json({ mensagem: "Informe o veiculo da despesa." });
  }

  try {
    let tid;
    let viagemIdFinal = null;
    let veiculoIdFinal = null;

    if (tipoDespesaFinal === "viagem") {
      const vr = await banco.query("SELECT transportadora_id FROM viagens WHERE id=$1", [viagemId]);
      if (vr.rows.length === 0) {
        return resposta.status(400).json({ mensagem: "Viagem nÃ£o encontrada." });
      }
      tid = vr.rows[0].transportadora_id;
      viagemIdFinal = viagemId;
    } else {
      const veiculo = await banco.query("SELECT transportadora_id FROM veiculos WHERE id=$1", [veiculoId]);
      if (veiculo.rows.length === 0) {
        return resposta.status(400).json({ mensagem: "Veiculo nÃƒÂ£o encontrado." });
      }
      tid = veiculo.rows[0].transportadora_id;
      veiculoIdFinal = veiculoId;
    }

    if (!usuarioEhDonoSistema(requisicao)) {
      if (tid !== obterIdTransportadora(requisicao)) {
        return resposta.status(400).json({ mensagem: "Viagem nÃ£o encontrada para esta transportadora." });
      }
    }

    const sql = `
      INSERT INTO despesas (transportadora_id, viagem_id, veiculo_id, tipo_despesa, descricao, categoria, data_despesa, valor)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const valores = [tid, viagemIdFinal, veiculoIdFinal, tipoDespesaFinal, descricao, categoria, dataDespesa, valor];

    const resultado = await banco.query(sql, valores);
    return resposta.status(201).json({ mensagem: "Despesa cadastrada com sucesso.", id: resultado.rows[0].id });
  } catch (erro) {
    console.error("Erro ao salvar despesa:", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao salvar despesa no banco de dados." });
  }
});

app.get("/despesas", exigirAdminOuDono, async (requisicao, resposta) => {
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  let sql = `
    SELECT
      d.id, d.viagem_id, d.veiculo_id, d.tipo_despesa, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      COALESCE(ve_despesa.modelo, ve_viagem.modelo) AS veiculo_modelo,
      COALESCE(ve_despesa.placa, ve_viagem.placa) AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id AND v.transportadora_id = d.transportadora_id
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_viagem ON v.veiculo_id = ve_viagem.id AND ve_viagem.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_despesa ON d.veiculo_id = ve_despesa.id AND ve_despesa.transportadora_id = d.transportadora_id
    LEFT JOIN transportadoras t ON d.transportadora_id = t.id
  `;
  const valores = [];

  if (!donoSistema) {
    sql += " WHERE d.transportadora_id = $1";
    valores.push(transportadoraId);
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

app.get("/despesas/:id", exigirAdminOuDono, async (requisicao, resposta) => {
  const { id } = requisicao.params;
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  let sql = `
    SELECT
      d.id, d.viagem_id, d.veiculo_id, d.tipo_despesa, d.descricao, d.categoria,
      d.data_despesa, d.valor, d.data_cadastro,
      v.origem, v.destino,
      m.nome AS motorista_nome,
      COALESCE(ve_despesa.modelo, ve_viagem.modelo) AS veiculo_modelo,
      COALESCE(ve_despesa.placa, ve_viagem.placa) AS veiculo_placa,
      t.nome AS transportadora_nome
    FROM despesas d
    LEFT JOIN viagens v ON d.viagem_id = v.id AND v.transportadora_id = d.transportadora_id
    LEFT JOIN motoristas m ON v.motorista_id = m.id AND m.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_viagem ON v.veiculo_id = ve_viagem.id AND ve_viagem.transportadora_id = d.transportadora_id
    LEFT JOIN veiculos ve_despesa ON d.veiculo_id = ve_despesa.id AND ve_despesa.transportadora_id = d.transportadora_id
    LEFT JOIN transportadoras t ON d.transportadora_id = t.id
    WHERE d.id = $1
  `;
  const valores = [id];

  if (!donoSistema) {
    sql += " AND d.transportadora_id = $2";
    valores.push(transportadoraId);
  }
  try {
    const resultado = await banco.query(sql, valores);
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
  const { tipoDespesa, viagemId, veiculoId, descricao, categoria, dataDespesa, valor } = requisicao.body;
  const tipoDespesaFinal = tipoDespesa === "veiculo" ? "veiculo" : "viagem";

  if (!descricao || !categoria || !dataDespesa || !valor) {
    return resposta.status(400).json({ mensagem: "Preencha todos os campos obrigatorios." });
  }

  if (tipoDespesaFinal === "viagem" && !viagemId) {
    return resposta.status(400).json({ mensagem: "Informe a viagem da despesa." });
  }

  if (tipoDespesaFinal === "veiculo" && !veiculoId) {
    return resposta.status(400).json({ mensagem: "Informe o veiculo da despesa." });
  }

  try {
    const transportadoraId = await transportadoraEscopoMutacao(requisicao, "despesas", id);
    if (transportadoraId === null) {
      return resposta.status(404).json({ mensagem: "Despesa nao encontrada." });
    }

    let viagemIdFinal = null;
    let veiculoIdFinal = null;

    if (tipoDespesaFinal === "viagem") {
      const vr = await banco.query("SELECT transportadora_id FROM viagens WHERE id=$1", [viagemId]);
      if (vr.rows.length === 0 || vr.rows[0].transportadora_id !== transportadoraId) {
        return resposta.status(400).json({ mensagem: "Viagem invalida para o escopo desta despesa." });
      }
      viagemIdFinal = viagemId;
    } else {
      const veiculo = await banco.query("SELECT transportadora_id FROM veiculos WHERE id=$1", [veiculoId]);
      if (veiculo.rows.length === 0 || veiculo.rows[0].transportadora_id !== transportadoraId) {
        return resposta.status(400).json({ mensagem: "Veiculo invalido para o escopo desta despesa." });
      }
      veiculoIdFinal = veiculoId;
    }

    const sql = `
      UPDATE despesas SET
        viagem_id=$1, veiculo_id=$2, tipo_despesa=$3,
        descricao=$4, categoria=$5, data_despesa=$6, valor=$7
      WHERE id=$8 AND transportadora_id=$9
      RETURNING *
    `;
    const valores = [viagemIdFinal, veiculoIdFinal, tipoDespesaFinal, descricao, categoria, dataDespesa, valor, id, transportadoraId];

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

// ============================================================
// EXCLUSÕES
// ============================================================

app.delete(["/usuarios", "/usuarios/:id"], exigirAdmin, async (requisicao, resposta) => {
  let ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos um usuário para excluir." });
  }

  ids = ids.filter((uid) => uid !== requisicao.usuario.id);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Você não pode excluir o próprio usuário logado." });
  }

  try {
    let resultado;
    if (donoSistema) {
      resultado = await banco.query(
        `DELETE FROM usuarios WHERE id IN (${placeholderIds(ids, 1)}) AND perfil <> 'dono'`,
        ids
      );
    } else {
      const valores = [transportadoraId, ...ids];
      resultado = await banco.query(
        `DELETE FROM usuarios WHERE transportadora_id=$1 AND id IN (${placeholderIds(ids, 2)}) AND perfil NOT IN ('dono')`,
        valores
      );
    }
    return resposta.json({ mensagem: "Usuário(s) excluído(s) com sucesso.", total: resultado.rowCount });
  } catch (erro) {
    console.error("Erro ao excluir usuário(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir usuário(s)." });
  }
});

app.delete(["/despesas", "/despesas/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos uma despesa para excluir." });
  }

  try {
    let resultado;
    if (donoSistema) {
      resultado = await banco.query(
        `DELETE FROM despesas WHERE id IN (${placeholderIds(ids, 1)})`,
        ids
      );
    } else {
      const valores = [transportadoraId, ...ids];
      resultado = await banco.query(
        `DELETE FROM despesas WHERE transportadora_id=$1 AND id IN (${placeholderIds(ids, 2)})`,
        valores
      );
    }
    return resposta.json({ mensagem: "Despesa(s) excluída(s) com sucesso.", total: resultado.rowCount });
  } catch (erro) {
    console.error("Erro ao excluir despesa(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir despesa(s)." });
  }
});

app.delete(["/viagens", "/viagens/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos uma viagem para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, donoSistema ? 1 : 2);

    if (donoSistema) {
      await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${marcadores})`, ids);
      const resultado = await cliente.query(`DELETE FROM viagens WHERE id IN (${marcadores})`, ids);
      await cliente.query("COMMIT");
      return resposta.json({ mensagem: "Viagem(ns) excluída(s) com sucesso.", total: resultado.rowCount });
    }

    const valores = [transportadoraId, ...ids];
    await cliente.query(`DELETE FROM despesas WHERE transportadora_id=$1 AND viagem_id IN (${marcadores})`, valores);
    const resultado = await cliente.query(`DELETE FROM viagens WHERE transportadora_id=$1 AND id IN (${marcadores})`, valores);

    await cliente.query("COMMIT");
    return resposta.json({ mensagem: "Viagem(ns) excluída(s) com sucesso.", total: resultado.rowCount });
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir viagem(ns):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir viagem(ns)." });
  } finally {
    cliente.release();
  }
});

app.delete(["/motoristas", "/motoristas/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos um motorista para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, donoSistema ? 1 : 2);

    if (donoSistema) {
      const viagens = await cliente.query(`SELECT id FROM viagens WHERE motorista_id IN (${marcadores})`, ids);
      const idsViagens = viagens.rows.map((linha) => linha.id);

      if (idsViagens.length > 0) {
        const mV = placeholderIds(idsViagens, 1);
        await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${mV})`, idsViagens);
        await cliente.query(`DELETE FROM viagens WHERE id IN (${mV})`, idsViagens);
      }

      await cliente.query(`UPDATE usuarios SET motorista_id=NULL WHERE motorista_id IN (${marcadores})`, ids);
      const resultado = await cliente.query(`DELETE FROM motoristas WHERE id IN (${marcadores})`, ids);

      await cliente.query("COMMIT");
      return resposta.json({ mensagem: "Motorista(s) excluído(s) com sucesso.", total: resultado.rowCount });
    }

    const valores = [transportadoraId, ...ids];
    const viagens = await cliente.query(`SELECT id FROM viagens WHERE transportadora_id=$1 AND motorista_id IN (${marcadores})`, valores);
    const idsViagens = viagens.rows.map((linha) => linha.id);

    if (idsViagens.length > 0) {
      await cliente.query(
        `DELETE FROM despesas WHERE transportadora_id=$1 AND viagem_id IN (${placeholderIds(idsViagens, 2)})`,
        [transportadoraId, ...idsViagens]
      );
      await cliente.query(
        `DELETE FROM viagens WHERE transportadora_id=$1 AND id IN (${placeholderIds(idsViagens, 2)})`,
        [transportadoraId, ...idsViagens]
      );
    }

    await cliente.query(`UPDATE usuarios SET motorista_id=NULL WHERE transportadora_id=$1 AND motorista_id IN (${marcadores})`, valores);
    const resultado = await cliente.query(`DELETE FROM motoristas WHERE transportadora_id=$1 AND id IN (${marcadores})`, valores);

    await cliente.query("COMMIT");
    return resposta.json({ mensagem: "Motorista(s) excluído(s) com sucesso.", total: resultado.rowCount });
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir motorista(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir motorista(s)." });
  } finally {
    cliente.release();
  }
});

app.delete(["/veiculos", "/veiculos/:id"], exigirAdmin, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);
  const transportadoraId = obterIdTransportadora(requisicao);
  const donoSistema = usuarioEhDonoSistema(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos um veículo para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, donoSistema ? 1 : 2);

    if (donoSistema) {
      const viagens = await cliente.query(`SELECT id FROM viagens WHERE veiculo_id IN (${marcadores})`, ids);
      const idsViagens = viagens.rows.map((linha) => linha.id);

      if (idsViagens.length > 0) {
        const mV = placeholderIds(idsViagens, 1);
        await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${mV})`, idsViagens);
        await cliente.query(`DELETE FROM viagens WHERE id IN (${mV})`, idsViagens);
      }

      const resultado = await cliente.query(`DELETE FROM veiculos WHERE id IN (${marcadores})`, ids);

      await cliente.query("COMMIT");
      return resposta.json({ mensagem: "Veículo(s) excluído(s) com sucesso.", total: resultado.rowCount });
    }

    const valores = [transportadoraId, ...ids];
    const viagens = await cliente.query(`SELECT id FROM viagens WHERE transportadora_id=$1 AND veiculo_id IN (${marcadores})`, valores);
    const idsViagens = viagens.rows.map((linha) => linha.id);

    if (idsViagens.length > 0) {
      await cliente.query(
        `DELETE FROM despesas WHERE transportadora_id=$1 AND viagem_id IN (${placeholderIds(idsViagens, 2)})`,
        [transportadoraId, ...idsViagens]
      );
      await cliente.query(
        `DELETE FROM viagens WHERE transportadora_id=$1 AND id IN (${placeholderIds(idsViagens, 2)})`,
        [transportadoraId, ...idsViagens]
      );
    }

    const resultado = await cliente.query(`DELETE FROM veiculos WHERE transportadora_id=$1 AND id IN (${marcadores})`, valores);

    await cliente.query("COMMIT");
    return resposta.json({ mensagem: "Veículo(s) excluído(s) com sucesso.", total: resultado.rowCount });
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir veículo(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir veículo(s)." });
  } finally {
    cliente.release();
  }
});

app.delete(["/transportadoras", "/transportadoras/:id"], exigirDonoSistema, async (requisicao, resposta) => {
  const ids = normalizarIdsExclusao(requisicao);

  if (ids.length === 0) {
    return resposta.status(400).json({ mensagem: "Informe ao menos uma transportadora para excluir." });
  }

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const marcadores = placeholderIds(ids, 1);
    const viagens = await cliente.query(`SELECT id FROM viagens WHERE transportadora_id IN (${marcadores})`, ids);
    const idsViagens = viagens.rows.map((linha) => linha.id);

    if (idsViagens.length > 0) {
      await cliente.query(`DELETE FROM despesas WHERE viagem_id IN (${placeholderIds(idsViagens, 1)})`, idsViagens);
    }

    await cliente.query(`DELETE FROM despesas WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM viagens WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM usuarios WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM veiculos WHERE transportadora_id IN (${marcadores})`, ids);
    await cliente.query(`DELETE FROM motoristas WHERE transportadora_id IN (${marcadores})`, ids);
    const resultado = await cliente.query(`DELETE FROM transportadoras WHERE id IN (${marcadores})`, ids);

    await cliente.query("COMMIT");
    return resposta.json({ mensagem: "Transportadora(s) excluída(s) com sucesso.", total: resultado.rowCount });
  } catch (erro) {
    await cliente.query("ROLLBACK");
    console.error("Erro ao excluir transportadora(s):", erro.message);
    return resposta.status(500).json({ mensagem: "Erro ao excluir transportadora(s)." });
  } finally {
    cliente.release();
  }
});
app.listen(porta, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${porta}`);
});
