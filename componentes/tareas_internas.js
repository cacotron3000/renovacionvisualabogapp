// === tareas_internas.js ===
// Gestión de tareas internas, inspirado en el sistema de tareas del dashboard

function cargarTareasInternas() {
  const cont = document.getElementById("tareasInternasLista");
  if (!cont) return;
  cont.innerHTML = "";
  const tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  const orden = { alta: 0, media: 1, baja: 2 };
  tareas.sort((a, b) => {
    const pa = orden[a.prioridad] ?? 3;
    const pb = orden[b.prioridad] ?? 3;
    if (pa !== pb) return pa - pb;
    const fa = a.fechaFin ? parseFechaLocal(a.fechaFin) : new Date(8640000000000000);
    const fb = b.fechaFin ? parseFechaLocal(b.fechaFin) : new Date(8640000000000000);
    return fa - fb;
  });
  tareas.forEach(t => {
    const div = document.createElement("div");
    div.className = "tarea-dia-card";
    if (t.prioridad === "baja") div.classList.add("tarea-dia-baja");
    else if (t.prioridad === "media") div.classList.add("tarea-dia-media");
    else if (t.prioridad === "alta") div.classList.add("tarea-dia-alta");
    div.addEventListener("click", () => verDetalleTareaInterna(t.id));
    const textos = document.createElement("div");
    textos.className = "tarea-dia-textos";
    const span = document.createElement("span");
    span.textContent = t.texto;
    span.className = "tarea-dia-texto";
    span.title = t.texto;
    textos.appendChild(span);
    const asignados = t.asignadosA || [];
    if (asignados.length) {
      const asign = document.createElement("div");
      asign.className = "tarea-dia-asignado";
      asign.textContent = `(${asignados.join(", ")})`;
      textos.appendChild(asign);
    }
    const fecha = document.createElement("div");
    fecha.className = "tarea-dia-fecha";
    fecha.textContent = t.creadoEn ? new Date(t.creadoEn).toLocaleDateString() : "";
    textos.appendChild(fecha);
    if (t.fechaFin) {
      const plazo = document.createElement("div");
      plazo.className = "tarea-dia-plazo";
      const dias = Math.ceil((parseFechaLocal(t.fechaFin) - new Date()) / (1000 * 60 * 60 * 24));
      if (dias >= 0) {
        plazo.textContent = `Faltan ${dias} día${dias === 1 ? "" : "s"}`;
      } else {
        const d = Math.abs(dias);
        plazo.textContent = `Vencida hace ${d} día${d === 1 ? "" : "s"}`;
      }
      if (dias < 3) plazo.classList.add("urgente");
      textos.appendChild(plazo);
    }
    const acciones = document.createElement("div");
    const comp = document.createElement("button");
    comp.textContent = "✔️";
    comp.className = "mini-boton tarea-dia-check";
    comp.addEventListener("click", e => { e.stopPropagation(); completarTareaInterna(t.id); });
    const del = document.createElement("button");
    del.textContent = "🗑";
    del.className = "mini-boton tarea-dia-delete";
    del.addEventListener("click", e => { e.stopPropagation(); eliminarTareaInterna(t.id); });
    acciones.appendChild(comp);
    acciones.appendChild(del);
    div.appendChild(textos);
    div.appendChild(acciones);
    cont.appendChild(div);
  });
  const cant = document.getElementById("tareasInternasCantidad");
  if (cant) cant.textContent = tareas.length;
}

function completarTareaInterna(id) {
  let tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  t.archivadoEn = new Date().toISOString();
  t.archivadoPor = usuario.nombre || "";
  tareas = tareas.filter(x => x.id !== id);
  localStorage.setItem("tareasInternas", JSON.stringify(tareas));
  const arch = JSON.parse(localStorage.getItem("tareasInternasArchivadas")) || [];
  arch.push(t);
  localStorage.setItem("tareasInternasArchivadas", JSON.stringify(arch));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("tareasinternas", id);
  }
  cargarTareasInternas();
  cargarTareasInternasArchivadas();
}

function eliminarTareaInterna(id) {
  if (!confirm("¿Eliminar esta tarea?")) return;
  let tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem("tareasInternas", JSON.stringify(tareas));
  if (window.supabaseSync) supabaseSync.deleteRegistro("tareasinternas", id);
  cargarTareasInternas();
}

function cargarTareasInternasArchivadas() {
  const cont = document.getElementById("tareasInternasArchivadas");
  if (!cont) return;
  cont.innerHTML = "";
  const tareas = JSON.parse(localStorage.getItem("tareasInternasArchivadas")) || [];
  const orden = { alta: 0, media: 1, baja: 2 };
  tareas.sort((a, b) => {
    const pa = orden[a.prioridad] ?? 3;
    const pb = orden[b.prioridad] ?? 3;
    if (pa !== pb) return pa - pb;
    const fa = a.fechaFin ? parseFechaLocal(a.fechaFin) : new Date(8640000000000000);
    const fb = b.fechaFin ? parseFechaLocal(b.fechaFin) : new Date(8640000000000000);
    return fa - fb;
  });
  tareas.forEach(t => {
    const div = document.createElement("div");
    div.className = "tarea-dia-card";
    if (t.prioridad === "baja") div.classList.add("tarea-dia-baja");
    else if (t.prioridad === "media") div.classList.add("tarea-dia-media");
    else if (t.prioridad === "alta") div.classList.add("tarea-dia-alta");
    div.addEventListener("click", () => verDetalleTareaInterna(t.id));
    const span = document.createElement("span");
    const asignados = t.asignadosA || [];
    const asignado = asignados.length ? ` (${asignados.join(", ")})` : "";
    const fechaCreacion = t.creadoEn ? `Creada: ${new Date(t.creadoEn).toLocaleDateString()} | ` : "";
    span.textContent = `${t.texto}${asignado} (${fechaCreacion}Archivado: ${new Date(t.archivadoEn).toLocaleString()} por ${t.archivadoPor || "Desconocido"})`;
    span.className = "tarea-dia-texto";
    span.title = t.texto;
    const del = document.createElement("button");
    del.textContent = "🗑";
    del.className = "mini-boton tarea-dia-delete";
    del.addEventListener("click", e => { e.stopPropagation(); eliminarTareaInternaArchivada(t.id); });
    div.appendChild(span);
    div.appendChild(del);
    cont.appendChild(div);
  });
}

function eliminarTareaInternaArchivada(id) {
  if (!confirm("¿Eliminar tarea archivada?")) return;
  let tareas = JSON.parse(localStorage.getItem("tareasInternasArchivadas")) || [];
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem("tareasInternasArchivadas", JSON.stringify(tareas));
  cargarTareasInternasArchivadas();
}

function verDetalleTareaInterna(id) {
  const activas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  const archivadas = JSON.parse(localStorage.getItem("tareasInternasArchivadas")) || [];
  const todas = activas.concat(archivadas);
  const t = todas.find(x => x.id === id);
  const modal = document.getElementById("modalDetalleTareaInterna");
  if (!t || !modal) return;
  if (window.mostrarDetalleEntidad) {
    window.mostrarDetalleEntidad("tarea_interna", t);
    return;
  }
  document.getElementById("detalleTareaInternaTitulo").textContent = `📝 ${t.texto}`;
  const nombres = t.asignadosA || [];
  const asignado = nombres.length ? nombres.join(", ") : "Sin asignar";
  const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
  const cliente = clientes.find((c) => c.id === t.clienteId);
  const clienteTxt = cliente ? ` · Cliente: ${cliente.nombre}` : "";
  document.getElementById("detalleTareaInternaAsignado").textContent = `👥 Asignado a: ${asignado}`;
  document.getElementById("detalleTareaInternaFecha").textContent = t.creadoEn ? `📅 Creada: ${new Date(t.creadoEn).toLocaleString()}` : "";
  document.getElementById("detalleTareaInternaVence").textContent = t.fechaFin ? `⏳ Vence: ${formatearCorta(t.fechaFin)}` : "";
  if (t.proximaAccion) {
    document.getElementById("detalleTareaInternaVence").textContent += `${clienteTxt} · ✅ Próxima acción: ${t.proximaAccion}`;
  }
  renderComentariosTareaInterna(t);
  modal.dataset.id = id;
  modal.classList.remove("oculto");
}

function renderComentariosTareaInterna(t) {
  const lista = document.getElementById("listaComentariosTareaInterna");
  if (!lista) return;
  lista.innerHTML = "";

  function crearElemento(c, idx, parentIdx = null) {
    const li = document.createElement("li");
    li.style.flexDirection = "column";
    li.style.alignItems = "stretch";

    const fila = document.createElement("div");
    fila.style.display = "flex";
    fila.style.justifyContent = "space-between";
    fila.style.gap = "0.5rem";

    const texto = document.createElement("span");
    texto.textContent = `${(c.autor || "Alguien")} dijo: ${c.texto} (${new Date(c.fecha).toLocaleString()})`;
    fila.appendChild(texto);

    const acciones = document.createElement("div");
    acciones.className = "acciones";
    const btnDel = document.createElement("button");
    btnDel.textContent = "Eliminar";
    btnDel.className = "mini-boton";
    btnDel.addEventListener("click", () => eliminarComentarioTareaInterna(t.id, idx, parentIdx));
    acciones.appendChild(btnDel);
    if (parentIdx === null) {
      const btnResp = document.createElement("button");
      btnResp.textContent = "Responder";
      btnResp.className = "mini-boton";
      btnResp.addEventListener("click", () => responderComentarioTareaInterna(t.id, idx));
      acciones.appendChild(btnResp);
    }
    fila.appendChild(acciones);

    li.appendChild(fila);

    if (c.respuestas && c.respuestas.length) {
      const ul = document.createElement("ul");
      ul.className = "lista-comentarios";
      c.respuestas.forEach((r, j) => {
        ul.appendChild(crearElemento(r, j, idx));
      });
      li.appendChild(ul);
    }
    return li;
  }

  (t.comentarios || []).forEach((c, i) => {
    lista.appendChild(crearElemento(c, i));
  });
}

function eliminarComentarioTareaInterna(id, idx, parentIdx = null) {
  let tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  let key = "tareasInternas";
  let t = tareas.find(x => x.id === id);
  if (!t) {
    tareas = JSON.parse(localStorage.getItem("tareasInternasArchivadas")) || [];
    key = "tareasInternasArchivadas";
    t = tareas.find(x => x.id === id);
  }
  if (!t) return;
  if (parentIdx === null) {
    t.comentarios.splice(idx, 1);
  } else if (t.comentarios[parentIdx] && t.comentarios[parentIdx].respuestas) {
    t.comentarios[parentIdx].respuestas.splice(idx, 1);
  }
  localStorage.setItem(key, JSON.stringify(tareas));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("tareasinternas", t);
  }
  renderComentariosTareaInterna(t);
}

function responderComentarioTareaInterna(id, idx) {
  let tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  let key = "tareasInternas";
  let t = tareas.find(x => x.id === id);
  if (!t) {
    tareas = JSON.parse(localStorage.getItem("tareasInternasArchivadas")) || [];
    key = "tareasInternasArchivadas";
    t = tareas.find(x => x.id === id);
  }
  if (!t) return;
  const texto = prompt("Escribe tu respuesta");
  if (!texto) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const resp = { texto, fecha: new Date().toISOString(), autor: usuario.nombre || "" };
  t.comentarios[idx].respuestas = t.comentarios[idx].respuestas || [];
  t.comentarios[idx].respuestas.push(resp);
  localStorage.setItem(key, JSON.stringify(tareas));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("tareasinternas", t);
  }
  renderComentariosTareaInterna(t);
}

function agregarComentarioTareaInterna(id) {
  let tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  let key = "tareasInternas";
  let t = tareas.find(x => x.id === id);
  if (!t) {
    tareas = JSON.parse(localStorage.getItem("tareasInternasArchivadas")) || [];
    key = "tareasInternasArchivadas";
    t = tareas.find(x => x.id === id);
  }
  if (!t) return;
  const texto = document.getElementById("nuevoComentarioTareaInterna").value.trim();
  if (!texto) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  t.comentarios = t.comentarios || [];
  t.comentarios.push({ texto, fecha: new Date().toISOString(), autor: usuario.nombre || "" });
  localStorage.setItem(key, JSON.stringify(tareas));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("tareasinternas", t);
  }
  document.getElementById("nuevoComentarioTareaInterna").value = "";
  renderComentariosTareaInterna(t);
}

function abrirEdicionTareaInterna(id) {
  const tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  const modal = document.getElementById("modalTareaInterna");
  const modalDetalle = document.getElementById("modalDetalleTareaInterna");
  const texto = document.getElementById("tareaInternaTexto");
  const selectAsignado = document.getElementById("tareaInternaAsignadoA");
  const selectCliente = document.getElementById("tareaInternaCliente");
  const selectPrioridad = document.getElementById("tareaInternaPrioridad");
  const inputFechaFin = document.getElementById("tareaInternaFechaFin");
  const inputProximaAccion = document.getElementById("tareaInternaProximaAccion");
  if (texto) texto.value = t.texto;
  if (selectAsignado) setSelectValue(selectAsignado, t.asignadosA || []);
  if (selectCliente) setSelectValue(selectCliente, t.clienteId || "");
  if (selectPrioridad) setSelectValue(selectPrioridad, t.prioridad || "");
  if (inputFechaFin) inputFechaFin.value = t.fechaFin || "";
  if (inputProximaAccion) inputProximaAccion.value = t.proximaAccion || "";
  modal.dataset.editing = id;
  const titulo = modal.querySelector("h3");
  if (titulo) titulo.textContent = "Editar tarea interna";
  if (modalDetalle) modalDetalle.classList.add("oculto");
  modal.classList.remove("oculto");
}

document.addEventListener("DOMContentLoaded", () => {
  const btnNueva = document.getElementById("nuevaTareaInternaBtn");
  const modal = document.getElementById("modalTareaInterna");
  const cerrar = document.getElementById("cerrarModalTareaInterna");
  const form = document.getElementById("tareaInternaForm");
  const selectAsignado = document.getElementById("tareaInternaAsignadoA");
  const selectCliente = document.getElementById("tareaInternaCliente");
  const selectPrioridad = document.getElementById("tareaInternaPrioridad");
  const inputFechaFin = document.getElementById("tareaInternaFechaFin");
  const inputProximaAccion = document.getElementById("tareaInternaProximaAccion");
  const toggleArch = document.getElementById("toggleTareasInternasArchivadas");
  const modalDetalle = document.getElementById("modalDetalleTareaInterna");
  const cerrarDetalle = document.getElementById("cerrarModalDetalleTareaInterna");
  const btnAgregarComentario = document.getElementById("agregarComentarioTareaInterna");
  const btnEditarDetalle = document.getElementById("editarTareaInterna");

  if (btnNueva) {
    btnNueva.addEventListener("click", () => {
      modal.dataset.editing = "";
      const titulo = modal.querySelector("h3");
      if (titulo) titulo.textContent = "Agregar tarea interna";
      if (form) form.reset();
      if (selectAsignado) setSelectValue(selectAsignado, []);
      if (selectCliente) setSelectValue(selectCliente, "");
      if (selectPrioridad) setSelectValue(selectPrioridad, "");
      if (inputFechaFin) inputFechaFin.value = "";
      if (inputProximaAccion) inputProximaAccion.value = "";
      modal.classList.remove("oculto");
    });
  }
  if (cerrar) {
    cerrar.addEventListener("click", () => modal.classList.add("oculto"));
    modal.addEventListener("click", e => { if (e.target.id === "modalTareaInterna") modal.classList.add("oculto"); });
  }
  if (cerrarDetalle && modalDetalle) {
    cerrarDetalle.addEventListener("click", () => modalDetalle.classList.add("oculto"));
    modalDetalle.addEventListener("click", e => { if (e.target.id === "modalDetalleTareaInterna") modalDetalle.classList.add("oculto"); });
  }
  if (btnEditarDetalle && modalDetalle) {
    btnEditarDetalle.addEventListener("click", () => {
      const id = parseInt(modalDetalle.dataset.id, 10);
      abrirEdicionTareaInterna(id);
    });
  }
  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const texto = document.getElementById("tareaInternaTexto").value.trim();
      const asignadosA = selectAsignado ? Array.from(selectAsignado.selectedOptions).map(o => o.value) : [];
      const clienteId = selectCliente && selectCliente.value ? parseInt(selectCliente.value, 10) : null;
      const prioridad = selectPrioridad ? selectPrioridad.value : "";
      const fechaFin = inputFechaFin && inputFechaFin.value
        ? inputFechaFin.value
        : new Date().toISOString().slice(0, 10);
      const proximaAccion = inputProximaAccion ? inputProximaAccion.value.trim() : "";
      if (!proximaAccion) {
        mostrarNotificacion("La próxima acción es obligatoria", "#FF9800");
        return;
      }
      if (texto) {
        const tareas = JSON.parse(localStorage.getItem("tareasInternas")) || [];
        if (modal.dataset.editing) {
          const idEdit = parseInt(modal.dataset.editing, 10);
          const t = tareas.find(x => x.id === idEdit);
          if (t) {
            t.texto = texto;
            t.asignadosA = asignadosA;
            t.clienteId = clienteId;
            t.prioridad = prioridad;
            t.fechaFin = fechaFin;
            t.proximaAccion = proximaAccion;
            localStorage.setItem("tareasInternas", JSON.stringify(tareas));
            if (window.supabaseSync) {
              await supabaseSync.pushRegistro("tareasinternas", t);
            }
          }
        } else {
          const nueva = { id: Date.now(), texto, asignadosA, clienteId, prioridad, fechaFin, proximaAccion, creadoEn: new Date().toISOString(), comentarios: [] };
          tareas.push(nueva);
          localStorage.setItem("tareasInternas", JSON.stringify(tareas));
          if (window.supabaseSync) {
            await supabaseSync.pushRegistro("tareasinternas", nueva);
          }
        }
        form.reset();
        if (selectAsignado) setSelectValue(selectAsignado, []);
        if (selectCliente) setSelectValue(selectCliente, "");
        if (selectPrioridad) setSelectValue(selectPrioridad, "");
        if (inputFechaFin) inputFechaFin.value = "";
        if (inputProximaAccion) inputProximaAccion.value = "";
        modal.dataset.editing = "";
        const titulo = modal.querySelector("h3");
        if (titulo) titulo.textContent = "Agregar tarea interna";
        modal.classList.add("oculto");
        cargarTareasInternas();
      }
    });
  }
  if (btnAgregarComentario && modalDetalle) {
    btnAgregarComentario.addEventListener("click", () => {
      const id = parseInt(modalDetalle.dataset.id, 10);
      agregarComentarioTareaInterna(id);
    });
  }
  if (toggleArch) {
    toggleArch.addEventListener("click", () => {
      document.getElementById("tareasInternasArchivadas").classList.toggle("oculto");
    });
  }
  if (selectAsignado && window.supabaseAuth && supabaseAuth.fetchUsers) {
    supabaseAuth.fetchUsers().then(users => {
      selectAsignado.innerHTML = '';
      users.filter(u => u.email !== "admin@gjabogados.cl").forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.nombre || u.email;
        opt.textContent = u.nombre || u.email;
        selectAsignado.appendChild(opt);
      });
      if (typeof enhanceSelect === "function") {
        enhanceSelect(selectAsignado);
        selectAsignado.addEventListener("change", () => {
          if (selectAsignado.choicesInstance) {
            selectAsignado.choicesInstance.hideDropdown();
          }
        });
        selectAsignado.addEventListener("click", () => {
          if (selectAsignado.choicesInstance) {
            selectAsignado.choicesInstance.showDropdown();
          }
        });
      }
    });
  }
  if (selectPrioridad && typeof enhanceSelect === "function") {
    enhanceSelect(selectPrioridad);
  }
  if (selectCliente) {
    const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
    selectCliente.innerHTML = '<option value="">Cliente (opcional)</option>';
    clientes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre;
      selectCliente.appendChild(opt);
    });
    if (typeof enhanceSelect === "function") enhanceSelect(selectCliente);
  }
  cargarTareasInternas();
  cargarTareasInternasArchivadas();
});
