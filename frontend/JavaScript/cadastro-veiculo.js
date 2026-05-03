const urlApi = "http://localhost:3000/veiculos";

const botaoSalvar = document.getElementById("botaoSalvarVeiculo");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
const mensagemRetorno = document.getElementById("mensagemRetorno");

function exibirMensagem(texto, classe) {
  mensagemRetorno.textContent = texto;
  mensagemRetorno.className = "mensagem-retorno " + classe;
}

botaoSalvar.addEventListener("click", async function () {
  const modelo = document.getElementById("modelo").value.trim();
  const placa = document.getElementById("placa").value.trim();
  const proprietario = document.getElementById("proprietario").value.trim();
  const status = document.getElementById("status").value;
  const observacoes = document.getElementById("observacoes").value.trim();

  const dados = { modelo, placa, proprietario, status, observacoes };

  try {
    const response = await fetch(urlApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  document.getElementById("proprietario").value = "";
  document.getElementById("status").value = "";
  document.getElementById("observacoes").value = "";
  mensagemRetorno.className = "mensagem-retorno";
});

document.querySelector(".botao-sair").addEventListener("click", function () {
  alert("Saindo do sistema...");
});

// Máscara de placa: aceita padrão antigo (AAA-0000) e Mercosul (AAA0A00)
// Limita a 7 caracteres alfanuméricos + hífen automático na posição 4
document.getElementById("placa").addEventListener("input", function (e) {
  let valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (valor.length > 7) valor = valor.slice(0, 7);
  if (valor.length > 3) {
    valor = valor.slice(0, 3) + "-" + valor.slice(3);
  }
  e.target.value = valor;
});