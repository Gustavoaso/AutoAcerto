// =============================================================
// AUTOACERTO - VER TRANSPORTADORA
// =============================================================

const urlApiTransportadoras = montarUrlApi("/transportadoras");

function obterParametroUrl(nome) {
    const params = new URLSearchParams(window.location.search);
    return params.get(nome);
}

function formatarDataTransportadora(dataISO) {
    if (!dataISO) return "-";
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return dia + "/" + mes + "/" + ano;
}

function formatarMoedaTransportadora(valor) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(valor || 0));
}

function definirTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
}

function definirHtml(id, html) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.innerHTML = html;
}

function obterTextoStatusAssinatura(status) {
    const statusTratado = String(status || "").toLowerCase();
    if (!statusTratado) return "Sem assinatura";
    if (statusTratado === "active" || statusTratado === "trialing") return "Ativa";
    if (statusTratado === "past_due" || statusTratado === "incomplete") return "Pagamento pendente";
    if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(statusTratado)) return "Bloqueada";
    return statusTratado;
}

function criarGrupoDetalheAssinatura(rotulo, id) {
    return `
        <div class="grupo-detalhe">
            <span class="rotulo-detalhe">${rotulo}</span>
            <span class="valor-detalhe" id="${id}">-</span>
        </div>
    `;
}

function garantirCamposAssinatura() {
    const grade = document.querySelector(".grade-detalhes-transportadoras");
    if (!grade || document.getElementById("detalhePlanoAssinatura")) return;

    grade.insertAdjacentHTML("beforeend",
        criarGrupoDetalheAssinatura("Plano da assinatura", "detalhePlanoAssinatura") +
        criarGrupoDetalheAssinatura("Status da assinatura", "detalheStatusAssinatura") +
        criarGrupoDetalheAssinatura("Proxima cobranca", "detalheProximaCobranca") +
        criarGrupoDetalheAssinatura("ID assinatura Stripe", "detalheAssinaturaGateway")
    );
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
        exibirToastTransportadora("ID da transportadora não informado.", "erro");
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
        exibirToastTransportadora("Erro de conexão com o servidor.", "erro");
    }
}

function renderizarDetalhes(t) {
    garantirCamposAssinatura();

    const nomeTransportadora = window.AutoAcertoHtml.texto(t.nome, "-");
    const cnpjTransportadora = window.AutoAcertoHtml.texto(t.cnpj, "Não informado");

    const seloStatus = t.ativo
        ? '<span class="selo-status selo-ativo">Ativa</span>'
        : '<span class="selo-status selo-inativo">Inativa</span>';

    const planoAssinatura = t.assinatura_plano_nome
        ? window.AutoAcertoHtml.texto(t.assinatura_plano_nome, "-") + " - " + formatarMoedaTransportadora(t.assinatura_valor)
        : "Sem assinatura local";

    definirTexto("detalheNome", t.nome || "-");
    definirTexto("detalheCnpjTopo", t.cnpj || "CNPJ nao informado");
    definirTexto("detalheNomeGrid", nomeTransportadora);
    definirTexto("detalheCnpj", cnpjTransportadora);
    definirHtml("detalheStatus", seloStatus);
    definirTexto("detalheDataCadastro", formatarDataTransportadora(t.data_cadastro));
    definirTexto("detalhePlanoAssinatura", planoAssinatura);
    definirTexto("detalheStatusAssinatura", obterTextoStatusAssinatura(t.assinatura_status));
    definirTexto("detalheProximaCobranca", formatarDataTransportadora(t.assinatura_proxima_cobranca_em));
    definirTexto("detalheAssinaturaGateway", t.assinatura_gateway_id || "-");
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
    window.location.href = "transportadoras.html";
});

document.getElementById("botaoEditar").addEventListener("click", function () {
    const id = obterParametroUrl("id");
    window.location.href = "editar-transportadora.html?id=" + id;
});

document.addEventListener("DOMContentLoaded", carregarDetalhesTransportadora);

