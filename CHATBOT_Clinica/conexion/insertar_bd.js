const pool = require('./conexion');

// -----------------------------
// Helper: convertir fecha DD/MM/YYYY -> YYYY-MM-DD
// -----------------------------
function formatearFechaMySQL(fechaUsuario) {
  if (!fechaUsuario || !/^(\d{2})\/(\d{2})\/(\d{4})$/.test(fechaUsuario)) {
    throw new Error(`Formato de fecha inválido: "${fechaUsuario}". Debe ser DD/MM/YYYY`);
  }
  const [dia, mes, anio] = fechaUsuario.split('/');
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// -----------------------------
// Insertar cliente (si no existe)
// -----------------------------
async function obtenerOCrearCliente(nombreCompleto, dni = null, telefono = null) {
  if (!nombreCompleto) throw new Error('Falta nombre del cliente.');

  const nombres = nombreCompleto.trim().split(' ');
  const nombre = nombres[0];
  const apellido = nombres.slice(1).join(' ') || '';

  // Buscar por DNI si existe
  let query = 'SELECT idCliente FROM cliente WHERE ';
  const params = [];

  if (dni) {
    query += 'DNI = ?';
    params.push(dni);
  } else {
    query += 'Nombre = ? AND Apellido = ?';
    params.push(nombre, apellido);
  }

  const [rows] = await pool.query(query, params);
  if (rows.length > 0) return rows[0].idCliente;

  // Crear cliente nuevo
  const [res] = await pool.query(
    `INSERT INTO cliente (Nombre, Apellido, DNI, Telefono)
     VALUES (?, ?, ?, ?)`,
    [nombre, apellido, dni || null, telefono || null]
  );
  console.log(`🧍 Cliente "${nombreCompleto}" insertado con id: ${res.insertId}`);
  return res.insertId;
}

async function insertarTurnoClinica(datos) {
  try {
    if (!datos.nombre || !datos.fecha || !datos.hora) {
      throw new Error('Faltan datos obligatorios (nombre, fecha u hora).');
    }

    // Crear o obtener cliente
    const cliente_id = await obtenerOCrearCliente(datos.nombre, datos.dni, datos.telefono);

    // Convertir fecha ingresada a formato MySQL (YYYY-MM-DD)
    const [dd, mm, yyyy] = datos.fecha.split('/');
    const fechaMySQL = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;

    // Determinar estado
    const estadoInsert = 
      datos.estado && ['provisional', 'confirmada'].includes(datos.estado.toLowerCase())
        ? datos.estado.toLowerCase()
        : 'provisional';

    // Hora local Argentina en UTC-3
    const ahora = new Date();
    const fechaLocal = new Date(ahora.getTime() - 3*60*60*1000);
    const fechaCreacion = fechaLocal.toISOString().slice(0, 19).replace('T',' ');

    // Expiración a 5 minutos para turnos provisionales
    let expiracion = null;
    if (estadoInsert === 'provisional') {
      const expiracionDate = new Date(fechaLocal.getTime() + 5*60*1000);
      expiracion = expiracionDate.toISOString().slice(0, 19).replace('T',' ');
    }

    // Asegurar formato de hora HH:MM:SS
    const horaFinal = /^\d{2}:\d{2}$/.test(datos.hora) ? datos.hora + ':00' : datos.hora;

    // Loguear valores para depuración
    console.log('Insertando turno:', {
      fecha: fechaMySQL,
      hora: horaFinal,
      estado: estadoInsert,
      cliente_id,
      idRecurso: datos.idRecurso,
      idMedico: datos.idMedico || null,
      fechaCreacion,
      expiracion
    });

    // Insert en la tabla
    const [res] = await pool.query(
      `INSERT INTO reserva 
       (Fecha, expiracion, Hora, Estado, fecha_creacion, Cliente_idCliente, Recurso_idRecurso, recurso_medico_idRecurso_Medico, recurso_cancha_idRecurso_Cancha)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fechaMySQL,
        expiracion,
        horaFinal,
        estadoInsert,
        fechaCreacion,
        cliente_id,
        datos.idRecurso,
        datos.idMedico || null,
        null
      ]
    );

    console.log(`📅 Turno de clínica creado (ID ${res.insertId}) - Estado: ${estadoInsert}`);
    return res.insertId;

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new Error('El turno ya fue reservado por otra persona.');
    }
    console.error('❌ Error al insertar turno de clínica:', err.message);
    throw err;
  }
}




// -----------------------------
// Actualizar reserva de clínica
// -----------------------------
async function actualizarReserva(datos) {
  try {
    if (!datos.idReserva) throw new Error('No se proporcionó idReserva para actualizar.');

    const cliente_id = await obtenerOCrearCliente(datos.nombre, datos.dni, datos.telefono);

    const estadoUpdate =
      datos.estado && ['provisional', 'confirmada'].includes(datos.estado.toLowerCase())
        ? datos.estado.toLowerCase()
        : 'confirmada';

    const [res] = await pool.query(
      `UPDATE reserva
       SET Cliente_idCliente = ?, Estado = ?, Recurso_idRecurso = ?, recurso_medico_idRecurso_Medico = ?
       WHERE idReserva = ?`,
      [cliente_id, estadoUpdate, datos.idRecurso, datos.idMedico || null, datos.idReserva]
    );

    if (res.affectedRows === 0) throw new Error('No se encontró la reserva para actualizar.');

    console.log(`🆙 Reserva ${datos.idReserva} actualizada → Estado: ${estadoUpdate}`);
    return datos.idReserva;
  } catch (err) {
    console.error('❌ Error al actualizar reserva de clínica:', err.message);
    throw err;
  }
}

// -----------------------------
// Eliminar reserva por ID
// -----------------------------
async function eliminarReserva(idReserva) {
  try {
    const [res] = await pool.query(`DELETE FROM reserva WHERE idReserva = ?`, [idReserva]);
    if (res.affectedRows === 0) throw new Error('No se encontró la reserva para eliminar.');
    console.log(`🗑️ Reserva id ${idReserva} eliminada.`);
    return true;
  } catch (err) {
    console.error('❌ Error al eliminar reserva:', err.message);
    throw err;
  }
}

// -----------------------------
// Eliminar reserva provisional por ID
// -----------------------------
async function eliminarReservaProvisional(idReserva) {
  try {
    const [res] = await pool.query(
      `DELETE FROM reserva WHERE idReserva = ? AND Estado = 'provisional'`,
      [idReserva]
    );

    if (res.affectedRows === 0) {
      console.log(`⚠️ No se encontró reserva provisional con id ${idReserva} para eliminar.`);
      return false;
    }

    console.log(`🗑️ Reserva provisional id ${idReserva} eliminada.`);
    return true;
  } catch (err) {
    console.error('❌ Error al eliminar reserva provisional:', err.message);
    throw err;
  }
}

// -----------------------------
// Eliminar TODAS las reservas provisionales de un usuario
// -----------------------------
async function eliminarReservasProvisionalesPorUsuario(dni, telefono) {
  try {
    const [res] = await pool.query(
      `DELETE r FROM reserva r
       JOIN cliente c ON r.Cliente_idCliente = c.idCliente
       WHERE r.Estado = 'provisional'
       AND (c.DNI = ? OR c.Telefono = ?)`,
      [dni || null, telefono || null]
    );

    console.log(`🧹 Se eliminaron ${res.affectedRows} reservas provisionales del usuario (DNI: ${dni} / Tel: ${telefono})`);
    return res.affectedRows;
  } catch (err) {
    console.error('❌ Error al eliminar reservas provisionales del usuario:', err.message);
    throw err;
  }
}

module.exports = {
  obtenerOCrearCliente,
  insertarTurnoClinica,
  actualizarReserva,
  eliminarReserva,
  eliminarReservaProvisional,
  eliminarReservasProvisionalesPorUsuario
};
