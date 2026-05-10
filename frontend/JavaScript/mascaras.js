// =============================================================
// AUTOACERTO — MÁSCARAS E LIMITES DE ENTRADA
// Uso: inclua após auth.js. Campos com data-mascara="cpf|cnpj|telefone|cnh|placa|moeda|data_br"
// =============================================================

(function () {
  "use strict";

  function soDigitos(valor) {
    return (valor || "").replace(/\D/g, "");
  }

  function aplicarCpf(valor) {
    const d = soDigitos(valor).slice(0, 11);
    let s = d;
    if (d.length > 3) s = d.slice(0, 3) + "." + d.slice(3);
    if (d.length > 6) s = d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6);
    if (d.length > 9) s = d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9, 11);
    return s;
  }

  function aplicarCnpj(valor) {
    const d = soDigitos(valor).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + "." + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5);
    if (d.length <= 12) return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8);
    return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12, 14);
  }

  function aplicarTelefone(valor) {
    const d = soDigitos(valor).slice(0, 11);
    if (d.length === 0) return "";
    if (d.length <= 2) return "(" + d;
    if (d.length <= 7) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7, 11);
  }

  function aplicarCnh(valor) {
    return soDigitos(valor).slice(0, 11);
  }

  function aplicarPlaca(valor) {
    let s = (valor || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.length > 7) s = s.slice(0, 7);
    if (s.length <= 3) return s;
    return s.slice(0, 3) + "-" + s.slice(3);
  }

  function aplicarMoeda(valor) {
    const d = soDigitos(valor);
    if (d === "") return "";
    const n = parseInt(d, 10) / 100;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Data no formato DD/MM/AAAA (apenas dígitos). */
  function aplicarDataBr(valor) {
    const d = soDigitos(valor).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
    return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  }

  function moedaParaNumero(texto) {
    if (!texto) return NaN;
    const limpo = String(texto).replace(/\./g, "").replace(",", ".");
    const n = parseFloat(limpo);
    return isNaN(n) ? NaN : n;
  }

  /** Converte "DD/MM/AAAA" em "AAAA-MM-DD" ou retorna string vazia se inválido. */
  function dataBrParaIso(texto) {
    const d = soDigitos(texto);
    if (d.length !== 8) return "";
    const dia = parseInt(d.slice(0, 2), 10);
    const mes = parseInt(d.slice(2, 4), 10);
    const ano = parseInt(d.slice(4, 8), 10);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900) return "";
    return (
      String(ano).padStart(4, "0") +
      "-" +
      String(mes).padStart(2, "0") +
      "-" +
      String(dia).padStart(2, "0")
    );
  }

  const mapa = {
    cpf: aplicarCpf,
    cnpj: aplicarCnpj,
    telefone: aplicarTelefone,
    cnh: aplicarCnh,
    placa: aplicarPlaca,
    moeda: aplicarMoeda,
    data_br: aplicarDataBr
  };

  function ligarInput(input, tipo) {
    const fn = mapa[tipo];
    if (!fn || !input) return;

    input.addEventListener("input", function () {
      input.value = fn(input.value);
    });

    input.addEventListener("blur", function () {
      input.value = fn(input.value);
    });
  }

  function configurarDocumento(raiz) {
    const root = raiz || document;
    root.querySelectorAll("input[data-mascara]").forEach(function (input) {
      const tipo = input.getAttribute("data-mascara");
      if (!tipo || !mapa[tipo]) return;
      ligarInput(input, tipo);
      if (input.value) input.value = mapa[tipo](input.value);
    });
  }

  window.AutoAcertoMascaras = {
    configurarDocumento: configurarDocumento,
    aplicarCpf: aplicarCpf,
    aplicarCnpj: aplicarCnpj,
    aplicarTelefone: aplicarTelefone,
    aplicarCnh: aplicarCnh,
    aplicarPlaca: aplicarPlaca,
    aplicarMoeda: aplicarMoeda,
    aplicarDataBr: aplicarDataBr,
    moedaParaNumero: moedaParaNumero,
    dataBrParaIso: dataBrParaIso,
    soDigitos: soDigitos
  };

  document.addEventListener("DOMContentLoaded", function () {
    configurarDocumento(document);
  });
})();
