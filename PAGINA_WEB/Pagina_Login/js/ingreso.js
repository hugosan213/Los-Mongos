// Manejo del formulario de login
document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault(); // evita recargar la página

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("http://127.0.0.1:3000/index", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      const data = await res.json();

      // Guardamos datos del usuario
      if (data.Apellido) {
        sessionStorage.setItem("usuario", `${data.Apellido}`);
        sessionStorage.setItem("idUsuario", data.id);
      } else {
        sessionStorage.setItem("usuario", data.email);
        sessionStorage.setItem("idUsuario", data.id);
      }

      alert("✅ Login exitoso");
      window.location.href = "../Pagina_Calendario/home.html";
    } else {
      const msg = await res.text();
      alert("❌ Credenciales incorrectas: " + msg);
    }
  } catch (err) {
    alert("⚠️ Error de conexión con el servidor");
    console.error(err);
  }
});

// Mostrar/ocultar contraseña
document.querySelector('.toggle-password').addEventListener('click', function() {
  const passwordInput = document.getElementById('password');
  const eyeOpen = document.getElementById('eye-open');
  const eyeClosed = document.getElementById('eye-closed');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeOpen.style.display = 'none';
    eyeClosed.style.display = 'inline';
  } else {
    passwordInput.type = 'password';
    eyeOpen.style.display = 'inline';
    eyeClosed.style.display = 'none';
  }
});

// Botón "Inicio" → limpia sesión
document.getElementById("btn-Cerrar-Sesion").onclick = function() {
  sessionStorage.clear();
  window.location.href = "../Pagina_Principal/index.html";
};
