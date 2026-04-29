// === casos.js ===
const casosLista = document.getElementById('casosLista');
const buscarCasos = document.getElementById('buscarCasos');
const abrirCasoFormBtn = document.getElementById('abrirCasoFormBtn');
const modalCasoFormulario = document.getElementById('modalCasoFormulario');
const cerrarCasoFormBtn = document.getElementById('cerrarCasoFormBtn');
const casoForm = document.getElementById('casoForm');
const casoClienteId = document.getElementById('casoClienteId');
const casoTipo = document.getElementById('casoTipo');
const camposJudiciales = document.getElementById('camposJudiciales');
const camposNoJudiciales = document.getElementById('camposNoJudiciales');
const campoTribunal = document.getElementById('casoTribunal');
const campoRitRol = document.getElementById('casoRitRol');
const campoProximaAudiencia = document.getElementById('casoProximaAudiencia');
const campoArea = document.getElementById('casoArea');
const campoContraparte = document.getElementById('casoContraparte');
const campoFechaHito = document.getElementById('casoFechaHito');
const casoMateria = document.getElementById('casoMateria');
const bloqueEtapasJudiciales = document.getElementById('bloqueEtapasJudiciales');
const casoEtapaActual = document.getElementById('casoEtapaActual');
const casoTimeline = document.getElementById('casoTimeline');
const eliminarCasoBtn = document.getElementById('eliminarCasoBtn');
const guardarCasoBtn = document.getElementById('guardarCasoBtn');

let filtroCasos = '';
let casoEditandoId = null;
const ETAPAS_FAMILIA_LABORAL = [
  'Elaboración demanda',
  'Presentación demanda',
  'Contestación demanda',
  'Audiencia preparatoria',
  'Audiencia de juicio',
  'Sentencia',
  'Recursos',
];

function poblarClientesCaso() {
  if (!casoClienteId) return;
  const clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
  casoClienteId.innerHTML = '<option value="">Seleccionar cliente</option>';
  clientes
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'))
    .forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      casoClienteId.appendChild(opt);
    });
}

async function poblarResponsablesCaso() {
  const sel = document.getElementById('casoResponsable');
  if (!sel) return;
  let opciones = [];
  if (window.supabaseAuth?.fetchUsers) {
    try {
      const users = await window.supabaseAuth.fetchUsers();
      opciones = users.map((u) => u.nombre).filter(Boolean);
    } catch (_) {}
  }
  if (!opciones.length) {
    const tareas = JSON.parse(localStorage.getItem('tareasDia') || '[]');
    const internas = JSON.parse(localStorage.getItem('tareasInternas') || '[]');
    opciones = [...new Set([...tareas.flatMap((t) => t.asignadosA || []), ...internas.flatMap((t) => t.asignadosA || [])].filter(Boolean))];
  }
  sel.innerHTML = `<option value="">Sin asignar</option>${opciones.map((n) => `<option value="${n}">${n}</option>`).join('')}`;
}

function alternarCamposCaso() {
  const tipo = casoTipo?.value || 'judicial';
  const esJudicial = tipo === 'judicial';
  if (camposJudiciales) camposJudiciales.classList.toggle('oculto', !esJudicial);
  if (camposNoJudiciales) camposNoJudiciales.classList.toggle('oculto', esJudicial);

  if (campoTribunal) campoTribunal.required = esJudicial;
  if (campoRitRol) campoRitRol.required = esJudicial;
  if (campoProximaAudiencia) campoProximaAudiencia.required = false;
  if (casoMateria) casoMateria.required = esJudicial;
  if (campoArea) campoArea.required = !esJudicial;

  if (esJudicial) {
    if (campoArea) campoArea.value = '';
    if (campoContraparte) campoContraparte.value = '';
    if (campoFechaHito) campoFechaHito.value = '';
  } else {
    if (campoTribunal) campoTribunal.value = '';
    if (campoRitRol) campoRitRol.value = '';
    if (campoProximaAudiencia) campoProximaAudiencia.value = '';
  }
  alternarBloqueEtapasJudiciales();
}

function renderTimeline(etapaSeleccionada = '') {
  if (!casoTimeline) return;
  const idx = ETAPAS_FAMILIA_LABORAL.indexOf(etapaSeleccionada);
  casoTimeline.innerHTML = ETAPAS_FAMILIA_LABORAL.map((etapa, i) => {
    const estado = idx >= i ? 'completada' : 'pendiente';
    const icono = idx > i ? '✅' : idx === i ? '🟢' : '⚪';
    return `<div class="timeline-item ${estado}">${icono} ${etapa}</div>`;
  }).join('');
}

function alternarBloqueEtapasJudiciales() {
  const mat = casoMateria?.value || '';
  const aplica = mat === 'familia' || mat === 'laboral';
  if (bloqueEtapasJudiciales) bloqueEtapasJudiciales.classList.toggle('oculto', !aplica);
  if (!casoEtapaActual) return;
  if (!aplica) {
    casoEtapaActual.value = '';
    if (casoTimeline) casoTimeline.innerHTML = '';
    return;
  }
  renderTimeline(casoEtapaActual.value || '');
}

function badgeTipo(tipo) {
  return tipo === 'judicial' ? '⚖️ Judicial' : '🧾 No judicial';
}

function cargarCasos() {
  if (!casosLista) return;
  const casos = JSON.parse(localStorage.getItem('casos') || '[]');
  const clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
  const filtrados = casos.filter((c) => {
    const txt = `${c.titulo || ''} ${c.tipo || ''} ${c.estado || ''} ${c.responsable || ''}`.toLowerCase();
    return txt.includes(filtroCasos.toLowerCase());
  });

  casosLista.innerHTML = filtrados.length
    ? filtrados
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map((c) => {
          const cliente = clientes.find((x) => Number(x.id) === Number(c.clienteId));
          const resumen = c.tipo === 'judicial'
            ? `RIT/Rol: ${c.ritRol || '-'} · Tribunal: ${c.tribunal || '-'}`
            : `Área: ${c.area || '-'} · Contraparte: ${c.contraparte || '-'}`;
          const idx = ETAPAS_FAMILIA_LABORAL.indexOf(c.etapaActual || '');
          const timeline = c.tipo === 'judicial' && (c.materia === 'familia' || c.materia === 'laboral')
            ? `<div class="timeline-caso">${ETAPAS_FAMILIA_LABORAL.map((e, i) => `<span class="timeline-item ${idx >= i ? 'completada' : 'pendiente'}">${idx > i ? '✅' : idx === i ? '🟢' : '⚪'} ${e}</span>`).join('')}</div>`
            : '';
          return `<div class="element-card caso-item" data-id="${c.id}"><strong>${c.titulo} (${cliente?.nombre || '-'})</strong><br><small>${resumen}</small>${timeline}</div>`;
        })
        .join('')
    : '<p>No hay casos registrados.</p>';

  casosLista.querySelectorAll('.caso-item').forEach((card) => card.addEventListener('click', () => abrirCasoEnFormulario(Number(card.dataset.id))));
}

async function abrirCasoEnFormulario(id) {
  const casos = JSON.parse(localStorage.getItem('casos') || '[]');
  const caso = casos.find((x) => Number(x.id) === Number(id));
  if (!caso) return;
  await poblarClientesCaso();
  await poblarResponsablesCaso();
  casoEditandoId = caso.id;
  if (guardarCasoBtn) guardarCasoBtn.textContent = 'Guardar cambios';
  eliminarCasoBtn?.classList.remove('oculto');
  document.getElementById('casoClienteId').value = String(caso.clienteId || '');
  document.getElementById('casoTitulo').value = caso.titulo || '';
  document.getElementById('casoTipo').value = caso.tipo || 'judicial';
  document.getElementById('casoEstado').value = caso.estado || 'abierto';
  document.getElementById('casoResponsable').value = caso.responsable || '';
  document.getElementById('casoFechaInicio').value = caso.fechaInicio || '';
  document.getElementById('casoPrioridad').value = caso.prioridad || 'media';
  document.getElementById('casoHonorarios').value = caso.honorarios || '';
  document.getElementById('casoUltimaGestion').value = caso.ultimaGestion || '';
  document.getElementById('casoDescripcion').value = caso.descripcion || '';
  document.getElementById('casoTribunal').value = caso.tribunal || '';
  document.getElementById('casoMateria').value = caso.materia || '';
  document.getElementById('casoRitRol').value = caso.ritRol || '';
  document.getElementById('casoProximaAudiencia').value = caso.proximaAudiencia || '';
  document.getElementById('casoEtapaActual').value = caso.etapaActual || '';
  document.getElementById('casoArea').value = caso.area || '';
  document.getElementById('casoContraparte').value = caso.contraparte || '';
  document.getElementById('casoFechaHito').value = caso.fechaHito || '';
  alternarCamposCaso();
  renderTimeline(caso.etapaActual || '');
  modalCasoFormulario?.classList.remove('oculto');
}

abrirCasoFormBtn?.addEventListener('click', () => {
  casoEditandoId = null;
  poblarClientesCaso();
  poblarResponsablesCaso();
  casoForm?.reset();
  if (guardarCasoBtn) guardarCasoBtn.textContent = 'Guardar caso';
  eliminarCasoBtn?.classList.add('oculto');
  alternarCamposCaso();
  modalCasoFormulario?.classList.remove('oculto');
});

cerrarCasoFormBtn?.addEventListener('click', () => modalCasoFormulario?.classList.add('oculto'));
modalCasoFormulario?.addEventListener('click', (e) => {
  if (e.target?.id === 'modalCasoFormulario') modalCasoFormulario.classList.add('oculto');
});

casoTipo?.addEventListener('change', alternarCamposCaso);
casoMateria?.addEventListener('change', alternarBloqueEtapasJudiciales);
casoEtapaActual?.addEventListener('change', (e) => renderTimeline(e.target.value || ''));
buscarCasos?.addEventListener('input', (e) => {
  filtroCasos = e.target.value || '';
  cargarCasos();
});

casoForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nuevo = {
    id: Date.now(),
    clienteId: Number(document.getElementById('casoClienteId')?.value || 0),
    titulo: document.getElementById('casoTitulo')?.value.trim(),
    tipo: document.getElementById('casoTipo')?.value || 'judicial',
    estado: document.getElementById('casoEstado')?.value || 'abierto',
    responsable: document.getElementById('casoResponsable')?.value || '',
    fechaInicio: document.getElementById('casoFechaInicio')?.value || '',
    prioridad: document.getElementById('casoPrioridad')?.value || 'media',
    honorarios: Number(document.getElementById('casoHonorarios')?.value || 0),
    ultimaGestion: document.getElementById('casoUltimaGestion')?.value || '',
    descripcion: document.getElementById('casoDescripcion')?.value.trim(),
    tribunal: document.getElementById('casoTribunal')?.value.trim(),
    materia: document.getElementById('casoMateria')?.value || '',
    ritRol: document.getElementById('casoRitRol')?.value.trim(),
    proximaAudiencia: document.getElementById('casoProximaAudiencia')?.value || '',
    etapaActual: document.getElementById('casoEtapaActual')?.value || '',
    area: document.getElementById('casoArea')?.value.trim(),
    contraparte: document.getElementById('casoContraparte')?.value.trim(),
    fechaHito: document.getElementById('casoFechaHito')?.value || '',
    created_at: new Date().toISOString(),
  };

  if (!nuevo.clienteId || !nuevo.titulo) return;

  let casos = JSON.parse(localStorage.getItem('casos') || '[]');
  if (casoEditandoId) {
    nuevo.id = casoEditandoId;
    nuevo.created_at = casos.find((c) => Number(c.id) === Number(casoEditandoId))?.created_at || nuevo.created_at;
    casos = casos.map((c) => (Number(c.id) === Number(casoEditandoId) ? nuevo : c));
  } else {
    casos.push(nuevo);
  }
  localStorage.setItem('casos', JSON.stringify(casos));
  if (window.supabaseSync?.pushRegistro) await window.supabaseSync.pushRegistro('casos', nuevo);

  modalCasoFormulario?.classList.add('oculto');
  casoEditandoId = null;
  if (guardarCasoBtn) guardarCasoBtn.textContent = 'Guardar caso';
  eliminarCasoBtn?.classList.add('oculto');
  cargarCasos();
});

eliminarCasoBtn?.addEventListener('click', async () => {
  if (!casoEditandoId || !confirm('¿Eliminar este caso?')) return;
  const casos = JSON.parse(localStorage.getItem('casos') || '[]').filter((c) => Number(c.id) !== Number(casoEditandoId));
  localStorage.setItem('casos', JSON.stringify(casos));
  if (window.supabaseSync?.deleteRegistro) await window.supabaseSync.deleteRegistro('casos', casoEditandoId);
  modalCasoFormulario?.classList.add('oculto');
  casoEditandoId = null;
  if (guardarCasoBtn) guardarCasoBtn.textContent = 'Guardar caso';
  eliminarCasoBtn?.classList.add('oculto');
  cargarCasos();
});

window.cargarCasos = cargarCasos;
window.abrirDetalleCaso = abrirCasoEnFormulario;
alternarCamposCaso();
alternarBloqueEtapasJudiciales();
cargarCasos();
