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

function exibirDespesaNaoEncontrada() {
    if (typeof exibirAlertaRegistroNaoEncontrado === "function") {
        exibirAlertaRegistroNaoEncontrado("Despesa", "despesas.html");
        return;
    }

    alert("Despesa nao encontrada.");
    window.location.href = "despesas.html";
}

async function carregarDespesa() {
    if (!idDespesa) {
        exibirDespesaNaoEncontrada();
        return;
    }

    try {
        const response = await fetch(urlApiDespesas + "/" + idDespesa, { headers: cabecalhosAutenticados() });

        if (!response.ok) {
            exibirDespesaNaoEncontrada();
            return;
        }

        const despesa = await response.json();
        const viagem = despesa.origem && despesa.destino
            ? despesa.origem + " -> " + despesa.destino
            : "Fora de viagem";
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
        renderizarAnexoCupom(despesa);
    } catch (erro) {
        console.error("Erro ao carregar despesa:", erro);
        if (typeof exibirAlertaErroConexao === "function") {
            exibirAlertaErroConexao("carregar despesa");
        } else {
            alert("Erro de conexao com a API.");
        }
    }
}

function renderizarAnexoCupom(despesa) {
    const container = document.getElementById("detalheAnexoCupom");
    if (!container) return;

    if (!despesa.anexo_cupom_base64) {
        container.textContent = "Nenhum anexo.";
        return;
    }

    const nome = window.AutoAcertoHtml
        ? window.AutoAcertoHtml.escapar(despesa.anexo_cupom_nome || "cupom-fiscal")
        : (despesa.anexo_cupom_nome || "cupom-fiscal");

    container.innerHTML = `
        <a href="${despesa.anexo_cupom_base64}" target="_blank" rel="noopener noreferrer">
            <img src="${despesa.anexo_cupom_base64}" alt="${nome}" style="max-width:100%;max-height:320px;border-radius:8px;margin-bottom:8px;" />
        </a>
        <div><a href="${despesa.anexo_cupom_base64}" download="${nome}">Baixar anexo</a></div>
    `;
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
    window.location.href = "despesas.html";
});

const botaoEditar = document.getElementById("botaoEditar");
if (botaoEditar) {
    botaoEditar.addEventListener("click", function () {
        window.location.href = "editar-despesa.html?id=" + idDespesa;
    });
}

carregarDespesa();
