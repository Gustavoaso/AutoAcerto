const urlApi = "http://localhost:3000/veiculos";

const params = new URLSearchParams(window.location.search);
const idVeiculo = params.get("id");

const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
const mensagemRetorno = document.getElementById("mensagemRetorno");

function exibirMensagem(texto, classe) {
  mensagemRetorno.textContent = texto;
  mensagemRetorno.className = "mensagem-retorno " + classe;
}

async function carregarVeiculo() {
  if (!idVeiculo) {
    alert("Veículo não encontrado.");
    window.location.href = "veiculos.html";
    return;
  }

  try {
    const response = await fetch(urlApi + "/" + idVeiculo);

    if (!response.ok) {
      alert("Veículo não encontrado.");
      window.location.href = "veiculos.html";
      return;
    }

    const veiculo = await response.json();

    document.getElementById("modelo").value      = veiculo.modelo || "";
    document.getElementById("placa").value       = veiculo.placa || "";
    document.getElementById("proprietario").value = veiculo.proprietario || "";
    document.getElementById("status").value      = veiculo.status || "";
    document.getElementById("ano").value         = veiculo.ano || "";
    document.getElementById("observacoes").value = veiculo.observacoes || "";

  } catch (error) {
    console.error("Erro ao carregar veículo:", error);
    alert("Erro de conexão com o servidor.");
  }
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function () {
  const modelo       = document.getElementById("modelo").value.trim();
  const placa        = document.getElementById("placa").value.trim();
  const proprietario = document.getElementById("proprietario").value.trim();
  const status       = document.getElementById("status").value;
  const ano          = document.getElementById("ano").value || null;
  const observacoes  = document.getElementById("observacoes").value.trim();

  if (!modelo || !placa || !proprietario || !status) {
    exibirMensagem("Preencha todos os campos obrigatórios.", "erro");
    return;
  }

  const dados = { modelo, placa, proprietario, status, ano, observacoes };

  try {
    const response = await fetch(urlApi + "/" + idVeiculo, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });

    if (!response.ok) {
      const erro = await response.json();
      exibirMensagem(erro.mensagem || "Erro ao atualizar veículo.", "erro");
      return;
    }

    mensagemRetorno.className = "mensagem-retorno";
    modal.classList.remove("oculto");

  } catch (error) {
    console.error("Erro:", error);
    exibirMensagem("Erro de conexão com o servidor.", "erro");
  }
});

botaoOk.addEventListener("click", function () {
  window.location.href = "veiculos.html";
});

document.getElementById("botaoCancelar").addEventListener("click", function () {
  window.location.href = "veiculos.html";
});

document.querySelector(".botao-sair").addEventListener("click", function () {
  alert("Saindo do sistema...");
});

// Máscara de placa: limita a 7 alfanum + hífen automático
document.getElementById("placa").addEventListener("input", function (e) {
  let valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (valor.length > 7) valor = valor.slice(0, 7);
  if (valor.length > 3) {
    valor = valor.slice(0, 3) + "-" + valor.slice(3);
  }
  e.target.value = valor;
});

carregarVeiculo();