const CHAVE_PREFERENCIAS = "autoacerto_preferencias";

let preferencias = {
    notifCnh: true,
    notifViagem: true,
    notifDespesa: false,
    notifResumoSemanal: false,
    registrosPorPagina: "25",
    formatoData: "dd/mm/aaaa",
    confirmarExclusao: true
};

function carregarPreferencias() {
    try {
        const salvo = localStorage.getItem(CHAVE_PREFERENCIAS);
        if (salvo) {
            preferencias = Object.assign({}, preferencias, JSON.parse(salvo));
        }
    } catch (erro) {
        console.error("Erro ao carregar preferencias:", erro);
    }
}

function salvarPreferencias() {
    try {
        localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
    } catch (erro) {
        console.error("Erro ao salvar preferencias:", erro);
    }
}

function aplicarPreferenciasNaTela() {
    const campos = [
        { id: "notifCnh", chave: "notifCnh", tipo: "checkbox" },
        { id: "notifViagem", chave: "notifViagem", tipo: "checkbox" },
        { id: "notifDespesa", chave: "notifDespesa", tipo: "checkbox" },
        { id: "notifResumoSemanal", chave: "notifResumoSemanal", tipo: "checkbox" },
        { id: "configRegistrosPorPagina", chave: "registrosPorPagina", tipo: "select" },
        { id: "configFormatoData", chave: "formatoData", tipo: "select" },
        { id: "configConfirmarExclusao", chave: "confirmarExclusao", tipo: "checkbox" }
    ];

    campos.forEach(function (campo) {
        const elemento = document.getElementById(campo.id);
        if (!elemento) return;

        if (campo.tipo === "checkbox") {
            elemento.checked = preferencias[campo.chave];
        } else {
            elemento.value = preferencias[campo.chave];
        }
    });
}

function alternarSecao(idSecaoAlvo) {
    const secoes = document.querySelectorAll(".secao-configuracao");
    const botoes = document.querySelectorAll(".item-menu-config");

    secoes.forEach(function (secao) {
        secao.style.display = "none";
    });

    botoes.forEach(function (botao) {
        botao.classList.remove("ativo");
    });

    const secaoAlvo = document.getElementById("secao" + capitalizarPrimeira(idSecaoAlvo));
    const botaoAlvo = document.querySelector("[data-secao='" + idSecaoAlvo + "']");

    if (secaoAlvo) secaoAlvo.style.display = "block";
    if (botaoAlvo) botaoAlvo.classList.add("ativo");
}

function capitalizarPrimeira(texto) {
    if (!texto) return "";
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function exibirMensagemSucesso(mensagem) {
    const elementoExistente = document.getElementById("mensagemSucessoConfig");
    if (elementoExistente) elementoExistente.remove();

    const mensagemElemento = document.createElement("div");
    mensagemElemento.id = "mensagemSucessoConfig";
    mensagemElemento.textContent = mensagem;
    mensagemElemento.style.cssText = [
        "position: fixed",
        "bottom: 24px",
        "right: 24px",
        "background: var(--cor-sucesso)",
        "color: #ffffff",
        "padding: 12px 20px",
        "border-radius: var(--raio)",
        "font-size: 0.875rem",
        "font-weight: 600",
        "box-shadow: var(--sombra-media)",
        "z-index: 1000",
        "animation: nenhum"
    ].join("; ");

    document.body.appendChild(mensagemElemento);

    setTimeout(function () {
        if (mensagemElemento.parentNode) {
            mensagemElemento.remove();
        }
    }, 3000);
}

function exibirMensagemErro(mensagem) {
    const elementoExistente = document.getElementById("mensagemErroConfig");
    if (elementoExistente) elementoExistente.remove();

    const mensagemElemento = document.createElement("div");
    mensagemElemento.id = "mensagemErroConfig";
    mensagemElemento.textContent = mensagem;
    mensagemElemento.style.cssText = [
        "position: fixed",
        "bottom: 24px",
        "right: 24px",
        "background: var(--cor-perigo)",
        "color: #ffffff",
        "padding: 12px 20px",
        "border-radius: var(--raio)",
        "font-size: 0.875rem",
        "font-weight: 600",
        "box-shadow: var(--sombra-media)",
        "z-index: 1000"
    ].join("; ");

    document.body.appendChild(mensagemElemento);

    setTimeout(function () {
        if (mensagemElemento.parentNode) {
            mensagemElemento.remove();
        }
    }, 3000);
}

function salvarPerfil(evento) {
    evento.preventDefault();

    const nome = document.getElementById("configNome").value.trim();
    const email = document.getElementById("configEmail").value.trim();

    if (!nome || !email) {
        exibirMensagemErro("Preencha o nome e o e-mail.");
        return;
    }

    exibirMensagemSucesso("Perfil atualizado com sucesso.");
}

function salvarNotificacoes() {
    preferencias.notifCnh = document.getElementById("notifCnh").checked;
    preferencias.notifViagem = document.getElementById("notifViagem").checked;
    preferencias.notifDespesa = document.getElementById("notifDespesa").checked;
    preferencias.notifResumoSemanal = document.getElementById("notifResumoSemanal").checked;

    salvarPreferencias();
    exibirMensagemSucesso("Preferências de notificação salvas.");
}

function salvarSistema() {
    preferencias.registrosPorPagina = document.getElementById("configRegistrosPorPagina").value;
    preferencias.formatoData = document.getElementById("configFormatoData").value;
    preferencias.confirmarExclusao = document.getElementById("configConfirmarExclusao").checked;

    salvarPreferencias();
    exibirMensagemSucesso("Preferências do sistema salvas.");
}

function alterarSenha(evento) {
    evento.preventDefault();

    const senhaAtual = document.getElementById("configSenhaAtual").value;
    const novaSenha = document.getElementById("configNovaSenha").value;
    const confirmarSenha = document.getElementById("configConfirmarSenha").value;

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
        exibirMensagemErro("Preencha todos os campos de senha.");
        return;
    }

    if (novaSenha.length < 8) {
        exibirMensagemErro("A nova senha precisa ter pelo menos 8 caracteres.");
        return;
    }

    if (novaSenha !== confirmarSenha) {
        exibirMensagemErro("As senhas não conferem.");
        return;
    }

    document.getElementById("configSenhaAtual").value = "";
    document.getElementById("configNovaSenha").value = "";
    document.getElementById("configConfirmarSenha").value = "";

    exibirMensagemSucesso("Senha alterada com sucesso.");
}

function confirmarLimpezaDados() {
    const confirmacao = confirm(
        "Atenção! Esta ação irá remover TODOS os dados do sistema (motoristas, veículos, viagens e despesas).\n\nEsta operação não pode ser desfeita.\n\nDeseja continuar?"
    );

    if (!confirmacao) return;

    const confirmacao2 = confirm("Tem certeza absoluta? Todos os dados serão perdidos permanentemente.");

    if (!confirmacao2) return;

    exibirMensagemSucesso("Solicitação de limpeza registrada. Contate o administrador do sistema.");
}

function configurarEventosConfiguracoes() {
    document.querySelectorAll(".item-menu-config").forEach(function (botao) {
        botao.addEventListener("click", function () {
            const secao = botao.dataset.secao;
            alternarSecao(secao);
        });
    });

    document
        .getElementById("formularioPerfil")
        .addEventListener("submit", salvarPerfil);

    document
        .getElementById("botaoSalvarNotificacoes")
        .addEventListener("click", salvarNotificacoes);

    document
        .getElementById("botaoSalvarSistema")
        .addEventListener("click", salvarSistema);

    document
        .getElementById("formularioSenha")
        .addEventListener("submit", alterarSenha);

    document
        .getElementById("botaoRedefinirSistema")
        .addEventListener("click", confirmarLimpezaDados);

    document
        .querySelector(".botao-sair")
        .addEventListener("click", function () {
            alert("Saindo do sistema...");
        });
}

function iniciarPaginaConfiguracoes() {
    carregarPreferencias();
    aplicarPreferenciasNaTela();
    configurarEventosConfiguracoes();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaConfiguracoes);
