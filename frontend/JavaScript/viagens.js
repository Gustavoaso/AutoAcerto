const urlApiViagens = montarUrlApi("/viagens");

let viagens = [];
let viagensVisiveis = [];
let exclusaoViagens = null;

function criarIconeViagemLista() {
    return '<svg viewBox="0 0 24 24">' +
        '<path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z" />' +
        '<circle cx="12" cy="9" r="2.5" />' +
    '</svg>';
}

function criarIconeVer() {
    return '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>';
}

function criarIconeEditar() {
    return '<svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>';
}

async function carregarViagens() {
    try {
        const response = await fetch(urlApiViagens, { headers: cabecalhosAutenticados() });

        if (!response.ok) {
            console.error("Erro ao buscar viagens");
            return;
        }

        viagens = await response.json();
        atualizarResumoViagens();
        renderizarTabelaViagens(viagens);
    } catch (erro) {
        console.error("Erro de conexão com a API:", erro);
    }
}

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatarData(dataISO) {
    if (!dataISO) return "—";
    const data = new Date(dataISO);
    const dia = String(data.getUTCDate()).padStart(2, "0");
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const ano = data.getUTCFullYear();
    return dia + "/" + mes + "/" + ano;
}

function criarSeloStatusViagem(status) {
    if (status === "em andamento") {
        return '<span class="selo-status selo-andamento">Em andamento</span>';
    }

    if (status === "finalizada") {
        return '<span class="selo-status selo-finalizada">Finalizada</span>';
    }

    return '<span class="selo-status selo-cancelada">Cancelada</span>';
}

function renderizarTabelaViagens(listaViagens) {
    const corpoTabelaViagens = document.getElementById("corpoTabelaViagens");
    const usuario = obterUsuarioLogado();
    const podeEditar = usuario && (usuario.perfil === "admin" || usuario.perfil === "dono");

    corpoTabelaViagens.innerHTML = "";
    viagensVisiveis = listaViagens;

    if (listaViagens.length === 0) {
        corpoTabelaViagens.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #6b7280;">
                    Nenhuma viagem encontrada.
                </td>
            </tr>
        `;
        if (exclusaoViagens) exclusaoViagens.aposRender([]);
        return;
    }

    listaViagens.forEach(function (viagem) {
        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        linha.innerHTML = `
            ${exclusaoViagens ? exclusaoViagens.colunaLinha(viagem.id) : ""}
            <td>
                <div class="bloco-viagem">
                    <div class="avatar-viagem">${criarIconeViagemLista()}</div>
                    <div>
                        <div class="nome-rota">${viagem.origem} → ${viagem.destino}</div>
                    </div>
                </div>
            </td>
            <td>${viagem.motorista_nome || "—"}</td>
            <td>
                ${viagem.veiculo_modelo || "—"}
                <br>
                <span class="texto-secundario">${viagem.veiculo_placa || ""}</span>
            </td>
            <td>${formatarData(viagem.data_saida)}</td>
            <td>${formatarData(viagem.data_chegada)}</td>
            <td>${formatarMoeda(viagem.valor_frete)}</td>
            <td>${criarSeloStatusViagem(viagem.status)}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-viagem.html?id=${viagem.id}'">${criarIconeVer()}Ver</button>
                    ${podeEditar ? `<button class="botao-acao" onclick="window.location.href='editar-viagem.html?id=${viagem.id}'">${criarIconeEditar()}Editar</button>` : ""}
                </div>
            </td>
        `;

        corpoTabelaViagens.appendChild(linha);
    });

    if (exclusaoViagens) exclusaoViagens.aposRender(listaViagens);
}

function atualizarResumoViagens() {
    const totalViagens = viagens.length;
    const totalEmAndamento = viagens.filter(function (v) { return v.status === "em andamento"; }).length;
    const totalFinalizadas = viagens.filter(function (v) { return v.status === "finalizada"; }).length;
    const valorTotalFretes = viagens.reduce(function (acumulador, v) {
        return acumulador + Number(v.valor_frete);
    }, 0);

    document.getElementById("totalViagens").textContent = totalViagens;
    document.getElementById("totalEmAndamento").textContent = totalEmAndamento;
    document.getElementById("totalFinalizadas").textContent = totalFinalizadas;
    document.getElementById("valorTotalFretes").textContent = formatarMoeda(valorTotalFretes);
}

function aplicarFiltrosViagens() {
    const valorPesquisa = document.getElementById("campoPesquisaViagem").value.toLowerCase().trim();
    const valorStatus = document.getElementById("filtroStatusViagem").value;

    const listaFiltrada = viagens.filter(function (viagem) {
        const correspondePesquisa =
            viagem.origem.toLowerCase().includes(valorPesquisa) ||
            viagem.destino.toLowerCase().includes(valorPesquisa) ||
            (viagem.motorista_nome && viagem.motorista_nome.toLowerCase().includes(valorPesquisa)) ||
            (viagem.veiculo_modelo && viagem.veiculo_modelo.toLowerCase().includes(valorPesquisa)) ||
            (viagem.veiculo_placa && viagem.veiculo_placa.toLowerCase().includes(valorPesquisa));

        const correspondeStatus =
            valorStatus === "todos" || viagem.status === valorStatus;

        return correspondePesquisa && correspondeStatus;
    });

    renderizarTabelaViagens(listaFiltrada);
}

function configurarEventosViagens() {
    document
        .getElementById("campoPesquisaViagem")
        .addEventListener("input", aplicarFiltrosViagens);

    document
        .getElementById("filtroStatusViagem")
        .addEventListener("change", aplicarFiltrosViagens);

    const botaoNovaViagem = document.getElementById("botaoNovaViagem");
    if (botaoNovaViagem) {
        botaoNovaViagem.addEventListener("click", function () {
            window.location.href = "cadastro-viagem.html";
        });
    }

}

function iniciarPaginaViagens() {
    const usuario = exigirAutenticacao();
    if (!usuario) return;
    preencherInfoUsuario();
    configurarBotaoSair();
    marcarItemMenuLateralAtivo();
    configurarExclusaoViagens();
    configurarEventosViagens();
    carregarViagens();
}

function configurarExclusaoViagens() {
    const usuario = obterUsuarioLogado();
    if (!window.AutoAcertoExclusao || !usuario || (usuario.perfil !== "admin" && usuario.perfil !== "dono")) return;

    exclusaoViagens = window.AutoAcertoExclusao.criarGerenciadorExclusao({
        urlApi: urlApiViagens,
        seletorTabela: ".tabela-viagens",
        seletorLinhas: "[data-selecionar-id]",
        seletorSelecionarTodos: "[data-selecionar-todos-viagens]",
        singular: "viagem",
        plural: "viagens",
        renderizarAtual: function () { renderizarTabelaViagens(viagensVisiveis); },
        aoExcluir: carregarViagens
    });
}

document.addEventListener("DOMContentLoaded", iniciarPaginaViagens);
