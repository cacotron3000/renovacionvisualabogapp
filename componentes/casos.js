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

let filtroCasos = '';

function poblarClientesCaso() {
  if (!casoClienteId) return;
  const clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
  casoClienteId.innerHTML = '<option value="">Seleccionar cliente</option>';
  clientes.sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es')).forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    casoClienteId.appendChild(opt);
  });
}

function alternarCamposCaso() {
  const tipo = casoTipo?.value || 'judicial';
  if (camposJudiciales) camposJudiciales.classList.toggle('oculto', tipo !== 'judicial');
  if (camposNoJudiciales) camposNoJudiciales.classList.toggle('oculto', tipo === 'judicial');
}

function cargarCasos() {
  if (!casosLista) return;
  const casos = JSON.parse(localStorage.getItem('casos') || '[]');
  const clientes = JSON.parse(localStorage.getItem('clientes') || '[]');
  const filtrados = casos.filter((c) => {
    const txt = `${c.titulo || ''} ${c.tipo || ''} ${c.estado || ''}`.toLowerCase();
    return txt.includes(filtroCasos.toLowerCase());
  });
  casosLista.innerHTML = filtrados.length ? filtrados.map((c) => {
    const cliente = clientes.find((x) => Number(x.id) === Number(c.clienteId));
    const extra = c.tipo === 'judicial'
      ? `Tribunal: ${c.tribunal || '-'} · RIT/Rol: ${c.ritRol || '-'} · Próx. audiencia: ${c.proximaAudiencia || '-'}`
      : `Área: ${c.area || '-'} · Contraparte: ${c.contraparte || '-'} · Próx. hito: ${c.fechaHito || '-'}`;
    return `<div class="element-card"><strong>${c.titulo}</strong><br><small>Cliente: ${cliente?.nombre || '-'} · Tipo: ${c.tipo} · Estado: ${c.estado}</small><br><small>${extra}</small><br><small>${c.descripcion || ''}</small></div>`;
  }).join('') : '<p>No hay casos registrados.</p>';
}

abrirCasoFormBtn?.addEventListener('click', () => {
  poblarClientesCaso();
  alternarCamposCaso();
  casoForm?.reset();
  modalCasoFormulario?.classList.remove('oculto');
});

cerrarCasoFormBtn?.addEventListener('click', () => modalCasoFormulario?.classList.add('oculto'));
modalCasoFormulario?.addEventListener('click', (e) => {
  if (e.target?.id === 'modalCasoFormulario') modalCasoFormulario.classList.add('oculto');
});

casoTipo?.addEventListener('change', alternarCamposCaso);
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
    descripcion: document.getElementById('casoDescripcion')?.value.trim(),
    tribunal: document.getElementById('casoTribunal')?.value.trim(),
    ritRol: document.getElementById('casoRitRol')?.value.trim(),
    proximaAudiencia: document.getElementById('casoProximaAudiencia')?.value || '',
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
cargarCasos();
