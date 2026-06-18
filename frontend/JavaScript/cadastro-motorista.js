const urlApi = montarUrlApi("/motoristas");

function configurarFormularioMotorista() {
  const botaoSalvar = document.getElementById("botaoSalvarMotorista");
  const botaoLimpar = document.getElementById("botaoLimpar");
  const modal = document.getElementById("modalSucesso");
  const botaoOk = document.getElementById("botaoOkModal");

  botaoSalvar.addEventListener("click", async function (e) {
    e.preventDefault();

    if (typeof validarTransportadoraMasterParaCadastro === "function" && !validarTransportadoraMasterParaCadastro()) {
      return;
    }

    limparValidacoesCadastro();

    let dados = {
      nome: document.getElementById("nome").value.trim(),
      cpf: document.getElementById("cpf").value.trim(),
      telefone: document.getElementById("telefone").value.trim(),
      cnh: document.getElementById("cnh").value.trim(),
      status: document.getElementById("status").value.trim()
    };

    const campos = [];
    if (!dados.nome) campos.push({ campo: "nome", mensagem: "Informe o nome do motorista." });
    if (!dados.cpf) campos.push({ campo: "cpf", mensagem: "Informe o CPF do motorista." });
    if (!dados.telefone) campos.push({ campo: "telefone", mensagem: "Informe o telefone do motorista." });
    if (!dados.cnh) campos.push({ campo: "cnh", mensagem: "Informe a CNH do motorista." });
    if (!dados.status) campos.push({ campo: "status", mensagem: "Selecione o status do motorista." });

    if (campos.length > 0) {
      exibirModalErroCadastro("Preencha os campos obrigatorios.", campos);
      return;
    }

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
        exibirModalErroCadastro(erro.mensagem || "Erro ao cadastrar motorista.", erro.campos);
        return;
      }

      modal.classList.remove("oculto");
    } catch (error) {
      console.error("Erro geral:", error);
      exibirModalErroCadastro("Erro de conexao com a API.");
    }
  });

  botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "motoristas.html";
  });

  botaoLimpar.addEventListener("click", function () {
    document.getElementById("formularioMotorista").reset();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const usuario = exigirAdmin();
  if (!usuario) return;
  preencherInfoUsuario();
  configurarBotaoSair();
  marcarItemMenuLateralAtivo();
  configurarFormularioMotorista();
});
