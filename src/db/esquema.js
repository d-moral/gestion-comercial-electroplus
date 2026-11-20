const fs = require('fs');
const path = require('path');
const pool = require('./index');

const RUTA_SCHEMA = path.join(__dirname, 'schema.sql');

async function aplicarEsquema() {
    const sql = fs.readFileSync(RUTA_SCHEMA, 'utf8');
    await pool.query(sql);
}

// Al arrancar: aplica el esquema (es seguro repetirlo, no borra datos).
// Reintenta porque la base de datos puede tardar unos segundos en estar lista.
async function aplicarEsquemaAlArrancar() {
    const intentos = 10;
    for (let i = 1; i <= intentos; i++) {
        try {
            await aplicarEsquema();
            console.log('Esquema de la base de datos al dia');
            return true;
        } catch (error) {
            if (i === intentos) {
                console.error('No se pudo actualizar el esquema de la base de datos:', error.message);
                return false;
            }
            await new Promise(resolver => setTimeout(resolver, 3000));
        }
    }
}

module.exports = { aplicarEsquema, aplicarEsquemaAlArrancar };