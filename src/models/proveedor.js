const pool = require('../db');

const COLUMNAS = 'id, nombre, telefono, direccion, notas';

class Proveedor {
    static async listar() {
        const { rows } = await pool.query(
            `SELECT p.id, p.nombre, p.telefono, p.direccion, p.notas,
                    COUNT(c.id)::INT AS cantidad_compras,
                    COALESCE(SUM(c.monto), 0)::FLOAT AS total_comprado,
                    COALESCE(SUM(c.monto) FILTER (WHERE c.pagada = FALSE), 0)::FLOAT AS pendiente_pago,
                    to_char(MAX(c.fecha), 'YYYY-MM-DD') AS ultima_compra
             FROM proveedores p
             LEFT JOIN compras c ON c.proveedor_id = p.id
             WHERE p.activo = TRUE
             GROUP BY p.id
             ORDER BY p.nombre`
        );
        return rows;
    }

    static async obtenerPorId(id) {
        const { rows } = await pool.query(
            `SELECT ${COLUMNAS} FROM proveedores WHERE id = $1 AND activo = TRUE`,
            [id]
        );
        return rows[0] || null;
    }

    static async crear({ nombre, telefono, direccion, notas }) {
        const { rows } = await pool.query(
            `INSERT INTO proveedores (nombre, telefono, direccion, notas)
             VALUES ($1, $2, $3, $4)
             RETURNING ${COLUMNAS}`,
            [nombre, telefono, direccion, notas]
        );
        return rows[0];
    }

    static async actualizar(id, { nombre, telefono, direccion, notas }) {
        const { rows } = await pool.query(
            `UPDATE proveedores
             SET nombre = $2, telefono = $3, direccion = $4, notas = $5, actualizado_en = NOW()
             WHERE id = $1 AND activo = TRUE
             RETURNING ${COLUMNAS}`,
            [id, nombre, telefono, direccion, notas]
        );
        return rows[0] || null;
    }

    // Se desactiva en vez de borrar, porque tiene compras asociadas
    static async eliminar(id) {
        const { rows } = await pool.query(
            `UPDATE proveedores
             SET activo = FALSE, actualizado_en = NOW()
             WHERE id = $1 AND activo = TRUE
             RETURNING id`,
            [id]
        );
        return rows[0] || null;
    }
}

module.exports = Proveedor;