const urlApiViagens = montarUrlApi("/viagens");
const urlApiMotoristas = montarUrlApi("/motoristas");
const urlApiVeiculos = montarUrlApi("/veiculos");

const botaoSalvar = document.getElementById("botaoSalvarViagem");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

function obterDataHojeCampo() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

function calcularStatusViagem(dataSaida, dataChegada) {
  if (!dataSaida || !dataChegada) return "";
  return dataChegada >= obterDataHojeCampo() ? "em andamento" : "finalizada";
}

function atualizarStatusPorDatas() {
  const status = document.getElementById("status");
  const dataSaida = document.getElementById("dataSaida").value;
  const dataChegada = document.getElementById("dataChegada").value;
  const statusCalculado = calcularStatusViagem(dataSaida, dataChegada);

  if (statusCalculado) {
    status.value = statusCalculado;
  }
}

async function carregarMotoristas() {
  try {
    const response = await fetch(urlApiMotoristas, { headers: cabecalhosAutenticados() });

    if (!response.ok) return;

    let motoristas = await response.json();
    if (typeof filtrarListaPorTransportadoraMaster === "function") {
      motoristas = filtrarListaPorTransportadoraMaster(motoristas);
    }

    const selectMotorista = document.getElementById("motoristaId");
    selectMotorista.innerHTML = "";

    motoristas
      .filter(function (m) { return m.status === "ativo"; })
      .forEach(function (motorista) {
        const opcao = document.createElement("option");
        opcao.value = motorista.id;
        opcao.textContent = motorista.nome;
        selectMotorista.appendChild(opcao);
      });
  } catch (erro) {
    console.error("Erro ao carregar motoristas:", erro);
  }
}

async function carregarVeiculos() {
  try {
    const response = await fetch(urlApiVeiculos, { headers: cabecalhosAutenticados() });

    if (!response.ok) return;

    let veiculos = await response.json();
    if (typeof filtrarListaPorTransportadoraMaster === "function") {
      veiculos = filtrarListaPorTransportadoraMaster(veiculos);
    }

    const selectVeiculo = document.getElementById("veiculoId");
    selectVeiculo.innerHTML = "";

    veiculos
      .filter(function (v) { return v.status === "ativo"; })
      .forEach(function (veiculo) {
        const opcao = document.createElement("option");
        opcao.value = veiculo.id;
        opcao.textContent = veiculo.modelo + " — " + veiculo.placa;
        selectVeiculo.appendChild(opcao);
      });
  } catch (erro) {
    console.error("Erro ao carregar veículos:", erro);
  }
}

function configurarFormularioViagem() {
  botaoSalvar.addEventListener("click", async function (e) {
    e.preventDefault();

    if (typeof validarTransportadoraMasterParaCadastro === "function" && !validarTransportadoraMasterParaCadastro()) {
      return;
    }

    const valorFreteNum = window.AutoAcertoMascaras
      ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valorFrete").value)
      : parseFloat(document.getElementById("valorFrete").value);
    if (isNaN(valorFreteNum) || valorFreteNum <= 0) {
      alert("Informe um valor de frete válido.");
      return;
    }

    const kmInicialNum = parseInt(document.getElementById("kmInicial").value, 10);
    const kmFinalNum = parseInt(document.getElementById("kmFinal").value, 10);

    if (isNaN(kmInicialNum) || kmInicialNum < 0 || isNaN(kmFinalNum) || kmFinalNum < 0) {
      alert("Informe os KM da viagem corretamente.");
      return;
    }

    if (kmFinalNum < kmInicialNum) {
      alert("O KM final não pode ser menor que o KM inicial.");
      return;
    }

    const dataSaida = document.getElementById("dataSaida").value;
    const dataChegada = document.getElementById("dataChegada").value;
    if (dataSaida && dataChegada && dataChegada < dataSaida) {
      alert("A data de chegada nao pode ser menor que a data de saida.");
      return;
    }
    const statusCalculado = calcularStatusViagem(dataSaida, dataChegada);

    let dados = {
      origem: document.getElementById("origem").value,
      destino: document.getElementById("destino").value,
      motoristaId: document.getElementById("motoristaId").value,
      veiculoId: document.getElementById("veiculoId").value,
      dataSaida: dataSaida,
      dataChegada: dataChegada,
      valorFrete: valorFreteNum,
      kmInicial: kmInicialNum,
      kmFinal: kmFinalNum,
      status: statusCalculado || document.getElementById("status").value,
      observacoes: document.getElementById("observacoes").value
    };

    if (typeof anexarTransportadoraIdSeMaster === "function") {
      dados = anexarTransportadoraIdSeMaster(dados);
    }

    try {
      const response = await fetch(urlApiViagens, {
        method: "POST",
        headers: cabecalhosAutenticados(),
        body: JSON.stringify(dados)
      });

      if (!response.ok) {
        const erro = await response.json();
        alert(erro.mensagem || "Erro ao cadastrar viagem.");
        return;
      }

      modal.classList.remove("oculto");
    } catch (erro) {
      console.error("Erro geral:", erro);
      alert("Erro de conexão com a API.");
    }
  });

  botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "viagens.html";
  });

  botaoLimpar.addEventListener("click", function () {
    document.getElementById("formularioViagem").reset();
  });

  document.getElementById("dataSaida").addEventListener("change", atualizarStatusPorDatas);
  document.getElementById("dataChegada").addEventListener("change", atualizarStatusPorDatas);
}

function iniciarPaginaCadastroViagem() {
  const usuario = exigirAdmin();
  if (!usuario) return;
  preencherInfoUsuario();
  configurarBotaoSair();
  marcarItemMenuLateralAtivo();

  document.addEventListener("autoacerto-master-transportadora", function () {
    carregarMotoristas();
    carregarVeiculos();
  });

  configurarFormularioViagem();
  if (window.AutoAcertoCidades) {
    window.AutoAcertoCidades.configurar(["origem", "destino"]);
  }
  carregarMotoristas();
  carregarVeiculos();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaCadastroViagem);
