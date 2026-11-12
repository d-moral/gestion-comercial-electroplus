const pool = require('../db');

// Fecha de hoy en la zona horaria del negocio (el servidor corre en UTC)
const HOY_SQL = `(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;

const PAGADO_SQL = `COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.venta_id = v.id AND p.anulado = FALSE), 0)`;

const COLUMNAS_VENTA = `
    v.id,
    v.cliente_id,
    c.nombre AS cliente_nombre,
    to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
    v.observaciones,
    v.total_costo::FLOAT AS total_costo,
    v.total_venta::FLOAT AS total_venta,
    (v.total_venta - v.total_costo)::FLOAT AS ganancia,
    v.estado,
    v.frecuencia,
    (SELECT COUNT(*) FROM cuotas q WHERE q.venta_id = v.id)::INT AS cantidad_cuotas,
    ${PAGADO_SQL}::FLOAT AS total_pagado,
    (CASE WHEN v.estado = 'anulada' THEN 0 ELSE v.total_venta - ${PAGADO_SQL} END)::FLOAT AS saldo
`;

// ---------- Fechas (todo con strings 'YYYY-MM-DD', sin zonas horarias) ----------
function sumarDias(iso, dias) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function sumarMeses(iso, meses) {
    const [a, m, d] = iso.split('-').map(Number);
    const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
    const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
    destino.setUTCDate(Math.min(d, ultimoDia));
    return destino.toISOString().slice(0, 10);
}

function diasEntre(desdeIso, hastaIso) {
    const [a1, m1, d1] = desdeIso.split('-').map(Number);
    const [a2, m2, d2] = hastaIso.split('-').map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

function fechaDeCuota(primerVencimiento, frecuencia, indice) {
    if (frecuencia === 'semanal') return sumarDias(primerVencimiento, 7 * indice);
    if (frecuencia === 'quincenal') return sumarDias(primerVencimiento, 15 * indice);
    return sumarMeses(primerVencimiento, indice);
}

// Divide el total en cuotas iguales; los centavos que sobran van a la última
function generarCuotas(totalCentavos, cantidad, frecuencia, primerVencimiento) {
    const base = Math.floor(totalCentavos / cantidad);
    const resto = totalCentavos - base * cantidad;
    const cuotas = [];
    for (let i = 0; i < cantidad; i++) {
        const centavos = i === cantidad - 1 ? base + resto : base;
        cuotas.push({
            numero: i + 1,
            vencimiento: fechaDeCuota(primerVencimiento, frecuencia, i),
            monto: (centavos / 100).toFixed(2)
        });
    }
    return cuotas;
}

// Los pagos cubren las cuotas en orden: la cuota 1 primero, después la 2, etc.
function calcularEstadoCuotas(cuotas, totalPagadoCentavos, hoy, ventaActiva) {
    let restante = totalPagadoCentavos;
    return cuotas.map(c => {
        const montoCent = Number(c.monto_centavos);
        const aplicado = Math.min(montoCent, restante);
        restante -= aplicado;
        const saldoCent = montoCent - aplicado;

        let estado = 'pendiente';
        if (saldoCent === 0) estado = 'pagada';
        else if (ventaActiva && c.vencimiento < hoy) estado = 'vencida';

        return {
            id: c.id,
            numero: c.numero,
            vencimiento: c.vencimiento,
            monto: montoCent / 100,
            pagado: aplicado / 100,
            saldo: saldoCent / 100,
            estado,
            dias_atraso: estado === 'vencida' ? diasEntre(c.vencimiento, hoy) : 0
        };
    });
}

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
        const venta = rows[0];

        const { rows: items } = await pool.query(
            `SELECT id, descripcion, cantidad,
                    precio_costo::FLOAT AS precio_costo,
                    precio_cliente::FLOAT AS precio_cliente
             FROM venta_items
             WHERE venta_id = $1
             ORDER BY id`,
            [id]
        );

        const { rows: cuotasDb } = await pool.query(
            `SELECT id, numero,
                    to_char(vencimiento, 'YYYY-MM-DD') AS vencimiento,
                    (monto * 100)::BIGINT AS monto_centavos
             FROM cuotas
             WHERE venta_id = $1
             ORDER BY numero`,
            [id]
        );

        const { rows: pagos } = await pool.query(
            `SELECT id,
                    to_char(fecha, 'YYYY-MM-DD') AS fecha,
                    monto::FLOAT AS monto,
                    metodo,
                    observaciones,
                    anulado
             FROM pagos
             WHERE venta_id = $1
             ORDER BY fecha DESC, id DESC`,
            [id]
        );

        const { rows: hoyRows } = await pool.query(`SELECT to_char(${HOY_SQL}, 'YYYY-MM-DD') AS hoy`);

        const activa = venta.estado === 'activa';
        const cuotas = calcularEstadoCuotas(
            cuotasDb,
            Math.round(venta.total_pagado * 100),
            hoyRows[0].hoy,
            activa
        );
        const vencidas = cuotas.filter(c => c.estado === 'vencida');

        return {
            ...venta,
            items,
            cuotas,
            pagos,
            cuotas_pagadas: cuotas.filter(c => c.estado === 'pagada').length,
            dias_atraso: vencidas.length ? vencidas[0].dias_atraso : 0
        };
    }

    // Devuelve el id de la venta creada, o null si el cliente no existe / está eliminado.
    static async crear({ cliente_id, fecha, observaciones, items, frecuencia, cantidad_cuotas, primer_vencimiento }) {
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
                `INSERT INTO ventas (cliente_id, fecha, observaciones, frecuencia)
                 VALUES ($1, COALESCE($2::date, ${HOY_SQL}), $3, $4)
                 RETURNING id, to_char(fecha, 'YYYY-MM-DD') AS fecha`,
                [cliente_id, fecha, observaciones, frecuencia]
            );
            const ventaId = rows[0].id;
            const fechaVenta = rows[0].fecha;

            for (const item of items) {
                await client.query(
                    `INSERT INTO venta_items (venta_id, descripcion, cantidad, precio_costo, precio_cliente)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [ventaId, item.descripcion, item.cantidad, item.precio_costo, item.precio_cliente]
                );
            }

            const { rows: totales } = await client.query(
                `UPDATE ventas
                 SET total_costo = (SELECT COALESCE(SUM(cantidad * precio_costo), 0) FROM venta_items WHERE venta_id = $1),
                     total_venta = (SELECT COALESCE(SUM(cantidad * precio_cliente), 0) FROM venta_items WHERE venta_id = $1)
                 WHERE id = $1
                 RETURNING (total_venta * 100)::BIGINT AS total_centavos`,
                [ventaId]
            );

            const cuotas = generarCuotas(
                Number(totales[0].total_centavos),
                cantidad_cuotas,
                frecuencia,
                primer_vencimiento || fechaVenta
            );
            for (const cuota of cuotas) {
                await client.query(
                    `INSERT INTO cuotas (venta_id, numero, vencimiento, monto)
                     VALUES ($1, $2, $3, $4)`,
                    [ventaId, cuota.numero, cuota.vencimiento, cuota.monto]
                );
            }

            await client.query('COMMIT');
            return ventaId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Devuelve { id } si se anuló, o { error: 'CON_PAGOS' | 'NO_ENCONTRADA' }
    static async anular(id) {
        const { rows: pagos } = await pool.query(
            'SELECT 1 FROM pagos WHERE venta_id = $1 AND anulado = FALSE LIMIT 1',
            [id]
        );
        if (pagos.length > 0) return { error: 'CON_PAGOS' };

        const { rows } = await pool.query(
            `UPDATE ventas
             SET estado = 'anulada', actualizado_en = NOW()
             WHERE id = $1 AND estado = 'activa'
             RETURNING id`,
            [id]
        );
        return rows[0] ? { id: rows[0].id } : { error: 'NO_ENCONTRADA' };
    }
}

module.exports = Venta;