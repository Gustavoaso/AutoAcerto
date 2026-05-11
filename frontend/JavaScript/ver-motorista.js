const urlApi = montarUrlApi("/motoristas");

const params = new URLSearchParams(window.location.search);
const idMotorista = params.get("id");

async function carregarMotorista() {
    if (!idMotorista) {
        alert("Motorista não encontrado.");
        window.location.href = "motoristas.html";
        return;
    }

    try {
        const response = await fetch(urlApi + "/" + idMotorista);

        if (!response.ok) {
            alert("Motorista não encontrado.");
            window.location.href = "motoristas.html";
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
        alert("Erro de conexão com a API");
    }
}

document.getElementById("botaoVoltar").addEventListener("click", function () {
    window.location.href = "motoristas.html";
});

document.getElementById("botaoEditar").addEventListener("click", function () {
    window.location.href = "editar-motorista.html?id=" + idMotorista;
});

carregarMotorista();
