const Cliente = require('../models/cliente');

function limpiar(valor) {
    if (valor === undefined || valor === null) return null;
    const texto = String(valor).trim();
    return texto === '' ? null : texto;
}

function datosDesdeBody(body) {
    return {
        nombre: limpiar(body.nombre),
        dni: limpiar(body.dni),
        telefono: limpiar(body.telefono),
        direccion: limpiar(body.direccion),
        notas: limpiar(body.notas)
    };
}

function idDesdeParams(req) {
    const id = parseInt(req.params.id, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function listar(req, res) {
    try {
        const { busqueda } = req.query;
        const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 10, 1), 100);
        const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);

        const resultado = await Cliente.listar({ busqueda, limite, pagina });
        res.json(resultado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar clientes' });
    }
}

async function obtenerUno(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const cliente = await Cliente.obtenerPorId(id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(cliente);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el cliente' });
    }
}

async function crear(req, res) {
    try {
        const datos = datosDesdeBody(req.body);
        if (!datos.nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const cliente = await Cliente.crear(datos);
        res.status(201).json(cliente);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear el cliente' });
    }
}

async function actualizar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const datos = datosDesdeBody(req.body);
        if (!datos.nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const cliente = await Cliente.actualizar(id, datos);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(cliente);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
}

async function eliminar(req, res) {
    try {
        const id = idDesdeParams(req);
        if (!id) return res.status(400).json({ error: 'ID inválido' });

        const resultado = await Cliente.desactivar(id);
        if (!resultado) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
}

module.exports = { listar, obtenerUno, crear, actualizar, eliminar };