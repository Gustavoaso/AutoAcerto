const express = require("express");
const { exigirAdmin } = require("../middlewares/autenticacao");

const router = express.Router();

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

function obterCredenciaisApiGratis() {
  return {
    bearerToken: obterEnv("APIGRATIS_BEARER_TOKEN", "API_GRATIS_BEARER_TOKEN"),
    deviceToken: obterEnv("APIGRATIS_DEVICE_TOKEN", "API_GRATIS_DEVICE_TOKEN")
  };
}

async function consultarPlaca(placa) {
  const credenciais = obterCredenciaisApiGratis();

  if (!credenciais.bearerToken || !credenciais.deviceToken) {
    return {
      erroConfiguracao: true,
      mensagem: "Consulta por placa ainda nao configurada. Configure APIGRATIS_BEARER_TOKEN e APIGRATIS_DEVICE_TOKEN no Railway."
    };
  }

  try {
    const sdk = await import("apigratis-sdk-nodejs");
    const createVehiclesApi = sdk.createVehiclesApi || (sdk.default && sdk.default.createVehiclesApi);

    if (typeof createVehiclesApi !== "function") {
      return {
        erroProvider: true,
        mensagem: "SDK da API Gratis nao disponibilizou o servico de veiculos."
      };
    }

    const vehiclesApi = createVehiclesApi({
      BearerToken: credenciais.bearerToken,
      DeviceToken: credenciais.deviceToken
    });

    const dados = await vehiclesApi.request("/dados", { placa });

    return { dados };
  } catch (erro) {
    return {
      erroProvider: true,
      mensagem: erro && erro.message ? String(erro.message) : "O provedor de consulta de placa retornou erro."
    };
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
