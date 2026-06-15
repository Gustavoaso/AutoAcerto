(function () {
    "use strict";

    function extrairDataIso(valor) {
        if (!valor) return null;
        const texto = String(valor);
        if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
            return texto.slice(0, 10);
        }
        const timestamp = Date.parse(texto);
        if (!Number.isFinite(timestamp)) return null;
        const data = new Date(timestamp);
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");
        return ano + "-" + mes + "-" + dia;
    }

    function obterDataHojeIso() {
        const data = new Date();
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");
        return ano + "-" + mes + "-" + dia;
    }

    function dataMaiorOuIgual(dataA, dataB) {
        const isoA = extrairDataIso(dataA);
        const isoB = extrairDataIso(dataB);
        if (!isoA || !isoB) return false;
        return isoA >= isoB;
    }

    function dataNaoFutura(data) {
        const iso = extrairDataIso(data);
        if (!iso) return false;
        return iso <= obterDataHojeIso();
    }

    function validarDatasViagem(dataSaida, dataChegada) {
        if (!dataSaida) {
            return "Informe a data de saida da viagem.";
        }
        if (dataChegada && !dataMaiorOuIgual(dataChegada, dataSaida)) {
            return "A data de chegada nao pode ser anterior a data de saida.";
        }
        return null;
    }

    function validarDespesa(dataDespesa, viagem) {
        if (!dataDespesa) {
            return "Informe a data da despesa.";
        }

        if (viagem) {
            if (viagem.status !== "em andamento") {
                return "Despesas so podem ser lancadas em viagens em andamento.";
            }
            if (viagem.data_saida && !dataMaiorOuIgual(dataDespesa, viagem.data_saida)) {
                return "A data da despesa nao pode ser anterior a data de saida da viagem.";
            }
            if (viagem.data_chegada && !dataMaiorOuIgual(viagem.data_chegada, dataDespesa)) {
                return "A data da despesa nao pode ser posterior a data final da viagem.";
            }
            if (!dataNaoFutura(dataDespesa)) {
                return "A data da despesa nao pode ser futura.";
            }
            return null;
        }

        if (!dataNaoFutura(dataDespesa)) {
            return "A data da despesa nao pode ser futura.";
        }

        return null;
    }

    window.AutoAcertoRegras = {
        extrairDataIso: extrairDataIso,
        obterDataHojeIso: obterDataHojeIso,
        dataMaiorOuIgual: dataMaiorOuIgual,
        dataNaoFutura: dataNaoFutura,
        validarDatasViagem: validarDatasViagem,
        validarDespesa: validarDespesa
    };
})();
