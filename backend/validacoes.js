const STATUS_MOTORISTA = new Set(["ativo", "inativo"]);
const STATUS_VEICULO = new Set(["ativo", "inativo", "em viagem", "manutencao"]);
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
    const nomeCampo = String(chave || "").toLowerCase();
    if (nomeCampo.includes("senha") || nomeCampo.includes("base64")) {
      return valor.trim();
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
  return String(status || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function extrairDataIso(valor) {
  if (!valor) return null;
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    return texto.slice(0, 10);
  }
  const timestamp = Date.parse(texto);
  if (!Number.isFinite(timestamp)) return null;
  const data = new Date(timestamp);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataMaiorOuIgual(dataA, dataB) {
  const isoA = extrairDataIso(dataA);
  const isoB = extrairDataIso(dataB);
  if (!isoA || !isoB) return false;
  return isoA >= isoB;
}

function obterDataHojeIso() {
  const data = new Date();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataNaoFutura(data) {
  const iso = extrairDataIso(data);
  if (!iso) return false;
  return iso <= obterDataHojeIso();
}

function cpfValido(cpf) {
  const limpo = String(cpf || "").replace(/\D/g, "");
  if (limpo.length !== 11 || /^(\d)\1+$/.test(limpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(10), 10)) return false;

  return true;
}

function cnpjValido(cnpj) {
  const limpo = String(cnpj || "").replace(/\D/g, "");
  if (limpo.length !== 14 || /^(\d)\1+$/.test(limpo)) return false;

  let tamanho = limpo.length - 2;
  let numeros = limpo.substring(0, tamanho);
  const digitos = limpo.substring(tamanho);

  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  tamanho = tamanho + 1;
  numeros = limpo.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

  return true;
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
  dataValida,
  extrairDataIso,
  obterDataHojeIso,
  dataMaiorOuIgual,
  dataNaoFutura,
  cpfValido,
  cnpjValido
};

