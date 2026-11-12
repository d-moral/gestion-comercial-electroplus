const pool = require('../db');

const COLUMNAS_VENTA = `
    v.id,
    v.cliente_id,
    c.nombre AS cliente_nombre,
    to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
    v.observaciones,
    v.total_costo::FLOAT AS total_costo,
    v.total_venta::FLOAT AS total_venta,
    (v.total_venta - v.total_costo)::FLOAT AS ganancia,
    v.estado
`;

class Venta {
    static async listar({ clienteId, desde, hasta, estado, limite = 10, pagina = 1 }) {
        const offset = (pagina - 1) * limite;
        const params = [];
        const condiciones = [];

        if (clienteId) {
            params.push(clienteId);
            condiciones.push(`v.cliente_id = $${params.length}`);
        }
        if (desde) {
            params.push(desde);
            condiciones.push(`v.fecha >= $${params.length}`);
        }
        if (hasta) {
            params.push(hasta);
            condiciones.push(`v.fecha <= $${params.length}`);
        }
        if (estado) {
            params.push(estado);
            condiciones.push(`v.estado = $${params.length}`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const { rows: conteo } = await pool.query(
            `SELECT COUNT(*)::INT AS total FROM ventas v ${where}`,
            params
        );
        const total = conteo[0].total;

        const { rows } = await pool.query(
            `SELECT ${COLUMNAS_VENTA}
             FROM ventas v
             JOIN clientes c ON c.id = v.cliente_id
             ${where}
             ORDER BY v.fecha DESC, v.id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limite, offset]
        );

        return {
            ventas: rows,
            total,
            pagina,
            total_paginas: Math.max(1, Math.ceil(total / limite))
        };
    }

    static async obtenerPorId(id) {
        const { rows } = await pool.query(
            `SELECT ${COLUMNAS_VENTA},
                    c.telefono AS cliente_telefono,
                    c.dni AS cliente_dni
             FROM ventas v
             JOIN clientes c ON c.id = v.cliente_id
             WHERE v.id = $1`,
            [id]
        );
        if (!rows[0]) return null;

        const { rows: items } = await pool.query(
            `SELECT id, descripcion, cantidad,
                    precio_costo::FLOAT AS precio_costo,
                    precio_cliente::FLOAT AS precio_cliente
             FROM venta_items
             WHERE venta_id = $1
             ORDER BY id`,
            [id]
        );

        return { ...rows[0], items };
    }

    // Devuelve el id de la venta creada, o null si el cliente no existe / está eliminado.
    static async crear({ cliente_id, fecha, observaciones, items }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: clientes } = await client.query(
                'SELECT id FROM clientes WHERE id = $1 AND activo = TRUE',
                [cliente_id]
            );
            if (clientes.length === 0) {
                await client.query('ROLLBACK');
                return null;
            }

            const { rows } = await client.query(
                `INSERT INTO ventas (cliente_id, fecha, observaciones)
                 VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3)
                 RETURNING id`,
                [cliente_id, fecha, observaciones]
            );
            const ventaId = rows[0].id;

            for (const item of items) {
                await client.query(
                    `INSERT INTO venta_items (venta_id, descripcion, cantidad, precio_costo, precio_cliente)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [ventaId, item.descripcion, item.cantidad, item.precio_costo, item.precio_cliente]
                );
            }

            await client.query(
                `UPDATE ventas
                 SET total_costo = (SELECT COALESCE(SUM(cantidad * precio_costo), 0) FROM venta_items WHERE venta_id = $1),
                     total_venta = (SELECT COALESCE(SUM(cantidad * precio_cliente), 0) FROM venta_items WHERE venta_id = $1)
                 WHERE id = $1`,
                [ventaId]
            );

            await client.query('COMMIT');
            return ventaId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async anular(id) {
        const { rows } = await pool.query(
            `UPDATE ventas
             SET estado = 'anulada', actualizado_en = NOW()
             WHERE id = $1 AND estado = 'activa'
             RETURNING id`,
            [id]
        );
        return rows[0] || null;
    }
}

module.exports = Venta;