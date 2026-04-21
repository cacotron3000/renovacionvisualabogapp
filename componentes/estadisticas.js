// === estadisticas.js ===
// Genera gráficos estadísticos de expedientes usando Chart.js

let graficoMaterias;
let graficoTramite;
let graficoPropuesta;

function obtenerRadioBarras() {
  const config =
    JSON.parse(localStorage.getItem("configuracion") || "null") || {};
  return config.tema && config.tema !== "original" ? 6 : 0;
}

function mostrarCarga(id) {
  const cont = document.getElementById(id).parentElement;
  const loader = cont.querySelector(".grafico-loader");
  if (loader) loader.classList.remove("oculto");
}

function ocultarCarga(id) {
  const cont = document.getElementById(id).parentElement;
  const loader = cont.querySelector(".grafico-loader");
  if (loader) loader.classList.add("oculto");
}

function obtenerDatosExpedientes() {
  const activos = JSON.parse(localStorage.getItem("expedientes")) || [];
  const archivados = JSON.parse(localStorage.getItem("expedientesArchivados")) || [];
  return activos.concat(archivados);
}

function contarPorCampo(lista, campo) {
  const conteo = {};
  lista.forEach(e => {
    const clave = e[campo] || "Sin dato";
    conteo[clave] = (conteo[clave] || 0) + 1;
  });
  return conteo;
}

function crearGrafico(ctx, tipo, etiquetas, datos, titulo) {
  const colores = [
    "#4e79a7",
    "#f28e2b",
    "#e15759",
    "#76b7b2",
    "#59a14f",
    "#edc949",
    "#af7aa1",
    "#ff9da7",
    "#9c755f",
    "#bab0ab"
  ];
  const config = JSON.parse(localStorage.getItem("configuracion") || "null") || {};
  const esLiquid = config.tema === "liquid";

  return new Chart(ctx, {
    type: tipo,
    data: {
      labels: etiquetas,
      datasets: [{
        label: "Casos",
        data: datos,
        backgroundColor: colores.slice(0, etiquetas.length),
        borderColor: "#ffffff",
        borderWidth: 1,
        borderRadius: obtenerRadioBarras()
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: { position: "bottom", labels: esLiquid ? { color: "#fff" } : {} },
        title: {
          display: false,
          text: titulo
        }
      },
      scales: {
        x: { ticks: { color: esLiquid ? "#fff" : undefined } },
        y: { ticks: { color: esLiquid ? "#fff" : undefined } }
      }
    }
  });
}

function actualizarEstadisticas() {
  const casos = obtenerDatosExpedientes();

  mostrarCarga("graficoMaterias");
  mostrarCarga("graficoTramite");
  mostrarCarga("graficoPropuesta");

  const porMateria = contarPorCampo(casos, "materia");
  const porTramite = contarPorCampo(casos, "tramite");
  const porPropuesta = contarPorCampo(casos, "propuesta");

  if (graficoMaterias) graficoMaterias.destroy();
  if (graficoTramite) graficoTramite.destroy();
  if (graficoPropuesta) graficoPropuesta.destroy();

  const ctx1 = document.getElementById("graficoMaterias").getContext("2d");
  graficoMaterias = crearGrafico(
    ctx1,
    "bar",
    Object.keys(porMateria),
    Object.values(porMateria),
    "Casos según materia"
  );
  ocultarCarga("graficoMaterias");

  const ctx2 = document.getElementById("graficoTramite").getContext("2d");
  graficoTramite = crearGrafico(
    ctx2,
    "doughnut",
    Object.keys(porTramite),
    Object.values(porTramite),
    "Casos según estado"
  );
  ocultarCarga("graficoTramite");

  const ctx3 = document.getElementById("graficoPropuesta").getContext("2d");
  graficoPropuesta = crearGrafico(
    ctx3,
    "doughnut",
    Object.keys(porPropuesta),
    Object.values(porPropuesta),
    "Propuestas según estado"
  );
  ocultarCarga("graficoPropuesta");
}

// Actualizar al cargar
document.addEventListener("DOMContentLoaded", actualizarEstadisticas);
