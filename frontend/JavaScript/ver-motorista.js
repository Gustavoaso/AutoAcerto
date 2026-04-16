const urlApi = "http://localhost:3000/motoristas";

const params = new URLSearchParams(window.location.search);
const idMotorista = params.get("id");

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
        document.getElementById("detalheValidadeCnh").textContent = formatarData(motorista.validade_cnh);
        document.getElementById("detalheEndereco").textContent = motorista.endereco || "—";
        document.getElementById("detalheObservacoes").textContent = motorista.observacoes || "—";
        document.getElementById("detalheDataCadastro").textContent = formatarDataHora(motorista.data_cadastro);

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
