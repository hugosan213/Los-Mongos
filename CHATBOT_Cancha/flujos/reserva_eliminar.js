const querys = require('../conexion/querys');
const { eliminarReserva } = require('../conexion/insertar_bd');

function getTextoMensaje(message) {
  return (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
}

async function flujoEliminarReserva(client, message, estado) {
  if (estado.flujoActual && estado.flujoActual !== 'eliminar') return;

  const user = message.key?.remoteJid || message.from;
  const texto = getTextoMensaje(message).toLowerCase();

  // Inicio del flujo: si el usuario escribe 'hola', 'eliminar' o '5' iniciamos
  if ((texto === 'hola' || texto === 'eliminar' || texto === '5') && (!estado.paso || estado.paso < 1)) {
    estado.paso = 1;
    estado.datos = {};
    // limpiar flag si venía del principal
    if (estado.datos && estado.datos.awaitingDeleteStart) delete estado.datos.awaitingDeleteStart;
    estado.flujoActual = 'eliminar';
    await client.sendMessage(user, { text: '🗑️ Has elegido eliminar reservas. Por favor, ingresa tu DNI (7 u 8 dígitos):' });
    return;
  }

  // Paso 1: DNI y listado de reservas
  if (estado.paso === 1) {
    const dni = texto.replace(/\D/g, '');
    if (!/^\d{7,8}$/.test(dni)) {
      await client.sendMessage(user, { text: '❌ DNI inválido. Por favor ingresa 7 u 8 dígitos.' });
      return;
    }
    estado.datos.dni = dni;

  // Obtener reservas del usuario (por defecto la función en querys filtra por futuras)
  const reservasFuturas = await querys.obtenerReservasPorUsuario(estado.datos.dni, null);
  let reservas = reservasFuturas;

    if (!reservas || reservas.length === 0) {
      // Si no hay reservas futuras, buscar automáticamente en todas (pasadas+futuras)
  const todas = querys.obtenerReservasPorUsuarioTodas ? await querys.obtenerReservasPorUsuarioTodas(estado.datos.dni, null) : [];
      if (!todas || todas.length === 0) {
        await client.sendMessage(user, { text: 'ℹ️ No se encontraron reservas (ni pasadas ni futuras) para ese DNI.' });
        // limpiar estado del subflujo
        delete estado.paso; delete estado.datos; delete estado.flujoActual;
        return;
      }

      // mostrar todas
      let mensajeTodas = '📋 Estas son tus reservas (envía el número para seleccionar la que deseas eliminar):\n\n';
      todas.forEach((r, i) => {
          const fechaTxt = r.Fecha.toISOString().split('T')[0];
          const horaTxt = r.Hora.slice(0,5);
          const profTxt = r.medicoNombre ? ` — Profesional: ${r.medicoNombre} ${r.medicoApellido || ''}${r.especialidad ? ' (' + r.especialidad + ')' : ''}` : '';
          if (r.recursoNombre) {
            mensajeTodas += `${i + 1}. ${r.recursoNombre}${profTxt} - ${fechaTxt} ${horaTxt}\n`;
          } else if (r.tipo_cancha) {
            mensajeTodas += `${i + 1}. Cancha: ${r.canchaNombre} (${r.tipo_cancha}) - ${fechaTxt} ${horaTxt}\n`;
          } else if (r.especialidad) {
            mensajeTodas += `${i + 1}. Clínica: ${r.medicoNombre} ${r.medicoApellido} (${r.especialidad}) - ${fechaTxt} ${horaTxt}\n`;
          } else {
            mensajeTodas += `${i + 1}. Recurso: ${r.canchaNombre || r.medicoNombre || 'N/A'}${profTxt} - ${fechaTxt} ${horaTxt}\n`;
          }
      });
      mensajeTodas += '\nEscribe el número de la reserva que deseas eliminar.';

      estado.opciones = todas;
      estado.paso = 2;
      await client.sendMessage(user, { text: mensajeTodas });
      return;
    }

    // Mostrar lista enumerada
    let mensaje = '📋 Estas son tus reservas (envía el número para seleccionar la que deseas eliminar):\n\n';
    reservas.forEach((r, i) => {
        const fechaTxt = r.Fecha.toISOString().split('T')[0];
        const horaTxt = r.Hora.slice(0,5);
        const profTxt = r.medicoNombre ? ` — Profesional: ${r.medicoNombre} ${r.medicoApellido || ''}${r.especialidad ? ' (' + r.especialidad + ')' : ''}` : '';
        if (r.recursoNombre) {
          mensaje += `${i + 1}. ${r.recursoNombre}${profTxt} - ${fechaTxt} ${horaTxt}\n`;
        } else if (r.tipo_cancha) {
          mensaje += `${i + 1}. Cancha: ${r.canchaNombre} (${r.tipo_cancha}) - ${fechaTxt} ${horaTxt}\n`;
        } else if (r.especialidad) {
          mensaje += `${i + 1}. Clínica: ${r.medicoNombre} ${r.medicoApellido} (${r.especialidad}) - ${fechaTxt} ${horaTxt}\n`;
        } else {
          mensaje += `${i + 1}. Recurso: ${r.canchaNombre || r.medicoNombre || 'N/A'}${profTxt} - ${fechaTxt} ${horaTxt}\n`;
        }
    });
    mensaje += '\nEscribe el número de la reserva que deseas eliminar.';

    estado.opciones = reservas;
    estado.paso = 2;
    await client.sendMessage(user, { text: mensaje });
    return;
  }

  // Paso 1.5: Confirmación para buscar todas las reservas
  if (estado.paso === 1.5) {
    const afirmativos = ['si', 'sí', 's'];
    const negativos = ['no', 'n'];
    if (afirmativos.includes(texto)) {
  const todas = querys.obtenerReservasPorUsuarioTodas ? await querys.obtenerReservasPorUsuarioTodas(estado.datos.dni, null) : [];
      if (!todas || todas.length === 0) {
        await client.sendMessage(user, { text: 'ℹ️ No se encontraron reservas (ni pasadas ni futuras) para ese DNI.' });
        delete estado.paso; delete estado.datos; delete estado.flujoActual; delete estado.opciones;
        return;
      }

      // mostrar todas
      let mensaje = '📋 Todas las reservas encontradas:\n\n';
      todas.forEach((r, i) => {
          const fechaTxt = r.Fecha.toISOString().split('T')[0];
          const horaTxt = r.Hora.slice(0,5);
          const profTxt = r.medicoNombre ? ` — Profesional: ${r.medicoNombre} ${r.medicoApellido || ''}${r.especialidad ? ' (' + r.especialidad + ')' : ''}` : '';
          if (r.recursoNombre) {
            mensaje += `${i + 1}. ${r.recursoNombre}${profTxt} - ${fechaTxt} ${horaTxt}\n`;
          } else if (r.tipo_cancha) {
            mensaje += `${i + 1}. Cancha: ${r.canchaNombre} (${r.tipo_cancha}) - ${fechaTxt} ${horaTxt}\n`;
          } else if (r.especialidad) {
            mensaje += `${i + 1}. Clínica: ${r.medicoNombre} ${r.medicoApellido} (${r.especialidad}) - ${fechaTxt} ${horaTxt}\n`;
          } else {
            mensaje += `${i + 1}. Recurso: ${r.canchaNombre || r.medicoNombre || 'N/A'}${profTxt} - ${fechaTxt} ${horaTxt}\n`;
          }
      });
      mensaje += '\nEscribe el número de la reserva que deseas eliminar.';

      estado.opciones = todas;
      estado.paso = 2;
      await client.sendMessage(user, { text: mensaje });
      return;
    } else if (negativos.includes(texto)) {
      await client.sendMessage(user, { text: 'Operación cancelada. Escribe "hola" para volver al menú.' });
      delete estado.paso; delete estado.datos; delete estado.flujoActual; delete estado.opciones;
      return;
    } else {
      await client.sendMessage(user, { text: '❓ Responde "sí" para buscar todas las reservas o "no" para cancelar.' });
      return;
    }
  }



  // Paso 2: Selección de reserva
  if (estado.paso === 2) {
    const sel = parseInt(texto, 10);
    if (!estado.opciones || isNaN(sel) || sel < 1 || sel > estado.opciones.length) {
      await client.sendMessage(user, { text: '❌ Número inválido. Elige uno de la lista.' });
      return;
    }

    const reserva = estado.opciones[sel - 1];
    estado.datos.reservaSeleccionada = reserva;
      // Si la reserva no tiene Recurso_Medico_id y el recurso tiene varios profesionales,
      // pedimos al usuario que confirme cuál profesional corresponde (evita ambiguedad)
      if (!reserva.Recurso_Medico_id && reserva.Recurso_idRecurso) {
        try {
          const pros = querys.obtenerProfesionalesPorRecurso ? await querys.obtenerProfesionalesPorRecurso(reserva.Recurso_idRecurso) : [];
          if (pros && pros.length > 1) {
            // Guardar la lista para seleccionar profesional
            estado.datos.profesionalesOpciones = pros;
            let listaPros = '🔎 Esta reserva pertenece a un recurso con varios profesionales. Por favor, selecciona el profesional correspondiente:\n\n';
            pros.forEach((p, idx) => listaPros += `${idx + 1}. ${p.Nombre} ${p.Apellido} (${p.Especialidad || 'Sin especialidad'})\n`);
            listaPros += '\nEscribe el número del profesional que corresponde a tu reserva.';
            estado.paso = 2.5; // paso intermedio para elegir profesional
            await client.sendMessage(user, { text: listaPros });
            return;
          }
        } catch (err) {
          console.error('Error al obtener profesionales por recurso:', err);
        }
      }

      // Si llegamos aquí, no hay ambigüedad: mostramos el detalle como antes
      const fechaTxt = reserva.Fecha.toISOString().split('T')[0];
      const horaTxt = reserva.Hora.slice(0,5);
      let detalles;
      if (reserva.recursoNombre) {
        const profTxt = reserva.medicoNombre ? `\n👨‍⚕️ Profesional: ${reserva.medicoNombre} ${reserva.medicoApellido || ''}${reserva.especialidad ? ' (' + reserva.especialidad + ')' : ''}` : '';
        detalles = `🔖 ${reserva.recursoNombre}${profTxt}\n📍 Sede: ${reserva.sede || 'Sin sede'}\n🗓 Fecha: ${fechaTxt} ⏰ Hora: ${horaTxt}\nEstado: ${reserva.Estado}`;
      } else if (reserva.tipo_cancha) {
        detalles = `🏟️ Cancha: ${reserva.canchaNombre} (${reserva.tipo_cancha})\n📍 Sede: ${reserva.sede || 'Sin sede'}\n🗓 Fecha: ${fechaTxt} ⏰ Hora: ${horaTxt}\nEstado: ${reserva.Estado}`;
      } else {
        detalles = `👨‍⚕️ Profesional: ${reserva.medicoNombre || ''} ${reserva.medicoApellido || ''} (${reserva.especialidad || ''})\n📍 Sede: ${reserva.sede || 'Sin sede'}\n🗓 Fecha: ${fechaTxt} ⏰ Hora: ${horaTxt}\nEstado: ${reserva.Estado}`;
      }

      estado.paso = 3;
      await client.sendMessage(user, { text: `🔎 Reserva seleccionada:\n${detalles}\n\n1️⃣ Eliminar esta reserva\n2️⃣ Cancelar` });
      return;
  }

  // Paso 2.5: Selección de profesional cuando el recurso tiene varios y la reserva es ambigua
  if (estado.paso === 2.5) {
    const selPro = parseInt(texto, 10);
    if (!estado.datos.profesionalesOpciones || isNaN(selPro) || selPro < 1 || selPro > estado.datos.profesionalesOpciones.length) {
      await client.sendMessage(user, { text: '❌ Número inválido. Elige uno de la lista de profesionales.' });
      return;
    }

    const elegido = estado.datos.profesionalesOpciones[selPro - 1];
    // Actualizar la reserva seleccionada con el profesional elegido
    if (estado.datos.reservaSeleccionada) {
      estado.datos.reservaSeleccionada.medicoNombre = elegido.Nombre;
      estado.datos.reservaSeleccionada.medicoApellido = elegido.Apellido;
      estado.datos.reservaSeleccionada.especialidad = elegido.Especialidad;
      estado.datos.reservaSeleccionada.Recurso_Medico_id = elegido.idRecurso_Medico;
    }

    // Continuar al detalle y confirmación
    const reserva = estado.datos.reservaSeleccionada;
    const fechaTxt = reserva.Fecha.toISOString().split('T')[0];
    const horaTxt = reserva.Hora.slice(0,5);
    const profTxt = reserva.medicoNombre ? `\n👨‍⚕️ Profesional: ${reserva.medicoNombre} ${reserva.medicoApellido || ''}${reserva.especialidad ? ' (' + reserva.especialidad + ')' : ''}` : '';
    const detalles = `🔖 ${reserva.recursoNombre || reserva.canchaNombre || reserva.medicoNombre}${profTxt}\n📍 Sede: ${reserva.sede || 'Sin sede'}\n🗓 Fecha: ${fechaTxt} ⏰ Hora: ${horaTxt}\nEstado: ${reserva.Estado}`;

    estado.paso = 3;
    await client.sendMessage(user, { text: `🔎 Reserva seleccionada:\n${detalles}\n\n1️⃣ Eliminar esta reserva\n2️⃣ Cancelar` });
    return;
  }

  // Paso 3: Confirmar eliminación
  if (estado.paso === 3) {
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

  // Si llega aquí fuera de pasos
  await client.sendMessage(user, { text: '❓ Para eliminar una reserva escribe "5" o "eliminar reservas".' });
}

module.exports = { flujoEliminarReserva };
