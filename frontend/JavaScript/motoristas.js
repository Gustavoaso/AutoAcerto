const urlApi = "http://localhost:3000/motoristas";
let motoristas = [];

async function carregarMotoristas() {
    try {
        const response = await fetch(urlApi);
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

function formatarData(dataISO) {
    if (!dataISO) return "—";
    const data = new Date(dataISO);
    const dia = String(data.getUTCDate()).padStart(2, "0");
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const ano = data.getUTCFullYear();
    return dia + "/" + mes + "/" + ano;
}

function renderizarTabela(listaMotoristas) {
    const corpoTabelaMotoristas = document.getElementById("corpoTabelaMotoristas");
    corpoTabelaMotoristas.innerHTML = "";

    listaMotoristas.forEach(function (motorista) {
        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        linha.innerHTML = `
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
            <td>${formatarData(motorista.validade_cnh)}</td>
            <td>
                <div class="grupo-acoes">
                    <button class="botao-acao" onclick="window.location.href='ver-motorista.html?id=${motorista.id}'">Ver</button>
                    <button class="botao-acao" onclick="window.location.href='editar-motorista.html?id=${motorista.id}'">Editar</button>
                </div>
            </td>
        `;

        corpoTabelaMotoristas.appendChild(linha);
    });
}

function atualizarResumo() {
    const hoje = new Date();
    const totalMotoristas = motoristas.length;
    const totalAtivos = motoristas.filter(m => m.status === "ativo").length;
    const totalInativos = motoristas.filter(m => m.status === "inativo").length;
    const totalCnhValida = motoristas.filter(function (m) {
        if (!m.validade_cnh) return false;
        return new Date(m.validade_cnh) >= hoje;
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

    document.querySelector(".botao-sair")
        .addEventListener("click", function () {
            alert("Saindo do sistema...");
        });
}

function iniciarPaginaMotoristas() {
    configurarEventos();
    carregarMotoristas();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaMotoristas);
