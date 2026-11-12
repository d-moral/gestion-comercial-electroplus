
function mostrarPanel(nombre) {
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === nombre);
    });
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${nombre}`);
    });

    if (nombre === 'clientes') cargarClientes();
    if (nombre === 'ventas') cargarVentas();
}

document.querySelectorAll('.menu-item').forEach(btn => {
    btn.addEventListener('click', () => mostrarPanel(btn.dataset.panel));
});

async function verificarSistema() {
    const indicador = document.getElementById('estado-sistema');
    try {
        const res = await fetch('/health');
        if (!res.ok) throw new Error('Respuesta no válida');
        indicador.textContent = 'Sistema conectado';
        indicador.className = 'estado ok';
    } catch (error) {
        indicador.textContent = 'Sin conexión';
        indicador.className = 'estado error';
    }
}

verificarSistema();

// ============================================================
// CLIENTES
// ============================================================
const estadoClientes = {
    pagina: 1,
    limite: 10,
    busqueda: '',
    lista: [],
    editandoId: null
};

function escaparHtml(texto) {
    const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(texto ?? '').replace(/[&<>"']/g, c => mapa[c]);
}

async function cargarClientes() {
    const tbody = document.getElementById('tabla-clientes');
    const params = new URLSearchParams({
        pagina: estadoClientes.pagina,
        limite: estadoClientes.limite,
        busqueda: estadoClientes.busqueda
    });

    try {
        const res = await fetch(`/api/clientes?${params}`);
        if (!res.ok) throw new Error('Error al cargar');
        const data = await res.json();

        estadoClientes.lista = data.clientes;

        if (data.clientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="vacio">No hay clientes para mostrar</td></tr>';
        } else {
            tbody.innerHTML = data.clientes.map(c => `
                <tr>
                    <td>${escaparHtml(c.nombre)}</td>
                    <td>${escaparHtml(c.dni || '-')}</td>
                    <td>${escaparHtml(c.telefono || '-')}</td>
                    <td>${escaparHtml(c.direccion || '-')}</td>
                    <td class="acciones">
                        <button class="btn-link" data-accion="editar" data-id="${c.id}">Editar</button>
                        <button class="btn-link peligro" data-accion="eliminar" data-id="${c.id}">Eliminar</button>
                    </td>
                </tr>
            `).join('');
        }

        document.getElementById('clientes-pagina-info').textContent =
            `Página ${data.pagina} de ${data.total_paginas} (${data.total} clientes)`;
        document.getElementById('clientes-anterior').disabled = data.pagina <= 1;
        document.getElementById('clientes-siguiente').disabled = data.pagina >= data.total_paginas;
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="vacio">Error al cargar los clientes</td></tr>';
    }
}

function abrirModalCliente(cliente = null) {
    estadoClientes.editandoId = cliente ? cliente.id : null;

    document.getElementById('modal-cliente-titulo').textContent =
        cliente ? 'Editar cliente' : 'Nuevo cliente';
    document.getElementById('cliente-nombre').value = cliente?.nombre || '';
    document.getElementById('cliente-dni').value = cliente?.dni || '';
    document.getElementById('cliente-telefono').value = cliente?.telefono || '';
    document.getElementById('cliente-direccion').value = cliente?.direccion || '';
    document.getElementById('cliente-notas').value = cliente?.notas || '';

    const error = document.getElementById('cliente-error');
    error.classList.add('hidden');
    error.textContent = '';

    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('cliente-nombre').focus();
}

function cerrarModalCliente() {
    document.getElementById('modal-cliente').classList.add('hidden');
    estadoClientes.editandoId = null;
}

async function guardarCliente(evento) {
    evento.preventDefault();

    const cuerpo = {
        nombre: document.getElementById('cliente-nombre').value,
        dni: document.getElementById('cliente-dni').value,
        telefono: document.getElementById('cliente-telefono').value,
        direccion: document.getElementById('cliente-direccion').value,
        notas: document.getElementById('cliente-notas').value
    };

    const editando = estadoClientes.editandoId !== null;
    const url = editando ? `/api/clientes/${estadoClientes.editandoId}` : '/api/clientes';

    try {
        const res = await fetch(url, {
            method: editando ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        const data = await res.json();

        if (!res.ok) {
            const error = document.getElementById('cliente-error');
            error.textContent = data.error || 'No se pudo guardar el cliente';
            error.classList.remove('hidden');
            return;
        }

        cerrarModalCliente();
        cargarClientes();
    } catch (error) {
        const msg = document.getElementById('cliente-error');
        msg.textContent = 'Error de conexión con el servidor';
        msg.classList.remove('hidden');
    }
}

async function eliminarCliente(id) {
    const cliente = estadoClientes.lista.find(c => c.id === id);
    if (!cliente) return;

    if (!confirm(`¿Eliminar a ${cliente.nombre}? Se quita de la lista de clientes.`)) return;

    try {
        const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');

        // Si era el único de la página, volver a la anterior
        if (estadoClientes.lista.length === 1 && estadoClientes.pagina > 1) {
            estadoClientes.pagina--;
        }
        cargarClientes();
    } catch (error) {
        alert('No se pudo eliminar el cliente');
    }
}

// Eventos de clientes
document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirModalCliente());
document.getElementById('btn-cancelar-cliente').addEventListener('click', cerrarModalCliente);
document.getElementById('form-cliente').addEventListener('submit', guardarCliente);

document.getElementById('modal-cliente').addEventListener('click', (e) => {
    if (e.target.id === 'modal-cliente') cerrarModalCliente();
});

document.getElementById('tabla-clientes').addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;

    const id = parseInt(boton.dataset.id, 10);
    if (boton.dataset.accion === 'editar') {
        const cliente = estadoClientes.lista.find(c => c.id === id);
        if (cliente) abrirModalCliente(cliente);
    } else if (boton.dataset.accion === 'eliminar') {
        eliminarCliente(id);
    }
});

document.getElementById('clientes-anterior').addEventListener('click', () => {
    if (estadoClientes.pagina > 1) {
        estadoClientes.pagina--;
        cargarClientes();
    }
});

document.getElementById('clientes-siguiente').addEventListener('click', () => {
    estadoClientes.pagina++;
    cargarClientes();
});

let temporizadorBusquedaClientes;
document.getElementById('busqueda-clientes').addEventListener('input', (e) => {
    clearTimeout(temporizadorBusquedaClientes);
    temporizadorBusquedaClientes = setTimeout(() => {
        estadoClientes.busqueda = e.target.value.trim();
        estadoClientes.pagina = 1;
        cargarClientes();
    }, 300);
});



// ============================================================
// VENTAS
// ============================================================
const estadoVentas = {
    pagina: 1,
    limite: 10,
    desde: '',
    hasta: '',
    estado: '',
    lista: []
};

const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

function dinero(numero) {
    return formatoMoneda.format(Number(numero) || 0);
}

// Recibe 'YYYY-MM-DD' y devuelve 'DD/MM/YYYY' (sin pasar por Date, para evitar líos de zona horaria)
function formatearFecha(iso) {
    if (!iso) return '-';
    const [anio, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${anio}`;
}

// Fecha de hoy en hora local (toISOString usaría UTC y puede dar el día siguiente de noche)
function hoyLocal() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
}

async function cargarVentas() {
    const tbody = document.getElementById('tabla-ventas');
    const params = new URLSearchParams({
        pagina: estadoVentas.pagina,
        limite: estadoVentas.limite
    });
    if (estadoVentas.desde) params.set('desde', estadoVentas.desde);
    if (estadoVentas.hasta) params.set('hasta', estadoVentas.hasta);
    if (estadoVentas.estado) params.set('estado', estadoVentas.estado);

    try {
        const res = await fetch(`/api/ventas?${params}`);
        if (!res.ok) throw new Error('Error al cargar');
        const data = await res.json();

        estadoVentas.lista = data.ventas;

        if (data.ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="vacio">No hay ventas para mostrar</td></tr>';
        } else {
            tbody.innerHTML = data.ventas.map(v => {
                const anulada = v.estado === 'anulada';
                return `
                <tr class="${anulada ? 'fila-anulada' : ''}">
                    <td>${formatearFecha(v.fecha)}</td>
                    <td>${escaparHtml(v.cliente_nombre)}</td>
                    <td class="num">${dinero(v.total_venta)}</td>
                    <td class="num">${anulada ? '-' : dinero(v.saldo)}</td>
                    <td class="num">${dinero(v.ganancia)}</td>
                    <td><span class="badge ${v.estado}">${anulada ? 'Anulada' : 'Activa'}</span></td>
                    <td class="acciones">
                        <button class="btn-link" data-accion="ver" data-id="${v.id}">Ver</button>
                        ${anulada ? '' : `<button class="btn-link peligro" data-accion="anular" data-id="${v.id}">Anular</button>`}
                    </td>
                </tr>`;
            }).join('');
        }

        document.getElementById('ventas-pagina-info').textContent =
            `Página ${data.pagina} de ${data.total_paginas} (${data.total} ventas)`;
        document.getElementById('ventas-anterior').disabled = data.pagina <= 1;
        document.getElementById('ventas-siguiente').disabled = data.pagina >= data.total_paginas;
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="vacio">Error al cargar las ventas</td></tr>';
    }
}

// ---------- Nueva venta ----------
function filaItemHtml() {
    return `
        <div class="item-fila">
            <input type="text" class="input item-descripcion" placeholder="Descripción" maxlength="200">
            <input type="number" class="input item-cantidad" min="1" step="1" value="1">
            <input type="number" class="input item-costo" min="0" step="0.01" placeholder="0">
            <input type="number" class="input item-precio" min="0" step="0.01" placeholder="0">
            <button type="button" class="btn-link peligro item-quitar">Quitar</button>
        </div>`;
}

function agregarItemVenta() {
    const contenedor = document.getElementById('venta-items');
    contenedor.insertAdjacentHTML('beforeend', filaItemHtml());
    const filas = contenedor.querySelectorAll('.item-fila');
    filas[filas.length - 1].querySelector('.item-descripcion').focus();
}

function recalcularTotalesVenta() {
    let costo = 0;
    let venta = 0;
    document.querySelectorAll('#venta-items .item-fila').forEach(fila => {
        const cantidad = parseFloat(fila.querySelector('.item-cantidad').value) || 0;
        const precioCosto = parseFloat(fila.querySelector('.item-costo').value) || 0;
        const precioCliente = parseFloat(fila.querySelector('.item-precio').value) || 0;
        costo += cantidad * precioCosto;
        venta += cantidad * precioCliente;
    });
    document.getElementById('venta-total-venta').textContent = dinero(venta);
    document.getElementById('venta-total-costo').textContent = dinero(costo);
    document.getElementById('venta-total-ganancia').textContent = dinero(venta - costo);

    // Vista previa de las cuotas
    const vista = document.getElementById('venta-vista-cuotas');
    const cuotas = parseInt(document.getElementById('venta-cuotas').value, 10) || 1;
    const totalCent = Math.round(venta * 100);
    if (totalCent <= 0 || cuotas < 1) {
        vista.textContent = '';
        return;
    }
    const base = Math.floor(totalCent / cuotas);
    const ultima = base + (totalCent - base * cuotas);
    if (cuotas === 1) {
        vista.textContent = `1 cuota de ${dinero(totalCent / 100)}`;
    } else if (ultima === base) {
        vista.textContent = `${cuotas} cuotas de ${dinero(base / 100)}`;
    } else {
        vista.textContent = `${cuotas - 1} cuotas de ${dinero(base / 100)} y una última de ${dinero(ultima / 100)}`;
    }
}

async function cargarOpcionesClientesVenta(busqueda = '') {
    const select = document.getElementById('venta-cliente');
    try {
        const params = new URLSearchParams({ limite: 20, busqueda });
        const res = await fetch(`/api/clientes?${params}`);
        if (!res.ok) throw new Error('Error al cargar clientes');
        const data = await res.json();

        select.innerHTML = data.clientes.length
            ? data.clientes.map(c =>
                `<option value="${c.id}">${escaparHtml(c.nombre)}${c.dni ? ' - ' + escaparHtml(c.dni) : ''}</option>`
            ).join('')
            : '<option value="">Sin resultados</option>';
    } catch (error) {
        select.innerHTML = '<option value="">Error al cargar clientes</option>';
    }
}

function abrirModalVenta() {
    document.getElementById('form-venta').reset();
    document.getElementById('venta-fecha').value = hoyLocal();
    document.getElementById('venta-primer-vencimiento').dataset.manual = 'false';
    sugerirPrimerVencimiento();
    document.getElementById('venta-items').innerHTML = '';
    agregarItemVenta();
    recalcularTotalesVenta();
    cargarOpcionesClientesVenta('');

    const error = document.getElementById('venta-error');
    error.classList.add('hidden');
    error.textContent = '';

    document.getElementById('modal-venta').classList.remove('hidden');
}

function cerrarModalVenta() {
    document.getElementById('modal-venta').classList.add('hidden');
}

function mostrarErrorVenta(mensaje) {
    const error = document.getElementById('venta-error');
    error.textContent = mensaje;
    error.classList.remove('hidden');
}

async function guardarVenta(evento) {
    evento.preventDefault();

    const items = [];
    document.querySelectorAll('#venta-items .item-fila').forEach(fila => {
        const descripcion = fila.querySelector('.item-descripcion').value.trim();
        const cantidad = fila.querySelector('.item-cantidad').value;
        const precioCosto = fila.querySelector('.item-costo').value;
        const precioCliente = fila.querySelector('.item-precio').value;

        // Las filas totalmente vacías se ignoran
        if (!descripcion && precioCliente === '' && precioCosto === '') return;

        items.push({
            descripcion,
            cantidad,
            precio_costo: precioCosto,
            precio_cliente: precioCliente
        });
    });

    const cuerpo = {
        cliente_id: document.getElementById('venta-cliente').value,
        fecha: document.getElementById('venta-fecha').value,
        observaciones: document.getElementById('venta-observaciones').value,
        frecuencia: document.getElementById('venta-frecuencia').value,
        cantidad_cuotas: document.getElementById('venta-cuotas').value,
        primer_vencimiento: document.getElementById('venta-primer-vencimiento').value,
        items
    };

    try {
        const res = await fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        const data = await res.json();

        if (!res.ok) {
            mostrarErrorVenta(data.error || 'No se pudo guardar la venta');
            return;
        }

        cerrarModalVenta();
        estadoVentas.pagina = 1;
        cargarVentas();
    } catch (error) {
        mostrarErrorVenta('Error de conexión con el servidor');
    }
}

// ---------- Detalle y anulación ----------
function etiquetaCuota(c) {
    if (c.estado === 'pagada') return 'Pagada';
    if (c.estado === 'vencida') return `Vencida (${c.dias_atraso} d)`;
    return 'Pendiente';
}

async function abrirDetalleVenta(id) {
    estadoVentas.detalleId = id;
    const cuerpo = document.getElementById('detalle-venta-cuerpo');
    cuerpo.innerHTML = '<p class="vacio">Cargando...</p>';
    document.getElementById('modal-detalle-venta').classList.remove('hidden');

    try {
        const res = await fetch(`/api/ventas/${id}`);
        if (!res.ok) throw new Error('Error al cargar');
        const v = await res.json();
        const activa = v.estado === 'activa';

        const filasItems = v.items.map(item => `
            <tr>
                <td>${escaparHtml(item.descripcion)}</td>
                <td class="num">${item.cantidad}</td>
                <td class="num">${dinero(item.precio_costo)}</td>
                <td class="num">${dinero(item.precio_cliente)}</td>
                <td class="num">${dinero(item.cantidad * item.precio_cliente)}</td>
            </tr>
        `).join('');

        const filasCuotas = v.cuotas.map(c => `
            <tr>
                <td>${c.numero}</td>
                <td>${formatearFecha(c.vencimiento)}</td>
                <td class="num">${dinero(c.monto)}</td>
                <td class="num">${dinero(c.pagado)}</td>
                <td class="num">${dinero(c.saldo)}</td>
                <td><span class="badge ${c.estado}">${etiquetaCuota(c)}</span></td>
            </tr>
        `).join('');

        const filasPagos = v.pagos.length === 0
            ? '<tr><td colspan="5" class="vacio">Todavía no hay pagos registrados</td></tr>'
            : v.pagos.map(p => `
            <tr class="${p.anulado ? 'fila-anulada' : ''}">
                <td>${formatearFecha(p.fecha)}</td>
                <td class="num">${dinero(p.monto)}</td>
                <td>${escaparHtml(p.metodo)}</td>
                <td>${escaparHtml(p.observaciones || '')}</td>
                <td class="acciones">${p.anulado
                ? 'Anulado'
                : (activa ? `<button class="btn-link peligro" data-accion="anular-pago" data-id="${p.id}">Anular</button>` : '')}</td>
            </tr>
        `).join('');

        const proxima = v.cuotas.find(c => c.saldo > 0);
        const formularioPago = (activa && v.saldo > 0) ? `
            <form id="form-pago" class="form-pago" data-venta-id="${v.id}">
                <h4 class="subtitulo">Registrar pago</h4>
                <div class="fila-pago">
                    <label>Monto *
                        <input type="number" id="pago-monto" class="input" min="0.01" step="0.01"
                               value="${proxima ? proxima.saldo.toFixed(2) : ''}" required>
                    </label>
                    <label>Fecha
                        <input type="date" id="pago-fecha" class="input" value="${hoyLocal()}" required>
                    </label>
                    <label>Forma de pago
                        <select id="pago-metodo" class="input">
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="otro">Otro</option>
                        </select>
                    </label>
                    <label>Observaciones
                        <input type="text" id="pago-obs" class="input" maxlength="200">
                    </label>
                </div>
                <p id="pago-error" class="mensaje-error hidden"></p>
                <button type="submit" class="btn">Registrar pago</button>
            </form>` : '';

        cuerpo.innerHTML = `
            <div class="detalle-grid">
                <div><span class="etiqueta">Cliente</span>${escaparHtml(v.cliente_nombre)}</div>
                <div><span class="etiqueta">Fecha</span>${formatearFecha(v.fecha)}</div>
                <div><span class="etiqueta">Teléfono</span>${escaparHtml(v.cliente_telefono || '-')}</div>
                <div><span class="etiqueta">Estado</span><span class="badge ${v.estado}">${activa ? 'Activa' : 'Anulada'}</span></div>
            </div>
            ${v.observaciones ? `<p class="detalle-obs">${escaparHtml(v.observaciones)}</p>` : ''}
            <div class="tabla-contenedor">
                <table class="tabla">
                    <thead>
                    <tr>
                        <th>Descripción</th>
                        <th class="num">Cant.</th>
                        <th class="num">Costo</th>
                        <th class="num">Precio</th>
                        <th class="num">Subtotal</th>
                    </tr>
                    </thead>
                    <tbody>${filasItems}</tbody>
                </table>
            </div>
            <div class="venta-totales">
                <div><span class="etiqueta">Total vendido</span><strong>${dinero(v.total_venta)}</strong></div>
                <div><span class="etiqueta">Costo</span><strong>${dinero(v.total_costo)}</strong></div>
                <div><span class="etiqueta">Ganancia</span><strong>${dinero(v.ganancia)}</strong></div>
            </div>
            <div class="venta-totales venta-cobranza">
                <div><span class="etiqueta">Pagado</span><strong>${dinero(v.total_pagado)}</strong></div>
                <div><span class="etiqueta">Saldo</span><strong>${activa ? dinero(v.saldo) : '-'}</strong></div>
                <div><span class="etiqueta">Atraso</span><strong>${!activa ? '-' : (v.dias_atraso > 0 ? `${v.dias_atraso} días` : 'Al día')}</strong></div>
            </div>

            <h4 class="subtitulo">Cuotas (${v.cuotas_pagadas} de ${v.cuotas.length} pagadas, ${v.frecuencia})</h4>
            <div class="tabla-contenedor">
                <table class="tabla">
                    <thead>
                    <tr>
                        <th>N°</th>
                        <th>Vencimiento</th>
                        <th class="num">Monto</th>
                        <th class="num">Pagado</th>
                        <th class="num">Saldo</th>
                        <th>Estado</th>
                    </tr>
                    </thead>
                    <tbody>${filasCuotas}</tbody>
                </table>
            </div>

            <h4 class="subtitulo">Pagos</h4>
            <div class="tabla-contenedor">
                <table class="tabla">
                    <thead>
                    <tr>
                        <th>Fecha</th>
                        <th class="num">Monto</th>
                        <th>Forma</th>
                        <th>Observaciones</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>${filasPagos}</tbody>
                </table>
            </div>
            ${formularioPago}
        `;
    } catch (error) {
        cuerpo.innerHTML = '<p class="vacio">No se pudo cargar la venta</p>';
    }
}

async function anularVenta(id) {
    const venta = estadoVentas.lista.find(v => v.id === id);
    if (!venta) return;

    if (!confirm(`¿Anular la venta de ${venta.cliente_nombre} por ${dinero(venta.total_venta)}? No se puede deshacer.`)) return;

    try {
        const res = await fetch(`/api/ventas/${id}/anular`, { method: 'PATCH' });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'No se pudo anular la venta');
            return;
        }
        cargarVentas();
    } catch (error) {
        alert('No se pudo anular la venta');
    }
}

// Eventos de ventas
document.getElementById('btn-nueva-venta').addEventListener('click', abrirModalVenta);
document.getElementById('btn-cancelar-venta').addEventListener('click', cerrarModalVenta);
document.getElementById('form-venta').addEventListener('submit', guardarVenta);
document.getElementById('btn-agregar-item').addEventListener('click', agregarItemVenta);

document.getElementById('modal-venta').addEventListener('click', (e) => {
    if (e.target.id === 'modal-venta') cerrarModalVenta();
});

document.getElementById('venta-items').addEventListener('input', recalcularTotalesVenta);
document.getElementById('venta-items').addEventListener('click', (e) => {
    if (!e.target.classList.contains('item-quitar')) return;
    const filas = document.querySelectorAll('#venta-items .item-fila');
    if (filas.length <= 1) return; // siempre queda al menos una fila
    e.target.closest('.item-fila').remove();
    recalcularTotalesVenta();
});

let temporizadorBusquedaClienteVenta;
document.getElementById('venta-busqueda-cliente').addEventListener('input', (e) => {
    clearTimeout(temporizadorBusquedaClienteVenta);
    temporizadorBusquedaClienteVenta = setTimeout(() => {
        cargarOpcionesClientesVenta(e.target.value.trim());
    }, 300);
});

document.getElementById('btn-cerrar-detalle-venta').addEventListener('click', () => {
    document.getElementById('modal-detalle-venta').classList.add('hidden');
});
document.getElementById('modal-detalle-venta').addEventListener('click', (e) => {
    if (e.target.id === 'modal-detalle-venta') e.target.classList.add('hidden');
});

document.getElementById('tabla-ventas').addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;

    const id = parseInt(boton.dataset.id, 10);
    if (boton.dataset.accion === 'ver') abrirDetalleVenta(id);
    else if (boton.dataset.accion === 'anular') anularVenta(id);
});

document.getElementById('ventas-anterior').addEventListener('click', () => {
    if (estadoVentas.pagina > 1) {
        estadoVentas.pagina--;
        cargarVentas();
    }
});

document.getElementById('ventas-siguiente').addEventListener('click', () => {
    estadoVentas.pagina++;
    cargarVentas();
});

function aplicarFiltrosVentas() {
    estadoVentas.desde = document.getElementById('filtro-ventas-desde').value;
    estadoVentas.hasta = document.getElementById('filtro-ventas-hasta').value;
    estadoVentas.estado = document.getElementById('filtro-ventas-estado').value;
    estadoVentas.pagina = 1;
    cargarVentas();
}

['filtro-ventas-desde', 'filtro-ventas-hasta', 'filtro-ventas-estado'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltrosVentas);
});

document.getElementById('btn-limpiar-filtros-ventas').addEventListener('click', () => {
    document.getElementById('filtro-ventas-desde').value = '';
    document.getElementById('filtro-ventas-hasta').value = '';
    document.getElementById('filtro-ventas-estado').value = '';
    aplicarFiltrosVentas();
});

// ============================================================
// CUOTAS Y PAGOS
// ============================================================
function sumarDiasIso(iso, dias) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function sumarMesesIso(iso, meses) {
    const [a, m, d] = iso.split('-').map(Number);
    const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
    const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
    destino.setUTCDate(Math.min(d, ultimoDia));
    return destino.toISOString().slice(0, 10);
}

// Propone el primer vencimiento un período después de la venta (si no lo tocaste a mano)
function sugerirPrimerVencimiento() {
    const campo = document.getElementById('venta-primer-vencimiento');
    if (campo.dataset.manual === 'true') return;

    const fecha = document.getElementById('venta-fecha').value || hoyLocal();
    const frecuencia = document.getElementById('venta-frecuencia').value;

    if (frecuencia === 'semanal') campo.value = sumarDiasIso(fecha, 7);
    else if (frecuencia === 'quincenal') campo.value = sumarDiasIso(fecha, 15);
    else campo.value = sumarMesesIso(fecha, 1);
}

async function registrarPago(evento) {
    evento.preventDefault();
    const form = evento.target;
    const error = document.getElementById('pago-error');
    error.classList.add('hidden');

    const cuerpo = {
        venta_id: form.dataset.ventaId,
        monto: document.getElementById('pago-monto').value,
        fecha: document.getElementById('pago-fecha').value,
        metodo: document.getElementById('pago-metodo').value,
        observaciones: document.getElementById('pago-obs').value
    };

    try {
        const res = await fetch('/api/pagos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        const data = await res.json();

        if (!res.ok) {
            error.textContent = data.error || 'No se pudo registrar el pago';
            error.classList.remove('hidden');
            return;
        }

        abrirDetalleVenta(estadoVentas.detalleId);
        cargarVentas();
    } catch (e) {
        error.textContent = 'Error de conexión con el servidor';
        error.classList.remove('hidden');
    }
}

async function anularPago(id) {
    if (!confirm('¿Anular este pago? El saldo de la venta vuelve a subir.')) return;

    try {
        const res = await fetch(`/api/pagos/${id}/anular`, { method: 'PATCH' });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'No se pudo anular el pago');
            return;
        }
        abrirDetalleVenta(estadoVentas.detalleId);
        cargarVentas();
    } catch (error) {
        alert('No se pudo anular el pago');
    }
}

// Eventos del plan de pago (modal de nueva venta)
document.getElementById('venta-fecha').addEventListener('change', sugerirPrimerVencimiento);
document.getElementById('venta-frecuencia').addEventListener('change', () => {
    sugerirPrimerVencimiento();
    recalcularTotalesVenta();
});
document.getElementById('venta-cuotas').addEventListener('input', recalcularTotalesVenta);
document.getElementById('venta-primer-vencimiento').addEventListener('input', (e) => {
    e.target.dataset.manual = 'true';
});

// Eventos del detalle de venta (pagos)
document.getElementById('detalle-venta-cuerpo').addEventListener('submit', (e) => {
    if (e.target.id === 'form-pago') registrarPago(e);
});
document.getElementById('detalle-venta-cuerpo').addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion="anular-pago"]');
    if (boton) anularPago(parseInt(boton.dataset.id, 10));
});