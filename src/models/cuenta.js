const pool = require('../db');
const Venta = require('./venta');

class Cuenta {
    static async cliente(id) {
        const { rows } = await pool.query(
            `SELECT id, nombre, dni, telefono, direccion
             FROM clientes
             WHERE id = $1 AND activo = TRUE`,
            [id]
        );
        return rows[0] || null;
    }

    // Ventas activas del cliente, con cuotas, pagos e ítems (se reutiliza el cálculo de Venta)
    static async ventasActivas(clienteId) {
        const { rows } = await pool.query(
            `SELECT id
             FROM ventas
             WHERE cliente_id = $1 AND estado = 'activa'
             ORDER BY fecha DESC, id DESC`,
            [clienteId]
        );
        const ventas = await Promise.all(rows.map(r => Venta.obtenerPorId(r.id)));
        return ventas.filter(Boolean);
    }
}

module.exports = Cuenta;