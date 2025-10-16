const { 
  obtenerCanchasPorSede, 
  obtenerSedesCanchas, 
  obtenerTurnosLibresCancha 
} = require('../conexion/querys');
const { 
  insertarReservaCancha, 
  actualizarReserva, 
  eliminarReservaProvisional 
} = require('../conexion/insertar_bd');

function getTextoMensaje(message) {
  return (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
}

// -----------------------------
// Manejo de reinicio provisional
// -----------------------------
async function verificarReinicioProvisional(client, user, estado, texto) {
  if (estado.flujoActual !== 'cancha') return false;

  const afirmativos = ['si', 'sí', 's'];
  const negativos = ['no', 'n'];

  if (estado.pasoReinicioConfirmacion) {
    if (afirmativos.includes(texto)) {
      if (estado.datos?.idReserva) await eliminarReservaProvisional(Number(estado.datos.idReserva));
      estado.paso = 1;
      estado.datos = {};
      estado.opciones = [];
      delete estado.pasoReinicioConfirmacion;
      await client.sendMessage(user, { text: '✅ Flujo reiniciado con éxito. ¡Hola! 👋 Bienvenido al sistema de reservas de canchas.' });
    } else if (negativos.includes(texto)) {
      delete estado.pasoReinicioConfirmacion;
      await client.sendMessage(user, { text: '👍 Perfecto, continuamos con tu reserva provisional.' });
    } else {
      await client.sendMessage(user, { text: '❓ Responde "sí" para reiniciar o "no" para continuar con tu reserva.' });
    }
    return true;
  }

  if (estado.datos?.idReserva && estado.paso >= 5 && estado.paso <= 9 && (texto === 'hola' || texto === 'reservar')) {
    await client.sendMessage(user, { text: '⚠️ Tienes una reserva provisional en curso. ¿Deseas reiniciarla y empezar de nuevo? (sí/no)' });
    estado.pasoReinicioConfirmacion = true;
    return true;
  }

  return false;
}

// -----------------------------
// Flujo principal
// -----------------------------
async function flujoReservarCanchaUnificado(client, message, estado) {
  if (estado.flujoActual && estado.flujoActual !== 'cancha') return;

  estado.flujoActual = 'cancha';
  const user = message.key?.remoteJid || message.from;
  const texto = getTextoMensaje(message).toLowerCase();

  if (await verificarReinicioProvisional(client, user, estado, texto)) return;

  if ((texto === 'hola' || texto === 'reservar') && estado.paso < 1) {
    estado.paso = 1;
    estado.datos = {};
    estado.opciones = [];
    await client.sendMessage(user, { text: '👋 ¡Hola! Bienvenido al sistema de reservas de canchas.' });
    return;
  }

  // --- Paso 1: Mostrar sedes ---
  if (estado.paso === 1 && !estado.datos.sede) {
    const sedes = await obtenerSedesCanchas();
    if (!sedes?.length) {
      await client.sendMessage(user, { text: '⚠️ No hay sedes disponibles por el momento.' });
      estado.paso = -1;
      return;
    }
    let lista = '🏢 Sedes disponibles:';
    sedes.forEach((s, i) => lista += `\n${i + 1}. ${s.Nombre}`);
    lista += '\nEscribe el número de la sede que deseas seleccionar.';
    await client.sendMessage(user, { text: lista });

    estado.opciones = sedes;
    estado.paso = 2;
    return;
  }

  // --- Paso 2: Selección de sede ---
  if (estado.paso === 2) {
    const seleccion = parseInt(texto, 10);
    if (!estado.opciones?.length || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
      await client.sendMessage(user, { text: '❌ Número inválido. Intenta de nuevo.' });
      return;
    }

    const sedeElegida = estado.opciones[seleccion - 1];
    estado.datos.sede = sedeElegida.Nombre;
    estado.datos.idSede = sedeElegida.idSede;
    delete estado.opciones;

    const canchas = await obtenerCanchasPorSede(sedeElegida.idSede);
    if (!canchas?.length) {
      await client.sendMessage(user, { text: '⚠️ No hay canchas disponibles en esta sede.' });
      estado.paso = -1;
      return;
    }

    let listaCanchas = `🏟️ Canchas en ${sedeElegida.Nombre}:`;
    canchas.forEach((c, i) => listaCanchas += `\n${i + 1}. ${c.Nombre} (${c.Tipo_deporte || 'Otro'})`);
    listaCanchas += '\nEscribe el número de la cancha que deseas reservar.';
    await client.sendMessage(user, { text: listaCanchas });

    estado.opciones = canchas;
    estado.paso = 3;
    return;
  }

  // --- Paso 3: Selección de cancha ---
  if (estado.paso === 3) {
    const seleccion = parseInt(texto, 10);
    if (!estado.opciones?.length || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
      await client.sendMessage(user, { text: '❌ Número de cancha inválido.' });
      return;
    }

    const cancha = estado.opciones[seleccion - 1];
    estado.datos.cancha = cancha.Nombre;
    estado.datos.tipo_cancha = cancha.Tipo_deporte || 'Otro';
    estado.datos.idRecurso_Cancha = cancha.idRecurso_Cancha;
    estado.datos.idRecurso = cancha.Recurso_idRecurso;
    delete estado.opciones;

    const turnos = await obtenerTurnosLibresCancha(cancha.idRecurso_Cancha);
    if (!turnos?.length) {
      await client.sendMessage(user, { text: '⚠️ No hay turnos disponibles para esta cancha.' });
      estado.paso = -1;
      return;
    }

    const fechasUnicas = [...new Set(turnos.map(t => t.fecha))];
    estado.opciones = fechasUnicas;
    estado.datos.turnosPorFecha = turnos;

    let listaFechas = `📅 Fechas disponibles para ${cancha.Nombre}:`;
    fechasUnicas.forEach((f, i) => listaFechas += `\n${i + 1}. ${f}`);
    listaFechas += '\nEscribe el número de la fecha que prefieres.';
    await client.sendMessage(user, { text: listaFechas });

    estado.paso = 4;
    return;
  }

  // --- Paso 4: Selección de fecha ---
  if (estado.paso === 4) {
    const seleccion = parseInt(texto, 10);
    if (!estado.opciones?.length || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
      await client.sendMessage(user, { text: '❌ Número de fecha inválido.' });
      return;
    }

    const fechaElegida = estado.opciones[seleccion - 1];
    estado.datos.fecha = fechaElegida;

    let turnos = await obtenerTurnosLibresCancha(estado.datos.idRecurso_Cancha);
    turnos = turnos.filter(t => t.fecha === fechaElegida);

    estado.opciones = turnos;
    let listaHoras = `⏰ Horarios disponibles para ${estado.datos.cancha} el ${fechaElegida}:`;
    turnos.forEach((t, i) => listaHoras += `\n${i + 1}. ${t.hora}`);
    listaHoras += '\nEscribe el número del horario que deseas reservar.';
    await client.sendMessage(user, { text: listaHoras });

    estado.paso = 5;
    return;
  }

  // --- Paso 5: Selección de hora (reserva provisional) ---
if (estado.paso === 5) {
  const seleccion = parseInt(texto, 10);
  if (!estado.opciones?.length || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
    await client.sendMessage(user, { text: '❌ Número de horario inválido.' });
    return;
  }

  // 🔄 Siempre volver a consultar la base de datos antes de intentar reservar
  let turnosActualizados = await obtenerTurnosLibresCancha(estado.datos.idRecurso_Cancha);
  turnosActualizados = turnosActualizados.filter(t => t.fecha === estado.datos.fecha);

  // Reemplaza opciones por la nueva lista actualizada
  estado.opciones = turnosActualizados;

  const turnoSeleccionado = turnosActualizados[seleccion - 1];
  if (!turnoSeleccionado) {
    await client.sendMessage(user, { text: '⚠️ Ese horario ya no está disponible. Te muestro los horarios actualizados:' });

    if (turnosActualizados.length === 0) {
      await client.sendMessage(user, { text: '😞 Ya no quedan horarios disponibles para esa fecha.' });
      estado.paso = 4;
      const fechasUnicas = [...new Set((await obtenerTurnosLibresCancha(estado.datos.idRecurso_Cancha)).map(t => t.fecha))];
      estado.opciones = fechasUnicas;
      return;
    }

    let listaHoras = `⏰ Horarios disponibles (actualizados) para ${estado.datos.cancha} el ${estado.datos.fecha}:`;
    turnosActualizados.forEach((t, i) => listaHoras += `\n${i + 1}. ${t.hora}`);
    listaHoras += '\nEscribe el número del horario que deseas reservar.';
    await client.sendMessage(user, { text: listaHoras });
    return;
  }

  // Intentar crear la reserva provisional
  estado.datos.turnoSeleccionado = turnoSeleccionado;
  estado.datos.hora = /^\d{2}:\d{2}$/.test(turnoSeleccionado.hora) ? turnoSeleccionado.hora + ':00' : turnoSeleccionado.hora;

  try {
    const reserva = await insertarReservaCancha({
      nombre: 'PROVISIONAL',
      dni: '00000000',
      telefono: '0000000000',
      fecha: estado.datos.fecha.split('-').reverse().join('/'),
      hora: estado.datos.hora,
      idRecurso: estado.datos.idRecurso,
      idCancha: estado.datos.idRecurso_Cancha,
      estado: 'provisional',
      fecha_creacion: new Date()
    });
    estado.datos.idReserva = reserva.id;
  } catch (err) {
    console.warn('Error creando reserva provisional:', err?.code || err);

    await client.sendMessage(user, { text: '⚠️ Ese horario acaba de ser reservado. Te muestro los horarios actualizados.' });
    let turnosNuevos = await obtenerTurnosLibresCancha(estado.datos.idRecurso_Cancha);
    turnosNuevos = turnosNuevos.filter(t => t.fecha === estado.datos.fecha);
    estado.opciones = turnosNuevos;

    if (turnosNuevos.length === 0) {
      await client.sendMessage(user, { text: '😞 Ya no quedan horarios disponibles para esa fecha. Por favor, elige otra.' });
      estado.paso = 4;
      const fechasUnicas = [...new Set((await obtenerTurnosLibresCancha(estado.datos.idRecurso_Cancha)).map(t => t.fecha))];
      estado.opciones = fechasUnicas;
      return;
    }

    let listaHoras = `⏰ Horarios disponibles (actualizados) para ${estado.datos.cancha} el ${estado.datos.fecha}:`;
    turnosNuevos.forEach((t, i) => listaHoras += `\n${i + 1}. ${t.hora}`);
    listaHoras += '\nEscribe el número del horario que deseas reservar.';
    await client.sendMessage(user, { text: listaHoras });
    return;
  }

  delete estado.opciones;
  await client.sendMessage(user, { text: '✏️ Ingresa tu nombre completo:' });
  estado.paso = 6;
  return;
}


  // --- Paso 6,7,8: Nombre, DNI, Teléfono ---
  if (estado.paso === 6) {
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(texto)) return await client.sendMessage(user, { text: '❌ Nombre inválido.' });
    estado.datos.nombre = texto;
    await client.sendMessage(user, { text: '📄 Ingresa tu DNI (7 u 8 dígitos):' });
    estado.paso = 7;
    return;
  }

  if (estado.paso === 7) {
    if (!/^\d{7,8}$/.test(texto)) return await client.sendMessage(user, { text: '❌ DNI inválido.' });
    estado.datos.dni = texto;
    await client.sendMessage(user, { text: '📞 Ingresa tu teléfono (10 a 15 dígitos):' });
    estado.paso = 8;
    return;
  }

  if (estado.paso === 8) {
    if (!/^\d{10}$/.test(texto)) return await client.sendMessage(user, { text: '❌ Teléfono inválido. Ingresá solo números de (10 dígitos). Ej: 2945123456' });
    estado.datos.telefono = texto;

    const resumen = `📋 Resumen de tu reserva:
Rubro: Cancha
Sede: ${estado.datos.sede}
Cancha: ${estado.datos.cancha} (${estado.datos.tipo_cancha})
Nombre: ${estado.datos.nombre}
DNI: ${estado.datos.dni}
Teléfono: ${estado.datos.telefono}
Fecha: ${estado.datos.fecha}
Hora: ${estado.datos.hora}

1️⃣ Confirmar
2️⃣ Cancelar`;

    estado.datos.resumen = resumen;
    await client.sendMessage(user, { text: resumen });
    estado.paso = 9;
    return;
  }

  // --- Paso 9: Confirmar / Cancelar ---
  if (estado.paso === 9) {
    if (texto === '1') {
      try {
        await actualizarReserva({
          idReserva: estado.datos.idReserva,
          nombre: estado.datos.nombre,
          dni: estado.datos.dni,
          telefono: estado.datos.telefono,
          estado: 'confirmada',
          idRecurso: estado.datos.idRecurso
        });
        await client.sendMessage(user, { text: `✅ ¡Reserva confirmada! ${estado.datos.nombre}, tu cancha ${estado.datos.cancha} está lista para el ${estado.datos.fecha} a las ${estado.datos.hora}.` });
        await client.sendMessage(user, { text: 'Escribe "hola" para reservar otra vez.' });
      } catch (err) {
        await client.sendMessage(user, { text: `❌ No se pudo confirmar la reserva: ${err.message}` });
      }
      delete estado.paso; delete estado.datos; delete estado.flujoActual;
    } else if (texto === '2') {
      if (estado.datos.idReserva) await eliminarReservaProvisional(Number(estado.datos.idReserva));
      await client.sendMessage(user, { text: '❌ Reserva cancelada. Escribe "hola" para iniciar de nuevo.' });
      delete estado.paso; delete estado.datos; delete estado.flujoActual;
    } else {
      await client.sendMessage(user, { text: '❌ Opción inválida. Responde 1️⃣ para confirmar o 2️⃣ para cancelar.' });
    }
    return;
  }

  // --- Manejo general ---
  await client.sendMessage(user, { text: '❓ No entendí tu mensaje. Escribe "hola" para reiniciar la reserva.' });
}

module.exports = { flujoReservarCanchaUnificado, getTextoMensaje };
