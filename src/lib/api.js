// Cliente API que reemplaza @supabase/supabase-js
// Mantiene la misma interfaz para no modificar las páginas

const TOKEN_KEY = 'glivac-token';
const USER_KEY  = 'glivac-user';

let _token = localStorage.getItem(TOKEN_KEY) || null;
let _user  = (() => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } })();

const _listeners = [];

function notifyListeners(event, session) {
  _listeners.forEach(cb => {
    try { cb(event, session); } catch {}
  });
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
  };
}

// ── Query Builder ─────────────────────────────────────────────────────────
class QueryBuilder {
  #table; #method = 'GET'; #body = null;
  #select = '*'; #filters = []; #order = null; #limitVal = null;
  #isSingle = false; #isUpsert = false; #returnData = false;

  constructor(table) { this.#table = table; }

  // --- terminales de acción ---
  select(cols = '*') {
    if (this.#method === 'GET') this.#select = cols;
    else this.#returnData = true;
    return this;
  }
  insert(body) { this.#method = 'POST';  this.#body = body; return this; }
  update(body) { this.#method = 'PATCH'; this.#body = body; return this; }
  delete()     { this.#method = 'DELETE'; return this; }
  upsert(body) { this.#method = 'POST';  this.#body = body; this.#isUpsert = true; return this; }

  // --- modificadores ---
  eq(col, val)      { this.#filters.push({ op: 'eq',    col, val }); return this; }
  neq(col, val)     { this.#filters.push({ op: 'neq',   col, val }); return this; }
  gte(col, val)     { this.#filters.push({ op: 'gte',   col, val }); return this; }
  lte(col, val)     { this.#filters.push({ op: 'lte',   col, val }); return this; }
  gt(col, val)      { this.#filters.push({ op: 'gt',    col, val }); return this; }
  lt(col, val)      { this.#filters.push({ op: 'lt',    col, val }); return this; }
  ilike(col, val)   { this.#filters.push({ op: 'ilike', col, val }); return this; }
  is(col, val)      { this.#filters.push({ op: 'is',    col, val }); return this; }
  in(col, vals)     { this.#filters.push({ op: 'in',    col, val: vals }); return this; }
  order(col, { ascending = true } = {}) { this.#order = { col, ascending }; return this; }
  limit(n)          { this.#limitVal = n; return this; }
  single()          { this.#isSingle = true; return this; }

  // --- ejecución (thenable) ---
  then(resolve, reject) { return this.#run().then(resolve, reject); }

  async #run() {
    const params = new URLSearchParams();

    if (this.#method === 'GET') {
      params.set('select', this.#select);
    }
    for (const { op, col, val } of this.#filters) {
      const key = op === 'eq' ? `${col}__eq` : `${col}__${op}`;
      params.set(key, val === null ? 'null' : val);
    }
    if (this.#order) {
      params.set('order', (this.#order.ascending ? '' : '-') + this.#order.col);
    }
    if (this.#limitVal !== null) params.set('limit', this.#limitVal);
    if (this.#isUpsert)          params.set('upsert', '1');

    const url = `/api/${this.#table}?${params}`;
    try {
      const res = await fetch(url, {
        method:  this.#method,
        headers: getHeaders(),
        body:    this.#body != null ? JSON.stringify(this.#body) : undefined,
      });

      // Token expirado → forzar logout
      if (res.status === 401) {
        _token = null; _user = null;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        notifyListeners('SIGNED_OUT', null);
        return { data: null, error: { message: 'Sesión expirada' } };
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: { message: json.error || 'Error en la solicitud' } };

      let data = json;
      if (this.#isSingle) data = Array.isArray(json) ? (json[0] ?? null) : json;

      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }
}

// ── Helper para llamadas directas a rutas custom ──────────────────────────
export async function fetchApi(path, { method = 'POST', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: getHeaders(),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Error en la solicitud');
  return json;
}

// ── Cliente principal (interfaz compatible con supabase-js) ───────────────
export const supabase = {
  from(table) {
    return new QueryBuilder(table);
  },

  auth: {
    onAuthStateChange(callback) {
      _listeners.push(callback);
      // Notificar estado actual en el siguiente microtask (más rápido que setTimeout)
      Promise.resolve().then(() => {
        if (_token && _user) {
          callback('SIGNED_IN', { user: _user });
        } else {
          callback('SIGNED_OUT', null);
        }
      });

      return {
        data: {
          subscription: {
            unsubscribe() {
              const idx = _listeners.indexOf(callback);
              if (idx >= 0) _listeners.splice(idx, 1);
            },
          },
        },
      };
    },

    async signInWithPassword({ email, password }) {
      try {
        const res = await fetch('/api/auth/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { error: { message: json.error || 'Credenciales incorrectas' } };

        _token = json.token;
        _user  = json.user;
        localStorage.setItem(TOKEN_KEY, _token);
        localStorage.setItem(USER_KEY,  JSON.stringify(_user));
        notifyListeners('SIGNED_IN', { user: _user });
        return { data: { user: _user }, error: null };
      } catch (err) {
        return { error: { message: err.message } };
      }
    },

    async signOut() {
      _token = null;
      _user  = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      notifyListeners('SIGNED_OUT', null);
      return { error: null };
    },

    async getSession() {
      if (!_token || !_user) return { data: { session: null }, error: null };
      return { data: { session: { access_token: _token, user: _user } }, error: null };
    },

    async getUser() {
      if (!_user) return { data: { user: null }, error: null };
      return { data: { user: _user }, error: null };
    },
  },
};
