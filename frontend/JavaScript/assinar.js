function obterApiBaseAssinatura() {
    return window.obterApiBase ? window.obterApiBase() : window.location.origin.replace(/\/+$/, "");
}

const urlPlanosAssinatura = obterApiBaseAssinatura() + "/assinaturas/public/planos";
const urlContratarAssinatura = obterApiBaseAssinatura() + "/assinaturas/public/contratar";

let planoSelecionado = "profissional";

function formatarMoedaAssinatura(valor) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(valor || 0));
}

function exibirErroAssinatura(mensagem) {
    const elemento = document.getElementById("erroAssinatura");
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.classList.add("visivel");
}

function limparErroAssinatura() {
    const elemento = document.getElementById("erroAssinatura");
    if (!elemento) return;
    elemento.textContent = "";
    elemento.classList.remove("visivel");
}

function criarCartaoPlano(plano) {
    const ativo = plano.codigo === planoSelecionado;
    const limiteVeiculos = plano.limiteVeiculos == null
        ? "Veiculos ilimitados"
        : "Ate " + plano.limiteVeiculos + " veiculos";

    return `
      <button type="button" class="cartao-plano-assinatura${ativo ? " ativo" : ""}" data-plano="${plano.codigo}">
        <span class="tag-plano-assinatura">${plano.codigo}</span>
        <strong>${plano.nome}</strong>
        <span class="preco-plano-assinatura">${formatarMoedaAssinatura(plano.valor)}<small>/mes</small></span>
        <span class="descricao-plano-assinatura">${plano.descricao || ""}</span>
        <span class="descricao-plano-assinatura">${limiteVeiculos}</span>
      </button>
    `;
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

        grade.innerHTML = planos.map(criarCartaoPlano).join("");

        grade.querySelectorAll("[data-plano]").forEach(function (botao) {
            botao.addEventListener("click", function () {
                planoSelecionado = botao.getAttribute("data-plano");
                carregarPlanos();
            });
        });
    } catch {
        grade.innerHTML = '<div class="texto-carregando-assinatura">Nao foi possivel carregar os planos agora.</div>';
    }
}

function configurarFormularioAssinatura() {
    const formulario = document.getElementById("formularioAssinatura");
    const botao = document.getElementById("botaoAssinarAgora");
    if (!formulario || !botao) return;

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
        botao.textContent = "Preparando checkout...";

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
