const urlApiUsuarios = montarUrlApi("/usuarios");
const urlApiMotoristas = montarUrlApi("/motoristas");

const params = new URLSearchParams(window.location.search);
const idUsuario = params.get("id");

function exibirErro(texto) {
  const el = document.getElementById("msgErro");
  el.textContent = texto;
  el.style.display = texto ? "block" : "none";
  el.className = "mensagem-retorno" + (texto ? " erro" : "");
}

function alternarGrupoMotorista() {
  const perfil = document.getElementById("campoPerfil").value;
  const grupo = document.getElementById("grupoMotoristaVinculo");
  const select = document.getElementById("campoMotoristaId");
  const perfilMotorista = perfil === "motorista";

  grupo.style.display = perfilMotorista ? "" : "none";
  select.disabled = !perfilMotorista;
  if (!perfilMotorista) select.value = "";
}

async function carregarMotoristas() {
  const resposta = await fetch(urlApiMotoristas, { headers: cabecalhosAutenticados() });
  if (!resposta.ok) return;
  let lista = await resposta.json();
  if (typeof filtrarListaPorTransportadoraMaster === "function") {
    lista = filtrarListaPorTransportadoraMaster(lista);
  }
  const select = document.getElementById("campoMotoristaId");
  const atual = select.value;
  select.innerHTML = '<option value="">— Selecione —</option>';
  lista.forEach(function (m) {
    const op = document.createElement("option");
    op.value = String(m.id);
    op.textContent = m.nome + " (CPF: " + m.cpf + ")";
    select.appendChild(op);
  });
  if (atual) select.value = atual;
}

async function carregarUsuario() {
  if (!idUsuario) {
    window.location.href = "configuracoes.html?secao=usuarios";
    return;
  }
  const resposta = await fetch(urlApiUsuarios + "/" + idUsuario, { headers: cabecalhosAutenticados() });
  if (!resposta.ok) {
    window.location.href = "configuracoes.html?secao=usuarios";
    return;
  }
  const u = await resposta.json();
  if (u.perfil === "dono") {
    window.location.href = "configuracoes.html?secao=usuarios";
    return;
  }
  document.getElementById("campoNome").value = u.nome || "";
  document.getElementById("campoEmail").value = u.email || "";
  document.getElementById("campoPerfil").value = u.perfil || "motorista";
  document.getElementById("campoAtivo").checked = u.ativo !== false;
  document.getElementById("campoMotoristaId").value = u.motorista_id ? String(u.motorista_id) : "";
  alternarGrupoMotorista();
}

function iniciar() {
  const usuario = exigirAutenticacao();
  if (!usuario) return;
  if (!usuarioEhAdminOuDonoMaster(usuario)) {
    window.location.href = "viagens.html";
    return;
  }
  preencherInfoUsuario();
  configurarBotaoSair();
  marcarItemMenuLateralAtivo();

  document.addEventListener("autoacerto-master-transportadora", function () {
    carregarMotoristas()
      .then(carregarUsuario)
      .catch(function () {});
  });

  carregarMotoristas()
    .then(carregarUsuario)
    .catch(function () {
      exibirErro("Não foi possível carregar os dados.");
    });

  document.getElementById("botaoSalvar").addEventListener("click", async function () {
    exibirErro("");
    limparValidacoesCadastro();
    const nome = document.getElementById("campoNome").value.trim();
    const email = document.getElementById("campoEmail").value.trim();
    const perfil = document.getElementById("campoPerfil").value;
    const ativo = document.getElementById("campoAtivo").checked;
    const motoristaRaw = document.getElementById("campoMotoristaId").value;
    const motorista_id = perfil === "motorista" && motoristaRaw
      ? parseInt(motoristaRaw, 10)
      : null;

    if (!nome || !email || !perfil) {
      const campos = [];
      if (!nome) campos.push({ campo: "nome", mensagem: "Informe o nome do usuario." });
      if (!email) campos.push({ campo: "email", mensagem: "Informe o e-mail do usuario." });
      if (!perfil) campos.push({ campo: "perfil", mensagem: "Selecione o perfil." });
      exibirModalErroCadastro("Preencha os campos obrigatorios.", campos);
      return;
    }
    if (perfil === "motorista" && !motorista_id) {
      exibirModalErroCadastro("Selecione o motorista vinculado.", [
        { campo: "motorista_id", mensagem: "Selecione um motorista." }
      ]);
      return;
    }

    let corpo = { nome, email, perfil, ativo, motorista_id };
    if (typeof anexarTransportadoraIdSeMaster === "function") {
      corpo = anexarTransportadoraIdSeMaster(corpo);
    }

    try {
      const resposta = await fetch(urlApiUsuarios + "/" + idUsuario, {
        method: "PUT",
        headers: cabecalhosAutenticados(),
        body: JSON.stringify(corpo)
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        exibirModalErroCadastro(dados.mensagem || "Erro ao atualizar usuario.", dados.campos);
        return;
      }
      window.location.href = "configuracoes.html?secao=usuarios";
    } catch (e) {
      exibirModalErroCadastro("Erro de conexao com o servidor.");
    }
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
