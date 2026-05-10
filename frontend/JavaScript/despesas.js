const urlApiDespesas = "http://localhost:3000/despesas";

let despesas = [];
let despesasVisiveis = [];
let exclusaoDespesas = null;

async function carregarDespesas() {
    try {
        const response = await fetch(urlApiDespesas, { headers: cabecalhosAutenticados() });

        if (!response.ok) {
            console.error("Erro ao buscar despesas");
            return;
        }

        despesas = await response.json();
        atualizarResumoDespesas();
        renderizarTabelaDespesas(despesas);
    } catch (erro) {
        console.error("Erro de conexao com a API:", erro);
    }
}

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatarData(dataISO) {
    if (!dataISO) return "-";
    const data = new Date(dataISO);
    const dia = String(data.getUTCDate()).padStart(2, "0");
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const ano = data.getUTCFullYear();
    return dia + "/" + mes + "/" + ano;
}

function criarIconeCategoria(categoria) {
    if (categoria === "combustivel") return "C";
    if (categoria === "pedagio") return "P";
    if (categoria === "alimentacao") return "A";
    if (categoria === "manutencao") return "M";
    return "O";
}

function formatarCategoria(categoria) {
    if (categoria === "combustivel") return "Combustivel";
    if (categoria === "pedagio") return "Pedagio";
    if (categoria === "alimentacao") return "Alimentacao";
    if (categoria === "manutencao") return "Manutencao";
    return "Outros";
}

function criarSeloCategoria(categoria) {
    if (categoria === "combustivel") {
        return '<span class="selo-categoria selo-combustivel">Combustivel</span>';
    }

    if (categoria === "pedagio") {
        return '<span class="selo-categoria selo-pedagio">Pedagio</span>';
    }

    if (categoria === "alimentacao") {
        return '<span class="selo-categoria selo-alimentacao">Alimentacao</span>';
    }

    if (categoria === "manutencao") {
        return '<span class="selo-categoria selo-manutencao">Manutencao</span>';
    }

    return '<span class="selo-categoria selo-outros">Outros</span>';
}

function renderizarTabelaDespesas(listaDespesas) {
    const corpoTabelaDespesas = document.getElementById("corpoTabelaDespesas");
    corpoTabelaDespesas.innerHTML = "";
    despesasVisiveis = listaDespesas;

    if (listaDespesas.length === 0) {
        corpoTabelaDespesas.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #6b7280;">
                    Nenhuma despesa encontrada.
                </td>
            </tr>
        `;
        if (exclusaoDespesas) exclusaoDespesas.aposRender([]);
        return;
    }

    listaDespesas.forEach(function (despesa) {
        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        const nomeViagem = despesa.origem && despesa.destino
            ? despesa.origem + " -> " + despesa.destino
            : "-";

        linha.innerHTML = `
            ${exclusaoDespesas ? exclusaoDespesas.colunaLinha(despesa.id) : ""}
            <td>
                <div class="bloco-despesa">
                    <div class="avatar-despesa">${criarIconeCategoria(despesa.categoria)}</div>
                    <div>
                        <div class="nome-despesa">${despesa.descricao}</div>
                        <div class="texto-secundario">Registro #${despesa.id}</div>
                    </div>
                </div>
            </td>
            <td>${nomeViagem}</td>
            <td>${despesa.motorista_nome || "-"}</td>
            <td>
                ${despesa.veiculo_modelo || "-"}
                <br>
                <span class="texto-secundario">${despesa.veiculo_placa || ""}</span>
            </td>
            <td>${criarSeloCategoria(despesa.categoria)}</td>
            <td>${formatarData(despesa.data_despesa)}</td>
            <td class="valor-despesa">${formatarMoeda(despesa.valor)}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-despesa.html?id=${despesa.id}'">Ver</button>
                    <button class="botao-acao" onclick="window.location.href='editar-despesa.html?id=${despesa.id}'">Editar</button>
                </div>
            </td>
        `;

        corpoTabelaDespesas.appendChild(linha);
    });

    if (exclusaoDespesas) exclusaoDespesas.aposRender(listaDespesas);
}

function descobrirMaiorCategoria() {
    const totaisPorCategoria = {};

    despesas.forEach(function (despesa) {
        if (!totaisPorCategoria[despesa.categoria]) {
            totaisPorCategoria[despesa.categoria] = 0;
        }

        totaisPorCategoria[despesa.categoria] += Number(despesa.valor);
    });

    let categoriaMaior = "";
    let valorMaior = 0;

    for (const categoria in totaisPorCategoria) {
        if (totaisPorCategoria[categoria] > valorMaior) {
            valorMaior = totaisPorCategoria[categoria];
            categoriaMaior = categoria;
        }
    }

    return categoriaMaior ? formatarCategoria(categoriaMaior) : "-";
}

function atualizarResumoDespesas() {
    const totalDespesas = despesas.length;
    const valorTotalDespesas = despesas.reduce(function (acumulador, despesa) {
        return acumulador + Number(despesa.valor);
    }, 0);
    const viagensUnicas = new Set(despesas.map(function (despesa) {
        return despesa.viagem_id;
    }));

    document.getElementById("totalDespesas").textContent = totalDespesas;
    document.getElementById("valorTotalDespesas").textContent = formatarMoeda(valorTotalDespesas);
    document.getElementById("maiorCategoriaDespesa").textContent = descobrirMaiorCategoria();
    document.getElementById("totalViagensComDespesa").textContent = viagensUnicas.size;
}

function aplicarFiltrosDespesas() {
    const valorPesquisa = document.getElementById("campoPesquisaDespesa").value.toLowerCase().trim();
    const valorCategoria = document.getElementById("filtroCategoriaDespesa").value;

    const listaFiltrada = despesas.filter(function (despesa) {
        const nomeViagem = ((despesa.origem || "") + " " + (despesa.destino || "")).toLowerCase();

        const correspondePesquisa =
            (despesa.descricao || "").toLowerCase().includes(valorPesquisa) ||
            (despesa.motorista_nome || "").toLowerCase().includes(valorPesquisa) ||
            (despesa.categoria || "").toLowerCase().includes(valorPesquisa) ||
            (despesa.veiculo_modelo || "").toLowerCase().includes(valorPesquisa) ||
            (despesa.veiculo_placa || "").toLowerCase().includes(valorPesquisa) ||
            nomeViagem.includes(valorPesquisa);

        const correspondeCategoria =
            valorCategoria === "todas" || despesa.categoria === valorCategoria;

        return correspondePesquisa && correspondeCategoria;
    });

    renderizarTabelaDespesas(listaFiltrada);
}

function configurarEventosDespesas() {
    document
        .getElementById("campoPesquisaDespesa")
        .addEventListener("input", aplicarFiltrosDespesas);

    document
        .getElementById("filtroCategoriaDespesa")
        .addEventListener("change", aplicarFiltrosDespesas);

    document
        .getElementById("botaoNovaDespesa")
        .addEventListener("click", function () {
            window.location.href = "cadastro-despesa.html";
        });

}

function iniciarPaginaDespesas() {
    const usuario = exigirAutenticacao();
    if (!usuario) return;
    preencherInfoUsuario();
    configurarBotaoSair();
    marcarItemMenuLateralAtivo();
    configurarExclusaoDespesas();
    configurarEventosDespesas();
    carregarDespesas();
}

function configurarExclusaoDespesas() {
    if (!window.AutoAcertoExclusao) return;

    exclusaoDespesas = window.AutoAcertoExclusao.criarGerenciadorExclusao({
        urlApi: urlApiDespesas,
        seletorTabela: ".tabela-despesas",
        seletorLinhas: "[data-selecionar-id]",
        seletorSelecionarTodos: "[data-selecionar-todos-despesas]",
        singular: "despesa",
        plural: "despesas",
        renderizarAtual: function () { renderizarTabelaDespesas(despesasVisiveis); },
        aoExcluir: carregarDespesas
    });
}

document.addEventListener("DOMContentLoaded", iniciarPaginaDespesas);
