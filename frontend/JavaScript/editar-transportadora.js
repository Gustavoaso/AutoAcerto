// =============================================================
// AUTOACERTO — EDITAR TRANSPORTADORA
// =============================================================

const urlApiTransportadoras = montarUrlApi("/transportadoras");

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

function iniciarPaginaEdicao() {
    const formulario = document.getElementById("formularioEditarTransportadora");
    if (formulario) {
        formulario.addEventListener("submit", salvarEdicao);
    }
    carregarDadosTransportadora();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaEdicao);
