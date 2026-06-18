const urlApi = montarUrlApi("/veiculos");

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
    exibirModalErroCadastro("Veiculo nao encontrado.");
    window.location.href = "veiculos.html";
    return;
  }

  try {
    const response = await fetch(urlApi + "/" + idVeiculo,{ headers: cabecalhosAutenticados() });

    if (!response.ok) {
      exibirModalErroCadastro("Veiculo nao encontrado.");
      window.location.href = "veiculos.html";
      return;
    }

    const veiculo = await response.json();

    document.getElementById("modelo").value = veiculo.modelo || "";
    document.getElementById("placa").value = veiculo.placa || "";
    document.getElementById("status").value = veiculo.status || "";
    document.getElementById("ano").value = veiculo.ano || "";
    document.getElementById("observacoes").value = veiculo.observacoes || "";

    if (window.AutoAcertoMascaras) {
      const p = document.getElementById("placa");
      p.value = window.AutoAcertoMascaras.aplicarPlaca(p.value);
    }
  } catch (error) {
    console.error("Erro ao carregar veículo:", error);
    exibirModalErroCadastro("Erro de conexao com o servidor.");
  }
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function () {
  limparValidacoesCadastro();

  const modelo = document.getElementById("modelo").value.trim();
  const placa = document.getElementById("placa").value.trim();
  const status = document.getElementById("status").value;
  const ano = document.getElementById("ano").value || null;
  const observacoes = document.getElementById("observacoes").value.trim();

  if (!modelo || !placa || !status) {
    const campos = [];
    if (!modelo) campos.push({ campo: "modelo", mensagem: "Informe o modelo do veiculo." });
    if (!placa) campos.push({ campo: "placa", mensagem: "Informe a placa do veiculo." });
    if (!status) campos.push({ campo: "status", mensagem: "Selecione o status do veiculo." });
    exibirModalErroCadastro("Preencha os campos obrigatorios.", campos);
    return;
  }

  const dados = { modelo, placa, status, ano, observacoes };

  try {
    const response = await fetch(urlApi + "/" + idVeiculo, {
      method: "PUT",
      headers: cabecalhosAutenticados(),
      body: JSON.stringify(dados)
    });

    if (!response.ok) {
      const erro = await response.json();
      exibirModalErroCadastro(erro.mensagem || "Erro ao atualizar veiculo.", erro.campos);
      return;
    }

    mensagemRetorno.className = "mensagem-retorno";
    modal.classList.remove("oculto");
  } catch (error) {
    console.error("Erro:", error);
    exibirModalErroCadastro("Erro de conexao com o servidor.");
  }
});

botaoOk.addEventListener("click", function () {
  window.location.href = "veiculos.html";
});

document.getElementById("botaoCancelar").addEventListener("click", function () {
  window.location.href = "veiculos.html";
});

carregarVeiculo();
