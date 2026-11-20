const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const RUTA_SCHEMA = path.join(__dirname, '../db/schema.sql');

const DIR_BACKUPS = process.env.BACKUP_DIR || '/app/backups';
const MAX_BACKUPS = parseInt(process.env.BACKUP_MAX, 10) || 30;
const HORAS_ENTRE_BACKUPS = parseInt(process.env.BACKUP_CADA_HORAS, 10) || 20;

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
            return { nombre, fecha, hora: `${hh}:${mm}`, tamano_bytes: stat.size, creado_ms: stat.mtimeMs };
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

async function crearBackup({ rotar = true } = {}) {
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
        if (rotar) rotarBackups();

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

// Hace una copia si pasaron más de HORAS_ENTRE_BACKUPS desde la última
function iniciarBackupsAutomaticos() {
    const limiteMs = HORAS_ENTRE_BACKUPS * 60 * 60 * 1000;

    async function revisar() {
        try {
            if (enCurso) return;

            const ultima = listarBackups()[0]; // la más nueva
            const hayQueHacer = !ultima || Date.now() - ultima.creado_ms > limiteMs;
            if (!hayQueHacer) return;

            const copia = await crearBackup();
            console.log(`Copia automática creada: ${copia.nombre}`);
        } catch (error) {
            console.error('Error en la copia automática:', error.message);
        }
    }

    setInterval(revisar, 10 * 60 * 1000); // revisa cada 10 minutos
    setTimeout(revisar, 30 * 1000);       // y apenas arranca el sistema
    console.log(`Copias automáticas activadas: una cada ${HORAS_ENTRE_BACKUPS} horas como máximo (se guardan las últimas ${MAX_BACKUPS})`);
}

// ---------- Restauración ----------
function ejecutarPgRestore(ruta) {
    return new Promise((resolve, reject) => {
        const args = [
            '-h', process.env.DB_HOST,
            '-p', String(process.env.DB_PORT || 5432),
            '-U', process.env.DB_USER,
            '-d', process.env.DB_NAME,
            '--no-owner', '--no-privileges', '--exit-on-error',
            ruta
        ];
        const proceso = spawn('pg_restore', args, {
            env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
        });

        let errores = '';
        proceso.stderr.on('data', d => { errores += d; });
        proceso.on('error', (err) => reject(new Error(err.message)));
        proceso.on('close', (codigo) => {
            if (codigo === 0) resolve();
            else reject(new Error(errores.trim() || `pg_restore terminó con código ${codigo}`));
        });
    });
}

// Deja la base vacía y carga la copia (así no importa si el esquema cambió desde que se hizo)
async function ejecutarRestore(ruta) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await ejecutarPgRestore(ruta);
}

// Por si la copia es de antes de que existieran tablas nuevas: las crea vacías
async function aplicarEsquema() {
    const sql = fs.readFileSync(RUTA_SCHEMA, 'utf8');
    await pool.query(sql);
}

async function restaurarBackup(nombre) {
    if (!NOMBRE_VALIDO.test(nombre)) throw new Error('Nombre de copia inválido');
    const ruta = path.join(DIR_BACKUPS, nombre);
    if (!fs.existsSync(ruta)) throw new Error('La copia no existe');
    if (enCurso) throw new Error('Hay otra copia en curso, probá de nuevo en un momento');

    // 1) Copia del estado actual, por si hay que volver atrás (sin rotar, para no borrar la elegida)
    const previa = await crearBackup({ rotar: false });

    enCurso = true;
    try {
        try {
            await ejecutarRestore(ruta);
            await aplicarEsquema();
        } catch (error) {
            // 2) Si algo falla, se intenta volver al estado anterior
            let volvio = true;
            try {
                await ejecutarRestore(previa.ruta);
            } catch (e) {
                volvio = false;
            }
            throw new Error(volvio
                ? `No se pudo restaurar (${error.message}). Se volvió al estado anterior: no se perdió nada.`
                : `No se pudo restaurar (${error.message}) ni volver atrás. Avisale al desarrollador: la copia ${previa.nombre} tiene los datos anteriores.`);
        }
        return { restaurada: nombre, copia_previa: previa.nombre };
    } finally {
        enCurso = false;
    }
}

module.exports = {
    DIR_BACKUPS,
    MAX_BACKUPS,
    HORAS_ENTRE_BACKUPS,
    NOMBRE_VALIDO,
    listarBackups,
    crearBackup,
    restaurarBackup,
    iniciarBackupsAutomaticos
};