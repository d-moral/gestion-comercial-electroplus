const Cuenta = require('../models/cuenta');

const aCentavos = (n) => Math.round((Number(n) || 0) * 100);

async function obtenerPorCliente(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        const cliente = await Cuenta.cliente(id);
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

        const ventas = await Cuenta.ventasActivas(id);

        let compradoC = 0;
        let pagadoC = 0;
        let debeC = 0;
        let vencidoC = 0;
        let diasAtraso = 0;
        const cuotasPendientes = [];
        const pagos = [];

        const ventasSalida = ventas.map(v => {
            compradoC += aCentavos(v.total_venta);
            pagadoC += aCentavos(v.total_pagado);
            debeC += aCentavos(v.saldo);

            v.cuotas.forEach(c => {
                const saldoC = Math.max(aCentavos(c.monto) - aCentavos(c.pagado), 0);
                if (saldoC <= 0) return;

                const vencida = c.estado === 'vencida';
                if (vencida) {
                    vencidoC += saldoC;
                    diasAtraso = Math.max(diasAtraso, c.dias_atraso || 0);
                }
                cuotasPendientes.push({
                    venta_id: v.id,
                    numero: c.numero,
                    total_cuotas: v.cuotas.length,
                    vencimiento: c.vencimiento,
                    saldo: saldoC / 100,
                    vencida,
                    parcial: aCentavos(c.pagado) > 0,
                    dias_atraso: c.dias_atraso || 0
                });
            });

            (v.pagos || []).filter(p => !p.anulado).forEach(p => {
                pagos.push({ fecha: p.fecha, venta_id: v.id, metodo: p.metodo, monto: p.monto });
            });

            return {
                id: v.id,
                fecha: v.fecha,
                total_venta: v.total_venta,
                total_pagado: v.total_pagado,
                saldo: v.saldo,
                frecuencia: v.frecuencia,
                cantidad_cuotas: v.cuotas.length,
                items: v.items.map(i => ({
                    descripcion: i.descripcion,
                    cantidad: i.cantidad,
                    precio_cliente: i.precio_cliente
                }))
            };
        });

        cuotasPendientes.sort((a, b) =>
            a.vencimiento < b.vencimiento ? -1 : a.vencimiento > b.vencimiento ? 1 : a.venta_id - b.venta_id
        );
        pagos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.venta_id - a.venta_id));

        res.json({
            cliente,
            resumen: {
                cantidad_ventas: ventas.length,
                total_comprado: compradoC / 100,
                total_pagado: pagadoC / 100,
                debe: debeC / 100,
                vencido: vencidoC / 100,
                dias_atraso: diasAtraso
            },
            cuotas_pendientes: cuotasPendientes,
            ventas: ventasSalida,
            pagos
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar el estado de cuenta' });
    }
}

module.exports = { obtenerPorCliente };