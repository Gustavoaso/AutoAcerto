(function () {
    "use strict";

    async function buscarTodosRegistrosPaginados(url) {
        const todos = [];
        let pagina = 1;
        let temProxima = true;

        while (temProxima) {
            const separador = url.includes("?") ? "&" : "?";
            const resposta = await fetch(
                url + separador + "pagina=" + pagina + "&limite=100",
                { headers: cabecalhosAutenticados() }
            );

            if (!resposta.ok) {
                throw new Error("Falha ao carregar " + url);
            }

            const json = await resposta.json();

            if (Array.isArray(json)) {
                return json;
            }

            todos.push.apply(todos, json.dados || []);
            temProxima = Boolean(json.paginacao && json.paginacao.temProxima);
            pagina += 1;
        }

        return todos;
    }

    window.AutoAcertoApi = {
        buscarTodosRegistrosPaginados: buscarTodosRegistrosPaginados
    };
})();
