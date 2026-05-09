const urlApiDespesas = "http://localhost:3000/despesas";
const urlApiViagens = "http://localhost:3000/viagens";

const botaoSalvar = document.getElementById("botaoSalvarDespesa");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

async function carregarViagens() {
    const token = localStorage.getItem("token");
    
    try {
        const response = await fetch(urlApiViagens, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) return;

        const viagens = await response.json();
        const selectViagem = document.getElementById("viagemId");

        viagens.forEach(function (viagem) {
            const opcao = document.createElement("option");
            opcao.value = viagem.id;
            opcao.textContent = viagem.origem + " -> " + viagem.destino;
            selectViagem.appendChild(opcao);
        });
    } catch (erro) {
        console.error("Erro ao carregar viagens:", erro);
    }
}

botaoSalvar.addEventListener("click", async function (e) {
    e.preventDefault();

    const dados = {
        viagemId: document.getElementById("viagemId").value,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        dataDespesa: document.getElementById("dataDespesa").value,
        valor: document.getElementById("valor").value
    };

    const token = localStorage.getItem("token");

    try {
        const response = await fetch(urlApiDespesas, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const erro = await response.json();
            alert(erro.mensagem || "Erro ao cadastrar despesa.");
            return;
        }

        modal.classList.remove("oculto");
    } catch (erro) {
        console.error("Erro geral:", erro);
        alert("Erro de conexao com a API.");
    }
});

botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "despesas.html";
});

botaoLimpar.addEventListener("click", function () {
    document.getElementById("viagemId").value = "";
    document.getElementById("descricao").value = "";
    document.getElementById("categoria").value = "";
    document.getElementById("dataDespesa").value = "";
    document.getElementById("valor").value = "";
});

document.querySelector(".botao-sair").addEventListener("click", function () {
    alert("Saindo do sistema...");
});

function iniciarPaginaCadastroDespesa() {
    carregarViagens();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaCadastroDespesa);
