const banco = require("../banco");

async function motoristaPertenceTransportadora(motoristaId, transportadoraId) {
  if (!motoristaId) return true;
  const resultado = await banco.query(
    "SELECT id FROM motoristas WHERE id=$1 AND transportadora_id=$2",
    [motoristaId, transportadoraId]
  );
  return resultado.rows.length > 0;
}

async function veiculoPertenceTransportadora(veiculoId, transportadoraId) {
  const resultado = await banco.query(
    "SELECT id FROM veiculos WHERE id=$1 AND transportadora_id=$2",
    [veiculoId, transportadoraId]
  );
  return resultado.rows.length > 0;
}

async function viagemPertenceTransportadora(viagemId, transportadoraId) {
  const resultado = await banco.query(
    "SELECT id FROM viagens WHERE id=$1 AND transportadora_id=$2",
    [viagemId, transportadoraId]
  );
  return resultado.rows.length > 0;
}

module.exports = {
  motoristaPertenceTransportadora,
  veiculoPertenceTransportadora,
  viagemPertenceTransportadora
};
