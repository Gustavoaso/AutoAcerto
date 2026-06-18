const urlApiUsuarios = montarUrlApi("/usuarios");
const urlApiMotoristas = montarUrlApi("/motoristas");

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
  select.innerHTML = '<option value="">— Selecione —</option>';
  lista.forEach(function (m) {
    const op = document.createElement("option");
    op.value = String(m.id);
    op.textContent = m.nome + " (CPF: " + m.cpf + ")";
    select.appendChild(op);
  });
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

  document.getElementById("campoPerfil").addEventListener("change", alternarGrupoMotorista);
  alternarGrupoMotorista();

  document.addEventListener("autoacerto-master-transportadora", function () {
    carregarMotoristas().catch(function () {});
  });
  carregarMotoristas().catch(function () {});

  document.getElementById("botaoSalvar").addEventListener("click", async function () {
    exibirErro("");
    limparValidacoesCadastro();
    const nome = document.getElementById("campoNome").value.trim();
    const email = document.getElementById("campoEmail").value.trim();
    const perfil = document.getElementById("campoPerfil").value;
    const senha = document.getElementById("campoSenha").value;
    const ativo = document.getElementById("campoAtivo").checked;
    const motoristaRaw = document.getElementById("campoMotoristaId").value;
    const motorista_id = perfil === "motorista" && motoristaRaw
      ? parseInt(motoristaRaw, 10)
      : null;

    if (!nome || !email || !perfil || !senha) {
      const campos = [];
      if (!nome) campos.push({ campo: "nome", mensagem: "Informe o nome do usuario." });
      if (!email) campos.push({ campo: "email", mensagem: "Informe o e-mail do usuario." });
      if (!perfil) campos.push({ campo: "perfil", mensagem: "Selecione o perfil." });
      if (!senha) campos.push({ campo: "senha", mensagem: "Informe a senha." });
      exibirModalErroCadastro("Preencha os campos obrigatorios.", campos);
      return;
    }
    if (senha.length < 8) {
      exibirModalErroCadastro("A senha deve ter pelo menos 8 caracteres.", [
        { campo: "senha", mensagem: "Informe uma senha com pelo menos 8 caracteres." }
      ]);
      return;
    }
    if (perfil === "motorista" && !motorista_id) {
      exibirModalErroCadastro("Selecione o motorista vinculado.", [
        { campo: "motorista_id", mensagem: "Selecione um motorista." }
      ]);
      return;
    }

    if (usuario.perfil === "dono") {
      if (typeof validarTransportadoraMasterParaCadastro === "function") {
        if (!validarTransportadoraMasterParaCadastro({ mensagemErro: "Selecione a transportadora no topo para vincular o novo usuário." })) {
          return;
        }
      } else if (!obterTransportadoraIdParaCadastroMaster || !obterTransportadoraIdParaCadastroMaster()) {
        exibirErro("Selecione a transportadora no topo para vincular o novo usuário.");
        return;
      }
    }

    let corpo = { nome, email, senha, perfil, ativo, motorista_id };
    if (typeof anexarTransportadoraIdSeMaster === "function") {
      corpo = anexarTransportadoraIdSeMaster(corpo);
    }

    try {
      const resposta = await fetch(urlApiUsuarios, {
        method: "POST",
        headers: cabecalhosAutenticados(),
        body: JSON.stringify(corpo)
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        exibirModalErroCadastro(dados.mensagem || "Erro ao criar usuario.", dados.campos);
        return;
      }
      window.location.href = "configuracoes.html?secao=usuarios";
    } catch (e) {
      exibirModalErroCadastro("Erro de conexao com o servidor.");
    }
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
