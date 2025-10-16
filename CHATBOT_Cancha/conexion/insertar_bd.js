const pool = require('./conexion');

// -----------------------------
// Helper: convertir fecha DD/MM/YYYY -> YYYY-MM-DD
// -----------------------------
function formatearFechaMySQL(fechaUsuario) {
  if (!/^(\d{2})\/(\d{2})\/(\d{4})$/.test(fechaUsuario)) {
    throw new Error(`Formato de fecha inválido: ${fechaUsuario}. Debe ser DD/MM/YYYY`);
  }
  const [dia, mes, anio] = fechaUsuario.split('/');
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// -----------------------------
// Insertar cliente (si no existe)
// -----------------------------
async function obtenerOCrearCliente(nombreCompleto, dni = null, telefono = null) {
  const nombres = nombreCompleto.trim().split(' ');
  const nombre = nombres[0];
  const apellido = nombres.slice(1).join(' ');

  const [rows] = await pool.query(
    `SELECT idCliente FROM cliente WHERE Nombre = ? AND Apellido = ?`,
    [nombre, apellido]
  );

  if (rows.length > 0) return rows[0].idCliente;

  const [res] = await pool.query(
    `INSERT INTO cliente (Nombre, Apellido, DNI, Telefono) VALUES (?, ?, ?, ?)`,
    [nombre, apellido, dni, telefono]
  );
  console.log(`Cliente "${nombreCompleto}" insertado con id: ${res.insertId}`);
  return res.insertId;
}

// -----------------------------
// Insertar reserva de cancha
// -----------------------------
async function insertarReservaCancha(datos) {
  try {
    const cliente_id = await obtenerOCrearCliente(datos.nombre, datos.dni, datos.telefono);
    const fechaMySQL = formatearFechaMySQL(datos.fecha);

    const idCanchaReal =
      datos.idCancha ?? datos.idRecurso_Cancha ?? null;

    // --- Declarar aquí los parámetros del insert ---
    const insertParams = [
      fechaMySQL,
      datos.hora,
      cliente_id,
      datos.idRecurso,
      idCanchaReal,
      datos.estado || 'provisional',
      datos.fecha_creacion || new Date()
    ];

    const conn = await pool.getConnection();
    const lockName = `reserva:${fechaMySQL}:${datos.hora}:${datos.idRecurso}:${idCanchaReal ?? 'null'}`;

    try {
      const [[lockRes]] = await conn.query(`SELECT GET_LOCK(?, 5) AS got`, [lockName]);
      if (!lockRes.got) {
        const e = new Error('No se pudo obtener el lock para reservar, intenta nuevamente.');
        e.code = 'LOCK_TIMEOUT';
        throw e;
      }

      // Verificar si ya existe una reserva en ese horario
      const [existing] = await conn.query(
        `SELECT idReserva, Estado FROM reserva WHERE Fecha = ? AND Hora = ? AND Recurso_idRecurso = ?`,
        [fechaMySQL, datos.hora, datos.idRecurso]
      );

      if (existing.length > 0) {
        const confirmada = existing.find(r => r.Estado.toLowerCase() === 'confirmada');
        if (confirmada) {
          const e = new Error('❌ Ese turno ya fue reservado por otra persona.');
          e.code = 'TURN_OCCUPIED';
          throw e;
        }
      }

      // Insertar la reserva dentro del lock
      const [res] = await conn.query(
        `INSERT INTO reserva 
         (Fecha, Hora, Cliente_idCliente, Recurso_idRecurso, recurso_cancha_idRecurso_Cancha, Estado, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        insertParams
      );

      console.log(`✅ Reserva creada con id: ${res.insertId}`);
      return {
        id: res.insertId,
        mensaje: `✅ Tu reserva ha sido registrada para el ${datos.fecha} a las ${datos.hora}.`
      };
    } finally {
      await conn.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
      conn.release();
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      const e = new Error('❌ Ese turno ya fue reservado por otra persona.');
      e.code = 'TURN_OCCUPIED';
      throw e;
    }
    console.error('Error al insertar reserva:', err);
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
    console.log(`Reserva id ${idReserva} eliminada.`);
    return true;
  } catch (err) {
    console.error('Error al eliminar reserva:', err);
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
    return res.affectedRows > 0;
  } catch (err) {
    console.error('Error al eliminar reserva provisional:', err);
    throw err;
  }
}

// -----------------------------
// Eliminar todas las provisionales de un usuario
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
    console.log(`🗑️ ${res.affectedRows} reservas provisionales eliminadas.`);
    return res.affectedRows;
  } catch (err) {
    console.error('Error al eliminar reservas provisionales:', err);
    throw err;
  }
}

// -----------------------------
// Actualizar reserva de cancha
// -----------------------------
async function actualizarReserva(datos) {
  try {
    if (!datos.idReserva) throw new Error('No se proporcionó idReserva.');

    const cliente_id = await obtenerOCrearCliente(datos.nombre, datos.dni, datos.telefono);
    const estado = ['provisional', 'confirmada'].includes((datos.estado || '').toLowerCase())
      ? datos.estado.toLowerCase()
      : 'confirmada';

    const idCanchaReal = datos.idCancha ?? datos.idRecurso_Cancha ?? null;

    const setParts = ['Cliente_idCliente = ?', 'Estado = ?'];
    const params = [cliente_id, estado];

    if (datos.idRecurso) {
      setParts.push('Recurso_idRecurso = ?');
      params.push(datos.idRecurso);
    }
    if (idCanchaReal !== null) {
      setParts.push('recurso_cancha_idRecurso_Cancha = ?');
      params.push(idCanchaReal);
    }

    params.push(datos.idReserva);

    const [res] = await pool.query(
      `UPDATE reserva SET ${setParts.join(', ')} WHERE idReserva = ?`,
      params
    );

    if (res.affectedRows === 0) throw new Error('No se encontró la reserva para actualizar.');
    console.log(`🆙 Reserva ${datos.idReserva} actualizada a estado: ${estado}`);
    return datos.idReserva;
  } catch (err) {
    console.error('Error al actualizar reserva:', err);
    throw err;
  }
}

module.exports = {
  obtenerOCrearCliente,
  insertarReservaCancha,
  eliminarReserva,
  eliminarReservaProvisional,
  eliminarReservasProvisionalesPorUsuario,
  actualizarReserva
};
