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
    const isProfissional = plano.codigo === "profissional";
    const featuredClass = isProfissional ? " featured" : "";
    const ativoClass = ativo ? " ativo" : "";

    let featuresHtml = "";
    if (plano.codigo === "essencial") {
        featuresHtml = `
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Até 10 veículos</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Dashboard completo</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Gestão de motoristas e viagens</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Controle de despesas</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Relatórios e exportação CSV</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Suporte por e-mail</div>
        `;
    } else if (plano.codigo === "profissional") {
        featuresHtml = `
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Até 20 veículos</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Tudo do plano Essencial</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Multi-usuário com perfis</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Notificações internas</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Anexo de cupom fiscal</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Suporte prioritário</div>
        `;
    } else if (plano.codigo === "escala") {
        featuresHtml = `
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Veículos ilimitados</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Tudo do plano Profissional</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Multi-transportadora</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Gestão centralizada</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Relatórios avançados</div>
            <div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Suporte dedicado</div>
        `;
    } else {
        featuresHtml = `<div class="plano-feature"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${plano.limiteVeiculos ? "Até " + plano.limiteVeiculos + " veículos" : "Veículos ilimitados"}</div>`;
    }

    const valorFormatado = plano.valor.toString();
    const partesValor = valorFormatado.split(".");
    const reais = partesValor[0];
    const centavos = partesValor.length > 1 ? "," + partesValor[1].padEnd(2, "0") : ",00";

    return `
      <div class="cartao-plano-assinatura${featuredClass}${ativoClass}" data-plano="${plano.codigo}">
        ${isProfissional ? '<div class="plano-popular">Mais escolhido</div>' : ''}
        <div class="plano-nome">${plano.nome}</div>
        <div class="plano-preco">
          <span class="plano-moeda">R$</span>
          <span class="plano-valor">${reais}</span>
          <span class="plano-periodo">${centavos}/mês</span>
        </div>
        <p class="plano-descricao">${plano.descricao || ""}</p>
        <div class="plano-features">
          ${featuresHtml}
        </div>
        <button type="button" class="plano-botao${isProfissional ? ' primario' : ' secundario'}">Começar agora</button>
      </div>
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
