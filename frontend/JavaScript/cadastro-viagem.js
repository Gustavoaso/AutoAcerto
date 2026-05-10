const urlApiViagens = "http://localhost:3000/viagens";
const urlApiMotoristas = "http://localhost:3000/motoristas";
const urlApiVeiculos = "http://localhost:3000/veiculos";

const botaoSalvar = document.getElementById("botaoSalvarViagem");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

async function carregarMotoristas() {
    try {
        const response = await fetch(urlApiMotoristas);

        if (!response.ok) return;

        const motoristas = await response.json();
        const selectMotorista = document.getElementById("motoristaId");

        motoristas
            .filter(function (m) { return m.status === "ativo"; })
            .forEach(function (motorista) {
                const opcao = document.createElement("option");
                opcao.value = motorista.id;
                opcao.textContent = motorista.nome;
                selectMotorista.appendChild(opcao);
            });
    } catch (erro) {
        console.error("Erro ao carregar motoristas:", erro);
    }
}

async function carregarVeiculos() {
    try {
        const response = await fetch(urlApiVeiculos);

        if (!response.ok) return;

        const veiculos = await response.json();
        const selectVeiculo = document.getElementById("veiculoId");

        veiculos
            .filter(function (v) { return v.status === "ativo"; })
            .forEach(function (veiculo) {
                const opcao = document.createElement("option");
                opcao.value = veiculo.id;
                opcao.textContent = veiculo.modelo + " — " + veiculo.placa;
                selectVeiculo.appendChild(opcao);
            });
    } catch (erro) {
        console.error("Erro ao carregar veículos:", erro);
    }
}

botaoSalvar.addEventListener("click", async function (e) {
    e.preventDefault();

    const valorFreteNum = window.AutoAcertoMascaras
        ? window.AutoAcertoMascaras.moedaParaNumero(document.getElementById("valorFrete").value)
        : parseFloat(document.getElementById("valorFrete").value);
    if (isNaN(valorFreteNum) || valorFreteNum <= 0) {
        alert("Informe um valor de frete válido.");
        return;
    }

    const dados = {
        origem: document.getElementById("origem").value,
        destino: document.getElementById("destino").value,
        motoristaId: document.getElementById("motoristaId").value,
        veiculoId: document.getElementById("veiculoId").value,
        dataSaida: document.getElementById("dataSaida").value,
        dataChegada: document.getElementById("dataChegada").value,
        valorFrete: valorFreteNum,
        status: document.getElementById("status").value,
        observacoes: document.getElementById("observacoes").value
    };

    try {
        const response = await fetch(urlApiViagens, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const erro = await response.json();
            alert(erro.mensagem || "Erro ao cadastrar viagem.");
            return;
        }

        modal.classList.remove("oculto");
    } catch (erro) {
        console.error("Erro geral:", erro);
        alert("Erro de conexão com a API.");
    }
});

botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "viagens.html";
});

botaoLimpar.addEventListener("click", function () {
    document.getElementById("formularioViagem").reset();
});

function iniciarPaginaCadastroViagem() {
    carregarMotoristas();
    carregarVeiculos();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaCadastroViagem);
