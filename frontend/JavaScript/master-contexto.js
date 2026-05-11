/**
 * Dono do sistema (master): escolhe em qual transportadora os cadastros serão feitos.
 * Inclua após auth.js nas páginas de novo registro. Define obterTransportadoraIdParaCadastroMaster().
 */
(function () {
  function montarBarra() {
    const usuario = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;
    if (!usuario || usuario.perfil !== "dono") return;

    const ancoragem =
      document.querySelector(".cabecalho-conteudo") ||
      document.querySelector(".topo-pagina") ||
      document.querySelector("main .conteudo-principal") ||
      document.querySelector("main");

    if (!ancoragem || document.getElementById("barraContextoTransportadoraMaster")) return;

    const barra = document.createElement("div");
    barra.id = "barraContextoTransportadoraMaster";
    barra.className = "barra-contexto-master";
    barra.style.cssText =
      "margin-bottom:1rem;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;";
    barra.innerHTML =
      '<label for="campoContextoTransportadoraMaster" style="font-weight:600;font-size:0.9rem;">Transportadora</label>' +
      '<select id="campoContextoTransportadoraMaster" style="min-width:220px;padding:8px;border-radius:6px;border:1px solid #cbd5e1;"></select>' +
      '<span style="font-size:0.8rem;color:#64748b;">Cadastros serão vinculados a esta transportadora.</span>';

    ancoragem.parentNode.insertBefore(barra, ancoragem);

    const select = document.getElementById("campoContextoTransportadoraMaster");
    select.innerHTML = '<option value="">Carregando...</option>';

    fetch(montarUrlApi("/transportadoras"), { headers: cabecalhosAutenticados() })
      .then(function (r) {
        if (!r.ok) throw new Error("transportadoras");
        return r.json();
      })
      .then(function (lista) {
        select.innerHTML = "";
        if (!lista || lista.length === 0) {
          select.innerHTML = '<option value="">Nenhuma transportadora</option>';
          return;
        }
        lista.forEach(function (t) {
          const op = document.createElement("option");
          op.value = String(t.id);
          op.textContent = t.nome;
          select.appendChild(op);
        });
        const salvo = sessionStorage.getItem("master_transportadora_id");
        if (salvo && lista.some(function (x) { return String(x.id) === salvo; })) {
          select.value = salvo;
        }
        select.addEventListener("change", function () {
          sessionStorage.setItem("master_transportadora_id", select.value);
          notificarContextoMasterTransportadora();
        });
        notificarContextoMasterTransportadora();
      })
      .catch(function () {
        select.innerHTML = '<option value="">Erro ao carregar</option>';
      });
  }

  function notificarContextoMasterTransportadora() {
    document.dispatchEvent(new CustomEvent("autoacerto-master-transportadora"));
  }

  window.obterTransportadoraIdParaCadastroMaster = function () {
    const usuario = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;
    if (!usuario || usuario.perfil !== "dono") return null;
    const sel = document.getElementById("campoContextoTransportadoraMaster");
    const id = sel ? parseInt(sel.value, 10) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  window.anexarTransportadoraIdSeMaster = function (corpo) {
    const usuario = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;
    if (!usuario || usuario.perfil !== "dono") return corpo;
    const tid = window.obterTransportadoraIdParaCadastroMaster();
    if (!tid) return corpo;
    corpo.transportadora_id = tid;
    return corpo;
  };

  window.filtrarListaPorTransportadoraMaster = function (lista) {
    const usuario = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;
    if (!usuario || usuario.perfil !== "dono") return lista || [];
    const tid = window.obterTransportadoraIdParaCadastroMaster();
    if (!tid) return [];
    return (lista || []).filter(function (item) {
      return Number(item.transportadora_id) === tid;
    });
  };

  /**
   * @param {{ mensagemErro?: string }} [opcoes]
   */
  window.validarTransportadoraMasterParaCadastro = function (opcoes) {
    const usuario = typeof obterUsuarioLogado === "function" ? obterUsuarioLogado() : null;
    if (!usuario || usuario.perfil !== "dono") return true;
    const tid = window.obterTransportadoraIdParaCadastroMaster();
    if (tid) return true;
    const msg =
      (opcoes && opcoes.mensagemErro) ||
      "Selecione a transportadora no topo da página para definir o escopo do cadastro.";
    window.alert(msg);
    return false;
  };

  document.addEventListener("DOMContentLoaded", montarBarra);
})();
