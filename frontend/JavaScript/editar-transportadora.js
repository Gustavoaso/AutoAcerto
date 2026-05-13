// =============================================================
// AUTOACERTO — EDITAR TRANSPORTADORA
// =============================================================

const urlApiTransportadoras = montarUrlApi("/transportadoras");
const urlApiUsuarios = montarUrlApi("/usuarios");

function obterParametroUrl(nome) {
    const params = new URLSearchParams(window.location.search);
    return params.get(nome);
}

function exibirToastTransportadora(mensagem, tipo) {
    const toast = document.getElementById("toastTransportadora");
    if (!toast) return;

    toast.textContent = mensagem;
    toast.className = "toast-configuracao ativo toast-" + tipo;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
        toast.classList.remove("ativo");
    }, 3500);
}

async function carregarDadosTransportadora() {
    const id = obterParametroUrl("id");
    if (!id) {
        exibirToastTransportadora("ID da transportadora não informado.", "erro");
        setTimeout(() => window.location.href = "transportadoras.html", 2000);
        return;
    }

    try {
        const resposta = await fetch(urlApiTransportadoras + "/" + id);

        if (!resposta.ok) {
            exibirToastTransportadora("Erro ao carregar transportadora.", "erro");
            return;
        }

        const transportadora = await resposta.json();
        preencherFormulario(transportadora);
    } catch (erro) {
        console.error("Erro ao carregar dados:", erro.message);
        exibirToastTransportadora("Erro de conexão com o servidor.", "erro");
    }
}

function preencherFormulario(t) {
    document.getElementById("campoNomeTransportadora").value = t.nome || "";
    const cnpjEl = document.getElementById("campoCnpjTransportadora");
    cnpjEl.value = t.cnpj || "";
    if (window.AutoAcertoMascaras) {
        cnpjEl.value = window.AutoAcertoMascaras.aplicarCnpj(cnpjEl.value);
    }
    document.getElementById("campoStatusTransportadora").value = t.ativo ? "true" : "false";
}

async function salvarEdicao(evento) {
    evento.preventDefault();

    const id = obterParametroUrl("id");
    if (!id) return;

    const dados = {
        nome: document.getElementById("campoNomeTransportadora").value.trim(),
        cnpj: document.getElementById("campoCnpjTransportadora").value.trim(),
        ativo: document.getElementById("campoStatusTransportadora").value === "true"
    };

    if (!dados.nome) {
        exibirToastTransportadora("O nome da transportadora é obrigatório.", "erro");
        return;
    }

    const botao = document.getElementById("botaoSalvarEdicao");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
        const resposta = await fetch(urlApiTransportadoras + "/" + id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dados)
        });

        const retorno = await resposta.json();

        if (!resposta.ok) {
            exibirToastTransportadora(retorno.mensagem || "Erro ao atualizar transportadora.", "erro");
            return;
        }

        exibirToastTransportadora(retorno.mensagem, "sucesso");
        setTimeout(() => window.location.href = "transportadoras.html", 1500);
    } catch (erro) {
        console.error("Erro ao salvar edição:", erro.message);
        exibirToastTransportadora("Erro de conexão com o servidor.", "erro");
    } finally {
        botao.disabled = false;
        botao.textContent = "Salvar alterações";
    }
}


async function criarAdministradorTransportadora() {
    const transportadoraId = obterParametroUrl("id");

    const nome = document.getElementById("campoNomeAdmin").value.trim();
    const email = document.getElementById("campoEmailAdmin").value.trim();
    const senha = document.getElementById("campoSenhaAdmin").value.trim();
    const ativo = document.getElementById("campoStatusAdmin").value === "true";

    const mensagem = document.getElementById("mensagemRetornoAdmin");

    mensagem.textContent = "";
    mensagem.className = "mensagem-retorno";

    if (!nome || !email || !senha) {
        mensagem.textContent = "Preencha todos os campos do administrador.";
        mensagem.classList.add("erro");
        return;
    }

    if (senha.length < 8) {
        mensagem.textContent = "A senha deve possuir no mínimo 8 caracteres.";
        mensagem.classList.add("erro");
        return;
    }

    const botao = document.getElementById("botaoCriarAdmin");
    botao.disabled = true;
    botao.textContent = "Criando...";

    try {
        const resposta = await fetch(urlApiUsuarios, {
            method: "POST",
            headers: cabecalhosAutenticados(),
            body: JSON.stringify({
                transportadora_id: parseInt(transportadoraId, 10),
                nome,
                email,
                senha,
                perfil: "admin",
                ativo,
                motorista_id: null
            })
        });

        const retorno = await resposta.json();

        if (!resposta.ok) {
            mensagem.textContent = retorno.mensagem || "Erro ao criar administrador.";
            mensagem.classList.add("erro");
            return;
        }

        mensagem.textContent = "Administrador criado com sucesso.";
        mensagem.classList.add("sucesso");

        document.getElementById("campoNomeAdmin").value = "";
        document.getElementById("campoEmailAdmin").value = "";
        document.getElementById("campoSenhaAdmin").value = "";
        document.getElementById("campoStatusAdmin").value = "true";

    } catch (erro) {
        console.error("Erro ao criar administrador:", erro.message);

        mensagem.textContent = "Erro de conexão com o servidor.";
        mensagem.classList.add("erro");
    } finally {
        botao.disabled = false;
        botao.textContent = "Criar administrador";
    }
}


function iniciarPaginaEdicao() {
    const formulario = document.getElementById("formularioEditarTransportadora");

    if (formulario) {
        formulario.addEventListener("submit", salvarEdicao);
    }

    const botaoSalvar = document.getElementById("botaoSalvarEdicao");

    if (botaoSalvar) {
        botaoSalvar.addEventListener("click", salvarEdicao);
    }

    const botaoCriarAdmin = document.getElementById("botaoCriarAdmin");

    if (botaoCriarAdmin) {
        botaoCriarAdmin.addEventListener("click", criarAdministradorTransportadora);
    }

    carregarDadosTransportadora();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaEdicao);
