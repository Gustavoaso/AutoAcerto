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

function formatarDataStatus(valor) {
    if (!valor) return "-";

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(data);
}

function formatarMoedaStatus(valor) {
    const numero = Number(valor || 0);
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(numero);
}

function obterMetadadosStatus(dados) {
    const status = String(dados.status || "").toLowerCase();
    const provisionado = Boolean(dados.provisionado_em);
    const emailEnviado = Boolean(dados.boas_vindas_email_enviado_em);
    const emailComErro = Boolean(dados.boas_vindas_email_erro);

    if (provisionado && emailEnviado) {
        return {
            classeSelo: "selo-sucesso",
            classeOrb: "orb-sucesso",
            titulo: "Assinatura ativa e conta pronta",
            descricao: "Pagamento confirmado, ambiente criado e e-mail de boas-vindas enviado com sucesso.",
            subtitulo: "Tudo certo: voce ja pode entrar no AutoAcerto com o e-mail cadastrado."
        };
    }

    if (provisionado && emailComErro) {
        return {
            classeSelo: "selo-alerta",
            classeOrb: "orb-alerta",
            titulo: "Conta criada, mas o e-mail falhou",
            descricao: "A assinatura foi provisionada, porem o disparo do e-mail de boas-vindas nao foi concluido.",
            subtitulo: "Sua conta ja existe. Se o e-mail nao chegar, ainda assim voce pode entrar usando o login cadastrado."
        };
    }

    if (provisionado) {
        return {
            classeSelo: "selo-sucesso",
            classeOrb: "orb-sucesso",
            titulo: "Conta criada com sucesso",
            descricao: "Pagamento confirmado e ambiente provisionado. Estamos finalizando as ultimas atualizacoes.",
            subtitulo: "Voce ja pode entrar no sistema com o e-mail cadastrado."
        };
    }

    if (["active", "trialing"].includes(status)) {
        return {
            classeSelo: "selo-processando",
            classeOrb: "orb-processando",
            titulo: "Pagamento aprovado, criando ambiente",
            descricao: "A Stripe confirmou a assinatura e estamos concluindo a criacao da transportadora e do usuario administrador.",
            subtitulo: "Essa etapa costuma levar apenas alguns instantes."
        };
    }

    if (["checkout_concluido", "incomplete", "incomplete_expired"].includes(status)) {
        return {
            classeSelo: "selo-processando",
            classeOrb: "orb-processando",
            titulo: "Checkout concluido, aguardando sincronizacao",
            descricao: "Recebemos o retorno do checkout e estamos aguardando a confirmacao definitiva da assinatura pela Stripe.",
            subtitulo: "Deixe esta pagina aberta por alguns segundos enquanto atualizamos o status."
        };
    }

    if (["past_due", "unpaid"].includes(status)) {
        return {
            classeSelo: "selo-alerta",
            classeOrb: "orb-alerta",
            titulo: "Pagamento pendente de regularizacao",
            descricao: "A assinatura existe, mas a cobranca ainda precisa ser confirmada ou regularizada para liberar o acesso.",
            subtitulo: "Se voce acabou de pagar, aguarde um pouco e acompanhe esta pagina."
        };
    }

    if (["canceled", "cancelled", "paused"].includes(status)) {
        return {
            classeSelo: "selo-erro",
            classeOrb: "orb-erro",
            titulo: "Assinatura nao concluida",
            descricao: "O checkout foi interrompido ou a assinatura foi cancelada antes da ativacao completa.",
            subtitulo: "Voce pode retornar para a pagina de assinatura e iniciar uma nova tentativa."
        };
    }

    if (["checkout_criado", "open", "pending", "aguardando_pagamento"].includes(status)) {
        return {
            classeSelo: "selo-pendente",
            classeOrb: "orb-pendente",
            titulo: "Aguardando confirmacao do pagamento",
            descricao: "Seu checkout foi criado e estamos esperando a Stripe confirmar a assinatura para continuar.",
            subtitulo: "Assim que a confirmacao chegar, a conta sera criada automaticamente."
        };
    }

    return {
        classeSelo: "selo-pendente",
        classeOrb: "orb-pendente",
        titulo: "Estamos acompanhando sua assinatura",
        descricao: "O status foi registrado e seguimos consultando a Stripe para concluir o fluxo.",
        subtitulo: "Atualize em instantes se esta etapa demorar mais do que o esperado."
    };
}

function atualizarEtapasStatus(dados) {
    const status = String(dados.status || "").toLowerCase();
    const provisionado = Boolean(dados.provisionado_em);
    const emailEnviado = Boolean(dados.boas_vindas_email_enviado_em);
    const emailComErro = Boolean(dados.boas_vindas_email_erro);

    const etapas = {
        checkout: "concluida",
        assinatura: ["active", "trialing", "past_due", "unpaid", "canceled", "cancelled"].includes(status)
            ? "concluida"
            : ["checkout_concluido", "incomplete", "incomplete_expired"].includes(status)
                ? "atual"
                : "pendente",
        provisionamento: provisionado
            ? "concluida"
            : ["active", "trialing"].includes(status)
                ? "atual"
                : "pendente",
        email: emailEnviado ? "concluida" : emailComErro ? "erro" : provisionado ? "atual" : "pendente"
    };

    document.querySelectorAll(".etapa-assinatura").forEach(function (etapa) {
        const chave = etapa.getAttribute("data-etapa");
        const estado = etapas[chave] || "pendente";
        etapa.className = "etapa-assinatura etapa-" + estado;
    });
}

function preencherStatusAssinatura(dados) {
    const selo = document.getElementById("seloStatusAssinatura");
    const orb = document.getElementById("orbStatusAssinatura");
    const texto = document.getElementById("textoStatusAssinatura");
    const descricao = document.getElementById("descricaoStatusAssinatura");
    const detalhes = document.getElementById("detalhesStatusAssinatura");
    const linkLogin = document.getElementById("linkEntrarAposAssinatura");
    const mensagem = document.getElementById("mensagemStatusAssinatura");
    const metadados = obterMetadadosStatus(dados);
    const emailStatus = dados.boas_vindas_email_enviado_em
        ? "Enviado em " + formatarDataStatus(dados.boas_vindas_email_enviado_em)
        : dados.boas_vindas_email_erro
            ? "Falhou no ultimo disparo"
            : "Aguardando provisionamento";
    const emailDetalhe = dados.boas_vindas_email_enviado_em
        ? "O aviso foi processado pelo backend para o e-mail cadastrado."
        : dados.boas_vindas_email_erro
            ? dados.boas_vindas_email_erro
            : "Quando o ambiente estiver pronto, o aviso sera disparado para o e-mail cadastrado.";

    if (mensagem) {
        mensagem.classList.remove("visivel", "mensagem-sucesso");
        mensagem.textContent = "";
    }

    if (selo) {
        selo.className = "selo-status-assinatura " + metadados.classeSelo;
        selo.textContent = metadados.titulo;
    }

    if (orb) {
        orb.className = "orb-status-assinatura " + metadados.classeOrb;
    }

    if (texto) {
        texto.textContent = metadados.subtitulo;
    }

    if (descricao) {
        descricao.textContent = metadados.descricao;
    }

    if (detalhes) {
        detalhes.innerHTML = `
          <div class="cartao-detalhe-status">
            <span class="rotulo-detalhe-status">Transportadora</span>
            <strong>${dados.nome_transportadora || "-"}</strong>
            <small>CNPJ e dados serao vinculados assim que o fluxo terminar.</small>
          </div>
          <div class="cartao-detalhe-status">
            <span class="rotulo-detalhe-status">Plano contratado</span>
            <strong>${dados.plano_nome || "-"}</strong>
            <small>${formatarMoedaStatus(dados.valor)} por mes</small>
          </div>
          <div class="cartao-detalhe-status">
            <span class="rotulo-detalhe-status">Administrador inicial</span>
            <strong>${dados.nome_admin || "-"}</strong>
            <small>${dados.email_admin || "-"}</small>
          </div>
          <div class="cartao-detalhe-status">
            <span class="rotulo-detalhe-status">E-mail de boas-vindas</span>
            <strong>${emailStatus}</strong>
            <small>${emailDetalhe}</small>
          </div>
        `;
    }

    atualizarEtapasStatus(dados);

    if (dados.provisionado_em && linkLogin) {
        linkLogin.classList.remove("oculto");
        localStorage.removeItem("assinatura_referencia_ativa");
    }

    if (dados.provisionado_em && dados.boas_vindas_email_erro && mensagem) {
        mensagem.textContent = "A conta foi criada, mas o e-mail de boas-vindas falhou. Voce ja pode entrar normalmente e revisar a configuracao SMTP no backend.";
        mensagem.classList.add("visivel");
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

        if (!dados.provisionado_em && !["cancelled", "canceled", "paused"].includes(String(dados.status || "").toLowerCase())) {
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
