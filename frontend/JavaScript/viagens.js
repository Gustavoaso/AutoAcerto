const urlApiViagens = montarUrlApi("/viagens");

let viagens = [];
let viagensVisiveis = [];
let exclusaoViagens = null;
let paginacaoAtual = {
    paginaAtual: 1,
    totalPaginas: 1,
    totalItens: 0,
    itensPorPagina: 50
};

function criarIconeViagemLista() {
    return '<i data-lucide="map-pin"></i>';
}

function criarIconeVer() {
    return '<i data-lucide="eye"></i>';
}

function criarIconeEditar() {
    return '<i data-lucide="pencil"></i>';
}

function criarIconeConcluir() {
    return '<i data-lucide="check"></i>';
}

function abrirFinalizacaoViagem(idViagem) {
    const viagem = viagensVisiveis.find(function (item) {
        return String(item.id) === String(idViagem);
    }) || viagens.find(function (item) {
        return String(item.id) === String(idViagem);
    });

    if (!viagem || !window.AutoAcertoViagem) return;

    window.AutoAcertoViagem.abrirModalFinalizarViagem({
        idViagem: viagem.id,
        kmInicial: viagem.km_inicial,
        dataSaida: viagem.data_saida,
        aoConcluir: function () {
            carregarViagens(paginacaoAtual.paginaAtual || 1);
        }
    });
}

window.abrirFinalizacaoViagem = abrirFinalizacaoViagem;

async function carregarViagens(pagina = 1) {
    try {
        mostrarLoading(true);
        const url = `${urlApiViagens}?pagina=${pagina}&limite=50`;
        const response = await fetch(url, { headers: cabecalhosAutenticados() });

        if (!response.ok) {
            console.error("Erro ao buscar viagens");
            mostrarLoading(false);
            return;
        }

        const resultado = await response.json();
        
        // Suporte para resposta paginada (novo) e array direto (legado)
        if (resultado.dados && resultado.paginacao) {
            viagens = resultado.dados;
            paginacaoAtual = resultado.paginacao;
            renderizarPaginacao();
        } else {
            viagens = resultado;
        }
        
        atualizarResumoViagens();
        renderizarTabelaViagens(viagens);
        mostrarLoading(false);
    } catch (erro) {
        console.error("Erro de conexão com a API:", erro);
        mostrarLoading(false);
    }
}

function mostrarLoading(exibir) {
    const corpoTabela = document.getElementById("corpoTabelaViagens");
    if (exibir) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 10px; color: #6b7280;">Carregando viagens...</p>
                </td>
            </tr>
        `;
    }
}

function renderizarPaginacao() {
    let containerPaginacao = document.getElementById("paginacaoViagens");
    
    if (!containerPaginacao) {
        const tabelaContainer = document.querySelector(".tabela-viagens")?.parentElement;
        if (tabelaContainer) {
            containerPaginacao = document.createElement("div");
            containerPaginacao.id = "paginacaoViagens";
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
            onclick="carregarViagens(${paginaAtual - 1})">
            ← Anterior
        </button>
        <span class="info-paginacao">
            Página ${paginaAtual} de ${totalPaginas} (${totalItens} viagens)
        </span>
        <button 
            class="botao-paginacao" 
            ${!temProxima ? 'disabled' : ''} 
            onclick="carregarViagens(${paginaAtual + 1})">
            Próxima →
        </button>
    `;
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
    const podeEditar = usuario && (usuario.perfil === "admin" || usuario.perfil === "dono" || usuario.perfil === "motorista");

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
        const idViagem = Number(viagem.id);
        const origemViagem = window.AutoAcertoHtml.texto(viagem.origem, "-");
        const destinoViagem = window.AutoAcertoHtml.texto(viagem.destino, "-");
        const motoristaViagem = window.AutoAcertoHtml.texto(viagem.motorista_nome, "—");
        const modeloVeiculo = window.AutoAcertoHtml.texto(viagem.veiculo_modelo, "—");
        const placaVeiculo = window.AutoAcertoHtml.texto(viagem.veiculo_placa, "");

        linha.innerHTML = `
            ${exclusaoViagens ? exclusaoViagens.colunaLinha(idViagem) : ""}
            <td data-label="Viagem">
                <div class="bloco-viagem">
                    <div class="avatar-viagem">${criarIconeViagemLista()}</div>
                    <div>
                        <div class="nome-rota">${origemViagem} &rarr; ${destinoViagem}</div>
                    </div>
                </div>
            </td>
            <td data-label="Motorista">${motoristaViagem}</td>
            <td data-label="Veiculo">
                ${modeloVeiculo}
                <br>
                <span class="texto-secundario">${placaVeiculo}</span>
            </td>
            <td data-label="Saida">${formatarData(viagem.data_saida)}</td>
            <td data-label="Chegada">${viagem.data_chegada ? formatarData(viagem.data_chegada) : "Pendente"}</td>
            <td data-label="Frete">${formatarMoeda(viagem.valor_frete)}</td>
            <td data-label="Status">${criarSeloStatusViagem(viagem.status)}</td>
            <td data-label="Acoes">
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-viagem.html?id=${idViagem}'">${criarIconeVer()}Ver</button>
                    ${podeEditar ? `<button class="botao-acao" onclick="window.location.href='editar-viagem.html?id=${idViagem}'">${criarIconeEditar()}Editar</button>` : ""}
                    ${podeEditar && viagem.status === "em andamento" ? `<button class="botao-acao botao-acao-sucesso" onclick="abrirFinalizacaoViagem(${idViagem})">${criarIconeConcluir()}Concluir</button>` : ""}
                </div>
            </td>
        `;

        corpoTabelaViagens.appendChild(linha);
    });

    if (exclusaoViagens) exclusaoViagens.aposRender(listaViagens);

    function renderizarIconesTabela() {
        if (window.lucide) {
            window.lucide.createIcons();
        } else {
            setTimeout(renderizarIconesTabela, 50);
        }
    }
    renderizarIconesTabela();
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
    const valorStatus = document.querySelector("#filtroStatusViagem .botao-segmentado.ativo")?.dataset.valor || "todos";

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
            aplicarFiltrosViagens();
        });
    });

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
