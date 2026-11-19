const pool = require('../db');

const HOY_SQL = `(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;

const COLUMNAS = `
    id,
    proveedor_id,
    to_char(fecha, 'YYYY-MM-DD') AS fecha,
    descripcion,
    monto::FLOAT AS monto,
    pagada,
    observaciones
`;

class Compra {
    static async listarPorProveedor(proveedorId) {
        const { rows } = await pool.query(
            `SELECT ${COLUMNAS}
             FROM compras
             WHERE proveedor_id = $1
             ORDER BY fecha DESC, id DESC`,
            [proveedorId]
        );
        return rows;
    }

    // Devuelve null si el proveedor no existe o está eliminado
    static async crear({ proveedor_id, fecha, descripcion, centavos, pagada, observaciones }) {
        const { rows } = await pool.query(
            `INSERT INTO compras (proveedor_id, fecha, descripcion, monto, pagada, observaciones)
             SELECT $1::int, COALESCE($2::date, ${HOY_SQL}), $3::text, $4::numeric, $5::boolean, $6::text
             WHERE EXISTS (SELECT 1 FROM proveedores WHERE id = $1::int AND activo = TRUE)
             RETURNING ${COLUMNAS}`,
            [proveedor_id, fecha, descripcion, (centavos / 100).toFixed(2), pagada, observaciones]
        );
        return rows[0] || null;
    }

    static async actualizar(id, { fecha, descripcion, centavos, pagada, observaciones }) {
        const { rows } = await pool.query(
            `UPDATE compras
             SET fecha = COALESCE($2::date, fecha),
                 descripcion = $3,
                 monto = $4,
                 pagada = $5,
                 observaciones = $6
             WHERE id = $1
             RETURNING ${COLUMNAS}`,
            [id, fecha, descripcion, (centavos / 100).toFixed(2), pagada, observaciones]
        );
        return rows[0] || null;
    }

    static async marcarPagada(id, pagada) {
        const { rows } = await pool.query(
            `UPDATE compras SET pagada = $2 WHERE id = $1 RETURNING ${COLUMNAS}`,
            [id, pagada]
        );
        return rows[0] || null;
    }

    static async eliminar(id) {
        const { rowCount } = await pool.query('DELETE FROM compras WHERE id = $1', [id]);
        return rowCount > 0;
    }
}

module.exports = Compra;