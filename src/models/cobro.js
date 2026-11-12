const pool = require('../db');

// saldo de una cuota = min(monto, max(acumulado_hasta_esa_cuota - total_pagado, 0))
const CUOTAS_SALDO_SQL = `
    WITH hoy AS (
        SELECT (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS d
    ),
    pagado AS (
        SELECT venta_id, SUM(monto) AS total
        FROM pagos
        WHERE anulado = FALSE
        GROUP BY venta_id
    ),
    cuotas_saldo AS (
        SELECT q.id,
               q.venta_id,
               q.numero,
               q.vencimiento,
               q.monto,
               LEAST(
                   q.monto,
                   GREATEST(
                       SUM(q.monto) OVER (PARTITION BY q.venta_id ORDER BY q.numero)
                           - COALESCE(p.total, 0),
                       0
                   )
               ) AS saldo
        FROM cuotas q
        JOIN ventas v ON v.id = q.venta_id AND v.estado = 'activa'
        LEFT JOIN pagado p ON p.venta_id = q.venta_id
    )
`;

class Cobro {
    // Cuotas con saldo pendiente que vencen hasta dentro de 7 días (incluye todas las atrasadas)
    static async agenda() {
        const { rows } = await pool.query(`
            ${CUOTAS_SALDO_SQL}
            SELECT cs.id AS cuota_id,
                   cs.venta_id,
                   cs.numero,
                   to_char(cs.vencimiento, 'YYYY-MM-DD') AS vencimiento,
                   cs.saldo::FLOAT AS saldo,
                   (h.d - cs.vencimiento)::INT AS dias,
                   (SELECT COUNT(*) FROM cuotas x WHERE x.venta_id = cs.venta_id)::INT AS total_cuotas,
                   c.id AS cliente_id,
                   c.nombre AS cliente_nombre,
                   c.telefono AS cliente_telefono,
                   to_char(h.d, 'YYYY-MM-DD') AS hoy
            FROM cuotas_saldo cs
            JOIN ventas v ON v.id = cs.venta_id
            JOIN clientes c ON c.id = v.cliente_id
            CROSS JOIN hoy h
            WHERE cs.saldo > 0
              AND cs.vencimiento <= h.d + 7
            ORDER BY cs.vencimiento ASC, c.nombre ASC
        `);
        return rows;
    }

    // Una fila por cliente con deuda
    static async deudores() {
        const { rows } = await pool.query(`
            ${CUOTAS_SALDO_SQL}
            SELECT c.id AS cliente_id,
                   c.nombre AS cliente_nombre,
                   c.telefono AS cliente_telefono,
                   COUNT(DISTINCT cs.venta_id)::INT AS ventas_con_deuda,
                   SUM(cs.saldo)::FLOAT AS deuda,
                   COALESCE(SUM(cs.saldo) FILTER (WHERE cs.vencimiento < h.d), 0)::FLOAT AS vencido,
                   COALESCE(MAX(h.d - cs.vencimiento) FILTER (WHERE cs.vencimiento < h.d), 0)::INT AS dias_atraso
            FROM cuotas_saldo cs
            JOIN ventas v ON v.id = cs.venta_id
            JOIN clientes c ON c.id = v.cliente_id
            CROSS JOIN hoy h
            WHERE cs.saldo > 0
            GROUP BY c.id, c.nombre, c.telefono
            ORDER BY dias_atraso DESC, deuda DESC
        `);
        return rows;
    }
}

module.exports = Cobro;