(function () {
    "use strict";

    async function finalizarViagem(idViagem, dados) {
        const url = montarUrlApi("/viagens/" + idViagem + "/finalizar");
        const resposta = await fetch(url, {
            method: "PATCH",
            headers: cabecalhosAutenticados(),
            body: JSON.stringify(dados || {})
        });

        const corpo = await resposta.json().catch(function () {
            return {};
        });

        if (!resposta.ok) {
            throw new Error(corpo.mensagem || "Nao foi possivel concluir a viagem.");
        }

        return corpo;
    }

    function abrirModalFinalizarViagem(opcoes) {
        const idViagem = opcoes.idViagem;
        const kmInicial = opcoes.kmInicial;
        const dataSaida = opcoes.dataSaida;
        const aoConcluir = opcoes.aoConcluir;

        if (document.getElementById("modalFinalizarViagem")) {
            document.getElementById("modalFinalizarViagem").remove();
        }

        const hoje = window.AutoAcertoRegras
            ? window.AutoAcertoRegras.obterDataHojeIso()
            : new Date().toISOString().slice(0, 10);

        const modal = document.createElement("div");
        modal.id = "modalFinalizarViagem";
        modal.className = "modal-sucesso";
        modal.innerHTML =
            '<div class="fundo-modal-sucesso"></div>' +
            '<div class="caixa-modal-sucesso">' +
                '<h3>Concluir viagem</h3>' +
                '<p>Informe a data de chegada e o KM final para encerrar a viagem.</p>' +
                '<div class="grade-formulario" style="text-align:left;margin:16px 0 8px;">' +
                    '<div class="grupo-campo">' +
                        '<label for="finalizarDataChegada">Data de chegada</label>' +
                        '<input type="date" id="finalizarDataChegada" value="' + hoje + '" required />' +
                    '</div>' +
                    '<div class="grupo-campo">' +
                        '<label for="finalizarKmFinal">KM final</label>' +
                        '<input type="number" id="finalizarKmFinal" min="0" step="1" placeholder="Ex: 120850" required />' +
                    '</div>' +
                '</div>' +
                '<div class="acoes-modal-sucesso">' +
                    '<button type="button" class="botao-secundario" id="botaoCancelarFinalizarViagem">Cancelar</button>' +
                    '<button type="button" class="botao-primario" id="botaoConfirmarFinalizarViagem">Concluir viagem</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);

        const inputData = document.getElementById("finalizarDataChegada");
        const inputKm = document.getElementById("finalizarKmFinal");
        if (inputData && dataSaida) {
            inputData.min = window.AutoAcertoRegras
                ? window.AutoAcertoRegras.extrairDataIso(dataSaida)
                : String(dataSaida).slice(0, 10);
        }

        function fecharModal() {
            modal.remove();
        }

        document.getElementById("botaoCancelarFinalizarViagem").addEventListener("click", fecharModal);

        document.getElementById("botaoConfirmarFinalizarViagem").addEventListener("click", async function () {
            const dataChegada = inputData.value;
            const kmFinal = parseInt(inputKm.value, 10);

            if (!dataChegada) {
                alert("Informe a data de chegada.");
                return;
            }

            if (!Number.isInteger(kmFinal) || kmFinal < 0) {
                alert("Informe o KM final corretamente.");
                return;
            }

            if (kmInicial != null && kmFinal < Number(kmInicial)) {
                alert("O KM final nao pode ser menor que o KM inicial.");
                return;
            }

            const erroDatas = window.AutoAcertoRegras
                ? window.AutoAcertoRegras.validarDatasViagem(dataSaida, dataChegada)
                : null;
            if (erroDatas) {
                alert(erroDatas);
                return;
            }

            try {
                await finalizarViagem(idViagem, { dataChegada: dataChegada, kmFinal: kmFinal });
                fecharModal();
                alert("Viagem concluida com sucesso.");
                if (typeof aoConcluir === "function") {
                    aoConcluir();
                }
            } catch (erro) {
                alert(erro.message || "Nao foi possivel concluir a viagem.");
            }
        });
    }

    window.AutoAcertoViagem = {
        finalizarViagem: finalizarViagem,
        abrirModalFinalizarViagem: abrirModalFinalizarViagem
    };
})();
