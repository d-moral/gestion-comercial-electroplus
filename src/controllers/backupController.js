const fs = require('fs');
const path = require('path');
const Backup = require('../backup/backup');

function listar(req, res) {
    try {
        res.json({
            backups: Backup.listarBackups(),
            cada_horas: Backup.HORAS_ENTRE_BACKUPS,
            maximo: Backup.MAX_BACKUPS
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al listar las copias de seguridad' });
    }
}

async function crear(req, res) {
    try {
        const copia = await Backup.crearBackup();
        res.status(201).json({
            nombre: copia.nombre,
            fecha: copia.fecha,
            hora: copia.hora,
            tamano_bytes: copia.tamano_bytes
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: `No se pudo crear la copia: ${error.message}` });
    }
}

function descargar(req, res) {
    const nombre = req.params.nombre;
    if (!Backup.NOMBRE_VALIDO.test(nombre)) {
        return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const ruta = path.join(Backup.DIR_BACKUPS, nombre);
    if (!fs.existsSync(ruta)) {
        return res.status(404).json({ error: 'La copia no existe' });
    }
    res.download(ruta, nombre);
}

async function restaurar(req, res) {
    try {
        const nombre = req.params.nombre;
        if (!Backup.NOMBRE_VALIDO.test(nombre)) {
            return res.status(400).json({ error: 'Nombre de archivo inválido' });
        }
        if (req.body?.confirmacion !== 'RESTAURAR') {
            return res.status(400).json({ error: 'Falta la confirmación' });
        }

        const resultado = await Backup.restaurarBackup(nombre);
        res.json(resultado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = { listar, crear, descargar, restaurar };