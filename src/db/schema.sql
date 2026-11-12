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