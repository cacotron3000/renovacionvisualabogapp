(function () {
  const DEFAULT_CONFIG = {
    API_BASE_URL: "/backend/api.php",
    API_KEY: "REEMPLAZAR_CON_API_KEY",
  };

  const cfg = Object.assign({}, DEFAULT_CONFIG, window.CPANEL_CONFIG || {});

  const TABLAS = [
    "clientes",
    "expedientes",
    "casosarchivados",
    "tareas",
    "gestionesarchivadas",
    "diario",
    "diarioarchivadas",
    "tareasinternas",
    "comentarios_clientes",
    "comentarios_expedientes",
    "comentarios_tareas",
    "audiencias",
    "audienciasarchivadas",
    "notificaciones",
  ];

  const TABLA_ALIASES = {
    diario: "tareasDia",
    diarioarchivadas: "tareasDiaArchivadas",
    tareasinternas: "tareasInternas",
    comentarios_clientes: "comentariosClientes",
    comentarios_expedientes: "comentariosExpedientes",
    comentarios_tareas: "comentariosTareas",
    audienciasarchivadas: "audienciasArchivadas",
  };

  function localKey(tabla) {
    return TABLA_ALIASES[tabla] || tabla;
  }

  async function apiRequest(action, { method = "GET", query = {}, body = null } = {}) {
    const url = new URL(cfg.API_BASE_URL, window.location.origin);
    url.searchParams.set("action", action);
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });

    const headers = {
      "X-API-Key": cfg.API_KEY,
      Accept: "application/json",
    };
    const actor = JSON.parse(localStorage.getItem("usuarioActual") || "null")?.usuario;
    if (actor) headers["X-Actor"] = actor;

    const options = { method, headers };
    if (body !== null) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url.toString(), options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      throw new Error(json.error || `Error ${res.status}`);
    }
    return json;
  }

  async function pullTabla(tabla) {
    try {
      const { data } = await apiRequest("pull_table", { query: { table: tabla, limit: 1500, offset: 0 } });
      if (Array.isArray(data)) {
        const actual = JSON.parse(localStorage.getItem(localKey(tabla)) || "[]");
        const mapa = new Map(actual.map((x) => [x.id, x]));
        data.forEach((row) => mapa.set(row.id, row));
        localStorage.setItem(localKey(tabla), JSON.stringify(Array.from(mapa.values())));
      }
    } catch (error) {
      console.error(`Error al descargar ${tabla}:`, error);
    }
  }

  async function pullAll() {
    try {
      const { data } = await apiRequest("pull_all", {
        query: { tables: TABLAS.join(","), limit: 1500, offset: 0 },
      });
      TABLAS.forEach((tabla) => {
        if (Array.isArray(data?.[tabla])) {
          const actual = JSON.parse(localStorage.getItem(localKey(tabla)) || "[]");
          const mapa = new Map(actual.map((x) => [x.id, x]));
          data[tabla].forEach((row) => mapa.set(row.id, row));
          localStorage.setItem(localKey(tabla), JSON.stringify(Array.from(mapa.values())));
        }
      });
    } catch (error) {
      console.error("Error en pullAll:", error);
    }
  }

  function triggerBackgroundRefresh() {
    if (window.refrescarDatos) {
      setTimeout(() => window.refrescarDatos(), 0);
    }
  }

  function setSyncStatus(state, text = "") {
    if (typeof window.updateSyncStatus === "function") {
      window.updateSyncStatus(state, text);
    }
  }

  async function pushTabla(tabla) {
    if (window.sesionExpirada) return false;
    const lista = JSON.parse(localStorage.getItem(localKey(tabla)) || "[]");
    try {
      setSyncStatus("syncing");
      await apiRequest("upsert", {
        method: "POST",
        body: { table: tabla, records: lista },
      });
      triggerBackgroundRefresh();
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error(`Error al guardar ${tabla}:`, error);
      setSyncStatus("error");
      return false;
    }
  }

  async function pushRegistro(tabla, registro) {
    if (window.sesionExpirada) return false;
    try {
      setSyncStatus("syncing");
      await apiRequest("upsert", {
        method: "POST",
        body: { table: tabla, records: [registro] },
      });
      triggerBackgroundRefresh();
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error(`Error al guardar registro en ${tabla}:`, error);
      setSyncStatus("error");
      return false;
    }
  }

  async function deleteRegistro(tabla, id) {
    if (window.sesionExpirada) return false;
    try {
      setSyncStatus("syncing");
      await apiRequest("delete", {
        method: "POST",
        body: { table: tabla, id },
      });
      triggerBackgroundRefresh();
      setSyncStatus("ok");
      return true;
    } catch (error) {
      console.error(`Error al eliminar en ${tabla}:`, error);
      setSyncStatus("error");
      return false;
    }
  }

  function subscribeRealtime() {
    // cPanel/MySQL no expone realtime por defecto; se usa sincronización manual.
  }

  async function pushNotificacion(notificacion) {
    return pushRegistro("notificaciones", notificacion);
  }

  async function fetchNotificaciones() {
    try {
      const { data } = await apiRequest("pull_table", {
        query: { table: "notificaciones" },
      });
      if (!Array.isArray(data)) return [];
      return [...data].sort((a, b) => (b.id || 0) - (a.id || 0));
    } catch (error) {
      console.error("Error al obtener notificaciones:", error);
      return [];
    }
  }

  function subscribeNotificaciones() {
    // Sin realtime en esta integración.
  }

  async function guardarTema(usuario, tema) {
    if (!usuario) return false;
    return pushRegistro("temas_usuarios", { id: Date.now(), usuario, tema });
  }

  async function obtenerTema(usuario) {
    if (!usuario) return null;
    try {
      const { data } = await apiRequest("pull_table", { query: { table: "temas_usuarios" } });
      const fila = Array.isArray(data) ? data.find((r) => r.usuario === usuario) : null;
      return fila?.tema || null;
    } catch (error) {
      return null;
    }
  }

  window.supabaseSync = {
    pullTabla,
    pullAll,
    pushTabla,
    pushRegistro,
    deleteRegistro,
    subscribeRealtime,
    pushNotificacion,
    fetchNotificaciones,
    subscribeNotificaciones,
    guardarTema,
    obtenerTema,
    async fetchAuditRecent(limit = 50) {
      try {
        const { data } = await apiRequest("audit_recent", { query: { limit } });
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    async nextQuoteNumber(min = 290) {
      const { data } = await apiRequest("next_quote_number", {
        method: "POST",
        body: { min },
      });
      return Number(data?.numero || 0);
    },
  };

  async function fetchUsersList() {
    const { data } = await apiRequest("users_list");
    return data?.users || [];
  }

  window.supabaseAuth = {
    async fetchUserEmails() {
      const users = await fetchUsersList();
      return users.map((u) => u.email).filter(Boolean);
    },
    async fetchUsers() {
      const users = await fetchUsersList();
      return users.map((u) => ({ email: u.email, nombre: u.user_metadata?.nombre || "" }));
    },
  };

  const sessionKey = "cpanelSession";

  window.sb = {
    auth: {
      async getSession() {
        const saved = localStorage.getItem(sessionKey);
        const session = saved ? JSON.parse(saved) : null;
        return { data: { session } };
      },

      async signInWithPassword({ email, password }) {
        try {
          const { data } = await apiRequest("login", {
            method: "POST",
            body: { email, password },
          });
          const session = {
            access_token: data?.session?.access_token || "local-token",
            user: data?.user,
          };
          localStorage.setItem(sessionKey, JSON.stringify(session));
          return { data: { session, user: data?.user }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },

      async signOut() {
        localStorage.removeItem(sessionKey);
        return { error: null };
      },
    },
  };

  function mapUserForClient(user) {
    return {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata || { nombre: "" },
      role: user.role || (user.is_admin ? "admin" : "abogado"),
    };
  }

  window.sbAdmin = {
    auth: {
      admin: {
        async listUsers() {
          try {
            const users = await fetchUsersList();
            return { data: { users: users.map(mapUserForClient) }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },

        async getUserById(id) {
          try {
            const { data } = await apiRequest("users_get", {
              method: "POST",
              body: { id },
            });
            return { data: { user: mapUserForClient(data.user) }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },

        async deleteUser(id) {
          try {
            await apiRequest("users_delete", {
              method: "POST",
              body: { id },
            });
            return { data: { id }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },

        async updateUserById(id, updates) {
          try {
            await apiRequest("users_update", {
              method: "POST",
              body: {
                id,
                email: updates.email,
                nombre: updates.user_metadata?.nombre,
                password: updates.password,
                role: updates.role,
              },
            });
            return { data: { id }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },

        async createUser({ email, password, user_metadata }) {
          try {
            const { data } = await apiRequest("users_create", {
              method: "POST",
              body: {
                email,
                password,
                nombre: user_metadata?.nombre || email,
                role: user_metadata?.role,
              },
            });
            return { data: { user: { id: data.id, email, user_metadata } }, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
      },
    },
  };
})();
