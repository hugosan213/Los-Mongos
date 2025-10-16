const pool = require('./conexion');

// -----------------------------
// Sedes y canchas
// -----------------------------
async function obtenerSedes() {
  const [rows] = await pool.query('SELECT * FROM sede');
  return rows;
}

async function obtenerCanchas() {
  const [rows] = await pool.query('SELECT * FROM recurso_cancha');
  return rows;
}

async function obtenerSedesCanchas() {
  const [rows] = await pool.query(`
    SELECT DISTINCT s.idSede, s.Nombre, s.Direccion, s.Localidad
    FROM sede s
    JOIN recurso r ON r.Sede_idSede = s.idSede
    JOIN recurso_cancha rc ON rc.Recurso_idRecurso = r.idRecurso
  `);
  return rows;
}

async function obtenerCanchasPorSede(idSede) {
  const [rows] = await pool.query(`
    SELECT rc.*, r.Nombre AS nombre_recurso, s.Nombre AS nombre_sede
    FROM recurso_cancha rc
    JOIN recurso r ON rc.Recurso_idRecurso = r.idRecurso
    JOIN sede s ON r.Sede_idSede = s.idSede
    WHERE s.idSede = ?
  `, [idSede]);
  return rows;
}

// -----------------------------
// Turnos libres
// -----------------------------
async function obtenerTurnosLibresCancha(idCancha) {
  try {
    const [rec] = await pool.query(`
      SELECT Recurso_idRecurso 
      FROM recurso_cancha 
      WHERE idRecurso_Cancha = ?
    `, [idCancha]);

    if (!rec || rec.length === 0) return [];
    const recursoId = rec[0].Recurso_idRecurso;

    const [rangos] = await pool.query(`
      SELECT fecha_inicio, fecha_fin, duracion, hora_inicio, hora_fin, dia_semana
      FROM agenda_cancha
      WHERE recurso_cancha_idRecurso_Cancha = ? AND disponible = 'D'
    `, [idCancha]);

    if (!rangos || rangos.length === 0) return [];

    const [reservas] = await pool.query(`
      SELECT Fecha AS fecha, Hora AS hora
      FROM reserva
      WHERE Recurso_idRecurso = ? AND LOWER(Estado) IN ('confirmada', 'provisional')
    `, [recursoId]);

    const turnosOcupados = reservas.map(r => `${r.fecha.toISOString().split('T')[0]} ${r.hora.slice(0,5)}`);
    const turnos = [];

    rangos.forEach(rango => {
      const inicio = new Date(rango.fecha_inicio);
      const fin = new Date(rango.fecha_fin);

      for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
        if (!rango.dia_semana || d.getDay() === rango.dia_semana) {
          const fecha = d.toISOString().split('T')[0];
          let turnoHora = new Date(`${fecha}T${rango.hora_inicio}`);
          const finTurno = new Date(`${fecha}T${rango.hora_fin}`);

          while (turnoHora < finTurno) {
            const horaStr = turnoHora.toTimeString().substring(0,5);
            if (!turnosOcupados.includes(`${fecha} ${horaStr}`)) {
              turnos.push({ fecha, hora: horaStr });
            }
            const [hDur, mDur] = rango.duracion.split(':').map(Number);
            turnoHora.setMinutes(turnoHora.getMinutes() + hDur * 60 + mDur);
          }
        }
      }
    });

    return turnos;
  } catch (err) {
    console.error('❌ Error al obtener turnos:', err);
    return [];
  }
}

// -----------------------------
// Reservas por usuario
// -----------------------------
async function obtenerReservasPorUsuario(dni, telefono) {
  try {
    if (!dni && !telefono) return [];

    const dniClean = dni ? dni.replace(/\D/g, '') : '';
    const telefonoClean = telefono ? telefono.replace(/\D/g, '') : '';

    const [reservas] = await pool.query(`
      SELECT r.idReserva, r.Fecha, r.Hora, r.Estado,
             c.Nombre AS clienteNombre, c.Apellido AS clienteApellido,
             rc.Nombre AS canchaNombre, rc.Tipo_deporte AS tipo_cancha,
             s.Nombre AS sede
      FROM reserva r
      JOIN cliente c ON r.Cliente_idCliente = c.idCliente
      LEFT JOIN recurso re ON r.Recurso_idRecurso = re.idRecurso
      LEFT JOIN recurso_cancha rc ON rc.idRecurso_Cancha = r.recurso_cancha_idRecurso_Cancha
      LEFT JOIN sede s ON re.Sede_idSede = s.idSede
      WHERE (c.DNI = ? OR c.Telefono = ?)
      ORDER BY r.Fecha ASC, r.Hora ASC
    `, [dniClean, telefonoClean]);

    const ids = new Set();
    const reservasUnicas = reservas.filter(r => {
      if (ids.has(r.idReserva)) return false;
      ids.add(r.idReserva);
      return true;
    });

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

async function obtenerReservasPorUsuarioTodas(dni, telefono) {
  try {
    if (!dni && !telefono) return [];

    const dniClean = dni ? dni.replace(/\D/g, '') : '';
    const telefonoClean = telefono ? telefono.replace(/\D/g, '') : '';

    const [reservas] = await pool.query(`
      SELECT r.idReserva, r.Fecha, r.Hora, r.Estado,
             c.Nombre AS clienteNombre, c.Apellido AS clienteApellido,
             rc.Nombre AS canchaNombre, rc.Tipo_deporte AS tipo_cancha,
             s.Nombre AS sede
      FROM reserva r
      JOIN cliente c ON r.Cliente_idCliente = c.idCliente
      LEFT JOIN recurso re ON r.Recurso_idRecurso = re.idRecurso
      LEFT JOIN recurso_cancha rc ON rc.idRecurso_Cancha = r.recurso_cancha_idRecurso_Cancha
      LEFT JOIN sede s ON re.Sede_idSede = s.idSede
      WHERE (c.DNI = ? OR c.Telefono = ?)
      ORDER BY r.Fecha ASC, r.Hora ASC
    `, [dniClean, telefonoClean]);

    const ids = new Set();
    return reservas.filter(r => {
      if (ids.has(r.idReserva)) return false;
      ids.add(r.idReserva);
      return true;
    });
  } catch (err) {
    console.error('❌ Error en obtenerReservasPorUsuarioTodas:', err);
    return [];
  }
}

// -----------------------------
// Control de reservas
// -----------------------------
async function verificarDisponibilidadReserva(idRecurso, fecha, hora) {
  const [rows] = await pool.query(
    `SELECT * FROM reserva WHERE Recurso_idRecurso = ? AND Fecha = ? AND Hora = ? AND LOWER(Estado) = 'confirmada'`,
    [idRecurso, fecha, hora]
  );
  return rows.length === 0;
}

async function insertarReservaProvisional(datos) {
  const [result] = await pool.query(
    `INSERT INTO reserva (Fecha, Hora, Cliente_idCliente, Recurso_idRecurso, Estado)
     VALUES (?, ?, ?, ?, 'provisional')`,
    [datos.fecha, datos.hora, datos.idCliente, datos.idRecurso]
  );
  return result.insertId;
}

async function confirmarReserva(idReserva) {
  await pool.query(
    `UPDATE reserva SET Estado='confirmada' WHERE idReserva = ?`,
    [idReserva]
  );
}

// -----------------------------
// Exportación
// -----------------------------
module.exports = {  
  obtenerCanchas, 
  obtenerSedes, 
  obtenerSedesCanchas, 
  obtenerCanchasPorSede,
  verificarDisponibilidadReserva,
  insertarReservaProvisional,
  confirmarReserva,
  obtenerReservasPorUsuario,
  obtenerTurnosLibresCancha,
  obtenerReservasPorUsuarioTodas,
};
