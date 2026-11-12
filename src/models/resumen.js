const pool = require('../db');

const HOY_SQL = `(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;

class Resumen {
    static async hoy() {
        const { rows } = await pool.query(`SELECT to_char(${HOY_SQL}, 'YYYY-MM-DD') AS hoy`);
        return rows[0].hoy;
    }

    static async calcular(desde, hasta) {
        const [ventas, cobros, gastos, porCobrar] = await Promise.all([
            // Ventas activas hechas en el período
            pool.query(
                `SELECT COUNT(*)::INT AS cantidad,
                        COALESCE(SUM(total_venta), 0)::FLOAT AS total_vendido,
                        COALESCE(SUM(total_costo), 0)::FLOAT AS total_costo,
                        COALESCE(SUM(total_venta - total_costo), 0)::FLOAT AS ganancia_vendida
                 FROM ventas
                 WHERE estado = 'activa' AND fecha BETWEEN $1 AND $2`,
                [desde, hasta]
            ),
            // Pagos recibidos en el período; la ganancia de cada pago es proporcional al margen de su venta
            pool.query(
                `SELECT p.metodo,
                        COUNT(*)::INT AS cantidad,
                        COALESCE(SUM(p.monto), 0)::FLOAT AS cobrado,
                        COALESCE(SUM(p.monto * (v.total_venta - v.total_costo) / NULLIF(v.total_venta, 0)), 0)::FLOAT AS ganancia_cobrada
                 FROM pagos p
                 JOIN ventas v ON v.id = p.venta_id
                 WHERE p.anulado = FALSE AND v.estado = 'activa' AND p.fecha BETWEEN $1 AND $2
                 GROUP BY p.metodo
                 ORDER BY cobrado DESC`,
                [desde, hasta]
            ),
            pool.query(
                `SELECT COUNT(*)::INT AS cantidad,
                        COALESCE(SUM(monto), 0)::FLOAT AS total
                 FROM gastos
                 WHERE fecha BETWEEN $1 AND $2`,
                [desde, hasta]
            ),
            // Total que le deben hoy (todas las ventas activas, sin importar el período)
            pool.query(
                `SELECT (
                    COALESCE((SELECT SUM(total_venta) FROM ventas WHERE estado = 'activa'), 0)
                    - COALESCE((SELECT SUM(p.monto)
                                FROM pagos p
                                JOIN ventas v ON v.id = p.venta_id
                                WHERE p.anulado = FALSE AND v.estado = 'activa'), 0)
                 )::FLOAT AS por_cobrar`
            )
        ]);

        return {
            ventas: ventas.rows[0],
            cobros: cobros.rows,
            gastos: gastos.rows[0],
            por_cobrar: porCobrar.rows[0].por_cobrar
        };
    }
}

module.exports = Resumen;