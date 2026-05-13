const urlApiDespesas = montarUrlApi("/despesas");
const urlApiViagens = montarUrlApi("/viagens");

const params = new URLSearchParams(window.location.search);
const idDespesa = params.get("id");

const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

async function carregarViagens(viagemIdSelecionada) {
    try {
        const response = await fetch(urlApiViagens,{ headers: cabecalhosAutenticados() });

        if (!response.ok) return;

        const viagens = await response.json();
        const selectViagem = document.getElementById("viagemId");

        viagens.forEach(function (viagem) {
            const opcao = document.createElement("option");
            opcao.value = viagem.id;
            opcao.textContent = viagem.origem + " -> " + viagem.destino;

            if (String(viagem.id) === String(viagemIdSelecionada)) {
                opcao.selected = true;
            }

            selectViagem.appendChild(opcao);
        });
    } catch (erro) {
        console.error("Erro ao carregar viagens:", erro);
    }
}

function formatarDataParaInput(dataISO) {
    if (!dataISO) return "";
    const data = new Date(dataISO);
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(data.getUTCDate()).padStart(2, "0");
    return ano + "-" + mes + "-" + dia;
}

async function carregarDespesa() {
    if (!idDespesa) {
        alert("Despesa nao encontrada.");
        window.location.href = "despesas.html";
        return;
    }

    try {
        const response = await fetch(urlApiDespesas + "/" + idDespesa,{ headers: cabecalhosAutenticados() });

        if (!response.ok) {
            alert("Despesa nao encontrada.");
            window.location.href = "despesas.html";
            return;
        }

        const despesa = await response.json();

        document.getElementById("descricao").value = despesa.descricao;
        document.getElementById("categoria").value = despesa.categoria;
        document.getElementById("dataDespesa").value = formatarDataParaInput(despesa.data_despesa);
        const vNum = Number(despesa.valor);
        const cent = Math.round(vNum * 100);
        document.getElementById("valor").value = window.AutoAcertoMascaras
            ? window.AutoAcertoMascaras.aplicarMoeda(String(cent))
            : String(vNum);
        document.getElementById("observacoes").value = despesa.observacoes || "";

        await carregarViagens(despesa.viagem_id);
    } catch (erro) {
        console.error("Erro ao carregar despesa:", erro);
        alert("Erro de conexao com a API.");
    }
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function (e) {
    e.preventDefault();

    const valorNum = window.AutoAcertoMascaras
        ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valor").value)
        : parseFloat(document.getElementById("valor").value);
    if (isNaN(valorNum) || valorNum <= 0) {
        alert("Informe um valor válido.");
        return;
    }

    const dados = {
        viagemId: document.getElementById("viagemId").value,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        dataDespesa: document.getElementById("dataDespesa").value,
        valor: valorNum,
        observacoes: document.getElementById("observacoes").value
    };

    try {
        const response = await fetch(urlApiDespesas + "/" + idDespesa, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const erro = await response.json();
            alert(erro.mensagem || "Erro ao atualizar despesa.");
            return;
        }

        modal.classList.remove("oculto");
    } catch (erro) {
        console.error("Erro geral:", erro);
        alert("Erro de conexao com a API.");
    }
});

botaoOk.addEventListener("click", function () {
    window.location.href = "despesas.html";
});

document.getElementById("botaoCancelar").addEventListener("click", function () {
    window.location.href = "despesas.html";
});

document.querySelector(".botao-sair").addEventListener("click", function () {
    alert("Saindo do sistema...");
});

carregarDespesa();
