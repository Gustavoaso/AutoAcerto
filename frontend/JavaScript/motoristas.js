const urlApi = montarUrlApi("/motoristas");
let motoristas = [];
let motoristasVisiveis = [];
let exclusaoMotoristas = null;
let paginacaoAtual = { paginaAtual: 1, totalPaginas: 1, totalItens: 0 };

function criarIconeMotoristaLista() {
    return '<i data-lucide="user"></i>';
}

function criarIconeVer() {
    return '<i data-lucide="eye"></i>';
}

function criarIconeEditar() {
    return '<i data-lucide="pencil"></i>';
}

async function carregarMotoristas(pagina = 1) {
    try {
        const url = `${urlApi}?pagina=${pagina}&limite=50`;
        const response = await fetch(url, { headers: cabecalhosAutenticados() });
        if (!response.ok) {
            console.error("Erro ao buscar motoristas");
            return;
        }
        const resultado = await response.json();
        
        if (resultado.dados && resultado.paginacao) {
            motoristas = resultado.dados;
            paginacaoAtual = resultado.paginacao;
        } else {
            motoristas = resultado;
        }
        
        atualizarResumo();
        renderizarTabela(motoristas);
    } catch (error) {
        console.error("Erro de conexão com a API:", error);
    }
}

function criarSeloStatus(status) {
    if (status === "ativo") {
        return '<span class="selo-status selo-ativo">Ativo</span>';
    }
    return '<span class="selo-status selo-inativo">Inativo</span>';
}

function renderizarTabela(listaMotoristas) {
    const corpoTabelaMotoristas = document.getElementById("corpoTabelaMotoristas");
    corpoTabelaMotoristas.innerHTML = "";
    motoristasVisiveis = listaMotoristas;

    if (listaMotoristas.length === 0) {
        corpoTabelaMotoristas.innerHTML = '<tr><td colspan="7" class="celula-vazia">Nenhum motorista encontrado.</td></tr>';
        if (exclusaoMotoristas) exclusaoMotoristas.aposRender([]);
        return;
    }

    listaMotoristas.forEach(function (motorista) {
        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");
        const idMotorista = Number(motorista.id);
        const nomeMotorista = window.AutoAcertoHtml.texto(motorista.nome, "-");
        const cpfMotorista = window.AutoAcertoHtml.texto(motorista.cpf, "-");
        const telefoneMotorista = window.AutoAcertoHtml.texto(motorista.telefone, "-");
        const cnhMotorista = window.AutoAcertoHtml.texto(motorista.cnh, "-");

        linha.innerHTML = `
            ${exclusaoMotoristas ? exclusaoMotoristas.colunaLinha(idMotorista) : ""}
            <td data-label="Motorista">
                <div class="bloco-motorista">
                    <div class="avatar-motorista">${criarIconeMotoristaLista()}</div>
                    <div>
                        <div class="nome-motorista">${nomeMotorista}</div>
                    </div>
                </div>
            </td>
            <td data-label="CPF">${cpfMotorista}</td>
            <td data-label="Telefone">${telefoneMotorista}</td>
            <td data-label="CNH">${cnhMotorista}</td>
            <td data-label="Status">${criarSeloStatus(motorista.status)}</td>
            <td data-label="Acoes">
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-motorista.html?id=${idMotorista}'">${criarIconeVer()}Ver</button>
                    <button class="botao-acao" onclick="window.location.href='editar-motorista.html?id=${idMotorista}'">${criarIconeEditar()}Editar</button>
                </div>
            </td>
        `;

        corpoTabelaMotoristas.appendChild(linha);
    });

    if (exclusaoMotoristas) exclusaoMotoristas.aposRender(listaMotoristas);

    function renderizarIconesTabela() {
        if (window.lucide) {
            window.lucide.createIcons();
        } else {
            setTimeout(renderizarIconesTabela, 50);
        }
    }
    renderizarIconesTabela();
}

function atualizarResumo() {
    const totalMotoristas = motoristas.length;
    const totalAtivos = motoristas.filter(m => m.status === "ativo").length;
    const totalInativos = motoristas.filter(m => m.status === "inativo").length;
    const totalCnhValida = motoristas.filter(function (m) {
        return !!(m.cnh && String(m.cnh).trim());
    }).length;

    document.getElementById("totalMotoristas").textContent = totalMotoristas;
    document.getElementById("totalAtivos").textContent = totalAtivos;
    document.getElementById("totalCnhValida").textContent = totalCnhValida;
    document.getElementById("totalInativos").textContent = totalInativos;
}

function aplicarFiltros() {
    const valorPesquisa = document.getElementById("campoPesquisaMotorista").value.toLowerCase().trim();
    const valorStatus = document.querySelector("#filtroStatus .botao-segmentado.ativo")?.dataset.valor || "todos";

    const listaFiltrada = motoristas.filter(function (motorista) {
        const correspondePesquisa =
            motorista.nome.toLowerCase().includes(valorPesquisa) ||
            motorista.cpf.toLowerCase().includes(valorPesquisa) ||
            motorista.telefone.toLowerCase().includes(valorPesquisa) ||
            motorista.cnh.toLowerCase().includes(valorPesquisa);

        const correspondeStatus =
            valorStatus === "todos" || motorista.status === valorStatus;

        return correspondePesquisa && correspondeStatus;
    });

    renderizarTabela(listaFiltrada);
}

function configurarEventos() {
    document.getElementById("campoPesquisaMotorista")
        .addEventListener("input", aplicarFiltros);

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
            aplicarFiltros();
        });
    });

    document.getElementById("botaoNovoMotorista")
        .addEventListener("click", function () {
            window.location.href = "cadastro-motorista.html";
        });
}

function iniciarPaginaMotoristas() {
    const usuario = exigirAutenticacao();
    if (!usuario) return;
    preencherInfoUsuario();
    configurarBotaoSair();
    marcarItemMenuLateralAtivo();
    configurarExclusaoMotoristas();
    configurarEventos();
    carregarMotoristas();
}

function configurarExclusaoMotoristas() {
    if (!window.AutoAcertoExclusao) return;

    exclusaoMotoristas = window.AutoAcertoExclusao.criarGerenciadorExclusao({
        urlApi: urlApi,
        seletorTabela: ".tabela-motoristas",
        seletorLinhas: "[data-selecionar-id]",
        seletorSelecionarTodos: "[data-selecionar-todos-motoristas]",
        singular: "motorista",
        plural: "motoristas",
        renderizarAtual: function () { renderizarTabela(motoristasVisiveis); },
        aoExcluir: carregarMotoristas
    });
}

document.addEventListener("DOMContentLoaded", iniciarPaginaMotoristas);
