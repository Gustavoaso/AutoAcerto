const urlApi = "http://localhost:3000/motoristas";
let motoristas = [];
let motoristasVisiveis = [];
let exclusaoMotoristas = null;

async function carregarMotoristas() {
    try {
        const response = await fetch(urlApi, { headers: cabecalhosAutenticados() });
        if (!response.ok) {
            console.error("Erro ao buscar motoristas");
            return;
        }
        motoristas = await response.json();
        atualizarResumo();
        renderizarTabela(motoristas);
    } catch (error) {
        console.error("Erro de conexão com a API:", error);
    }
}

function obterIniciais(nomeCompleto) {
    return nomeCompleto
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(parte => parte[0].toUpperCase())
        .join("");
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

        linha.innerHTML = `
            ${exclusaoMotoristas ? exclusaoMotoristas.colunaLinha(motorista.id) : ""}
            <td>
                <div class="bloco-motorista">
                    <div class="avatar-motorista">${obterIniciais(motorista.nome)}</div>
                    <div>
                        <div class="nome-motorista">${motorista.nome}</div>
                        <div class="texto-secundario">Registro #${motorista.id}</div>
                    </div>
                </div>
            </td>
            <td>${motorista.cpf}</td>
            <td>${motorista.telefone}</td>
            <td>${motorista.cnh}</td>
            <td>${criarSeloStatus(motorista.status)}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-motorista.html?id=${motorista.id}'">Ver</button>
                    <button class="botao-acao" onclick="window.location.href='editar-motorista.html?id=${motorista.id}'">Editar</button>
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
