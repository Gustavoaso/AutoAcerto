// =============================================================
// AUTOACERTO â€” VER TRANSPORTADORA
// =============================================================

const urlApiTransportadoras = montarUrlApi("/transportadoras");

function obterParametroUrl(nome) {
    const params = new URLSearchParams(window.location.search);
    return params.get(nome);
}

function formatarDataTransportadora(dataISO) {
    if (!dataISO) return "â€”";
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return dia + "/" + mes + "/" + ano;
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

async function carregarDetalhesTransportadora() {
    const id = obterParametroUrl("id");
    if (!id) {
        exibirToastTransportadora("ID da transportadora nÃ£o informado.", "erro");
        setTimeout(() => window.location.href = "transportadoras.html", 2000);
        return;
    }

    try {
        const resposta = await fetch(urlApiTransportadoras + "/" + id,{ headers: cabecalhosAutenticados() });

        if (!resposta.ok) {
            exibirToastTransportadora("Erro ao carregar transportadora.", "erro");
            return;
        }

        const transportadora = await resposta.json();
        renderizarDetalhes(transportadora);
    } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro.message);
        exibirToastTransportadora("Erro de conexÃ£o com o servidor.", "erro");
    }
}

function renderizarDetalhes(t) {
    const container = document.getElementById("containerDetalhes");
    if (!container) return;
    const nomeTransportadora = window.AutoAcertoHtml.texto(t.nome, "-");
    const cnpjTransportadora = window.AutoAcertoHtml.texto(t.cnpj, "Não informado");
    const totalAdmins = Number(t.total_admins || 0);

    const seloStatus = t.ativo
        ? '<span class="selo-status selo-ativo">Ativa</span>'
        : '<span class="selo-status selo-inativo">Inativa</span>';

    container.innerHTML = `
        <div class="linha-info">
            <span class="rotulo-info">Nome:</span>
            <span class="valor-info">${nomeTransportadora}</span>
        </div>
        <div class="linha-info">
            <span class="rotulo-info">CNPJ:</span>
            <span class="valor-info">${cnpjTransportadora}</span>
        </div>
        <div class="linha-info">
            <span class="rotulo-info">Status:</span>
            <span class="valor-info">${seloStatus}</span>
        </div>
        <div class="linha-info">
            <span class="rotulo-info">Data de cadastro:</span>
            <span class="valor-info">${formatarDataTransportadora(t.data_cadastro)}</span>
        </div>
        <div class="linha-info">
            <span class="rotulo-info">Total de administradores:</span>
            <span class="valor-info">${totalAdmins}</span>
        </div>
    `;
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
    window.location.href = "transportadoras.html";
});

document.getElementById("botaoEditar").addEventListener("click", function () {
    const id = obterParametroUrl("id");
    window.location.href = "editar-transportadora.html?id=" + id;
});

document.addEventListener("DOMContentLoaded", carregarDetalhesTransportadora);

