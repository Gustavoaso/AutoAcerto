// =============================================================
// AUTOACERTO — AUTH
// Helper de sessão compartilhado por todas as páginas do sistema.
// =============================================================

function obterSessao() {
    try {
        return JSON.parse(sessionStorage.getItem("sessaoAutoAcerto")) || null;
    } catch {
        return null;
    }
}

function obterToken() {
    const sessao = obterSessao();
    return sessao ? sessao.token : null;
}

function obterUsuarioLogado() {
    const sessao = obterSessao();
    return sessao ? sessao.usuario : null;
}

function encerrarSessao() {
    sessionStorage.removeItem("sessaoAutoAcerto");
    window.location.href = "/frontend/HTML/login.html";
}

function exigirAutenticacao() {
    const sessao = obterSessao();
    if (!sessao || !sessao.token) {
        window.location.href = "/frontend/HTML/login.html";
        return null;
    }
    return sessao.usuario;
}

function exigirAdmin() {
    const usuario = exigirAutenticacao();
    if (!usuario) return null;
    if (usuario.perfil !== "admin") {
        window.location.href = "/frontend/HTML/viagens.html";
        return null;
    }
    return usuario;
}

function cabecalhosAutenticados() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + obterToken()
    };
}

function preencherInfoUsuario() {
    const usuario = obterUsuarioLogado();
    if (!usuario) return;

    const nomeElement   = document.querySelector(".nome-usuario");
    const avatarElement = document.querySelector(".avatar-usuario");

    if (nomeElement) {
        nomeElement.textContent = usuario.nome.split(" ")[0];
    }

    if (avatarElement) {
        const iniciais = usuario.nome
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(function (parte) { return parte[0].toUpperCase(); })
            .join("");
        avatarElement.textContent = iniciais;
    }

    const elementosAdmin = document.querySelectorAll("[data-apenas-admin]");
    if (usuario.perfil !== "admin") {
        elementosAdmin.forEach(function (elemento) {
            elemento.style.display = "none";
        });
    }
}

function configurarBotaoSair() {
    const botaoSair = document.querySelector(".botao-sair");
    if (!botaoSair) return;
    botaoSair.addEventListener("click", function () {
        encerrarSessao();
    });
}
