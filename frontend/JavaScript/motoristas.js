const urlApi = montarUrlApi("/motoristas");
let motoristas = [];
let motoristasVisiveis = [];
let exclusaoMotoristas = null;
let paginacaoAtual = { paginaAtual: 1, totalPaginas: 1, totalItens: 0 };

function criarIconeMotoristaLista() {
    return '<svg viewBox="0 0 24 24">' +
        '<path d="M20 21a8 8 0 0 0-16 0" />' +
        '<circle cx="12" cy="7" r="4" />' +
    '</svg>';
}

function criarIconeVer() {
    return '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>';
}

function criarIconeEditar() {
    return '<svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>';
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
            <td>
                <div class="bloco-motorista">
                    <div class="avatar-motorista">${criarIconeMotoristaLista()}</div>
                    <div>
                        <div class="nome-motorista">${nomeMotorista}</div>
                    </div>
                </div>
            </td>
            <td>${cpfMotorista}</td>
            <td>${telefoneMotorista}</td>
            <td>${cnhMotorista}</td>
            <td>${criarSeloStatus(motorista.status)}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-motorista.html?id=${idMotorista}'">${criarIconeVer()}Ver</button>
                    <button class="botao-acao" onclick="window.location.href='editar-motorista.html?id=${idMotorista}'">${criarIconeEditar()}Editar</button>
                </div>
            </td>
        `;

        corpoTabelaMotoristas.appendChild(linha);
    });

    if (exclusaoMotoristas) exclusaoMotoristas.aposRender(listaMotoristas);
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
    const valorStatus = document.getElementById("filtroStatus").value;

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

    document.getElementById("filtroStatus")
        .addEventListener("change", aplicarFiltros);

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
