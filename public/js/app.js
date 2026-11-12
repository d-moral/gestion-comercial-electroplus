// Navegación entre paneles de la barra lateral
function mostrarPanel(nombre) {
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === nombre);
    });
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${nombre}`);
    });
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