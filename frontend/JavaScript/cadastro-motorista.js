const urlApi = "http://localhost:3000/motoristas";

const botaoSalvar = document.getElementById("botaoSalvarMotorista");
const botaoLimpar = document.getElementById("botaoLimpar");
const modal = document.getElementById("modalSucesso");
const botaoOk = document.getElementById("botaoOkModal");

botaoSalvar.addEventListener("click", async function (e) {
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

    console.log("Dados enviados:", dados);

    try {
        const response = await fetch(urlApi, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

        if (!response.ok) {
            const erro = await response.text();
            console.error("Erro da API:", erro);
            alert("Erro ao cadastrar motorista");
            return;
        }

        modal.classList.remove("oculto");

    } catch (error) {
        console.error("Erro geral:", error);
        alert("Erro de conexão com a API");
    }
});

botaoOk.addEventListener("click", function () {
    modal.classList.add("oculto");
    window.location.href = "motoristas.html";
});

botaoLimpar.addEventListener("click", function () {
    document.getElementById("formularioMotorista").reset();
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
