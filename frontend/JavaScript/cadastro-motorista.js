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

    let dados = {
      nome: document.getElementById("nome").value,
      cpf: document.getElementById("cpf").value,
      telefone: document.getElementById("telefone").value,
      cnh: document.getElementById("cnh").value,
      status: document.getElementById("status").value
    };

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
        const texto = await response.text();
        console.error("Erro da API:", texto);
        alert("Erro ao cadastrar motorista");
        return;
      }

      modal.classList.remove("oculto");
    } catch (error) {
      console.error("Erro geral:", error);
      alert("Erro de conexão com a API");
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
