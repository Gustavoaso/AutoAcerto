const urlApi = montarUrlApi("/motoristas");

const params = new URLSearchParams(window.location.search);
const idMotorista = params.get("id");

function exibirMotoristaNaoEncontrado() {
    if (typeof exibirAlertaRegistroNaoEncontrado === "function") {
        exibirAlertaRegistroNaoEncontrado("Motorista", "motoristas.html");
        return;
    }

    alert("Motorista nao encontrado.");
    window.location.href = "motoristas.html";
}

async function carregarMotorista() {
    if (!idMotorista) {
        exibirMotoristaNaoEncontrado();
        return;
    }

    try {
        const response = await fetch(urlApi + "/" + idMotorista, { headers: cabecalhosAutenticados() });

        if (!response.ok) {
            exibirMotoristaNaoEncontrado();
            return;
        }

        const motorista = await response.json();

        document.getElementById("detalheNome").textContent = motorista.nome;
        document.getElementById("detalheCpf").textContent = motorista.cpf;
        document.getElementById("detalheTelefone").textContent = motorista.telefone;
        document.getElementById("detalheCnh").textContent = motorista.cnh;

        const statusEl = document.getElementById("detalheStatus");
        if (motorista.status === "ativo") {
            statusEl.innerHTML = '<span class="selo-status selo-ativo">Ativo</span>';
        } else {
            statusEl.innerHTML = '<span class="selo-status selo-inativo">Inativo</span>';
        }
    } catch (error) {
        console.error("Erro ao carregar motorista:", error);
        if (typeof exibirAlertaErroConexao === "function") {
            exibirAlertaErroConexao("carregar motorista");
        } else {
            alert("Erro de conexao com a API.");
        }
    }
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
    window.location.href = "motoristas.html";
});

document.getElementById("botaoEditar").addEventListener("click", function () {
    window.location.href = "editar-motorista.html?id=" + idMotorista;
});

carregarMotorista();
