(function () {
  "use strict";

  if (typeof window.obterTransportadoraIdParaCadastroMaster !== "function") {
    window.obterTransportadoraIdParaCadastroMaster = function () {
      return null;
    };
  }

  if (typeof window.anexarTransportadoraIdSeMaster !== "function") {
    window.anexarTransportadoraIdSeMaster = function (corpo) {
      return corpo;
    };
  }

  if (typeof window.filtrarListaPorTransportadoraMaster !== "function") {
    window.filtrarListaPorTransportadoraMaster = function (lista) {
      return lista || [];
    };
  }

  if (typeof window.validarTransportadoraMasterParaCadastro !== "function") {
    window.validarTransportadoraMasterParaCadastro = function () {
      return true;
    };
  }
})();
