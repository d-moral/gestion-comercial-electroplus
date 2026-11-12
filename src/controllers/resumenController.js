const Resumen = require('../models/resumen');

function fechaValida(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
    const fecha = new Date(`${iso}T00:00:00Z`);
    return !isNaN(fecha) && fecha.toISOString().slice(0, 10) === iso;
}

const aCentavos = (n) => Math.round(n * 100);

async function obtener(req, res) {
    try {
        const hoy = await Resumen.hoy();
        const desde = req.query.desde || hoy;
        const hasta = req.query.hasta || hoy;

        if (!fechaValida(desde) || !fechaValida(hasta)) {
            return res.status(400).json({ error: 'Las fechas no son válidas' });
        }
        if (desde > hasta) {
            return res.status(400).json({ error: 'La fecha "desde" no puede ser posterior a "hasta"' });
        }

        const datos = await Resumen.calcular(desde, hasta);

        const totalCobradoCent = datos.cobros.reduce((acc, c) => acc + aCentavos(c.cobrado), 0);
        const gananciaCobradaCent = datos.cobros.reduce((acc, c) => acc + aCentavos(c.ganancia_cobrada), 0);
        const gastosCent = aCentavos(datos.gastos.total);

        res.json({
            desde,
            hasta,
            ventas: {
                cantidad: datos.ventas.cantidad,
                total_vendido: datos.ventas.total_vendido,
                total_costo: datos.ventas.total_costo,
                ganancia_vendida: datos.ventas.ganancia_vendida
            },
            cobros: {
                cantidad: datos.cobros.reduce((acc, c) => acc + c.cantidad, 0),
                total_cobrado: totalCobradoCent / 100,
                ganancia_cobrada: gananciaCobradaCent / 100,
                por_metodo: datos.cobros.map(c => ({ metodo: c.metodo, monto: c.cobrado }))
            },
            gastos: {
                cantidad: datos.gastos.cantidad,
                total: gastosCent / 100
            },
            ganancia_real: (gananciaCobradaCent - gastosCent) / 100,
            por_cobrar: datos.por_cobrar
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al calcular el resumen' });
    }
}

module.exports = { obtener };