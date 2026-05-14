const urlApiViagens = montarUrlApi("/viagens");

const params = new URLSearchParams(window.location.search);
const idViagem = params.get("id");

function formatarData(dataISO) {
    if (!dataISO) return "—";
    const data = new Date(dataISO);
    const dia = String(data.getUTCDate()).padStart(2, "0");
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const ano = data.getUTCFullYear();
    return dia + "/" + mes + "/" + ano;
}

function formatarDataHora(dataISO) {
    if (!dataISO) return "—";
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, "0");
    const minuto = String(data.getMinutes()).padStart(2, "0");
    return dia + "/" + mes + "/" + ano + " " + hora + ":" + minuto;
}

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

async function carregarViagem() {
    if (!idViagem) {
        alert("Viagem não encontrada.");
        window.location.href = "viagens.html";
        return;
    }

    try {
        const response = await fetch(urlApiViagens + "/" + idViagem,{ headers: cabecalhosAutenticados() });

        if (!response.ok) {
            alert("Viagem não encontrada.");
            window.location.href = "viagens.html";
            return;
        }

        const viagem = await response.json();

        document.getElementById("detalheOrigem").textContent = viagem.origem;
        document.getElementById("detalheDestino").textContent = viagem.destino;
        document.getElementById("detalheMotorista").textContent = viagem.motorista_nome || "—";
        document.getElementById("detalheVeiculo").textContent =
            viagem.veiculo_modelo
                ? viagem.veiculo_modelo + " — " + viagem.veiculo_placa
                : "—";
        document.getElementById("detalheDataSaida").textContent = formatarData(viagem.data_saida);
        document.getElementById("detalheDataChegada").textContent = formatarData(viagem.data_chegada);
        document.getElementById("detalheValorFrete").textContent = formatarMoeda(viagem.valor_frete);
        document.getElementById("detalheObservacoes").textContent = viagem.observacoes || "—";
        document.getElementById("detalheDataCadastro").textContent = formatarDataHora(viagem.data_cadastro);

        const statusEl = document.getElementById("detalheStatus");

        if (viagem.status === "em andamento") {
            statusEl.innerHTML = '<span class="selo-status selo-andamento">Em andamento</span>';
        } else if (viagem.status === "finalizada") {
            statusEl.innerHTML = '<span class="selo-status selo-finalizada">Finalizada</span>';
        } else {
            statusEl.innerHTML = '<span class="selo-status selo-cancelada">Cancelada</span>';
        }

    } catch (erro) {
        console.error("Erro ao carregar viagem:", erro);
        alert("Erro de conexão com a API.");
    }
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
    window.location.href = "viagens.html";
});

const botaoEditar = document.getElementById("botaoEditar");
if (botaoEditar) {
    botaoEditar.addEventListener("click", function () {
        window.location.href = "editar-viagem.html?id=" + idViagem;
    });
}

const botaoLancarDespesa = document.getElementById("botaoLancarDespesa");
if (botaoLancarDespesa) {
    botaoLancarDespesa.addEventListener("click", function () {
        window.location.href = "cadastro-despesa.html?viagemId=" + idViagem;
    });
}

carregarViagem();
