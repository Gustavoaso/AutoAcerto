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
            tituloPagina: "Tudo pronto!",
            titulo: "Conta pronta para usar",
            descricao: "Sua assinatura foi confirmada e o acesso da transportadora ja esta liberado.",
            subtitulo: "Tudo certo: voce ja pode entrar no AutoAcerto com o e-mail cadastrado."
        };
    }

    if (provisionado && emailComErro) {
        return {
            classeSelo: "selo-alerta",
            classeOrb: "orb-alerta",
            tituloPagina: "Sua conta esta pronta",
            titulo: "Acesso liberado",
            descricao: "O acesso ja esta liberado. O e-mail de confirmacao ainda nao foi entregue, mas voce pode entrar normalmente.",
            subtitulo: "Sua conta ja existe. Use o e-mail cadastrado para acessar o AutoAcerto."
        };
    }

    if (provisionado) {
        return {
            classeSelo: "selo-sucesso",
            classeOrb: "orb-sucesso",
            tituloPagina: "Sua conta esta pronta",
            titulo: "Acesso liberado",
            descricao: "Pagamento confirmado e conta criada. Estamos apenas finalizando a confirmacao por e-mail.",
            subtitulo: "Voce ja pode entrar no sistema com o e-mail cadastrado."
        };
    }

    if (["active", "trialing"].includes(status)) {
        return {
            classeSelo: "selo-processando",
            classeOrb: "orb-processando",
            tituloPagina: "Estamos preparando sua conta",
            titulo: "Pagamento aprovado",
            descricao: "Recebemos a confirmacao do pagamento e estamos liberando seu acesso.",
            subtitulo: "Essa etapa costuma levar apenas alguns instantes."
        };
    }

    if (["checkout_concluido", "incomplete", "incomplete_expired"].includes(status)) {
        return {
            classeSelo: "selo-processando",
            classeOrb: "orb-processando",
            tituloPagina: "Recebemos seu pagamento",
            titulo: "Finalizando sua assinatura",
            descricao: "Estamos confirmando os ultimos detalhes para liberar sua conta.",
            subtitulo: "Deixe esta pagina aberta por alguns segundos enquanto atualizamos o status."
        };
    }

    if (["past_due", "unpaid"].includes(status)) {
        return {
            classeSelo: "selo-alerta",
            classeOrb: "orb-alerta",
            tituloPagina: "Pagamento em analise",
            titulo: "Pagamento pendente",
            descricao: "Ainda precisamos confirmar a cobranca para liberar o acesso.",
            subtitulo: "Se voce acabou de pagar, aguarde um pouco e acompanhe esta pagina."
        };
    }

    if (["canceled", "cancelled", "paused"].includes(status)) {
        return {
            classeSelo: "selo-erro",
            classeOrb: "orb-erro",
            tituloPagina: "Assinatura nao concluida",
            titulo: "Assinatura nao concluida",
            descricao: "Nao conseguimos concluir a assinatura nesta tentativa.",
            subtitulo: "Voce pode retornar para a pagina de assinatura e iniciar uma nova tentativa."
        };
    }

    if (["checkout_criado", "open", "pending", "aguardando_pagamento"].includes(status)) {
        return {
            classeSelo: "selo-pendente",
            classeOrb: "orb-pendente",
            tituloPagina: "Estamos confirmando sua assinatura",
            titulo: "Aguardando confirmacao",
            descricao: "Recebemos sua solicitacao e estamos aguardando a confirmacao do pagamento.",
            subtitulo: "Assim que a confirmacao chegar, a conta sera criada automaticamente."
        };
    }

    return {
        classeSelo: "selo-pendente",
        classeOrb: "orb-pendente",
        tituloPagina: "Estamos confirmando sua assinatura",
        titulo: "Acompanhando assinatura",
        descricao: "Recebemos sua solicitacao e estamos atualizando o status da sua conta.",
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
    const titulo = document.getElementById("tituloStatusAssinatura");
    const texto = document.getElementById("textoStatusAssinatura");
    const descricao = document.getElementById("descricaoStatusAssinatura");
    const detalhes = document.getElementById("detalhesStatusAssinatura");
    const linkLogin = document.getElementById("linkEntrarAposAssinatura");
    const mensagem = document.getElementById("mensagemStatusAssinatura");
    const metadados = obterMetadadosStatus(dados);
    const emailStatus = dados.boas_vindas_email_enviado_em
        ? "Enviado"
        : dados.boas_vindas_email_erro
            ? "Nao entregue"
            : dados.provisionado_em
                ? "Aguardando envio"
                : "Sera enviado em breve";
    const emailDetalhe = dados.boas_vindas_email_enviado_em
        ? "Confirmacao enviada em " + formatarDataStatus(dados.boas_vindas_email_enviado_em) + "."
        : dados.boas_vindas_email_erro
            ? "Seu acesso esta liberado. Voce pode tentar reenviar a confirmacao agora."
            : dados.provisionado_em
                ? "Sua conta ja esta pronta. Estamos concluindo o envio da confirmacao."
                : "Assim que o acesso estiver pronto, enviaremos a confirmacao para o e-mail cadastrado.";
    const acaoEmail = dados.provisionado_em && dados.boas_vindas_email_erro
        ? '<button type="button" class="botao-reenviar-email-status" id="botaoReenviarEmailBoasVindas">Tentar reenviar</button>'
        : "";

    if (mensagem) {
        mensagem.classList.remove("visivel", "mensagem-sucesso");
        mensagem.textContent = "";
    }

    if (selo) {
        selo.className = "selo-status-assinatura " + metadados.classeSelo;
        selo.textContent = metadados.titulo;
    }

    if (titulo) {
        titulo.textContent = metadados.tituloPagina || "Estamos confirmando sua assinatura";
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
            <small>Dados recebidos com sucesso.</small>
          </div>
          <div class="cartao-detalhe-status">
            <span class="rotulo-detalhe-status">Plano contratado</span>
            <strong>${dados.plano_nome || "-"}</strong>
            <small>${formatarMoedaStatus(dados.valor)} por mes</small>
          </div>
          <div class="cartao-detalhe-status">
            <span class="rotulo-detalhe-status">Acesso principal</span>
            <strong>${dados.provisionado_em ? "Liberado" : "Em preparacao"}</strong>
            <small>${dados.email_admin || "-"}</small>
          </div>
          <div class="cartao-detalhe-status">
            <span class="rotulo-detalhe-status">E-mail de confirmacao</span>
            <strong>${emailStatus}</strong>
            <small>${emailDetalhe}</small>
            ${acaoEmail}
          </div>
        `;
    }

    atualizarEtapasStatus(dados);

    if (dados.provisionado_em && linkLogin) {
        linkLogin.classList.remove("oculto");
        localStorage.removeItem("assinatura_referencia_ativa");
    }

    if (dados.provisionado_em && dados.boas_vindas_email_erro && mensagem) {
        mensagem.textContent = "Seu acesso ja esta liberado. O e-mail nao foi entregue nesta tentativa, mas voce pode entrar agora ou tentar reenviar a confirmacao.";
        mensagem.classList.add("visivel");
    }

    const botaoReenviarEmail = document.getElementById("botaoReenviarEmailBoasVindas");
    if (botaoReenviarEmail) {
        botaoReenviarEmail.addEventListener("click", function () {
            consultarStatusAssinatura({ reenviarEmail: true });
        });
    }
}

async function consultarStatusAssinatura(opcoes = {}) {
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
        const url = new URL(obterApiBaseStatusAssinatura() + "/assinaturas/public/status/" + encodeURIComponent(referencia));
        if (opcoes.reenviarEmail) {
            url.searchParams.set("reenviar_email", "1");
            const botaoReenviarEmail = document.getElementById("botaoReenviarEmailBoasVindas");
            if (botaoReenviarEmail) {
                botaoReenviarEmail.disabled = true;
                botaoReenviarEmail.textContent = "Reenviando...";
            }
        }

        const resposta = await fetch(url.toString());
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
