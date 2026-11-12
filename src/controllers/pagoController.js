const Pago = require('../models/pago');

const METODOS = ['efectivo', 'transferencia', 'otro'];

function textoOpcional(valor) {
    if (valor === undefined || valor === null) return null;
    const texto = String(valor).trim();
    return texto === '' ? null : texto;
}

function fechaValida(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const fecha = new Date(`${iso}T00:00:00Z`);
    return !isNaN(fecha) && fecha.toISOString().slice(0, 10) === iso;
}

function formatoDinero(centavos) {
    return (centavos / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

async function crear(req, res) {
    try {
        const ventaId = parseInt(req.body.venta_id, 10);
        if (!Number.isInteger(ventaId) || ventaId <= 0) {
            return res.status(400).json({ error: 'Venta inválida' });
        }

        const monto = Number(req.body.monto);
        const centavos = Math.round(monto * 100);
        if (!Number.isFinite(monto) || centavos <= 0) {
            return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
        }

        const fecha = textoOpcional(req.body.fecha);
        if (fecha && !fechaValida(fecha)) {
            return res.status(400).json({ error: 'La fecha no es válida' });
        }

        const metodo = textoOpcional(req.body.metodo) || 'efectivo';
        if (!METODOS.includes(metodo)) {
            return res.status(400).json({ error: 'La forma de pago no es válida' });
        }

        const observaciones = textoOpcional(req.body.observaciones);
        if (observaciones && observaciones.length > 200) {
            return res.status(400).json({ error: 'Las observaciones son demasiado largas' });
        }

        const resultado = await Pago.crear({ venta_id: ventaId, centavos, fecha, metodo, observaciones });

        if (resultado.error === 'NO_EXISTE') {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        if (resultado.error === 'ANULADA') {
            return res.status(409).json({ error: 'La venta está anulada' });
        }
        if (resultado.error === 'EXCEDE') {
            return res.status(400).json({
                error: `El pago supera el saldo pendiente (${formatoDinero(resultado.saldo_centavos)})`
            });
        }

        res.status(201).json(resultado.pago);
    } catch (error) {
        if (error.code === '22007' || error.code === '22008') {
            return res.status(400).json({ error: 'La fecha no es válida' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el pago' });
    }
}

async function anular(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        const pago = await Pago.anular(id);
        if (!pago) {
            return res.status(404).json({ error: 'Pago no encontrado o ya anulado' });
        }
        res.json({ mensaje: 'Pago anulado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al anular el pago' });
    }
}

module.exports = { crear, anular };