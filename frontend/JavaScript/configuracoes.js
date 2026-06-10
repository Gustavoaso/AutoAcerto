// =============================================================
// AUTOACERTO - CONFIGURAÇÕES
// Gerenciamento de perfil, usuários (admin) e segurança.
// =============================================================

const urlApiUsuarios = montarUrlApi("/usuarios");
const urlApiSenha = montarUrlApi("/usuarios/senha");

let listaUsuarios = [];
let usuariosVisiveis = [];
let exclusaoUsuarios = null;

// -------------------------------------------------------
// SESSÃO
// -------------------------------------------------------

function iniciarSessaoConfiguracoes() {
  const usuario = exigirAutenticacao();
  if (!usuario) return;

  preencherInfoUsuario();
  marcarItemMenuLateralAtivo();
  configurarBotaoSair();
  configurarMenuLateral();
  configurarFormularioPerfil(usuario);
  configurarFormularioSenha();
  if (usuarioEhAdminOuDonoMaster(usuario)) {
    configurarExclusaoUsuarios();
  }

  if (usuarioEhAdminOuDonoMaster(usuario)) {
    document.querySelectorAll("[data-apenas-admin]").forEach(function (el) {
      el.style.removeProperty("display");
    });
    carregarUsuarios();
  }

  const qs = new URLSearchParams(window.location.search);
  if (qs.get("secao") === "usuarios" && usuarioEhAdminOuDonoMaster(usuario)) {
    ativarSecao("secao-usuarios");
  } else {
    ativarSecao("secao-perfil");
  }
}

// -------------------------------------------------------
// MENU LATERAL
// -------------------------------------------------------

function configurarMenuLateral() {
  document.querySelectorAll(".item-menu-config").forEach(function (item) {
    item.addEventListener("click", function () {
      const alvo = item.getAttribute("data-secao");
      ativarSecao(alvo);
    });
  });
}

function ativarSecao(idSecao) {
  document.querySelectorAll(".item-menu-config").forEach(function (item) {
    item.classList.toggle("ativo", item.getAttribute("data-secao") === idSecao);
  });

  document.querySelectorAll(".secao-config").forEach(function (secao) {
    secao.style.display = secao.id === idSecao ?"block" : "none";
  });
}

// -------------------------------------------------------
// PERFIL
// -------------------------------------------------------

function configurarFormularioPerfil(usuario) {
  document.getElementById("campoPerfil_Nome").value = usuario.nome || "";
  document.getElementById("campoPerfil_Email").value = usuario.email || "";
  preencherTipoPerfil(usuario);
  preencherTransportadoraPerfil(usuario);

  document.getElementById("formularioPerfil").addEventListener("submit", function (evento) {
    evento.preventDefault();
    exibirToast("Funcionalidade disponível em breve.", "info");
  });
}

function preencherTransportadoraPerfil(usuario) {
  const textoTransportadora = document.getElementById("textoTransportadoraPerfil");
  if (textoTransportadora) {
    if (usuario.perfil === "dono") {
      textoTransportadora.textContent = "Acesso global (sem transportadora fixa)";
    } else {
      textoTransportadora.textContent = usuario.transportadora_nome || "Transportadora não informada";
    }
  }
}

function preencherTipoPerfil(usuario) {
  const perfilFormatado = usuario.perfil === "dono"
    ? "Master"
    : usuario.perfil === "admin"
      ? "Administrador"
      : "Motorista";
  const seloPerfil = document.getElementById("seloTipoPerfil");
  const textoPerfil = document.getElementById("textoTipoPerfil");
  const avatarPerfil = document.getElementById("avatarPerfilConfig");

  if (seloPerfil) {
    seloPerfil.textContent = perfilFormatado;
    seloPerfil.classList.toggle("selo-perfil-admin", usuario.perfil === "admin" || usuario.perfil === "dono");
  }

  if (textoPerfil) {
    textoPerfil.textContent = perfilFormatado;
  }

  if (avatarPerfil) {
    avatarPerfil.textContent = obterIniciaisNome(usuario.nome || perfilFormatado);
  }
}

// -------------------------------------------------------
// GERENCIAR USUÁRIOS (apenas admin)
// -------------------------------------------------------

async function carregarUsuarios() {
  try {
    const resposta = await fetch(urlApiUsuarios, { headers: cabecalhosAutenticados() });
    if (!resposta.ok) throw new Error("Erro ao buscar usuários.");
    const resultado = await resposta.json();
    // Suporta resposta paginada ou array direto
    listaUsuarios = resultado.dados || resultado;
    usuariosVisiveis = listaUsuarios;
    renderizarTabelaUsuarios(listaUsuarios);
  } catch (erro) {
    console.error("Erro ao carregar usuários:", erro.message);
  }
}

function renderizarTabelaUsuarios(lista) {
  const corpo = document.getElementById("corpoTabelaUsuarios");
  if (!corpo) return;

  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6" class="celula-vazia">Nenhum usuário cadastrado.</td></tr>';
    if (exclusaoUsuarios) exclusaoUsuarios.aposRender([]);
    return;
  }

  usuariosVisiveis = lista;
  lista.forEach(function (usuario) {
    const linha = document.createElement("tr");
    linha.classList.add("linha-tabela");
    const idUsuario = Number(usuario.id);
    const nomeUsuario = window.AutoAcertoHtml.texto(usuario.nome, "-");
    const emailUsuario = window.AutoAcertoHtml.texto(usuario.email, "-");
    const transportadoraUsuario = window.AutoAcertoHtml.texto(usuario.transportadora_nome, "");
    const motoristaUsuario = window.AutoAcertoHtml.texto(usuario.motorista_nome, "-");

    const seloAtivo = usuario.ativo
      ?'<span class="selo-status selo-ativo">Ativo</span>'
      : '<span class="selo-status selo-inativo">Inativo</span>';

    let seloPerfil = '<span class="selo-status selo-motorista-perfil">Motorista</span>';
    if (usuario.perfil === "admin") {
      seloPerfil = '<span class="selo-status selo-admin">Admin</span>';
    } else if (usuario.perfil === "dono") {
      seloPerfil = '<span class="selo-status selo-admin">Master</span>';
    }

    const celulaSelecao =
      usuario.perfil === "dono"
        ? '<td class="coluna-selecao"></td>'
        : exclusaoUsuarios
          ? exclusaoUsuarios.colunaLinha(idUsuario)
          : "";

    const botoesAcao =
      usuario.perfil === "dono"
        ? ""
        : `<button class="botao-acao" type="button" data-editar-usuario="${idUsuario}">Editar</button>`;

    linha.innerHTML = `
            ${celulaSelecao}
            <td data-label="Usuário">
                <div class="bloco-usuario-nome">
                    <div class="avatar-mini">${obterIniciaisNome(nomeUsuario)}</div>
                    <div>
                        <div class="nome-usuario-tabela">${nomeUsuario}</div>
                        <div class="texto-secundario">${emailUsuario}</div>
                        ${transportadoraUsuario ? `<div class="texto-secundario">${transportadoraUsuario}</div>` : ""}
                    </div>
                </div>
            </td>
            <td data-label="Perfil">${seloPerfil}</td>
            <td data-label="Motorista vinculado">${usuario.perfil === "dono" ? "-" : motoristaUsuario}</td>
            <td data-label="Status">${seloAtivo}</td>
            <td data-label="Acoes">
                <div class="grupo-acoes">
                    ${botoesAcao}
                </div>
            </td>
        `;

    corpo.appendChild(linha);
  });

  if (exclusaoUsuarios) exclusaoUsuarios.aposRender(lista);

  corpo.querySelectorAll("[data-editar-usuario]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-editar-usuario");
      window.location.href = "editar-usuario.html?id=" + id;
    });
  });
}

function obterIniciaisNome(nome) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(function (parte) { return parte[0].toUpperCase(); })
    .join("");
}

function configurarExclusaoUsuarios() {
  if (!window.AutoAcertoExclusao) return;

  exclusaoUsuarios = window.AutoAcertoExclusao.criarGerenciadorExclusao({
    urlApi: urlApiUsuarios,
    seletorTabela: ".tabela",
    seletorLinhas: "[data-selecionar-id]",
    seletorSelecionarTodos: "[data-selecionar-todos-usuarios]",
    singular: "usuário",
    plural: "usuários",
    renderizarAtual: function () { renderizarTabelaUsuarios(usuariosVisiveis); },
    aoExcluir: carregarUsuarios
  });
}

// -------------------------------------------------------
// SEGURANÇA
// -------------------------------------------------------

function configurarFormularioSenha() {
  document.getElementById("formularioSenha").addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const senhaAtual = document.getElementById("campoSenhaAtual").value;
    const novaSenha = document.getElementById("campoNovaSenha").value;
    const confirmar = document.getElementById("campoConfirmarSenha").value;

    if (!senhaAtual || !novaSenha || !confirmar) {
      exibirToast("Preencha todos os campos.", "erro");
      return;
    }

    if (novaSenha.length < 8) {
      exibirToast("A nova senha deve ter pelo menos 8 caracteres.", "erro");
      return;
    }

    if (novaSenha !== confirmar) {
      exibirToast("As senhas não conferem.", "erro");
      return;
    }

    try {
      const resposta = await fetch(urlApiSenha, {
        method: "PATCH",
        headers: cabecalhosAutenticados(),
        body: JSON.stringify({ senhaAtual, novaSenha })
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        exibirToast(dados.mensagem || "Erro ao alterar senha.", "erro");
        return;
      }

      exibirToast("Senha alterada com sucesso.", "sucesso");
      document.getElementById("formularioSenha").reset();
    } catch (erro) {
      console.error("Erro ao alterar senha:", erro.message);
      exibirToast("Erro de conexão com o servidor.", "erro");
    }
  });
}

// -------------------------------------------------------
// TOAST
// -------------------------------------------------------

function exibirToast(mensagem, tipo) {
  const toast = document.getElementById("toastConfiguracao");
  if (!toast) return;

  toast.textContent = mensagem;
  toast.className = "toast-configuracao ativo toast-" + tipo;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toast.classList.remove("ativo");
  }, 3500);
}

// -------------------------------------------------------
// INICIALIZAÇÃO
// -------------------------------------------------------

document.addEventListener("DOMContentLoaded", iniciarSessaoConfiguracoes);


