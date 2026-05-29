const STATUS_MOTORISTA = new Set(["ativo", "inativo"]);
const STATUS_VEICULO = new Set(["ativo", "inativo", "em viagem", "manutencao", "manuten\u00e7\u00e3o"]);
const STATUS_VIAGEM = new Set(["em andamento", "finalizada", "cancelada"]);
const CATEGORIAS_DESPESA = new Set(["combustivel", "pedagio", "alimentacao", "manutencao", "outros"]);
const TIPOS_DESPESA = new Set(["viagem", "veiculo"]);

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

function normalizarStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function valorMonetarioValido(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

function dataValida(data) {
  if (!data) return false;
  const timestamp = Date.parse(data);
  return Number.isFinite(timestamp);
}

module.exports = {
  STATUS_MOTORISTA,
  STATUS_VEICULO,
  STATUS_VIAGEM,
  CATEGORIAS_DESPESA,
  TIPOS_DESPESA,
  normalizarCorpoEntrada,
  normalizarEmail,
  emailValido,
  normalizarStatus,
  valorMonetarioValido,
  dataValida
};

