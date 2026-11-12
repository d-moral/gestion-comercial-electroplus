const pool = require('../db');

// Fecha de hoy en la zona horaria del negocio (el servidor corre en UTC)
const HOY_SQL = `(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;

const COLUMNAS = `
    id,
    descripcion,
    monto::FLOAT AS monto,
    to_char(fecha, 'YYYY-MM-DD') AS fecha
`;

class Gasto {
    // mes: 'YYYY-MM' o null (null = mes actual)
    static async listarPorMes(mes) {
        const { rows: m } = await pool.query(
            `SELECT to_char(COALESCE(($1::text || '-01')::date, ${HOY_SQL}), 'YYYY-MM') AS mes`,
            [mes]
        );
        const mesFinal = m[0].mes;

        const { rows } = await pool.query(
            `SELECT ${COLUMNAS}
             FROM gastos
             WHERE fecha >= ($1::text || '-01')::date
               AND fecha < (($1::text || '-01')::date + INTERVAL '1 month')::date
             ORDER BY fecha DESC, id DESC`,
            [mesFinal]
        );

        const totalCentavos = rows.reduce((acc, g) => acc + Math.round(g.monto * 100), 0);
        return { mes: mesFinal, gastos: rows, total: totalCentavos / 100 };
    }

    static async crear({ descripcion, centavos, fecha }) {
        const { rows } = await pool.query(
            `INSERT INTO gastos (descripcion, monto, fecha)
             VALUES ($1, $2, COALESCE($3::date, ${HOY_SQL}))
             RETURNING ${COLUMNAS}`,
            [descripcion, (centavos / 100).toFixed(2), fecha]
        );
        return rows[0];
    }

    static async actualizar(id, { descripcion, centavos, fecha }) {
        const { rows } = await pool.query(
            `UPDATE gastos
             SET descripcion = $2,
                 monto = $3,
                 fecha = COALESCE($4::date, fecha)
             WHERE id = $1
             RETURNING ${COLUMNAS}`,
            [id, descripcion, (centavos / 100).toFixed(2), fecha]
        );
        return rows[0] || null;
    }

    static async eliminar(id) {
        const { rowCount } = await pool.query('DELETE FROM gastos WHERE id = $1', [id]);
        return rowCount > 0;
    }
}

module.exports = Gasto;