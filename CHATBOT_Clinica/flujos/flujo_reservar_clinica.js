const { 
  obtenerEspecialidades,
  obtenerProfesionalesPorEspecialidad,
  obtenerTurnosLibresMedico
} = require('../conexion/querys');

const { 
  insertarTurnoClinica, 
  actualizarReserva, 
  eliminarReservaProvisional 
} = require('../conexion/insertar_bd');

const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function getTextoMensaje(message) {
  return (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
}

// -----------------------------
// Manejo de reinicio de reserva provisional
// -----------------------------
async function verificarReinicioProvisional(client, user, estado, texto) {
  if (estado.flujoActual !== 'clinica') return false;

  const afirmativos = ['si', 'sí', 's'];
  const negativos = ['no', 'n'];

  if (estado.pasoReinicioConfirmacion) {
    if (afirmativos.includes(texto)) {
      if (estado.datos?.idReserva) await eliminarReservaProvisional(Number(estado.datos.idReserva));
      estado.paso = 1;
      estado.datos = { rubro: 'Clinica' };
      delete estado.pasoReinicioConfirmacion;
      await client.sendMessage(user, { text: '✅ Flujo reiniciado con éxito. ¡Hola! 👋 Bienvenido al sistema de reservas de la clínica.' });
    } else if (negativos.includes(texto)) {
      delete estado.pasoReinicioConfirmacion;
      await client.sendMessage(user, { text: '👍 Perfecto, continuamos con tu reserva provisional.' });
    } else {
      await client.sendMessage(user, { text: '❓ Por favor, responde "sí" para reiniciar o "no" para continuar con la reserva.' });
    }
    return true;
  }

  if (estado.datos?.idReserva && estado.paso >= 5 && estado.paso <= 7 && (texto === 'hola' || texto === 'reservar')) {
    await client.sendMessage(user, { text: '⚠️ Tienes una reserva provisional. ¿Deseas reiniciarla y eliminarla? Responde "sí" o "no".' });
    estado.pasoReinicioConfirmacion = true;
    return true;
  }

  return false;
}

// -----------------------------
// Funciones por paso del flujo
// -----------------------------
async function pasoMostrarEspecialidades(client, user, estado) {
  const especialidades = await obtenerEspecialidades();
  if (!especialidades?.length) {
    await client.sendMessage(user, { text: '⚠️ No hay especialidades disponibles actualmente.' });
    estado.paso = -1;
    return;
  }
  let lista = '🏥 Especialidades disponibles:';
  especialidades.forEach((e, i) => lista += `\n${i + 1}. ${e.Especialidad}`);
  lista += '\nPor favor, envía el número de la especialidad que deseas seleccionar.';
  await client.sendMessage(user, { text: lista });
  estado.opciones = especialidades;
  estado.paso = 2;
}

async function pasoSeleccionarEspecialidad(client, user, estado, texto) {
  const seleccion = parseInt(texto, 10);
  if (!estado.opciones || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
    await client.sendMessage(user, { text: '❌ Número inválido. Selecciona uno de la lista.' });
    return;
  }

  const especialidadElegida = estado.opciones[seleccion - 1].Especialidad;
  estado.datos.especialidad = especialidadElegida;
  delete estado.opciones;

  const profesionales = await obtenerProfesionalesPorEspecialidad(especialidadElegida);
  if (!profesionales?.length) {
    await client.sendMessage(user, { text: '⚠️ No hay profesionales disponibles en esta especialidad por ahora.' });
    estado.paso = -1;
    return;
  }

  let listaProfesionales = `👩‍⚕️ Profesionales en ${especialidadElegida}:`;
  profesionales.forEach((p, i) => listaProfesionales += `\n${i + 1}. ${p.nombre_completo}`);
  listaProfesionales += '\nEnvía el número del profesional que deseas seleccionar.';
  await client.sendMessage(user, { text: listaProfesionales });

  estado.opciones = profesionales;
  estado.paso = 3;
}

async function pasoSeleccionarProfesional(client, user, estado, texto) {
  const seleccion = parseInt(texto, 10);
  if (!estado.opciones || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
    await client.sendMessage(user, { text: '❌ Número inválido. Selecciona un profesional de la lista.' });
    return;
  }

  const profesional = estado.opciones[seleccion - 1];
  estado.datos.profesional = profesional.nombre_completo;
  estado.datos.idMedico = profesional.idRecurso_Medico;
  estado.datos.idRecurso = profesional.Recurso_idRecurso;
  estado.datos.sede = profesional.nombre_sede || 'Sin sede';
  delete estado.opciones;

  // Mostrar días disponibles
  const turnos = await obtenerTurnosLibresMedico(estado.datos.idMedico);
  if (!turnos?.length) {
    await client.sendMessage(user, { text: '⚠️ No hay días de atención disponibles para este profesional.' });
    estado.paso = -1;
    return;
  }

  // Crear mapa de días con rango de horas
  const diasDisponiblesMap = new Map();
  turnos.forEach(t => {
    if (!diasDisponiblesMap.has(t.dia_semana)) {
      diasDisponiblesMap.set(t.dia_semana, { dia_semana: t.dia_semana, hora_inicio: t.hora, hora_fin: t.hora });
    } else {
      const d = diasDisponiblesMap.get(t.dia_semana);
      if (t.hora < d.hora_inicio) d.hora_inicio = t.hora;
      if (t.hora > d.hora_fin) d.hora_fin = t.hora;
    }
  });

  const diasDisponibles = Array.from(diasDisponiblesMap.values()).sort((a,b) => a.dia_semana - b.dia_semana);
  estado.opciones = diasDisponibles;

  let listaDias = `📅 Días disponibles para ${estado.datos.profesional}:`;
  diasDisponibles.forEach((d, i) => listaDias += `\n${i + 1}. ${diasSemana[d.dia_semana]} (${d.hora_inicio} - ${d.hora_fin})`);
  listaDias += '\nSelecciona el número del día en que deseas reservar tu turno.';
  await client.sendMessage(user, { text: listaDias });

  estado.paso = 3.1;
}

async function pasoSeleccionarDia(client, user, estado, texto) {
  const seleccion = parseInt(texto, 10);
  if (!estado.opciones || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
    await client.sendMessage(user, { text: '❌ Número de día inválido. Selecciona uno de la lista.' });
    return;
  }

  const diaElegido = estado.opciones[seleccion - 1];
  estado.datos.diaSeleccionado = diaElegido;

  let turnos = await obtenerTurnosLibresMedico(estado.datos.idMedico);
  turnos = turnos.filter(t => t.dia_semana === diaElegido.dia_semana);
  if (!turnos?.length) {
    await client.sendMessage(user, { text: '⚠️ No hay turnos disponibles para este día. Selecciona otro día.' });
    return;
  }

  estado.opciones = turnos;
  let listaTurnos = `📅 Turnos disponibles para ${estado.datos.profesional} el ${diasSemana[diaElegido.dia_semana]}:`;
  turnos.forEach((t, i) => listaTurnos += `\n${i + 1}. ${t.fecha} - ${t.hora}`);
  listaTurnos += '\nSelecciona el número del turno que deseas reservar.';
  await client.sendMessage(user, { text: listaTurnos });

  estado.paso = 4;
}

async function pasoSeleccionarTurno(client, user, estado, texto) {
  const seleccion = parseInt(texto, 10);
  if (!estado.opciones || isNaN(seleccion) || seleccion < 1 || seleccion > estado.opciones.length) {
    await client.sendMessage(user, { text: '❌ Número de turno inválido. Selecciona uno de la lista.' });
    return;
  }

  const turno = estado.opciones[seleccion - 1];
  estado.datos.turnoSeleccionado = turno;

  // Reordenar formato de fecha a DD/MM/YYYY para mostrar
  const [yyyy, mm, dd] = turno.fecha.split('-');
  estado.datos.fecha = `${dd}/${mm}/${yyyy}`;

  // Asegurar formato de hora HH:MM:SS
  estado.datos.hora = /^\d{2}:\d{2}$/.test(turno.hora) ? turno.hora + ':00' : turno.hora;

  try {
    const idReserva = await insertarTurnoClinica({
      nombre: 'PROVISIONAL',
      dni: '00000000',
      telefono: '0000000000',
      fecha: estado.datos.fecha,
      hora: estado.datos.hora,
      idRecurso: estado.datos.idRecurso,
      idMedico: estado.datos.idMedico,
      estado: 'provisional'
    });

    estado.datos.idReserva = idReserva;
  } catch (err) {
    await client.sendMessage(user, { text: '⚠️ Ese turno ya fue reservado. Selecciona otro.' });
    return;
  }

  delete estado.opciones;
  await client.sendMessage(user, { text: '🎉 ¡Genial! Ingresa tu nombre completo:' });
  estado.paso = 5;
}


async function pasoNombre(client, user, estado, texto) {
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/.test(texto)) {
    await client.sendMessage(user, { text: '❌ Nombre inválido. Solo letras, espacios, guiones y apóstrofes.' });
    return;
  }
  estado.datos.nombre = texto;
  await client.sendMessage(user, { text: '📄 Ingresa tu DNI (7 u 8 dígitos):' });
  estado.paso = 6;
}

async function pasoDNI(client, user, estado, texto) {
  if (!/^\d{7,8}$/.test(texto)) {
    await client.sendMessage(user, { text: '❌ DNI inválido. Intenta nuevamente (7 u 8 dígitos).' });
    return;
  }
  estado.datos.dni = texto;
  await client.sendMessage(user, { text: '📞 Ingresa tu teléfono de (10 dígitos):' });
  estado.paso = 7;
}

async function pasoTelefono(client, user, estado, texto) {
  // Limpia el texto: elimina espacios, guiones, paréntesis y caracteres invisibles
  const telefonoLimpio = texto.replace(/[^\d+]/g, '').trim();

  // Valida el formato (10 a 15 dígitos, opcionalmente comenzando con '+')
  if (!/^\+?\d{10}$/.test(telefonoLimpio)) {
    await client.sendMessage(user, { 
      text: '❌ Teléfono inválido. Ingresá solo números de (10 dígitos). Ej: 2945123456' 
    });
    return;
  }

  // Guarda el número limpio
  estado.datos.telefono = telefonoLimpio;

  // Genera resumen
  const resumen = `📋 *Resumen de tu reserva:*
Rubro: Clínica
Sede: ${estado.datos.sede}
Especialidad: ${estado.datos.especialidad}
Profesional: ${estado.datos.profesional}
Nombre: ${estado.datos.nombre}
DNI: ${estado.datos.dni}
Teléfono: ${estado.datos.telefono}
Fecha: ${estado.datos.fecha}
Hora: ${estado.datos.hora}

1️⃣ Confirmar
2️⃣ Cancelar`;

  estado.datos.resumen = resumen;
  await client.sendMessage(user, { text: resumen });
  estado.paso = 8;
}


async function pasoConfirmarCancelar(client, user, estado, texto) {
  if (texto === '1' || texto.toLowerCase() === 'confirmar') {
    try {
      await actualizarReserva({
        idReserva: estado.datos.idReserva,
        nombre: estado.datos.nombre,
        dni: estado.datos.dni,
        telefono: estado.datos.telefono,
        estado: 'confirmada',
        idRecurso: estado.datos.idRecurso,
        idMedico: estado.datos.idMedico
      });
      await client.sendMessage(user, { text: `✅ ¡Turno confirmado! ${estado.datos.nombre}, con ${estado.datos.profesional} el ${estado.datos.fecha} a las ${estado.datos.hora}.` });
      await client.sendMessage(user, { text: 'Escribe "hola" para reservar otro turno.' });
    } catch (err) {
      await client.sendMessage(user, { text: `❌ No se pudo confirmar el turno: ${err.message}` });
    }
    delete estado.paso; delete estado.datos; delete estado.flujoActual;
  } else if (texto === '2' || texto.toLowerCase() === 'cancelar') {
    if (estado.datos.idReserva) await eliminarReservaProvisional(estado.datos.idReserva);
    await client.sendMessage(user, { text: '❌ Reserva cancelada. Escribe "hola" para iniciar de nuevo.' });
    delete estado.paso; delete estado.datos; delete estado.flujoActual;
  } else {
    await client.sendMessage(user, { text: '❌ Opción inválida. Escribe 1️⃣ para confirmar o 2️⃣ para cancelar.' });
  }
}

// -----------------------------
// Flujo Clinica
// -----------------------------
async function flujoReservarTurno(client, message, estado) {
  estado.flujoActual = 'reservar';
  const user = message.key?.remoteJid || message.from;
  const texto = getTextoMensaje(message).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  estado.ultimoTexto = texto;

  if (await verificarReinicioProvisional(client, user, estado, texto)) return;

  const pasosMap = {
    1: pasoMostrarEspecialidades,
    2: pasoSeleccionarEspecialidad,
    3: pasoSeleccionarProfesional,
    3.1: pasoSeleccionarDia,
    4: pasoSeleccionarTurno,
    5: pasoNombre,
    6: pasoDNI,
    7: pasoTelefono,
    8: pasoConfirmarCancelar
  };

  if ((texto === 'hola' || texto === 'reservar') && !estado.paso) {
    estado.paso = 1;
    estado.datos = { rubro: 'Clinica' };
    await client.sendMessage(user, { text: '👋 ¡Hola! Bienvenido. ¿Deseas reservar un turno en Clínica?' });
    return;
  }

  const pasoFunc = pasosMap[estado.paso];
  if (pasoFunc) {
    await pasoFunc(client, user, estado, texto);
  } else {
    await client.sendMessage(user, { text: '❓ No entendí tu mensaje. Escribe "hola" o "reservar" para comenzar a reservar un turno.' });
  }
}

module.exports = { flujoReservarTurno, getTextoMensaje };
