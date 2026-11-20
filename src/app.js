const express = require('express');
require('dotenv').config();
const pool = require('./db');
const clientesRouter = require('./routes/clientes');
const ventasRouter = require('./routes/ventas');
const pagosRouter = require('./routes/pagos');
const cobrosRouter = require('./routes/cobros');
const gastosRouter = require('./routes/gastos');
const resumenRouter = require('./routes/resumen');
const proveedoresRouter = require('./routes/proveedores');
const comprasRouter = require('./routes/compras');
const backupsRouter = require('./routes/backups');
const { iniciarBackupsAutomaticos } = require('./backup/backup');
const { aplicarEsquemaAlArrancar } = require('./db/esquema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'ok' });
    } catch (error) {
        res.status(500).json({ status: 'error', db: 'sin conexión' });
    }
});
app.use('/api/clientes', clientesRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/cobros', cobrosRouter);
app.use('/api/gastos', gastosRouter);
app.use('/api/resumen', resumenRouter);
app.use('/api/proveedores', proveedoresRouter);
app.use('/api/compras', comprasRouter);
app.use('/api/backups', backupsRouter);
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    aplicarEsquemaAlArrancar().then(() => iniciarBackupsAutomaticos());
});