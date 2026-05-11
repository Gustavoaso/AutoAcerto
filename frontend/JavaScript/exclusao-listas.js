(function () {
  function criarGerenciadorExclusao(config) {
    const selecionados = new Set();
    let itensVisiveis = [];
    let barra = null;

    function obterIdsVisiveis() {
      return itensVisiveis.map(function (item) { return Number(item.id); });
    }

    function contarSelecionadosVisiveis() {
      const idsVisiveis = new Set(obterIdsVisiveis());
      return Array.from(selecionados).filter(function (id) { return idsVisiveis.has(id); }).length;
    }

    function criarBarra() {
      if (barra) return barra;
      const tabela = document.querySelector(config.seletorTabela);
      if (!tabela) return null;

      barra = document.createElement("div");
      barra.className = "barra-exclusao-lista";
      barra.innerHTML = `
        <span data-contador-exclusao></span>
        <button type="button" class="botao-perigo" data-excluir-selecionados disabled>Excluir selecionados</button>
      `;

      tabela.parentElement.insertBefore(barra, tabela);

      barra.querySelector("[data-excluir-selecionados]").addEventListener("click", excluirSelecionados);
      return barra;
    }

    function atualizarBarra() {
      const barraAtual = criarBarra();
      if (!barraAtual) return;

      const total = selecionados.size;
      const botao = barraAtual.querySelector("[data-excluir-selecionados]");
      const contador = barraAtual.querySelector("[data-contador-exclusao]");
      const singular = config.singular || "item";
      const plural = config.plural || "itens";

      contador.textContent = total === 0
        ? ""
        : total + " " + (total === 1 ? singular : plural) + " selecionado" + (total === 1 ? "" : "s");
      botao.disabled = total === 0;

      const selecionarTodos = document.querySelector(config.seletorSelecionarTodos);
      if (selecionarTodos) {
        const idsVisiveis = obterIdsVisiveis();
        const totalVisivelSelecionado = contarSelecionadosVisiveis();
        selecionarTodos.checked = idsVisiveis.length > 0 && totalVisivelSelecionado === idsVisiveis.length;
        selecionarTodos.indeterminate = totalVisivelSelecionado > 0 && totalVisivelSelecionado < idsVisiveis.length;
      }
    }

    function colunaCabecalho() {
      return '<th class="coluna-selecao"><input type="checkbox" data-selecionar-todos aria-label="Selecionar todos"></th>';
    }

    function colunaLinha(id) {
      const numero = Number(id);
      const marcado = selecionados.has(numero) ? " checked" : "";
      return '<td class="coluna-selecao"><input type="checkbox" data-selecionar-id="' + numero + '"' + marcado + ' aria-label="Selecionar item"></td>';
    }

    function aposRender(lista) {
      itensVisiveis = lista || [];
      criarBarra();

      document.querySelectorAll(config.seletorLinhas).forEach(function (checkbox) {
        checkbox.addEventListener("change", function () {
          const id = Number(checkbox.getAttribute("data-selecionar-id"));
          if (checkbox.checked) selecionados.add(id);
          else selecionados.delete(id);
          atualizarBarra();
        });
      });

      const selecionarTodos = document.querySelector(config.seletorSelecionarTodos);
      if (selecionarTodos && !selecionarTodos.dataset.exclusaoConfigurada) {
        selecionarTodos.dataset.exclusaoConfigurada = "true";
        selecionarTodos.addEventListener("change", function () {
          obterIdsVisiveis().forEach(function (id) {
            if (selecionarTodos.checked) selecionados.add(id);
            else selecionados.delete(id);
          });
          if (typeof config.renderizarAtual === "function") config.renderizarAtual();
          atualizarBarra();
        });
      }

      atualizarBarra();
    }

    async function excluirSelecionados() {
      const ids = Array.from(selecionados);
      if (ids.length === 0) return;

      const plural = config.plural || "itens";
      const confirmar = window.confirm("Excluir " + ids.length + " " + plural + " selecionado(s)? Esta ação não pode ser desfeita.");
      if (!confirmar) return;

      try {
        const resposta = await fetch(config.urlApi, {
          method: "DELETE",
          headers: cabecalhosAutenticados(),
          body: JSON.stringify({ ids: ids })
        });
        const dados = await resposta.json().catch(function () { return {}; });

        if (!resposta.ok) {
          window.alert(dados.mensagem || "Não foi possível excluir os itens selecionados.");
          return;
        }

        selecionados.clear();
        if (typeof config.aoExcluir === "function") await config.aoExcluir(dados);
      } catch (erro) {
        console.error("Erro ao excluir:", erro);
        window.alert("Erro de conexão com o servidor.");
      } finally {
        atualizarBarra();
      }
    }

    return {
      colunaCabecalho: colunaCabecalho,
      colunaLinha: colunaLinha,
      aposRender: aposRender,
      atualizarBarra: atualizarBarra
    };
  }

  window.AutoAcertoExclusao = {
    criarGerenciadorExclusao: criarGerenciadorExclusao
  };
})();
