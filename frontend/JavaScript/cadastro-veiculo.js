const urlApi = montarUrlApi("/veiculos");
const urlConsultaPlaca = montarUrlApi("/integracoes/veiculos/placa");

const botaoSalvar = document.getElementById("botaoSalvarVeiculo");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
const mensagemRetorno = document.getElementById("mensagemRetorno");
let temporizadorConsultaPlaca = null;
let ultimaPlacaConsultada = "";
let modeloPreenchidoPorConsulta = "";
let anoPreenchidoPorConsulta = "";
let observacoesPreenchidasPorConsulta = "";

function exibirMensagem(texto, classe) {
  mensagemRetorno.textContent = texto;
  mensagemRetorno.className = "mensagem-retorno " + classe;
}

function limparPlacaConsulta(valor) {
  return String(valor || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function preencherCampoVeiculoAutomatico(id, valor, ultimoValorAutomatico, registrarValorAutomatico) {
  const campo = document.getElementById(id);
  if (!campo || !valor) return;

  const valorAtual = campo.value.trim();
  const podePreencher = !valorAtual || valorAtual === ultimoValorAutomatico;
  if (!podePreencher) return;

  campo.value = valor;
  registrarValorAutomatico(String(valor));
}

function registrarRetornoConsultaPlaca(placa, retorno) {
  console.groupCollapsed("Retorno APIGratis /integracoes/veiculos/placa " + placa);
  console.log("Resposta completa:", retorno);
  console.log("Payload bruto da API:", retorno && retorno.bruto);
  console.log("Dados normalizados para preenchimento:", retorno && retorno.dados);
  console.groupEnd();
}

function preencherDadosConsultaPlaca(retorno) {
  const dados = retorno && retorno.dados ? retorno.dados : {};

  preencherCampoVeiculoAutomatico("modelo", dados.modelo, modeloPreenchidoPorConsulta, function (valor) {
    modeloPreenchidoPorConsulta = valor;
  });
  preencherCampoVeiculoAutomatico("ano", dados.ano, anoPreenchidoPorConsulta, function (valor) {
    anoPreenchidoPorConsulta = valor;
  });
  preencherCampoVeiculoAutomatico("observacoes", dados.observacoes, observacoesPreenchidasPorConsulta, function (valor) {
    observacoesPreenchidasPorConsulta = valor;
  });
}

async function consultarPlacaVeiculo(opcoes) {
  const forcarConsulta = Boolean(opcoes && opcoes.forcar);
  const campoPlaca = document.getElementById("placa");
  const botao = document.getElementById("botaoConsultarPlaca");
  const placa = limparPlacaConsulta(campoPlaca ? campoPlaca.value : "");

  if (placa.length !== 7) {
    exibirMensagem("Informe uma placa completa para buscar os dados.", "erro");
    return;
  }

  if (!forcarConsulta && placa === ultimaPlacaConsultada) return;

  if (botao) {
    botao.disabled = true;
    botao.textContent = "Buscando...";
  }

  try {
    const resposta = await fetch(urlConsultaPlaca + "/" + encodeURIComponent(placa), {
      headers: cabecalhosAutenticados()
    });
    const retorno = await resposta.json();
    registrarRetornoConsultaPlaca(placa, retorno);

    if (!resposta.ok) {
      exibirMensagem(retorno.mensagem || "Nao foi possivel consultar a placa.", "erro");
      return;
    }

    ultimaPlacaConsultada = placa;
    preencherDadosConsultaPlaca(retorno);
    exibirMensagem("Dados encontrados. Confira as informacoes antes de salvar.", "sucesso");
  } catch (erro) {
    exibirMensagem("Nao foi possivel conectar ao servico de consulta de placa.", "erro");
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.textContent = "Buscar";
    }
  }
}

function configurarFormularioVeiculo() {
  const botaoConsultarPlaca = document.getElementById("botaoConsultarPlaca");
  const campoPlaca = document.getElementById("placa");

  if (botaoConsultarPlaca) {
    botaoConsultarPlaca.addEventListener("click", function () {
      consultarPlacaVeiculo({ forcar: true });
    });
  }

  if (campoPlaca) {
    campoPlaca.addEventListener("input", function () {
      const placa = limparPlacaConsulta(campoPlaca.value);
      if (temporizadorConsultaPlaca) clearTimeout(temporizadorConsultaPlaca);

      if (placa.length !== 7) {
        ultimaPlacaConsultada = "";
        return;
      }

      if (placa === ultimaPlacaConsultada) return;

      temporizadorConsultaPlaca = setTimeout(function () {
        consultarPlacaVeiculo();
      }, 700);
    });

    campoPlaca.addEventListener("keydown", function (evento) {
      if (evento.key === "Enter") {
        evento.preventDefault();
        consultarPlacaVeiculo({ forcar: true });
      }
    });
    campoPlaca.addEventListener("blur", function () {
      if (limparPlacaConsulta(campoPlaca.value).length === 7) {
        consultarPlacaVeiculo();
      }
    });
  }

  botaoSalvar.addEventListener("click", async function () {
    const modelo = document.getElementById("modelo").value.trim();
    const placa = document.getElementById("placa").value.trim();
    const status = document.getElementById("status").value.trim();
    const anoCampo = document.getElementById("ano").value.trim();
    const observacoes = document.getElementById("observacoes").value.trim();

    if (!modelo || !placa || !status) {
      const camposPendentes = [];
      if (!modelo) camposPendentes.push("modelo");
      if (!placa) camposPendentes.push("placa");
      if (!status) camposPendentes.push("status");

      exibirMensagem("Preencha os campos obrigatorios: " + camposPendentes.join(", ") + ".", "erro");
      return;
    }

    if (typeof validarTransportadoraMasterParaCadastro === "function" && !validarTransportadoraMasterParaCadastro()) {
      return;
    }

    let dados = { modelo, placa, status };
    if (anoCampo !== "") dados.ano = parseInt(anoCampo, 10);
    if (observacoes !== "") dados.observacoes = observacoes;

    if (typeof anexarTransportadoraIdSeMaster === "function") {
      dados = anexarTransportadoraIdSeMaster(dados);
    }

    try {
      const response = await fetch(urlApi, {
        method: "POST",
        headers: cabecalhosAutenticados(),
        body: JSON.stringify(dados)
      });

      if (!response.ok) {
        const erro = await response.json();
        exibirMensagem(erro.mensagem || "Erro ao cadastrar veículo.", "erro");
        return;
      }

      mensagemRetorno.className = "mensagem-retorno";
      modal.classList.remove("oculto");
    } catch (error) {
      console.error(error);
      exibirMensagem("Erro de conexão com o servidor.", "erro");
    }
  });

  botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "veiculos.html";
  });

  botaoLimpar.addEventListener("click", function () {
    document.getElementById("modelo").value = "";
    document.getElementById("placa").value = "";
    document.getElementById("status").value = "";
    document.getElementById("ano").value = "";
    document.getElementById("observacoes").value = "";
    mensagemRetorno.className = "mensagem-retorno";
    ultimaPlacaConsultada = "";
    modeloPreenchidoPorConsulta = "";
    anoPreenchidoPorConsulta = "";
    observacoesPreenchidasPorConsulta = "";
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const usuario = exigirAdmin();
  if (!usuario) return;
  preencherInfoUsuario();
  configurarBotaoSair();
  marcarItemMenuLateralAtivo();
  configurarFormularioVeiculo();
});
