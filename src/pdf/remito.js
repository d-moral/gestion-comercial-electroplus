const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const RUTA_LOGO = path.join(__dirname, '../../public/img/logo.png');

const AZUL = '#1e3a8a';
const GRIS = '#6b7280';
const TEXTO = '#111827';
const FRANJA = '#f3f4f6';
const ROJO = '#b91c1c';
const VERDE = '#15803d';

const MARGEN = 40;
const ANCHO = 515; // A4 (595) menos los márgenes

const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const dinero = (n) => formatoMoneda.format(Number(n) || 0).replace(/\u00a0/g, ' ');

function fecha(iso) {
    if (!iso) return '-';
    const [anio, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${anio}`;
}

const FRECUENCIAS = { semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' };
const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', otro: 'Otro' };

function asegurarEspacio(doc, alto) {
    if (doc.y + alto > doc.page.height - doc.page.margins.bottom - 10) {
        doc.addPage();
    }
}

function tituloSeccion(doc, texto) {
    asegurarEspacio(doc, 60);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(AZUL).text(texto, MARGEN, doc.y, { width: ANCHO });
    doc.y += 4;
}

// columnas: [{ titulo, ancho, alinear }], filas: arrays de textos
function tabla(doc, columnas, filas) {
    const anchoTotal = columnas.reduce((acc, c) => acc + c.ancho, 0);

    function encabezado() {
        const y = doc.y;
        doc.rect(MARGEN, y, anchoTotal, 20).fill(AZUL);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
        let x = MARGEN;
        columnas.forEach(c => {
            doc.text(c.titulo, x + 6, y + 6, { width: c.ancho - 12, align: c.alinear || 'left', lineBreak: false });
            x += c.ancho;
        });
        doc.y = y + 20;
    }

    asegurarEspacio(doc, 60);
    encabezado();

    filas.forEach((fila, i) => {
        doc.font('Helvetica').fontSize(9);
        const altoTexto = Math.max(...fila.map((valor, j) =>
            doc.heightOfString(String(valor), { width: columnas[j].ancho - 12 })
        ));
        const alto = altoTexto + 10;

        if (doc.y + alto > doc.page.height - doc.page.margins.bottom - 10) {
            doc.addPage();
            encabezado();
        }

        const y = doc.y;
        if (i % 2 === 1) doc.rect(MARGEN, y, anchoTotal, alto).fill(FRANJA);

        doc.font('Helvetica').fontSize(9).fillColor(TEXTO);
        let x = MARGEN;
        fila.forEach((valor, j) => {
            doc.text(String(valor), x + 6, y + 5, { width: columnas[j].ancho - 12, align: columnas[j].alinear || 'left' });
            x += columnas[j].ancho;
        });
        doc.y = y + alto;
    });

    doc.y += 6;
}

function lineaTotal(doc, etiqueta, valor, { negrita = false, color = TEXTO } = {}) {
    asegurarEspacio(doc, 24);
    const y = doc.y;
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(negrita ? 12 : 10).fillColor(color);
    doc.text(etiqueta, MARGEN + ANCHO - 260, y, { width: 150, align: 'right', lineBreak: false });
    doc.text(valor, MARGEN + ANCHO - 100, y, { width: 100, align: 'right', lineBreak: false });
    doc.y = y + (negrita ? 20 : 16);
}

function textoEstadoCuota(c) {
    if (c.estado === 'pagada') return 'Pagada';
    if (c.estado === 'vencida') return `Vencida (${c.dias_atraso} ${c.dias_atraso === 1 ? 'día' : 'días'})`;
    if (c.pagado > 0) return 'Parcial';
    return 'Pendiente';
}

function generarRemito(venta, salida) {
    const numero = String(venta.id).padStart(8, '0');
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 40, left: MARGEN, right: MARGEN },
        info: { Title: `Remito ${numero}`, Author: 'Electroplus' }
    });
    doc.pipe(salida);

    // ---------- Parte superior: el logo ----------
    const TAM_LOGO = 100;
    if (fs.existsSync(RUTA_LOGO)) {
        doc.image(RUTA_LOGO, (doc.page.width - TAM_LOGO) / 2, 30, { fit: [TAM_LOGO, TAM_LOGO] });
    } else {
        doc.font('Helvetica-Bold').fontSize(28).fillColor(AZUL)
            .text('ELECTROPLUS', MARGEN, 100, { width: ANCHO, align: 'center' });
    }

    // ---------- Título y número ----------
    const yTitulo = 30 + TAM_LOGO + 15;
    doc.font('Helvetica-Bold').fontSize(18).fillColor(AZUL)
        .text('REMITO', MARGEN, yTitulo, { width: ANCHO / 2, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXTO)
        .text(`N° ${numero}`, MARGEN + ANCHO / 2, yTitulo + 2, { width: ANCHO / 2, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor(GRIS)
        .text(`Fecha: ${fecha(venta.fecha)}`, MARGEN + ANCHO / 2, yTitulo + 18, { width: ANCHO / 2, align: 'right', lineBreak: false });
    doc.moveTo(MARGEN, yTitulo + 38).lineTo(MARGEN + ANCHO, yTitulo + 38)
        .lineWidth(1.5).strokeColor(AZUL).stroke();
    doc.y = yTitulo + 48;

    const anulada = venta.estado === 'anulada';
    if (anulada) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor(ROJO)
            .text('VENTA ANULADA', MARGEN, doc.y, { width: ANCHO });
        doc.y += 6;
    }

    // ---------- Cliente ----------
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRIS).text('CLIENTE', MARGEN, doc.y, { width: ANCHO });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXTO).text(venta.cliente_nombre, MARGEN, doc.y + 2, { width: ANCHO });
    const datos = [];
    if (venta.cliente_dni) datos.push(`DNI: ${venta.cliente_dni}`);
    if (venta.cliente_telefono) datos.push(`Tel: ${venta.cliente_telefono}`);
    if (datos.length) {
        doc.font('Helvetica').fontSize(10).fillColor(GRIS).text(datos.join('     '), MARGEN, doc.y + 2, { width: ANCHO });
    }
    doc.y += 16;

    // ---------- Ítems (sin costos: es un documento para el cliente) ----------
    tabla(
        doc,
        [
            { titulo: 'Descripción', ancho: 255 },
            { titulo: 'Cant.', ancho: 50, alinear: 'right' },
            { titulo: 'Precio unit.', ancho: 100, alinear: 'right' },
            { titulo: 'Subtotal', ancho: 110, alinear: 'right' }
        ],
        venta.items.map(i => [
            i.descripcion,
            i.cantidad,
            dinero(i.precio_cliente),
            dinero(i.cantidad * i.precio_cliente)
        ])
    );

    // ---------- Totales ----------
    lineaTotal(doc, 'Total', dinero(venta.total_venta), { negrita: true });
    if (!anulada) {
        lineaTotal(doc, 'Pagado', dinero(venta.total_pagado));
        lineaTotal(doc, 'Saldo pendiente', dinero(venta.saldo), {
            negrita: true,
            color: venta.saldo > 0 ? ROJO : VERDE
        });
    }
    doc.y += 10;

    // ---------- Plan de pagos ----------
    if (!anulada && venta.cuotas.length > 0) {
        const n = venta.cuotas.length;
        const titulo = n === 1
            ? 'Plan de pagos: pago único'
            : `Plan de pagos: ${n} cuotas ${FRECUENCIAS[venta.frecuencia] || ''}`;
        tituloSeccion(doc, titulo);
        tabla(
            doc,
            [
                { titulo: 'N°', ancho: 40 },
                { titulo: 'Vencimiento', ancho: 120 },
                { titulo: 'Monto', ancho: 115, alinear: 'right' },
                { titulo: 'Pagado', ancho: 115, alinear: 'right' },
                { titulo: 'Estado', ancho: 125 }
            ],
            venta.cuotas.map(c => [
                c.numero,
                fecha(c.vencimiento),
                dinero(c.monto),
                dinero(c.pagado),
                textoEstadoCuota(c)
            ])
        );
    }

    // ---------- Pagos recibidos ----------
    const pagos = (venta.pagos || []).filter(p => !p.anulado).reverse();
    if (!anulada && pagos.length > 0) {
        tituloSeccion(doc, 'Pagos recibidos');
        tabla(
            doc,
            [
                { titulo: 'Fecha', ancho: 130 },
                { titulo: 'Forma de pago', ancho: 255 },
                { titulo: 'Monto', ancho: 130, alinear: 'right' }
            ],
            pagos.map(p => [fecha(p.fecha), METODOS[p.metodo] || p.metodo, dinero(p.monto)])
        );
    }

    // ---------- Observaciones ----------
    if (venta.observaciones) {
        tituloSeccion(doc, 'Observaciones');
        doc.font('Helvetica').fontSize(10).fillColor(TEXTO)
            .text(venta.observaciones, MARGEN, doc.y, { width: ANCHO });
        doc.y += 10;
    }

    // ---------- Pie ----------
    asegurarEspacio(doc, 50);
    doc.y += 14;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(AZUL)
        .text('¡Gracias por su compra!', MARGEN, doc.y, { width: ANCHO, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(GRIS)
        .text('Documento no válido como factura.', MARGEN, doc.y + 2, { width: ANCHO, align: 'center' });

    doc.end();
}

module.exports = { generarRemito };