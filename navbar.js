// navbar.js
// Este script carga el navbar.html y lo inserta en el elemento con id 'navbar-container'
document.addEventListener('DOMContentLoaded', function() {
  fetch('navbar.html')
    .then(response => response.text())
    .then(data => {
      document.getElementById('navbar-container').innerHTML = data;
      // Reasignar eventos después de insertar el navbar
      document.querySelectorAll('.producto-menu-item').forEach(function(item){
        item.addEventListener('click', function(){
          window.location.href = item.getAttribute('data-url');
        });
      });
    });
});
