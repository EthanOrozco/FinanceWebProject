(function initGlobalUI() {
  if (document.getElementById('vector-global-ui')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'vector-global-ui';
  wrapper.innerHTML = `
    <div id="vectorLoader" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.75); backdrop-filter:blur(4px); z-index:9999; align-items:center; justify-content:center; flex-direction:column;">
      <span class="spinner-border" role="status" aria-hidden="true" style="width:3rem; height:3rem; color:#f8fafc;"></span>
      <span style="color:#f8fafc; font-family:'Inter',sans-serif; font-size:14px; font-weight:600; margin-top:14px;">Procesando...</span>
    </div>
    <div id="vectorToastContainer" style="position:fixed; top:20px; right:20px; z-index:10000; display:flex; flex-direction:column; gap:10px; max-width:340px;"></div>
  `;
  document.body.appendChild(wrapper);
})();

const VectorAuth = {
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('vector_user'));
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('vector_user', JSON.stringify(user));
  },
  async logout() {
    try {
      await fetch('/api/users/logout', { method: 'POST' });
    } catch { }
    localStorage.removeItem('vector_user');
    window.location.href = '/login';
  },
  requireAuth() {
    const user = this.getUser();
    if (!user || !user._id) {
      window.location.href = '/login';
      return null;
    }
    return user;
  }
};

function showLoader() {
  const loader = document.getElementById('vectorLoader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('vectorLoader');
  if (loader) loader.style.display = 'none';
}

function showAlert(message, type = 'success') {
  const container = document.getElementById('vectorToastContainer');
  if (!container) return;

  const isError = type === 'error';
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${isError ? '#7f1d1d' : '#064e3b'};
    color: #fff;
    border-left: 4px solid ${isError ? '#ef4444' : '#10b981'};
    padding: 12px 16px;
    border-radius: 10px;
    font-family: 'Inter', sans-serif;
    font-size: 13.5px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// La sesión ahora viaja en una cookie httpOnly; ya no se envian headers
function authHeaders() {
  return {};
}

async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers || {}),
  };

  showLoader();
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    const isAuthRoute = url.startsWith('/api/users/login') || url.startsWith('/api/users/register');
    if (res.status === 401 && !isAuthRoute) {
      Vector.VectorAuth.logout();
      return new Promise(() => { }); //stop in spot; the page is redirecting
    }
    if (!res.ok) {
      throw new Error(data.message || 'Ocurrió un error en la petición');
    }
    return data;
  } finally {
    hideLoader();
  }
}
