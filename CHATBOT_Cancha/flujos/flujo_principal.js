const { flujoReservarCanchaUnificado } = require('./flujo_reservar_cancha');
const { flujoEliminarReserva } = require('./reserva_eliminar');
const { obtenerReservasPorUsuario } = require('../conexion/querys');

const estadosUsuario = {};
const palabrasClave = ["hola", "buenas", "quiero un turno", "turno", "consulta", "reservar", "ayuda", "mis reservas", "siguiente"];

// --- Variables globales para paginación ---
const paginacionReservas = {}; // { [user]: { reservas: [], paginaActual: 0 } }

// --------------------------------
// Mostrar reservas con paginación
// --------------------------------
async function mostrarReservasConPaginacion(client, user, dni, telefono) {
  if (!dni && !telefono) {
    await client.sendMessage(user, { text: '📄 Para mostrar tus reservas, envíanos tu DNI o tu teléfono.' });
    return;
  }

  try {
    const reservas = await obtenerReservasPorUsuario(dni, telefono);

    if (reservas.length === 0) {
      await client.sendMessage(user, { text: 'ℹ️ No tienes reservas futuras.' });
      return;
    }

    paginacionReservas[user] = { reservas, paginaActual: 0 };
    await enviarPaginaReservas(client, user);
  } catch (err) {
    console.error('❌ Error al obtener reservas:', err);
    await client.sendMessage(user, { text: '❌ Ocurrió un error al obtener tus reservas. Intenta más tarde.' });
  }
}

async function enviarPaginaReservas(client, user) {
  const data = paginacionReservas[user];
  if (!data) return;

  const { reservas, paginaActual } = data;
  const desde = paginaActual * 5;
  const hasta = desde + 5;
  const pagina = reservas.slice(desde, hasta);

  let mensaje = `📋 Tus reservas futuras (página ${paginaActual + 1}):\n\n`;
  pagina.forEach(r => {
    if (r.tipo_cancha) {
      mensaje += `🏟️ Cancha: ${r.canchaNombre} (${r.tipo_cancha})\n📍 Sede: ${r.sede || 'Sin sede'}\n🗓 Fecha: ${r.Fecha.toISOString().split('T')[0]} ⏰ Hora: ${r.Hora.slice(0,5)}\nEstado: ${r.Estado}\n\n`;
    } else if (r.especialidad) {
      mensaje += `👨‍⚕️ Profesional: ${r.medicoNombre} ${r.medicoApellido} (${r.especialidad})\n📍 Sede: ${r.sede || 'Sin sede'}\n🗓 Fecha: ${r.Fecha.toISOString().split('T')[0]} ⏰ Hora: ${r.Hora.slice(0,5)}\nEstado: ${r.Estado}\n\n`;
    }
  });

  if (hasta < reservas.length) {
    mensaje += '➡️ Escribe "siguiente" para ver más reservas.';
  } else {
    mensaje += '✅ Fin de tus reservas futuras.';
    delete paginacionReservas[user];
  }

  await client.sendMessage(user, { text: mensaje });
}

async function manejarSiguienteReservas(client, user) {
  const data = paginacionReservas[user];
  if (!data) {
    await client.sendMessage(user, { text: '❌ No hay reservas pendientes de mostrar.' });
    return;
  }
  data.paginaActual += 1;
  await enviarPaginaReservas(client, user);
}

async function flujoPrincipal(client, message) {
    const user = message.key?.remoteJid || message.from;
    if (!user) return;

    const body = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    if (!body) return;

    const texto = body.trim().toLowerCase();

    // --- Inicializar estado del usuario ---
    if (!estadosUsuario[user]) estadosUsuario[user] = { paso: 0, datos: {} };
    const estado = estadosUsuario[user];

    // Si estamos en el subflujo de eliminación, delegar todo el manejo a ese flujo
    if (estado.flujoActual === 'eliminar') {
      await flujoEliminarReserva(client, message, estado);
      return;
    }

    // --- Reinicio limpio si dice hola/buenas ---
  if (texto === 'hola' || texto === 'buenas') {
    estadosUsuario[user] = { paso: 0, datos: {} }; // reset total
    await client.sendMessage(user, {
      text: `👋 ¡Hola! Bienvenido al sistema de reservas. Por favor, elige una opción:
1️⃣ Cancha
2️⃣ Ayuda
4️⃣ Eliminar reserva`
    });
    return;
  }



    // --- Flujo de pedir identificación ---
    if (estado.paso === 'pedir_identificacion') {
        const input = texto.replace(/\D/g, ''); // solo números

        if (input.length >= 6 && input.length <= 10) {
            estado.datos.dni = input;
            estado.paso = 0;
            await mostrarReservasConPaginacion(client, user, estado.datos.dni, null);
            return;
        } else if (input.length === 10 || input.length === 11) {
            estado.datos.telefono = input;
            estado.paso = 0;
            await mostrarReservasConPaginacion(client, user, null, estado.datos.telefono);
            return;
        } else {
            await client.sendMessage(user, { text: '❌ Datos inválidos. Por favor envía tu DNI o tu teléfono correctamente.' });
            return;
        }
    }

    // --- Paginación ---
    if (texto === 'siguiente') {
        await manejarSiguienteReservas(client, user);
        return;
    }

  // --- Paso 0: selección de opción ---
  if (estado.paso === 0) {
    if (texto === '1' || texto.includes('cancha')) {
      estado.datos.rubro = 'Cancha';
      estado.paso = 1;
      await flujoReservarCanchaUnificado(client, message, estado);
      return;
    } else if (texto === '2' || texto.includes('mis reservas')) {
      estado.paso = 'pedir_identificacion';
      estado.datos = {};
      await client.sendMessage(user, { text: '📄 Por favor envíanos tu DNI o tu teléfono para buscar tus reservas.' });
      return;
    } else if (texto === '4' || texto.includes('eliminar')) {
      // Preparar subflujo de eliminación y pedir DNI
      estado.flujoActual = 'eliminar';
      estado.paso = 1;
      estado.datos = {};
      await client.sendMessage(user, { text: '🗑️ Has elegido eliminar reservas. Por favor, ingresa tu DNI (7 u 8 dígitos):' });
      return;
    } else if (texto === '3' || texto.includes('ayuda')) {
      await client.sendMessage(user, {
        text: `💡 Menú de ayuda:
1️⃣ Para reservar Cancha
2️⃣ Para ver tus reservas
3️⃣ Para ayuda`
      });
      return;
    } else {
      await client.sendMessage(user, {
        text: '❌ Opción no válida. Por favor, escribe 1️⃣ Cancha, 2️⃣ Mis reservas o 3️⃣ Ayuda.'
      });
      return;
    }
  }

  // --- Paso >=1: flujo según rubro ---
  if (estado.paso >= 1 && estado.datos.rubro) {
    if (estado.datos.rubro.toLowerCase() === 'cancha') {
      await flujoReservarCanchaUnificado(client, message, estado);
    }
    return;
  }

    // --- Caso por defecto ---
    await client.sendMessage(user, {
        text: '❓ No entendí tu mensaje. Escribe "hola" o "reservar" para comenzar a reservar un turno o una cancha, o "ayuda" para ver opciones.'
    });
}

module.exports = { flujoPrincipal, estadosUsuario };
