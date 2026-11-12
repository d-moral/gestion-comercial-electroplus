const Venta = require('../models/venta');

function idDesdeParams(req) {
    const id = parseInt(req.params.id, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function textoOpcional(valor) {
    if (valor === undefined || valor === null) return null;
    const texto = String(valor).trim();
    return texto === '' ? null : texto;
}

function esVacio(valor) {
    return valor === undefined || valor === null || String(valor).trim() === '';
}

function validarItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { error: 'La venta debe tener al menos un ítem' };
    }

    const limpios = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i] || {};
        const n = i + 1;

        const descripcion = String(item.descripcion ?? '').trim();
        if (!descripcion) return { error: `Ítem ${n}: falta la descripción` };
        if (descripcion.length > 200) return { error: `Ítem ${n}: la descripción es demasiado larga` };

        const cantidad = Number(item.cantidad);
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            return { error: `Ítem ${n}: la cantidad debe ser un entero mayor a 0` };
        }

        if (esVacio(item.precio_cliente)) {
            return { error: `Ítem ${n}: falta el precio al cliente` };
        }
        const precioCliente = Number(item.precio_cliente);
        if (!Number.isFinite(precioCliente) || precioCliente < 0) {
            return { error: `Ítem ${n}: el precio al cliente no es válido` };
        }

        const precioCosto = esVacio(item.precio_costo) ? 0 : Number(item.precio_costo);
        if (!Number.isFinite(precioCosto) || precioCosto < 0) {
            return { error: `Ítem ${n}: el precio al costo no es válido` };
        }

        limpios.push({ descripcion, cantidad, precio_costo: precioCosto, precio_cliente: precioCliente });
    }
    return { items: limpios };
}

async function listar(req, res) {
    try {
        const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 10, 1), 100);
        const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
        const clienteId = parseInt(req.query.cliente_id, 10) || null;
        const estado = ['activa', 'anulada'].includes(req.query.estado) ? req.query.estado : null;
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : null;
        const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || '') ? req.query.hasta : null;

        const resultado = await Venta.listar({ clienteId, desde, hasta, estado, limite, pagina });
        res.json(resultado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar ventas' });
    }
}

async function obtenerUna(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const venta = await Venta.obtenerPorId(id);
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
        res.json(venta);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener la venta' });
    }
}

async function crear(req, res) {
    try {
        const clienteId = parseInt(req.body.cliente_id, 10);
        if (!Number.isInteger(clienteId) || clienteId <= 0) {
            return res.status(400).json({ error: 'Seleccioná un cliente' });
        }

        const fecha = textoOpcional(req.body.fecha);
        if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({ error: 'La fecha no es válida' });
        }

        const validacion = validarItems(req.body.items);
        if (validacion.error) {
            return res.status(400).json({ error: validacion.error });
        }

        const ventaId = await Venta.crear({
            cliente_id: clienteId,
            fecha,
            observaciones: textoOpcional(req.body.observaciones),
            items: validacion.items
        });

        if (!ventaId) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const venta = await Venta.obtenerPorId(ventaId);
        res.status(201).json(venta);
    } catch (error) {
        if (error.code === '22007' || error.code === '22008') {
            return res.status(400).json({ error: 'La fecha no es válida' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear la venta' });
    }
}

async function anular(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const resultado = await Venta.anular(id);
        if (!resultado) {
            return res.status(404).json({ error: 'Venta no encontrada o ya anulada' });
        }
        res.json({ mensaje: 'Venta anulada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al anular la venta' });
    }
}

module.exports = { listar, obtenerUna, crear, anular };