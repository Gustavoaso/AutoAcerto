// gerar_hash.js
const bcrypt = require("bcryptjs");
bcrypt.hash("admin", 10).then(h => console.log(h));