const urlApi = montarUrlApi("/veiculos");

const botaoSalvar = document.getElementById("botaoSalvarVeiculo");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
const mensagemRetorno = document.getElementById("mensagemRetorno");

function exibirMensagem(texto, classe) {
  mensagemRetorno.textContent = texto;
  mensagemRetorno.className = "mensagem-retorno " + classe;
}

function configurarFormularioVeiculo() {
  botaoSalvar.addEventListener("click", async function () {
    limparValidacoesCadastro();

    const modelo = document.getElementById("modelo").value.trim();
    const placa = document.getElementById("placa").value.trim();
    const status = document.getElementById("status").value.trim();
    const anoCampo = document.getElementById("ano").value.trim();
    const observacoes = document.getElementById("observacoes").value.trim();

    if (!modelo || !placa || !status) {
      const camposPendentes = [];
      if (!modelo) camposPendentes.push({ campo: "modelo", mensagem: "Informe o modelo do veiculo." });
      if (!placa) camposPendentes.push({ campo: "placa", mensagem: "Informe a placa do veiculo." });
      if (!status) camposPendentes.push({ campo: "status", mensagem: "Selecione o status do veiculo." });

      exibirModalErroCadastro("Preencha os campos obrigatorios.", camposPendentes);
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
        exibirModalErroCadastro(erro.mensagem || "Erro ao cadastrar veiculo.", erro.campos);
        return;
      }

      mensagemRetorno.className = "mensagem-retorno";
      modal.classList.remove("oculto");
    } catch (error) {
      console.error(error);
      exibirModalErroCadastro("Erro de conexao com o servidor.");
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
