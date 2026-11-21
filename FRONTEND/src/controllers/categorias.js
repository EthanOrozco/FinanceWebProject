const PAL = {
  gold: { color: "#E9B95C", tint: "#2A2418", label: "Dorado" },
  blue: { color: "#6C9EF8", tint: "#1E2A44", label: "Azul" },
  teal: { color: "#5ED3A8", tint: "#173329", label: "Verde" },
  purple: { color: "#A98BF5", tint: "#2A2140", label: "Morado" },
  coral: { color: "#F0918A", tint: "#3A2224", label: "Coral" },
  pink: { color: "#F28CC3", tint: "#3A2033", label: "Rosa" },
  slate: { color: "#AEB5C4", tint: "#262E40", label: "Gris" },
};

const ICONS = [
  { key: "fa-utensils", label: "Comida" },
  { key: "fa-car", label: "Auto" },
  { key: "fa-house", label: "Casa" },
  { key: "fa-rotate", label: "Recurrente" },
  { key: "fa-gamepad", label: "Juegos" },
  { key: "fa-heart", label: "Salud" },
  { key: "fa-book", label: "Libro" },
  { key: "fa-bag-shopping", label: "Compras" },
  { key: "fa-briefcase", label: "Trabajo" },
  { key: "fa-laptop", label: "Laptop" },
  { key: "fa-chart-line", label: "Inversión" },
  { key: "fa-tag", label: "Etiqueta" },
  { key: "fa-graduation-cap", label: "Educación" },
];

const toApi = (k) => (k === "gasto" ? "expense" : "income");
const fromApi = (k) => (k === "expense" ? "gasto" : "ingreso");

let categories = [];

const loadCategories = async () => {
  const res = await fetch("/api/categories");
  const data = await res.json();

  render(data);
};

const frmt = (num) => {
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const render = (categories) => {
  const grid = document.getElementById("cat-grid");
  grid.innerHTML = "";
  categories.forEach((cat) => {
    const article = document.createElement("article");
    const p = PAL[cat.color];
    
    article.className = "cat-card";
    article.innerHTML = `
      <div class="cat-card-header">
        <span class="cat-card-icon" style="background:${p.tint}; color:${p.color};">
            <i class="fa-solid ${cat.icon}"></i>
        </span>
        <div class="cat-card-name-wrap">
          <h2 class="cat-card-name">${cat.name}</h2>
          <span class="cat-system-badge" style="background:"#2A2418"; color:"#F3CF85";"> "Personalizada" </span>
        </div>
        <div class="cat-card-btns">
          <button class="cat-action-btn" aria-label="Editar ${cat.name}" onclick="openEditModal(${cat.id})">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="cat-action-btn cat-delete-btn" aria-label="Eliminar ${cat.name}" onclick="openDeleteModal(${cat.id})"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>

      <div class="cat-card-amount-row">
        <div>
          <p class="cat-month-label">Este mes</p>
          <p class="cat-amount">${frmt(0)}</p>
        </div>
        <span style="font-size:12px; font-weight:600; color:${d.color};">${d.text}</span>
      </div>

      <div class="cat-card-bar">
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${share.toFixed(1)}%; background:${p.color};"></div>
        </div>
        <div class="cat-bar-labels">
          <span>${Math.round(share)}% del total</span>
          <span>${cat.txMonth} ${cat.txMonth === 1 ? "movimiento" : "movimientos"}</span>
        </div>
      </div>

      <a href="/transacciones" class="cat-view-link">
        Ver movimientos <i class="fa-solid fa-arrow-right"></i>
      </a>
    `;
    grid.append(article)
  });
};

loadCategories();
