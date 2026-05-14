const urlApiDespesas = montarUrlApi("/despesas");
const urlApiViagens = montarUrlApi("/viagens");
const urlApiVeiculos = montarUrlApi("/veiculos");

const botaoSalvar = document.getElementById("botaoSalvarDespesa");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
let tipoDespesaSelecionado = "viagem";

async function carregarViagens() {
  try {
    const response = await fetch(urlApiViagens, {
      headers: cabecalhosAutenticados()
    });

    if (!response.ok) return;

    let viagens = await response.json();
    if (typeof filtrarListaPorTransportadoraMaster === "function") {
      viagens = filtrarListaPorTransportadoraMaster(viagens);
    }

    const selectViagem = document.getElementById("viagemId");
    selectViagem.innerHTML = '<option value="">Selecione</option>';

    viagens.forEach(function (viagem) {
      const opcao = document.createElement("option");
      opcao.value = viagem.id;
      opcao.textContent = viagem.origem + " -> " + viagem.destino;
      selectViagem.appendChild(opcao);
    });
  } catch (erro) {
    console.error("Erro ao carregar viagens:", erro);
  }
}

async function carregarVeiculos() {
  try {
    const response = await fetch(urlApiVeiculos, {
      headers: cabecalhosAutenticados()
    });

    if (!response.ok) return;

    let veiculos = await response.json();
    if (typeof filtrarListaPorTransportadoraMaster === "function") {
      veiculos = filtrarListaPorTransportadoraMaster(veiculos);
    }

    const selectVeiculo = document.getElementById("veiculoId");
    selectVeiculo.innerHTML = '<option value="">Selecione</option>';

    veiculos
      .filter(function (veiculo) { return veiculo.status === "ativo"; })
      .forEach(function (veiculo) {
        const opcao = document.createElement("option");
        opcao.value = veiculo.id;
        opcao.textContent = veiculo.modelo + " - " + veiculo.placa;
        selectVeiculo.appendChild(opcao);
      });
  } catch (erro) {
    console.error("Erro ao carregar veiculos:", erro);
  }
}

function alternarTipoDespesa(tipo) {
  tipoDespesaSelecionado = tipo;

  const despesaViagem = tipo === "viagem";
  document.getElementById("grupoViagemDespesa").classList.toggle("oculto", !despesaViagem);
  document.getElementById("grupoVeiculoDespesa").classList.toggle("oculto", despesaViagem);
  document.getElementById("viagemId").required = despesaViagem;
  document.getElementById("veiculoId").required = !despesaViagem;

  if (despesaViagem) {
    document.getElementById("veiculoId").value = "";
  } else {
    document.getElementById("viagemId").value = "";
  }

  document.querySelectorAll("[data-tipo-despesa]").forEach(function (botao) {
    botao.classList.toggle("ativo", botao.dataset.tipoDespesa === tipo);
  });
}

function configurarTipoDespesa() {
  document.querySelectorAll("[data-tipo-despesa]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      alternarTipoDespesa(botao.dataset.tipoDespesa);
    });
  });
}

function configurarFormularioDespesa() {
  botaoSalvar.addEventListener("click", async function (e) {
    e.preventDefault();

    if (typeof validarTransportadoraMasterParaCadastro === "function" && !validarTransportadoraMasterParaCadastro({
      mensagemErro: "Selecione a transportadora no topo para definir o escopo deste cadastro."
    })) {
      return;
    }

    const valorNum = window.AutoAcertoMascaras
      ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valor").value)
      : parseFloat(document.getElementById("valor").value);
    if (valorNum === undefined || isNaN(valorNum) || valorNum <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    const dados = {
      tipoDespesa: tipoDespesaSelecionado,
      viagemId: tipoDespesaSelecionado === "viagem" ? document.getElementById("viagemId").value : null,
      veiculoId: tipoDespesaSelecionado === "veiculo" ? document.getElementById("veiculoId").value : null,
      descricao: document.getElementById("descricao").value,
      categoria: document.getElementById("categoria").value,
      dataDespesa: document.getElementById("dataDespesa").value,
      valor: valorNum
    };

    try {
      const response = await fetch(urlApiDespesas, {
        method: "POST",
        headers: cabecalhosAutenticados(),
        body: JSON.stringify(dados)
      });

      if (!response.ok) {
        const erro = await response.json();
        alert(erro.mensagem || "Erro ao cadastrar despesa.");
        return;
      }

      modal.classList.remove("oculto");
    } catch (erro) {
      console.error("Erro geral:", erro);
      alert("Erro de conexao com a API.");
    }
  });

  botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "despesas.html";
  });

  botaoLimpar.addEventListener("click", function () {
    alternarTipoDespesa("viagem");
    document.getElementById("viagemId").value = "";
    document.getElementById("veiculoId").value = "";
    document.getElementById("descricao").value = "";
    document.getElementById("categoria").value = "";
    document.getElementById("dataDespesa").value = "";
    document.getElementById("valor").value = "";
  });
}

function iniciarPaginaCadastroDespesa() {
  const usuario = exigirAdmin();
  if (!usuario) return;
  preencherInfoUsuario();
  configurarBotaoSair();
  marcarItemMenuLateralAtivo();

  document.addEventListener("autoacerto-master-transportadora", function () {
    carregarViagens();
    carregarVeiculos();
  });

  configurarTipoDespesa();
  configurarFormularioDespesa();
  carregarViagens();
  carregarVeiculos();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaCadastroDespesa);
