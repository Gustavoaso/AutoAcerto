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

function normalizarChave(chave) {
  return String(chave || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
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

function primeiroValorRecursivo(valor, chaves, visitados = new Set()) {
  if (!valor || typeof valor !== "object") return "";
  if (visitados.has(valor)) return "";
  visitados.add(valor);

  const chavesNormalizadas = new Set(chaves.map(normalizarChave));

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = primeiroValorRecursivo(item, chaves, visitados);
      if (encontrado) return encontrado;
    }
    return "";
  }

  for (const [chave, conteudo] of Object.entries(valor)) {
    const valorSimples = conteudo === null || ["string", "number", "boolean"].includes(typeof conteudo);
    if (valorSimples && chavesNormalizadas.has(normalizarChave(chave)) && conteudo !== undefined && conteudo !== null && String(conteudo).trim() !== "") {
      return String(conteudo).trim();
    }
  }

  for (const conteudo of Object.values(valor)) {
    const encontrado = primeiroValorRecursivo(conteudo, chaves, visitados);
    if (encontrado) return encontrado;
  }

  return "";
}

function primeiroDadoVeiculo(dados, caminhos, chaves) {
  return primeiroValor(dados, caminhos) || primeiroValorRecursivo(dados, chaves || caminhos);
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
    const marca = primeiroDadoVeiculo(dados, ["marca", "MARCA", "brand", "data.marca", "result.marca"], ["marca", "brand", "fabricante"]);
    const modelo = primeiroDadoVeiculo(dados, ["modelo", "MODELO", "marca_modelo", "data.modelo", "result.modelo"], ["modelo", "model", "veiculo", "marcaModelo", "marca_modelo"]);
    const versao = primeiroDadoVeiculo(dados, ["versao", "VERSAO", "data.versao", "result.versao"], ["versao", "version", "submodelo"]);
    const ano = primeiroDadoVeiculo(dados, ["ano", "ANO", "ano_modelo", "anoModelo", "data.ano", "data.ano_modelo", "result.ano"], ["ano", "anoModelo", "ano_modelo", "anoFabricacao", "ano_fabricacao", "year", "modelYear"]);
    const cor = primeiroDadoVeiculo(dados, ["cor", "COR", "data.cor", "result.cor"], ["cor", "color"]);
    const municipio = primeiroDadoVeiculo(dados, ["municipio", "MUNICIPIO", "cidade", "data.municipio", "result.municipio"], ["municipio", "cidade", "city"]);
    const uf = primeiroDadoVeiculo(dados, ["uf", "UF", "estado", "data.uf", "result.uf"], ["uf", "estado", "state"]);
    const modeloCompleto = [marca, modelo, versao]
      .filter(Boolean)
      .filter((valor, indice, lista) => lista.findIndex((item) => item.toLowerCase() === valor.toLowerCase()) === indice)
      .join(" ")
      .trim();

    return resposta.json({
      encontrado: true,
      dados: {
        marca,
        modelo: modeloCompleto || modelo,
        versao,
        ano,
        cor,
        municipio,
        uf,
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
