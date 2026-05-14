// =============================================================
// AUTOACERTO — AUTOCOMPLETE DE CIDADES
// Usa a base publica do IBGE e guarda cache local para agilizar.
// =============================================================

(function () {
  "use strict";

  const CHAVE_CACHE = "autoacerto_cidades_br_v1";
  const URL_IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";
  const CIDADES_FALLBACK = [
    "Betim, MG",
    "Belo Horizonte, MG",
    "Contagem, MG",
    "Uberlandia, MG",
    "Sao Paulo, SP",
    "Campinas, SP",
    "Ribeirao Preto, SP",
    "Rio de Janeiro, RJ",
    "Curitiba, PR",
    "Londrina, PR",
    "Goiania, GO",
    "Brasilia, DF",
    "Salvador, BA",
    "Fortaleza, CE",
    "Recife, PE",
    "Porto Alegre, RS"
  ];

  function carregarCache() {
    try {
      const bruto = localStorage.getItem(CHAVE_CACHE);
      const lista = bruto ? JSON.parse(bruto) : null;
      return Array.isArray(lista) && lista.length ? lista : null;
    } catch {
      return null;
    }
  }

  function salvarCache(lista) {
    try {
      localStorage.setItem(CHAVE_CACHE, JSON.stringify(lista));
    } catch {
      // Cache opcional.
    }
  }

  async function buscarCidades() {
    const cache = carregarCache();
    if (cache) return cache;

    try {
      const resposta = await fetch(URL_IBGE);
      if (!resposta.ok) throw new Error("IBGE indisponivel");

      const municipios = await resposta.json();
      const lista = municipios
        .map(function (municipio) {
          const uf = municipio.microrregiao &&
            municipio.microrregiao.mesorregiao &&
            municipio.microrregiao.mesorregiao.UF
              ? municipio.microrregiao.mesorregiao.UF.sigla
              : "";
          return municipio.nome + ", " + uf;
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return a.localeCompare(b, "pt-BR");
        });

      salvarCache(lista);
      return lista;
    } catch (erro) {
      console.warn("Autocomplete de cidades usando lista local:", erro.message);
      return CIDADES_FALLBACK;
    }
  }

  function prepararCampo(input) {
    if (!input || input.parentElement.classList.contains("campo-autocomplete-cidade")) {
      return input ? input.parentElement : null;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "campo-autocomplete-cidade";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao-autocomplete-cidade";
    botao.setAttribute("aria-label", "Mostrar cidades");
    botao.textContent = "▾";
    wrapper.appendChild(botao);

    const lista = document.createElement("div");
    lista.className = "lista-autocomplete-cidade oculto";
    wrapper.appendChild(lista);

    return wrapper;
  }

  function normalizarTexto(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function obterCidadesFiltradas(listaCidades, termo, mostrarTudo) {
    const termoNormalizado = normalizarTexto(termo);

    if (!mostrarTudo && termoNormalizado.length < 2) return [];

    const cidades = listaCidades.filter(function (cidade) {
        if (mostrarTudo && termoNormalizado.length < 2) return true;
        return normalizarTexto(cidade).includes(termoNormalizado);
      });

    return mostrarTudo && termoNormalizado.length < 2 ? cidades : cidades.slice(0, 12);
  }

  function esconderLista(wrapper) {
    const lista = wrapper.querySelector(".lista-autocomplete-cidade");
    if (lista) lista.classList.add("oculto");
  }

  function renderizarLista(wrapper, input, listaCidades, mostrarTudo) {
    const lista = wrapper.querySelector(".lista-autocomplete-cidade");
    const cidades = obterCidadesFiltradas(listaCidades, input.value, mostrarTudo);
    lista.innerHTML = "";

    if (cidades.length === 0) {
      esconderLista(wrapper);
      return;
    }

    cidades.forEach(function (cidade) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "item-autocomplete-cidade";
      item.textContent = cidade;
      item.addEventListener("mousedown", function (evento) {
        evento.preventDefault();
        input.value = cidade;
        esconderLista(wrapper);
      });
      lista.appendChild(item);
    });

    lista.classList.remove("oculto");
  }

  function configurarCampo(input, listaCidades) {
    const wrapper = prepararCampo(input);
    if (!wrapper) return;

    const botao = wrapper.querySelector(".botao-autocomplete-cidade");

    input.addEventListener("input", function () {
      renderizarLista(wrapper, input, listaCidades, false);
    });

    input.addEventListener("blur", function () {
      setTimeout(function () {
        esconderLista(wrapper);
      }, 120);
    });

    botao.addEventListener("click", function () {
      input.focus();
      renderizarLista(wrapper, input, listaCidades, true);
    });
  }

  document.addEventListener("click", function (evento) {
    document.querySelectorAll(".campo-autocomplete-cidade").forEach(function (wrapper) {
      if (!wrapper.contains(evento.target)) {
        esconderLista(wrapper);
      }
    });
  });

  window.AutoAcertoCidades = {
    configurar: async function (idsCampos) {
      const listaCidades = await buscarCidades();
      idsCampos.forEach(function (idCampo) {
        configurarCampo(document.getElementById(idCampo), listaCidades);
      });
    }
  };
})();
