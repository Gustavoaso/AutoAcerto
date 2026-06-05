function obterApiBaseAssinatura() {
    return window.obterApiBase ? window.obterApiBase() : window.location.origin.replace(/\/+$/, "");
}
function formatarMoedaAssinatura(valor) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(valor || 0));
}

function renderizarPlanos(grade, planos) {
    grade.innerHTML = planos.map(function (plano) {
        return `
          <button type="button" class="cartao-plano-assinatura${plano.codigo === planoSelecionado ? " ativo" : ""}" data-plano="${plano.codigo}">
            <span class="tag-plano-assinatura">${plano.codigo}</span>
            <strong>${plano.nome}</strong>
            <span class="preco-plano-assinatura">${formatarMoedaAssinatura(plano.valor)}<small>/mes</small></span>
            <span class="descricao-plano-assinatura">${plano.descricao || ""}</span>
          </button>
        `;
    }).join("");
}

function atualizarPlanoSelecionado(grade) {
    grade.querySelectorAll("[data-plano]").forEach(function (botao) {
        botao.classList.toggle("ativo", botao.dataset.plano === planoSelecionado);
    });
}

async function carregarPlanos() {
    const grade = document.getElementById("gradePlanosAssinatura");
    if (!grade) return;

    grade.innerHTML = '<div class="texto-carregando-assinatura">Carregando planos...</div>';

    try {
        const resposta = await fetch(urlPlanosAssinatura);
        const planos = await resposta.json();

        if (!resposta.ok || !Array.isArray(planos)) {
            throw new Error("planos");
        }

        if (!planos.some(function (plano) { return plano.codigo === planoSelecionado; }) && planos[0]) {
            planoSelecionado = planos[0].codigo;
        }

        renderizarPlanos(grade, planos);

        grade.onclick = function (evento) {
            const botao = evento.target.closest("[data-plano]");
            if (!botao) return;

            planoSelecionado = botao.dataset.plano;
            atualizarPlanoSelecionado(grade);
        };
    } catch {
        grade.innerHTML = '<div class="texto-carregando-assinatura">Nao foi possivel carregar os planos agora.</div>';
    }
}

function configurarFormularioAssinatura() {
    const formulario = document.getElementById("formularioAssinatura");
    const botao = document.getElementById("botaoAssinarAgora");

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        limparErroAssinatura();

        const corpo = {
            plano: planoSelecionado,
            nomeTransportadora: document.getElementById("campoNomeTransportadoraAssinatura").value.trim(),
            cnpj: document.getElementById("campoCnpjTransportadoraAssinatura").value.trim(),
            nomeAdmin: document.getElementById("campoNomeAdminAssinatura").value.trim(),
            emailAdmin: document.getElementById("campoEmailAdminAssinatura").value.trim(),
            senhaAdmin: document.getElementById("campoSenhaAdminAssinatura").value
        };

        if (!corpo.nomeTransportadora || !corpo.nomeAdmin || !corpo.emailAdmin || !corpo.senhaAdmin) {
            exibirErroAssinatura("Preencha todos os campos obrigatorios antes de continuar.");
            return;
        }

        if (corpo.senhaAdmin.length < 8) {
            exibirErroAssinatura("A senha inicial precisa ter pelo menos 8 caracteres.");
            return;
        }

        botao.disabled = true;
        botao.textContent = "Preparando pagamento...";

        try {
            const resposta = await fetch(urlContratarAssinatura, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(corpo)
            });

            const retorno = await resposta.json();

            if (!resposta.ok) {
                exibirErroAssinatura(retorno.mensagem || "Nao foi possivel iniciar a assinatura.");
                return;
            }

            localStorage.setItem("assinatura_referencia_ativa", retorno.referencia_externa);
            window.location.href = retorno.checkout_url;
        } catch {
            exibirErroAssinatura("Nao foi possivel conectar ao servidor para iniciar a assinatura.");
        } finally {
            botao.disabled = false;
            botao.textContent = "Continuar para o pagamento";
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    carregarPlanos();
    configurarFormularioAssinatura();
});
