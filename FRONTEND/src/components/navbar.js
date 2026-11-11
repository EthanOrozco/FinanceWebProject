class AppNavbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <aside class="side-navbar" id="sidebarNav">
        <div class="nav-mobile-header d-lg-none">
          <a href="./dashboard.html" class="nav-logo">
            <i class="fa-regular fa-compass nav-logo-icon"></i>
            <span>VECTOR</span>
          </a>
          <button type="button" class="nav-close-btn" onclick="closeSidebar()" aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <a href="./dashboard.html" class="nav-logo d-none d-lg-flex">
          <i class="fa-regular fa-compass nav-logo-icon"></i>
          <span>VECTOR</span>
        </a>

        <nav class="flex-grow-1">
          <span class="nav-section-label">GENERAL</span>
          <ul class="nav-links list-unstyled">
            <li><a href="./dashboard.html" class="nav-link"><i class="fa-solid fa-gauge"></i>Dashboard</a></li>
            <li><a href="./transacciones.html" class="nav-link"><i class="fa-solid fa-right-left"></i>Transacciones</a></li>
            <li><a href="#" class="nav-link"><i class="fa-solid fa-wallet"></i>Cuentas</a></li>
            <li><a href="./metas.html" class="nav-link"><i class="fa-solid fa-bullseye"></i>Metas y deudas</a></li>
            <li><a href="./categorias.html" class="nav-link"><i class="fa-solid fa-tag"></i>Categorías</a></li>
          </ul>

          <span class="nav-section-label" style="margin-top: 8px;">CUENTA</span>
          <ul class="nav-links list-unstyled">
            <li><a href="./perfil.html" class="nav-link"><i class="fa-solid fa-user"></i>Perfil</a></li>
            <li><a href="#" class="nav-link"><i class="fa-solid fa-circle-question"></i>Ayuda y FAQ</a></li>
          </ul>
        </nav>

        <div class="nav-user-card ">
          <div class="nav-avatar">EO</div>
          <div class="nav-user-info">
            <span class="nav-user-name">Ethan Orozco</span>
            <span class="nav-user-email">ethan@example.com</span>
          </div>
          <button class="nav-logout-btn" aria-label="Cerrar sesión" onclick="openLogoutModal()">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </aside>
    `

    if (!document.getElementById('logoutModal')) {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div class="modal fade" id="logoutModal" tabindex="-1" aria-labelledby="logoutModalLabel">
          <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content">
              <div class="modal-body p-4">
                <div class="delete-icon-wrap" style="background:#1E2A44;color:#6C9EF8;">
                  <i class="fa-solid fa-right-from-bracket"></i>
                </div>
                <h5 class="mt-3 mb-1 text-center" id="logoutModalLabel" style="font-size:16px;">¿Cerrar sesión?</h5>
                <p class="text-center mb-0" style="font-size:13px;color:var(--c-text-muted);">
                  Tu sesión se cerrará en este dispositivo.
                </p>
                <div class="d-flex gap-2 mt-3">
                  <button class="btn btn-secondary flex-fill" data-bs-dismiss="modal">Cancelar</button>
                  <button class="btn btn-primary flex-fill" onclick="window.location.href='./login.html'">
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal.firstElementChild);
    }

    const links = this.querySelectorAll('.nav-link');
    links.forEach(link => {
      if (link.href === window.location.href) {
        link.classList.add('active-link');
      }
    });
  }
}

customElements.define('app-navbar', AppNavbar)

function openLogoutModal() {
  new bootstrap.Modal(document.getElementById('logoutModal')).show();
}
