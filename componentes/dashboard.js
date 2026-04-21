// === dashboard.js ===
// Módulo para gestionar el panel de control (resúmenes, alertas, tareas destacadas y cronograma)

// ✅ FUNCIÓN PRINCIPAL
let cargandoEquipo = false;
function actualizarDashboard() {
  mostrarEquipo();
  cargarTareasDia();
  cargarTareasDiaArchivadas();
  if (typeof cargarAudiencias === "function") {
    cargarAudiencias();
  }
}


// 👥 Mostrar lista de abogados registrados
async function mostrarEquipo() {
  if (cargandoEquipo) return;
  cargandoEquipo = true;
  const lista = document.getElementById("equipoLista");
  if (!lista) {
    cargandoEquipo = false;
    return;
  }
  lista.innerHTML = "";
  let usuarios = [];
  if (window.supabaseAuth && supabaseAuth.fetchUsers) {
    usuarios = await supabaseAuth.fetchUsers();
  }
  usuarios
    .filter((u) => u.email !== "admin@gjabogados.cl")
    .forEach((u) => {
      const li = document.createElement("li");
      li.textContent = `👨‍⚖️ ${u.nombre || u.email}`;
      lista.appendChild(li);
    });
  cargandoEquipo = false;
}

// 📌 Mostrar tareas asignadas al usuario actual

function cargarTareasDia() {
  const contenedores = document.querySelectorAll("#tareasDiaLista, #tareasDiaListaDashboard");
  if (!contenedores.length) return;
  const tareas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  const orden = { alta: 0, media: 1, baja: 2 };
  tareas.sort((a, b) => {
    const pa = orden[a.prioridad] ?? 3;
    const pb = orden[b.prioridad] ?? 3;
    if (pa !== pb) return pa - pb;
    const fa = a.fechaFin ? parseFechaLocal(a.fechaFin) : new Date(8640000000000000);
    const fb = b.fechaFin ? parseFechaLocal(b.fechaFin) : new Date(8640000000000000);
    return fa - fb;
  });
  contenedores.forEach(cont => {
    cont.innerHTML = "";
    tareas.forEach(t => {
      const div = document.createElement("div");
      div.className = "tarea-dia-card";
      if (t.prioridad === "baja") {
        div.classList.add("tarea-dia-baja");
      } else if (t.prioridad === "media") {
        div.classList.add("tarea-dia-media");
      } else if (t.prioridad === "alta") {
        div.classList.add("tarea-dia-alta");
      }
      div.addEventListener("click", () => verDetalleTareaDia(t.id));
      const textos = document.createElement("div");
      textos.className = "tarea-dia-textos";
      const span = document.createElement("span");
      span.textContent = t.texto;
      span.className = "tarea-dia-texto";
      span.title = t.texto;
      textos.appendChild(span);
      const asignados = t.asignadosA || (t.asignadoA ? [t.asignadoA] : []);
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
      acciones.className = "tarea-dia-acciones";
      const comp = document.createElement("button");
      comp.textContent = "✔️";
      comp.className = "mini-boton tarea-dia-check";
      comp.addEventListener("click", e => { e.stopPropagation(); completarTareaDia(t.id); });
      const del = document.createElement("button");
      del.textContent = "🗑";
      del.className = "mini-boton tarea-dia-delete";
      del.addEventListener("click", e => { e.stopPropagation(); eliminarTareaDia(t.id); });
      acciones.appendChild(comp);
      acciones.appendChild(del);
      div.appendChild(textos);
      div.appendChild(acciones);
      cont.appendChild(div);
    });
  });
  document
    .querySelectorAll("#tareasDiaCantidad, #tareasDiaCantidadDashboard")
    .forEach(cant => (cant.textContent = tareas.length));
  const headerTotal = document.getElementById("totalTareasPendientes");
  if (headerTotal) headerTotal.textContent = tareas.length;
  cargarMisTareas();
}

function completarTareaDia(id) {
  let tareas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  const t = tareas.find(x => x.id === id);
  if (!t) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  t.archivadoEn = new Date().toISOString();
  t.archivadoPor = usuario.nombre || "";
  tareas = tareas.filter(x => x.id !== id);
  localStorage.setItem("tareasDia", JSON.stringify(tareas));
  const arch = JSON.parse(localStorage.getItem("tareasDiaArchivadas")) || [];
  arch.push(t);
  localStorage.setItem("tareasDiaArchivadas", JSON.stringify(arch));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("diario", id);
    supabaseSync.pushRegistro("diarioarchivadas", t);
  }
  registrarNotificacion(`Tarea diaria completada por ${usuario.nombre}`, "dashboard");
  cargarTareasDia();
  cargarTareasDiaArchivadas();
}

function eliminarTareaDia(id) {
  if (!confirm("¿Eliminar esta tarea?")) return;
  let tareas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem("tareasDia", JSON.stringify(tareas));
  if (window.supabaseSync) supabaseSync.deleteRegistro("diario", id);
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  registrarNotificacion(`Tarea diaria eliminada por ${usuario.nombre}`, "dashboard");
  cargarTareasDia();
}

function cargarTareasDiaArchivadas() {
  const cont = document.getElementById("tareasDiaArchivadas");
  if (!cont) return;
  cont.innerHTML = "";
  const tareas = JSON.parse(localStorage.getItem("tareasDiaArchivadas")) || [];
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
    if (t.prioridad === "baja") {
      div.classList.add("tarea-dia-baja");
    } else if (t.prioridad === "media") {
      div.classList.add("tarea-dia-media");
    } else if (t.prioridad === "alta") {
      div.classList.add("tarea-dia-alta");
    }
    div.addEventListener("click", () => verDetalleTareaDia(t.id));
    const span = document.createElement("span");
    const asignados = t.asignadosA || (t.asignadoA ? [t.asignadoA] : []);
    const asignado = asignados.length ? ` (${asignados.join(", ")})` : "";
    const fechaCreacion = t.creadoEn ? `Creada: ${new Date(t.creadoEn).toLocaleDateString()} | ` : "";
    span.textContent = `${t.texto}${asignado} (${fechaCreacion}Archivado: ${new Date(t.archivadoEn).toLocaleString()} por ${t.archivadoPor || "Desconocido"})`;
    span.className = "tarea-dia-texto";
    span.title = t.texto;
    const del = document.createElement("button");
    del.textContent = "🗑";
    del.className = "mini-boton tarea-dia-delete";
    del.addEventListener("click", e => { e.stopPropagation(); eliminarTareaDiaArchivada(t.id); });
    div.appendChild(span);
    div.appendChild(del);
    cont.appendChild(div);
  });
}

function eliminarTareaDiaArchivada(id) {
  if (!confirm("¿Eliminar tarea archivada?")) return;
  let tareas = JSON.parse(localStorage.getItem("tareasDiaArchivadas")) || [];
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem("tareasDiaArchivadas", JSON.stringify(tareas));
  if (window.supabaseSync) supabaseSync.deleteRegistro("diarioarchivadas", id);
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  registrarNotificacion(`Tarea diaria archivada eliminada por ${usuario.nombre}`, "dashboard");
  cargarTareasDiaArchivadas();
}

function verDetalleTareaDia(id) {
  const activas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  const archivadas = JSON.parse(localStorage.getItem("tareasDiaArchivadas")) || [];
  const todas = activas.concat(archivadas);
  const t = todas.find(x => x.id === id);
  const modal = document.getElementById("modalDetalleTareaDia");
  if (!t || !modal) return;
  if (window.mostrarDetalleEntidad) {
    window.mostrarDetalleEntidad("tarea_dia", t);
    return;
  }
  document.getElementById("detalleTareaTitulo").textContent = `📝 ${t.texto}`;
  const nombres = t.asignadosA || (t.asignadoA ? [t.asignadoA] : []);
  const asignado = nombres.length ? nombres.join(", ") : "Sin asignar";
  const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
  const cliente = clientes.find((c) => c.id === t.clienteId);
  const clienteTxt = cliente ? ` · Cliente: ${cliente.nombre}` : "";
  document.getElementById("detalleTareaAsignado").textContent = `👥 Asignado a: ${asignado}`;
  document.getElementById("detalleTareaFecha").textContent = t.creadoEn ? `📅 Creada: ${new Date(t.creadoEn).toLocaleString()}` : "";
  document.getElementById("detalleTareaVence").textContent = t.fechaFin ? `⏳ Vence: ${formatearCorta(t.fechaFin)}` : "";
  const proxima = document.getElementById("detalleTareaFecha");
  if (proxima) {
    const base = t.creadoEn ? `📅 Creada: ${new Date(t.creadoEn).toLocaleString()}` : "";
    proxima.textContent = `${base}${clienteTxt}${t.proximaAccion ? ` · ✅ Próxima acción: ${t.proximaAccion}` : ""}`;
  }
  renderComentariosTareaDia(t);
  modal.dataset.id = id;
  modal.classList.remove("oculto");
}

function cargarMisTareas() {
  const contenedores = document.querySelectorAll("#misTareasLista, #misTareasListaDashboard");
  if (!contenedores.length) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const nombre = usuario.nombre || usuario.email || "";
  const tareas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  const mis = tareas.filter(t => (t.asignadosA || []).includes(nombre));
  const orden = { alta: 0, media: 1, baja: 2 };
  mis.sort((a, b) => {
    const pa = orden[a.prioridad] ?? 3;
    const pb = orden[b.prioridad] ?? 3;
    if (pa !== pb) return pa - pb;
    const fa = a.fechaFin ? parseFechaLocal(a.fechaFin) : new Date(8640000000000000);
    const fb = b.fechaFin ? parseFechaLocal(b.fechaFin) : new Date(8640000000000000);
    return fa - fb;
  });
  contenedores.forEach(cont => {
    cont.innerHTML = "";
    mis.forEach(t => {
      const div = document.createElement("div");
      div.className = "tarea-dia-card";
      if (t.prioridad === "baja") {
        div.classList.add("tarea-dia-baja");
      } else if (t.prioridad === "media") {
        div.classList.add("tarea-dia-media");
      } else if (t.prioridad === "alta") {
        div.classList.add("tarea-dia-alta");
      }
      div.addEventListener("click", () => verDetalleTareaDia(t.id));
      const textos = document.createElement("div");
      textos.className = "tarea-dia-textos";
      const span = document.createElement("span");
      span.textContent = t.texto;
      span.className = "tarea-dia-texto";
      span.title = t.texto;
      textos.appendChild(span);
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
      acciones.className = "tarea-dia-acciones";
      const comp = document.createElement("button");
      comp.textContent = "✔️";
      comp.className = "mini-boton tarea-dia-check";
      comp.addEventListener("click", e => { e.stopPropagation(); completarTareaDia(t.id); });
      const del = document.createElement("button");
      del.textContent = "🗑";
      del.className = "mini-boton tarea-dia-delete";
      del.addEventListener("click", e => { e.stopPropagation(); eliminarTareaDia(t.id); });
      acciones.appendChild(comp);
      acciones.appendChild(del);
      div.appendChild(textos);
      div.appendChild(acciones);
      cont.appendChild(div);
    });
  });
  document
    .querySelectorAll("#misTareasCantidad, #misTareasCantidadDashboard")
    .forEach(cant => (cant.textContent = mis.length));
  const headerMis = document.getElementById("misTareasPendientes");
  if (headerMis) headerMis.textContent = mis.length;
}

function renderComentariosTareaDia(t) {
  const lista = document.getElementById("listaComentariosTarea");
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
    btnDel.addEventListener("click", () => eliminarComentarioTareaDia(t.id, idx, parentIdx));
    acciones.appendChild(btnDel);
    if (parentIdx === null) {
      const btnResp = document.createElement("button");
      btnResp.textContent = "Responder";
      btnResp.className = "mini-boton";
      btnResp.addEventListener("click", () => responderComentarioTareaDia(t.id, idx));
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

function eliminarComentarioTareaDia(id, idx, parentIdx = null) {
  let tareas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  let key = "tareasDia";
  let t = tareas.find(x => x.id === id);
  if (!t) {
    tareas = JSON.parse(localStorage.getItem("tareasDiaArchivadas")) || [];
    key = "tareasDiaArchivadas";
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
    const tabla = key === "tareasDia" ? "diario" : "diarioarchivadas";
    supabaseSync.pushRegistro(tabla, t);
  }
  renderComentariosTareaDia(t);
}

function responderComentarioTareaDia(id, idx) {
  let tareas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  let key = "tareasDia";
  let t = tareas.find(x => x.id === id);
  if (!t) {
    tareas = JSON.parse(localStorage.getItem("tareasDiaArchivadas")) || [];
    key = "tareasDiaArchivadas";
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
    const tabla = key === "tareasDia" ? "diario" : "diarioarchivadas";
    supabaseSync.pushRegistro(tabla, t);
  }
  renderComentariosTareaDia(t);
}

function agregarComentarioTareaDia(id) {
  let tareas = JSON.parse(localStorage.getItem("tareasDia")) || [];
  let key = "tareasDia";
  let t = tareas.find(x => x.id === id);
  if (!t) {
    tareas = JSON.parse(localStorage.getItem("tareasDiaArchivadas")) || [];
    key = "tareasDiaArchivadas";
    t = tareas.find(x => x.id === id);
  }
  if (!t) return;
  const texto = document.getElementById("nuevoComentarioTarea").value.trim();
  if (!texto) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  t.comentarios = t.comentarios || [];
  t.comentarios.push({ texto, fecha: new Date().toISOString(), autor: usuario.nombre || "" });
  localStorage.setItem(key, JSON.stringify(tareas));
  if (window.supabaseSync) {
    const tabla = key === "tareasDia" ? "diario" : "diarioarchivadas";
    supabaseSync.pushRegistro(tabla, t);
  }
  document.getElementById("nuevoComentarioTarea").value = "";
  renderComentariosTareaDia(t);
}

// 🚀 Cargar al iniciar
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("modalTareaDia");
  const cerrar = document.getElementById("cerrarModalTareaDia");
  const form = document.getElementById("tareaDiaForm");
  const selectAsignado = document.getElementById("tareaDiaAsignadoA");
  const selectCliente = document.getElementById("tareaDiaCliente");
  const selectPrioridad = document.getElementById("tareaDiaPrioridad");
  const inputFechaFin = document.getElementById("tareaDiaFechaFin");
  const inputProximaAccion = document.getElementById("tareaDiaProximaAccion");
  const modalDetalle = document.getElementById("modalDetalleTareaDia");
  const cerrarDetalle = document.getElementById("cerrarModalDetalleTareaDia");
  const btnAgregarComentario = document.getElementById("agregarComentarioTarea");
  const btnEditarDetalle = document.getElementById("editarTareaDia");
  document.querySelectorAll("#nuevaTareaDiaBtn, #nuevaTareaDiaBtnDashboard").forEach(btnNueva => {
    btnNueva.addEventListener("click", () => {
      modal.dataset.editing = "";
      const titulo = modal.querySelector("h3");
      if (titulo) titulo.textContent = "Agregar tarea";
      if(form) form.reset();
      if(selectAsignado) setSelectValue(selectAsignado, []);
      if (selectCliente) setSelectValue(selectCliente, "");
      if(selectPrioridad) setSelectValue(selectPrioridad, "");
      if(inputFechaFin) inputFechaFin.value = "";
      if(inputProximaAccion) inputProximaAccion.value = "";
      modal.classList.remove("oculto");
    });
  });
  document.querySelectorAll("#actualizarPaginaBtn, #actualizarPaginaBtnDashboard").forEach(btnActualizar => {
    btnActualizar.addEventListener("click", () => {
      if (window.refrescarDatos) window.refrescarDatos();
    });
  });
  if(cerrar){
    cerrar.addEventListener("click", () => modal.classList.add("oculto"));
    modal.addEventListener("click", e => { if(e.target.id==="modalTareaDia") modal.classList.add("oculto"); });
  }
  if(cerrarDetalle && modalDetalle){
    cerrarDetalle.addEventListener("click", () => modalDetalle.classList.add("oculto"));
    modalDetalle.addEventListener("click", e => { if(e.target.id==="modalDetalleTareaDia") modalDetalle.classList.add("oculto"); });
  }
  if(btnEditarDetalle && modalDetalle){
    btnEditarDetalle.addEventListener("click", () => {
      const id = parseInt(modalDetalle.dataset.id,10);
      abrirEdicionTareaDia(id);
    });
  }
  if(form){
    form.addEventListener("submit", async e=>{
      e.preventDefault();
      const texto=document.getElementById("tareaDiaTexto").value.trim();
      const asignadosA = selectAsignado
        ? Array.from(selectAsignado.selectedOptions).map(o => o.value)
        : [];
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
      if(texto){
        const tareas=JSON.parse(localStorage.getItem("tareasDia"))||[];
        if (modal.dataset.editing) {
          const idEdit = parseInt(modal.dataset.editing,10);
          const t = tareas.find(x => x.id === idEdit);
          if (t) {
            t.texto = texto;
            t.asignadosA = asignadosA;
            t.clienteId = clienteId;
            t.prioridad = prioridad;
            t.fechaFin = fechaFin;
            t.proximaAccion = proximaAccion;
            localStorage.setItem("tareasDia",JSON.stringify(tareas));
            if (window.supabaseSync) {
              await supabaseSync.pushRegistro("diario", t);
            }
            mostrarNotificacion("Tarea actualizada", "#00E500");
          }
        } else {
          const nueva={id:Date.now(),texto,asignadosA,clienteId,prioridad,fechaFin,proximaAccion,creadoEn:new Date().toISOString(),comentarios:[]};
          tareas.push(nueva);
          localStorage.setItem("tareasDia",JSON.stringify(tareas));
          let ok = true;
          if (window.supabaseSync) {
            ok = await supabaseSync.pushRegistro("diario", nueva);
          }
          if (ok) {
            mostrarNotificacion("Datos guardados", "#00E500");
            const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
            registrarNotificacion(
              `Tarea diaria creada por ${usuario.nombre}`,
              "dashboard"
            );
          } else if (window.supabaseSync) {
            mostrarNotificacion(
              "Los datos no se pudieron sincronizar. Intente nuevamente",
              "#FF0000"
            );
          }
        }
        form.reset();
        if(selectAsignado){
          setSelectValue(selectAsignado, []);
        }
        if (selectCliente) {
          setSelectValue(selectCliente, "");
        }
        if(selectPrioridad){
          setSelectValue(selectPrioridad, "");
        }
        if(inputFechaFin){
          inputFechaFin.value = "";
        }
        if(inputProximaAccion){
          inputProximaAccion.value = "";
        }
        modal.dataset.editing = "";
        const titulo = modal.querySelector("h3");
        if (titulo) titulo.textContent = "Agregar tarea";
        modal.classList.add("oculto");
        cargarTareasDia();
      }
    });
  }
  if(btnAgregarComentario && modalDetalle){
    btnAgregarComentario.addEventListener("click", ()=>{
      const id = parseInt(modalDetalle.dataset.id,10);
      agregarComentarioTareaDia(id);
    });
  }
  const toggleArch = document.getElementById("toggleTareasDiaArchivadas");
  if(toggleArch){
    toggleArch.addEventListener("click", ()=>{
      const arch = document.getElementById("tareasDiaArchivadas");
      if(arch) arch.classList.toggle("oculto");
    });
  }
  document.querySelectorAll("#expandirTareasDiaBtn, #expandirTareasDiaBtnDashboard").forEach(btnExpandir => {
    const listaId = btnExpandir.id === "expandirTareasDiaBtnDashboard" ? "tareasDiaListaDashboard" : "tareasDiaLista";
    const listaDia = document.getElementById(listaId);
    if(listaDia){
      btnExpandir.addEventListener("click", ()=>{
        listaDia.classList.toggle("expandido");
        listaDia.classList.toggle("tareas-limitadas");
        btnExpandir.textContent = listaDia.classList.contains("expandido")
          ? "Ver menos"
          : "Ver más";
      });
    }
  });

  document.querySelectorAll("#expandirMisTareasBtn, #expandirMisTareasBtnDashboard").forEach(btnExpandir => {
    const listaId = btnExpandir.id === "expandirMisTareasBtnDashboard" ? "misTareasListaDashboard" : "misTareasLista";
    const lista = document.getElementById(listaId);
    if(lista){
      btnExpandir.addEventListener("click", ()=>{
        lista.classList.toggle("expandido");
        lista.classList.toggle("tareas-limitadas");
        btnExpandir.textContent = lista.classList.contains("expandido") ? "Ver menos" : "Ver más";
      });
    }
  });

  if(selectAsignado && window.supabaseAuth && supabaseAuth.fetchUsers){
    supabaseAuth.fetchUsers().then(users => {
      selectAsignado.innerHTML = '';
      users
        .filter(u => u.email !== "admin@gjabogados.cl")
        .forEach(u => {
          const opt = document.createElement("option");
          opt.value = u.nombre || u.email;
          opt.textContent = u.nombre || u.email;
          selectAsignado.appendChild(opt);
        });
      if(typeof enhanceSelect === "function"){
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

  if(selectPrioridad && typeof enhanceSelect === "function"){
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


  actualizarDashboard();
});

function abrirEdicionTareaDia(id){
  const tareas=JSON.parse(localStorage.getItem("tareasDia"))||[];
  const t=tareas.find(x=>x.id===id);
  if(!t) return;
  const modal=document.getElementById("modalTareaDia");
  const modalDetalle=document.getElementById("modalDetalleTareaDia");
  const texto=document.getElementById("tareaDiaTexto");
  const selectAsignado=document.getElementById("tareaDiaAsignadoA");
  const selectPrioridad=document.getElementById("tareaDiaPrioridad");
  const selectCliente = document.getElementById("tareaDiaCliente");
  const inputFechaFin=document.getElementById("tareaDiaFechaFin");
  const inputProximaAccion = document.getElementById("tareaDiaProximaAccion");
  if(texto) texto.value=t.texto;
  if(selectAsignado) setSelectValue(selectAsignado, t.asignadosA || []);
  if(selectPrioridad) setSelectValue(selectPrioridad, t.prioridad || "");
  if (selectCliente) setSelectValue(selectCliente, t.clienteId || "");
  if(inputFechaFin) inputFechaFin.value = t.fechaFin || "";
  if (inputProximaAccion) inputProximaAccion.value = t.proximaAccion || "";
  modal.dataset.editing=id;
  const titulo=modal.querySelector("h3");
  if(titulo) titulo.textContent="Editar tarea";
  if(modalDetalle) modalDetalle.classList.add("oculto");
  modal.classList.remove("oculto");
}
