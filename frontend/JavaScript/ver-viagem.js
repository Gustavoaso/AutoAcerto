const urlApiViagens = montarUrlApi("/viagens");

const params = new URLSearchParams(window.location.search);
const idViagem = params.get("id");
let viagemAtual = null;

function formatarData(dataISO) {
    if (!dataISO) return "-";
    const data = new Date(dataISO);
    const dia = String(data.getUTCDate()).padStart(2, "0");
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const ano = data.getUTCFullYear();
    return dia + "/" + mes + "/" + ano;
}

function formatarDataHora(dataISO) {
    if (!dataISO) return "-";
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

function exibirViagemNaoEncontrada() {
    if (typeof exibirAlertaRegistroNaoEncontrado === "function") {
        exibirAlertaRegistroNaoEncontrado("Viagem", "viagens.html");
        return;
    }

    alert("Viagem nao encontrada.");
    window.location.href = "viagens.html";
}

function configurarAcoesViagem(viagem) {
    viagemAtual = viagem;
    const emAndamento = viagem.status === "em andamento";
    const botaoConcluir = document.getElementById("botaoConcluirViagem");
    const botaoLancarDespesa = document.getElementById("botaoLancarDespesa");

    if (botaoConcluir) {
        botaoConcluir.classList.toggle("oculto", !emAndamento);
    }

    if (botaoLancarDespesa) {
        botaoLancarDespesa.classList.toggle("oculto", !emAndamento);
    }
}

async function carregarViagem() {
    if (!idViagem) {
        exibirViagemNaoEncontrada();
        return;
    }

    try {
        const response = await fetch(urlApiViagens + "/" + idViagem, { headers: cabecalhosAutenticados() });

        if (!response.ok) {
            exibirViagemNaoEncontrada();
            return;
        }

        const viagem = await response.json();

        document.getElementById("detalheOrigem").textContent = viagem.origem;
        document.getElementById("detalheDestino").textContent = viagem.destino;
        document.getElementById("detalheMotorista").textContent = viagem.motorista_nome || "-";
        document.getElementById("detalheVeiculo").textContent =
            viagem.veiculo_modelo
                ? viagem.veiculo_modelo + " - " + viagem.veiculo_placa
                : "-";
        document.getElementById("detalheDataSaida").textContent = formatarData(viagem.data_saida);
        document.getElementById("detalheDataChegada").textContent = viagem.data_chegada
            ? formatarData(viagem.data_chegada)
            : "Pendente";
        document.getElementById("detalheValorFrete").textContent = formatarMoeda(viagem.valor_frete);
        document.getElementById("detalheObservacoes").textContent = viagem.observacoes || "-";
        document.getElementById("detalheDataCadastro").textContent = formatarDataHora(viagem.data_cadastro);

        const statusEl = document.getElementById("detalheStatus");

        if (viagem.status === "em andamento") {
            statusEl.innerHTML = '<span class="selo-status selo-andamento">Em andamento</span>';
        } else if (viagem.status === "finalizada") {
            statusEl.innerHTML = '<span class="selo-status selo-finalizada">Finalizada</span>';
        } else {
            statusEl.innerHTML = '<span class="selo-status selo-cancelada">Cancelada</span>';
        }

        configurarAcoesViagem(viagem);
    } catch (erro) {
        console.error("Erro ao carregar viagem:", erro);
        if (typeof exibirAlertaErroConexao === "function") {
            exibirAlertaErroConexao("carregar viagem");
        } else {
            alert("Erro de conexao com a API.");
        }
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

const botaoConcluirViagem = document.getElementById("botaoConcluirViagem");
if (botaoConcluirViagem) {
    botaoConcluirViagem.addEventListener("click", function () {
        if (!viagemAtual || !window.AutoAcertoViagem) return;

        window.AutoAcertoViagem.abrirModalFinalizarViagem({
            idViagem: idViagem,
            kmInicial: viagemAtual.km_inicial,
            dataSaida: viagemAtual.data_saida,
            aoConcluir: carregarViagem
        });
    });
}

carregarViagem();
