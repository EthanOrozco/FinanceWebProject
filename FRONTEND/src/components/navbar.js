class AppNavbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <aside class="side-navbar" id="sidebarNav">
        <div class="nav-mobile-header d-lg-none">
          <a href="/dashboard" class="nav-logo">
            <i class="fa-regular fa-compass nav-logo-icon"></i>
            <span>VECTOR</span>
          </a>
          <button type="button" class="nav-close-btn" onclick="closeSidebar()" aria-label="Cerrar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <a href="/dashboard" class="nav-logo d-none d-lg-flex">
          <i class="fa-regular fa-compass nav-logo-icon"></i>
          <span>VECTOR</span>
        </a>

        <nav class="flex-grow-1">
          <span class="nav-section-label">GENERAL</span>
          <ul class="nav-links list-unstyled">
            <li><a href="/dashboard" class="nav-link"><i class="fa-solid fa-gauge"></i>Dashboard</a></li>
            <li><a href="/transacciones" class="nav-link"><i class="fa-solid fa-right-left"></i>Transacciones</a></li>
            <li><a href="#" class="nav-link"><i class="fa-solid fa-wallet"></i>Cuentas</a></li>
            <li><a href="#" class="nav-link"><i class="fa-solid fa-bullseye"></i>Metas y deudas</a></li>
            <li><a href="/categorias" class="nav-link"><i class="fa-solid fa-tag"></i>Categorías</a></li>
            <li><a href="/metas" class="nav-link"><i class="fa-solid fa-bullseye"></i>Metas y deudas</a></li>
            <li><a href="#" class="nav-link"><i class="fa-solid fa-tag"></i>Categorías</a></li>
          </ul>

          <span class="nav-section-label" style="margin-top: 8px;">CUENTA</span>
          <ul class="nav-links list-unstyled">
            <li><a href="/perfil" class="nav-link"><i class="fa-solid fa-user"></i>Perfil</a></li>
            <li><a href="#" class="nav-link"><i class="fa-solid fa-circle-question"></i>Ayuda y FAQ</a></li>
          </ul>
        </nav>

        <div class="nav-user-card ">
          <div class="nav-avatar">EO</div>
          <div class="nav-user-info">
            <span class="nav-user-name">Ethan Orozco</span>
            <span class="nav-user-email">ethan@example.com</span>
          </div>
          <button class="nav-logout-btn" aria-label="Cerrar sesión">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </aside>
    `

    const links = this.querySelectorAll('.nav-link');
    links.forEach(link => {
      if (link.href === window.location.href) {
        link.classList.add('active-link');
      }
    });
  }
}

customElements.define('app-navbar', AppNavbar)
