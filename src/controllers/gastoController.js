const Gasto = require('../models/gasto');

function fechaValida(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const fecha = new Date(`${iso}T00:00:00Z`);
    return !isNaN(fecha) && fecha.toISOString().slice(0, 10) === iso;
}

function idDesdeParams(req) {
    const id = parseInt(req.params.id, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Devuelve { datos } o { error }
function validarGasto(body) {
    const descripcion = String(body.descripcion ?? '').trim();
    if (!descripcion) return { error: 'Falta la descripción' };
    if (descripcion.length > 200) return { error: 'La descripción es demasiado larga' };

    const monto = Number(body.monto);
    const centavos = Math.round(monto * 100);
    if (!Number.isFinite(monto) || centavos <= 0) {
        return { error: 'El monto debe ser mayor a 0' };
    }

    const fechaTexto = body.fecha === undefined || body.fecha === null ? '' : String(body.fecha).trim();
    if (fechaTexto && !fechaValida(fechaTexto)) {
        return { error: 'La fecha no es válida' };
    }

    return { datos: { descripcion, centavos, fecha: fechaTexto || null } };
}

async function listar(req, res) {
    try {
        const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes || '') ? req.query.mes : null;
        res.json(await Gasto.listarPorMes(mes));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar los gastos' });
    }
}

async function crear(req, res) {
    try {
        const validacion = validarGasto(req.body);
        if (validacion.error) return res.status(400).json({ error: validacion.error });

        const gasto = await Gasto.crear(validacion.datos);
        res.status(201).json(gasto);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar el gasto' });
    }
}

async function actualizar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const validacion = validarGasto(req.body);
        if (validacion.error) return res.status(400).json({ error: validacion.error });

        const gasto = await Gasto.actualizar(id, validacion.datos);
        if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
        res.json(gasto);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el gasto' });
    }
}

async function eliminar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const eliminado = await Gasto.eliminar(id);
        if (!eliminado) return res.status(404).json({ error: 'Gasto no encontrado' });
        res.json({ mensaje: 'Gasto eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el gasto' });
    }
}

module.exports = { listar, crear, actualizar, eliminar };