const urlApiViagens = montarUrlApi("/viagens");
const urlApiDespesas = montarUrlApi("/despesas");
const urlApiMotoristas = montarUrlApi("/motoristas");

let viagens = [];
let despesas = [];
let motoristas = [];
let periodoDias = 30;

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

function renderizarTabelaRelatorio(listaViagens) {
    const corpoTabela = document.getElementById("corpoTabelaRelatorio");
    corpoTabela.innerHTML = "";

    if (listaViagens.length === 0) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">
                    Nenhuma viagem encontrada no período selecionado.
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

        totalReceita += frete;
        totalDespesasGeral += totalDespesasViagem;

        const corLucro = lucro >= 0 ? "var(--cor-sucesso)" : "var(--cor-perigo)";

        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        linha.innerHTML = `
            <td>
                <div class="bloco-viagem">
                    <div class="avatar-viagem">📍</div>
                    <div>
                        <div class="nome-rota">${viagem.origem} → ${viagem.destino}</div>
                        <div class="texto-secundario">Registro #${viagem.id}</div>
                    </div>
                </div>
            </td>
            <td>${viagem.motorista_nome || "-"}</td>
            <td>
                ${viagem.veiculo_modelo || "-"}<br>
                <span class="texto-secundario">${viagem.veiculo_placa || ""}</span>
            </td>
            <td>${formatarData(viagem.data_saida)}</td>
            <td>${formatarMoeda(frete)}</td>
            <td>${formatarMoeda(totalDespesasViagem)}</td>
            <td style="font-weight: 600; color: ${corLucro};">${formatarMoeda(lucro)}</td>
            <td>${criarSeloStatusViagem(viagem.status)}</td>
        `;

        corpoTabela.appendChild(linha);
    });

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

function renderizarTabelaCategorias(listaViagens) {
    const corpoTabela = document.getElementById("corpoTabelaCategorias");
    corpoTabela.innerHTML = "";

    const idsViagens = listaViagens.map(function (viagem) {
        return String(viagem.id);
    });

    const despesasFiltradas = despesas.filter(function (despesa) {
        return idsViagens.includes(String(despesa.viagem_id));
    });

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

        const linha = document.createElement("tr");
        linha.classList.add("linha-tabela");

        linha.innerHTML = `
            <td style="font-weight: 500;">${formatarNomeCategoria(categoria)}</td>
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

function atualizarMetricas(listaViagens) {
    const idsViagens = listaViagens.map(function (viagem) {
        return String(viagem.id);
    });

    const despesasFiltradas = despesas.filter(function (despesa) {
        return idsViagens.includes(String(despesa.viagem_id));
    });

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

    atualizarMetricas(listaFiltrada);
    renderizarTabelaRelatorio(listaFiltrada);
    renderizarTabelaCategorias(listaFiltrada);
}

function exportarCSV() {
    const valorMotorista = document.getElementById("filtroMotoristaRelatorio").value;
    const valorStatus = document.getElementById("filtroStatusRelatorio").value;

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
