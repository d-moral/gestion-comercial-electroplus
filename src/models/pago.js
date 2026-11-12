const pool = require('../db');

const HOY_SQL = `(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;

class Pago {
    // Devuelve { pago } o { error: 'NO_EXISTE' | 'ANULADA' | 'EXCEDE', saldo_centavos }
    static async crear({ venta_id, centavos, fecha, metodo, observaciones }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Bloquea la venta para que dos pagos simultáneos no superen el saldo
            const { rows: ventas } = await client.query(
                `SELECT estado, (total_venta * 100)::BIGINT AS total_centavos
                 FROM ventas
                 WHERE id = $1
                 FOR UPDATE`,
                [venta_id]
            );
            if (ventas.length === 0) {
                await client.query('ROLLBACK');
                return { error: 'NO_EXISTE' };
            }
            if (ventas[0].estado !== 'activa') {
                await client.query('ROLLBACK');
                return { error: 'ANULADA' };
            }

            const { rows: suma } = await client.query(
                `SELECT COALESCE(SUM(monto * 100), 0)::BIGINT AS pagado_centavos
                 FROM pagos
                 WHERE venta_id = $1 AND anulado = FALSE`,
                [venta_id]
            );

            const saldo = Number(ventas[0].total_centavos) - Number(suma[0].pagado_centavos);
            if (centavos > saldo) {
                await client.query('ROLLBACK');
                return { error: 'EXCEDE', saldo_centavos: saldo };
            }

            const { rows } = await client.query(
                `INSERT INTO pagos (venta_id, monto, fecha, metodo, observaciones)
                 VALUES ($1, $2, COALESCE($3::date, ${HOY_SQL}), $4, $5)
                 RETURNING id, venta_id, monto::FLOAT AS monto,
                           to_char(fecha, 'YYYY-MM-DD') AS fecha, metodo, observaciones`,
                [venta_id, (centavos / 100).toFixed(2), fecha, metodo, observaciones]
            );

            await client.query('COMMIT');
            return { pago: rows[0] };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async anular(id) {
        const { rows } = await pool.query(
            `UPDATE pagos
             SET anulado = TRUE
             WHERE id = $1 AND anulado = FALSE
             RETURNING id, venta_id`,
            [id]
        );
        return rows[0] || null;
    }
}

module.exports = Pago;