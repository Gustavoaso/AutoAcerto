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
        exibirModalErroCadastro("Motorista nao encontrado.");
        window.location.href = "motoristas.html";
        return;
    }

    try {
        const response = await fetch(urlApi + "/" + idMotorista,{ headers: cabecalhosAutenticados() });

        if (!response.ok) {
            exibirModalErroCadastro("Motorista nao encontrado.");
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
        exibirModalErroCadastro("Erro de conexao com a API.");
    }
}

document.getElementById("botaoSalvarEdicao").addEventListener("click", async function (e) {
    e.preventDefault();
    limparValidacoesCadastro();

    const dados = {
        nome: document.getElementById("nome").value.trim(),
        cpf: document.getElementById("cpf").value.trim(),
        telefone: document.getElementById("telefone").value.trim(),
        cnh: document.getElementById("cnh").value.trim(),
        status: document.getElementById("status").value
    };

    const campos = [];
    if (!dados.nome) campos.push({ campo: "nome", mensagem: "Informe o nome do motorista." });
    if (!dados.cpf) campos.push({ campo: "cpf", mensagem: "Informe o CPF do motorista." });
    if (!dados.telefone) campos.push({ campo: "telefone", mensagem: "Informe o telefone do motorista." });
    if (!dados.cnh) campos.push({ campo: "cnh", mensagem: "Informe a CNH do motorista." });
    if (!dados.status) campos.push({ campo: "status", mensagem: "Selecione o status do motorista." });

    if (campos.length > 0) {
        exibirModalErroCadastro("Preencha os campos obrigatorios.", campos);
        return;
    }

    try {
        const response = await fetch(urlApi + "/" + idMotorista, {
            method: "PUT",
            headers: cabecalhosAutenticados(),
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const erro = await response.json();
            exibirModalErroCadastro(erro.mensagem || "Erro ao atualizar motorista.", erro.campos);
            return;
        }

        modal.classList.remove("oculto");
    } catch (error) {
        console.error("Erro geral:", error);
        exibirModalErroCadastro("Erro de conexao com a API.");
    }
});

botaoOk.addEventListener("click", function () {
    window.location.href = "motoristas.html";
});

document.getElementById("botaoCancelar").addEventListener("click", function () {
    window.location.href = "motoristas.html";
});

document.addEventListener("DOMContentLoaded", carregarMotorista);
