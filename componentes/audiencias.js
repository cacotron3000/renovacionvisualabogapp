// === audiencias.js ===
// Gestión básica de audiencias: creación, listado y recordatorios de audiencias próximas

const audienciaForm = document.getElementById("audienciaForm");
const audienciasLista = document.getElementById("audienciasLista");
const audienciasListaDashboard = document.getElementById("audienciasListaDashboard");
const nuevaAudienciaBtn = document.getElementById("nuevaAudienciaBtn");
const modalAudiencia = document.getElementById("modalAudiencia");
const cerrarModalAudiencia = document.getElementById("cerrarModalAudiencia");
const modalAudienciasProximas = document.getElementById("modalAudienciasProximas");
const cerrarModalAudienciasProximas = document.getElementById("cerrarModalAudienciasProximas");
const listaAudienciasProximas = document.getElementById("listaAudienciasProximas");
const modalDetalleAudiencia = document.getElementById("modalDetalleAudiencia");
const cerrarModalDetalleAudiencia = document.getElementById("cerrarModalDetalleAudiencia");
const detalleAudienciaTitulo = document.getElementById("detalleAudienciaTitulo");
const detalleAudienciaTipo = document.getElementById("detalleAudienciaTipo");
const detalleAudienciaModalidad = document.getElementById("detalleAudienciaModalidad");
const detalleAudienciaFechaHora = document.getElementById("detalleAudienciaFechaHora");
const detalleAudienciaNotas = document.getElementById("detalleAudienciaNotas");
const editarAudienciaBtn = document.getElementById("editarAudienciaBtn");
const audienciasArchivadasDiv = document.getElementById("audienciasArchivadas");
const toggleAudienciasArchivadasBtn = document.getElementById("toggleAudienciasArchivadas");

function obtenerAudienciasArchivadas() {
  return JSON.parse(localStorage.getItem("audienciasArchivadas")) || [];
}

function guardarAudienciasArchivadas(audiencias) {
  localStorage.setItem("audienciasArchivadas", JSON.stringify(audiencias));
}

function obtenerAudiencias() {
  return JSON.parse(localStorage.getItem("audiencias")) || [];
}

function guardarAudiencias(audiencias) {
  localStorage.setItem("audiencias", JSON.stringify(audiencias));
}

function diasHasta(fecha, hora) {
  const ahora = new Date();
  const fechaHora = new Date(`${fecha}T${hora}`);
  return Math.ceil((fechaHora - ahora) / (1000 * 60 * 60 * 24));
}

function crearCardAudiencia(a, archivada = false) {
  const card = document.createElement("div");
  card.className = "audiencia-card";
  const fechaForm = typeof formatearCorta === "function" ? formatearCorta(a.fecha) : a.fecha;
  const dias = diasHasta(a.fecha, a.hora);
  let diasTexto = "";
  if (dias >= 0) {
    diasTexto = `Faltan ${dias} día${dias === 1 ? "" : "s"}`;
  } else {
    const d = Math.abs(dias);
    diasTexto = `Hace ${d} día${d === 1 ? "" : "s"}`;
  }
  const diasClass = dias >= 0 && dias < 5 ? "urgente" : "";
  const urg = (a.urgencia || "").toLowerCase();
  let colorClass;
  if (urg === "alta") colorClass = "audiencia-roja";
  else if (urg === "media") colorClass = "audiencia-amarilla";
  else if (urg === "baja") colorClass = "audiencia-verde";
  else if (dias > 10) colorClass = "audiencia-verde";
  else if (dias > 5) colorClass = "audiencia-amarilla";
  else colorClass = "audiencia-roja";
  card.classList.add(colorClass);
  const tipo = a.tipo ? a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1) : "";
  const modalidad = a.modalidad ? a.modalidad.charAt(0).toUpperCase() + a.modalidad.slice(1) : "";

  const info = document.createElement("div");
  info.className = "audiencia-info";
  info.innerHTML = `
      <h3>${a.titulo}</h3>
      <p>${tipo} - ${modalidad}</p>
      <p>${fechaForm} ${a.hora}</p>
      <p class="audiencia-dias ${diasClass}">${diasTexto}</p>
    `;

  const acciones = document.createElement("div");
  acciones.className = "audiencia-acciones";
  if (archivada) {
    acciones.innerHTML = `
        <button class="mini-boton tarea-dia-delete audiencia-eliminar">🗑</button>
    `;
  } else {
    acciones.innerHTML = `
        <button class="mini-boton tarea-dia-check audiencia-terminar">✔️</button>
        <button class="mini-boton tarea-dia-delete audiencia-eliminar">🗑</button>
    `;
  }

  card.appendChild(info);
  card.appendChild(acciones);

  card.addEventListener("click", () => verDetalleAudiencia(a.id));

  const btnTerm = acciones.querySelector(".audiencia-terminar");
  if (btnTerm) btnTerm.addEventListener("click", e => { e.stopPropagation(); terminarAudiencia(a.id); });
  const btnDel = acciones.querySelector(".audiencia-eliminar");
  if (btnDel) btnDel.addEventListener("click", e => { e.stopPropagation(); eliminarAudiencia(a.id, archivada); });
  return card;
}

function cargarAudiencias() {
  const contenedores = [audienciasLista, audienciasListaDashboard].filter(c => c);
  if (!contenedores.length) return;
  contenedores.forEach(c => (c.innerHTML = ""));
  const audiencias = obtenerAudiencias();
  audiencias.sort((a, b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));
  audiencias.forEach(a => {
    contenedores.forEach(c => c.appendChild(crearCardAudiencia(a)));
  });
  document.querySelectorAll("#audienciasCantidad").forEach(c => (c.textContent = audiencias.length));
}

function cargarAudienciasArchivadas() {
  if (!audienciasArchivadasDiv) return;
  audienciasArchivadasDiv.innerHTML = "";
  const archivadas = obtenerAudienciasArchivadas();
  archivadas.sort((a, b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));
  archivadas.forEach(a => audienciasArchivadasDiv.appendChild(crearCardAudiencia(a, true)));
}

function mostrarAudienciasProximas() {
  if (!listaAudienciasProximas) return;
  listaAudienciasProximas.innerHTML = "";
  const proximas = obtenerAudiencias().filter((a) => {
    const d = diasHasta(a.fecha, a.hora);
    return d >= 0 && d < 5;
  });
  if (!proximas.length) return;
  proximas.sort((a, b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));
  proximas.forEach((a) => {
    const card = crearCardAudiencia(a);
    const acciones = card.querySelector(".audiencia-acciones");
    if (acciones) acciones.remove();
    listaAudienciasProximas.appendChild(card);
  });
  modalAudienciasProximas.classList.remove("oculto");
}

if (nuevaAudienciaBtn && modalAudiencia) {
  nuevaAudienciaBtn.addEventListener("click", () => {
    if (audienciaForm) {
      audienciaForm.dataset.editing = "";
      audienciaForm.reset();
      const tipoSelect = document.getElementById("audienciaTipo");
      const modalidadSelect = document.getElementById("audienciaModalidad");
      const urgenciaSelect = document.getElementById("audienciaUrgencia");
      if (typeof setSelectValue === "function") {
        setSelectValue(tipoSelect, "");
        setSelectValue(modalidadSelect, "presencial");
        if (urgenciaSelect) setSelectValue(urgenciaSelect, "media");
      } else if (urgenciaSelect) {
        urgenciaSelect.value = "media";
      }
    }
    modalAudiencia.classList.remove("oculto");
  });
}

if (cerrarModalAudiencia && modalAudiencia) {
  cerrarModalAudiencia.addEventListener("click", () => modalAudiencia.classList.add("oculto"));
  modalAudiencia.addEventListener("click", (e) => {
    if (e.target === modalAudiencia) modalAudiencia.classList.add("oculto");
  });
}

if (cerrarModalAudienciasProximas && modalAudienciasProximas) {
  cerrarModalAudienciasProximas.addEventListener("click", () => modalAudienciasProximas.classList.add("oculto"));
  modalAudienciasProximas.addEventListener("click", (e) => {
    if (e.target === modalAudienciasProximas) modalAudienciasProximas.classList.add("oculto");
  });
}

if (audienciaForm) {
  audienciaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const tipoSelect = document.getElementById("audienciaTipo");
    const modalidadSelect = document.getElementById("audienciaModalidad");
    const idEd = audienciaForm.dataset.editing;
    const datos = {
      id: idEd ? parseInt(idEd, 10) : Date.now(),
      titulo: document.getElementById("audienciaTitulo").value.trim(),
      tipo: tipoSelect.value,
      modalidad: modalidadSelect.value,
      urgencia: document.getElementById("audienciaUrgencia")?.value || "media",
      fecha: document.getElementById("audienciaFecha").value || new Date().toISOString().slice(0, 10),
      hora: document.getElementById("audienciaHora").value || "09:00",
      notas: document.getElementById("audienciaNotas").value.trim(),
    };
    const audiencias = obtenerAudiencias();
    if (idEd) {
      const idx = audiencias.findIndex(a => a.id === datos.id);
      if (idx !== -1) audiencias[idx] = datos;
    } else {
      audiencias.push(datos);
    }
    guardarAudiencias(audiencias);
    if (window.supabaseSync) supabaseSync.pushRegistro("audiencias", datos);
    audienciaForm.reset();
    const urgenciaSelect = document.getElementById("audienciaUrgencia");
    if (typeof setSelectValue === "function") {
      setSelectValue(tipoSelect, "");
      setSelectValue(modalidadSelect, "presencial");
      if (urgenciaSelect) setSelectValue(urgenciaSelect, "media");
    } else if (urgenciaSelect) {
      urgenciaSelect.value = "media";
    }
    audienciaForm.dataset.editing = "";
    modalAudiencia.classList.add("oculto");
    cargarAudiencias();
    mostrarAudienciasProximas();
  });
}

function editarAudiencia(id) {
  const audiencias = obtenerAudiencias();
  const a = audiencias.find(x => x.id === id);
  if (!a || !audienciaForm) return;
  audienciaForm.dataset.editing = id;
  document.getElementById("audienciaTitulo").value = a.titulo;
  const tipoSelect = document.getElementById("audienciaTipo");
  const modalidadSelect = document.getElementById("audienciaModalidad");
  const urgenciaSelect = document.getElementById("audienciaUrgencia");
  if (typeof setSelectValue === "function") {
    setSelectValue(tipoSelect, a.tipo);
    setSelectValue(modalidadSelect, a.modalidad);
    setSelectValue(urgenciaSelect, a.urgencia || "media");
  } else {
    tipoSelect.value = a.tipo;
    modalidadSelect.value = a.modalidad;
    if (urgenciaSelect) urgenciaSelect.value = a.urgencia || "media";
  }
  document.getElementById("audienciaFecha").value = a.fecha;
  document.getElementById("audienciaHora").value = a.hora;
  document.getElementById("audienciaNotas").value = a.notas || "";
  modalAudiencia.classList.remove("oculto");
}

function terminarAudiencia(id) {
  let audiencias = obtenerAudiencias();
  const idx = audiencias.findIndex(a => a.id === id);
  if (idx === -1) return;
    const [fin] = audiencias.splice(idx, 1);
    guardarAudiencias(audiencias);
    const archivadas = obtenerAudienciasArchivadas();
    archivadas.push(fin);
    guardarAudienciasArchivadas(archivadas);
    if (window.supabaseSync) {
      supabaseSync.deleteRegistro("audiencias", id);
      supabaseSync.pushRegistro("audienciasarchivadas", fin);
    }
    cargarAudiencias();
    cargarAudienciasArchivadas();
    mostrarAudienciasProximas();
  }

  function eliminarAudiencia(id, archivada = false) {
    if (archivada) {
      const archivadas = obtenerAudienciasArchivadas().filter(a => a.id !== id);
      guardarAudienciasArchivadas(archivadas);
      cargarAudienciasArchivadas();
    } else {
      const audiencias = obtenerAudiencias().filter(a => a.id !== id);
      guardarAudiencias(audiencias);
      cargarAudiencias();
      mostrarAudienciasProximas();
    }
    if (window.supabaseSync) {
      supabaseSync.deleteRegistro(archivada ? "audienciasarchivadas" : "audiencias", id);
    }
  }

function verDetalleAudiencia(id) {
  const todas = obtenerAudiencias().concat(obtenerAudienciasArchivadas());
  const a = todas.find(x => x.id === id);
  if (!a) return;
  if (window.mostrarDetalleEntidad) {
    window.mostrarDetalleEntidad("audiencia", a);
    return;
  }
  if (!modalDetalleAudiencia) return;
  detalleAudienciaTitulo.textContent = a.titulo;
  detalleAudienciaTipo.textContent = `Tipo: ${a.tipo}`;
  detalleAudienciaModalidad.textContent = `Modalidad: ${a.modalidad}`;
  const fechaForm = typeof formatearCorta === "function" ? formatearCorta(a.fecha) : a.fecha;
  detalleAudienciaFechaHora.textContent = `${fechaForm} ${a.hora}`;
  detalleAudienciaNotas.textContent = a.notas ? `Notas: ${a.notas}` : "";
  if (editarAudienciaBtn) {
    editarAudienciaBtn.onclick = () => {
      modalDetalleAudiencia.classList.add("oculto");
      editarAudiencia(a.id);
    };
  }
  modalDetalleAudiencia.classList.remove("oculto");
}

if (cerrarModalDetalleAudiencia && modalDetalleAudiencia) {
  cerrarModalDetalleAudiencia.addEventListener("click", () => modalDetalleAudiencia.classList.add("oculto"));
  modalDetalleAudiencia.addEventListener("click", e => {
    if (e.target === modalDetalleAudiencia) modalDetalleAudiencia.classList.add("oculto");
  });
}

if (toggleAudienciasArchivadasBtn && audienciasArchivadasDiv) {
  toggleAudienciasArchivadasBtn.addEventListener("click", () => {
    const oculto = audienciasArchivadasDiv.classList.toggle("oculto");
    if (!oculto) {
      cargarAudienciasArchivadas();
      toggleAudienciasArchivadasBtn.textContent = "Ocultar audiencias archivadas";
    } else {
      toggleAudienciasArchivadasBtn.textContent = "Mostrar audiencias archivadas";
    }
  });
}
