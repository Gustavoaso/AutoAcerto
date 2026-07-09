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
    return '<i data-lucide="eye"></i>';
}

function criarIconeEditar() {
    return '<i data-lucide="pencil"></i>';
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
    if (categoria === "combustivel") return '<i data-lucide="fuel"></i>';
    if (categoria === "pedagio") return '<i data-lucide="receipt"></i>';
    if (categoria === "alimentacao") return '<i data-lucide="utensils"></i>';
    if (categoria === "manutencao") return '<i data-lucide="wrench"></i>';
    return '<i data-lucide="info"></i>';
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
            <td data-label="Despesa">
                <div class="bloco-despesa">
                    <div class="avatar-despesa ${obterClasseCategoria(despesa.categoria)}">${criarIconeCategoria(despesa.categoria)}</div>
                    <div>
                        <div class="nome-despesa">${descricaoDespesa}</div>
                    </div>
                </div>
            </td>
            <td data-label="Viagem">${nomeViagemSeguro}</td>
            <td data-label="Motorista">${motoristaDespesa}</td>
            <td data-label="Veiculo">
                ${modeloVeiculo}
                <br>
                <span class="texto-secundario">${placaVeiculo}</span>
            </td>
            <td data-label="Categoria">${criarSeloCategoria(despesa.categoria)}</td>
            <td data-label="Data">${formatarData(despesa.data_despesa)}</td>
            <td data-label="Valor" class="valor-despesa">${formatarMoeda(despesa.valor)}</td>
            <td data-label="Acoes">
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-despesa.html?id=${idDespesa}'">${criarIconeVer()}Ver</button>
                    ${podeEditar ? `<button class="botao-acao" onclick="window.location.href='editar-despesa.html?id=${idDespesa}'">${criarIconeEditar()}Editar</button>` : ""}
                </div>
            </td>
        `;

        corpoTabelaDespesas.appendChild(linha);
    });

    if (exclusaoDespesas) exclusaoDespesas.aposRender(listaDespesas);

    function renderizarIconesTabela() {
        if (window.lucide) {
            window.lucide.createIcons();
        } else {
            setTimeout(renderizarIconesTabela, 50);
        }
    }
    renderizarIconesTabela();
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
    const valorCategoria = document.querySelector("#filtroCategoriaDespesa .botao-segmentado.ativo")?.dataset.valor || "todas";

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

    document.querySelectorAll(".botao-toggle-filtro").forEach(function (botaoToggle) {
        botaoToggle.addEventListener("click", function () {
            const estaAberto = botaoToggle.getAttribute("aria-expanded") === "true";
            const idControles = botaoToggle.getAttribute("aria-controls");
            const containerOpcoes = document.getElementById(idControles);

            botaoToggle.setAttribute("aria-expanded", String(!estaAberto));
            if (containerOpcoes) {
                containerOpcoes.classList.toggle("filtro-segmentado-fechado", estaAberto);
            }
        });
    });

    document.querySelectorAll(".grupo-filtro-segmentado").forEach(function (container) {
        container.addEventListener("click", function (evento) {
            const botao = evento.target.closest(".botao-segmentado");
            if (!botao) return;

            const paiFiltro = botao.closest(".filtro-segmentado");
            paiFiltro.querySelectorAll(".botao-segmentado").forEach(function (b) {
                b.classList.remove("ativo");
            });

            botao.classList.add("ativo");
            aplicarFiltrosDespesas();
        });
    });

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
