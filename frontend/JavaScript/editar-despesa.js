const urlApiDespesas = montarUrlApi("/despesas");
const urlApiViagens = montarUrlApi("/viagens");
const urlApiVeiculos = montarUrlApi("/veiculos");

const params = new URLSearchParams(window.location.search);
const idDespesa = params.get("id");

const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
let tipoDespesaSelecionado = "viagem";
let viagensDisponiveis = [];

function normalizarDataIso(data) {
    if (!data) return "";

    const texto = String(data).trim();
    const dataIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dataIso) {
        return dataIso[1] + "-" + dataIso[2] + "-" + dataIso[3];
    }

    const dataBrasileira = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dataBrasileira) {
        return dataBrasileira[3] + "-" + dataBrasileira[2] + "-" + dataBrasileira[1];
    }

    return "";
}

function obterViagemSelecionada(viagemId) {
    return viagensDisponiveis.find(function (viagem) {
        return String(viagem.id) === String(viagemId);
    });
}

function dataForaDoPeriodo(data, dataInicio, dataFim) {
    const dataNormalizada = normalizarDataIso(data);
    const inicio = normalizarDataIso(dataInicio);
    const fim = normalizarDataIso(dataFim);

    if (!dataNormalizada || !inicio || !fim) return true;

    return dataNormalizada < inicio || dataNormalizada > fim;
}

async function carregarViagens(viagemIdSelecionada) {
    try {
        const response = await fetch(urlApiViagens,{ headers: cabecalhosAutenticados() });

        if (!response.ok) return;

        const viagens = await response.json();
        viagensDisponiveis = viagens;
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

async function carregarVeiculos(veiculoIdSelecionado) {
    try {
        const response = await fetch(urlApiVeiculos,{ headers: cabecalhosAutenticados() });

        if (!response.ok) return;

        const veiculos = await response.json();
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
        exibirModalErroCadastro("Despesa nao encontrada.");
        window.location.href = "despesas.html";
        return;
    }

    try {
        const response = await fetch(urlApiDespesas + "/" + idDespesa,{ headers: cabecalhosAutenticados() });

        if (!response.ok) {
            exibirModalErroCadastro("Despesa nao encontrada.");
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
        exibirModalErroCadastro("Erro de conexao com a API.");
    }
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function (e) {
    e.preventDefault();
    limparValidacoesCadastro();

    const camposObrigatorios = [];
    if (tipoDespesaSelecionado === "viagem" && !document.getElementById("viagemId").value) {
        camposObrigatorios.push({ campo: "viagemId", mensagem: "Selecione a viagem da despesa." });
    }
    if (tipoDespesaSelecionado === "veiculo" && !document.getElementById("veiculoId").value) {
        camposObrigatorios.push({ campo: "veiculoId", mensagem: "Selecione o veiculo da despesa." });
    }
    if (!document.getElementById("descricao").value.trim()) camposObrigatorios.push({ campo: "descricao", mensagem: "Informe a descricao da despesa." });
    if (!document.getElementById("categoria").value.trim()) camposObrigatorios.push({ campo: "categoria", mensagem: "Informe a categoria da despesa." });
    if (!document.getElementById("dataDespesa").value) camposObrigatorios.push({ campo: "dataDespesa", mensagem: "Informe a data da despesa." });
    if (!document.getElementById("valor").value.trim()) camposObrigatorios.push({ campo: "valor", mensagem: "Informe o valor da despesa." });

    if (camposObrigatorios.length > 0) {
        exibirModalErroCadastro("Preencha os campos obrigatorios.", camposObrigatorios);
        return;
    }

    const valorNum = window.AutoAcertoMascaras
        ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valor").value)
        : parseFloat(document.getElementById("valor").value);
    if (isNaN(valorNum) || valorNum <= 0) {
        exibirModalErroCadastro("Informe um valor valido.", [
            { campo: "valor", mensagem: "Informe um valor maior que zero." }
        ]);
        return;
    }

    const viagemId = tipoDespesaSelecionado === "viagem" ? document.getElementById("viagemId").value : null;
    const dataDespesa = document.getElementById("dataDespesa").value;

    if (tipoDespesaSelecionado === "viagem") {
        const viagemSelecionada = obterViagemSelecionada(viagemId);

        if (!viagemSelecionada || dataForaDoPeriodo(dataDespesa, viagemSelecionada.data_saida, viagemSelecionada.data_chegada)) {
            exibirModalErroCadastro("A data da despesa deve estar dentro do periodo da viagem selecionada.", [
                { campo: "dataDespesa", mensagem: "Informe uma data dentro do periodo da viagem." },
                { campo: "viagemId", mensagem: "Confira a viagem selecionada." }
            ]);
            return;
        }
    }

    const dados = {
        tipoDespesa: tipoDespesaSelecionado,
        viagemId: viagemId,
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
            const erro = await response.json();
            exibirModalErroCadastro(erro.mensagem || "Erro ao atualizar despesa.", erro.campos);
            return;
        }

        modal.classList.remove("oculto");
    } catch (erro) {
        console.error("Erro geral:", erro);
        exibirModalErroCadastro("Erro de conexao com a API.");
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
