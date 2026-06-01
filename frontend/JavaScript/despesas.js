const urlApiDespesas = montarUrlApi("/despesas");

let despesas = [];
let despesasVisiveis = [];
let exclusaoDespesas = null;
let paginacaoAtual = {
    paginaAtual: 1,
    totalPaginas: 1,
    totalItens: 0,
    itensPorPagina: 50
};

function criarIconeVer() {
    return '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>';
}

function criarIconeEditar() {
    return '<svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>';
}

async function carregarDespesas(pagina = 1) {
    try {
        mostrarLoading(true);
        const url = `${urlApiDespesas}?pagina=${pagina}&limite=50`;
        const response = await fetch(url, { headers: cabecalhosAutenticados() });

        if (!response.ok) {
            console.error("Erro ao buscar despesas");
            mostrarLoading(false);
            return;
        }

        const resultado = await response.json();
        
        // Suporte para resposta paginada (novo) e array direto (legado)
        if (resultado.dados && resultado.paginacao) {
            despesas = resultado.dados;
            paginacaoAtual = resultado.paginacao;
            renderizarPaginacao();
        } else {
            despesas = resultado;
        }
        
        atualizarResumoDespesas();
        renderizarTabelaDespesas(despesas);
        mostrarLoading(false);
    } catch (erro) {
        console.error("Erro de conexao com a API:", erro);
        mostrarLoading(false);
    }
}

function mostrarLoading(exibir) {
    const corpoTabela = document.getElementById("corpoTabelaDespesas");
    if (exibir) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 10px; color: #6b7280;">Carregando despesas...</p>
                </td>
            </tr>
        `;
    }
}

function renderizarPaginacao() {
    let containerPaginacao = document.getElementById("paginacaoDespesas");
    
    if (!containerPaginacao) {
        const tabelaContainer = document.querySelector(".tabela-despesas")?.parentElement;
        if (tabelaContainer) {
            containerPaginacao = document.createElement("div");
            containerPaginacao.id = "paginacaoDespesas";
            containerPaginacao.className = "paginacao-container";
            tabelaContainer.appendChild(containerPaginacao);
        }
    }
    
    if (!containerPaginacao) return;
    
    const { paginaAtual, totalPaginas, totalItens, temProxima, temAnterior } = paginacaoAtual;
    
    if (totalPaginas <= 1) {
        containerPaginacao.style.display = 'none';
        return;
    }
    
    containerPaginacao.style.display = 'flex';
    containerPaginacao.innerHTML = `
        <button 
            class="botao-paginacao" 
            ${!temAnterior ? 'disabled' : ''} 
            onclick="carregarDespesas(${paginaAtual - 1})">
            ← Anterior
        </button>
        <span class="info-paginacao">
            Página ${paginaAtual} de ${totalPaginas} (${totalItens} despesas)
        </span>
        <button 
            class="botao-paginacao" 
            ${!temProxima ? 'disabled' : ''} 
            onclick="carregarDespesas(${paginaAtual + 1})">
            Próxima →
        </button>
    `;
}



function criarIconeCategoria(categoria) {
    if (categoria === "combustivel") {
        return '<svg viewBox="0 0 24 24"><path d="M3 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17" /><path d="M14 9h2.5a2.5 2.5 0 0 1 2.5 2.5V18a2 2 0 0 0 4 0v-7l-3-3" /><path d="M5 9h7" /></svg>';
    }

    if (categoria === "pedagio") {
        return '<svg viewBox="0 0 24 24"><path d="M4 7h16" /><path d="M6 7v13" /><path d="M18 7v13" /><path d="M8 11h8" /><path d="M10 15h4" /><path d="M9 4h6" /></svg>';
    }

    if (categoria === "alimentacao") {
        return '<svg viewBox="0 0 24 24"><path d="M4 3v7a4 4 0 0 0 4 4v7" /><path d="M8 3v18" /><path d="M12 3v18" /><path d="M20 3v18" /><path d="M16 3v7a4 4 0 0 0 4 4" /></svg>';
    }

    if (categoria === "manutencao") {
        return '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-3-3Z" /></svg>';
    }

    return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v5h1" /></svg>';
}

function obterClasseCategoria(categoria) {
    if (categoria === "combustivel") return "combustivel";
    if (categoria === "pedagio") return "pedagio";
    if (categoria === "alimentacao") return "alimentacao";
    if (categoria === "manutencao") return "manutencao";
    return "outros";
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
    const usuario = obterUsuarioLogado();
    const podeEditar = usuario && (usuario.perfil === "admin" || usuario.perfil === "dono");
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
        const idDespesa = Number(despesa.id);

        const nomeViagem = despesa.origem && despesa.destino
            ? despesa.origem + " -> " + despesa.destino
            : "Fora de viagem";
        const descricaoDespesa = window.AutoAcertoHtml.texto(despesa.descricao, "-");
        const nomeViagemSeguro = window.AutoAcertoHtml.texto(nomeViagem, "-");
        const motoristaDespesa = window.AutoAcertoHtml.texto(despesa.motorista_nome, "-");
        const modeloVeiculo = window.AutoAcertoHtml.texto(despesa.veiculo_modelo, "-");
        const placaVeiculo = window.AutoAcertoHtml.texto(despesa.veiculo_placa, "");

        linha.innerHTML = `
            ${exclusaoDespesas ? exclusaoDespesas.colunaLinha(idDespesa) : ""}
            <td>
                <div class="bloco-despesa">
                    <div class="avatar-despesa ${obterClasseCategoria(despesa.categoria)}">${criarIconeCategoria(despesa.categoria)}</div>
                    <div>
                        <div class="nome-despesa">${descricaoDespesa}</div>
                    </div>
                </div>
            </td>
            <td>${nomeViagemSeguro}</td>
            <td>${motoristaDespesa}</td>
            <td>
                ${modeloVeiculo}
                <br>
                <span class="texto-secundario">${placaVeiculo}</span>
            </td>
            <td>${criarSeloCategoria(despesa.categoria)}</td>
            <td>${formatarData(despesa.data_despesa)}</td>
            <td class="valor-despesa">${formatarMoeda(despesa.valor)}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-despesa.html?id=${idDespesa}'">${criarIconeVer()}Ver</button>
                    ${podeEditar ? `<button class="botao-acao" onclick="window.location.href='editar-despesa.html?id=${idDespesa}'">${criarIconeEditar()}Editar</button>` : ""}
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
    const viagensUnicas = new Set(despesas.filter(function (despesa) {
        return despesa.viagem_id;
    }).map(function (despesa) {
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
