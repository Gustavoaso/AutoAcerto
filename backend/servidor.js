const path    = require("path");
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const rateLimit = require("express-rate-limit");
const banco   = require("./banco");
const { normalizarCorpoEntrada } = require("./validacoes");
const { detectarSqlInjection, detectarXss } = require("./middlewares/waf");

// Importando Rotas
const authRoutes = require("./routes/auth.routes");
const transportadorasRoutes = require("./routes/transportadoras.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const motoristasRoutes = require("./routes/motoristas.routes");
const veiculosRoutes = require("./routes/veiculos.routes");
const viagensRoutes = require("./routes/viagens.routes");
const despesasRoutes = require("./routes/despesas.routes");

const app   = express();
const porta = process.env.PORT || 3000;
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
  return false;
}

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET não configurado. Defina a variável de ambiente antes de iniciar o servidor.\n" +
    "Gere um valor seguro com: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:"],
      connectSrc:  ["'self'"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

app.use(cors({
  origin: function (origem, callback) {
    if (!origem || origemCorsPermitida(origem)) {
      return callback(null, true);
    }
    return callback(new Error("Origem nao permitida pelo CORS."));
  }
}));

app.use(express.json({ limit: "1mb" }));

// ✅ SEGURANÇA: WAF para detectar SQL Injection e XSS
app.use(detectarSqlInjection);
app.use(detectarXss);

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

app.get("/health", (requisicao, resposta) => {
  resposta.json({ status: "ok" });
});

// Registrar Rotas Modularizadas
app.use("/auth", authRoutes);
app.use("/transportadoras", transportadorasRoutes);
app.use("/usuarios", usuariosRoutes);
app.use("/motoristas", motoristasRoutes);
app.use("/veiculos", veiculosRoutes);
app.use("/viagens", viagensRoutes);
app.use("/despesas", despesasRoutes);

app.use((erro, requisicao, resposta, proximo) => {
  if (erro.message === "Origem nao permitida pelo CORS.") {
    return resposta.status(403).json({ mensagem: "Origem nao permitida." });
  }

  console.error("Erro nao tratado:", erro.message);
  return resposta.status(500).json({ mensagem: "Erro interno do servidor." });
});

// Inicializar banco explicitamente e então iniciar o servidor
banco.inicializar()
  .then(() => {
    app.listen(porta, "0.0.0.0", () => {
      console.log(`🚀 Servidor rodando na porta ${porta}`);
    });
  })
  .catch((erro) => {
    console.error("Falha ao inicializar o banco de dados. O servidor não será iniciado.", erro);
    process.exit(1);
  });
