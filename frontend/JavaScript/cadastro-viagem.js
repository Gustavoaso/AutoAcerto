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
  const kmFinal = document.getElementById("kmFinal");
  const dataSaida = document.getElementById("dataSaida").value;
  const dataChegada = document.getElementById("dataChegada").value;
  const statusCalculado = calcularStatusViagem(dataSaida, dataChegada);

  Array.from(status.options).forEach(function (opcao) {
    opcao.disabled = false;
  });

  if (statusCalculado) {
    status.value = statusCalculado;

    Array.from(status.options).forEach(function (opcao) {
      const opcaoOposta =
        (statusCalculado === "em andamento" && opcao.value === "finalizada") ||
        (statusCalculado === "finalizada" && opcao.value === "em andamento");

      if (opcaoOposta) {
        opcao.disabled = true;
      }
    });
  }

  if (kmFinal) {
    const viagemEmAndamento = statusCalculado === "em andamento";
    kmFinal.disabled = viagemEmAndamento;
    kmFinal.required = !viagemEmAndamento;

    if (viagemEmAndamento) {
      kmFinal.value = "";
    }
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
    limparValidacoesCadastro();

    if (typeof validarTransportadoraMasterParaCadastro === "function" && !validarTransportadoraMasterParaCadastro()) {
      return;
    }

    const camposObrigatorios = [];
    if (!document.getElementById("origem").value.trim()) camposObrigatorios.push({ campo: "origem", mensagem: "Informe a origem da viagem." });
    if (!document.getElementById("destino").value.trim()) camposObrigatorios.push({ campo: "destino", mensagem: "Informe o destino da viagem." });
    if (!document.getElementById("motoristaId").value) camposObrigatorios.push({ campo: "motoristaId", mensagem: "Selecione o motorista." });
    if (!document.getElementById("veiculoId").value) camposObrigatorios.push({ campo: "veiculoId", mensagem: "Selecione o veiculo." });
    if (!document.getElementById("dataSaida").value) camposObrigatorios.push({ campo: "dataSaida", mensagem: "Informe a data de saida." });
    if (!document.getElementById("dataChegada").value) camposObrigatorios.push({ campo: "dataChegada", mensagem: "Informe a data de chegada." });
    if (!document.getElementById("valorFrete").value.trim()) camposObrigatorios.push({ campo: "valorFrete", mensagem: "Informe o valor do frete." });
    if (!document.getElementById("kmInicial").value.trim()) camposObrigatorios.push({ campo: "kmInicial", mensagem: "Informe o KM inicial." });

    if (camposObrigatorios.length > 0) {
      exibirModalErroCadastro("Preencha os campos obrigatorios.", camposObrigatorios);
      return;
    }

    const valorFreteNum = window.AutoAcertoMascaras
      ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valorFrete").value)
      : parseFloat(document.getElementById("valorFrete").value);
    if (isNaN(valorFreteNum) || valorFreteNum <= 0) {
      exibirModalErroCadastro("Informe um valor de frete valido.", [
        { campo: "valorFrete", mensagem: "Informe um valor maior que zero." }
      ]);
      return;
    }

    const kmInicialNum = parseInt(document.getElementById("kmInicial").value, 10);
    const kmFinalValor = document.getElementById("kmFinal").value;
    const kmFinalNum = kmFinalValor === "" ? null : parseInt(kmFinalValor, 10);

    if (isNaN(kmInicialNum) || kmInicialNum < 0) {
      exibirModalErroCadastro("Informe os KM da viagem corretamente.", [
        { campo: "kmInicial", mensagem: "Informe um KM inicial maior ou igual a zero." }
      ]);
      return;
    }

    if (kmFinalNum !== null && kmFinalNum < kmInicialNum) {
      exibirModalErroCadastro("O KM final nao pode ser menor que o KM inicial.", [
        { campo: "kmFinal", mensagem: "Informe um KM final maior ou igual ao inicial." }
      ]);
      return;
    }

    const dataSaida = document.getElementById("dataSaida").value;
    const dataChegada = document.getElementById("dataChegada").value;
    if (dataSaida && dataChegada && dataChegada < dataSaida) {
      exibirModalErroCadastro("A data de chegada nao pode ser menor que a data de saida.", [
        { campo: "dataChegada", mensagem: "Informe uma data igual ou posterior a saida." }
      ]);
      return;
    }
    const statusCalculado = calcularStatusViagem(dataSaida, dataChegada);

    if (statusCalculado === "finalizada" && (kmFinalNum === null || isNaN(kmFinalNum) || kmFinalNum < 0)) {
      exibirModalErroCadastro("Informe o KM final da viagem.", [
        { campo: "kmFinal", mensagem: "Informe o KM final." }
      ]);
      return;
    }

    let dados = {
      origem: document.getElementById("origem").value,
      destino: document.getElementById("destino").value,
      motoristaId: document.getElementById("motoristaId").value,
      veiculoId: document.getElementById("veiculoId").value,
      dataSaida: dataSaida,
      dataChegada: dataChegada,
      valorFrete: valorFreteNum,
      kmInicial: kmInicialNum,
      kmFinal: statusCalculado === "em andamento" ? null : kmFinalNum,
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
        exibirModalErroCadastro(erro.mensagem || "Erro ao cadastrar viagem.", erro.campos);
        return;
      }

      modal.classList.remove("oculto");
    } catch (erro) {
      console.error("Erro geral:", erro);
      exibirModalErroCadastro("Erro de conexao com a API.");
    }
  });

  botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "viagens.html";
  });

  botaoLimpar.addEventListener("click", function () {
    document.getElementById("formularioViagem").reset();
    atualizarStatusPorDatas();
  });

  document.getElementById("dataSaida").addEventListener("change", atualizarStatusPorDatas);
  document.getElementById("dataChegada").addEventListener("change", atualizarStatusPorDatas);
  atualizarStatusPorDatas();
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
