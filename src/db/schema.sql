CREATE TABLE IF NOT EXISTS clientes (
                                        id SERIAL PRIMARY KEY,
                                        nombre VARCHAR(120) NOT NULL,
    dni VARCHAR(20),
    telefono VARCHAR(40),
    direccion VARCHAR(200),
    notas TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

DROP INDEX IF EXISTS idx_clientes_dni;
CREATE UNIQUE INDEX idx_clientes_dni ON clientes(dni) WHERE dni IS NOT NULL AND activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);


CREATE TABLE IF NOT EXISTS ventas (
                                      id SERIAL PRIMARY KEY,
                                      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones TEXT,
    total_costo NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'anulada')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS venta_items (
                                           id SERIAL PRIMARY KEY,
                                           venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    descripcion VARCHAR(200) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_costo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
    precio_cliente NUMERIC(12,2) NOT NULL CHECK (precio_cliente >= 0)
    );

CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);


ALTER TABLE ventas ADD COLUMN IF NOT EXISTS frecuencia VARCHAR(20) NOT NULL DEFAULT 'mensual'
    CHECK (frecuencia IN ('semanal', 'quincenal', 'mensual'));

CREATE TABLE IF NOT EXISTS cuotas (
                                      id SERIAL PRIMARY KEY,
                                      venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero > 0),
    vencimiento DATE NOT NULL,
    monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    UNIQUE (venta_id, numero)
    );

CREATE TABLE IF NOT EXISTS pagos (
                                     id SERIAL PRIMARY KEY,
                                     venta_id INTEGER NOT NULL REFERENCES ventas(id),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    metodo VARCHAR(30) NOT NULL DEFAULT 'efectivo',
    observaciones TEXT,
    anulado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_cuotas_venta ON cuotas(venta_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_vencimiento ON cuotas(vencimiento);
CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos(venta_id);

-- Ventas anteriores a este paso: quedan con una sola cuota, vencida el día de la venta
INSERT INTO cuotas (venta_id, numero, vencimiento, monto)
SELECT v.id, 1, v.fecha, v.total_venta
FROM ventas v
WHERE NOT EXISTS (SELECT 1 FROM cuotas q WHERE q.venta_id = v.id);