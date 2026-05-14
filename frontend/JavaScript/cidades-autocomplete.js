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

  function criarDatalist(id) {
    let datalist = document.getElementById(id);
    if (datalist) return datalist;

    datalist = document.createElement("datalist");
    datalist.id = id;
    document.body.appendChild(datalist);
    return datalist;
  }

  function configurarCampo(input, listaCidades, idDatalist) {
    if (!input) return;

    const datalist = criarDatalist(idDatalist);
    input.setAttribute("list", idDatalist);

    input.addEventListener("input", function () {
      const termo = input.value.trim().toLowerCase();
      datalist.innerHTML = "";

      if (termo.length < 2) return;

      listaCidades
        .filter(function (cidade) {
          return cidade.toLowerCase().includes(termo);
        })
        .slice(0, 12)
        .forEach(function (cidade) {
          const opcao = document.createElement("option");
          opcao.value = cidade;
          datalist.appendChild(opcao);
        });
    });

    if (input.value.trim().length >= 2) {
      input.dispatchEvent(new Event("input"));
    }
  }

  window.AutoAcertoCidades = {
    configurar: async function (idsCampos) {
      const listaCidades = await buscarCidades();
      idsCampos.forEach(function (idCampo) {
        configurarCampo(
          document.getElementById(idCampo),
          listaCidades,
          "listaCidades" + idCampo.charAt(0).toUpperCase() + idCampo.slice(1)
        );
      });
    }
  };
})();
