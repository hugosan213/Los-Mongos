const pool = require('./conexion');

// -----------------------------
// Sedes y canchas
// -----------------------------
async function obtenerSedes() {
  const [rows] = await pool.query('SELECT * FROM sede');
  return rows;
}

// -----------------------------
// Profesionales y especialidades
// -----------------------------
async function obtenerEspecialidades() {
  const [rows] = await pool.query(`
    SELECT DISTINCT Especialidad
    FROM recurso_medico
    WHERE Especialidad IS NOT NULL
  `);
  return rows;
}

async function obtenerProfesionales() {
  const [rows] = await pool.query(`
    SELECT *, CONCAT(nombre, ' ', apellido) AS nombre_completo
    FROM recurso_medico
  `);
  return rows;
}

async function obtenerProfesionalesPorEspecialidad(especialidad) {
  const especialidadClean = especialidad.trim();
  const [rows] = await pool.query(`
    SELECT 
      rm.*,
      CONCAT(rm.nombre, ' ', rm.apellido) AS nombre_completo,
      r.idRecurso AS idRecurso,
      COALESCE(s.Nombre, 'Sin sede') AS nombre_sede
    FROM recurso_medico rm
    LEFT JOIN recurso r ON rm.Recurso_idRecurso = r.idRecurso
    LEFT JOIN sede s ON r.Sede_idSede = s.idSede
    WHERE LOWER(TRIM(rm.Especialidad)) = LOWER(?)
  `, [especialidadClean]);
  return rows;
}

// -----------------------------
// Sedes de clínica
// -----------------------------
async function obtenerSedesClinica() {
  const [rows] = await pool.query(`
    SELECT r.idRecurso, r.Nombre AS nombre_recurso, s.Nombre AS nombre_sede
    FROM recurso r
    JOIN sede s ON r.Sede_idSede = s.idSede
    WHERE r.idRecurso IN (4,5) 
  `);
  return rows;
}



async function obtenerTurnosLibresMedico(idMedico) {
  const [rangos] = await pool.query(`
    SELECT fecha_inicio, fecha_fin, hora_inicio, hora_fin, dia_semana, recurso_medico.Recurso_idRecurso,
           TIME_TO_SEC(duracion)/60 AS duracion_minutos
    FROM agenda_medico
    JOIN recurso_medico ON agenda_medico.recurso_medico_idRecurso_Medico = recurso_medico.idRecurso_Medico
    WHERE recurso_medico.idRecurso_Medico = ? AND disponible = 'D'
  `, [idMedico]);

  if (!rangos || rangos.length === 0) return [];

  const turnos = [];
  for (const rango of rangos) {
    const inicio = new Date(rango.fecha_inicio);
    const fin = new Date(rango.fecha_fin);

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      // Ajuste: d.getDay() devuelve 0=domingo, 1=lunes, etc.
      if (d.getDay() === rango.dia_semana) {
        const [hInicio, mInicio] = rango.hora_inicio.split(':').map(Number);
        const [hFin, mFin] = rango.hora_fin.split(':').map(Number);

        let turnoHora = new Date(d);
        turnoHora.setHours(hInicio, mInicio, 0, 0);

        const finTurno = new Date(d);
        finTurno.setHours(hFin, mFin, 0, 0);

        while (turnoHora < finTurno) {
          const fecha = turnoHora.toISOString().split('T')[0];
          const hora = turnoHora.toTimeString().split(' ')[0].substring(0,5);
          turnos.push({ 
            fecha, 
            hora, 
            recursoId: rango.Recurso_idRecurso,
            dia_semana: rango.dia_semana   // ✅ importante para filtrar por día
          });
          turnoHora.setMinutes(turnoHora.getMinutes() + rango.duracion_minutos);
        }
      }
    }
  }

  // Filtrar turnos ya ocupados
  const [ocupados] = await pool.query(`
    SELECT Fecha, Hora
    FROM reserva
    WHERE Recurso_idRecurso = ? AND Estado = 'confirmada'
  `, [rangos[0]?.Recurso_idRecurso || 0]);

  return turnos.filter(t => !ocupados.some(o => {
    const fechaOcupada = o.Fecha.toISOString().split('T')[0];
    const horaOcupada = o.Hora.toTimeString ? o.Hora.toTimeString().substring(0,5) : o.Hora.slice(0,5);
    return t.fecha === fechaOcupada && t.hora === horaOcupada;
  }));
}

// -----------------------------
// Agenda de médicos
// -----------------------------
async function obtenerAgendaMedico(idMedico) {
  try {
    const [rows] = await pool.query(`
      SELECT idAgendaMedico, fecha_inicio, fecha_fin, hora_inicio, hora_fin, dia_semana
      FROM agenda_medico
      WHERE recurso_medico_idRecurso_Medico = ? AND disponible = 'D'
      ORDER BY dia_semana, hora_inicio
    `, [idMedico]);

    // Ajuste: convertir dia_semana de 1=lunes...7=domingo a 0=domingo, 1=lunes...
    return rows.map(r => ({
      ...r,
      dia_semana: r.dia_semana === 7 ? 0 : r.dia_semana
    }));
  } catch (err) {
    console.error('❌ Error obtenerAgendaMedico:', err);
    return [];
  }
}

// -----------------------------
// Control de reservas (provisional / confirmada)
// -----------------------------
async function verificarDisponibilidadReserva(idRecurso, fecha, hora) {
  const [rows] = await pool.query(
    `SELECT * FROM reserva WHERE Recurso_idRecurso = ? AND Fecha = ? AND Hora = ? AND Estado = 'Confirmada'`,
    [idRecurso, fecha, hora]
  );
  return rows.length === 0;
}

async function insertarReservaProvisional(datos) {
  const [result] = await pool.query(
    `INSERT INTO reserva (Fecha, Hora, Cliente_idCliente, Recurso_idRecurso, Estado)
     VALUES (?, ?, ?, ?, 'Provisional')`,
    [datos.fecha, datos.hora, datos.idCliente, datos.idRecurso]
  );
  return result.insertId;
}

async function confirmarReserva(idReserva) {
  await pool.query(
    `UPDATE reserva SET Estado='Confirmada' WHERE idReserva = ?`,
    [idReserva]
  );
}

// Obtener reservas futuras de la clínica
async function obtenerReservasPorUsuario(dni, telefono) {
  try {
    if (!dni && !telefono) return [];

    const dniClean = dni ? dni.replace(/\D/g, '') : '';
    const telefonoClean = telefono ? telefono.replace(/\D/g, '') : '';

    const [reservas] = await pool.query(`
      SELECT r.idReserva, r.Fecha, r.Hora, r.Estado,
             c.Nombre AS clienteNombre, c.Apellido AS clienteApellido,
             rm.Nombre AS medicoNombre, rm.Apellido AS medicoApellido, rm.Especialidad AS especialidad,
             re.Nombre AS recursoNombre,
             s.Nombre AS sede
      FROM reserva r
      JOIN cliente c ON r.Cliente_idCliente = c.idCliente
      LEFT JOIN recurso_medico rm ON r.recurso_medico_idRecurso_Medico = rm.idRecurso_Medico
      LEFT JOIN recurso re ON r.Recurso_idRecurso = re.idRecurso
      LEFT JOIN sede s ON re.Sede_idSede = s.idSede
      WHERE (c.DNI = ? OR c.Telefono = ?)
      ORDER BY r.Fecha ASC, r.Hora ASC
    `, [dniClean, telefonoClean]);

    // Filtrar duplicados por idReserva
    const reservasUnicas = [];
    const ids = new Set();
    reservas.forEach(r => {
      if (!ids.has(r.idReserva)) {
        ids.add(r.idReserva);
        reservasUnicas.push(r);
      }
    });

    // Filtrar solo futuras
    const ahora = new Date();
    return reservasUnicas.filter(r => {
      const fechaStr = r.Fecha.toISOString().split('T')[0];
      const horaStr = r.Hora.toTimeString ? r.Hora.toTimeString().substring(0,5) : r.Hora.slice(0,5);
      const fechaHora = new Date(`${fechaStr}T${horaStr}:00-03:00`);
      return fechaHora >= ahora;
    });

  } catch (err) {
    console.error('❌ Error en obtenerReservasPorUsuario:', err);
    return [];
  }
}

// Obtener todas las reservas (pasadas y futuras)
async function obtenerReservasPorUsuarioTodas(dni, telefono) {
  try {
    if (!dni && !telefono) return [];

    const dniClean = dni ? dni.replace(/\D/g, '') : '';
    const telefonoClean = telefono ? telefono.replace(/\D/g, '') : '';

    const [reservas] = await pool.query(`
      SELECT r.idReserva, r.Fecha, r.Hora, r.Estado,
             c.Nombre AS clienteNombre, c.Apellido AS clienteApellido,
             rm.Nombre AS medicoNombre, rm.Apellido AS medicoApellido, rm.Especialidad AS especialidad,
             re.Nombre AS recursoNombre,
             s.Nombre AS sede
      FROM reserva r
      JOIN cliente c ON r.Cliente_idCliente = c.idCliente
      LEFT JOIN recurso_medico rm ON r.recurso_medico_idRecurso_Medico = rm.idRecurso_Medico
      LEFT JOIN recurso re ON r.Recurso_idRecurso = re.idRecurso
      LEFT JOIN sede s ON re.Sede_idSede = s.idSede
      WHERE (c.DNI = ? OR c.Telefono = ?)
      ORDER BY r.Fecha ASC, r.Hora ASC
    `, [dniClean, telefonoClean]);

    // Filtrar duplicados por idReserva
    const reservasUnicas = [];
    const ids = new Set();
    reservas.forEach(r => {
      if (!ids.has(r.idReserva)) {
        ids.add(r.idReserva);
        reservasUnicas.push(r);
      }
    });

    return reservasUnicas;
  } catch (err) {
    console.error('❌ Error en obtenerReservasPorUsuarioTodas:', err);
    return [];
  }
}





module.exports = { 
  obtenerProfesionales,  
  obtenerSedes, 
  obtenerEspecialidades,
  obtenerProfesionalesPorEspecialidad,
  obtenerTurnosLibresMedico,
  obtenerSedesClinica,
  verificarDisponibilidadReserva,
  insertarReservaProvisional,
  confirmarReserva,
  obtenerAgendaMedico,
  obtenerReservasPorUsuario, 
  obtenerReservasPorUsuarioTodas
};
