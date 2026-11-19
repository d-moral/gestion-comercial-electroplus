const Proveedor = require('../models/proveedor');
const Compra = require('../models/compra');

function idDesdeParams(req) {
    const id = parseInt(req.params.id, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function textoOpcional(valor) {
    if (valor === undefined || valor === null) return null;
    const texto = String(valor).trim();
    return texto === '' ? null : texto;
}

function validarProveedor(body) {
    const nombre = String(body.nombre ?? '').trim();
    if (!nombre) return { error: 'Falta el nombre del proveedor' };
    if (nombre.length > 120) return { error: 'El nombre es demasiado largo' };

    const telefono = textoOpcional(body.telefono);
    if (telefono && telefono.length > 40) return { error: 'El teléfono es demasiado largo' };

    const direccion = textoOpcional(body.direccion);
    if (direccion && direccion.length > 200) return { error: 'La dirección es demasiado larga' };

    return { datos: { nombre, telefono, direccion, notas: textoOpcional(body.notas) } };
}

async function listar(req, res) {
    try {
        const proveedores = await Proveedor.listar();
        const pendienteCent = proveedores.reduce((acc, p) => acc + Math.round(p.pendiente_pago * 100), 0);
        res.json({ proveedores, total_pendiente: pendienteCent / 100 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar los proveedores' });
    }
}

async function crear(req, res) {
    try {
        const validacion = validarProveedor(req.body);
        if (validacion.error) return res.status(400).json({ error: validacion.error });

        const proveedor = await Proveedor.crear(validacion.datos);
        res.status(201).json(proveedor);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el proveedor' });
    }
}

async function actualizar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const validacion = validarProveedor(req.body);
        if (validacion.error) return res.status(400).json({ error: validacion.error });

        const proveedor = await Proveedor.actualizar(id, validacion.datos);
        if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
        res.json(proveedor);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el proveedor' });
    }
}

async function eliminar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const resultado = await Proveedor.eliminar(id);
        if (!resultado) return res.status(404).json({ error: 'Proveedor no encontrado' });
        res.json({ mensaje: 'Proveedor eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el proveedor' });
    }
}

async function listarCompras(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const proveedor = await Proveedor.obtenerPorId(id);
        if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

        const compras = await Compra.listarPorProveedor(id);
        const totalCent = compras.reduce((acc, c) => acc + Math.round(c.monto * 100), 0);
        const pendienteCent = compras
            .filter(c => !c.pagada)
            .reduce((acc, c) => acc + Math.round(c.monto * 100), 0);

        res.json({
            proveedor,
            compras,
            total: totalCent / 100,
            pendiente: pendienteCent / 100
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar las compras' });
    }
}

module.exports = { listar, crear, actualizar, eliminar, listarCompras };