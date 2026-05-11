// =============================================================
// AUTOACERTO — LOGIN
// Controle do formulário de autenticação.
// =============================================================

function obterApiBaseLogin() {
    const metaApi = document.querySelector('meta[name="autoacerto-api-base"]');
    const configurada =
        window.AUTOACERTO_API_BASE_URL ||
        (metaApi ? metaApi.getAttribute("content") : "") ||
        localStorage.getItem("AUTOACERTO_API_BASE_URL");
    if (configurada && String(configurada).trim()) {
        return String(configurada).trim().replace(/\/+$/, "");
    }
    return window.location.origin.replace(/\/+$/, "");
}

const urlApiLogin = obterApiBaseLogin() + "/auth/login";

function redirecionarPorPerfil(perfil) {
    if (perfil === "dono") {
        window.location.href = "/frontend/HTML/transportadoras.html";
    } else if (perfil === "admin") {
        window.location.href = "/frontend/HTML/index.html";
    } else {
        window.location.href = "/frontend/HTML/viagens.html";
    }
}

function verificarSessaoExistente() {
    try {
        const token = localStorage.getItem("token");
        const usuario = JSON.parse(localStorage.getItem("usuario"));
        if (token && usuario) {
            redirecionarPorPerfil(usuario.perfil);
        }
    } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
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
    elemento.classList.remove("visivel");
}

function exibirErroCampo(idCampo, mensagem) {
    const input = document.getElementById(idCampo);
    const erro  = document.getElementById("erro" + idCampo.replace("campo", ""));
    if (input) input.classList.add("campo-invalido");
    if (erro) erro.textContent = mensagem;
}

function limparErroCampo(idCampo) {
    const input = document.getElementById(idCampo);
    const erro  = document.getElementById("erro" + idCampo.replace("campo", ""));
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

function configurarFormulario() {
    const formulario = document.getElementById("formularioLogin");
    const botao      = document.getElementById("botaoEntrar");

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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                exibirErroGeral(dados.mensagem || "Erro ao realizar login.");
                return;
            }

            localStorage.setItem("token", dados.token);
            localStorage.setItem("usuario", JSON.stringify(dados.usuario));

            redirecionarPorPerfil(dados.usuario.perfil);

        } catch (erro) {
            console.error("Erro ao conectar com o servidor:", erro.message);
            exibirErroGeral("Não foi possível conectar ao servidor. Verifique a URL da API e se o backend está online.");
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
    configurarFormulario();
});
