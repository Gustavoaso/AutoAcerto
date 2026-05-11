const urlApi = montarUrlApi("/motoristas");

const params = new URLSearchParams(window.location.search);
const idMotorista = params.get("id");

const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

function aplicarMascarasNosCampos() {
    const M = window.AutoAcertoMascaras;
    if (!M) return;
    const cpf = document.getElementById("cpf");
    const tel = document.getElementById("telefone");
    const cnh = document.getElementById("cnh");
    if (cpf) cpf.value = M.aplicarCpf(cpf.value);
    if (tel) tel.value = M.aplicarTelefone(tel.value);
    if (cnh) cnh.value = M.aplicarCnh(cnh.value);
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

        document.getElementById("nome").value = motorista.nome;
        document.getElementById("cpf").value = motorista.cpf;
        document.getElementById("telefone").value = motorista.telefone;
        document.getElementById("cnh").value = motorista.cnh;
        document.getElementById("status").value = motorista.status;
        aplicarMascarasNosCampos();
    } catch (error) {
        console.error("Erro ao carregar motorista:", error);
        alert("Erro de conexão com a API");
    }
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function (e) {
    e.preventDefault();

    const dados = {
        nome: document.getElementById("nome").value.trim(),
        cpf: document.getElementById("cpf").value.trim(),
        telefone: document.getElementById("telefone").value.trim(),
        cnh: document.getElementById("cnh").value.trim(),
        status: document.getElementById("status").value
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

document.addEventListener("DOMContentLoaded", carregarMotorista);
