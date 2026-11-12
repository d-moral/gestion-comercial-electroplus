
function mostrarPanel(nombre) {
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === nombre);
    });
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${nombre}`);
    });

    if (nombre === 'clientes') cargarClientes();
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