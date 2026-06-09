const express = require("express");
const { exigirAdmin } = require("../middlewares/autenticacao");

const router = express.Router();

const CONSULTAR_PLACA_URL = "https://api.consultarplaca.com.br/v2/consultarPlaca";

function obterEnv(...nomes) {
  for (const nome of nomes) {
    const valor = process.env[nome];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }
  return "";
}

function limparPlaca(valor) {
  return String(valor || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function obterCaminho(objeto, caminho) {
  return String(caminho || "").split(".").reduce(function (atual, chave) {
    if (atual == null) return null;
    return atual[chave];
  }, objeto);
}

function primeiroValor(objeto, caminhos) {
  for (const caminho of caminhos) {
    const valor = obterCaminho(objeto, caminho);
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }
  return "";
}

function obterCredenciaisConsultarPlaca() {
  return {
    email: obterEnv("CONSULTAR_PLACA_EMAIL"),
    apiKey: obterEnv("CONSULTAR_PLACA_API_KEY")
  };
}

async function consultarPlaca(placa) {
  const credenciais = obterCredenciaisConsultarPlaca();

  if (!credenciais.email || !credenciais.apiKey) {
    return {
      erroConfiguracao: true,
      mensagem: "Consulta por placa ainda nao configurada. Configure CONSULTAR_PLACA_EMAIL e CONSULTAR_PLACA_API_KEY no Railway."
    };
  }

  const url = new URL(CONSULTAR_PLACA_URL);
  url.searchParams.set("placa", placa);

  const autenticacao = Buffer.from(credenciais.email + ":" + credenciais.apiKey).toString("base64");
  const controlador = new AbortController();
  const timeout = setTimeout(function () {
    controlador.abort();
  }, 10000);

  try {
    const resposta = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: "Basic " + autenticacao
      },
      signal: controlador.signal
    });
    const texto = await resposta.text();
    let dados = null;

    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = { bruto: texto };
    }

    if (!resposta.ok) {
      return {
        erroProvider: true,
        status: resposta.status,
        mensagem: dados && dados.message ? String(dados.message) : "O provedor de consulta de placa retornou erro."
      };
    }

    return { dados };
  } finally {
    clearTimeout(timeout);
  }
}

router.get("/veiculos/placa/:placa", exigirAdmin, async (requisicao, resposta) => {
  const placa = limparPlaca(requisicao.params.placa);

  if (placa.length !== 7) {
    return resposta.status(400).json({ mensagem: "Informe uma placa valida com 7 caracteres." });
  }

  try {
    const retorno = await consultarPlaca(placa);

    if (retorno.erroConfiguracao) {
      return resposta.status(501).json({ mensagem: retorno.mensagem });
    }

    if (retorno.erroProvider) {
      return resposta.status(502).json({ mensagem: retorno.mensagem });
    }

    const dados = retorno.dados || {};
    const marca = primeiroValor(dados, ["marca", "MARCA", "brand", "data.marca", "result.marca"]);
    const modelo = primeiroValor(dados, ["modelo", "MODELO", "marca_modelo", "data.modelo", "result.modelo"]);
    const ano = primeiroValor(dados, ["ano", "ANO", "ano_modelo", "anoModelo", "data.ano", "data.ano_modelo", "result.ano"]);
    const cor = primeiroValor(dados, ["cor", "COR", "data.cor", "result.cor"]);
    const municipio = primeiroValor(dados, ["municipio", "MUNICIPIO", "cidade", "data.municipio", "result.municipio"]);
    const uf = primeiroValor(dados, ["uf", "UF", "estado", "data.uf", "result.uf"]);

    return resposta.json({
      encontrado: true,
      dados: {
        modelo: marca && modelo && !modelo.toLowerCase().includes(marca.toLowerCase()) ? marca + " " + modelo : modelo,
        ano,
        observacoes: [
          cor ? "Cor: " + cor : "",
          municipio || uf ? "Local: " + [municipio, uf].filter(Boolean).join(" - ") : ""
        ].filter(Boolean).join("\n")
      },
      bruto: dados
    });
  } catch (erro) {
    console.error("Erro na consulta de placa:", erro.message);
    return resposta.status(502).json({ mensagem: "Nao foi possivel consultar a placa agora." });
  }
});

module.exports = router;
