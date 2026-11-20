require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DIR_BACKUPS, NOMBRE_VALIDO, listarBackups } = require('./backup');

const nombre = process.argv[2];
const confirmado = process.argv.includes('--confirmar');

if (!nombre || !NOMBRE_VALIDO.test(nombre)) {
    console.error('Uso: npm run restore -- <archivo.dump> --confirmar\n');
    const disponibles = listarBackups();
    console.error(disponibles.length
        ? 'Copias disponibles:\n  ' + disponibles.map(b => b.nombre).join('\n  ')
        : 'No hay copias en la carpeta backups/');
    process.exit(1);
}

const ruta = path.join(DIR_BACKUPS, nombre);
if (!fs.existsSync(ruta)) {
    console.error(`No existe el archivo ${nombre} en la carpeta de copias`);
    process.exit(1);
}

if (!confirmado) {
    console.error('ATENCIÓN: restaurar REEMPLAZA todos los datos actuales por los de esa copia.');
    console.error(`Si estás seguro, repetí el comando agregando --confirmar:\n  npm run restore -- ${nombre} --confirmar`);
    process.exit(1);
}

const args = [
    '-h', process.env.DB_HOST,
    '-p', String(process.env.DB_PORT || 5432),
    '-U', process.env.DB_USER,
    '-d', process.env.DB_NAME,
    '--clean', '--if-exists', '--no-owner', '--no-privileges',
    ruta
];

console.log(`Restaurando ${nombre}...`);
const proceso = spawn('pg_restore', args, {
    env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
    stdio: ['ignore', 'inherit', 'inherit']
});

proceso.on('error', (err) => {
    console.error('No se pudo ejecutar pg_restore:', err.message);
    process.exit(1);
});
proceso.on('close', (codigo) => {
    if (codigo === 0) {
        console.log('Restauración completa.');
    } else {
        console.log(`pg_restore terminó con código ${codigo}. Revisá los mensajes de arriba; a veces son solo avisos.`);
    }
    process.exit(codigo);
});