// === EXPEDIENTES.JS ===
// Módulo que maneja toda la lógica para la gestión de expedientes
// Crear, leer, actualizar, eliminar y visualizar detalles

// -------------------------------
// 🔗 ELEMENTOS DEL DOM PRINCIPALES
// -------------------------------
const expForm = document.getElementById("expedienteForm"); // Formulario de expedientes
const expLista = document.getElementById("expedientesLista"); // Lista donde se muestran los expedientes
const expClienteSelect = document.getElementById("exp-cliente"); // Select de clientes disponibles
const expBusquedaInput = document.getElementById("buscarExpedientes");
const expPaginacionDiv = document.getElementById("expedientesPaginacion");
const ordenExpSelect = document.getElementById("ordenExpedientes");
const filtroMateriaExpSelect = document.getElementById("filtroMateriaExp");
const filtroTribunalExpSelect = document.getElementById("filtroTribunalExp");
const filtroTramiteExpSelect = document.getElementById("filtroTramiteExp");

// Obtener valores de los select principales para usar en los filtros
const materias = Array.from(document.querySelectorAll('#exp-materia option'))
  .map(o => o.value)
  .filter(v => v);
const tribunales = Array.from(document.querySelectorAll('#exp-tribunal option'))
  .map(o => o.value)
  .filter(v => v);
const tramites = Array.from(document.querySelectorAll('#exp-tramite option'))
  .map(o => o.value)
  .filter(v => v);

const EXPEDIENTES_POR_PAGINA = 10;
let paginaExpedientes = 1;
let filtroExpediente = "";
let ordenExpedientes = "nuevo";
let filtroMateriaExp = "";
let filtroTribunalExp = "";
let filtroTramiteExp = "";

const listaComentariosCasoDiv = document.getElementById("listaComentariosCaso");
const nuevoComentarioCasoInput = document.getElementById("nuevoComentarioCaso");
const btnAgregarComentarioCaso = document.getElementById("btnAgregarComentarioCaso");

function claseEstadoExp(tramite) {
  switch (tramite) {
    case "No iniciado":
      return "estado-no-iniciado";
    case "En proceso":
      return "estado-en-proceso";
    case "Terminado exitosamente":
      return "estado-terminado";
    case "Término fallido":
      return "estado-fallido";
    case "Impugnado":
      return "estado-impugnado";
    default:
      return "";
  }
}

// Variables de estado para edición
let editandoExpediente = false;
let expedienteEditandoId = null;

// -------------------------------
// 🧠 FUNCIÓN: cargarClientesEnSelect()
// Llena el select de clientes al iniciar la sección de expedientes
// -------------------------------
function cargarClientesEnSelect() {
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  expClienteSelect.innerHTML = '<option value="">Selecciona un cliente</option>';

  clientes.forEach((cliente) => {
    const opcion = document.createElement("option");
    opcion.value = cliente.id;
    opcion.textContent = cliente.nombre;
    expClienteSelect.appendChild(opcion);
  });

  if (typeof enhanceSelect === "function") {
    enhanceSelect(expClienteSelect);
  }
}

// -------------------------------
// 🧠 FUNCIÓN: cargarFiltrosExpedientes()

  filtroMateriaExpSelect.innerHTML = '<option value="">Todas las materias</option>';
  materias.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    filtroMateriaExpSelect.appendChild(opt);
  });

  if (typeof enhanceSelect === "function") {
    enhanceSelect(filtroMateriaExpSelect);
  }

  filtroTribunalExpSelect.innerHTML = '<option value="">Todos los tribunales</option>';
  tribunales.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    filtroTribunalExpSelect.appendChild(opt);
  });

  if (typeof enhanceSelect === "function") {
    enhanceSelect(filtroTribunalExpSelect);
  }


  filtroTramiteExpSelect.innerHTML = '<option value="">Todos los estados</option>';
  tramites.forEach(tr => {
    const opt = document.createElement('option');
    opt.value = tr;
    opt.textContent = tr;
    filtroTramiteExpSelect.appendChild(opt);
  });

  if (typeof enhanceSelect === "function") {
    enhanceSelect(filtroTramiteExpSelect);
  }

// -------------------------------
// 🧠 FUNCIÓN: cargarExpedientes()
// Carga los expedientes desde localStorage y los muestra
// -------------------------------
function cargarExpedientes() {
  expLista.innerHTML = "";
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];

  const filtrados = expedientes.filter(exp => {
    const cliente = clientes.find(c => c.id === exp.clienteId);
    const nombreCliente = cliente ? cliente.nombre : "";
    const busqueda = filtroExpediente.toLowerCase();
    const coincideBusqueda =
      exp.titulo.toLowerCase().includes(busqueda) ||
      nombreCliente.toLowerCase().includes(busqueda) ||
      (exp.materia || "").toLowerCase().includes(busqueda) ||
      (exp.tribunal || "").toLowerCase().includes(busqueda) ||
      (exp.rol || "").toLowerCase().includes(busqueda);
    const coincideMateria = !filtroMateriaExp || exp.materia === filtroMateriaExp;
    const coincideTribunal = !filtroTribunalExp || exp.tribunal === filtroTribunalExp;
    const coincideTramite = !filtroTramiteExp || exp.tramite === filtroTramiteExp;
    return coincideBusqueda && coincideMateria && coincideTribunal && coincideTramite;
  });

  if (ordenExpedientes === "antiguo") {
    filtrados.sort((a, b) => a.id - b.id);
  } else {
    filtrados.sort((a, b) => b.id - a.id);
  }

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / EXPEDIENTES_POR_PAGINA));
  if (paginaExpedientes > totalPaginas) paginaExpedientes = totalPaginas;
  const inicio = (paginaExpedientes - 1) * EXPEDIENTES_POR_PAGINA;
  const visibles = filtrados.slice(inicio, inicio + EXPEDIENTES_POR_PAGINA);

  visibles.forEach(exp => {
    const cliente = clientes.find(c => c.id === exp.clienteId);
    const nombreCliente = cliente ? cliente.nombre : "Cliente desconocido";
    const clase = claseEstadoExp(exp.tramite);

    const li = document.createElement("div");
    li.className = "element-card";
    li.innerHTML = `
      <div class="expediente-titulo"><strong>${exp.titulo} (${nombreCliente})</strong></div>
      <div>Materia: ${exp.materia}</div>
      <div>Rol: ${exp.rol || "Sin número"}</div>
      <div>Variable: ${exp.variable}</div>
      <div>Tribunal: ${exp.tribunal || "No especificado"}</div>
      <div class="estado-line">Estado: <span class="estado ${clase}">${exp.tramite}</span></div>
      <div>Responsable: ${exp.responsable || "Sin asignar"}</div>
      <div>Próxima acción: ${exp.proximaAccion || "-"}</div>
      <button class="boton-eliminar" onclick="eliminarExpediente(${exp.id}); event.stopPropagation();">🗑 Eliminar</button>
      <button class="boton-archivar" onclick="archivarExpediente(${exp.id}); event.stopPropagation();">📦 Archivar</button>
    `;

    li.addEventListener("click", () => {
      verDetalleExpediente(exp.id);
    });
    expLista.appendChild(li);
  });

  expPaginacionDiv.innerHTML = "";
  if (totalPaginas > 1) {
    const prev = document.createElement("button");
    prev.textContent = "Anterior";
    prev.disabled = paginaExpedientes === 1;
    prev.addEventListener("click", () => {
      paginaExpedientes--;
      cargarExpedientes();
    });

    const info = document.createElement("span");
    info.textContent = ` Página ${paginaExpedientes} de ${totalPaginas} `;

    const next = document.createElement("button");
    next.textContent = "Siguiente";
    next.disabled = paginaExpedientes === totalPaginas;
    next.addEventListener("click", () => {
      paginaExpedientes++;
      cargarExpedientes();
    });

    expPaginacionDiv.appendChild(prev);
    expPaginacionDiv.appendChild(info);
    expPaginacionDiv.appendChild(next);
  }
}

// -------------------------------
// 🧾 EVENTO: Envío del formulario de expediente
// -------------------------------
// Abrir el formulario en el modal de expediente
document.getElementById("abrirFormularioExpediente").addEventListener("click", () => {
  mostrarModal(document.getElementById("modalFormularioExpediente"));
});

// Cerrar el modal al hacer clic en el botón de cerrar
document.getElementById("modalCerrarExpediente").addEventListener("click", () => {
  document.getElementById("modalFormularioExpediente").classList.add("oculto");
});

// También cerramos el modal si se hace clic fuera de la zona del modal
document.getElementById("modalFormularioExpediente").addEventListener("click", (event) => {
  if (event.target.id === "modalFormularioExpediente") {
    document.getElementById("modalFormularioExpediente").classList.add("oculto");
  }
});
expForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const ahora = new Date().toISOString();
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const nuevoExp = {
    id: editandoExpediente ? expedienteEditandoId : Date.now(),
    created_at: editandoExpediente
      ? (JSON.parse(localStorage.getItem("expedientes")) || []).find(e => e.id === expedienteEditandoId)?.created_at || ahora
      : ahora,
    updated_at: ahora,
    clienteId: parseInt(document.getElementById("exp-cliente").value),
    titulo: document.getElementById("exp-titulo").value,
    tribunal: document.getElementById("exp-tribunal").value || "no indicado",
    rol: document.getElementById("exp-rol").value || "no indicado",
    materia: document.getElementById("exp-materia").value || "no indicado",
    propuesta: document.getElementById("exp-propuesta").value || "no indicado",
    honorarios: (() => {
      const h = document.getElementById("exp-honorarios").value;
      return h ? parseInt(h) : "no indicado";
    })(),
    variable: document.getElementById("exp-variable").value || "Sin variable",
    tramite: document.getElementById("exp-tramite").value || "no indicado",
    responsable: document.getElementById("exp-responsable").value.trim() || "Sin asignar",
    etapaProcesal: document.getElementById("exp-etapa-procesal").value.trim() || "Sin etapa",
    fechaControl: document.getElementById("exp-fecha-control").value || new Date().toISOString().slice(0, 10),
    proximaAccion: document.getElementById("exp-proxima-accion").value.trim(),
    creadoPor: editandoExpediente
      ? (JSON.parse(localStorage.getItem("expedientes")) || []).find(e => e.id === expedienteEditandoId)?.creadoPor || usuario.nombre
      : usuario.nombre,
  };

  if (!nuevoExp.proximaAccion) {
    mostrarNotificacion("Debe indicar la próxima acción del caso", "#FF9800");
    return;
  }

  let expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];

  const eraEdicion = editandoExpediente;
  if (editandoExpediente) {
    expedientes = expedientes.map((e) => (e.id === nuevoExp.id ? nuevoExp : e));
    editandoExpediente = false;
    expedienteEditandoId = null;
  } else {
    expedientes.push(nuevoExp);
  }

  localStorage.setItem("expedientes", JSON.stringify(expedientes));
  let ok = true;
  if (window.supabaseSync) {
    ok = await supabaseSync.pushRegistro("expedientes", nuevoExp);
  }
  if (ok) {
    mostrarNotificacion("Datos guardados", "#00E500");
    const accion = eraEdicion ? "modificado" : "creado";
    registrarNotificacion(
      `Caso "${nuevoExp.titulo}" ${accion} por ${usuario.nombre}`,
      "expedientes"
    );
    if (!eraEdicion) {
      const flujosPorMateria = {
        version: "v2.0",
        familia: ["Revisión de antecedentes", "Borrador de escrito inicial", "Coordinar audiencia"],
        laboral: ["Revisión documental laboral", "Definir estrategia probatoria", "Seguimiento con cliente"],
        default: ["Revisión del caso", "Definir plan de acción"],
      };
      const baseFlujos = [];
      const materia = (nuevoExp.materia || "").toLowerCase();
      if (materia.includes("familia")) {
        baseFlujos.push(...flujosPorMateria.familia);
      } else if (materia.includes("laboral") || materia.includes("trabajo")) {
        baseFlujos.push(...flujosPorMateria.laboral);
      } else {
        baseFlujos.push(...flujosPorMateria.default);
      }
      let tareas = JSON.parse(localStorage.getItem("tareas") || "[]");
      for (const titulo of baseFlujos) {
        const t = {
          id: Date.now() + Math.floor(Math.random() * 10000),
          titulo: `[Flujo] ${titulo}`,
          descripcion: `Tarea automática creada por flujo de ${nuevoExp.materia || "caso general"}.`,
          expedienteId: nuevoExp.id,
          inicio: new Date().toISOString().slice(0, 10),
          fin: "",
          estado: "Pendiente",
          prioridad: "media",
          creadoPor: usuario.nombre || "Sistema",
          proximaAccion: "Actualizar avance y fijar siguiente hito",
          flujoVersion: flujosPorMateria.version,
        };
        tareas.push(t);
        if (window.supabaseSync) await supabaseSync.pushRegistro("tareas", t);
      }
      localStorage.setItem("tareas", JSON.stringify(tareas));
    }
    if (["Terminado exitosamente", "Término fallido"].includes(nuevoExp.tramite)) {
      archivarExpediente(nuevoExp.id);
    }
    expForm.reset();
    document
      .getElementById("modalFormularioExpediente")
      .classList.add("oculto"); // Cerrar el modal
    cargarExpedientes();
  } else if (window.supabaseSync) {
    mostrarNotificacion(
      "Los datos no se pudieron sincronizar. Intente nuevamente",
      "#FF0000"
    );
  }
});


// -------------------------------
// ✏️ FUNCIÓN: editarExpediente(id)
// Carga el expediente en el formulario para modificarlo
// -------------------------------
function editarExpediente(id) {
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const exp = expedientes.find((e) => e.id === id);
  if (!exp) return;

  setSelectValue(document.getElementById("exp-cliente"), exp.clienteId);
  document.getElementById("exp-titulo").value = exp.titulo;
  setSelectValue(
    document.getElementById("exp-tribunal"),
    exp.tribunal === "no indicado" ? "" : exp.tribunal
  );
  document.getElementById("exp-rol").value =
    exp.rol === "no indicado" ? "" : exp.rol;
  setSelectValue(
    document.getElementById("exp-materia"),
    exp.materia === "no indicado" ? "" : exp.materia
  );
  document.getElementById("exp-honorarios").value =
    exp.honorarios === "no indicado" ? "" : exp.honorarios;
  setSelectValue(
    document.getElementById("exp-variable"),
    exp.variable === "Sin variable" ? "" : exp.variable
  );
  setSelectValue(
    document.getElementById("exp-propuesta"),
    exp.propuesta === "no indicado" ? "" : exp.propuesta
  );
  setSelectValue(
    document.getElementById("exp-tramite"),
    exp.tramite === "no indicado" ? "" : exp.tramite
  );
  document.getElementById("exp-responsable").value = exp.responsable || "";
  document.getElementById("exp-etapa-procesal").value = exp.etapaProcesal || "";
  document.getElementById("exp-fecha-control").value = exp.fechaControl || "";
  document.getElementById("exp-proxima-accion").value = exp.proximaAccion || "";

  editandoExpediente = true;
  expedienteEditandoId = id;
}

// -------------------------------
// 🗑 FUNCIÓN: eliminarExpediente(id)
// Elimina un expediente del almacenamiento local
// -------------------------------
function eliminarExpediente(id) {
  if (!confirm("¿Eliminar expediente?")) return;
  let expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const exp = expedientes.find(e => e.id === id);
  expedientes = expedientes.filter((e) => e.id !== id);
  localStorage.setItem("expedientes", JSON.stringify(expedientes));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("expedientes", id);
    if (exp) supabaseSync.pushRegistro("casosarchivados", exp);
  }
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  if (exp) {
    registrarNotificacion(`Caso "${exp.titulo}" eliminado por ${usuario.nombre}`, "expedientes");
  }
  cargarExpedientes();
}

// -------------------------------
// 📦 FUNCIÓN: archivarExpediente(id)
function archivarExpediente(id) {
  let expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const exp = expedientes.find(e => e.id === id);
  if (!exp) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  exp.archivadoEn = new Date().toISOString();
  exp.archivadoPor = usuario.nombre || "";
  expedientes = expedientes.filter(e => e.id !== id);
  localStorage.setItem("expedientes", JSON.stringify(expedientes));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("expedientes", id);
    supabaseSync.pushRegistro("casosarchivados", exp);
  }

  const archivados = JSON.parse(localStorage.getItem("expedientesArchivados")) || [];
  archivados.push(exp);
  localStorage.setItem("expedientesArchivados", JSON.stringify(archivados));

  registrarNotificacion(`Caso "${exp.titulo}" archivado por ${usuario.nombre}`, "expedientes");

  cargarExpedientes();
  cargarExpedientesArchivados();
}

// -------------------------------
// ↩️ FUNCIÓN: desarchivarExpediente(id)
function desarchivarExpediente(id) {
  let archivados = JSON.parse(localStorage.getItem("expedientesArchivados")) || [];
  const exp = archivados.find(e => e.id === id);
  if (!exp) return;
  archivados = archivados.filter(e => e.id !== id);
  exp.tramite = "En proceso";
  delete exp.archivadoEn;
  delete exp.archivadoPor;

  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  expedientes.push(exp);
  localStorage.setItem("expedientes", JSON.stringify(expedientes));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("expedientes", exp);
    supabaseSync.deleteRegistro("casosarchivados", id);
  }
  localStorage.setItem("expedientesArchivados", JSON.stringify(archivados));

  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  registrarNotificacion(`Caso "${exp.titulo}" desarchivado por ${usuario.nombre}`, "expedientes");

  cargarExpedientes();
  cargarExpedientesArchivados();
}

// -------------------------------
// 👁 FUNCIÓN: verDetalleExpediente(id)
// Muestra detalles del expediente en un modal, incluyendo sus tareas asociadas
// -------------------------------
function verDetalleExpediente(id) {
  const expedientes = JSON.parse(localStorage.getItem("expedientes")) || [];
  const archivados = JSON.parse(localStorage.getItem("expedientesArchivados")) || [];
  const todos = expedientes.concat(archivados);
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  const tareas = JSON.parse(localStorage.getItem("tareas")) || [];

  const exp = todos.find((e) => e.id === id);
  if (!exp) return;

  const cliente = clientes.find((c) => c.id === exp.clienteId);
  const nombreCliente = cliente ? cliente.nombre : "Cliente desconocido";

  // Buscamos las tareas asociadas al expediente
  const tareasAsociadas = tareas.filter(t => t.expedienteId === exp.id);

  let tareasHTML = `<p class="full-span"><strong>📋 GESTIONES ASOCIADAS:</strong></p>`;
  if (tareasAsociadas.length === 0) {
    tareasHTML += `<p class="full-span">🔸 No hay tareas asociadas.</p>`;
  } else {
    tareasHTML += tareasAsociadas
      .map(
        (t) => `
        <div class="tarea-mini-card full-span" onclick="abrirModalTareaDesdeExpediente(${t.id})">
          <strong>${t.titulo}</strong> (${t.prioridad})
          <div>${formatearCorta(t.inicio)} - ${formatearCorta(t.fin)}</div>
        </div>`
      )
      .join("");
  }

  // Construimos el contenido del modal
  const texto = `
    <p class="full-span"><strong>📁 TÍTULO:</strong> ${exp.titulo} (${nombreCliente})</p>
    <p><strong>👤 CLIENTE:</strong> ${nombreCliente}</p>
    <p><strong>🏛️ TRIBUNAL:</strong> ${exp.tribunal || "No especificado"}</p>
    <p><strong>📄 ROL:</strong> ${exp.rol || "Sin número"}</p>
    <p><strong>📂 MATERIA:</strong> ${exp.materia}</p>
    <p><strong>💰 HONORARIOS:</strong> ${
      exp.honorarios === "no indicado"
        ? "No indicado"
        : `$${Number(exp.honorarios).toLocaleString("es-CL")}`
    }</p>
    <p><strong>📈 VARIABLE:</strong> ${exp.variable}</p>
    <p class="full-span"><strong>📌 PROPUESTA:</strong> ${exp.propuesta}</p>
    <p class="full-span"><strong>⚙️ TRÁMITE:</strong> ${exp.tramite}</p>
    <p><strong>👨‍⚖️ RESPONSABLE:</strong> ${exp.responsable || "Sin asignar"}</p>
    <p><strong>🧭 ETAPA:</strong> ${exp.etapaProcesal || "-"}</p>
    <p><strong>🗓 CONTROL:</strong> ${exp.fechaControl || "-"}</p>
    <p class="full-span"><strong>✅ PRÓXIMA ACCIÓN:</strong> ${exp.proximaAccion || "-"}</p>
    ${tareasHTML}
    <hr class="full-span"><p class="full-span"><strong>👤 Creado por:</strong> ${exp.creadoPor || "Desconocido"}</p>
    ${exp.archivadoEn ? `<p class="full-span"><strong>📦 Archivado:</strong> ${new Date(exp.archivadoEn).toLocaleString()} por ${exp.archivadoPor || "Desconocido"}</p>` : ""}
  `;

  // Insertamos HTML en el modal y lo mostramos
  document.getElementById("modalExpTexto").innerHTML = texto;
  renderComentariosCaso(id);
  if (btnAgregarComentarioCaso) {
    btnAgregarComentarioCaso.onclick = () => agregarComentarioCaso(id, exp.titulo);
  }
  if (nuevoComentarioCasoInput) nuevoComentarioCasoInput.value = "";

  const botonEditar = document.getElementById("modalExpedienteEditar");
  botonEditar.onclick = () => {
    document.getElementById("modalExpediente").classList.add("oculto");
    editarExpediente(id);
    mostrarModal(document.getElementById("modalFormularioExpediente"));
  };

  mostrarModal(document.getElementById("modalExpediente"));
}

// -------------------------------
// 📃 Función: cargarExpedientesArchivados
// -------------------------------
function cargarExpedientesArchivados() {
  const cont = document.getElementById("expedientesArchivadosLista");
  if (!cont) return;
  cont.innerHTML = "";

  const archivados = JSON.parse(localStorage.getItem("expedientesArchivados")) || [];
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];

  if (archivados.length === 0) {
    cont.textContent = "No hay casos archivados";
    return;
  }

  archivados.forEach(exp => {
    const cliente = clientes.find(c => c.id === exp.clienteId);
    const nombreCliente = cliente ? cliente.nombre : "Cliente";
    const clase = claseEstadoExp(exp.tramite);
    const card = document.createElement("div");
    card.className = "element-card";
    card.innerHTML = `
      <div class="expediente-titulo"><strong>${exp.titulo} (${nombreCliente})</strong></div>
      <div>Materia: ${exp.materia}</div>
      <div>Rol: ${exp.rol || "Sin número"}</div>
      <div>Tribunal: ${exp.tribunal || "No especificado"}</div>
      <div class="estado-line">Estado: <span class="estado ${clase}">${exp.tramite}</span></div>
      <div>Archivado: ${new Date(exp.archivadoEn).toLocaleString()} por ${exp.archivadoPor || "Desconocido"}</div>
      <button class="boton-desarchivar" onclick="desarchivarExpediente(${exp.id}); event.stopPropagation();">↩️ Desarchivar</button>
    `;
    card.addEventListener('click', () => verDetalleExpediente(exp.id));
    cont.appendChild(card);
  });
}

// -------------------------------
// 🔗 FUNCIÓN auxiliar para abrir tareas desde el modal de expediente
// -------------------------------
function abrirModalTareaDesdeExpediente(id) {
  verDetalleTarea(id); // usa la función que ya tienes
}

// -------------------------------
// 💬 Comentarios de casos
// -------------------------------
function obtenerComentariosCaso(id) {
  const todos = JSON.parse(localStorage.getItem("comentariosCasos")) || [];
  return todos
    .filter(c => c.expedienteId === id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function renderComentariosCaso(id) {
  if (!listaComentariosCasoDiv) return;
  const comentarios = obtenerComentariosCaso(id);
  listaComentariosCasoDiv.innerHTML = "";
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
    edit.addEventListener("click", () => editarComentarioCaso(c.id, id));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "🗑 Eliminar";
    del.className = "mini-boton mini-boton-eliminar";
    del.addEventListener("click", () => eliminarComentarioCaso(c.id, id));
    acciones.append(edit, del);
    li.append(cont, acciones);
    listaComentariosCasoDiv.appendChild(li);
  });
}

function editarComentarioCaso(comentId, casoId) {
  const todos = JSON.parse(localStorage.getItem("comentariosCasos")) || [];
  const comentario = todos.find(c => c.id === comentId);
  if (!comentario) return;
  const nuevo = prompt("Editar comentario", comentario.texto);
  if (nuevo === null) return;
  comentario.texto = nuevo.trim();
  comentario.updated_at = new Date().toISOString();
  localStorage.setItem("comentariosCasos", JSON.stringify(todos));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("comentarios_expedientes", comentario);
  }
  renderComentariosCaso(casoId);
}

function eliminarComentarioCaso(comentId, casoId) {
  if (!confirm("¿Eliminar comentario?")) return;
  let todos = JSON.parse(localStorage.getItem("comentariosCasos")) || [];
  todos = todos.filter(c => c.id !== comentId);
  localStorage.setItem("comentariosCasos", JSON.stringify(todos));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("comentarios_expedientes", comentId);
  }
  renderComentariosCaso(casoId);
}

async function agregarComentarioCaso(id, titulo) {
  const texto = nuevoComentarioCasoInput.value.trim();
  if (!texto) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const nuevo = {
    id: Date.now(),
    expedienteId: id,
    texto,
    creadoPor: usuario.nombre,
    created_at: new Date().toISOString(),
  };
  const todos = JSON.parse(localStorage.getItem("comentariosCasos")) || [];
  todos.push(nuevo);
  localStorage.setItem("comentariosCasos", JSON.stringify(todos));
  let ok = true;
  if (window.supabaseSync) {
    ok = await supabaseSync.pushRegistro("comentarios_expedientes", nuevo);
  }
  if (ok) {
    mostrarNotificacion("Comentario agregado", "#00E500");
    registrarNotificacion(
      `Nuevo comentario en caso "${titulo}" por ${usuario.nombre}`,
      "expedientes"
    );
    nuevoComentarioCasoInput.value = "";
    renderComentariosCaso(id);
  } else if (window.supabaseSync) {
    mostrarNotificacion(
      "Los datos no se pudieron sincronizar. Intente nuevamente",
      "#FF0000"
    );
  }
}

// -------------------------------
// ❌ Cierre del modal de expediente
// -------------------------------
document.getElementById("modalExpCerrar").addEventListener("click", () => {
  document.getElementById("modalExpediente").classList.add("oculto");
  if (nuevoComentarioCasoInput) nuevoComentarioCasoInput.value = "";
});

// También cerramos si el usuario hace clic fuera del contenido del modal
document.getElementById("modalExpediente").addEventListener("click", (e) => {
  if (e.target.id === "modalExpediente") {
    e.target.classList.add("oculto");
    if (nuevoComentarioCasoInput) nuevoComentarioCasoInput.value = "";
  }
});
// -------------------------------
// 🚀 INICIALIZACIÓN AL CARGAR
// -------------------------------
// Carga inicial de clientes y expedientes
document.addEventListener("DOMContentLoaded", () => {
  cargarClientesEnSelect();
  cargarFiltrosExpedientes();

  expBusquedaInput.addEventListener("input", e => {
    filtroExpediente = e.target.value;
    paginaExpedientes = 1;
    cargarExpedientes();
  });

  ordenExpSelect.addEventListener("change", e => {
    ordenExpedientes = e.target.value;
    cargarExpedientes();
  });

  filtroMateriaExpSelect.addEventListener("change", e => {
    filtroMateriaExp = e.target.value;
    cargarExpedientes();
  });

  filtroTribunalExpSelect.addEventListener("change", e => {
    filtroTribunalExp = e.target.value;
    cargarExpedientes();
  });

  filtroTramiteExpSelect.addEventListener("change", e => {
    filtroTramiteExp = e.target.value;
    cargarExpedientes();
  });

  cargarExpedientes();
  cargarExpedientesArchivados();

  const toggleArchivadosBtn = document.getElementById("toggleExpedientesArchivados");
  const listaArchivados = document.getElementById("expedientesArchivadosLista");
  if (toggleArchivadosBtn && listaArchivados) {
    toggleArchivadosBtn.addEventListener("click", () => {
      if (listaArchivados.classList.contains("oculto")) {
        cargarExpedientesArchivados();
        listaArchivados.classList.remove("oculto");
        toggleArchivadosBtn.textContent = "Ocultar casos archivados";
      } else {
        listaArchivados.classList.add("oculto");
        toggleArchivadosBtn.textContent = "Mostrar casos archivados";
      }
    });
  }
});
