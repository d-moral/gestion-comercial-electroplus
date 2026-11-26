const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const RUTA_LOGO = path.join(__dirname, '../../public/img/logo.png');

const AZUL = '#0b6cf0';
const GRIS = '#6b7280';
const TEXTO = '#111827';
const BORDE = '#d1d5db';
const DATOS_LOCAL = [];
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
        const alto = altoTexto + 8;

        if (doc.y + alto > doc.page.height - doc.page.margins.bottom - 10) {
            doc.addPage();
            encabezado();
        }

        const y = doc.y;

        doc.font('Helvetica').fontSize(9).fillColor(TEXTO);
        let x = MARGEN;
        fila.forEach((valor, j) => {
            doc.text(String(valor), x + 6, y + 4, {width: columnas[j].ancho - 12, align: columnas[j].alinear || 'left' });
            x += columnas[j].ancho;
        });
        doc.y = y + alto;
        doc.lineWidth(0.5).strokeColor(BORDE);
        doc.moveTo(MARGEN, y + alto).lineTo(MARGEN + anchoTotal, y + alto).stroke();
        let xLinea = MARGEN;
        for (let j = 0; j <= columnas.length; j++) {
            doc.moveTo(xLinea, y).lineTo(xLinea, y + alto).stroke();
            if (j < columnas.length) xLinea += columnas[j].ancho;
        }
    });

    doc.y += 6;
}

function marcaDeAgua(doc) {
    const xAnterior = doc.x;
    const yAnterior = doc.y;
    const texto = 'ELECTROPLUS';
    const cx = doc.page.width / 2;
    const cy = doc.page.height / 2;
    doc.save();
    doc.rotate(-45, { origin: [cx, cy] });
    doc.font('Helvetica-Bold').fontSize(72).fillColor(AZUL).fillOpacity(0.07);
    const ancho = doc.widthOfString(texto);
    doc.text(texto, cx - ancho / 2, cy - 36, { lineBreak: false });
    doc.restore();
    doc.x = xAnterior;
    doc.y = yAnterior;
}

function cuadroTotales(doc, venta, anulada) {
    const anchoTot = 230;
    const xTot = MARGEN + ANCHO - anchoTot;
    const anchoNotas = ANCHO - anchoTot - 15;
    const ALTO_FILA = 22;
    const ALTO_BANDA = 26;
    const altoTotales = anulada ? ALTO_BANDA : ALTO_FILA * 2 + ALTO_BANDA;

    const notas = venta.observaciones || '';
    doc.font('Helvetica').fontSize(9);
    const altoNotas = Math.max(
        altoTotales,
        26 + (notas ? doc.heightOfString(notas, { width: anchoNotas - 20 }) : 0) + 8
    );

    asegurarEspacio(doc, altoNotas + 10);
    const y0 = doc.y;

    // Notas (izquierda)
    doc.lineWidth(0.5).strokeColor(BORDE).rect(MARGEN, y0, anchoNotas, altoNotas).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXTO)
        .text('Notas', MARGEN + 10, y0 + 8, { lineBreak: false });
    if (notas) {
        doc.font('Helvetica').fontSize(9).fillColor(GRIS)
            .text(notas, MARGEN + 10, y0 + 22, { width: anchoNotas - 20 });
    }

    // Totales (derecha): filas con borde y, al final, banda azul
    let y = y0;
    if (!anulada) {
        [['Total', dinero(venta.total_venta)], ['Pagado', dinero(venta.total_pagado)]].forEach(([etiqueta, valor]) => {
            doc.lineWidth(0.5).strokeColor(BORDE);
            doc.rect(xTot, y, 110, ALTO_FILA).stroke();
            doc.rect(xTot + 110, y, anchoTot - 110, ALTO_FILA).stroke();
            doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXTO)
                .text(etiqueta, xTot + 8, y + 7, { width: 94, lineBreak: false });
            doc.font('Helvetica').fontSize(10).fillColor(TEXTO)
                .text(valor, xTot + 118, y + 6, { width: anchoTot - 126, align: 'right', lineBreak: false });
            y += ALTO_FILA;
        });
    }
    doc.rect(xTot, y, anchoTot, ALTO_BANDA).fill(AZUL);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff');
    doc.text(anulada ? 'Total' : 'Saldo pendiente', xTot + 10, y + 8, { width: 110, lineBreak: false });
    doc.text(dinero(anulada ? venta.total_venta : venta.saldo), xTot + 100, y + 8, { width: anchoTot - 110, align: 'right', lineBreak: false });

    doc.y = y0 + altoNotas + 14;
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

    marcaDeAgua(doc);
    doc.on('pageAdded', () => marcaDeAgua(doc));

    // ---------- Encabezado: franja azul con logo ----------
    const ALTO_FRANJA = 96;
    const TAM_LOGO = 76;
    doc.rect(MARGEN, 30, ANCHO, ALTO_FRANJA).fill(AZUL);
    doc.roundedRect(MARGEN + 10, 37, TAM_LOGO + 6, TAM_LOGO + 6, 6).fill('#ffffff');
    if (fs.existsSync(RUTA_LOGO)) {
        doc.image(RUTA_LOGO, MARGEN + 13, 40, { fit: [TAM_LOGO, TAM_LOGO], align: 'center', valign: 'center' });
    }
    const xTexto = MARGEN + TAM_LOGO + 30;
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff')
        .text('ELECTROPLUS', xTexto, 50, { lineBreak: false });
    doc.font('Helvetica').fontSize(9)
        .text('Tu casa, tu elección, tu estilo', xTexto, 74, { lineBreak: false });
    DATOS_LOCAL.forEach((linea, i) => {
        doc.text(linea, xTexto, 88 + i * 12, { lineBreak: false });
    });

    // Ícono de comprobante y título (abajo a la derecha, como en el modelo)
    const xIcono = MARGEN + ANCHO - 14 - 20;
    doc.lineWidth(1.5).strokeColor('#ffffff').roundedRect(xIcono, 40, 20, 24, 3).stroke();
    doc.lineWidth(1);
    [48, 53, 58].forEach(yLinea => doc.moveTo(xIcono + 5, yLinea).lineTo(xIcono + 15, yLinea).stroke());
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff')
        .text('REMITO', MARGEN + 280, 86, { width: ANCHO - 294, align: 'right', lineBreak: false });
    doc.y = 30 + ALTO_FRANJA + 14;

    const anulada = venta.estado === 'anulada';
    if (anulada) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor(ROJO)
            .text('VENTA ANULADA', MARGEN, doc.y, { width: ANCHO });
        doc.y += 6;
    }

    // ---------- Detalle del remito ----------
    const yDet = doc.y;
    const ALTO_FILA = 20;
    const ALTO_DET = ALTO_FILA * 3;
    const ANCHO_ETIQ = 110;
    const xMitad = MARGEN + ANCHO / 2;
    const yCuerpo = yDet + 20;
    doc.rect(MARGEN, yDet, ANCHO, 20).fill(AZUL);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
        .text('Detalle del remito', MARGEN, yDet + 5, { width: ANCHO, align: 'center', lineBreak: false });

    // Cliente (izquierda)
    doc.lineWidth(0.5).strokeColor(BORDE);
    doc.rect(MARGEN, yCuerpo, ANCHO / 2, ALTO_DET).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRIS)
        .text('CLIENTE', MARGEN + 10, yCuerpo + 8, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXTO)
        .text(venta.cliente_nombre, MARGEN + 10, yCuerpo + 20, { width: ANCHO / 2 - 20, height: 14, ellipsis: true });
    const datos = [];
    if (venta.cliente_dni) datos.push(`DNI: ${venta.cliente_dni}`);
    if (venta.cliente_telefono) datos.push(`Tel: ${venta.cliente_telefono}`);
    if (datos.length) {
        doc.font('Helvetica').fontSize(10).fillColor(GRIS)
            .text(datos.join('     '), MARGEN + 10, yCuerpo + 40, { width: ANCHO / 2 - 20, lineBreak: false });
    }

    // N° de remito, fecha y moneda (derecha, en grilla)
    [['N° de remito', numero], ['Fecha', fecha(venta.fecha)], ['Moneda', 'ARS']].forEach(([etiqueta, valor], i) => {
        const yFila = yCuerpo + i * ALTO_FILA;
        doc.lineWidth(0.5).strokeColor(BORDE);
        doc.rect(xMitad, yFila, ANCHO_ETIQ, ALTO_FILA).stroke();
        doc.rect(xMitad + ANCHO_ETIQ, yFila, ANCHO / 2 - ANCHO_ETIQ, ALTO_FILA).stroke();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXTO)
            .text(etiqueta, xMitad + 8, yFila + 6, { width: ANCHO_ETIQ - 16, lineBreak: false });
        doc.font('Helvetica').fontSize(10).fillColor(TEXTO)
            .text(valor, xMitad + ANCHO_ETIQ + 8, yFila + 5, { width: ANCHO / 2 - ANCHO_ETIQ - 16, lineBreak: false });
    });
    doc.y = yCuerpo + ALTO_DET + 14;

    tabla(
        doc,
        [
            { titulo: '#', ancho: 30 },
            { titulo: 'Descripción', ancho: 235 },
            { titulo: 'Cantidad', ancho: 60, alinear: 'right' },
            { titulo: 'Precio', ancho: 90, alinear: 'right' },
            { titulo: 'Importe', ancho: 100, alinear: 'right' }
        ],
        venta.items.map((i, n) => [
            n + 1,
            i.descripcion,
            i.cantidad,
            dinero(i.precio_cliente),
            dinero(i.cantidad * i.precio_cliente)
        ])
    );

    cuadroTotales(doc, venta, anulada);

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


    doc.end();
}

module.exports = { generarRemito };