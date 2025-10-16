const querys = require('../conexion/querys');
const { eliminarReserva } = require('../conexion/insertar_bd');

function getTextoMensaje(message) {
  return (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
}

async function flujoEliminarReservaClinica(client, message, estado) {
  if (estado.flujoActual && estado.flujoActual !== 'eliminar') return;

  const user = message.key?.remoteJid || message.from;
  const texto = getTextoMensaje(message).toLowerCase().trim();

  // --- Paso inicial: iniciar flujo ---
  if (!estado.paso && (texto === 'hola' || texto === 'eliminar' || texto === '2')) {
    estado.flujoActual = 'eliminar';
    estado.paso = 'inicio';
    estado.datos = {};
    await client.sendMessage(user, { text: '🗑️ Has elegido eliminar reservas. Por favor, ingresa tu DNI (7 u 8 dígitos):' });
    return;
  }

  // --- Paso "inicio": validar DNI ---
  if (estado.paso === 'inicio') {
    if (texto === '2' || texto === 'eliminar') return;

    const dni = texto.replace(/\D/g, '');
    if (!/^\d{7,8}$/.test(dni)) {
      await client.sendMessage(user, { text: '❌ DNI inválido. Por favor ingresa 7 u 8 dígitos.' });
      return;
    }
    estado.datos.dni = dni;
    estado.paso = '1';
  }

  // --- Paso 1: Listado de reservas ---
  if (estado.paso === '1') {
    const reservasFuturas = await querys.obtenerReservasPorUsuario(estado.datos.dni, null);
    let reservas = reservasFuturas;

    if (!reservas || reservas.length === 0) {
      const todas = querys.obtenerReservasPorUsuarioTodas
        ? await querys.obtenerReservasPorUsuarioTodas(estado.datos.dni, null)
        : [];
      if (!todas || todas.length === 0) {
        await client.sendMessage(user, { text: 'ℹ️ No se encontraron reservas (ni pasadas ni futuras) para ese DNI.' });
        delete estado.paso; delete estado.datos; delete estado.flujoActual;
        return;
      }
      reservas = todas;
    }

    let mensaje = '📋 Estas son tus reservas (envía el número para seleccionar la que deseas eliminar):\n\n';
    reservas.forEach((r, i) => {
      const fechaTxt = r.Fecha.toISOString().split('T')[0];
      const horaTxt = r.Hora.slice(0,5);
      if (r.medicoNombre) {
        mensaje += `${i + 1}. ${r.medicoNombre} ${r.medicoApellido || ''} (${r.especialidad || ''}) - ${fechaTxt} ${horaTxt}\n`;
      } else {
        mensaje += `${i + 1}. Clínica - ${fechaTxt} ${horaTxt}\n`;
      }
    });

    mensaje += '\nEscribe el número de la reserva que deseas eliminar.';
    estado.opciones = reservas;
    estado.paso = '2';
    await client.sendMessage(user, { text: mensaje });
    return;
  }

  // --- Paso 2: Selección de reserva ---
  if (estado.paso === '2') {
    const sel = parseInt(texto, 10);
    if (!estado.opciones || isNaN(sel) || sel < 1 || sel > estado.opciones.length) {
      await client.sendMessage(user, { text: '❌ Número inválido. Elige uno de la lista.' });
      return;
    }

    const reserva = estado.opciones[sel - 1];
    estado.datos.reservaSeleccionada = reserva;

    const fechaTxt = reserva.Fecha.toISOString().split('T')[0];
    const horaTxt = reserva.Hora.slice(0,5);
    const detalles = reserva.medicoNombre
      ? `👨‍⚕️ Profesional: ${reserva.medicoNombre} ${reserva.medicoApellido || ''} (${reserva.especialidad || ''})\n🗓 Fecha: ${fechaTxt} ⏰ Hora: ${horaTxt}`
      : `Clínica - 🗓 Fecha: ${fechaTxt} ⏰ Hora: ${horaTxt}`;

    estado.paso = '3';
    await client.sendMessage(user, { text: `🔎 Reserva seleccionada:\n${detalles}\n\n1️⃣ Eliminar esta reserva\n2️⃣ Cancelar` });
    return;
  }

  // --- Paso 3: Confirmar eliminación ---
  if (estado.paso === '3') {
    if (texto === '1') {
      try {
        const id = estado.datos.reservaSeleccionada.idReserva;
        await eliminarReserva(id);
        await client.sendMessage(user, { text: `✅ Reserva id ${id} eliminada correctamente.` });
      } catch (err) {
        console.error('Error al eliminar reserva:', err);
        await client.sendMessage(user, { text: `❌ No se pudo eliminar la reserva: ${err.message || err}` });
      }
      delete estado.paso; delete estado.datos; delete estado.opciones; delete estado.flujoActual;
      return;
    } else if (texto === '2') {
      await client.sendMessage(user, { text: '❎ Eliminación cancelada. Escribe "hola" para continuar.' });
      delete estado.paso; delete estado.datos; delete estado.opciones; delete estado.flujoActual;
      return;
    } else {
      await client.sendMessage(user, { text: '❌ Opción inválida. Responde 1️⃣ para eliminar o 2️⃣ para cancelar.' });
      return;
    }
  }

  // --- Por si llega fuera de pasos ---
  await client.sendMessage(user, { text: '❓ Para eliminar una reserva escribe "2" o "eliminar reservas".' });
}

module.exports = { flujoEliminarReservaClinica };
