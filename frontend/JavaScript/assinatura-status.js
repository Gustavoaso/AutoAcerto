function obterApiBaseStatusAssinatura() {
    return window.obterApiBase ? window.obterApiBase() : window.location.origin.replace(/\/+$/, "");
}

function obterReferenciaAssinatura() {
    const parametros = new URLSearchParams(window.location.search);
    return parametros.get("external_reference") ||
        parametros.get("referencia") ||
        localStorage.getItem("assinatura_referencia_ativa") ||
        "";
}

function traduzirStatusAssinatura(status) {
    switch (String(status || "").toLowerCase()) {
        case "authorized":
            return { texto: "Assinatura confirmada", classe: "selo-sucesso" };
        case "pending":
        case "aguardando_pagamento":
            return { texto: "Aguardando confirmacao", classe: "selo-pendente" };
        case "cancelled":
            return { texto: "Assinatura cancelada", classe: "selo-erro" };
        case "paused":
            return { texto: "Assinatura pausada", classe: "selo-erro" };
        default:
            return { texto: status || "Em analise", classe: "selo-pendente" };
    }
}

function preencherStatusAssinatura(dados) {
    const traducao = traduzirStatusAssinatura(dados.status);
    const selo = document.getElementById("seloStatusAssinatura");
    const detalhes = document.getElementById("detalhesStatusAssinatura");
    const texto = document.getElementById("textoStatusAssinatura");
    const linkLogin = document.getElementById("linkEntrarAposAssinatura");

    if (selo) {
        selo.className = "selo-status-assinatura " + traducao.classe;
        selo.textContent = traducao.texto;
    }

    if (texto) {
        texto.textContent = dados.provisionado_em
            ? "Pagamento confirmado e conta criada. Voce ja pode entrar no sistema com o e-mail cadastrado."
            : "Recebemos sua assinatura e estamos aguardando a confirmacao do Mercado Pago para criar sua conta.";
    }

    if (detalhes) {
        detalhes.innerHTML = `
          <div><strong>Transportadora:</strong> ${dados.nome_transportadora || "-"}</div>
          <div><strong>Plano:</strong> ${dados.plano_nome || "-"}</div>
          <div><strong>Administrador inicial:</strong> ${dados.nome_admin || "-"} (${dados.email_admin || "-"})</div>
        `;
    }

    if (dados.provisionado_em && linkLogin) {
        linkLogin.classList.remove("oculto");
        localStorage.removeItem("assinatura_referencia_ativa");
    }
}

async function consultarStatusAssinatura() {
    const referencia = obterReferenciaAssinatura();
    const mensagem = document.getElementById("mensagemStatusAssinatura");

    if (!referencia) {
        if (mensagem) {
            mensagem.textContent = "Nao encontramos a referencia da assinatura para acompanhar o status.";
            mensagem.classList.add("visivel");
        }
        return;
    }

    try {
        const resposta = await fetch(obterApiBaseStatusAssinatura() + "/assinaturas/public/status/" + encodeURIComponent(referencia));
        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || "status");
        }

        preencherStatusAssinatura(dados);

        if (!dados.provisionado_em && !["cancelled", "paused"].includes(String(dados.status || "").toLowerCase())) {
            window.setTimeout(consultarStatusAssinatura, 5000);
        }
    } catch (erro) {
        if (mensagem) {
            mensagem.textContent = "Ainda nao foi possivel confirmar a assinatura. Atualize a pagina em alguns instantes.";
            mensagem.classList.add("visivel");
        }
    }
}

document.addEventListener("DOMContentLoaded", consultarStatusAssinatura);
