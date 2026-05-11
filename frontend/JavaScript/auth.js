// =============================================================
// AUTOACERTO — AUTH
// Helper de sessão compartilhado por todas as páginas do sistema.
// =============================================================

if (typeof window.montarUrlApi !== "function") {
    console.warn("⚠️ config.js não foi carregado antes do auth.js!");
}

// ==================== SESSÃO E TOKEN ====================

function obterSessao() {
    try {
        const token = localStorage.getItem("token");
        const usuario = JSON.parse(localStorage.getItem("usuario"));
        if (token && usuario) {
            return { token, usuario };
        }
        return null;
    } catch {
        return null;
    }
}

function obterToken() {
    return localStorage.getItem("token");
}

function obterUsuarioLogado() {
    try {
        return JSON.parse(localStorage.getItem("usuario"));
    } catch {
        return null;
    }
}

// ==================== AUTENTICAÇÃO E PERMISSÕES ====================

function encerrarSessao() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "/login.html";
}

function paginaPermitidaParaMotorista(caminho) {
    return caminho.endsWith("/viagens.html") ||
           caminho.endsWith("/ver-viagem.html") ||
           caminho.endsWith("/login.html");
}

function paginaPermitidaParaDonoSistema(caminho) {
    return true; // Dono tem acesso a tudo
}

function exigirAutenticacao() {
    const token = obterToken();
    const usuario = obterUsuarioLogado();

    const paginaAtual = window.location.pathname;
    const paginaLogin = "/login.html";

    if (!token || !usuario) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");

        if (paginaAtual !== paginaLogin) {
            window.location.href = paginaLogin;
        }
        return null;
    }

    // Redirecionamentos por perfil
    if (usuario.perfil === "motorista" && !paginaPermitidaParaMotorista(paginaAtual)) {
        window.location.href = "/viagens.html";
        return null;
    }

    return usuario;
}

function exigirAdmin() {
    const usuario = exigirAutenticacao();
    if (!usuario) return null;
    if (usuario.perfil !== "admin" && usuario.perfil !== "dono") {
        window.location.href = "/viagens.html";
        return null;
    }
    return usuario;
}

function usuarioEhAdminOuDonoMaster(usuario) {
    return usuario && (usuario.perfil === "admin" || usuario.perfil === "dono");
}

// ==================== HEADERS ====================

function cabecalhosAutenticados() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (obterToken() || "")
    };
}

// ==================== UI E MENU ====================

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
            .map(parte => parte[0].toUpperCase())
            .join("");
        avatarElement.textContent = iniciais;
    }

    document.querySelectorAll("[data-apenas-admin]").forEach(el => {
        el.style.display = usuarioEhAdminOuDonoMaster(usuario) ? "" : "none";
    });

    document.querySelectorAll("[data-apenas-dono]").forEach(el => {
        el.style.display = usuario.perfil === "dono" ? "" : "none";
    });

    ajustarMenuPorPerfil(usuario);
}

function ajustarMenuPorPerfil(usuario) {
    if (!usuario) return;

    if (usuario.perfil === "dono") {
        inserirMenuTransportadoras();
        return;
    }

    if (usuario.perfil === "admin") return;

    // Motorista: esconde tudo exceto Viagens
    document.querySelectorAll(".menu-lateral .item-menu").forEach(item => {
        const destino = item.getAttribute("href") || "";
        if (!destino.endsWith("viagens.html")) {
            item.style.display = "none";
        }
    });
}

function marcarItemMenuLateralAtivo() {
    const caminho = window.location.pathname || "";
    const arquivo = (caminho.split("/").pop() || "").split("?")[0].split("#")[0];

    document.querySelectorAll(".barra-lateral .menu-lateral .item-menu").forEach(link => {
        const href = (link.getAttribute("href") || "").split("?")[0].split("#")[0];
        link.classList.toggle("ativo", href === arquivo);
    });
}

function inserirMenuTransportadoras() {
    const menu = document.querySelector(".menu-lateral");
    if (!menu || menu.querySelector('[href="transportadoras.html"]')) return;

    const item = document.createElement("a");
    item.href = "transportadoras.html";
    item.className = "item-menu";
    if (window.location.pathname.endsWith("/transportadoras.html")) {
        item.classList.add("ativo");
    }
    item.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h10" />
            <path d="M7 12h10" />
            <path d="M7 16h6" />
        </svg>
        Transportadoras
    `;

    const itemConfiguracoes = menu.querySelector('[href="configuracoes.html"]');
    if (itemConfiguracoes) {
        menu.insertBefore(item, itemConfiguracoes);
    } else {
        menu.appendChild(item);
    }

    marcarItemMenuLateralAtivo();
}

function configurarBotaoSair() {
    const botaoSair = document.querySelector(".botao-sair");
    if (!botaoSair) return;
    botaoSair.addEventListener("click", encerrarSessao);
}

// ==================== FETCH INTERCEPTOR ====================

function configurarFetchAutenticado() {
    if (window.fetchAutenticadoConfigurado) return;

    const fetchOriginal = window.fetch.bind(window);

    window.fetch = function (recurso, opcoes) {
        const urlOriginal = typeof recurso === "string" ? recurso : recurso.url;
        
        // Usa a função do config.js
        const baseApi = typeof obterApiBaseUrl === "function" 
            ? obterApiBaseUrl() 
            : window.location.origin;

        const urlApiLocalAntiga = "http://localhost:3000";
        let recursoFinal = recurso;
        let urlFinal = urlOriginal;

        // Retrocompatibilidade com localhost antigo
        if (typeof urlOriginal === "string" && urlOriginal.startsWith(urlApiLocalAntiga)) {
            const relativo = urlOriginal.slice(urlApiLocalAntiga.length);
            urlFinal = baseApi + relativo;
            recursoFinal = typeof recurso === "string" ? urlFinal : new Request(urlFinal, recurso);
        }

        const deveAutenticar = urlFinal && 
                              urlFinal.startsWith(baseApi + "/") && 
                              !urlFinal.includes("/auth/login");

        if (!deveAutenticar) {
            return fetchOriginal(recursoFinal, opcoes);
        }

        const novasOpcoes = opcoes ? { ...opcoes } : {};
        const headers = new Headers(novasOpcoes.headers || {});

        const token = obterToken();
        if (token && !headers.has("Authorization")) {
            headers.set("Authorization", "Bearer " + token);
        }

        novasOpcoes.headers = headers;
        return fetchOriginal(recursoFinal, novasOpcoes);
    };

    window.fetchAutenticadoConfigurado = true;
}

configurarFetchAutenticado();

// ==================== INICIALIZAÇÃO ====================

document.addEventListener("DOMContentLoaded", function () {
    const paginaAtual = window.location.pathname;
    if (paginaAtual.endsWith("/login.html")) return;

    const usuario = exigirAutenticacao();
    if (!usuario) return;

    preencherInfoUsuario();
    marcarItemMenuLateralAtivo();
    configurarBotaoSair();
});