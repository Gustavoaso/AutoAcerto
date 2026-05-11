const urlApiDespesas = montarUrlApi("/despesas");

const params = new URLSearchParams(window.location.search);
const idDespesa = params.get("id");

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

function formatarCategoria(categoria) {
    if (categoria === "combustivel") return "Combustivel";
    if (categoria === "pedagio") return "Pedagio";
    if (categoria === "alimentacao") return "Alimentacao";
    if (categoria === "manutencao") return "Manutencao";
    return "Outros";
}

async function carregarDespesa() {
    if (!idDespesa) {
        alert("Despesa nao encontrada.");
        window.location.href = "despesas.html";
        return;
    }

    try {
        const response = await fetch(urlApiDespesas + "/" + idDespesa);

        if (!response.ok) {
            alert("Despesa nao encontrada.");
            window.location.href = "despesas.html";
            return;
        }

        const despesa = await response.json();
        const viagem = despesa.origem && despesa.destino
            ? despesa.origem + " -> " + despesa.destino
            : "-";
        const veiculo = despesa.veiculo_modelo
            ? despesa.veiculo_modelo + " - " + (despesa.veiculo_placa || "")
            : "-";

        document.getElementById("detalheDescricao").textContent = despesa.descricao;
        document.getElementById("detalheCategoria").textContent = formatarCategoria(despesa.categoria);
        document.getElementById("detalheViagem").textContent = viagem;
        document.getElementById("detalheMotorista").textContent = despesa.motorista_nome || "-";
        document.getElementById("detalheVeiculo").textContent = veiculo;
        document.getElementById("detalheDataDespesa").textContent = formatarData(despesa.data_despesa);
        document.getElementById("detalheValor").textContent = formatarMoeda(despesa.valor);
        document.getElementById("detalheObservacoes").textContent = despesa.observacoes || "-";
    } catch (erro) {
        console.error("Erro ao carregar despesa:", erro);
        alert("Erro de conexao com a API.");
    }
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
    window.location.href = "despesas.html";
});

document.getElementById("botaoEditar").addEventListener("click", function () {
    window.location.href = "editar-despesa.html?id=" + idDespesa;
});

document.querySelector(".botao-sair").addEventListener("click", function () {
    alert("Saindo do sistema...");
});

carregarDespesa();
