// =============================================================
// AUTOACERTO — CONFIGURAÇÕES
// Gerenciamento de perfil, usuários (admin), sistema e segurança.
// =============================================================

const urlApiUsuarios   = "http://localhost:3000/usuarios";
const urlApiMotoristas = "http://localhost:3000/motoristas";
const urlApiSenha      = "http://localhost:3000/usuarios/senha";

let listaUsuarios   = [];
let listaMotoristas = [];
let usuarioEmEdicao = null;

// -------------------------------------------------------
// SESSÃO
// -------------------------------------------------------

function iniciarSessaoConfiguracoes() {
    const usuario = exigirAutenticacao();
    if (!usuario) return;

    preencherInfoUsuario();
    configurarBotaoSair();
    configurarMenuLateral();
    configurarFormularioPerfil(usuario);
    configurarFormularioSenha();

    if (usuario.perfil === "admin") {
        document.querySelectorAll("[data-apenas-admin]").forEach(function (el) {
            el.style.removeProperty("display");
        });
        carregarUsuarios();
        carregarMotoristasParaSelect();
    }

    ativarSecao("secao-perfil");
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
        secao.style.display = secao.id === idSecao ? "block" : "none";
    });
}

// -------------------------------------------------------
// PERFIL
// -------------------------------------------------------

function configurarFormularioPerfil(usuario) {
    document.getElementById("campoPerfil_Nome").value  = usuario.nome  || "";
    document.getElementById("campoPerfil_Email").value = usuario.email || "";

    document.getElementById("formularioPerfil").addEventListener("submit", function (evento) {
        evento.preventDefault();
        exibirToast("Funcionalidade disponível em breve.", "info");
    });
}

// -------------------------------------------------------
// GERENCIAR USUÁRIOS (apenas admin)
// -------------------------------------------------------

async function carregarUsuarios() {
    try {
        const resposta = await fetch(urlApiUsuarios, { headers: cabecalhosAutenticados() });
        if (!resposta.ok) throw new Error("Erro ao buscar usuários.");
        listaUsuarios = await resposta.json();
        renderizarTabelaUsuarios(listaUsuarios);
    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro.message);
    }
}

async function carregarMotoristasParaSelect() {
    try {
        const resposta = await fetch(urlApiMotoristas, { headers: cabecalhosAutenticados() });
        if (!resposta.ok) throw new Error("Erro ao buscar motoristas.");
        listaMotoristas = await resposta.json();
        preencherSelectMotoristas();
    } catch (erro) {
        console.error("Erro ao carregar motoristas:", erro.message);
    }
}

function preencherSelectMotoristas() {
    const select = document.getElementById("campoModal_MotoristId");
    if (!select) return;

    select.innerHTML = '<option value="">— Selecione um motorista —</option>';
    listaMotoristas.forEach(function (motorista) {
        const opcao = document.createElement("option");
        opcao.value = motorista.id;
        opcao.textContent = motorista.nome + " (CPF: " + motorista.cpf + ")";
        select.appendChild(opcao);
    });
}

function renderizarTabelaUsuarios(lista) {
    const corpo = document.getElementById("corpoTabelaUsuarios");
    if (!corpo) return;

    corpo.innerHTML = "";

    if (lista.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" class="celula-vazia">Nenhum usuário cadastrado.</td></tr>';
        return;
    }

    lista.forEach(function (usuario) {
        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        const seloAtivo = usuario.ativo
            ? '<span class="selo-status selo-ativo">Ativo</span>'
            : '<span class="selo-status selo-inativo">Inativo</span>';

        const seloPerfil = usuario.perfil === "admin"
            ? '<span class="selo-status selo-admin">Admin</span>'
            : '<span class="selo-status selo-motorista-perfil">Motorista</span>';

        linha.innerHTML = `
            <td>
                <div class="bloco-usuario-nome">
                    <div class="avatar-mini">${obterIniciaisNome(usuario.nome)}</div>
                    <div>
                        <div class="nome-usuario-tabela">${usuario.nome}</div>
                        <div class="texto-secundario">${usuario.email}</div>
                    </div>
                </div>
            </td>
            <td>${seloPerfil}</td>
            <td>${usuario.motorista_nome || "—"}</td>
            <td>${seloAtivo}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="abrirModalEditarUsuario(${usuario.id})">Editar</button>
                </div>
            </td>
        `;

        corpo.appendChild(linha);
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

function abrirModalCriarUsuario() {
    usuarioEmEdicao = null;
    limparModalUsuario();
    document.getElementById("tituloModalUsuario").textContent = "Novo usuário";
    document.getElementById("campoPerfil_ModalAtivo").parentElement.style.display = "none";
    toggleCampoMotoristaPorPerfil(document.getElementById("campoModal_Perfil").value);
    document.getElementById("modalUsuario").style.display = "flex";
}

function abrirModalEditarUsuario(id) {
    const usuario = listaUsuarios.find(function (u) { return u.id === id; });
    if (!usuario) return;

    usuarioEmEdicao = usuario;
    document.getElementById("tituloModalUsuario").textContent = "Editar usuário";
    document.getElementById("campoModal_Nome").value          = usuario.nome;
    document.getElementById("campoModal_Email").value         = usuario.email;
    document.getElementById("campoModal_Perfil").value        = usuario.perfil;
    document.getElementById("campoModal_MotoristId").value    = usuario.motorista_id || "";
    document.getElementById("campoModal_Senha").value         = "";
    document.getElementById("campoPerfil_ModalAtivo").checked = usuario.ativo;
    document.getElementById("campoPerfil_ModalAtivo").parentElement.style.display = "flex";
    toggleCampoMotoristaPorPerfil(usuario.perfil);
    document.getElementById("modalUsuario").style.display = "flex";
}

function fecharModalUsuario() {
    document.getElementById("modalUsuario").style.display = "none";
    usuarioEmEdicao = null;
}

function limparModalUsuario() {
    document.getElementById("campoModal_Nome").value      = "";
    document.getElementById("campoModal_Email").value     = "";
    document.getElementById("campoModal_Perfil").value    = "motorista";
    document.getElementById("campoModal_MotoristId").value = "";
    document.getElementById("campoModal_Senha").value     = "";
    document.getElementById("campoPerfil_ModalAtivo").checked = true;
}

function toggleCampoMotoristaPorPerfil(perfil) {
    const grupo = document.getElementById("grupoCampoMotoristaModal");
    if (!grupo) return;
    grupo.style.display = perfil === "motorista" ? "flex" : "none";
}

async function salvarUsuarioModal() {
    const nome        = document.getElementById("campoModal_Nome").value.trim();
    const email       = document.getElementById("campoModal_Email").value.trim();
    const perfil      = document.getElementById("campoModal_Perfil").value;
    const motoristId  = document.getElementById("campoModal_MotoristId").value || null;
    const senha       = document.getElementById("campoModal_Senha").value;
    const ativo       = document.getElementById("campoPerfil_ModalAtivo").checked;

    if (!nome || !email || !perfil) {
        exibirToast("Preencha todos os campos obrigatórios.", "erro");
        return;
    }

    if (!usuarioEmEdicao && !senha) {
        exibirToast("Informe uma senha para o novo usuário.", "erro");
        return;
    }

    const corpo = { nome, email, perfil, motorista_id: motoristId, ativo };
    if (senha) corpo.senha = senha;

    try {
        const url    = usuarioEmEdicao ? urlApiUsuarios + "/" + usuarioEmEdicao.id : urlApiUsuarios;
        const metodo = usuarioEmEdicao ? "PUT" : "POST";

        const resposta = await fetch(url, {
            method: metodo,
            headers: cabecalhosAutenticados(),
            body: JSON.stringify(corpo)
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            exibirToast(dados.mensagem || "Erro ao salvar usuário.", "erro");
            return;
        }

        exibirToast(dados.mensagem, "sucesso");
        fecharModalUsuario();
        carregarUsuarios();

    } catch (erro) {
        console.error("Erro ao salvar usuário:", erro.message);
        exibirToast("Erro de conexão com o servidor.", "erro");
    }
}

// -------------------------------------------------------
// SEGURANÇA
// -------------------------------------------------------

function configurarFormularioSenha() {
    document.getElementById("formularioSenha").addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const senhaAtual = document.getElementById("campoSenhaAtual").value;
        const novaSenha  = document.getElementById("campoNovaSenha").value;
        const confirmar  = document.getElementById("campoConfirmarSenha").value;

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
// SISTEMA
// -------------------------------------------------------

function configurarSecaoSistema() {
    const registrosPorPagina = document.getElementById("campoSistema_RegistrosPorPagina");
    const formatoData        = document.getElementById("campoSistema_FormatoData");
    const confirmarExclusoes = document.getElementById("campoSistema_ConfirmarExclusoes");

    if (registrosPorPagina)  registrosPorPagina.value   = localStorage.getItem("sistemaRegistrosPagina") || "20";
    if (formatoData)          formatoData.value          = localStorage.getItem("sistemaFormatoData") || "dd/mm/aaaa";
    if (confirmarExclusoes)   confirmarExclusoes.checked = localStorage.getItem("sistemaConfirmarExclusoes") !== "false";

    document.getElementById("formularioSistema").addEventListener("submit", function (evento) {
        evento.preventDefault();
        if (registrosPorPagina)  localStorage.setItem("sistemaRegistrosPagina", registrosPorPagina.value);
        if (formatoData)          localStorage.setItem("sistemaFormatoData", formatoData.value);
        if (confirmarExclusoes)   localStorage.setItem("sistemaConfirmarExclusoes", confirmarExclusoes.checked);
        exibirToast("Configurações do sistema salvas.", "sucesso");
    });
}

// -------------------------------------------------------
// TOAST
// -------------------------------------------------------

function exibirToast(mensagem, tipo) {
    const toast = document.getElementById("toastConfiguracao");
    if (!toast) return;

    toast.textContent = mensagem;
    toast.className   = "toast-configuracao ativo toast-" + tipo;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
        toast.classList.remove("ativo");
    }, 3500);
}

// -------------------------------------------------------
// INICIALIZAÇÃO
// -------------------------------------------------------

function iniciarPaginaConfiguracoes() {
    iniciarSessaoConfiguracoes();
    configurarSecaoSistema();

    const selectPerfil = document.getElementById("campoModal_Perfil");
    if (selectPerfil) {
        selectPerfil.addEventListener("change", function () {
            toggleCampoMotoristaPorPerfil(this.value);
        });
    }
}

document.addEventListener("DOMContentLoaded", iniciarPaginaConfiguracoes);
