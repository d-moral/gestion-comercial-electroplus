const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR_BACKUPS = process.env.BACKUP_DIR || '/app/backups';
const MAX_BACKUPS = parseInt(process.env.BACKUP_MAX, 10) || 30;
const HORA_BACKUP = process.env.BACKUP_HORA || '22:00'; // hora de Buenos Aires

const NOMBRE_VALIDO = /^electroplus_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.dump$/;

let enCurso = false;

// Fecha y hora actuales en Buenos Aires (el servidor corre en UTC)
function ahoraBA() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());

    const v = {};
    partes.forEach(p => { v[p.type] = p.value; });
    const hora = v.hour === '24' ? '00' : v.hour;
    return {
        fecha: `${v.year}-${v.month}-${v.day}`,
        hora: parseInt(hora, 10),
        minuto: parseInt(v.minute, 10),
        textoHora: hora,
        textoMinuto: v.minute
    };
}

function listarBackups() {
    if (!fs.existsSync(DIR_BACKUPS)) return [];

    return fs.readdirSync(DIR_BACKUPS)
        .filter(nombre => NOMBRE_VALIDO.test(nombre))
        .map(nombre => {
            const [, fecha, hh, mm] = nombre.match(/^electroplus_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})\.dump$/);
            const stat = fs.statSync(path.join(DIR_BACKUPS, nombre));
            return { nombre, fecha, hora: `${hh}:${mm}`, tamano_bytes: stat.size };
        })
        .sort((a, b) => (a.nombre < b.nombre ? 1 : -1)); // más nuevas primero
}

function ejecutarPgDump(rutaSalida) {
    return new Promise((resolve, reject) => {
        const args = [
            '-h', process.env.DB_HOST,
            '-p', String(process.env.DB_PORT || 5432),
            '-U', process.env.DB_USER,
            '-d', process.env.DB_NAME,
            '-Fc', '--no-owner', '--no-privileges',
            '-f', rutaSalida
        ];
        const proceso = spawn('pg_dump', args, {
            env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
        });

        let errores = '';
        proceso.stderr.on('data', d => { errores += d; });
        proceso.on('error', (err) => {
            reject(new Error(err.code === 'ENOENT'
                ? 'pg_dump no está instalado en el contenedor (reconstruí con: docker compose up -d --build)'
                : err.message));
        });
        proceso.on('close', (codigo) => {
            if (codigo === 0) resolve();
            else reject(new Error(errores.trim() || `pg_dump terminó con código ${codigo}`));
        });
    });
}

// Deja solo las últimas MAX_BACKUPS copias
function rotarBackups() {
    listarBackups().slice(MAX_BACKUPS).forEach(b => {
        try {
            fs.unlinkSync(path.join(DIR_BACKUPS, b.nombre));
        } catch (error) {
            console.error(`No se pudo borrar la copia vieja ${b.nombre}:`, error.message);
        }
    });
}

async function crearBackup() {
    if (enCurso) throw new Error('Ya hay una copia en curso');
    enCurso = true;

    const ahora = ahoraBA();
    const nombre = `electroplus_${ahora.fecha}_${ahora.textoHora}-${ahora.textoMinuto}.dump`;
    const ruta = path.join(DIR_BACKUPS, nombre);
    const temporal = `${ruta}.tmp`;

    try {
        fs.mkdirSync(DIR_BACKUPS, { recursive: true });
        await ejecutarPgDump(temporal);
        fs.renameSync(temporal, ruta); // recién ahora el archivo "existe": nunca queda una copia a medias
        rotarBackups();

        const stat = fs.statSync(ruta);
        return {
            nombre,
            ruta,
            fecha: ahora.fecha,
            hora: `${ahora.textoHora}:${ahora.textoMinuto}`,
            tamano_bytes: stat.size
        };
    } catch (error) {
        if (fs.existsSync(temporal)) fs.unlinkSync(temporal);
        throw error;
    } finally {
        enCurso = false;
    }
}

// Una copia automática por día, a partir de HORA_BACKUP
function iniciarBackupsAutomaticos() {
    const [hh, mm] = HORA_BACKUP.split(':').map(Number);
    const minutoObjetivo = hh * 60 + mm;

    async function revisar() {
        try {
            const ahora = ahoraBA();
            if (ahora.hora * 60 + ahora.minuto < minutoObjetivo) return;

            const yaHecha = listarBackups().some(b => {
                const [h, m] = b.hora.split(':').map(Number);
                return b.fecha === ahora.fecha && h * 60 + m >= minutoObjetivo;
            });
            if (yaHecha || enCurso) return;

            const copia = await crearBackup();
            console.log(`Copia automática creada: ${copia.nombre}`);
        } catch (error) {
            console.error('Error en la copia automática:', error.message);
        }
    }

    setInterval(revisar, 60 * 1000);
    setTimeout(revisar, 15 * 1000); // al arrancar, por si el sistema estaba apagado a la hora de la copia
    console.log(`Copias automáticas activadas: todos los días a las ${HORA_BACKUP} (se guardan las últimas ${MAX_BACKUPS})`);
}

module.exports = {
    DIR_BACKUPS,
    MAX_BACKUPS,
    HORA_BACKUP,
    NOMBRE_VALIDO,
    listarBackups,
    crearBackup,
    iniciarBackupsAutomaticos
};