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

let filtroCasos = '';
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

  casosLista.querySelectorAll('.caso-item').forEach((card) => {
    card.addEventListener('click', () => abrirDetalleCaso(Number(card.dataset.id)));
  });
}

function abrirDetalleCaso(id) {
  const casos = JSON.parse(localStorage.getItem('casos') || '[]');
  const clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
  const caso = casos.find((x) => Number(x.id) === Number(id));
  if (!caso || !window.abrirQuickPanel) return;
  const cliente = clientes.find((c) => Number(c.id) === Number(caso.clienteId));
  const html = `
    <div class="quick-form">
      <label>Título</label><input id="qpCasoTitulo" value="${caso.titulo || ''}" />
      <label>Tipo</label><input value="${caso.tipo || '-'}" disabled />
      <label>Materia</label><input id="qpCasoMateria" value="${caso.materia || ''}" />
      <label>Estado</label><input id="qpCasoEstado" value="${caso.estado || ''}" />
      <label>RIT/Rol</label><input id="qpCasoRitRol" value="${caso.ritRol || ''}" />
      <label>Tribunal</label><input id="qpCasoTribunal" value="${caso.tribunal || ''}" />
      <label>Etapa actual</label><input id="qpCasoEtapa" value="${caso.etapaActual || ''}" />
      <label>Responsable</label><input id="qpCasoResponsable" value="${caso.responsable || ''}" />
      <label>Fecha inicio</label><input type="date" id="qpCasoInicio" value="${caso.fechaInicio || ''}" />
      <label>Última gestión</label><input type="date" id="qpCasoUltima" value="${caso.ultimaGestion || ''}" />
      <label>Próxima audiencia</label><input type="date" id="qpCasoAudiencia" value="${caso.proximaAudiencia || ''}" />
      <label>Área (no judicial)</label><input id="qpCasoArea" value="${caso.area || ''}" />
      <label>Contraparte</label><input id="qpCasoContraparte" value="${caso.contraparte || ''}" />
      <label>Fecha hito</label><input type="date" id="qpCasoHito" value="${caso.fechaHito || ''}" />
      <label>Cliente asociado</label><input value="${cliente?.nombre || '-'}" disabled />
      <label>Descripción</label><textarea id="qpCasoDescripcion">${caso.descripcion || ''}</textarea>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="boton" id="qpGuardarCasoBtn">Guardar cambios</button>
        <button class="boton" id="qpEliminarCasoBtn" style="background:#b91c1c;">Eliminar caso</button>
      </div>
    </div>
  `;
  window.abrirQuickPanel(`Caso: ${caso.titulo}`, html);
  const btn = document.getElementById('qpGuardarCasoBtn');
  btn?.addEventListener('click', async () => {
    caso.titulo = document.getElementById('qpCasoTitulo')?.value.trim() || caso.titulo;
    caso.estado = document.getElementById('qpCasoEstado')?.value.trim() || caso.estado;
    caso.materia = document.getElementById('qpCasoMateria')?.value.trim() || '';
    caso.ritRol = document.getElementById('qpCasoRitRol')?.value.trim() || '';
    caso.tribunal = document.getElementById('qpCasoTribunal')?.value.trim() || '';
    caso.etapaActual = document.getElementById('qpCasoEtapa')?.value.trim() || '';
    caso.responsable = document.getElementById('qpCasoResponsable')?.value.trim() || '';
    caso.fechaInicio = document.getElementById('qpCasoInicio')?.value || '';
    caso.ultimaGestion = document.getElementById('qpCasoUltima')?.value || '';
    caso.proximaAudiencia = document.getElementById('qpCasoAudiencia')?.value || '';
    caso.area = document.getElementById('qpCasoArea')?.value.trim() || '';
    caso.contraparte = document.getElementById('qpCasoContraparte')?.value.trim() || '';
    caso.fechaHito = document.getElementById('qpCasoHito')?.value || '';
    caso.descripcion = document.getElementById('qpCasoDescripcion')?.value.trim() || '';
    const actualizados = casos.map((x) => (Number(x.id) === Number(caso.id) ? caso : x));
    localStorage.setItem('casos', JSON.stringify(actualizados));
    if (window.supabaseSync?.pushRegistro) await window.supabaseSync.pushRegistro('casos', caso);
    cargarCasos();
  });
  document.getElementById('qpEliminarCasoBtn')?.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este caso?')) return;
    const restantes = casos.filter((x) => Number(x.id) !== Number(caso.id));
    localStorage.setItem('casos', JSON.stringify(restantes));
    if (window.supabaseSync?.deleteRegistro) await window.supabaseSync.deleteRegistro('casos', caso.id);
    window.cerrarQuickPanel?.();
    cargarCasos();
  });
}

abrirCasoFormBtn?.addEventListener('click', () => {
  poblarClientesCaso();
  casoForm?.reset();
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
    responsable: document.getElementById('casoResponsable')?.value.trim(),
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

  const casos = JSON.parse(localStorage.getItem('casos') || '[]');
  casos.push(nuevo);
  localStorage.setItem('casos', JSON.stringify(casos));
  if (window.supabaseSync?.pushRegistro) await window.supabaseSync.pushRegistro('casos', nuevo);

  modalCasoFormulario?.classList.add('oculto');
  cargarCasos();
});

window.cargarCasos = cargarCasos;
window.abrirDetalleCaso = abrirDetalleCaso;
alternarCamposCaso();
alternarBloqueEtapasJudiciales();
cargarCasos();
