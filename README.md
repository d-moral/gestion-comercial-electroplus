# Electroplus · Gestión comercial

Sistema web que corre en la PC del local para gestionar un comercio que vende a cuotas: ventas financiadas, cobros, deudas, gastos, proveedores y copias de seguridad. Está desarrollado a medida para un cliente real, y la idea central es que quien lo usa nunca tenga que tocar una terminal.

## Qué resuelve

El dueño del comercio dejaba pagar en cuotas y, al cerrar el día, no sabía cuánto había ganado de verdad ni cuánta gente le debía. El sistema contesta esas preguntas.

## Funcionalidades

- **Clientes**: alta, edición y búsqueda, con el **estado de cuenta** de cada uno (cuánto compró, cuánto debe y qué cuotas tiene).
- **Ventas a cuotas**: ítems de texto libre con precio de costo y precio al cliente, en cuotas semanales, quincenales o mensuales. Las cuotas se generan en el servidor.
- **Pagos parciales**: cada pago se aplica a las cuotas en orden. Los pagos se pueden anular, y una venta con pagos activos no se puede anular.
- **Agenda de cobros**: vencimientos de hoy, de la semana y atrasados (con días de atraso), más el listado de deudores.
- **Cierre del día y del período**: ganancia de lo vendido, ganancia efectivamente cobrada (proporcional a lo que entró), gastos y ganancia real.
- **Gastos mensuales**: listado por mes con subtotal por día.
- **Proveedores y compras**: compras de mercadería marcadas como pagadas o pendientes.
- **Remito en PDF**: con logo, marca de agua, plan de pagos y pagos recibidos.
- **Copias de seguridad**: automáticas, con descarga y restauración desde el propio sistema.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20, Express |
| Base de datos | PostgreSQL 16 |
| PDF | PDFKit |
| Frontend | HTML, CSS y JavaScript sin framework |
| Infraestructura | Docker y Docker Compose |
| Instalación en Windows | Scripts de PowerShell y Programador de tareas |

## Cómo ejecutarlo

Requiere Docker.

```bash
git clone https://github.com/d-moral/gestion-comercial-electroplus.git
cd gestion-comercial-electroplus
docker compose up --build
```

La aplicación queda en <http://localhost:3001>.
Los puertos solo se publican en `127.0.0.1` (app en el 3001, base en el 5433), así que el sistema es accesible únicamente desde la misma PC.

## Estructura

```
src/
  app.js            # servidor Express y rutas
  routes/           # una ruta por recurso
  controllers/      # validación y respuesta HTTP
  models/           # consultas SQL y reglas de negocio
  db/               # conexión y esquema (schema.sql)
  backup/           # copias de seguridad y restauración
  pdf/              # generación del remito
public/             # frontend (index.html, css, js)
scripts/            # instalación y arranque automático en Windows
```

## Copias de seguridad

- Se genera una copia con `pg_dump` si pasaron más de 20 horas desde la última (zona horaria de Buenos Aires).
- Se conservan las últimas 30, en la carpeta `backups/`.
- El panel **Copias** permite crear una copia manual, descargarla y restaurarla (con confirmación).

## Instalación en Windows

En la PC del local, con Docker Desktop instalado:

```
scripts\instalar.bat
```

Esto crea un acceso directo en el escritorio y dos tareas programadas: una arranca el sistema al iniciar sesión y abre la aplicación en una ventana propia con Chrome. La otra copia cada hora los backups nuevos a un pendrive con la etiqueta `ELECTROPLUS`, si está conectado.

## Alcance y limitaciones

El sistema está pensado para usarse localmente en una sola PC, por eso no incluye autenticación. Si se expusiera a una red, habría que agregarla.