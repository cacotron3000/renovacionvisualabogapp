// === usuarios.js ===
// Maneja el listado y administración de usuarios en Supabase

const usuariosListaDiv = document.getElementById("usuariosLista");
const nuevoUsuarioBtn = document.getElementById("nuevoUsuarioBtn");
const modalUsuario = document.getElementById("modalUsuario");
const usuarioForm = document.getElementById("usuarioForm");
const modalUsuarioCerrar = document.getElementById("modalUsuarioCerrar");

let editandoUsuarioId = null;

async function cargarUsuarios() {
  if (!usuariosListaDiv || !sbAdmin || !sbAdmin.auth || !sbAdmin.auth.admin) return;
  const { data, error } = await sbAdmin.auth.admin.listUsers();
  usuariosListaDiv.innerHTML = "";
  if (error || !data || !data.users) {
    usuariosListaDiv.textContent = "Error al obtener usuarios";
    return;
  }
  data.users.forEach(u => {
    const card = document.createElement("div");
    card.className = "element-card usuario-card";
    const nombre = u.user_metadata?.nombre || "";
    card.innerHTML = `
      <div class="usuario-info"><strong>${u.email}</strong>${
        nombre ? ` (${nombre})` : ""
      }</div>
      <div class="acciones">
        <button class="boton-editar" data-edit="${u.id}">✏️ Editar</button>
        <button class="boton-eliminar" data-del="${u.id}">🗑 Eliminar</button>
      </div>
    `;
    card.style.cursor = "default";
    usuariosListaDiv.appendChild(card);
  });
  usuariosListaDiv.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => editarUsuario(btn.getAttribute('data-edit')));
  });
  usuariosListaDiv.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => eliminarUsuario(btn.getAttribute('data-del')));
  });
}

function mostrarModalUsuario(usuario=null) {
  if (!modalUsuario || !usuarioForm) return;
  usuarioForm.reset();
  editandoUsuarioId = usuario ? usuario.id : null;
  const emailEl = document.getElementById('usuario-email');
  const nombreEl = document.getElementById('usuario-nombre');
  const passEl = document.getElementById('usuario-pass');
  if (usuario) {
    emailEl.value = usuario.email;
    emailEl.disabled = true;
    nombreEl.value = usuario.user_metadata?.nombre || '';
  } else {
    emailEl.value = '';
    emailEl.disabled = false;
    nombreEl.value = '';
  }
  passEl.value = '';
  modalUsuario.classList.remove('oculto');
}

async function editarUsuario(id) {
  const { data, error } = await sbAdmin.auth.admin.getUserById(id);
  if (!error && data && data.user) {
    mostrarModalUsuario(data.user);
  }
}

async function eliminarUsuario(id) {
  if (!confirm('¿Eliminar usuario?')) return;
  await sbAdmin.auth.admin.deleteUser(id);
  cargarUsuarios();
}

if (nuevoUsuarioBtn) {
  nuevoUsuarioBtn.addEventListener('click', () => mostrarModalUsuario());
}

if (modalUsuarioCerrar) {
  modalUsuarioCerrar.addEventListener('click', () => modalUsuario.classList.add('oculto'));
  modalUsuario.addEventListener('click', e => { if (e.target === modalUsuario) modalUsuario.classList.add('oculto'); });
}

if (usuarioForm) {
  usuarioForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('usuario-email').value.trim();
    const nombre = document.getElementById('usuario-nombre').value.trim();
    const pass = document.getElementById('usuario-pass').value;
    if (editandoUsuarioId) {
      const updates = { user_metadata: { nombre } };
      if (pass) updates.password = pass;
      await sbAdmin.auth.admin.updateUserById(editandoUsuarioId, updates);
    } else {
      await sbAdmin.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { nombre } });
    }
    modalUsuario.classList.add('oculto');
    cargarUsuarios();
  });
}

document.addEventListener('DOMContentLoaded', cargarUsuarios);
