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

let avisoSessaoExpiradaExibido = false;

function urlEhRequisicaoApiAutenticada(url) {
    if (!url || typeof url !== "string") return false;

    const baseApi = typeof obterApiBaseUrl === "function"
        ? obterApiBaseUrl()
        : window.location.origin;

    return url.startsWith(baseApi + "/") && !url.includes("/auth/login");
}

function exibirAvisoSessaoExpirada() {
    if (avisoSessaoExpiradaExibido) return;
    if (window.location.pathname.endsWith("/login.html")) return;

    avisoSessaoExpiradaExibido = true;

    if (document.getElementById("modalSessaoExpirada")) return;

    const modal = document.createElement("div");
    modal.id = "modalSessaoExpirada";
    modal.className = "modal-sucesso modal-sessao-expirada";
    modal.innerHTML =
        '<div class="fundo-modal-sucesso"></div>' +
        '<div class="caixa-modal-sucesso">' +
            '<div class="icone-aviso-sessao" aria-hidden="true">!</div>' +
            '<h3>Sessão expirada</h3>' +
            '<p>Sua sessão expirou por inatividade. Faça login novamente para continuar usando o sistema.</p>' +
            '<div class="acoes-modal-sucesso">' +
                '<button type="button" class="botao-primario" id="botaoSessaoExpiradaLogin">Ir para login</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    const botao = document.getElementById("botaoSessaoExpiradaLogin");
    if (botao) {
        botao.addEventListener("click", encerrarSessao);
    }
}

function tratarSessaoExpiradaSeNecessario(resposta, url) {
    if (!resposta || resposta.status !== 401) return resposta;
    if (!urlEhRequisicaoApiAutenticada(url)) return resposta;
    exibirAvisoSessaoExpirada();
    return resposta;
}

async function verificarSessaoAoRetornarAba() {
    if (document.visibilityState !== "visible") return;
    if (window.location.pathname.endsWith("/login.html")) return;
    if (!obterToken()) return;
    if (typeof montarUrlApi !== "function") return;

    try {
        const resposta = await window.fetchOriginal(
            montarUrlApi("/auth/me"),
            { headers: cabecalhosAutenticados() }
        );
        tratarSessaoExpiradaSeNecessario(resposta, resposta.url);
    } catch (erro) {
        console.warn("Nao foi possivel verificar sessao:", erro.message);
    }
}

function paginaPermitidaParaMotorista(caminho) {
    return caminho.endsWith("/viagens.html") ||
           caminho.endsWith("/editar-viagem.html") ||
           caminho.endsWith("/ver-viagem.html") ||
           caminho.endsWith("/despesas.html") ||
           caminho.endsWith("/cadastro-despesa.html") ||
           caminho.endsWith("/ver-despesa.html") ||
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

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, function (caractere) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[caractere];
    });
}

function textoHtmlSeguro(valor, fallback) {
    const texto = valor === undefined || valor === null || valor === "" ? fallback : valor;
    return escaparHtml(texto === undefined || texto === null ? "" : texto);
}

window.AutoAcertoHtml = {
    escapar: escaparHtml,
    texto: textoHtmlSeguro
};

const CHAVE_TRANSPORTADORA_MASTER = "master_transportadora_id";
const CHAVE_TEMA_UI = "autoacerto_tema_ui";

// ==================== UI E MENU ====================

function obterNomePrimeiroUsuario(usuario) {
    return (usuario && usuario.nome) ? usuario.nome.split(" ")[0] : "Usuario";
}

function obterNomeEmpresaUsuario(usuario) {
    if (!usuario) return "Empresa";
    if (usuario.transportadora_nome) return usuario.transportadora_nome;
    if (usuario.perfil === "dono") return "Todas as empresas";
    return "Empresa nao informada";
}

function obterTransportadoraIdParaCadastroMaster() {
    const usuario = obterUsuarioLogado();
    if (!usuario || usuario.perfil !== "dono") return null;

    const valor = sessionStorage.getItem(CHAVE_TRANSPORTADORA_MASTER);
    const id = parseInt(valor, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function anexarTransportadoraIdSeMaster(corpo) {
    const usuario = obterUsuarioLogado();
    if (!usuario || usuario.perfil !== "dono") return corpo;

    const tid = obterTransportadoraIdParaCadastroMaster();
    if (!tid) return corpo;
    corpo.transportadora_id = tid;
    return corpo;
}

function filtrarListaPorTransportadoraMaster(lista) {
    const usuario = obterUsuarioLogado();
    if (!usuario || usuario.perfil !== "dono") return lista || [];

    const tid = obterTransportadoraIdParaCadastroMaster();
    if (!tid) return [];

    return (lista || []).filter(function (item) {
        return Number(item.transportadora_id) === tid;
    });
}

function validarTransportadoraMasterParaCadastro(opcoes) {
    const usuario = obterUsuarioLogado();
    if (!usuario || usuario.perfil !== "dono") return true;
    if (obterTransportadoraIdParaCadastroMaster()) return true;

    const msg = (opcoes && opcoes.mensagemErro) ||
        "Selecione a transportadora no topo da pagina para definir o escopo do cadastro.";
    window.alert(msg);
    return false;
}

function obterUrlVoltarCadastro() {
    const pagina = (window.location.pathname.split("/").pop() || "").toLowerCase();
    const mapa = {
        "cadastro-motorista.html": "motoristas.html",
        "cadastro-veiculo.html": "veiculos.html",
        "cadastro-viagem.html": "viagens.html",
        "cadastro-despesa.html": "despesas.html",
        "novo-usuario.html": "configuracoes.html?secao=usuarios"
    };

    return mapa[pagina] || "index.html";
}

function navegarVoltarCadastro() {
    if (document.referrer && document.referrer.startsWith(window.location.origin)) {
        window.history.back();
        return;
    }

    window.location.href = obterUrlVoltarCadastro();
}

function criarIconePredioTopo() {
    return '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /><path d="M3 21h18" /><path d="M8 7h2M8 11h2M8 15h2M14 7h1M14 11h1M14 15h1" /></svg>';
}

function criarIconeNotificacaoTopo() {
    return '<svg viewBox="0 0 24 24"><path d="M10.3 21a2 2 0 0 0 3.4 0" /><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /></svg>';
}

function criarIconeTemaTopo() {
    return '<svg viewBox="0 0 24 24"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" /></svg>';
}

function padronizarTopoPagina() {
    const topo = document.querySelector(".topo-pagina");
    const usuario = obterUsuarioLogado();
    if (!topo || !usuario) return;

    const controleEmpresa = usuario.perfil === "dono"
        ? '<div class="botao-empresa-topo controle-empresa-topo" aria-label="Transportadora atual">' +
            criarIconePredioTopo() +
            '<select id="seletorEmpresaTopo" class="seletor-empresa-topo" aria-label="Selecionar transportadora">' +
                '<option value="">Selecionar transportadora</option>' +
            '</select>' +
          '</div>'
        : '<div class="botao-empresa-topo" aria-label="Empresa atual">' +
            criarIconePredioTopo() +
            '<span class="nome-empresa-topo">Carregando...</span>' +
          '</div>';

    topo.innerHTML =
        '<div class="acoes-topo">' +
            controleEmpresa +
            '<span class="divisor-topo"></span>' +
            '<button class="botao-icone" type="button" id="botaoNotificacoesTopo" aria-label="Notificacoes">' + criarIconeNotificacaoTopo() + '</button>' +
            '<button class="botao-icone" type="button" id="botaoTemaTopo" aria-label="Alternar tema">' + criarIconeTemaTopo() + '</button>' +
            '<button class="perfil-usuario" type="button" id="botaoPerfilTopo" aria-label="Abrir perfil">' +
                '<div class="avatar-usuario">--</div>' +
                '<span class="nome-usuario">Carregando...</span>' +
            '</button>' +
        '</div>' +
        '<div class="painel-topo-info oculto" id="painelNotificacoesTopo">' +
            '<strong>Central rapida</strong>' +
            '<p id="textoPainelNotificacoesTopo">Sem notificacoes no momento.</p>' +
        '</div>';
}

function inserirBotaoVoltarCadastro() {
    const pagina = (window.location.pathname.split("/").pop() || "").toLowerCase();
    if (!pagina.startsWith("cadastro-") && pagina !== "novo-usuario.html") return;

    const cabecalho = document.querySelector(".cabecalho-conteudo");
    if (!cabecalho || cabecalho.querySelector("#botaoVoltarCadastro")) return;

    const botao = document.createElement("button");
    botao.type = "button";
    botao.id = "botaoVoltarCadastro";
    botao.className = "botao-secundario";
    botao.textContent = "Voltar";
    botao.addEventListener("click", navegarVoltarCadastro);
    cabecalho.appendChild(botao);
}

function preencherInfoUsuario() {
    const usuario = obterUsuarioLogado();
    if (!usuario) return;

    const nomeElement   = document.querySelector(".nome-usuario");
    const avatarElement = document.querySelector(".avatar-usuario");
    const empresaElement = document.querySelector(".nome-empresa-topo");

    if (nomeElement) nomeElement.textContent = usuario.nome || "Usuario";
    if (empresaElement) empresaElement.textContent = obterNomeEmpresaUsuario(usuario);

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

async function atualizarSessaoAtualDoBanco() {
    if (typeof montarUrlApi !== "function") return;

    try {
        const resposta = await fetch(montarUrlApi("/auth/me"), {
            headers: cabecalhosAutenticados()
        });

        if (resposta.status === 401) {
            exibirAvisoSessaoExpirada();
            return;
        }

        if (!resposta.ok) return;

        const dados = await resposta.json();
        if (!dados.usuario) return;

        const usuarioAtual = obterUsuarioLogado() || {};
        const usuarioAtualizado = { ...usuarioAtual, ...dados.usuario };
        localStorage.setItem("usuario", JSON.stringify(usuarioAtualizado));
        preencherInfoUsuario();
        await preencherControleTransportadoraTopo();
        atualizarPainelTopo();
    } catch (erro) {
        console.warn("Nao foi possivel atualizar dados da sessao:", erro.message);
    }
}

async function preencherControleTransportadoraTopo() {
    const usuario = obterUsuarioLogado();
    const seletor = document.getElementById("seletorEmpresaTopo");
    const empresaElement = document.querySelector(".nome-empresa-topo");

    if (!usuario) return;

    if (empresaElement) {
        empresaElement.textContent = obterNomeEmpresaUsuario(usuario);
    }

    if (!seletor || usuario.perfil !== "dono" || typeof montarUrlApi !== "function") return;

    const valorSalvo = sessionStorage.getItem(CHAVE_TRANSPORTADORA_MASTER) || "";
    seletor.innerHTML = '<option value="">Todas as transportadoras</option>';

    try {
        const resposta = await fetch(montarUrlApi("/transportadoras"), {
            headers: cabecalhosAutenticados()
        });

        if (resposta.status === 401) {
            exibirAvisoSessaoExpirada();
            return;
        }

        if (!resposta.ok) {
            throw new Error("transportadoras");
        }

        const resultado = await resposta.json();
        const lista = resultado.dados || resultado;

        lista.forEach(function (transportadora) {
            const opcao = document.createElement("option");
            opcao.value = String(transportadora.id);
            opcao.textContent = transportadora.nome;
            seletor.appendChild(opcao);
        });

        if (valorSalvo && lista.some(function (item) { return String(item.id) === valorSalvo; })) {
            seletor.value = valorSalvo;
        }
    } catch (erro) {
        seletor.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function atualizarPainelTopo() {
    const usuario = obterUsuarioLogado();
    const painel = document.getElementById("textoPainelNotificacoesTopo");
    if (!usuario || !painel) return;

    const empresa = usuario.perfil === "dono"
        ? (document.getElementById("seletorEmpresaTopo")?.selectedOptions[0]?.textContent || "Todas as transportadoras")
        : obterNomeEmpresaUsuario(usuario);

    painel.textContent = "Usuario: " + obterNomePrimeiroUsuario(usuario) + ". Escopo atual: " + empresa + ".";
}

function aplicarTemaSalvo() {
    const tema = localStorage.getItem(CHAVE_TEMA_UI) || "claro";
    document.documentElement.setAttribute("data-tema-ui", tema);
}

function alternarTemaUi() {
    const atual = document.documentElement.getAttribute("data-tema-ui") || "claro";
    const proximo = atual === "escuro" ? "claro" : "escuro";
    document.documentElement.setAttribute("data-tema-ui", proximo);
    localStorage.setItem(CHAVE_TEMA_UI, proximo);
}

function configurarInteracoesTopo() {
    const usuario = obterUsuarioLogado();
    const botaoPerfil = document.getElementById("botaoPerfilTopo");
    const botaoTema = document.getElementById("botaoTemaTopo");
    const botaoNotificacoes = document.getElementById("botaoNotificacoesTopo");
    const painelNotificacoes = document.getElementById("painelNotificacoesTopo");
    const seletorEmpresa = document.getElementById("seletorEmpresaTopo");
    const blocoEmpresa = document.querySelector(".botao-empresa-topo");

    if (botaoPerfil) {
        botaoPerfil.addEventListener("click", function () {
            window.location.href = usuario && usuario.perfil === "motorista" ? "viagens.html" : "configuracoes.html";
        });
    }

    if (botaoTema) {
        botaoTema.addEventListener("click", alternarTemaUi);
    }

    if (blocoEmpresa && !seletorEmpresa) {
        blocoEmpresa.addEventListener("click", function () {
            if (!usuario || usuario.perfil === "motorista") return;
            window.location.href = "configuracoes.html";
        });
    }

    if (botaoNotificacoes && painelNotificacoes) {
        botaoNotificacoes.addEventListener("click", function () {
            painelNotificacoes.classList.toggle("oculto");
            atualizarPainelTopo();
        });
    }

    document.addEventListener("click", function (evento) {
        if (!painelNotificacoes || painelNotificacoes.classList.contains("oculto")) return;
        if (painelNotificacoes.contains(evento.target)) return;
        if (botaoNotificacoes && botaoNotificacoes.contains(evento.target)) return;
        painelNotificacoes.classList.add("oculto");
    });

    if (seletorEmpresa) {
        seletorEmpresa.addEventListener("change", function () {
            sessionStorage.setItem(CHAVE_TRANSPORTADORA_MASTER, seletorEmpresa.value);
            document.dispatchEvent(new CustomEvent("autoacerto-master-transportadora"));
            atualizarPainelTopo();
            window.location.reload();
        });
    }
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

window.obterTransportadoraIdParaCadastroMaster = obterTransportadoraIdParaCadastroMaster;
window.anexarTransportadoraIdSeMaster = anexarTransportadoraIdSeMaster;
window.filtrarListaPorTransportadoraMaster = filtrarListaPorTransportadoraMaster;
window.validarTransportadoraMasterParaCadastro = validarTransportadoraMasterParaCadastro;

// ==================== FETCH INTERCEPTOR ====================

function configurarFetchAutenticado() {
    if (window.fetchAutenticadoConfigurado) return;

    const fetchOriginal = window.fetch.bind(window);
    window.fetchOriginal = fetchOriginal;

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
        const usuario = obterUsuarioLogado();
        const metodo = (novasOpcoes.method || (typeof recurso !== "string" && recurso.method) || "GET").toUpperCase();

        const token = obterToken();
        if (token && !headers.has("Authorization")) {
            headers.set("Authorization", "Bearer " + token);
        }

        if (
            usuario &&
            usuario.perfil === "dono" &&
            metodo === "GET" &&
            !urlFinal.includes("/auth/") &&
            !urlFinal.includes("/transportadoras")
        ) {
            const transportadoraId = obterTransportadoraIdParaCadastroMaster();
            if (transportadoraId) {
                const urlComContexto = new URL(urlFinal);
                urlComContexto.searchParams.set("transportadora_id", String(transportadoraId));
                urlFinal = urlComContexto.toString();
                recursoFinal = typeof recurso === "string" ? urlFinal : new Request(urlFinal, recurso);
            }
        }

        novasOpcoes.headers = headers;
        return fetchOriginal(recursoFinal, novasOpcoes).then(function (resposta) {
            return tratarSessaoExpiradaSeNecessario(resposta, urlFinal);
        });
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

    aplicarTemaSalvo();
    padronizarTopoPagina();
    inserirBotaoVoltarCadastro();
    preencherInfoUsuario();
    preencherControleTransportadoraTopo();
    atualizarSessaoAtualDoBanco();
    configurarInteracoesTopo();
    atualizarPainelTopo();
    marcarItemMenuLateralAtivo();
    configurarBotaoSair();

    document.addEventListener("visibilitychange", verificarSessaoAoRetornarAba);
});
