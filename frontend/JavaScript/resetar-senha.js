function obterTokenRecuperacao() {
    const url = new URL(window.location.href);
    return url.searchParams.get("token") || "";
}

function exibirMensagemReset(mensagem, tipo) {
    const elemento = document.getElementById("mensagemResetarSenha");
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.classList.add("visivel");
    elemento.classList.toggle("mensagem-sucesso", tipo === "sucesso");
}

function limparMensagemReset() {
    const elemento = document.getElementById("mensagemResetarSenha");
    if (!elemento) return;

    elemento.textContent = "";
    elemento.classList.remove("visivel", "mensagem-sucesso");
}

function configurarFormularioReset() {
    const formulario = document.getElementById("formularioResetarSenha");
    const botao = document.getElementById("botaoResetarSenha");

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        limparMensagemReset();

        const token = obterTokenRecuperacao();
        const novaSenha = document.getElementById("campoNovaSenhaReset").value;
        const confirmarSenha = document.getElementById("campoConfirmarSenhaReset").value;

        if (!token) {
            exibirMensagemReset("O link de recuperacao e invalido ou incompleto.", "erro");
            return;
        }

        if (novaSenha.length < 8) {
            exibirMensagemReset("A nova senha deve ter pelo menos 8 caracteres.", "erro");
            return;
        }

        if (novaSenha !== confirmarSenha) {
            exibirMensagemReset("As senhas nao conferem.", "erro");
            return;
        }

        botao.disabled = true;
        botao.textContent = "Salvando...";

        try {
            const resposta = await fetch(montarUrlApi("/auth/resetar-senha"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token, novaSenha: novaSenha })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                exibirMensagemReset(dados.mensagem || "Nao foi possivel redefinir a senha.", "erro");
                return;
            }

            formulario.reset();
            exibirMensagemReset("Senha redefinida com sucesso. Voce ja pode entrar no sistema.", "sucesso");
        } catch (erro) {
            exibirMensagemReset("Nao foi possivel concluir a redefinicao agora.", "erro");
        } finally {
            botao.disabled = false;
            botao.textContent = "Salvar nova senha";
        }
    });
}

document.addEventListener("DOMContentLoaded", configurarFormularioReset);
