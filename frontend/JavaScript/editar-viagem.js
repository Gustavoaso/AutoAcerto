const urlApiViagens = montarUrlApi("/viagens");
const urlApiMotoristas = montarUrlApi("/motoristas");
const urlApiVeiculos = montarUrlApi("/veiculos");

const params = new URLSearchParams(window.location.search);
const idViagem = params.get("id");
const usuarioLogado = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;

const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");
let viagemAtual = null;

if (window.AutoAcertoCidades) {
    window.AutoAcertoCidades.configurar(["origem", "destino"]);
}

async function carregarMotoristas(motoristaIdSelecionado) {
    try {
        const response = await fetch(urlApiMotoristas,{ headers: cabecalhosAutenticados() });

        if (!response.ok) return;

        const resultado = await response.json();
        // Suporta resposta paginada ou array direto
        const motoristas = resultado.dados || resultado;
        const selectMotorista = document.getElementById("motoristaId");

        motoristas.forEach(function (motorista) {
            const opcao = document.createElement("option");
            opcao.value = motorista.id;
            opcao.textContent = motorista.nome;

            if (String(motorista.id) === String(motoristaIdSelecionado)) {
                opcao.selected = true;
            }

            selectMotorista.appendChild(opcao);
        });
    } catch (erro) {
        console.error("Erro ao carregar motoristas:", erro);
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
            opcao.textContent = veiculo.modelo + " — " + veiculo.placa;

            if (String(veiculo.id) === String(veiculoIdSelecionado)) {
                opcao.selected = true;
            }

            selectVeiculo.appendChild(opcao);
        });
    } catch (erro) {
        console.error("Erro ao carregar veículos:", erro);
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

        viagemAtual = viagem;

        document.getElementById("origem").value = viagem.origem;
        document.getElementById("destino").value = viagem.destino;
        document.getElementById("dataSaida").value = formatarDataParaInput(viagem.data_saida);
        document.getElementById("dataChegada").value = formatarDataParaInput(viagem.data_chegada);
        const vf = Number(viagem.valor_frete);
        const cent = Math.round(vf * 100);
        document.getElementById("valorFrete").value = window.AutoAcertoMascaras
            ? window.AutoAcertoMascaras.aplicarMoeda(String(cent))
            : String(vf);
        document.getElementById("kmInicial").value = viagem.km_inicial || "";
        document.getElementById("kmFinal").value = viagem.km_final || "";
        document.getElementById("status").value = viagem.status;
        document.getElementById("observacoes").value = viagem.observacoes || "";

        await carregarMotoristas(viagem.motorista_id);
        await carregarVeiculos(viagem.veiculo_id);
        configurarRestricoesMotorista();
        configurarInterfacePorStatus(viagem);

    } catch (erro) {
        console.error("Erro ao carregar viagem:", erro);
        alert("Erro de conexão com a API.");
    }
}

function configurarRestricoesMotorista() {
    if (!usuarioLogado || usuarioLogado.perfil !== "motorista") return;

    document.getElementById("motoristaId").disabled = true;
    document.getElementById("veiculoId").disabled = true;
    document.getElementById("valorFrete").disabled = true;
}

function configurarInterfacePorStatus(viagem) {
    const emAndamento = viagem.status === "em andamento";
    const botaoConcluir = document.getElementById("botaoConcluirViagem");
    const campoChegada = document.getElementById("dataChegada");
    const campoKmFinal = document.getElementById("kmFinal");
    const selectStatus = document.getElementById("status");

    if (botaoConcluir) {
        botaoConcluir.classList.toggle("oculto", !emAndamento);
    }

    if (campoChegada) {
        campoChegada.disabled = emAndamento;
        if (emAndamento) campoChegada.value = "";
    }

    if (campoKmFinal) {
        campoKmFinal.disabled = emAndamento;
        if (emAndamento) campoKmFinal.value = "";
    }

    if (selectStatus && !emAndamento && !selectStatus.querySelector('option[value="finalizada"]')) {
        const opcaoFinalizada = document.createElement("option");
        opcaoFinalizada.value = "finalizada";
        opcaoFinalizada.textContent = "Finalizada";
        selectStatus.insertBefore(opcaoFinalizada, selectStatus.querySelector('option[value="cancelada"]'));
    }
}

const botaoConcluirViagem = document.getElementById("botaoConcluirViagem");
if (botaoConcluirViagem) {
    botaoConcluirViagem.addEventListener("click", function () {
        if (!viagemAtual || !window.AutoAcertoViagem) return;

        window.AutoAcertoViagem.abrirModalFinalizarViagem({
            idViagem: idViagem,
            kmInicial: viagemAtual.km_inicial,
            dataSaida: viagemAtual.data_saida,
            aoConcluir: function () {
                window.location.href = "viagens.html";
            }
        });
    });
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function (e) {
    e.preventDefault();

    const valorFreteNum = window.AutoAcertoMascaras
        ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valorFrete").value)
        : parseFloat(document.getElementById("valorFrete").value);
    if (isNaN(valorFreteNum) || valorFreteNum <= 0) {
        alert("Informe um valor de frete maior que zero.");
        return;
    }

    const dataSaida = document.getElementById("dataSaida").value;
    const dataChegada = document.getElementById("dataChegada").value;
    const emAndamento = viagemAtual && viagemAtual.status === "em andamento";

    if (!emAndamento) {
        const erroDatas = window.AutoAcertoRegras
            ? window.AutoAcertoRegras.validarDatasViagem(dataSaida, dataChegada)
            : null;
        if (erroDatas) {
            alert(erroDatas);
            return;
        }
    }

    const kmInicialNum = parseInt(document.getElementById("kmInicial").value, 10);
    const kmFinalNum = parseInt(document.getElementById("kmFinal").value, 10);

    if (isNaN(kmInicialNum) || kmInicialNum < 0) {
        alert("Informe o KM inicial valido.");
        return;
    }

    if (!emAndamento) {
        if (isNaN(kmFinalNum) || kmFinalNum < 0) {
            alert("Informe o KM final valido.");
            return;
        }

        if (kmFinalNum < kmInicialNum) {
            alert("O KM final nao pode ser menor que o KM inicial.");
            return;
        }
    }

    const dados = {
        origem: document.getElementById("origem").value,
        destino: document.getElementById("destino").value,
        motoristaId: document.getElementById("motoristaId").value,
        veiculoId: document.getElementById("veiculoId").value,
        dataSaida: dataSaida,
        valorFrete: valorFreteNum,
        kmInicial: kmInicialNum,
        status: document.getElementById("status").value,
        observacoes: document.getElementById("observacoes").value
    };

    if (!emAndamento) {
        dados.dataChegada = dataChegada;
        dados.kmFinal = kmFinalNum;
    }

    try {
        const response = await fetch(urlApiViagens + "/" + idViagem, {
            method: "PUT",
            headers: cabecalhosAutenticados(),
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const erro = await response.json();
            alert(erro.mensagem || "Erro ao atualizar viagem.");
            return;
        }

        modal.classList.remove("oculto");
    } catch (erro) {
        console.error("Erro geral:", erro);
        alert("Erro de conexão com a API.");
    }
});

botaoOk.addEventListener("click", function () {
    window.location.href = "viagens.html";
});

document.getElementById("botaoCancelar").addEventListener("click", function () {
    window.location.href = "viagens.html";
});

const sessaoValida = typeof exigirAutenticacao !== "function" || Boolean(exigirAutenticacao());

if (sessaoValida) {
    if (typeof preencherInfoUsuario === "function") preencherInfoUsuario();
    if (typeof configurarBotaoSair === "function") configurarBotaoSair();
    if (typeof marcarItemMenuLateralAtivo === "function") marcarItemMenuLateralAtivo();
    carregarViagem();
}
