function obterApiBaseLogin() {
    return window.obterApiBase ? window.obterApiBase() : window.location.origin.replace(/\/+$/, "");
}

const urlApiLogin = obterApiBaseLogin() + "/auth/login";
const urlApiRecuperarSenha = obterApiBaseLogin() + "/auth/recuperar-senha";
const urlApiContato = obterApiBaseLogin() + "/auth/contato";

function redirecionarPorPerfil(perfil) {
    if (perfil === "dono") {
        window.location.href = "/transportadoras.html";
    } else if (perfil === "admin") {
        window.location.href = "/index.html";
    } else {
        window.location.href = "/viagens.html";
    }
}

async function verificarSessaoExistente() {
    try {
        const usuario = JSON.parse(localStorage.getItem("usuario"));
        const token = localStorage.getItem("token");
        if (!usuario) return;

        const resposta = await fetch(obterApiBaseLogin() + "/auth/me", {
            credentials: "include",
            headers: token ? { Authorization: "Bearer " + token } : {}
        });

        if (resposta.ok) {
            redirecionarPorPerfil(usuario.perfil);
            return;
        }

        localStorage.removeItem("sessao_expira_em");
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
    } catch {
        localStorage.removeItem("sessao_expira_em");
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
    }
}

function exibirErroGeral(mensagem) {
    const elemento = document.getElementById("erroGeral");
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.classList.add("visivel");
}

function limparErroGeral() {
    const elemento = document.getElementById("erroGeral");
    if (!elemento) return;
    elemento.textContent = "";
    elemento.classList.remove("visivel", "mensagem-sucesso");
}

function exibirErroCampo(idCampo, mensagem) {
    const input = document.getElementById(idCampo);
    const erro = document.getElementById("erro" + idCampo.replace("campo", ""));
    if (input) input.classList.add("campo-invalido");
    if (erro) erro.textContent = mensagem;
}

function limparErroCampo(idCampo) {
    const input = document.getElementById(idCampo);
    const erro = document.getElementById("erro" + idCampo.replace("campo", ""));
    if (input) input.classList.remove("campo-invalido");
    if (erro) erro.textContent = "";
}

function configurarToggleSenha() {
    const botao = document.getElementById("botaoVerSenha");
    const campo = document.getElementById("campoSenha");
    if (!botao || !campo) return;

    botao.addEventListener("click", function () {
        const visivel = campo.type === "text";
        campo.type = visivel ? "password" : "text";
        botao.setAttribute("aria-label", visivel ? "Mostrar senha" : "Ocultar senha");
    });
}

function abrirModal(idModal) {
    const modal = document.getElementById(idModal);
    if (!modal) return;
    modal.classList.remove("oculto");
    modal.setAttribute("aria-hidden", "false");
}

function fecharModal(modal) {
    if (!modal) return;
    modal.classList.add("oculto");
    modal.setAttribute("aria-hidden", "true");
}

function exibirMensagemModal(idElemento, mensagem, tipo) {
    const elemento = document.getElementById(idElemento);
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.classList.toggle("mensagem-sucesso", tipo === "sucesso");
}

function configurarAcoesAuxiliares() {
    const linkEsqueciSenha = document.getElementById("linkEsqueciSenha");
    const linkFaleConosco = document.getElementById("linkFaleConosco");

    if (linkEsqueciSenha) {
        linkEsqueciSenha.addEventListener("click", function (evento) {
            evento.preventDefault();
            exibirMensagemModal("mensagemRecuperarSenha", "", "erro");
            document.getElementById("campoEmailRecuperacao").value = document.getElementById("campoEmail").value.trim();
            abrirModal("modalRecuperarSenha");
        });
    }

    if (linkFaleConosco) {
        linkFaleConosco.addEventListener("click", function (evento) {
            evento.preventDefault();
            exibirMensagemModal("mensagemContatoTime", "", "erro");
            document.getElementById("campoEmailContato").value = document.getElementById("campoEmail").value.trim();
            abrirModal("modalContatoTime");
        });
    }

    document.querySelectorAll("[data-fechar-modal]").forEach(function (botao) {
        botao.addEventListener("click", function () {
            fecharModal(botao.closest(".modal-login"));
        });
    });
}

function configurarFormularioRecuperacao() {
    const formulario = document.getElementById("formularioRecuperarSenha");
    if (!formulario) return;

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        const campoEmail = document.getElementById("campoEmailRecuperacao");
        const botao = formulario.querySelector("button[type='submit']");
        exibirMensagemModal("mensagemRecuperarSenha", "", "erro");

        botao.disabled = true;
        botao.textContent = "Enviando...";

        try {
            const resposta = await fetch(urlApiRecuperarSenha, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: campoEmail.value.trim() })
            });

            const dados = await resposta.json();
            if (!resposta.ok) {
                exibirMensagemModal("mensagemRecuperarSenha", dados.mensagem || "Nao foi possivel enviar o link.", "erro");
                return;
            }

            exibirMensagemModal("mensagemRecuperarSenha", dados.mensagem, "sucesso");
            formulario.reset();
        } catch (erro) {
            exibirMensagemModal("mensagemRecuperarSenha", "Nao foi possivel enviar o link agora.", "erro");
        } finally {
            botao.disabled = false;
            botao.textContent = "Enviar link";
        }
    });
}

function configurarFormularioContato() {
    const formulario = document.getElementById("formularioContatoTime");
    if (!formulario) return;

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        const botao = formulario.querySelector("button[type='submit']");
        exibirMensagemModal("mensagemContatoTime", "", "erro");

        const corpo = {
            nome: document.getElementById("campoNomeContato").value.trim(),
            email: document.getElementById("campoEmailContato").value.trim(),
            mensagem: document.getElementById("campoMensagemContato").value.trim()
        };

        botao.disabled = true;
        botao.textContent = "Enviando...";

        try {
            const resposta = await fetch(urlApiContato, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(corpo)
            });

            const dados = await resposta.json();
            if (!resposta.ok) {
                exibirMensagemModal("mensagemContatoTime", dados.mensagem || "Nao foi possivel enviar a mensagem.", "erro");
                return;
            }

            exibirMensagemModal("mensagemContatoTime", dados.mensagem, "sucesso");
            formulario.reset();
        } catch (erro) {
            exibirMensagemModal("mensagemContatoTime", "Nao foi possivel enviar a mensagem agora.", "erro");
        } finally {
            botao.disabled = false;
            botao.textContent = "Enviar mensagem";
        }
    });
}

function configurarFormulario() {
    const formulario = document.getElementById("formularioLogin");
    const botao = document.getElementById("botaoEntrar");

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        limparErroGeral();
        limparErroCampo("campoEmail");
        limparErroCampo("campoSenha");

        const email = document.getElementById("campoEmail").value.trim();
        const senha = document.getElementById("campoSenha").value;
        let valido = true;

        if (!email) {
            exibirErroCampo("campoEmail", "Informe seu e-mail.");
            valido = false;
        }

        if (!senha) {
            exibirErroCampo("campoSenha", "Informe sua senha.");
            valido = false;
        }

        if (!valido) return;

        botao.disabled = true;
        botao.classList.add("carregando");
        botao.textContent = "Entrando...";

        try {
            const resposta = await fetch(urlApiLogin, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, senha: senha })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                exibirErroGeral(dados.mensagem || "Erro ao realizar login.");
                return;
            }

            localStorage.setItem("usuario", JSON.stringify(dados.usuario));
            if (dados.token) {
                localStorage.setItem("token", dados.token);
            }
            if (dados.sessao_expira_em) {
                localStorage.setItem("sessao_expira_em", dados.sessao_expira_em);
            }

            redirecionarPorPerfil(dados.usuario.perfil);
        } catch (erro) {
            console.error("Erro ao conectar com o servidor:", erro.message);
            exibirErroGeral("Nao foi possivel conectar ao servidor. Verifique a API e tente novamente.");
        } finally {
            botao.disabled = false;
            botao.classList.remove("carregando");
            botao.textContent = "Entrar";
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    verificarSessaoExistente();
    configurarToggleSenha();
    configurarAcoesAuxiliares();
    configurarFormularioRecuperacao();
    configurarFormularioContato();
    configurarFormulario();
});
