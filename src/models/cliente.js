const pool = require('../db');

class Cliente {
    static async listar({ busqueda = '', limite = 10, pagina = 1 }) {
        const offset = (pagina - 1) * limite;
        const params = [];
        const condiciones = ['activo = TRUE'];

        if (busqueda) {
            params.push(`%${busqueda}%`);
            const i = params.length;
            condiciones.push(`(nombre ILIKE $${i} OR dni ILIKE $${i} OR telefono ILIKE $${i})`);
        }

        const where = `WHERE ${condiciones.join(' AND ')}`;

        const { rows: conteo } = await pool.query(
            `SELECT COUNT(*)::INT AS total FROM clientes ${where}`,
            params
        );
        const total = conteo[0].total;

        const { rows } = await pool.query(
            `SELECT * FROM clientes ${where}
             ORDER BY nombre ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limite, offset]
        );

        return {
            clientes: rows,
            total,
            pagina,
            total_paginas: Math.max(1, Math.ceil(total / limite))
        };
    }

    static async obtenerPorId(id) {
        const { rows } = await pool.query(
            'SELECT * FROM clientes WHERE id = $1 AND activo = TRUE',
            [id]
        );
        return rows[0] || null;
    }

    static async crear({ nombre, dni, telefono, direccion, notas }) {
        const { rows } = await pool.query(
            `INSERT INTO clientes (nombre, dni, telefono, direccion, notas)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [nombre, dni, telefono, direccion, notas]
        );
        return rows[0];
    }

    static async actualizar(id, { nombre, dni, telefono, direccion, notas }) {
        const { rows } = await pool.query(
            `UPDATE clientes
             SET nombre = $1, dni = $2, telefono = $3, direccion = $4, notas = $5,
                 actualizado_en = NOW()
             WHERE id = $6 AND activo = TRUE
             RETURNING *`,
            [nombre, dni, telefono, direccion, notas, id]
        );
        return rows[0] || null;
    }

    static async desactivar(id) {
        const { rows } = await pool.query(
            `UPDATE clientes
             SET activo = FALSE, actualizado_en = NOW()
             WHERE id = $1 AND activo = TRUE
             RETURNING id`,
            [id]
        );
        return rows[0] || null;
    }
}

module.exports = Cliente;