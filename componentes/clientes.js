// === CLIENTES.JS ===
// Este archivo maneja toda la lógica del módulo de clientes
// Incluye: Crear, Leer, Actualizar, Eliminar y Mostrar Detalles

// ----------------------------------------------------------------------------------
// 🧠 VARIABLES GLOBALES (nivel de relevancia: ALTA)
// Estas variables nos permiten acceder a elementos clave del DOM (HTML)
const form = document.getElementById("clienteForm");      // Formulario de ingreso
const lista = document.getElementById("clientesLista");   // Lista donde se muestran los clientes
const busquedaInput = document.getElementById("buscarClientes"); // Barra de búsqueda
const paginacionDiv = document.getElementById("clientesPaginacion"); // Controles de página
const cotizacionesListaDiv = document.getElementById("cotizacionesLista");
const btnAgregarCot = document.getElementById("agregarCotizacion");
const listaComentariosDiv = document.getElementById("listaComentariosCliente");
const nuevoComentarioInput = document.getElementById("nuevoComentarioCliente");
const btnAgregarComentario = document.getElementById("btnAgregarComentarioCliente");

let cotizacionesTemp = [];

const CLIENTES_POR_PAGINA = 10;
let paginaClientes = 1;
let filtroCliente = "";

let modoEdicion = false;         // BOOLEANO: indica si estamos editando un cliente
let clienteEditandoId = null;    // ID del cliente que estamos editando

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

function resetCotizaciones() {
  cotizacionesTemp = [];
  if (cotizacionesListaDiv) cotizacionesListaDiv.innerHTML = "";
}

function renderCotizaciones() {
  if (!cotizacionesListaDiv) return;
  cotizacionesListaDiv.innerHTML = "";
  cotizacionesTemp.forEach((c, i) => {
    const item = document.createElement("div");
    item.className = "cotizacion-item";
    const span = document.createElement("span");
    span.innerHTML = c.link
      ? `<a href="${c.link}" target="_blank">${c.numero}</a>`
      : c.numero;
    const edit = document.createElement("button");
    edit.textContent = "✏️ Editar";
    edit.type = "button";
    edit.className = "mini-boton mini-boton-editar";
    edit.addEventListener("click", () => mostrarFilaCotizacion(c, i));
    const del = document.createElement("button");
    del.textContent = "🗑 Eliminar";
    del.type = "button";
    del.className = "mini-boton mini-boton-eliminar";
    del.addEventListener("click", () => {
      cotizacionesTemp.splice(i, 1);
      renderCotizaciones();
    });
    item.append(span, edit, del);
    cotizacionesListaDiv.appendChild(item);
  });
}

function mostrarFilaCotizacion(data = {}, index = null) {
  if (!cotizacionesListaDiv) return;
  const fila = document.createElement("div");
  fila.className = "cotizacion-input";
  const num = document.createElement("input");
  num.type = "text";
  num.placeholder = "Número";
  num.value = data.numero || "";
  const link = document.createElement("input");
  link.type = "url";
  link.placeholder = "Link";
  link.value = data.link || "";
  const guardar = document.createElement("button");
  guardar.type = "button";
  guardar.textContent = "Guardar";
  guardar.className = "mini-boton";
  guardar.addEventListener("click", () => {
    const numero = num.value.trim();
    if (!numero) return;
    const linkVal = link.value.trim();
    const url = linkVal && !/^https?:\/\//i.test(linkVal)
      ? `https://${linkVal}`
      : linkVal;
    const obj = { numero, link: url };
    if (index !== null) {
      cotizacionesTemp[index] = obj;
    } else {
      cotizacionesTemp.push(obj);
    }
    renderCotizaciones();
  });
  fila.append(num, link, guardar);
  cotizacionesListaDiv.appendChild(fila);
  num.focus();
}

if (btnAgregarCot) {
  btnAgregarCot.addEventListener("click", () => mostrarFilaCotizacion());
}

function obtenerComentarios(id) {
  const todos = JSON.parse(localStorage.getItem("comentariosClientes")) || [];
  return todos
    .filter(c => c.clienteId === id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function renderComentarios(id) {
  if (!listaComentariosDiv) return;
  const comentarios = obtenerComentarios(id);
  listaComentariosDiv.innerHTML = "";
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
    edit.addEventListener("click", () => editarComentario(c.id, id));
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "🗑 Eliminar";
    del.className = "mini-boton mini-boton-eliminar";
    del.addEventListener("click", () => eliminarComentario(c.id, id));
    acciones.append(edit, del);
    li.append(cont, acciones);
    listaComentariosDiv.appendChild(li);
  });
}

function editarComentario(comentId, clienteId) {
  const todos = JSON.parse(localStorage.getItem("comentariosClientes")) || [];
  const comentario = todos.find(c => c.id === comentId);
  if (!comentario) return;
  const nuevo = prompt("Editar comentario", comentario.texto);
  if (nuevo === null) return;
  comentario.texto = nuevo.trim();
  comentario.updated_at = new Date().toISOString();
  localStorage.setItem("comentariosClientes", JSON.stringify(todos));
  if (window.supabaseSync) {
    supabaseSync.pushRegistro("comentarios_clientes", comentario);
  }
  renderComentarios(clienteId);
}

function eliminarComentario(comentId, clienteId) {
  if (!confirm("¿Eliminar comentario?")) return;
  let todos = JSON.parse(localStorage.getItem("comentariosClientes")) || [];
  todos = todos.filter(c => c.id !== comentId);
  localStorage.setItem("comentariosClientes", JSON.stringify(todos));
  if (window.supabaseSync) {
    supabaseSync.deleteRegistro("comentarios_clientes", comentId);
  }
  renderComentarios(clienteId);
}

async function agregarComentario(id, nombre) {
  const texto = nuevoComentarioInput.value.trim();
  if (!texto) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const nuevo = {
    id: Date.now(),
    clienteId: id,
    texto,
    creadoPor: usuario.nombre,
    created_at: new Date().toISOString(),
  };
  const todos = JSON.parse(localStorage.getItem("comentariosClientes")) || [];
  todos.push(nuevo);
  localStorage.setItem("comentariosClientes", JSON.stringify(todos));
  let ok = true;
  if (window.supabaseSync) {
    ok = await supabaseSync.pushRegistro("comentarios_clientes", nuevo);
  }
  if (ok) {
    mostrarNotificacion("Comentario agregado", "#00E500");
    registrarNotificacion(
      `Nuevo comentario en cliente "${nombre}" por ${usuario.nombre}`,
      "clientes"
    );
    nuevoComentarioInput.value = "";
    renderComentarios(id);
  } else if (window.supabaseSync) {
    mostrarNotificacion(
      "Los datos no se pudieron sincronizar. Intente nuevamente",
      "#FF0000"
    );
  }
}

// ----------------------------------------------------------------------------------
// 🚀 FUNCIÓN: cargarClientes()
// Tipo: Función declarada
// Descripción: Obtiene los clientes desde localStorage y los muestra en pantalla
function cargarClientes() {
  lista.innerHTML = "";

  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  const totalSpan = document.getElementById("clientesTotal");
  if (totalSpan) totalSpan.textContent = `(${clientes.length})`;

  const filtrados = clientes
    .filter(c => c.nombre.toLowerCase().includes(filtroCliente.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / CLIENTES_POR_PAGINA));
  if (paginaClientes > totalPaginas) paginaClientes = totalPaginas;

  const inicio = (paginaClientes - 1) * CLIENTES_POR_PAGINA;
  const visibles = filtrados.slice(inicio, inicio + CLIENTES_POR_PAGINA);

  visibles.forEach(cliente => {
    const li = document.createElement("div");
    li.className = "element-card";
    const drive =
      cliente.link && cliente.link !== "no indicado"
        ? `<a href="${cliente.link}" target="_blank" class="drive-btn"><img src="drive_button.png" alt="Google Drive" class="drive-icon"></a>`
        : "";

    li.innerHTML = `
      <div class="cliente-row"><strong>${cliente.nombre}</strong>${drive}</div>
      <div class="cliente-contacto">${cliente.correo} | ${cliente.telefono}</div>
      <button class="boton-eliminar" data-id="${cliente.id}">🗑 Eliminar</button>
    `;

    li.addEventListener("click", event => {
      if (event.target.tagName !== 'BUTTON') {
        verDetalleCliente(cliente.id);
      }
    });

    const botonEliminar = li.querySelector(".boton-eliminar");
    botonEliminar.addEventListener("click", event => {
      event.stopPropagation();
      eliminarCliente(cliente.id);
    });

    lista.appendChild(li);
  });

  paginacionDiv.innerHTML = "";
  if (totalPaginas > 1) {
    const prev = document.createElement("button");
    prev.textContent = "Anterior";
    prev.disabled = paginaClientes === 1;
    prev.addEventListener("click", () => {
      paginaClientes--;
      cargarClientes();
    });

    const info = document.createElement("span");
    info.textContent = ` Página ${paginaClientes} de ${totalPaginas} `;

    const next = document.createElement("button");
    next.textContent = "Siguiente";
    next.disabled = paginaClientes === totalPaginas;
    next.addEventListener("click", () => {
      paginaClientes++;
      cargarClientes();
    });

    paginacionDiv.appendChild(prev);
    paginacionDiv.appendChild(info);
    paginacionDiv.appendChild(next);
  }
}
// ----------------------------------------------------------------------------------
// 🚀 FUNCIÓN: guardarCliente(event)
// Tipo: Función callback para evento 'submit'
// Descripción: Guarda un nuevo cliente o actualiza uno existente
// Abrir el modal al hacer clic en el botón
document.getElementById("abrirFormulario").addEventListener("click", () => {
  document.getElementById("modalFormulario").classList.remove("oculto");
  resetCotizaciones();
});
// Cerrar el modal al hacer clic en el botón de cerrar
document.getElementById("modalCerrar").addEventListener("click", () => {
  document.getElementById("modalFormulario").classList.add("oculto");
  resetCotizaciones();
});

// También cerrar el modal si se hace clic fuera de la zona del modal
document.getElementById("modalFormulario").addEventListener("click", (event) => {
  if (event.target.id === "modalFormulario") {
    document.getElementById("modalFormulario").classList.add("oculto");
    resetCotizaciones();
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault(); // Previene que se recargue la página

  // Captura de datos del formulario (INPUTS)
  const ahora = new Date().toISOString();
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  const cliente = {
    id: modoEdicion ? clienteEditandoId : Date.now(),
    created_at: modoEdicion
      ? (JSON.parse(localStorage.getItem("clientes")) || []).find(c => c.id === clienteEditandoId)?.created_at || ahora
      : ahora,
    updated_at: ahora,
    nombre: document.getElementById("nombre").value,
    correo: document.getElementById("correo").value,
    telefono: document.getElementById("telefono").value,
    direccion: document.getElementById("direccion").value || "no indicado",
    rut: document.getElementById("rut").value || "no indicado",
    confidencial: document.getElementById("confidencial").value || "no indicado",
    link: document.getElementById("link").value || "no indicado", // 💥 ¡Nuevo campo agregado!
    cotizaciones: cotizacionesTemp.slice(),
    creadoPor: modoEdicion
      ? (JSON.parse(localStorage.getItem("clientes")) || []).find(c => c.id === clienteEditandoId)?.creadoPor || usuario.nombre
      : usuario.nombre
  };

  // Accedemos a la base actual de clientes
  let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  const accion = modoEdicion ? "modificado" : "creado";

  if (modoEdicion) {
    // Si estamos editando, reemplazamos al cliente anterior
    clientes = clientes.map(c => (c.id === cliente.id ? cliente : c));
    modoEdicion = false;
    clienteEditandoId = null;
  } else {
    // Si es nuevo, lo agregamos al final
    clientes.push(cliente);
  }

  // Guardamos en localStorage
  localStorage.setItem("clientes", JSON.stringify(clientes));
  let ok = true;
  if (window.supabaseSync) {
    ok = await supabaseSync.pushRegistro("clientes", cliente);
  }
  if (ok) {
    mostrarNotificacion("Datos guardados", "#00E500");
    registrarNotificacion(
      `Cliente "${cliente.nombre}" ${accion} por ${usuario.nombre}`,
      "clientes"
    );
    // Limpiamos formulario, cerramos el modal y recargamos lista
    form.reset();
    resetCotizaciones();
    document.getElementById("modalFormulario").classList.add("oculto");
    cargarClientes();
  } else if (window.supabaseSync) {
    mostrarNotificacion(
      "Los datos no se pudieron sincronizar. Intente nuevamente",
      "#FF0000"
    );
  }
});

// ----------------------------------------------------------------------------------
// 🚀 FUNCIÓN: editarCliente(id)
// Tipo: Función de acción
// Descripción: Carga los datos del cliente en el formulario para editar
function editarCliente(id) {
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  const cliente = clientes.find(c => c.id === id);
  if (!cliente) return;

  // Cargamos los datos en los campos del formulario
  document.getElementById("nombre").value = cliente.nombre;
  document.getElementById("correo").value = cliente.correo;
  document.getElementById("telefono").value = cliente.telefono;
  document.getElementById("direccion").value =
    cliente.direccion === "no indicado" ? "" : cliente.direccion;
  document.getElementById("rut").value =
    cliente.rut === "no indicado" ? "" : cliente.rut;
  document.getElementById("confidencial").value =
    cliente.confidencial === "no indicado" ? "" : cliente.confidencial;
  document.getElementById("link").value =
    cliente.link && cliente.link !== "no indicado" ? cliente.link : "";

  cotizacionesTemp = Array.isArray(cliente.cotizaciones)
    ? cliente.cotizaciones.slice()
    : [];
  renderCotizaciones();

  modoEdicion = true;
  clienteEditandoId = id;
}

// ----------------------------------------------------------------------------------
// 🚀 FUNCIÓN: eliminarCliente(id)
// Tipo: Función de acción
// Descripción: Elimina un cliente por su ID
function eliminarCliente(id) {
  if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

  let clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  const cli = clientes.find(c => c.id === id);
  clientes = clientes.filter(c => c.id !== id);

  localStorage.setItem("clientes", JSON.stringify(clientes));
  if (window.supabaseSync) supabaseSync.deleteRegistro("clientes", id);
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "{}");
  if (cli) {
    registrarNotificacion(`Cliente "${cli.nombre}" eliminado por ${usuario.nombre}`, "clientes");
  }
  cargarClientes(); // Recargar la lista de clientes después de la eliminación
}

// ----------------------------------------------------------------------------------
// 🚀 FUNCIÓN: verDetalleCliente(id)
// Tipo: Función informativa
// Descripción: Muestra un modal con todos los datos del cliente
function verDetalleCliente(id) {
  const clientes = JSON.parse(localStorage.getItem("clientes")) || [];
  const cliente = clientes.find(c => c.id === id);
  if (!cliente) return;
  if (window.mostrarDetalleEntidad) {
    window.mostrarDetalleEntidad("cliente", cliente);
    return;
  }

  const modal = document.getElementById("modalCliente");
  const modalTexto = document.getElementById("modalTexto");

  // Usamos innerHTML para permitir enlaces clickeables
  let html = `
    <p><strong>👤 Nombre:</strong> ${cliente.nombre}</p>
    <p><strong>📧 Correo:</strong> ${cliente.correo}</p>
    <p><strong>📞 Teléfono:</strong> ${cliente.telefono}</p>
    <p><strong>📍 Dirección:</strong> ${cliente.direccion || "No indicada"}</p>
    <p><strong>🆔 RUT:</strong> ${cliente.rut || "No indicado"}</p>
    <p><strong>📝 Notas:</strong> ${cliente.confidencial || "Sin observaciones"}</p>
    <p><strong>📂 Carpeta:</strong> ${cliente.link ? `<a href="${cliente.link}" target="_blank" class="drive-btn"><img src="drive_button.png" alt="Google Drive" class="drive-icon"></a>` : "No disponible"}</p>
    <p class="full-span"><strong>📑 Cotizaciones:</strong></p>
    <ul class="cotizacion-detalle full-span">
      ${
        (cliente.cotizaciones || [])
          .map(c => `<li>${c.link ? `<a href="${c.link}" target="_blank">${c.numero}</a>` : c.numero}</li>`)
          .join("") || "<li>Ninguna</li>"
      }
    </ul>
    <hr class="full-span"><p class="full-span"><strong>👤 Creado por:</strong> ${cliente.creadoPor || "Desconocido"}</p>
  `;

  const contComentarios = document.getElementById("comentariosCliente");
  modalTexto.innerHTML = html;
  const ulCot = modalTexto.querySelector(".cotizacion-detalle");
  if (contComentarios && ulCot) {
    modalTexto.insertBefore(contComentarios, ulCot.nextSibling);
  }

  renderComentarios(id);
  if (btnAgregarComentario) {
    btnAgregarComentario.onclick = () => agregarComentario(id, cliente.nombre);
  }
  if (nuevoComentarioInput) nuevoComentarioInput.value = "";

  const botonEditar = document.getElementById("modalClienteEditar");
  botonEditar.onclick = () => {
    modal.classList.add("oculto");
    editarCliente(id);
    document.getElementById("modalFormulario").classList.remove("oculto");
  };

  modal.classList.remove("oculto");
}

// Evento para cerrar el modal
document.getElementById("modalClienteCerrar").addEventListener("click", () => {
  document.getElementById("modalCliente").classList.add("oculto");
  if (nuevoComentarioInput) nuevoComentarioInput.value = "";
});

// También cerramos si el usuario hace clic fuera del contenido del modal
document.getElementById("modalCliente").addEventListener("click", (e) => {
  if (e.target.id === "modalCliente") {
    e.target.classList.add("oculto");
    if (nuevoComentarioInput) nuevoComentarioInput.value = "";
  }
});

// ----------------------------------------------------------------------------------
// 🔁 Inicialización automática al cargar esta sección
// Importante: Esto se ejecuta apenas se carga este archivo
busquedaInput.addEventListener("input", e => {
  filtroCliente = e.target.value;
  paginaClientes = 1;
  cargarClientes();
});

cargarClientes();
