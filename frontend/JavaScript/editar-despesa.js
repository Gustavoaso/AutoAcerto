const urlApiDespesas = montarUrlApi("/despesas");
const urlApiViagens = montarUrlApi("/viagens");
const urlApiVeiculos = montarUrlApi("/veiculos");

const params = new URLSearchParams(window.location.search);
const idDespesa = params.get("id");

const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
let tipoDespesaSelecionado = "viagem";
let viagensCache = [];

async function carregarViagens(viagemIdSelecionada) {
    try {
        let viagens = window.AutoAcertoApi
            ? await window.AutoAcertoApi.buscarTodosRegistrosPaginados(urlApiViagens)
            : (await (await fetch(urlApiViagens, { headers: cabecalhosAutenticados() })).json()).dados || [];

        viagensCache = viagens;
        const selectViagem = document.getElementById("viagemId");
        selectViagem.innerHTML = '<option value="">Selecione</option>';

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

async function carregarVeiculos(veiculoIdSelecionado) {
    try {
        const response = await fetch(urlApiVeiculos,{ headers: cabecalhosAutenticados() });

        if (!response.ok) return;

        const resultado = await response.json();
        // Suporta resposta paginada ou array direto
        const veiculos = resultado.dados || resultado;
        const selectVeiculo = document.getElementById("veiculoId");

        veiculos.forEach(function (veiculo) {
            const opcao = document.createElement("option");
            opcao.value = veiculo.id;
            opcao.textContent = veiculo.modelo + " - " + veiculo.placa;

            if (String(veiculo.id) === String(veiculoIdSelecionado)) {
                opcao.selected = true;
            }

            selectVeiculo.appendChild(opcao);
        });
    } catch (erro) {
        console.error("Erro ao carregar veiculos:", erro);
    }
}

function alternarTipoDespesa(tipo, limparCampos) {
    tipoDespesaSelecionado = tipo;

    const despesaViagem = tipo === "viagem";
    document.getElementById("grupoViagemDespesa").classList.toggle("oculto", !despesaViagem);
    document.getElementById("grupoVeiculoDespesa").classList.toggle("oculto", despesaViagem);
    document.getElementById("viagemId").required = despesaViagem;
    document.getElementById("veiculoId").required = !despesaViagem;

    if (limparCampos !== false) {
        if (despesaViagem) {
            document.getElementById("veiculoId").value = "";
        } else {
            document.getElementById("viagemId").value = "";
        }
    }

    document.querySelectorAll("[data-tipo-despesa]").forEach(function (botao) {
        botao.classList.toggle("ativo", botao.dataset.tipoDespesa === tipo);
    });
}

function configurarTipoDespesa() {
    document.querySelectorAll("[data-tipo-despesa]").forEach(function (botao) {
        botao.addEventListener("click", function () {
            alternarTipoDespesa(botao.dataset.tipoDespesa);
        });
    });
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
        await carregarVeiculos(despesa.veiculo_id);
        alternarTipoDespesa(despesa.tipo_despesa === "veiculo" ? "veiculo" : "viagem", false);
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
        alert("Informe um valor maior que zero.");
        return;
    }

    const dataDespesa = document.getElementById("dataDespesa").value;
    if (tipoDespesaSelecionado === "viagem") {
        const viagemId = document.getElementById("viagemId").value;
        const viagem = viagensCache.find(function (item) {
            return String(item.id) === String(viagemId);
        });
        const erroData = window.AutoAcertoRegras
            ? window.AutoAcertoRegras.validarDespesa(dataDespesa, viagem)
            : null;
        if (erroData) {
            alert(erroData);
            return;
        }
    } else if (window.AutoAcertoRegras && !window.AutoAcertoRegras.dataNaoFutura(dataDespesa)) {
        alert("A data da despesa nao pode ser futura.");
        return;
    }

    const dados = {
        tipoDespesa: tipoDespesaSelecionado,
        viagemId: tipoDespesaSelecionado === "viagem" ? document.getElementById("viagemId").value : null,
        veiculoId: tipoDespesaSelecionado === "veiculo" ? document.getElementById("veiculoId").value : null,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        dataDespesa: dataDespesa,
        valor: valorNum,
        observacoes: document.getElementById("observacoes").value
    };

    try {
        const response = await fetch(urlApiDespesas + "/" + idDespesa, {
            method: "PUT",
            headers: cabecalhosAutenticados(),
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            if (typeof respostaEhBloqueioAssinatura === "function" && respostaEhBloqueioAssinatura(response)) {
                return;
            }
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

if (typeof preencherInfoUsuario === "function") preencherInfoUsuario();
if (typeof configurarBotaoSair === "function") configurarBotaoSair();
if (typeof marcarItemMenuLateralAtivo === "function") marcarItemMenuLateralAtivo();

configurarTipoDespesa();
carregarDespesa();
