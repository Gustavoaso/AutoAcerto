const urlApi = "http://localhost:3000/motoristas";

const params = new URLSearchParams(window.location.search);
const idMotorista = params.get("id");

const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

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

        document.getElementById("nome").value = motorista.nome;
        document.getElementById("cpf").value = motorista.cpf;
        document.getElementById("telefone").value = motorista.telefone;
        document.getElementById("cnh").value = motorista.cnh;
        document.getElementById("status").value = motorista.status;
        document.getElementById("endereco").value = motorista.endereco || "";
        document.getElementById("observacoes").value = motorista.observacoes || "";

        if (motorista.validade_cnh) {
            const data = new Date(motorista.validade_cnh);
            const ano = data.getUTCFullYear();
            const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
            const dia = String(data.getUTCDate()).padStart(2, "0");
            document.getElementById("validadeCnh").value = ano + "-" + mes + "-" + dia;
        }

    } catch (error) {
        console.error("Erro ao carregar motorista:", error);
        alert("Erro de conexão com a API");
    }
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function (e) {
    e.preventDefault();

    const dados = {
        nome: document.getElementById("nome").value,
        cpf: document.getElementById("cpf").value,
        telefone: document.getElementById("telefone").value,
        cnh: document.getElementById("cnh").value,
        validadeCnh: document.getElementById("validadeCnh").value,
        status: document.getElementById("status").value,
        endereco: document.getElementById("endereco").value,
        observacoes: document.getElementById("observacoes").value
    };

    try {
        const response = await fetch(urlApi + "/" + idMotorista, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const erro = await response.json();
            alert(erro.mensagem || "Erro ao atualizar motorista");
            return;
        }

        modal.classList.remove("oculto");

    } catch (error) {
        console.error("Erro geral:", error);
        alert("Erro de conexão com a API");
    }
});

botaoOk.addEventListener("click", function () {
    window.location.href = "motoristas.html";
});

document.getElementById("botaoCancelar").addEventListener("click", function () {
    window.location.href = "motoristas.html";
});

document.getElementById("cpf").addEventListener("input", function (e) {
    e.target.value = e.target.value
        .replace(/\D/g, "")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
});

document.getElementById("telefone").addEventListener("input", function (e) {
    e.target.value = e.target.value
        .replace(/\D/g, "")
        .replace(/^(\d{2})(\d)/g, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2");
});

carregarMotorista();
