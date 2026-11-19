const Compra = require('../models/compra');

function fechaValida(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const fecha = new Date(`${iso}T00:00:00Z`);
    return !isNaN(fecha) && fecha.toISOString().slice(0, 10) === iso;
}

function idDesdeParams(req) {
    const id = parseInt(req.params.id, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function textoOpcional(valor) {
    if (valor === undefined || valor === null) return null;
    const texto = String(valor).trim();
    return texto === '' ? null : texto;
}

function validarCompra(body) {
    const descripcion = String(body.descripcion ?? '').trim();
    if (!descripcion) return { error: 'Falta la descripción de la mercadería' };
    if (descripcion.length > 300) return { error: 'La descripción es demasiado larga' };

    const monto = Number(body.monto);
    const centavos = Math.round(monto * 100);
    if (!Number.isFinite(monto) || centavos <= 0) {
        return { error: 'El monto debe ser mayor a 0' };
    }

    const fecha = textoOpcional(body.fecha);
    if (fecha && !fechaValida(fecha)) return { error: 'La fecha no es válida' };

    return {
        datos: {
            descripcion,
            centavos,
            fecha,
            pagada: body.pagada !== false,
            observaciones: textoOpcional(body.observaciones)
        }
    };
}

async function crear(req, res) {
    try {
        const proveedorId = parseInt(req.body.proveedor_id, 10);
        if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
            return res.status(400).json({ error: 'Falta el proveedor' });
        }

        const validacion = validarCompra(req.body);
        if (validacion.error) return res.status(400).json({ error: validacion.error });

        const compra = await Compra.crear({ proveedor_id: proveedorId, ...validacion.datos });
        if (!compra) return res.status(404).json({ error: 'Proveedor no encontrado' });
        res.status(201).json(compra);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar la compra' });
    }
}

async function actualizar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const validacion = validarCompra(req.body);
        if (validacion.error) return res.status(400).json({ error: validacion.error });

        const compra = await Compra.actualizar(id, validacion.datos);
        if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
        res.json(compra);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar la compra' });
    }
}

async function marcarPagada(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const compra = await Compra.marcarPagada(id, req.body.pagada !== false);
        if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
        res.json(compra);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar la compra' });
    }
}

async function eliminar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const eliminada = await Compra.eliminar(id);
        if (!eliminada) return res.status(404).json({ error: 'Compra no encontrada' });
        res.json({ mensaje: 'Compra eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar la compra' });
    }
}

module.exports = { crear, actualizar, marcarPagada, eliminar };