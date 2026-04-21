// === script.js ===
// Este archivo contiene la lógica principal para la navegación entre vistas
// en la aplicación AbogApp Beta. En el futuro, aquí también se pueden inicializar
// funciones globales o cargar datos al iniciar la app.

// -----------------------------------------------------------------------------------
// FUNCIÓN: cambiarVista
// Tipo: Función declarada
// Objetivo: Oculta todas las secciones (.vista) y muestra solo la seleccionada.
// Nivel de relevancia: 🔥 Crítico. Es el corazón de la navegación entre módulos.
let vistaActual = localStorage.getItem("ultimaVista") || "dashboard";

// ------------------------------
// ⏳ Manejo de expiración de sesión
// ------------------------------
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas
let sessionTimer;
let sessionStart = parseInt(localStorage.getItem("sessionStart") || Date.now());
window.sesionExpirada = false;

const DEFAULT_CONFIG = {
  radius: "12px",
  tema: "original",
  fuente: "16px",
  formatoFecha: "DMY",
  formatoHora: "24",
};

const NOMBRES_POR_EMAIL = {
  "cgorrono@gjabogados.cl": "Carlos Gorroño Vega",
  "ijara@gjabogados.cl": "Ignacio Jara Álvarez",
  "jmgorrono@gjabogados.cl": "José M. Gorroño Vega",
};
function esUsuarioAdmin(usuario) {
  if (!usuario) return false;
  const rol = (usuario.rol || "").toLowerCase();
  return Boolean(usuario.esAdmin) || ["admin", "socio"].includes(rol) || usuario.usuario === "admin@gjabogados.cl";
}

function usuarioKey(base) {
  const u = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  return u ? `${base}_${u.usuario}` : base;
}

let configuracion =
  JSON.parse(localStorage.getItem(usuarioKey("configuracion")) || "null") ||
  DEFAULT_CONFIG;
delete configuracion.transparencia;
if (configuracion.tema === "actual") {
  configuracion.tema = "original";
}

function parseFechaLocal(fecha) {
  if (!fecha) return null;
  const partes = fecha.split("-").map(Number);
  return partes.length === 3 ? new Date(partes[0], partes[1] - 1, partes[2]) : new Date(fecha);
}

function formatearCorta(fecha) {
  if (!fecha) return "-";
  let d;
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    d = parseFechaLocal(fecha);
  } else {
    d = new Date(fecha);
  }
  if (isNaN(d)) return fecha;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function mostrarToast(mensaje, color = null) {
  if (window.Toastify) {
    const bg =
      color ||
      getComputedStyle(document.documentElement).getPropertyValue(
        "--color-principal"
      );
    Toastify({
      text: mensaje,
      duration: 3000,
      close: true,
      gravity: "top",
      position: "center",
      style: {
        background: bg.trim(),
        color: "#fff",
      },
    }).showToast();
    return;
  }
  const notif = document.getElementById("appNotification");
  if (!notif) return;
  notif.textContent = mensaje;
  if (color) {
    notif.style.backgroundColor = color;
  } else {
    notif.style.backgroundColor = "";
  }
  notif.classList.remove("oculto");
  setTimeout(() => notif.classList.add("oculto"), 3000);
}

function mostrarNotificacion(mensaje, color = null) {
  mostrarToast(mensaje, color);
}

function verificarEscritura(clave, id) {
  const lista = JSON.parse(localStorage.getItem(clave)) || [];
  return lista.some((e) => e.id === id);
}

function agregarNotificacionLocal(notif) {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const tsLimpiar =
    parseInt(localStorage.getItem(`notificaciones_limpiar_${usuario.usuario}`)) ||
    0;
  const notifTime = new Date(notif.ts).getTime();
  if (notifTime <= tsLimpiar) return;
  const clave = `notificaciones_${usuario.usuario}`;
  const lista = JSON.parse(localStorage.getItem(clave)) || [];
  if (!lista.some((n) => n.id === notif.id)) {
    lista.unshift(notif);
    localStorage.setItem(clave, JSON.stringify(lista));
    actualizarCentroNotificaciones();
    if (window.Notification) {
      if (Notification.permission === "granted") {
        new Notification(notif.mensaje);
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") new Notification(notif.mensaje);
        });
      }
    }
  }
}

window.recibirNotificacionSupabase = agregarNotificacionLocal;

function registrarNotificacion(mensaje, destino = "dashboard") {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const notif = {
    id: Date.now(),
    mensaje,
    destino,
    ts: new Date().toISOString(),
    creadoPor: usuario.nombre,
  };
  agregarNotificacionLocal(notif);
  if (window.supabaseSync && supabaseSync.pushNotificacion) {
    supabaseSync.pushNotificacion(notif);
  }
}

function obtenerNotificaciones() {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return [];
  const clave = `notificaciones_${usuario.usuario}`;
  const tsLimpiar =
    parseInt(localStorage.getItem(`notificaciones_limpiar_${usuario.usuario}`)) ||
    0;
  const datos = JSON.parse(localStorage.getItem(clave)) || [];
  return datos.filter((n) => new Date(n.ts).getTime() > tsLimpiar);
}

function actualizarCentroNotificaciones() {
  const listaEl = document.getElementById("listaNotificaciones");
  const contadorEl = document.getElementById("contadorNotificaciones");
  if (!listaEl) return;
  const datos = obtenerNotificaciones();
  listaEl.innerHTML = "";
  datos.forEach((n) => {
    const li = document.createElement("li");
    const fecha = new Date(n.ts).toLocaleString("es-CL");
    li.textContent = `${fecha}: ${n.mensaje}`;
    if (n.destino) {
      li.classList.add("clickable-notif");
      li.addEventListener("click", () => {
        cambiarVista(n.destino);
        const centro = document.getElementById("centroNotificaciones");
        if (centro) centro.classList.add("oculto");
      });
    }
    listaEl.appendChild(li);
  });
  if (contadorEl) {
    if (datos.length > 0) {
      contadorEl.textContent = datos.length;
      contadorEl.classList.remove("oculto");
    } else {
      contadorEl.classList.add("oculto");
    }
  }
}

function limpiarNotificaciones() {
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const ts = Date.now();
  localStorage.setItem(`notificaciones_limpiar_${usuario.usuario}`, String(ts));
  localStorage.removeItem(`notificaciones_${usuario.usuario}`);
  actualizarCentroNotificaciones();
}

async function cargarNotificacionesDesdeSupabase() {
  if (!window.supabaseSync || !supabaseSync.fetchNotificaciones) return;
  const usuario = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (!usuario) return;
  const datos = await supabaseSync.fetchNotificaciones();
  const tsLimpiar =
    parseInt(localStorage.getItem(`notificaciones_limpiar_${usuario.usuario}`)) ||
    0;
  const filtrados = datos.filter(
    (n) => new Date(n.ts).getTime() > tsLimpiar
  );
  const clave = `notificaciones_${usuario.usuario}`;
  localStorage.setItem(clave, JSON.stringify(filtrados));
  actualizarCentroNotificaciones();
}

async function cerrarSesion() {
  localStorage.removeItem("usuarioActual");
  localStorage.removeItem("sessionStart");
  if (window.sb && sb.auth) {
    try {
      await sb.auth.signOut();
    } catch (e) {
      console.warn("Supabase signOut falló", e);
    }
  }
  location.reload();
}

function expirarSesion() {
  window.sesionExpirada = true;
  mostrarAlertaModal(
    "⚠️ Tu sesión ha expirado por inactividad. Los datos que ingreses no se sincronizarán con la base de datos."
  );
  document.body.classList.add("blurred");
  const app = document.getElementById("app");
  if (app) app.classList.add("blurred");
  cerrarSesion();
}

function aplicarConfiguracion() {
  document.documentElement.style.setProperty("--radius", configuracion.radius);
  document.documentElement.style.fontSize = configuracion.fuente;
  document.body.classList.remove(
    "tema-azul",
    "tema-rojo",
    "tema-amarillo",
    "tema-celeste",
    "tema-naranja",
    "tema-rosado",
    "tema-gris"
  );
  if (
    !document.body.classList.contains("dark-mode") &&
    configuracion.tema &&
    configuracion.tema !== "original"
  ) {
    document.body.classList.add("tema-" + configuracion.tema);
  }
}

function actualizarFechaChile() {
  const el = document.getElementById("fechaChile");
  if (el) {
    const ahora = new Date();
    const optsFecha =
      configuracion.formatoFecha === "YMD"
        ? { year: "numeric", month: "2-digit", day: "2-digit" }
        : { day: "2-digit", month: "2-digit", year: "numeric" };
    const optsHora = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: configuracion.formatoHora === "12",
    };
    const fecha = ahora.toLocaleDateString("es-CL", {
      timeZone: "America/Santiago",
      ...optsFecha,
    });
    const hora = ahora.toLocaleTimeString("es-CL", {
      timeZone: "America/Santiago",
      ...optsHora,
    });
    el.textContent = `${fecha} ${hora}`;
  }
}

function actualizarInfoUsuario() {
  const el = document.getElementById("infoUsuario");
  const u = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (el && u) {
    el.textContent = `Usuario: ${u.nombre}`;
  }
}

async function cargarPreferencias() {
  configuracion =
    JSON.parse(localStorage.getItem(usuarioKey("configuracion")) || "null") ||
    DEFAULT_CONFIG;
  if (configuracion.tema === "actual") {
    configuracion.tema = "original";
  }
  const usr = JSON.parse(localStorage.getItem("usuarioActual") || "null");
  if (usr && window.supabaseSync && supabaseSync.obtenerTema) {
    const remoto = await supabaseSync.obtenerTema(usr.usuario);
    if (remoto) configuracion.tema = remoto;
  }
  const mediaPref = window.matchMedia("(prefers-color-scheme: dark)");
  const guardado = localStorage.getItem(usuarioKey("tema"));
  const oscuro = guardado ? guardado === "oscuro" : mediaPref.matches;
  document.body.classList.toggle("dark-mode", oscuro);
  const botonTema = document.getElementById("toggleTema");
  if (botonTema) {
    botonTema.innerHTML = oscuro
      ? "<i class='fa-sharp fa-solid fa-sun'></i><span> Claro</span>"
      : "<i class='fa-sharp fa-solid fa-moon'></i><span> Oscuro</span>";
  }
  aplicarConfiguracion();
}

function reiniciarTemporizador() {
  if (window.sesionExpirada) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(expirarSesion, SESSION_TIMEOUT_MS);
}

function refrescarDatos(modulos = ["clientes", "tareasDia", "audiencias", "dashboard", "hoy", "notificaciones"]) {
  if (modulos.includes("clientes") && typeof cargarClientes === "function") cargarClientes();
  if (modulos.includes("tareasDia") && typeof cargarTareasDia === "function") cargarTareasDia();
  if (modulos.includes("tareasDia") && typeof cargarTareasDiaArchivadas === "function") cargarTareasDiaArchivadas();
  if (modulos.includes("audiencias") && typeof cargarAudiencias === "function") cargarAudiencias();
  if (modulos.includes("audiencias") && typeof cargarAudienciasArchivadas === "function") cargarAudienciasArchivadas();
  if (modulos.includes("dashboard") && typeof actualizarDashboard === "function") actualizarDashboard();
  if (modulos.includes("dashboard")) actualizarKpiResumen();
  if (modulos.includes("hoy")) renderVistaHoy();
  if (modulos.includes("notificaciones")) actualizarCentroNotificaciones();
}
window.refrescarDatos = refrescarDatos;

function normalizarFecha(fecha) {
  if (!fecha) return null;
  const d = typeof fecha === "string" ? parseFechaLocal(fecha) : new Date(fecha);
  return isNaN(d) ? null : d;
}

function esVencida(fecha, estado = "") {
  const f = normalizarFecha(fecha);
  if (!f) return false;
  if ((estado || "").toLowerCase().includes("termin")) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return f < hoy;
}

function obtenerSla(fecha, estado = "", urgencia = "") {
  const u = (urgencia || "").toLowerCase();
  if (["alta", "urgente"].includes(u)) return "rojo";
  if (["media", "prioritaria"].includes(u)) return "amarillo";
  if (["baja", "normal"].includes(u)) return "verde";
  if ((estado || "").toLowerCase().includes("termin")) return "verde";
  const f = normalizarFecha(fecha);
  if (!f) return "verde";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.ceil((f - hoy) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "rojo";
  if (diff <= 2) return "amarillo";
  return "verde";
}

function registrarReglasProductividad() {
  const hoyKey = new Date().toISOString().slice(0, 10);
  const marca = `reglas_hoy_${hoyKey}`;
  if (localStorage.getItem(marca)) return;
  const tareas = JSON.parse(localStorage.getItem("tareas") || "[]");
  const tareasDia = JSON.parse(localStorage.getItem("tareasDia") || "[]");
  const internas = JSON.parse(localStorage.getItem("tareasInternas") || "[]");
  const universo = [
    ...tareas.map((t) => ({ ...t, fechaCtrl: t.fin, tituloRef: t.titulo || t.descripcion })),
    ...tareasDia.map((t) => ({ ...t, fechaCtrl: t.fechaFin, tituloRef: t.texto })),
    ...internas.map((t) => ({ ...t, fechaCtrl: t.fechaFin, tituloRef: t.texto })),
  ];
  const vencidas = universo.filter((t) => esVencida(t.fechaCtrl, t.estado)).length;
  if (vencidas > 0 && window.registrarNotificacion) {
    registrarNotificacion(`⚠️ Hay ${vencidas} tareas vencidas por revisar.`, "hoy");
  }
  const alertas72 = universo.filter((t) => {
    const f = normalizarFecha(t.fechaCtrl);
    if (!f || (t.estado || "").toLowerCase().includes("termin")) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diff = Math.ceil((f - hoy) / (1000 * 60 * 60 * 24));
    return diff === 7 || diff === 2;
  });
  alertas72.forEach((t) => {
    const f = normalizarFecha(t.fechaCtrl);
    const diff = Math.ceil((f - new Date(new Date().setHours(0, 0, 0, 0))) / (1000 * 60 * 60 * 24));
    registrarNotificacion(`⏰ Recordatorio T-${diff}: "${t.tituloRef || "Sin título"}"`, "hoy");
  });
  localStorage.setItem(marca, "1");
}

let filtroHoy = "todos";
let filtroResponsableHoy = "";
function renderVistaHoy() {
  const lista = document.getElementById("hoyLista");
  const resumen = document.getElementById("hoyResumenCarga");
  const calendarioSemanal = document.getElementById("hoyCalendarioSemanal");
  const hoyKanban = document.getElementById("hoyKanban");
  const hoyAuditoria = document.getElementById("hoyAuditoria");
  if (!lista || !resumen) return;

  const tareas = JSON.parse(localStorage.getItem("tareas") || "[]");
  const tareasDia = JSON.parse(localStorage.getItem("tareasDia") || "[]");
  const audiencias = JSON.parse(localStorage.getItem("audiencias") || "[]");
  const internas = JSON.parse(localStorage.getItem("tareasInternas") || "[]");
  const hoy = new Date().toISOString().slice(0, 10);

  const items = [];
  tareas.forEach((t) => items.push({
    tipo: "Gestión",
    texto: t.titulo || t.descripcion || "Sin título",
    fecha: t.fin || "",
    fechaAlt: t.inicio || t.created_at || "",
    asignado: t.asignadoA || "-",
    estado: t.estado || "-",
    urgencia: t.prioridad || ""
  }));
  tareasDia.forEach((t) => items.push({
    tipo: "Tarea día",
    texto: t.texto || "Sin texto",
    fecha: t.fechaFin || "",
    fechaAlt: t.creadoEn || "",
    asignado: (t.asignadosA || []).join(", "),
    estado: t.prioridad || "-",
    urgencia: t.prioridad || ""
  }));
  internas.forEach((t) => items.push({
    tipo: "Interna",
    texto: t.texto || "Sin texto",
    fecha: t.fechaFin || "",
    fechaAlt: t.creadoEn || "",
    asignado: (t.asignadosA || []).join(", "),
    estado: t.prioridad || "-",
    urgencia: t.prioridad || ""
  }));
  audiencias.forEach((a) => items.push({ tipo: "Audiencia", texto: a.titulo || "Sin título", fecha: a.fecha || "", fechaAlt: "", asignado: a.modalidad || "-", estado: a.hora || "-", urgencia: a.urgencia || "" }));
  const fechaOperativa = (i) => i.fecha || i.fechaAlt || "";

  const hoyDate = new Date();
  const inicioSemana = new Date(hoyDate);
  inicioSemana.setDate(hoyDate.getDate() - hoyDate.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 7);

  let itemsFiltrados = items;
  if (filtroHoy === "hoy") {
    itemsFiltrados = items.filter((i) => {
      const f = normalizarFecha(fechaOperativa(i));
      return f && f.toISOString().slice(0, 10) === hoy;
    });
  } else if (filtroHoy === "vencidas") {
    itemsFiltrados = items.filter((i) => esVencida(i.fecha, i.estado));
  } else if (filtroHoy === "semana") {
    itemsFiltrados = items.filter((i) => {
      const f = normalizarFecha(fechaOperativa(i));
      return f && f >= inicioSemana && f < finSemana;
    });
  }
  if (filtroResponsableHoy) {
    itemsFiltrados = itemsFiltrados.filter((i) => (i.asignado || "").toLowerCase().includes(filtroResponsableHoy.toLowerCase()));
  }

  items.sort((a, b) => {
    const fa = fechaOperativa(a) || "9999-12-31";
    const fb = fechaOperativa(b) || "9999-12-31";
    return fa.localeCompare(fb);
  });

  const vencidas = items.filter((i) => esVencida(i.fecha, i.estado)).length;
  const deHoy = items.filter((i) => {
    const f = normalizarFecha(fechaOperativa(i));
    return f && f.toISOString().slice(0, 10) === hoy;
  }).length;
  const carga = {};
  items.forEach((i) => {
    const k = i.asignado && i.asignado.trim() ? i.asignado : "Sin asignar";
    carga[k] = (carga[k] || 0) + 1;
  });
  const sugerido = Object.entries(carga)
    .filter(([k]) => k !== "Sin asignar")
    .sort((a, b) => a[1] - b[1])[0]?.[0] || "Sin datos";
  const rojas = items.filter((i) => obtenerSla(i.fecha, i.estado, i.urgencia) === "rojo").length;
  const amarillas = items.filter((i) => obtenerSla(i.fecha, i.estado, i.urgencia) === "amarillo").length;
  const verdes = items.filter((i) => obtenerSla(i.fecha, i.estado, i.urgencia) === "verde").length;
  resumen.innerHTML = `<p><strong>Hoy:</strong> ${deHoy} | <strong>Vencidas:</strong> ${vencidas} | <strong>Total:</strong> ${items.length}</p>`;
  resumen.innerHTML += `<p><strong>SLA:</strong> <span class="hoy-chip rojo">Rojo ${rojas}</span><span class="hoy-chip amarillo">Amarillo ${amarillas}</span><span class="hoy-chip verde">Verde ${verdes}</span></p>`;
  resumen.innerHTML += `<p><strong>Carga por responsable:</strong> ${Object.entries(carga).map(([k,v]) => `${k}: ${v}`).join(" · ") || "-"}</p>`;
  resumen.innerHTML += `<p><strong>Sugerencia próxima asignación:</strong> ${sugerido}</p>`;
  resumen.innerHTML += `<p><strong>Control semanal:</strong> ${items.filter((i) => {
    const f = normalizarFecha(fechaOperativa(i));
    return f && f >= inicioSemana && f < finSemana;
  }).length} hitos en esta semana</p>`;

  if (calendarioSemanal) {
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const semana = {};
    items.forEach((i) => {
      const f = normalizarFecha(fechaOperativa(i));
      const d = f ? dias[f.getDay()] : "Sin fecha";
      semana[d] = (semana[d] || 0) + 1;
    });
    calendarioSemanal.innerHTML = `<strong>Calendario semanal:</strong> ${Object.entries(semana).map(([d, c]) => `${d}: ${c}`).join(" · ") || "-"}`;
  }

  lista.innerHTML = "";
  itemsFiltrados.slice(0, 100).forEach((i) => {
    const div = document.createElement("div");
    div.className = "hoy-item";
    const badge = esVencida(i.fecha, i.estado) ? " ⚠️" : "";
    const sla = obtenerSla(i.fecha, i.estado, i.urgencia);
    const fechaVisible = fechaOperativa(i) || "-";
    div.innerHTML = `<strong>[${i.tipo}]</strong> ${i.texto}${badge}<span class="hoy-chip ${sla}">${sla.toUpperCase()}</span><br><small>Fecha: ${fechaVisible} · Responsable: ${i.asignado || "-"} · Estado: ${i.estado || "-"}</small>`;
    lista.appendChild(div);
  });

  if (hoyKanban) {
    const cols = { pendiente: [], "en curso": [], espera: [], terminado: [] };
    (JSON.parse(localStorage.getItem("tareas") || "[]")).forEach((t) => {
      const e = (t.estado || "pendiente").toLowerCase();
      if (e.includes("termin")) cols.terminado.push(t);
      else if (e.includes("curso")) cols["en curso"].push(t);
      else if (e.includes("esper")) cols.espera.push(t);
      else cols.pendiente.push(t);
    });
    hoyKanban.innerHTML = Object.entries(cols).map(([col, arr]) =>
      `<div class="hoy-kanban-col"><h4>${col} (${arr.length})</h4>${arr.slice(0,6).map((x) => `<div>${x.titulo || x.descripcion || "Sin título"}</div>`).join("")}</div>`
    ).join("");
  }

  if (hoyAuditoria && window.supabaseSync?.fetchAuditRecent) {
    window.supabaseSync.fetchAuditRecent().then((rows) => {
      const relevantes = (rows || []).filter((r) => {
        const table = (r.table_name || "").toLowerCase();
        const action = (r.action || "").toLowerCase();
        const esBorrado = action.includes("delete") && ["tareas", "tareasinternas", "audiencias", "diario", "clientes"].includes(table);
        const esCompletado = action.includes("upsert") && ["gestionesarchivadas", "diarioarchivadas", "audienciasarchivadas"].includes(table);
        return esBorrado || esCompletado;
      });
      const top = relevantes.slice(0, 8);
      const nombreActor = (actor) => {
        if (!actor) return "sistema";
        return NOMBRES_POR_EMAIL[actor] || actor;
      };
      const mensajes = top.map((r) => {
        const table = (r.table_name || "").toLowerCase();
        const action = (r.action || "").toLowerCase();
        const actor = nombreActor(r.actor);
        if (action.includes("delete")) {
          if (table === "clientes") return `Cliente eliminado por ${actor}`;
          if (table === "tareasinternas") return `Tarea interna eliminada por ${actor}`;
          if (table === "audiencias") return `Audiencia eliminada por ${actor}`;
          if (table === "tareas" || table === "diario") return `Tarea eliminada por ${actor}`;
        }
        if (action.includes("upsert")) {
          if (table === "gestionesarchivadas") return `Tarea terminada por ${actor}`;
          if (table === "diarioarchivadas") return `Tarea del día terminada por ${actor}`;
          if (table === "audienciasarchivadas") return `Audiencia terminada por ${actor}`;
        }
        return `Movimiento registrado por ${actor}`;
      });
      hoyAuditoria.innerHTML = `<strong>Auditoría reciente:</strong> ${mensajes.join(" · ") || "Sin movimientos recientes"}`;
    });
  }

  registrarReglasProductividad();
}

function obtenerResultadosBusquedaGlobal(termino) {
  const q = (termino || "").trim().toLowerCase();
  if (!q) return [];
  const filtros = {};
  q.split(" ").forEach((p) => {
    if (p.includes(":")) {
      const [k, v] = p.split(":");
      filtros[k] = v;
    }
  });
  const fuentes = [
    { tabla: "clientes", label: "Cliente", campo: (x) => `${x.nombre || ""} ${x.correo || ""}` },
    { tabla: "expedientes", label: "Caso", campo: (x) => `${x.titulo || ""} ${x.tribunal || ""}` },
    { tabla: "tareas", label: "Gestión", campo: (x) => `${x.titulo || ""} ${x.descripcion || ""}` },
    { tabla: "audiencias", label: "Audiencia", campo: (x) => `${x.titulo || ""} ${x.notas || ""}` },
  ];
  const out = [];
  fuentes.forEach((f) => {
    const datos = JSON.parse(localStorage.getItem(f.tabla) || "[]");
    datos.forEach((d) => {
      const txt = f.campo(d);
      const okTexto = txt.toLowerCase().includes(q.replace(/\\w+:[^\\s]+/g, "").trim());
      const okTipo = !filtros.tipo || f.label.toLowerCase() === filtros.tipo;
      const okAsignado = !filtros.asignado || `${d.asignadoA || d.asignadosA || ""}`.toLowerCase().includes(filtros.asignado);
      const okVencida = !filtros.vencida || (filtros.vencida === "true" ? esVencida(d.fin || d.fecha, d.estado) : true);
      const tags = Array.isArray(d.tags) ? d.tags.join(",").toLowerCase() : "";
      const okTag = !filtros.tag || tags.includes(filtros.tag);
      if (okTexto && okTipo && okAsignado && okVencida && okTag) {
        out.push({ tipo: f.label, texto: txt.trim() || "(sin texto)", raw: d });
      }
    });
  });
  return out.slice(0, 15);
}

function renderQuickPanelResultado(r) {
  const raw = r?.raw || {};
  if (r?.tipo === "Cliente") {
    return `<p><strong>Nombre:</strong> ${raw.nombre || "-"}</p><p><strong>Correo:</strong> ${raw.correo || "-"}</p><p><strong>Teléfono:</strong> ${raw.telefono || "-"}</p>
    <button class="quickpanel-edit-btn" onclick="if (typeof editarCliente==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); editarCliente(${raw.id}); mostrarModal(document.getElementById('modalFormulario'));}">✏️ Editar</button>`;
  }
  if (r?.tipo === "Gestión") {
    return `<h4>Resumen</h4><p><strong>Título:</strong> ${raw.titulo || "-"}</p><p><strong>Estado:</strong> ${raw.estado || "-"}</p><p><strong>Fecha fin:</strong> ${raw.fin || "-"}</p><h4>Próxima acción</h4><p>${raw.proximaAccion || "-"}</p><h4>Historial</h4><p>Creado: ${raw.created_at ? formatearCorta(raw.created_at) : "-"}</p>
    <button class="quickpanel-edit-btn" onclick="if (typeof editarTarea==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); editarTarea(${raw.id}); mostrarModal(document.getElementById('ModalFormularioTarea'));}">✏️ Editar</button>`;
  }
  if (r?.tipo === "Audiencia") {
    return `<p><strong>Título:</strong> ${raw.titulo || "-"}</p><p><strong>Fecha:</strong> ${raw.fecha || "-"} ${raw.hora || ""}</p><p><strong>Modalidad:</strong> ${raw.modalidad || "-"}</p>
    <button class="quickpanel-edit-btn" onclick="if (typeof editarAudiencia==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); editarAudiencia(${raw.id});}">✏️ Editar</button>`;
  }
  return `<pre>${JSON.stringify(raw, null, 2)}</pre>`;
}

function abrirQuickPanel(titulo, contenidoHtml) {
  const panel = document.getElementById("quickPanel");
  const t = document.getElementById("quickPanelTitulo");
  const c = document.getElementById("quickPanelContenido");
  if (!panel || !t || !c) return;
  t.textContent = titulo;
  c.innerHTML = contenidoHtml;
  const scrollActual = window.scrollY || document.documentElement.scrollTop || 0;
  panel.style.position = "absolute";
  panel.style.top = `${scrollActual}px`;
  panel.style.height = `${window.innerHeight}px`;
  panel.classList.remove("oculto");
  window.__quickPanelJustOpenedAt = Date.now();
}

function normalizarTipoDetalle(tipo, data = {}) {
  const bruto = String(tipo || "").toLowerCase().trim();
  const mapa = {
    tarea: "tarea",
    tareas: "tarea",
    gestion: "tarea",
    gestiones: "tarea",
    "tarea_dia": "tarea_dia",
    "tareas_dia": "tarea_dia",
    "tarea-interna": "tarea_interna",
    "tarea_interna": "tarea_interna",
    "tareas_internas": "tarea_interna",
    interna: "tarea_interna",
    cliente: "cliente",
    clientes: "cliente",
    audiencia: "audiencia",
    audiencias: "audiencia"
  };
  if (mapa[bruto]) return mapa[bruto];

  // Fallback por forma de datos, para no mostrar paneles cruzados.
  if (data && (data.correo || data.telefono || data.rut)) return "cliente";
  if (data && (data.modalidad || data.hora || data.notas)) return "audiencia";
  if (data && (data.expedienteId || data.descripcion || data.estado)) return "tarea";
  if (data && (data.asignadosA || data.proximaAccion || data.fechaFin)) return "tarea_interna";
  return bruto;
}

function mostrarDetalleEntidad(tipo, data) {
  if (!data) return;
  const tipoNorm = normalizarTipoDetalle(tipo, data);
  if (tipoNorm === "tarea") {
    abrirQuickPanel(
      `Detalle tarea: ${data.titulo || data.texto || "Sin título"}`,
      `<h4>Resumen</h4>
       <p><strong>Descripción:</strong> ${data.descripcion || "-"}</p>
       <p><strong>Estado:</strong> ${data.estado || "-"}</p>
       <p><strong>Prioridad:</strong> ${data.prioridad || "-"}</p>
       <p><strong>Inicio:</strong> ${data.inicio || "-"}</p>
       <p><strong>Fin:</strong> ${data.fin || data.fechaFin || "-"}</p>
       <p><strong>Creado por:</strong> ${data.creadoPor || "-"}</p>
       <h4>Próxima acción</h4><p>${data.proximaAccion || "-"}</p>
       <h4>Acciones rápidas</h4>
       <div class="quick-panel-actions">
         <button class="mini-boton" onclick="cambiarVista('hoy')">Ir a hoy</button>
         <button class="quickpanel-edit-btn" onclick="if (typeof editarTarea==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); editarTarea(${data.id}); mostrarModal(document.getElementById('ModalFormularioTarea'));}">✏️ Editar</button>
       </div>`
    );
    return;
  }
  if (tipoNorm === "tarea_dia") {
    const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
    const cliente = clientes.find((c) => c.id === data.clienteId);
    abrirQuickPanel(
      `Tarea del día: ${data.texto || "Sin título"}`,
      `<h4>Resumen</h4>
       <p><strong>Asignados:</strong> ${(data.asignadosA || []).join(", ") || "-"}</p>
       <p><strong>Cliente:</strong> ${cliente?.nombre || "-"}</p>
       <p><strong>Prioridad:</strong> ${data.prioridad || "-"}</p>
       <p><strong>Vence:</strong> ${data.fechaFin || "-"}</p>
       <p><strong>Próxima acción:</strong> ${data.proximaAccion || "-"}</p>
       <div class="quick-panel-actions">
         <button class="mini-boton" onclick="cambiarVista('tareas')">Ir a tareas</button>
         <button class="quickpanel-edit-btn" onclick="if (typeof abrirEdicionTareaDia==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); abrirEdicionTareaDia(${data.id});}">✏️ Editar</button>
       </div>`
    );
    return;
  }
  if (tipoNorm === "tarea_interna") {
    const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
    const cliente = clientes.find((c) => c.id === data.clienteId);
    abrirQuickPanel(
      `Tarea interna: ${data.texto || "Sin título"}`,
      `<h4>Resumen</h4>
       <p><strong>Asignados:</strong> ${(data.asignadosA || []).join(", ") || "-"}</p>
       <p><strong>Cliente:</strong> ${cliente?.nombre || "-"}</p>
       <p><strong>Prioridad:</strong> ${data.prioridad || "-"}</p>
       <p><strong>Vence:</strong> ${data.fechaFin || "-"}</p>
       <p><strong>Próxima acción:</strong> ${data.proximaAccion || "-"}</p>
       <div class="quick-panel-actions">
         <button class="mini-boton" onclick="cambiarVista('internas')">Ir a internas</button>
         <button class="quickpanel-edit-btn" onclick="if (typeof abrirEdicionTareaInterna==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); abrirEdicionTareaInterna(${data.id});}">✏️ Editar</button>
       </div>`
    );
    return;
  }
  if (tipoNorm === "cliente") {
    abrirQuickPanel(
      `Cliente: ${data.nombre || "Sin nombre"}`,
      `<h4>Resumen</h4><p><strong>Correo:</strong> ${data.correo || "-"}</p>
       <p><strong>Teléfono:</strong> ${data.telefono || "-"}</p>
       <p><strong>Dirección:</strong> ${data.direccion || "-"}</p>
       <p><strong>RUT:</strong> ${data.rut || "-"}</p>
       <p><strong>Notas:</strong> ${data.confidencial || "-"}</p>
       <button class="quickpanel-edit-btn" onclick="if (typeof editarCliente==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); editarCliente(${data.id}); mostrarModal(document.getElementById('modalFormulario'));}">✏️ Editar</button>`
    );
    return;
  }
  if (tipoNorm === "audiencia") {
    abrirQuickPanel(
      `Audiencia: ${data.titulo || "Sin título"}`,
      `<h4>Resumen</h4><p><strong>Tipo:</strong> ${data.tipo || "-"}</p>
       <p><strong>Modalidad:</strong> ${data.modalidad || "-"}</p>
       <p><strong>Fecha/Hora:</strong> ${data.fecha || "-"} ${data.hora || ""}</p>
       <p><strong>Notas:</strong> ${data.notas || "-"}</p>
       <button class="quickpanel-edit-btn" onclick="if (typeof editarAudiencia==='function'){document.getElementById('quickPanel')?.classList.add('oculto'); editarAudiencia(${data.id});}">✏️ Editar</button>`
    );
    return;
  }
  abrirQuickPanel(`Detalle: ${tipo || "registro"}`, `<pre>${JSON.stringify(data, null, 2)}</pre>`);
}
window.mostrarDetalleEntidad = mostrarDetalleEntidad;

function actualizarKpiResumen() {
  const el = document.getElementById("kpiResumen");
  if (!el) return;
  const tareasGestion = JSON.parse(localStorage.getItem("tareas") || "[]");
  const tareasDia = JSON.parse(localStorage.getItem("tareasDia") || "[]");
  const tareasInternas = JSON.parse(localStorage.getItem("tareasInternas") || "[]");
  const tareasGestionArchivadas = JSON.parse(localStorage.getItem("tareasArchivadas") || "[]");
  const tareasDiaArchivadas = JSON.parse(localStorage.getItem("tareasDiaArchivadas") || "[]");
  const audiencias = JSON.parse(localStorage.getItem("audiencias") || "[]");
  const clientes = JSON.parse(localStorage.getItem("clientes") || "[]");
  const gestionesUnificadas = tareasGestion.length + tareasDia.length;
  const vencidasGestion = tareasGestion.filter((t) => esVencida(t.fin, t.estado)).length;
  const vencidasDia = tareasDia.filter((t) => esVencida(t.fechaFin, "pendiente")).length;
  const vencidasInternas = tareasInternas.filter((t) => esVencida(t.fechaFin, "pendiente")).length;
  const vencidas = vencidasGestion + vencidasDia + vencidasInternas;
  const terminadas = tareasGestionArchivadas.length + tareasDiaArchivadas.length;
  el.innerHTML = `
    <button class="kpi-item" data-kpi="clientes"><strong>Clientes</strong><br>${clientes.length}</button>
    <button class="kpi-item" data-kpi="gestiones"><strong>Gestiones</strong><br>${gestionesUnificadas}</button>
    <button class="kpi-item" data-kpi="internas"><strong>Internas</strong><br>${tareasInternas.length}</button>
    <button class="kpi-item" data-kpi="vencidas"><strong>Vencidas</strong><br>${vencidas}</button>
    <button class="kpi-item" data-kpi="terminadas"><strong>Terminadas</strong><br>${terminadas}</button>
    <button class="kpi-item" data-kpi="audiencias"><strong>Audiencias</strong><br>${audiencias.length}</button>
  `;
  el.querySelectorAll("[data-kpi]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-kpi");
      if (k === "vencidas") {
        filtroHoy = "vencidas";
        cambiarVista("hoy");
      } else if (k === "internas") {
        cambiarVista("internas");
      } else if (k === "gestiones") {
        cambiarVista("tareas");
      } else if (k === "audiencias") {
        cambiarVista("audiencias");
      } else if (k === "clientes") {
        cambiarVista("clientes");
      } else if (k === "terminadas") {
        const terminadasGestion = JSON.parse(localStorage.getItem("tareasArchivadas") || "[]")
          .map((t) => ({ tipo: "Gestión", titulo: t.titulo || t.descripcion || "Sin título", fecha: t.archivadoEn || t.fin || "-" }));
        const terminadasDia = JSON.parse(localStorage.getItem("tareasDiaArchivadas") || "[]")
          .map((t) => ({ tipo: "Tarea día", titulo: t.texto || "Sin título", fecha: t.archivadoEn || t.fechaFin || "-" }));
        const listaTerm = [...terminadasGestion, ...terminadasDia]
          .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
          .slice(0, 80);
        const html = listaTerm.length
          ? `<div>${listaTerm.map((x) => `<div class="hoy-item"><strong>[${x.tipo}]</strong> ${x.titulo}<br><small>${formatearCorta(x.fecha)}</small></div>`).join("")}</div>`
          : "<p>No hay tareas terminadas.</p>";
        abrirQuickPanel("KPI Terminadas", html);
      }
    });
  });
}

// Manejo de capas de modales para permitir abrir un modal sobre otro
let modalZIndex = 12000;
function ajustarPosicionModalesVisibles() {
  const abiertos = document.querySelectorAll("#app > .modal:not(.oculto), body > .modal:not(.oculto)");
  abiertos.forEach((modal) => {
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.minHeight = "100vh";
    modal.style.left = "0";
    modal.style.right = "0";
  });
}

function mostrarModal(modal) {
  if (!modal) return;
  modalZIndex += 1;
  modal.style.zIndex = modalZIndex;
  modal.classList.remove("oculto");
  ajustarPosicionModalesVisibles();
}

function mostrarAlertaModal(mensaje, driveLink) {
  mostrarToast(mensaje, "#e53935");
  const texto = document.getElementById("modalAlertaMensaje");
  const modal = document.getElementById("modalAlerta");
  const driveBtn = document.getElementById("modalAlertaDrive");
  if (texto && modal) {
    texto.innerHTML = mensaje;
    if (driveBtn) {
      if (driveLink) {
        driveBtn.href = driveLink;
        driveBtn.classList.remove("oculto");
      } else {
        driveBtn.classList.add("oculto");
      }
    }
    mostrarModal(modal);
  } else {
    alert(mensaje);
  }
}

// Utilidad para aplicar Choices.js a un select, destruyendo instancias previas
function enhanceSelect(select) {
  if (!window.Choices || !select) return;
  if (select.choicesInstance) {
    select.choicesInstance.destroy();
  }
  const config = { searchEnabled: true, itemSelectText: "" };
  if (select.multiple) {
    config.removeItemButton = true;
  }
  const ph = select.getAttribute("placeholder");
  if (ph) {
    config.placeholder = true;
    config.placeholderValue = ph;
  }
  select.choicesInstance = new Choices(select, config);
}

// Asigna un valor al <select> y actualiza Choices si está habilitado
function setSelectValue(select, value) {
  if (!select) return;
  if (select.multiple && Array.isArray(value)) {
    Array.from(select.options).forEach((opt) => {
      opt.selected = value.includes(opt.value);
    });
    if (select.choicesInstance) {
      select.choicesInstance.removeActiveItems();
      select.choicesInstance.setChoiceByValue(value);
    }
  } else {
    select.value = value;
    if (select.choicesInstance && typeof select.choicesInstance.setChoiceByValue === "function") {
      select.choicesInstance.setChoiceByValue(String(value));
    }
  }
}

function cambiarVista(vistaId) {
  const vistaMostrada = document.getElementById(`vista-${vistaId}`);
  if (!vistaMostrada) {
    vistaId = "dashboard";
  }
  const vistaFinal = document.getElementById(`vista-${vistaId}`);
  if (!vistaFinal) return;

  // 1) Recargar datos antes de mostrar la sección
  if (vistaId === "clientes" && typeof cargarClientes === "function") {
    cargarClientes();
  } else if (vistaId === "dashboard" && typeof actualizarDashboard === "function") {
    actualizarDashboard();
  } else if (vistaId === "internas" && typeof cargarTareasInternas === "function") {
    cargarTareasInternas();
    cargarTareasInternasArchivadas();
  } else if (vistaId === "tareas" && typeof cargarTareasDia === "function") {
    cargarTareasDia();
    cargarTareasDiaArchivadas();
  } else if (vistaId === "audiencias" && typeof cargarAudiencias === "function") {
    cargarAudiencias();
  } else if (vistaId === "hoy") {
    renderVistaHoy();
  } else if (vistaId === "generador") {
    montarGeneradorNativo();
  }

  // 2) Ocultamos todas las secciones
  document.querySelectorAll(".vista").forEach(seccion => seccion.classList.add("oculto"));
  // Quitamos la clase activa de los botones
  document.querySelectorAll(".tab").forEach(boton => boton.classList.remove("active"));

  // 3) Mostramos la sección ya cargada
  vistaFinal.classList.remove("oculto");
  vistaActual = vistaId;

  const botonActivo = document.querySelector(`.tab[data-tab="${vistaId}"]`);
  if (botonActivo) botonActivo.classList.add("active");
}

let generadorNativoMontado = false;
let generadorNativoMontando = false;
let generadorTemaObservadorIniciado = false;

function obtenerTemaActualApp() {
  const rootStyles = getComputedStyle(document.documentElement);
  const bodyStyles = getComputedStyle(document.body);
  const leerVar = (name, fallback = "") =>
    (bodyStyles.getPropertyValue(name) || rootStyles.getPropertyValue(name) || fallback).trim();
  return {
    colorPrincipal: leerVar("--color-principal", "#4c8b6e"),
    colorSecundario: leerVar("--color-secundario", "#7f9c8a"),
    colorTexto: leerVar("--color-texto", "#222222"),
    colorFondo: leerVar("--color-fondo", "#f5f7f6"),
    colorGris: leerVar("--color-gris", "#555555"),
    colorDestacado: leerVar("--color-destacado", "#e2f0ea"),
    radius: leerVar("--radius", "20px"),
    fontFamily: bodyStyles.fontFamily,
    fontSize: rootStyles.fontSize,
    darkMode: document.body.classList.contains("dark-mode")
  };
}

function sincronizarTemaGeneradorNativo() {
  const mount = document.getElementById("generadorMount");
  if (!mount) return;
  const tema = obtenerTemaActualApp();
  mount.style.setProperty("--app-color-principal", tema.colorPrincipal || "#4c8b6e");
  mount.style.setProperty("--app-color-secundario", tema.colorSecundario || "#7f9c8a");
  mount.style.setProperty("--app-color-texto", tema.colorTexto || "#222222");
  mount.style.setProperty("--app-color-fondo", tema.colorFondo || "#f5f7f6");
  mount.style.setProperty("--app-color-gris", tema.colorGris || "#555555");
  mount.style.setProperty("--app-color-destacado", tema.colorDestacado || "#e2f0ea");
  mount.style.setProperty("--app-radius", tema.radius || "20px");
  mount.style.fontFamily = tema.fontFamily || "";
  mount.style.fontSize = tema.fontSize || "";
  mount.classList.toggle("dark-mode", !!tema.darkMode);
}

function iniciarSincronizacionTemaGeneradorNativo() {
  if (generadorTemaObservadorIniciado) return;
  generadorTemaObservadorIniciado = true;
  sincronizarTemaGeneradorNativo();

  const observer = new MutationObserver(() => {
    sincronizarTemaGeneradorNativo();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("resize", sincronizarTemaGeneradorNativo);
}

async function montarGeneradorNativo() {
  const mount = document.getElementById("generadorMount");
  if (!mount || generadorNativoMontado || generadorNativoMontando) return;
  generadorNativoMontando = true;
  mount.innerHTML = "<p style='padding:16px;color:var(--color-gris,#555)'>Cargando generador...</p>";

  try {
    const response = await fetch("generador/Generador_Escritos.html", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const estilos = parsed.querySelector("style");
    const scripts = Array.from(parsed.querySelectorAll("script"));
    const cuerpo = parsed.body ? parsed.body.innerHTML : "";

    mount.innerHTML = "";
    if (estilos) {
      const scopedStyle = document.createElement("style");
      scopedStyle.textContent = estilos.textContent
        .replace(/(^|,)\s*:root(?=\s*[{,])/gm, "$1 #generadorMount")
        .replace(/(^|,)\s*html(?=[\s.#:\[])/gm, "$1 #generadorMount")
        .replace(/(^|,)\s*body(?=[\s.#:\[])/gm, "$1 #generadorMount");
      mount.appendChild(scopedStyle);
    }

    const contenido = document.createElement("div");
    contenido.className = "generador-native-content";
    contenido.innerHTML = cuerpo;
    contenido.querySelectorAll("script").forEach((el) => el.remove());
    mount.appendChild(contenido);

    scripts.forEach((scriptOriginal) => {
      const script = document.createElement("script");
      if (scriptOriginal.src) {
        script.src = new URL(scriptOriginal.getAttribute("src"), "generador/Generador_Escritos.html").toString();
      } else {
        script.textContent = scriptOriginal.textContent || "";
      }
      mount.appendChild(script);
    });

    generadorNativoMontado = true;
    sincronizarTemaGeneradorNativo();
  } catch (error) {
    console.error("No fue posible montar el generador nativo:", error);
    mount.innerHTML = "<p style='padding:16px;color:#b42318'>No fue posible cargar el generador. Revisa que exista generador/Generador_Escritos.html.</p>";
  } finally {
    generadorNativoMontando = false;
  }
}

// -----------------------------------------------------------------------------------
// EVENTO: DOMContentLoaded
// Tipo: Evento del navegador
// Objetivo: Ejecuta el bloque de código cuando todo el HTML haya sido cargado.
// Nivel de relevancia: 🔁 General. Permite que todo funcione correctamente al iniciar.
document.addEventListener("DOMContentLoaded", async () => {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  const appDiv = document.getElementById("app");
  const loginDiv = document.getElementById("login");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const loginUsuarioInput = document.getElementById("loginUsuario");
  const btnNotif = document.getElementById("btnNotificaciones");
  const centroNotif = document.getElementById("centroNotificaciones");
  const limpiarNotif = document.getElementById("limpiarNotificaciones");
  const notifWrapper = document.getElementById("notificacionesWrapper");
  const syncStatus = document.getElementById("syncStatus");
  const busquedaGlobalInput = document.getElementById("busquedaGlobalInput");
  const busquedaGlobalResultados = document.getElementById("busquedaGlobalResultados");
  const quickPanel = document.getElementById("quickPanel");
  const quickPanelCerrar = document.getElementById("quickPanelCerrar");
  const hoyFiltros = document.querySelectorAll("[data-hoy-filtro]");
  const hoyResponsableFiltro = document.getElementById("hoyResponsableFiltro");
  const hoyExportSemanal = document.getElementById("hoyExportSemanal");
  const sidebar = document.querySelector(".sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebar");
  iniciarSincronizacionTemaGeneradorNativo();
  window.updateSyncStatus = (state = "syncing", text = "") => {
    if (!syncStatus) return;
    syncStatus.classList.remove("ok", "syncing", "error");
    syncStatus.classList.add(state);
    const labels = {
      ok: "Sincronizado",
      syncing: "Sincronizando",
      error: "Error de sync",
    };
    syncStatus.textContent = `● ${text || labels[state] || "Sincronizando"}`;
  };
  window.updateSyncStatus("syncing");
  if (busquedaGlobalInput) {
    busquedaGlobalInput.value = "";
    busquedaGlobalInput.setAttribute("autocomplete", "off");
    busquedaGlobalInput.setAttribute("data-lpignore", "true");
  }
  if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const handleMobileLayout = () => {
      if (mobileQuery.matches) {
        sidebar.classList.remove("collapsed");
        toggleSidebarBtn.classList.add("oculto");
      } else {
        toggleSidebarBtn.classList.remove("oculto");
      }
    };
    handleMobileLayout();
    mobileQuery.addEventListener("change", handleMobileLayout);
  }

  if (loginUsuarioInput) {
    loginUsuarioInput.addEventListener("blur", () => {
      const v = loginUsuarioInput.value.trim();
      if (v && !v.includes("@")) {
        loginUsuarioInput.value = v + "@gjabogados.cl";
      }
    });
  }

  if (btnNotif && centroNotif) {
    btnNotif.addEventListener("click", () => {
      centroNotif.classList.toggle("oculto");
      actualizarCentroNotificaciones();
    });
    document.addEventListener("click", (e) => {
      if (!centroNotif.contains(e.target) && !btnNotif.contains(e.target)) {
        centroNotif.classList.add("oculto");
      }
    });
  }
  if (limpiarNotif) {
    limpiarNotif.addEventListener("click", () => {
      limpiarNotificaciones();
    });
  }

  // Mover modales de formularios al body para que puedan abrirse desde cualquier vista
  ["modalFormulario", "modalFormularioExpediente", "ModalFormularioTarea"].forEach(id => {
    const m = document.getElementById(id);
    if (m) document.body.appendChild(m);
  });

  // Convierte todos los <select> en listas con búsqueda usando Choices.js
  document.querySelectorAll("select").forEach(enhanceSelect);

  if (window.supabaseSync) {
    window.updateSyncStatus("syncing");
    const criticas = ["tareasDia", "audiencias", "notificaciones"];
    for (const t of criticas) {
      await window.supabaseSync.pullTabla?.(t);
    }
    setTimeout(() => {
      window.supabaseSync.pullAll().then(() => {
        if (typeof window.refrescarDatos === "function") {
          window.refrescarDatos([
            "clientes",
            "tareasDia",
            "audiencias",
            "dashboard",
            "hoy",
            "notificaciones",
            "internas",
          ]);
        }
        if (typeof cargarTareasInternas === "function") {
          cargarTareasInternas();
          cargarTareasInternasArchivadas();
        }
      });
    }, 300);
    window.supabaseSync.subscribeRealtime();
    window.updateSyncStatus("ok");
  }

  if (quickPanelCerrar && quickPanel) {
    quickPanelCerrar.addEventListener("click", () => quickPanel.classList.add("oculto"));
  }
  if (quickPanel) {
    document.addEventListener("click", (event) => {
      if (quickPanel.classList.contains("oculto")) return;
      const justoAbierto = Date.now() - (window.__quickPanelJustOpenedAt || 0) < 180;
      if (justoAbierto) return;
      if (quickPanel.contains(event.target)) return;
      quickPanel.classList.add("oculto");
    });
    window.addEventListener("resize", () => {
      if (quickPanel.classList.contains("oculto")) return;
      const scrollActual = window.scrollY || document.documentElement.scrollTop || 0;
      quickPanel.style.top = `${scrollActual}px`;
      quickPanel.style.height = `${window.innerHeight}px`;
    });
  }

  const observerModales = new MutationObserver(() => {
    ajustarPosicionModalesVisibles();
  });
  observerModales.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", ajustarPosicionModalesVisibles);

  if (busquedaGlobalInput && busquedaGlobalResultados) {
    let idxSeleccionado = -1;
    const pintarSeleccion = () => {
      busquedaGlobalResultados.querySelectorAll(".busqueda-item").forEach((it, idx) => {
        it.style.background = idx === idxSeleccionado ? "#e8f5e9" : "";
      });
    };
    busquedaGlobalInput.addEventListener("input", () => {
      const resultados = obtenerResultadosBusquedaGlobal(busquedaGlobalInput.value);
      idxSeleccionado = -1;
      if (!resultados.length) {
        busquedaGlobalResultados.classList.add("oculto");
        busquedaGlobalResultados.innerHTML = "";
        return;
      }
      busquedaGlobalResultados.innerHTML = resultados
        .map((r, idx) => `<div class="busqueda-item" data-i="${idx}"><strong>${r.tipo}:</strong> ${r.texto}</div>`)
        .join("");
      busquedaGlobalResultados.classList.remove("oculto");
      busquedaGlobalResultados.querySelectorAll(".busqueda-item").forEach((item) => {
        item.addEventListener("click", () => {
          const i = parseInt(item.getAttribute("data-i"), 10);
          const r = resultados[i];
          abrirQuickPanel(`Resultado: ${r.tipo}`, renderQuickPanelResultado(r));
          busquedaGlobalResultados.classList.add("oculto");
        });
      });
      const mover = (delta) => {
        if (busquedaGlobalResultados.classList.contains("oculto")) return;
        const total = resultados.length;
        idxSeleccionado = (idxSeleccionado + delta + total) % total;
        pintarSeleccion();
      };
      const keyHandler = (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
        else if (e.key === "Enter" && idxSeleccionado >= 0) {
          e.preventDefault();
          abrirQuickPanel(`Resultado: ${resultados[idxSeleccionado].tipo}`, renderQuickPanelResultado(resultados[idxSeleccionado]));
          busquedaGlobalResultados.classList.add("oculto");
        }
      };
      busquedaGlobalInput.onkeydown = keyHandler;
    });
  }

  if (hoyFiltros.length) {
    hoyFiltros.forEach((b) => {
      b.addEventListener("click", () => {
        filtroHoy = b.getAttribute("data-hoy-filtro") || "todos";
        hoyFiltros.forEach((x) => x.classList.remove("activo"));
        b.classList.add("activo");
        renderVistaHoy();
      });
    });
  }
  if (hoyResponsableFiltro) {
    while (hoyResponsableFiltro.options.length > 1) {
      hoyResponsableFiltro.remove(1);
    }
    const nombresEquipo = new Set();
    if (window.supabaseAuth?.fetchUsers) {
      try {
        const users = await window.supabaseAuth.fetchUsers();
        (users || [])
          .filter((u) => u.email !== "admin@gjabogados.cl")
          .forEach((u) => nombresEquipo.add(u.nombre || u.email));
      } catch (_) {
        // fallback a fuentes locales si falla API de usuarios
      }
    }
    if (!nombresEquipo.size) {
      const fuentesLocales = [
        ...(JSON.parse(localStorage.getItem("tareas") || "[]").map((x) => x.asignadoA || "")),
        ...(JSON.parse(localStorage.getItem("tareasDia") || "[]").flatMap((x) => x.asignadosA || [])),
        ...(JSON.parse(localStorage.getItem("tareasInternas") || "[]").flatMap((x) => x.asignadosA || [])),
      ].filter(Boolean);
      fuentesLocales.forEach((n) => nombresEquipo.add(n));
    }
    [...nombresEquipo].sort((a, b) => a.localeCompare(b, "es")).forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = `Responsable: ${n}`;
      hoyResponsableFiltro.appendChild(opt);
    });
    hoyResponsableFiltro.addEventListener("change", () => {
      filtroResponsableHoy = hoyResponsableFiltro.value || "";
      renderVistaHoy();
    });
  }
  if (hoyExportSemanal) {
    hoyExportSemanal.addEventListener("click", () => {
      const filas = (JSON.parse(localStorage.getItem("tareas") || "[]"))
        .map((t) => `${t.titulo || "Sin título"};${t.fin || "-"};${t.estado || "-"};${t.proximaAccion || "-"}`)
        .join("\n");
      const blob = new Blob([`titulo;fecha;estado;proxima_accion\n${filas}`], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "control-semanal.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  document.addEventListener("keydown", (e) => {
    const tag = (e.target?.tagName || "").toLowerCase();
    const editando = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
    if (editando) return;
    if (e.key === "/") {
      e.preventDefault();
      busquedaGlobalInput?.focus();
      return;
    }
    if (e.key.toLowerCase() === "g") {
      localStorage.setItem("ultimaVista", "dashboard");
      cambiarVista("dashboard");
      return;
    }
    if (e.key.toLowerCase() === "h") {
      localStorage.setItem("ultimaVista", "hoy");
      cambiarVista("hoy");
      return;
    }
    if (e.key.toLowerCase() === "n") {
      document.getElementById("nuevaTareaDiaBtnDashboard")?.click();
    }
    if (e.key.toLowerCase() === "c") {
      document.getElementById("abrirFormulario")?.click();
    }
  });

  aplicarConfiguracion();


  if (typeof cargarAbogadosEnSelect === "function") {
    cargarAbogadosEnSelect();
  }
  if (typeof cargarAbogadosEnSelectTarea === "function") {
    cargarAbogadosEnSelectTarea();
  }

  function mostrarApp() {
    loginDiv.classList.add("oculto");
    appDiv.classList.remove("oculto");
    document.body.classList.add("app-activa");
    document.body.classList.remove("blurred");
    appDiv.classList.remove("blurred");
    const usuariosBtn = document.getElementById("tabUsuarios");
    if (usuariosBtn) {
      const u = JSON.parse(localStorage.getItem("usuarioActual") || "null");
      if (esUsuarioAdmin(u)) {
        usuariosBtn.classList.remove("oculto");
      } else {
        usuariosBtn.classList.add("oculto");
      }
    }
    reiniciarTemporizador();
    ["click", "keydown", "mousemove"].forEach((evt) =>
      document.addEventListener(evt, reiniciarTemporizador)
    );
    actualizarFechaChile();
    actualizarInfoUsuario();
    setInterval(actualizarFechaChile, 1000);
    setInterval(actualizarInfoUsuario, 1000);
    actualizarCentroNotificaciones();
    if (notifWrapper) notifWrapper.classList.remove("oculto");
    cargarNotificacionesDesdeSupabase();
    if (window.supabaseSync && supabaseSync.subscribeNotificaciones) {
      supabaseSync.subscribeNotificaciones();
    }
    refrescarDatos();
      cambiarVista(vistaActual);
      if (typeof actualizarDashboard === "function") {
        actualizarDashboard();
      }
    }

    let usuarioActual = null;
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    const email = session.user.email;
    usuarioActual = {
      usuario: email,
      nombre:
        NOMBRES_POR_EMAIL[email] || session.user.user_metadata?.nombre || email,
      esAdmin: Boolean(session.user.is_admin),
      rol: session.user.role || (session.user.is_admin ? "admin" : "abogado"),
    };
    localStorage.setItem("usuarioActual", JSON.stringify(usuarioActual));
    sessionStart = parseInt(localStorage.getItem("sessionStart") || Date.now());
    await cargarPreferencias();
    mostrarApp();
  }
  if (!usuarioActual) {
    document.body.classList.remove("app-activa");
    loginDiv.classList.remove("oculto");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuario = document.getElementById("loginUsuario").value.trim();
      const pass = document.getElementById("loginPass").value;
      const { data, error } = await sb.auth.signInWithPassword({
        email: usuario,
        password: pass,
      });
      if (error || !data.session) {
        loginError.textContent = error?.message || "No se pudo iniciar sesión. Revisa correo, clave o conexión.";
        return;
      }
      const user = data.user;
      const u = {
        usuario: user.email,
        nombre:
          NOMBRES_POR_EMAIL[user.email] ||
          user.user_metadata?.nombre ||
          user.email,
        esAdmin: Boolean(user.is_admin),
        rol: user.role || (user.is_admin ? "admin" : "abogado"),
      };
      localStorage.setItem("usuarioActual", JSON.stringify(u));
      sessionStart = Date.now();
      localStorage.setItem("sessionStart", sessionStart.toString());
      loginError.textContent = "";
      await cargarPreferencias();
      mostrarApp();
    });
  }

  // Paso 1: Obtenemos todos los botones de pestañas con data-tab (evita el boton de tema)
  const tabs = document.querySelectorAll(".tab[data-tab]");

  // Paso 2: A cada botón le asignamos una función para cambiar la vista
  tabs.forEach(tab => {
    // Cada botón tiene un atributo personalizado llamado data-tab
    // que indica qué vista debe mostrarse cuando se hace clic.
    tab.addEventListener("click", () => {
      const vistaSeleccionada = tab.getAttribute("data-tab"); // extrae "dashboard", "clientes", etc.
        localStorage.setItem("ultimaVista", vistaSeleccionada);
        cambiarVista(vistaSeleccionada);
    });
  });

  // Paso 3: Mostramos la vista guardada o Dashboard por defecto
  cambiarVista(vistaActual);

  const abrirGeneradorDashboard = document.getElementById("abrirGeneradorDashboard");
  if (abrirGeneradorDashboard) {
    abrirGeneradorDashboard.addEventListener("click", () => {
      localStorage.setItem("ultimaVista", "generador");
      cambiarVista("generador");
    });
  }

  const botonTema = document.getElementById("toggleTema");
  if (botonTema) {
    const mediaPref = window.matchMedia("(prefers-color-scheme: dark)");

    function aplicarTema(pref) {
      const guardado = localStorage.getItem(usuarioKey("tema"));
      const oscuro = guardado ? guardado === "oscuro" : pref;
      document.body.classList.toggle("dark-mode", oscuro);
      botonTema.innerHTML = oscuro
        ? "<i class='fa-sharp fa-solid fa-sun'></i><span> Claro</span>"
        : "<i class='fa-sharp fa-solid fa-moon'></i><span> Oscuro</span>";
      aplicarConfiguracion();
    }

    aplicarTema(mediaPref.matches);

    mediaPref.addEventListener("change", (e) => {
      if (!localStorage.getItem(usuarioKey("tema"))) {
        aplicarTema(e.matches);
        aplicarConfiguracion();
        cambiarVista(vistaActual);
      }
    });

    botonTema.addEventListener("click", () => {
      const nuevo = !document.body.classList.contains("dark-mode");
      document.body.classList.toggle("dark-mode", nuevo);
      botonTema.innerHTML = nuevo
        ? "<i class='fa-sharp fa-solid fa-sun'></i><span> Claro</span>"
        : "<i class='fa-sharp fa-solid fa-moon'></i><span> Oscuro</span>";
      localStorage.setItem(usuarioKey("tema"), nuevo ? "oscuro" : "claro");
      aplicarConfiguracion();
      cambiarVista(vistaActual);
    });
  }

  const botonCerrar = document.getElementById("cerrarSesion");
  if (botonCerrar) {
    botonCerrar.addEventListener("click", cerrarSesion);
  }

  const modalAlerta = document.getElementById("modalAlerta");
  if (modalAlerta) {
    const cerrarAlerta = document.getElementById("modalAlertaCerrar");
    const driveBtn = document.getElementById("modalAlertaDrive");
    if (cerrarAlerta) {
      cerrarAlerta.addEventListener("click", () => {
        modalAlerta.classList.add("oculto");
        if (driveBtn) driveBtn.classList.add("oculto");
        if (window.sesionExpirada) cerrarSesion();
      });
    }
    modalAlerta.addEventListener("click", (e) => {
      if (e.target === modalAlerta) {
        modalAlerta.classList.add("oculto");
        if (driveBtn) driveBtn.classList.add("oculto");
        if (window.sesionExpirada) cerrarSesion();
      }
    });
  }

  const btnNuevaTareaDash = document.getElementById("nuevaTareaDashboard");
  if (btnNuevaTareaDash) {
    btnNuevaTareaDash.addEventListener("click", () => {
      const btnNueva = document.getElementById("nuevaTareaDiaBtn");
      if (btnNueva) btnNueva.click();
    });
  }

  const btnNuevoCliente = document.getElementById("nuevoClienteDashboard");
  if (btnNuevoCliente) {
    btnNuevoCliente.addEventListener("click", () => {
      mostrarModal(document.getElementById("modalFormulario"));
    });
  }

  const btnCotizaciones = document.getElementById("cotizacionesDashboard");
  if (btnCotizaciones) {
    btnCotizaciones.addEventListener("click", () => {
      window.open(
        "https://drive.google.com/drive/folders/1FBctJ8BlyM6twOBn_xRw8R_mW8xsqBPj",
        "_blank"
      );
    });
  }

  const btnGenCot = document.getElementById("generarCotizacionDashboard");
  const modalCot = document.getElementById("modalCotizacion");
  const modalPreview = document.getElementById("modalPreview");
  const cerrarPreview = document.getElementById("cerrarModalPreview");
  if (btnGenCot && modalCot) {
    const cerrarCot = document.getElementById("cerrarModalCotizacion");
    btnGenCot.addEventListener("click", () => mostrarModal(modalCot));
    if (cerrarCot) cerrarCot.addEventListener("click", () => modalCot.classList.add("oculto"));
    modalCot.addEventListener("click", (e) => {
      if (e.target === modalCot) modalCot.classList.add("oculto");
    });
  }
  if(modalPreview && cerrarPreview){
    cerrarPreview.addEventListener("click", () => modalPreview.classList.add("oculto"));
    modalPreview.addEventListener("click", e=>{ if(e.target===modalPreview) modalPreview.classList.add("oculto")});
  }


  const btnConfig = document.getElementById("abrirConfiguracion");
  const modalConfig = document.getElementById("modalConfiguracion");
  if (btnConfig && modalConfig) {
    const cerrarConfig = document.getElementById("cerrarModalConfiguracion");
    const guardarConfig = document.getElementById("guardarConfiguracion");
    btnConfig.addEventListener("click", () => {
      document.getElementById("configRadio").value = configuracion.radius;
      document.getElementById("configTema").value = configuracion.tema;
      document.getElementById("configFuente").value = configuracion.fuente;
      document.getElementById("configFormatoFecha").value = configuracion.formatoFecha;
      document.getElementById("configFormatoHora").value = configuracion.formatoHora;
      mostrarModal(modalConfig);
    });
    if (cerrarConfig) cerrarConfig.addEventListener("click", () => modalConfig.classList.add("oculto"));
    modalConfig.addEventListener("click", (e) => {
      if (e.target === modalConfig) modalConfig.classList.add("oculto");
    });
    const actualizarConfig = () => {
      localStorage.setItem(
        usuarioKey("configuracion"),
        JSON.stringify(configuracion)
      );
      aplicarConfiguracion();
    };

    function enlazar(id, prop, parser = (v) => v) {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, async () => {
        configuracion[prop] = parser(el.value);
        actualizarConfig();
        if (
          prop === "tema" &&
          window.supabaseSync &&
          supabaseSync.guardarTema
        ) {
          const u = JSON.parse(
            localStorage.getItem("usuarioActual") || "null"
          );
          if (u) supabaseSync.guardarTema(u.usuario, configuracion.tema);
        }
      });
    }

    enlazar("configRadio", "radius");
    enlazar("configTema", "tema");
    enlazar("configFuente", "fuente");
    enlazar("configFormatoFecha", "formatoFecha");
    enlazar("configFormatoHora", "formatoHora");

    if (guardarConfig) {
      guardarConfig.addEventListener("click", () => {
        modalConfig.classList.add("oculto");
      });
    }
  }
});
