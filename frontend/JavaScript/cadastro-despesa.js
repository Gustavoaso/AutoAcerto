const urlApiDespesas = "http://localhost:3000/despesas";
const urlApiViagens = "http://localhost:3000/viagens";

const botaoSalvar = document.getElementById("botaoSalvarDespesa");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

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
    selectViagem.innerHTML = "";

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

function configurarFormularioDespesa() {
  botaoSalvar.addEventListener("click", async function (e) {
    e.preventDefault();

    if (typeof validarTransportadoraMasterParaCadastro === "function" && !validarTransportadoraMasterParaCadastro({
      mensagemErro: "Selecione a transportadora no topo para filtrar as viagens disponíveis neste cadastro."
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
      viagemId: document.getElementById("viagemId").value,
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
    document.getElementById("viagemId").value = "";
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
  });

  configurarFormularioDespesa();
  carregarViagens();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaCadastroDespesa);
