const Cobro = require('../models/cobro');

function sumar(cuotas) {
    return cuotas.reduce((acc, c) => acc + Math.round(c.saldo * 100), 0) / 100;
}

async function agenda(req, res) {
    try {
        const filas = await Cobro.agenda();

        const atrasadas = filas.filter(f => f.dias > 0)
            .map(f => ({ ...f, dias_atraso: f.dias }))
            .sort((a, b) => b.dias - a.dias);
        const hoy = filas.filter(f => f.dias === 0);
        const semana = filas.filter(f => f.dias < 0);

        res.json({
            hoy: filas.length ? filas[0].hoy : null,
            atrasadas: { total: sumar(atrasadas), cuotas: atrasadas },
            vencen_hoy: { total: sumar(hoy), cuotas: hoy },
            proximos_7_dias: { total: sumar(semana), cuotas: semana }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar la agenda de cobros' });
    }
}

async function deudores(req, res) {
    try {
        const clientes = await Cobro.deudores();
        res.json({
            clientes,
            total_deuda: clientes.reduce((acc, c) => acc + Math.round(c.deuda * 100), 0) / 100,
            total_vencido: clientes.reduce((acc, c) => acc + Math.round(c.vencido * 100), 0) / 100
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar los deudores' });
    }
}

module.exports = { agenda, deudores };