const urlApiViagens = montarUrlApi("/viagens");
const urlApiDespesas = montarUrlApi("/despesas");
const urlApiMotoristas = montarUrlApi("/motoristas");

let viagens = [];
let despesas = [];
let motoristas = [];
let periodoDias = 30;

function criarIconeViagemLista() {
    return '<svg viewBox="0 0 24 24">' +
        '<path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z" />' +
        '<circle cx="12" cy="9" r="2.5" />' +
    '</svg>';
}

function criarIconeForaViagem() {
    return '<svg viewBox="0 0 24 24">' +
        '<path d="M4 7h16v12H4z" />' +
        '<path d="M16 7V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2" />' +
        '<path d="M8 13h8" />' +
    '</svg>';
}

async function carregarDadosRelatorio() {
    try {
        const respostas = await Promise.all([
            fetch(urlApiViagens,{ headers: cabecalhosAutenticados() }),
            fetch(urlApiDespesas,{ headers: cabecalhosAutenticados() }),
            fetch(urlApiMotoristas,{ headers: cabecalhosAutenticados() })
        ]);

        viagens = await respostas[0].json();
        despesas = await respostas[1].json();
        motoristas = await respostas[2].json();

        popularFiltroMotorista();
        aplicarFiltrosRelatorio();
    } catch (erro) {
        console.error("Erro ao carregar dados do relatorio:", erro);
    }
}

function popularFiltroMotorista() {
    const seletorMotorista = document.getElementById("filtroMotoristaRelatorio");

    motoristas.forEach(function (motorista) {
        const opcao = document.createElement("option");
        opcao.value = motorista.id;
        opcao.textContent = motorista.nome;
        seletorMotorista.appendChild(opcao);
    });
}

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatarData(dataISO) {
    if (!dataISO) return "-";
    const data = new Date(dataISO);
    const dia = String(data.getUTCDate()).padStart(2, "0");
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const ano = data.getUTCFullYear();
    return dia + "/" + mes + "/" + ano;
}

function obterResumoVeiculosDespesas(listaDespesas) {
    const mapaVeiculos = {};

    listaDespesas.forEach(function (despesa) {
        const modelo = despesa.veiculo_modelo || "-";
        const placa = despesa.veiculo_placa || "";
        const chave = modelo + "|" + placa;
        mapaVeiculos[chave] = { modelo: modelo, placa: placa };
    });

    const veiculos = Object.keys(mapaVeiculos).map(function (chave) {
        return mapaVeiculos[chave];
    });

    if (veiculos.length === 0) {
        return { modelo: "-", placa: "" };
    }

    if (veiculos.length === 1) {
        return veiculos[0];
    }

    return { modelo: "Diversos veículos", placa: veiculos.length + " veículos" };
}

function obterDataLimite(dias) {
    if (dias === 0) return null;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    return dataLimite;
}

function filtrarViagensPorPeriodo(listaViagens, dias) {
    const dataLimite = obterDataLimite(dias);
    if (!dataLimite) return listaViagens;

    return listaViagens.filter(function (viagem) {
        if (!viagem.data_saida) return false;
        const dataSaida = new Date(viagem.data_saida);
        return dataSaida >= dataLimite;
    });
}

function obterDespesasDaViagem(idViagem) {
    return despesas.filter(function (despesa) {
        return String(despesa.viagem_id) === String(idViagem);
    });
}

function filtrarDespesasForaDeViagemPorPeriodo(dias, valorMotorista, valorStatus, valorTipoLancamento) {
    if (valorTipoLancamento === "viagens") return [];
    if (valorMotorista !== "todos" || valorStatus !== "todos") return [];

    const dataLimite = obterDataLimite(dias);

    return despesas.filter(function (despesa) {
        if (despesa.viagem_id) return false;
        if (!dataLimite) return true;
        if (!despesa.data_despesa) return false;
        const dataDespesa = new Date(despesa.data_despesa);
        return dataDespesa >= dataLimite;
    });
}

function somarDespesasDaViagem(idViagem) {
    return obterDespesasDaViagem(idViagem).reduce(function (acumulador, despesa) {
        return acumulador + Number(despesa.valor);
    }, 0);
}

function criarSeloStatusViagem(status) {
    if (status === "em andamento") {
        return '<span class="selo-status selo-andamento">Em andamento</span>';
    }

    if (status === "finalizada") {
        return '<span class="selo-status selo-finalizada">Finalizada</span>';
    }

    return '<span class="selo-status selo-cancelada">Cancelada</span>';
}

function renderizarTabelaRelatorio(listaViagens, despesasForaDeViagem) {
    const corpoTabela = document.getElementById("corpoTabelaRelatorio");
    corpoTabela.innerHTML = "";

    if (listaViagens.length === 0 && despesasForaDeViagem.length === 0) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">
                    Nenhum lançamento encontrado no período selecionado.
                </td>
            </tr>
        `;
        atualizarRodapeTabela(0, 0);
        return;
    }

    let totalReceita = 0;
    let totalDespesasGeral = 0;

    listaViagens.forEach(function (viagem) {
        const frete = Number(viagem.valor_frete || 0);
        const totalDespesasViagem = somarDespesasDaViagem(viagem.id);
        const lucro = frete - totalDespesasViagem;
        const origemViagem = window.AutoAcertoHtml.texto(viagem.origem, "-");
        const destinoViagem = window.AutoAcertoHtml.texto(viagem.destino, "-");
        const motoristaViagem = window.AutoAcertoHtml.texto(viagem.motorista_nome, "-");
        const modeloVeiculo = window.AutoAcertoHtml.texto(viagem.veiculo_modelo, "-");
        const placaVeiculo = window.AutoAcertoHtml.texto(viagem.veiculo_placa, "");

        totalReceita += frete;
        totalDespesasGeral += totalDespesasViagem;

        const corLucro = lucro >= 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)";

        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        linha.innerHTML = `
            <td>
                <div class="bloco-viagem">
                    <div class="avatar-viagem">${criarIconeViagemLista()}</div>
                    <div>
                        <div class="nome-rota">${origemViagem} &rarr; ${destinoViagem}</div>
                    </div>
                </div>
            </td>
            <td>${motoristaViagem}</td>
            <td>
                ${modeloVeiculo}<br>
                <span class="texto-secundario">${placaVeiculo}</span>
            </td>
            <td>${formatarData(viagem.data_saida)}</td>
            <td>${formatarMoeda(frete)}</td>
            <td>${formatarMoeda(totalDespesasViagem)}</td>
            <td style="font-weight: 600; color: ${corLucro};">${formatarMoeda(lucro)}</td>
            <td>${criarSeloStatusViagem(viagem.status)}</td>
        `;

        corpoTabela.appendChild(linha);
    });

    if (despesasForaDeViagem.length > 0) {
        const totalDespesasForaViagem = despesasForaDeViagem.reduce(function (acumulador, despesa) {
            return acumulador + Number(despesa.valor);
        }, 0);

        totalDespesasGeral += totalDespesasForaViagem;
        const veiculoForaViagem = obterResumoVeiculosDespesas(despesasForaDeViagem);
        const modeloForaViagem = window.AutoAcertoHtml.texto(veiculoForaViagem.modelo, "-");
        const placaForaViagem = window.AutoAcertoHtml.texto(veiculoForaViagem.placa, "");

        const linhaForaViagem = document.createElement("tr");
        linhaForaViagem.classList.add("linha-tabela");
        linhaForaViagem.innerHTML = `
            <td>
                <div class="bloco-viagem">
                    <div class="avatar-viagem">${criarIconeForaViagem()}</div>
                    <div>
                        <div class="nome-rota">Fora de viagem</div>
                        <div class="texto-secundario">Despesas de pátio, oficina e manutenção</div>
                    </div>
                </div>
            </td>
            <td>-</td>
            <td>
                ${modeloForaViagem}
                <br>
                <span class="texto-secundario">${placaForaViagem}</span>
            </td>
            <td>-</td>
            <td>${formatarMoeda(0)}</td>
            <td>${formatarMoeda(totalDespesasForaViagem)}</td>
            <td style="font-weight: 600; color: var(--cor-perigo);">${formatarMoeda(totalDespesasForaViagem * -1)}</td>
            <td><span class="selo-status selo-cancelada">Fora de viagem</span></td>
        `;
        corpoTabela.appendChild(linhaForaViagem);
    }

    atualizarRodapeTabela(totalReceita, totalDespesasGeral);
}

function atualizarRodapeTabela(totalReceita, totalDespesas) {
    const lucroTotal = totalReceita - totalDespesas;
    const corLucro = lucroTotal >= 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)";

    document.getElementById("rodapeReceita").textContent = formatarMoeda(totalReceita);
    document.getElementById("rodapeDespesas").textContent = formatarMoeda(totalDespesas);
    document.getElementById("rodapeLucro").style.color = corLucro;
    document.getElementById("rodapeLucro").style.fontWeight = "700";
    document.getElementById("rodapeLucro").textContent = formatarMoeda(lucroTotal);
}

function renderizarTabelaCategorias(listaViagens, despesasForaDeViagem) {
    const corpoTabela = document.getElementById("corpoTabelaCategorias");
    corpoTabela.innerHTML = "";

    const idsViagens = listaViagens.map(function (viagem) {
        return String(viagem.id);
    });

    const despesasFiltradas = despesas.filter(function (despesa) {
        return idsViagens.includes(String(despesa.viagem_id));
    }).concat(despesasForaDeViagem);

    const totalGeral = despesasFiltradas.reduce(function (acumulador, despesa) {
        return acumulador + Number(despesa.valor);
    }, 0);

    const totaisPorCategoria = {};
    const quantidadePorCategoria = {};

    despesasFiltradas.forEach(function (despesa) {
        const categoria = despesa.categoria || "outros";

        if (!totaisPorCategoria[categoria]) {
            totaisPorCategoria[categoria] = 0;
            quantidadePorCategoria[categoria] = 0;
        }

        totaisPorCategoria[categoria] += Number(despesa.valor);
        quantidadePorCategoria[categoria] += 1;
    });

    const categorias = Object.keys(totaisPorCategoria).sort(function (a, b) {
        return totaisPorCategoria[b] - totaisPorCategoria[a];
    });

    if (categorias.length === 0) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: #6b7280;">
                    Nenhuma despesa encontrada no período selecionado.
                </td>
            </tr>
        `;
        return;
    }

    categorias.forEach(function (categoria) {
        const valorCategoria = totaisPorCategoria[categoria];
        const qtd = quantidadePorCategoria[categoria];
        const percentual = totalGeral > 0
            ? ((valorCategoria / totalGeral) * 100).toFixed(1)
            : "0.0";
        const nomeCategoria = window.AutoAcertoHtml.texto(formatarNomeCategoria(categoria), "-");

        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        linha.innerHTML = `
            <td style="font-weight: 500;">${nomeCategoria}</td>
            <td>${qtd}</td>
            <td>${formatarMoeda(valorCategoria)}</td>
            <td>${percentual}%</td>
        `;

        corpoTabela.appendChild(linha);
    });
}

function formatarNomeCategoria(categoria) {
    if (categoria === "combustivel") return "Combustível";
    if (categoria === "pedagio") return "Pedágio";
    if (categoria === "alimentacao") return "Alimentação";
    if (categoria === "manutencao") return "Manutenção";
    return "Outros";
}

function atualizarMetricas(listaViagens, despesasForaDeViagem) {
    const idsViagens = listaViagens.map(function (viagem) {
        return String(viagem.id);
    });

    const despesasFiltradas = despesas.filter(function (despesa) {
        return idsViagens.includes(String(despesa.viagem_id));
    }).concat(despesasForaDeViagem);

    const totalReceita = listaViagens.reduce(function (acumulador, viagem) {
        return acumulador + Number(viagem.valor_frete || 0);
    }, 0);

    const totalDespesas = despesasFiltradas.reduce(function (acumulador, despesa) {
        return acumulador + Number(despesa.valor);
    }, 0);

    const lucroLiquido = totalReceita - totalDespesas;
    const corLucro = lucroLiquido >= 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)";

    document.getElementById("metricaReceita").textContent = formatarMoeda(totalReceita);
    document.getElementById("metricaDespesas").textContent = formatarMoeda(totalDespesas);
    document.getElementById("metricaLucro").textContent = formatarMoeda(lucroLiquido);
    document.getElementById("metricaLucro").style.color = corLucro;
    document.getElementById("metricaViagens").textContent = listaViagens.length;
}

function aplicarFiltrosRelatorio() {
    const valorMotorista = document.getElementById("filtroMotoristaRelatorio").value;
    const valorStatus = document.getElementById("filtroStatusRelatorio").value;
    const valorTipoLancamento = document.getElementById("filtroTipoLancamentoRelatorio").value;

    let listaFiltrada = filtrarViagensPorPeriodo(viagens, periodoDias);

    if (valorMotorista !== "todos") {
        listaFiltrada = listaFiltrada.filter(function (viagem) {
            return String(viagem.motorista_id) === String(valorMotorista);
        });
    }

    if (valorStatus !== "todos") {
        listaFiltrada = listaFiltrada.filter(function (viagem) {
            return viagem.status === valorStatus;
        });
    }

    if (valorTipoLancamento === "fora") {
        listaFiltrada = [];
    }

    const despesasForaDeViagem = filtrarDespesasForaDeViagemPorPeriodo(periodoDias, valorMotorista, valorStatus, valorTipoLancamento);

    atualizarMetricas(listaFiltrada, despesasForaDeViagem);
    renderizarTabelaRelatorio(listaFiltrada, despesasForaDeViagem);
    renderizarTabelaCategorias(listaFiltrada, despesasForaDeViagem);
}

function exportarCSV() {
    const valorMotorista = document.getElementById("filtroMotoristaRelatorio").value;
    const valorStatus = document.getElementById("filtroStatusRelatorio").value;
    const valorTipoLancamento = document.getElementById("filtroTipoLancamentoRelatorio").value;

    let listaFiltrada = filtrarViagensPorPeriodo(viagens, periodoDias);

    if (valorMotorista !== "todos") {
        listaFiltrada = listaFiltrada.filter(function (viagem) {
            return String(viagem.motorista_id) === String(valorMotorista);
        });
    }

    if (valorStatus !== "todos") {
        listaFiltrada = listaFiltrada.filter(function (viagem) {
            return viagem.status === valorStatus;
        });
    }

    if (valorTipoLancamento === "fora") {
        listaFiltrada = [];
    }

    const despesasForaDeViagem = filtrarDespesasForaDeViagemPorPeriodo(periodoDias, valorMotorista, valorStatus, valorTipoLancamento);

    const linhasCSV = [
        ["Origem", "Destino", "Motorista", "Veiculo", "Placa", "Data Saida", "Frete", "Despesas", "Lucro", "Status"]
    ];

    listaFiltrada.forEach(function (viagem) {
        const frete = Number(viagem.valor_frete || 0);
        const totalDespesasViagem = somarDespesasDaViagem(viagem.id);
        const lucro = frete - totalDespesasViagem;

        linhasCSV.push([
            viagem.origem || "-",
            viagem.destino || "-",
            viagem.motorista_nome || "-",
            viagem.veiculo_modelo || "-",
            viagem.veiculo_placa || "-",
            formatarData(viagem.data_saida),
            frete.toFixed(2).replace(".", ","),
            totalDespesasViagem.toFixed(2).replace(".", ","),
            lucro.toFixed(2).replace(".", ","),
            viagem.status || "-"
        ]);
    });

    if (despesasForaDeViagem.length > 0) {
        const totalDespesasForaViagem = despesasForaDeViagem.reduce(function (acumulador, despesa) {
            return acumulador + Number(despesa.valor);
        }, 0);
        const veiculoForaViagem = obterResumoVeiculosDespesas(despesasForaDeViagem);

        linhasCSV.push([
            "Fora de viagem",
            "-",
            "-",
            veiculoForaViagem.modelo,
            veiculoForaViagem.placa,
            "-",
            "0,00",
            totalDespesasForaViagem.toFixed(2).replace(".", ","),
            (totalDespesasForaViagem * -1).toFixed(2).replace(".", ","),
            "Fora de viagem"
        ]);
    }

    const conteudoCSV = linhasCSV.map(function (linha) {
        return linha.map(function (celula) {
            return '"' + String(celula).replace(/"/g, '""') + '"';
        }).join(",");
    }).join("\n");

    const blob = new Blob(["\uFEFF" + conteudoCSV], { type: "text/csv;charset=utf-8;" });
    const urlBlob = URL.createObjectURL(blob);
    const linkDownload = document.createElement("a");
    linkDownload.href = urlBlob;
    linkDownload.download = "relatorio-autoacerto.csv";
    linkDownload.click();
    URL.revokeObjectURL(urlBlob);
}

function configurarEventosRelatorio() {
    document.querySelectorAll(".botao-periodo").forEach(function (botao) {
        botao.addEventListener("click", function () {
            document.querySelectorAll(".botao-periodo").forEach(function (b) {
                b.classList.remove("ativo");
            });

            botao.classList.add("ativo");
            periodoDias = Number(botao.dataset.periodo);
            aplicarFiltrosRelatorio();
        });
    });

    document
        .getElementById("filtroMotoristaRelatorio")
        .addEventListener("change", aplicarFiltrosRelatorio);

    document
        .getElementById("filtroStatusRelatorio")
        .addEventListener("change", aplicarFiltrosRelatorio);

    document
        .getElementById("filtroTipoLancamentoRelatorio")
        .addEventListener("change", aplicarFiltrosRelatorio);

    document
        .getElementById("botaoExportarCSV")
        .addEventListener("click", exportarCSV);

    document
        .querySelector(".botao-sair")
        .addEventListener("click", function () {
            alert("Saindo do sistema...");
        });
}

function iniciarPaginaRelatorio() {
    configurarEventosRelatorio();
    carregarDadosRelatorio();
}

document.addEventListener("DOMContentLoaded", iniciarPaginaRelatorio);
