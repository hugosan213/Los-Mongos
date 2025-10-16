document.addEventListener('DOMContentLoaded', function() {
  // Detecta si estamos dentro de /html/ o en el index principal
  const inHtmlFolder = window.location.pathname.includes('html/');
  const navbarPath = inHtmlFolder ? 'navbar.html' : 'html/navbar.html';

  fetch(navbarPath)
    .then(res => res.text())
    .then(data => {
      const container = document.getElementById('navbar-container');
      container.innerHTML = data;

      // ===== Ajuste automático de rutas =====
      // Si estamos en index.html (fuera de /html/), hay que agregar 'html/' delante de las rutas
      if (!inHtmlFolder) {
        container.querySelectorAll('a, .dropdown-item').forEach(el => {
          const href = el.getAttribute('href');
          const dataUrl = el.getAttribute('data-url');

          // Ajustar los <a href="">
          if (href && !href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('https')) {
            el.setAttribute('href', 'html/' + href);
          }

          // Ajustar los data-url del dropdown
          if (dataUrl) {
            el.setAttribute('data-url', 'html/' + dataUrl);
          }
        });
      }

      // ===== Interactividad de la navbar =====
      const navbarRight = container.querySelector('.navbar-right');
      const hamburger = container.querySelector('.hamburger');
      const dropdownToggle = container.querySelector('#productosDropdown');
      const dropdownMenu = dropdownToggle.nextElementSibling;

      // --- Hamburguesa ---
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navbarRight.classList.toggle('show-mobile');
      });

      // --- Cerrar menú al tocar un link ---
      navbarRight.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navbarRight.classList.remove('show-mobile');
          hamburger.classList.remove('open');
        });
      });

      // --- Dropdown Productos ---
      dropdownToggle.addEventListener('click', e => {
        e.preventDefault();
        dropdownMenu.parentElement.classList.toggle('show');
      });

      // --- Cerrar dropdown si clic afuera ---
      document.addEventListener('click', e => {
        if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
          dropdownMenu.parentElement.classList.remove('show');
        }
      });

      // --- Navegación desde el dropdown ---
      dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          window.location.href = item.getAttribute('data-url');
        });
      });
    })
    .catch(err => console.error('Error al cargar el navbar:', err));
});
