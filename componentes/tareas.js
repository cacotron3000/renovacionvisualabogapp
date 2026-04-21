// === tareas.js ===
// Módulo encargado de manejar la lógica relacionada con las tareas legales:
// Crear, visualizar, editar, eliminar y asociar tareas a expedientes existentes.

// ----------------------------------------------------------------------------------
// 🔗 ELEMENTOS DEL DOM (nivel de relevancia: ALTO)
const tareaForm = document.getElementById("tareaForm");          // Formulario de tareas
const tareaExpSelect = document.getElementById("tarea-expediente"); // Select de expedientes
const tareaLista = document.getElementById("tareasLista");       // Lista visual (debe existir en index)
const tareaBusquedaInput = document.getElementById("buscarTareas");
const tareaPaginacionDiv = document.getElementById("tareasPaginacion");
const ordenSelect = document.getElementById("ordenTareas");
const filtroTribunalSelect = document.getElementById("filtroTribunal");
const filtroEstadoSelect = document.getElementById("filtroEstadoTareas");

const TAREAS_POR_PAGINA = 10;
let paginaTareas = 1;
let filtroTarea = "";
let ordenTareas = "prioridad";
let filtroTribunal = "";
let filtroEstado = "";

let editandoTarea = false;                // Bandera para saber si estamos editando
let tareaEditandoId = null;               // ID de la tarea en edición

const listaComentariosGestionDiv = document.getElementById("listaComentariosGestion");
const nuevoComentarioGestionInput = document.getElementById("nuevoComentarioGestion");
const btnAgregarComentarioGestion = document.getElementById("btnAgregarComentarioGestion");

// ----------------------------------------------------------------------------------
// 🧠 FUNCIÓN: cargarExpedientesEnSelect()
// Carga los expedientes guardados para seleccionarlos en el formulario de tareas
function cargarExpedientesEnSelect() {
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
const clientes = JSON.parse(localStorage.getItem("clientes")) || [];

const select = document.getElementById("tarea-expediente");
select.innerHTML = '<option value="">Seleccionar expediente</option>';

// Iteramos sobre cada expediente
expedientes.forEach(exp => {
  const option = document.createElement("option");

  // Buscamos el cliente asociado al expediente
  const cliente = clientes.find(c => c.id == exp.clienteId);
  

  // Mostramos título + nombre del cliente (si se encuentra)
  option.value = exp.id;
  option.textContent = cliente
    ? `${exp.titulo} (${cliente.nombre})`
    : exp.titulo;

  select.appendChild(option);
});

  if (typeof enhanceSelect === "function") {
    enhanceSelect(select);
  }

  cargarFiltrosExpedientes();
}

function cargarFiltrosExpedientes() {
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const tribunales = [...new Set(expedientes.map(e => e.tribunal).filter(t => t))];
  const estados = ["No iniciado", "En proceso", "Terminado"];

  filtroTribunalSelect.innerHTML = '<option value="">Todos los tribunales</option>';
  tribunales.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    filtroTribunalSelect.appendChild(opt);
  });

  if (typeof enhanceSelect === "function") {
    enhanceSelect(filtroTribunalSelect);
  }


  if (filtroEstadoSelect) {
    filtroEstadoSelect.innerHTML = '<option value="">Todos los estados</option>';
    estados.forEach(es => {
      const opt = document.createElement('option');
      opt.value = es;
      opt.textContent = es;
      filtroEstadoSelect.appendChild(opt);
    });
    if (typeof enhanceSelect === "function") {
      enhanceSelect(filtroEstadoSelect);
    }
  }
}

// -------------------------------
// 🧠 FUNCIÓN: cargarTareas()
// Muestra las tareas almacenadas en la lista
function cargarTareas() {
  tareaLista.innerHTML = "";
  const tareas = JSON.parse(localStorage.getItem("tareas")) || [];
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];

  let filtradas = tareas.filter(t => {
    const exp = expedientes.find(e => e.id === t.expedienteId) || {};
    const busqueda = filtroTarea.toLowerCase();
  const coincideBusqueda =
      t.titulo.toLowerCase().includes(busqueda);
    const coincideTribunal = !filtroTribunal || (exp.tribunal === filtroTribunal);
    const coincideEstado = !filtroEstado || t.estado === filtroEstado;
    return coincideBusqueda && coincideTribunal && coincideEstado;
  });

  if (ordenTareas === "alfabetico") {
    filtradas.sort((a, b) => a.titulo.localeCompare(b.titulo));
  } else if (ordenTareas === "antiguo") {
    filtradas.sort((a, b) => a.id - b.id);
  } else if (ordenTareas === "nuevo") {
    filtradas.sort((a, b) => b.id - a.id);
  } else {
    const orden = { Urgente: 0, Prioritaria: 1, Normal: 2 };
    filtradas.sort((a, b) => {
      const pa = orden[a.prioridad] ?? 3;
      const pb = orden[b.prioridad] ?? 3;
      if (pa !== pb) return pa - pb;
      const fa = a.fin ? parseFechaLocal(a.fin) : new Date(8640000000000000);
      const fb = b.fin ? parseFechaLocal(b.fin) : new Date(8640000000000000);
      return fa - fb;
    });
  }

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAREAS_POR_PAGINA));
  if (paginaTareas > totalPaginas) paginaTareas = totalPaginas;
  const inicio = (paginaTareas - 1) * TAREAS_POR_PAGINA;
  const visibles = filtradas.slice(inicio, inicio + TAREAS_POR_PAGINA);

  visibles.forEach(t => {
    const expediente = expedientes.find(e => e.id === t.expedienteId);
    const nombreExpediente = expediente ? expediente.titulo : "Expediente no encontrado";
    const cliente = expediente ? clientes.find(c => c.id === expediente.clienteId) : null;
    const nombreCliente = cliente ? ` (${cliente.nombre})` : "";

    const li = document.createElement("div");
    li.className = "tarea-card";

    let prioridadClass = '';
    let prioridadLabelClass = '';
    if (t.prioridad === "Urgente") {
      prioridadClass = 'tarea-urgente';
      prioridadLabelClass = 'prioridad-urgente';
    } else if (t.prioridad === "Prioritaria") {
      prioridadClass = 'tarea-prioritaria';
      prioridadLabelClass = 'prioridad-prioritaria';
    } else {
      prioridadClass = 'tarea-normal';
      prioridadLabelClass = 'prioridad-normal';
    }
    li.classList.add(prioridadClass);

    li.innerHTML = `
      <h3>📝 ${t.titulo}<span class="prioridad-label ${prioridadLabelClass}">${t.prioridad}</span></h3>
      ${nombreExpediente}${nombreCliente} | Estado: ${t.estado}<br/>
      Inicio: ${formatearCorta(t.inicio)} | Fin: ${formatearCorta(t.fin)}<br/>
      <button class="boton-eliminar" onclick="eliminarTarea(${t.id}); event.stopPropagation();">🗑 Eliminar</button>
      <button class="boton-archivar" onclick="archivarTarea(${t.id}); event.stopPropagation();">📦 Archivar</button>
    `;

    li.addEventListener("click", () => verDetalleTarea(t.id));

    tareaLista.appendChild(li);
  });

  tareaPaginacionDiv.innerHTML = "";
  if (totalPaginas > 1) {
    const prev = document.createElement("button");
    prev.textContent = "Anterior";
    prev.disabled = paginaTareas === 1;
    prev.addEventListener("click", () => {
      paginaTareas--;
      cargarTareas();
    });

    const info = document.createElement("span");
    info.textContent = ` Página ${paginaTareas} de ${totalPaginas} `;

    const next = document.createElement("button");
    next.textContent = "Siguiente";
    next.disabled = paginaTareas === totalPaginas;
    next.addEventListener("click", () => {
      paginaTareas++;
      cargarTareas();
    });

    tareaPaginacionDiv.appendChild(prev);
    tareaPaginacionDiv.appendChild(info);
    tareaPaginacionDiv.appendChild(next);
  }
}

// ----------------------------------------------------------------------------------
// 🧾 Evento: Envío del formulario
// Guarda nueva tarea o modifica una existente

// Obtener el modal y el botón de abrir
const modalFormularioTarea = document.getElementById("ModalFormularioTarea");
const abrirModalFormularioTarea = document.getElementById("abrirModalFormularioTarea");
const cerrarModalFormularioTarea = document.getElementById("ModalFormularioTareaCerrar");

// Abrir el modal al hacer clic en el botón
abrirModalFormularioTarea.addEventListener("click", () => {
  mostrarModal(modalFormularioTarea);
});

// Cerrar el modal al hacer clic en la "X"
cerrarModalFormularioTarea.addEventListener("click", () => {
  modalFormularioTarea.classList.add("oculto");
});

// Cerrar el modal al hacer clic fuera del contenido
modalFormularioTarea.addEventListener("click", (e) => {
  if (e.target === modalFormularioTarea) {
    modalFormularioTarea.classList.add("oculto");
  }
});
tareaForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const ahora = new Date().toISOString();
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const expedienteSeleccionado = expedientes.find(
    (x) => x.id === parseInt(document.getElementById("tarea-expediente").value)
  );
  const descripcionIngresada = document.getElementById("tarea-descripcion").value.trim();
  let descripcionPlantilla = descripcionIngresada;
  if (!descripcionPlantilla) {
    const textoExp = `${expedienteSeleccionado?.materia || ""} ${expedienteSeleccionado?.tribunal || ""}`.toLowerCase();
    if (textoExp.includes("familia")) {
      descripcionPlantilla = "Plantilla Familia: revisar carpeta, preparar escrito, confirmar audiencia y notificar cliente.";
    } else if (textoExp.includes("laboral") || textoExp.includes("trabajo")) {
      descripcionPlantilla = "Plantilla Laboral: recopilar antecedentes, preparar estrategia, actualizar cliente y registrar avance.";
    } else {
      descripcionPlantilla = "Plantilla General: revisar caso, registrar próximos hitos y coordinar tareas.";
    }
  }
  const nuevaTarea = {
    id: editandoTarea ? tareaEditandoId : Date.now(),
    created_at: editandoTarea
      ? (JSON.parse(localStorage.getItem("tareas")) || []).find(t => t.id === tareaEditandoId)?.created_at || ahora
      : ahora,
    updated_at: ahora,
    titulo: document.getElementById("tarea-titulo").value,
    descripcion: descripcionPlantilla || "no indicado",
    proximaAccion: document.getElementById("tarea-proxima-accion").value.trim(),
    expedienteId: parseInt(document.getElementById("tarea-expediente").value),
    inicio: document.getElementById("tarea-inicio").value || new Date().toISOString().slice(0, 10),
    fin: document.getElementById("tarea-fin").value || new Date().toISOString().slice(0, 10),
    estado: document.getElementById("tarea-estado").value || "no indicado",
    prioridad: document.getElementById("tarea-prioridad").value || "no indicado",
    creadoPor: editandoTarea
      ? (JSON.parse(localStorage.getItem("tareas")) || []).find(t => t.id === tareaEditandoId)?.creadoPor || usuario.nombre
      : usuario.nombre
  };
  if (!nuevaTarea.proximaAccion) {
    mostrarNotificacion("Debe registrar la próxima acción de la gestión", "#FF9800");
    return;
  }

  if (nuevaTarea.estado === "Terminado") {
    nuevaTarea.archivadoEn = ahora;
    nuevaTarea.archivadoPor = usuario.nombre || "";
  }

  let tareas = JSON.parse(localStorage.getItem("tareas")) || [];
  let archivadas = JSON.parse(localStorage.getItem("tareasArchivadas")) || [];
  const accion = editandoTarea ? "modificada" : "creada";

  if (editandoTarea) {
    if (nuevaTarea.estado === "Terminado") {
      tareas = tareas.filter(t => t.id !== nuevaTarea.id);
      archivadas.push(nuevaTarea);
    } else {
      tareas = tareas.map(t => t.id === nuevaTarea.id ? nuevaTarea : t);
    }
    editandoTarea = false;
    tareaEditandoId = null;
  } else {
    if (nuevaTarea.estado === "Terminado") {
      archivadas.push(nuevaTarea);
    } else {
      tareas.push(nuevaTarea);
    }
  }

  localStorage.setItem("tareas", JSON.stringify(tareas));
  localStorage.setItem("tareasArchivadas", JSON.stringify(archivadas));
  let ok = true;
  if (window.supabaseSync) {
    if (nuevaTarea.estado === "Terminado") {
      ok = await supabaseSync.pushRegistro("gestionesarchivadas", nuevaTarea);
      await supabaseSync.deleteRegistro("tareas", nuevaTarea.id);
    } else {
      ok = await supabaseSync.pushRegistro("tareas", nuevaTarea);
    }
  }
  if (ok) {
    mostrarNotificacion("Datos guardados", "#00E500");
    registrarNotificacion(
      `Gestión "${nuevaTarea.titulo}" ${accion} por ${usuario.nombre}`,
      "tareas"
    );
    tareaForm.reset();
    document
      .getElementById("ModalFormularioTarea")
      .classList.add("oculto"); // Cerrar el modal
    cargarTareas();
  } else if (window.supabaseSync) {
    mostrarNotificacion(
      "Los datos no se pudieron sincronizar. Intente nuevamente",
      "#FF0000"
    );
  }
  cargarTareasArchivadas();
  if (typeof actualizarDashboard === "function") {
    actualizarDashboard();
  }
});

// ----------------------------------------------------------------------------------
// ✏️ Función: editarTarea(id)
function editarTarea(id) {
  const tareas = JSON.parse(localStorage.getItem("tareas")) || [];
  const t = tareas.find(t => t.id === id);
  if (!t) return;

  document.getElementById("tarea-titulo").value = t.titulo;
  document.getElementById("tarea-descripcion").value =
    t.descripcion === "no indicado" ? "" : t.descripcion;
  document.getElementById("tarea-proxima-accion").value = t.proximaAccion || "";
  setSelectValue(document.getElementById("tarea-expediente"), t.expedienteId);
  document.getElementById("tarea-inicio").value = t.inicio;
  document.getElementById("tarea-fin").value = t.fin;
  setSelectValue(
    document.getElementById("tarea-estado"),
    t.estado === "no indicado" ? "" : t.estado
  );
  setSelectValue(
    document.getElementById("tarea-prioridad"),
    t.prioridad === "no indicado" ? "" : t.prioridad
  );

  editandoTarea = true;
  tareaEditandoId = id;
}

// ----------------------------------------------------------------------------------
// 🗑 Eliminar tarea
function eliminarTarea(id) {
  if (!confirm("¿Eliminar esta tarea?")) return;
  let tareas = JSON.parse(localStorage.getItem("tareas")) || [];
  const tarea = tareas.find(t => t.id === id);
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem("tareas", JSON.stringify(tareas));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("tareas", id);
    if (tarea) supabaseSync.pushRegistro("gestionesarchivadas", tarea);
  }
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  if (tarea) {
    registrarNotificacion(`Gestión "${tarea.titulo}" eliminada por ${usuario.nombre}`, "tareas");
  }
  cargarTareas();
  if (typeof actualizarDashboard === "function") {
    actualizarDashboard();
  }
}

// -----------------------------------------------------------------------------
// 📦 Archivar tarea
function archivarTarea(id) {
  let tareas = JSON.parse(localStorage.getItem("tareas")) || [];
  const tarea = tareas.find(t => t.id === id);
  if (!tarea) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  tarea.archivadoEn = new Date().toISOString();
  tarea.archivadoPor = usuario.nombre || "";
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem("tareas", JSON.stringify(tareas));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("tareas", id);
    supabaseSync.pushRegistro("gestionesarchivadas", tarea);
  }

  const archivadas = JSON.parse(localStorage.getItem("tareasArchivadas")) || [];
  archivadas.push(tarea);
  localStorage.setItem("tareasArchivadas", JSON.stringify(archivadas));

  registrarNotificacion(`Gestión "${tarea.titulo}" archivada por ${usuario.nombre}`, "tareas");

  cargarTareas();
  cargarTareasArchivadas();
}

// -----------------------------------------------------------------------------
// ↩️ Desarchivar tarea
function desarchivarTarea(id) {
  let archivadas = JSON.parse(localStorage.getItem("tareasArchivadas")) || [];
  const tarea = archivadas.find(t => t.id === id);
  if (!tarea) return;
  archivadas = archivadas.filter(t => t.id !== id);
  tarea.estado = "En proceso";
  delete tarea.archivadoEn;
  delete tarea.archivadoPor;

  const tareas = JSON.parse(localStorage.getItem("tareas")) || [];
  tareas.push(tarea);
  localStorage.setItem("tareas", JSON.stringify(tareas));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("tareas", tarea);
    supabaseSync.deleteRegistro("gestionesarchivadas", id);
  }
  localStorage.setItem("tareasArchivadas", JSON.stringify(archivadas));

  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  registrarNotificacion(`Gestión "${tarea.titulo}" desarchivada por ${usuario.nombre}`, "tareas");

  cargarTareas();
  cargarTareasArchivadas();
}

// ----------------------------------------------------------------------------------
// 👁 Ver detalles en alert (por ahora)
function verDetalleTarea(id) {
  const tareas = JSON.parse(localStorage.getItem("tareas")) || [];
  const archivadas = JSON.parse(localStorage.getItem("tareasArchivadas")) || [];
  const todas = tareas.concat(archivadas);
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  const t = todas.find(t => t.id === id);
  if (!t) return;
  if (window.mostrarDetalleEntidad) {
    window.mostrarDetalleEntidad("tarea", t);
    return;
  }

  const expediente = expedientes.find(e => e.id === t.expedienteId);
  const nombreExp = expediente ? expediente.titulo : "📁 Sin título";
  const cliente = expediente ? clientes.find(c => c.id === expediente.clienteId) : null;
  const nombreCliente = cliente ? ` (${cliente.nombre})` : "";

  const texto = `
    <p class="full-span"><strong>📝 TÍTULO:</strong> ${t.titulo}</p>
    <p class="full-span"><strong>🧾 DESCRIPCIÓN:</strong> ${t.descripcion || "Sin descripción"}</p>
    <p class="full-span"><strong>📂 CASO ASOCIADO:</strong> <a href="#" class="enlace-asociado" onclick="verDetalleExpediente(${t.expedienteId}); return false;">${nombreExp}${nombreCliente}</a></p>
    <p><strong>📅 INICIO:</strong> ${formatearCorta(t.inicio) || "No definido"}</p>
    <p><strong>📅 FIN:</strong> ${formatearCorta(t.fin) || "No definido"}</p>
    <p><strong>📌 ESTADO:</strong> ${t.estado}</p>
    <p><strong>⚠️ PRIORIDAD:</strong> ${t.prioridad}</p>
    <p class="full-span"><strong>✅ PRÓXIMA ACCIÓN:</strong> ${t.proximaAccion || "-"}</p>
    <hr class="full-span"><p class="full-span"><strong>CREADO POR:</strong> ${t.creadoPor || "Desconocido"}</p>
    ${t.archivadoEn ? `<p class="full-span"><strong>ARCHIVADO:</strong> ${new Date(t.archivadoEn).toLocaleString()} por ${t.archivadoPor || "Desconocido"}</p>` : ""}
  `;

  // Usamos innerHTML para que el enlace al expediente sea clickeable
  document.getElementById("modalTareaTexto").innerHTML = texto;
  renderComentariosGestion(id);
  if (btnAgregarComentarioGestion) {
    btnAgregarComentarioGestion.onclick = () => agregarComentarioGestion(id, t.titulo);
  }
  if (nuevoComentarioGestionInput) nuevoComentarioGestionInput.value = "";

  const botonEditar = document.getElementById("modalTareaEditar");
  botonEditar.onclick = () => {
    document.getElementById("modalTarea").classList.add("oculto");
    // Si estamos viendo el dashboard, aseguramos que la vista de tareas esté visible
    if (typeof cambiarVista === "function") {
      cambiarVista("tareas");
    }
    editarTarea(id);
    mostrarModal(document.getElementById("ModalFormularioTarea"));
  };

  mostrarModal(document.getElementById("modalTarea"));
}

// -----------------------------------------------------------------------------
// 📃 Cargar tareas archivadas
function cargarTareasArchivadas() {
  const lista = document.getElementById("tareasArchivadasLista");
  if (!lista) return;
  lista.innerHTML = "";

  const archivadas = JSON.parse(localStorage.getItem("tareasArchivadas")) || [];
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];

  const orden = { Urgente: 0, Prioritaria: 1, Normal: 2 };
  archivadas.sort((a, b) => {
    const pa = orden[a.prioridad] ?? 3;
    const pb = orden[b.prioridad] ?? 3;
    if (pa !== pb) return pa - pb;
    const fa = a.fin ? parseFechaLocal(a.fin) : new Date(8640000000000000);
    const fb = b.fin ? parseFechaLocal(b.fin) : new Date(8640000000000000);
    return fa - fb;
  });

  archivadas.forEach(t => {
    const exp = expedientes.find(e => e.id === t.expedienteId);
    const nombreExp = exp ? exp.titulo : "Expediente no encontrado";
    const cliente = exp ? clientes.find(c => c.id === exp.clienteId) : null;
    const nombreCliente = cliente ? ` (${cliente.nombre})` : "";

    const div = document.createElement("div");
    div.className = "tarea-card";

    let prioridadClass = '';
    let prioridadLabelClass = '';
    if (t.prioridad === "Urgente") {
      prioridadClass = 'tarea-urgente';
      prioridadLabelClass = 'prioridad-urgente';
    } else if (t.prioridad === "Prioritaria") {
      prioridadClass = 'tarea-prioritaria';
      prioridadLabelClass = 'prioridad-prioritaria';
    } else {
      prioridadClass = 'tarea-normal';
      prioridadLabelClass = 'prioridad-normal';
    }
    div.classList.add(prioridadClass);

    div.innerHTML = `
      <h3>📝 ${t.titulo}<span class="prioridad-label ${prioridadLabelClass}">${t.prioridad}</span></h3>
      ${nombreExp}${nombreCliente} | Estado: ${t.estado}<br/>
      Inicio: ${formatearCorta(t.inicio)} | Fin: ${formatearCorta(t.fin)}<br/>
      Archivado: ${new Date(t.archivadoEn).toLocaleString()} por ${t.archivadoPor || "Desconocido"}<br/>
      <button class="boton-desarchivar" onclick="desarchivarTarea(${t.id}); event.stopPropagation();">↩️ Desarchivar</button>
    `;

    div.addEventListener('click', () => verDetalleTarea(t.id));
    lista.appendChild(div);
  });
}

// -------------------------------
// 💬 Comentarios de gestiones
// -------------------------------
function obtenerComentariosGestion(id) {
  const todos = JSON.parse(localStorage.getItem("comentariosGestiones")) || [];
  return todos
    .filter(c => c.tareaId === id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function renderComentariosGestion(id) {
  if (!listaComentariosGestionDiv) return;
  const comentarios = obtenerComentariosGestion(id);
  listaComentariosGestionDiv.innerHTML = "";
  comentarios.forEach(c => {
    const li = document.createElement("li");
    li.className = "comentario-card";
    const cont = document.createElement("div");
    const fecha = new Date(c.created_at).toLocaleDateString("es-CL");
    cont.innerHTML = `<strong>${c.creadoPor}</strong> <small>${fecha}</small><div>${c.texto}</div>`;
    const acciones = document.createElement("div");
    acciones.className = "acciones";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "✏️ Editar";
    edit.className = "mini-boton mini-boton-editar";
    edit.addEventListener("click", () => editarComentarioGestion(c.id, id));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "🗑 Eliminar";
    del.className = "mini-boton mini-boton-eliminar";
    del.addEventListener("click", () => eliminarComentarioGestion(c.id, id));
    acciones.append(edit, del);
    li.append(cont, acciones);
    listaComentariosGestionDiv.appendChild(li);
  });
}

function editarComentarioGestion(comentId, tareaId) {
  const todos = JSON.parse(localStorage.getItem("comentariosGestiones")) || [];
  const comentario = todos.find(c => c.id === comentId);
  if (!comentario) return;
  const nuevo = prompt("Editar comentario", comentario.texto);
  if (nuevo === null) return;
  comentario.texto = nuevo.trim();
  comentario.updated_at = new Date().toISOString();
  localStorage.setItem("comentariosGestiones", JSON.stringify(todos));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("comentarios_tareas", comentario);
  }
  renderComentariosGestion(tareaId);
}

function eliminarComentarioGestion(comentId, tareaId) {
  if (!confirm("¿Eliminar comentario?")) return;
  let todos = JSON.parse(localStorage.getItem("comentariosGestiones")) || [];
  todos = todos.filter(c => c.id !== comentId);
  localStorage.setItem("comentariosGestiones", JSON.stringify(todos));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("comentarios_tareas", comentId);
  }
  renderComentariosGestion(tareaId);
}

async function agregarComentarioGestion(id, titulo) {
  const texto = nuevoComentarioGestionInput.value.trim();
  if (!texto) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const nuevo = {
    id: Date.now(),
    tareaId: id,
    texto,
    creadoPor: usuario.nombre,
    created_at: new Date().toISOString(),
  };
  const todos = JSON.parse(localStorage.getItem("comentariosGestiones")) || [];
  todos.push(nuevo);
  localStorage.setItem("comentariosGestiones", JSON.stringify(todos));
  let ok = true;
  if (window.supabaseSync) {
    ok = await supabaseSync.pushRegistro("comentarios_tareas", nuevo);
  }
  if (ok) {
    mostrarNotificacion("Comentario agregado", "#00E500");
    registrarNotificacion(
      `Nuevo comentario en gestión "${titulo}" por ${usuario.nombre}`,
      "tareas"
    );
    nuevoComentarioGestionInput.value = "";
    renderComentariosGestion(id);
  } else if (window.supabaseSync) {
    mostrarNotificacion(
      "Los datos no se pudieron sincronizar. Intente nuevamente",
      "#FF0000"
    );
  }
}

// Cierre del modal
document.getElementById("modalTareaCerrar").addEventListener("click", () => {
  document.getElementById("modalTarea").classList.add("oculto");
  if (nuevoComentarioGestionInput) nuevoComentarioGestionInput.value = "";
});

// También cerramos si el usuario hace clic fuera del contenido del modal
document.getElementById("modalTarea").addEventListener("click", (e) => {
  if (e.target.id === "modalTarea") {
    e.target.classList.add("oculto");
    if (nuevoComentarioGestionInput) nuevoComentarioGestionInput.value = "";
  }
});
// ----------------------------------------------------------------------------------
// 🧪 Inicialización automática
cargarExpedientesEnSelect();
tareaBusquedaInput.addEventListener("input", e => {
  filtroTarea = e.target.value;
  paginaTareas = 1;
  cargarTareas();
});

if (ordenSelect) {
  ordenSelect.addEventListener("change", e => {
    ordenTareas = e.target.value;
    cargarTareas();
  });
}

filtroTribunalSelect.addEventListener("change", e => {
  filtroTribunal = e.target.value;
  cargarTareas();
});


if (filtroEstadoSelect) {
  filtroEstadoSelect.addEventListener("change", e => {
    filtroEstado = e.target.value;
    cargarTareas();
  });
}

cargarTareas();
cargarTareasArchivadas();

const toggleArchivadasBtn = document.getElementById("toggleTareasArchivadas");
if (toggleArchivadasBtn) {
  toggleArchivadasBtn.addEventListener("click", () => {
    document.getElementById("tareasArchivadasLista").classList.toggle("oculto");
  });
}
