import express from "express";
import mysql from "mysql2";
import bcrypt from "bcryptjs";
import session from "express-session";
import cors from "cors";

const app = express();
const PORT = 3000;

// ✅ CORS para permitir frontend en 127.0.0.1:5500
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true
}));

// ✅ Body parser integrado en Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Sesiones
app.use(session({
  secret: "clave-secreta",
  resave: false,
  saveUninitialized: true,
  cookie: {
    sameSite: 'lax',
    secure: false
  }
}));

// 🔹 Conexión a MySQL SOBRE LA BASE GENERICA
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "bdgenerica"
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ Conectado a MySQL GENERICA");
});

// 🔹 Conexión a MySQL SOBRE LA BASE DE CLIENTES
const db2 = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "nuestro_negocio2"
});

db2.connect(err => {
  if (err) {
    console.error("❌ Error conectando a MySQL CLIENTES:", err.message || err);
    // No lanzar: dejamos el servidor arriba pero indicamos que la DB no está disponible.
  } else {
    console.log("✅ Conectado a MySQL CLIENTES");
  }
});

// 🔹 Login
app.post("/index", (req, res) => {
  const { email, password } = req.body;

  const query = `
    SELECT *
    FROM cliente
    WHERE correo_electronico = ?;
  `;

  db2.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: "Error en servidor" });
    if (results.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

    const user = results[0];
    const userPassword = user.contrasena;

    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, userPassword);
    } catch (e) {
      isValid = false;
    }

    if (isValid) {
      req.session.user = {
        id: user.idUsuario,
        tipo: user.tipo, // "medico" o "cancha"
        nombre: user.Nombre,
        apellido: user.Apellido,
        email: user.correo_electronico
      };

      res.json({
        message: "Login exitoso",
        id: user.idUsuario,
        tipo: user.tipo,
        nombre: user.Nombre,
        apellido: user.Apellido,
        email: user.correo_electronico
      });
    } else {
      res.status(401).json({ error: "Contraseña incorrecta" });
    }
  });
});

// 🔹 Página protegida
app.get("/home", (req, res) => {
  if (req.session.user) {
    res.json({ message: `Bienvenido ${req.session.user.nombre}` });
  } else {
    res.status(403).json({ error: "No estás logueado" });
  }
});

// 🔹 API para FullCalendar: devuelve los turnos SOLO del usuario logueado
app.get("/api/turnos/proximos", (req, res) => {
  if (!req.session.user) {
    return res.status(403).json({ error: "No estás logueado" });
  }

  const email = req.session.user.email;
  const tipo = req.session.user.tipo;

  let query = "";
  let params = [email];

  if (tipo === "medico") {
    query = `
      SELECT 
        rsv.idReserva,
        rsv.Fecha,
        rsv.Hora,
        CONCAT(c.Nombre, ' ', c.Apellido) AS Cliente,
        c.DNI AS DNI,
        c.Telefono AS Telefono
      FROM Recurso_Medico rm
      INNER JOIN Recurso r ON rm.Recurso_idRecurso = r.idRecurso
      INNER JOIN Reserva rsv ON r.idRecurso = rsv.Recurso_idRecurso
      INNER JOIN Cliente c ON rsv.Cliente_idCliente = c.idCliente
      WHERE rm.correo_electronico = ?
      ORDER BY rsv.Fecha ASC, rsv.Hora ASC;
    `;
  } else if (tipo === "cancha") {
    query = `
      SELECT 
        rsv.idReserva,
        rsv.Fecha,
        rsv.Hora,
        CONCAT(c.Nombre, ' ', c.Apellido) AS Cliente,
        c.DNI AS DNI,
        c.Telefono AS Telefono
      FROM Recurso_Cancha rc
      INNER JOIN Recurso r ON rc.Recurso_idRecurso = r.idRecurso
      INNER JOIN Reserva rsv ON r.idRecurso = rsv.Recurso_idRecurso
      INNER JOIN Cliente c ON rsv.Cliente_idCliente = c.idCliente
      WHERE rc.correo_electronico = ?
      ORDER BY rsv.Fecha ASC, rsv.Hora ASC;
    `;
  } else {
    return res.status(400).json({ error: "Tipo de usuario inválido" });
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("❌ Error en consulta:", err);
      return res.status(500).json([]);
    }

    const eventos = results.map(t => ({
      id: t.idReserva,
      title: t.Cliente,
      fecha: t.Fecha,
      hora: t.Hora,
      dni: t.DNI,
      telefono: t.Telefono
    }));

    res.json(eventos);
  });
});

// 🔹 API turnos por fecha (NUEVA)
app.get("/api/turnos/por-fecha", (req, res) => {
  if (!req.session.user) {
    return res.status(403).json({ error: "No estás logueado" });
  }

  const email = req.session.user.email;
  const tipo = req.session.user.tipo;
  const fecha = req.query.fecha; // YYYY-MM-DD

  let query = "";
  let params = [email, fecha];

  if (tipo === "medico") {
    query = `
      SELECT 
        rsv.idReserva,
        rsv.Fecha,
        rsv.Hora,
        CONCAT(c.Nombre, ' ', c.Apellido) AS Cliente,
        c.DNI AS DNI,
        c.Telefono AS Telefono,
        s.Nombre AS Sede
      FROM Recurso_Medico rm
      INNER JOIN Recurso r ON rm.Recurso_idRecurso = r.idRecurso
      INNER JOIN Reserva rsv ON r.idRecurso = rsv.Recurso_idRecurso
      INNER JOIN Cliente c ON rsv.Cliente_idCliente = c.idCliente
      INNER JOIN Sede s ON r.Sede_idSede = s.idSede
      WHERE rm.correo_electronico = ?
        AND rsv.Fecha = ?
      ORDER BY rsv.Hora ASC;
    `;
  } else if (tipo === "cancha") {
    query = `
      SELECT 
        rsv.idReserva,
        rsv.Fecha,
        rsv.Hora,
        CONCAT(c.Nombre, ' ', c.Apellido) AS Cliente,
        c.DNI AS DNI,
        c.Telefono AS Telefono,
        s.Nombre AS Sede
      FROM Recurso_Cancha rc
      INNER JOIN Recurso r ON rc.Recurso_idRecurso = r.idRecurso
      INNER JOIN Reserva rsv ON r.idRecurso = rsv.Recurso_idRecurso
      INNER JOIN Cliente c ON rsv.Cliente_idCliente = c.idCliente
      INNER JOIN Sede s ON r.Sede_idSede = s.idSede
      WHERE rc.correo_electronico = ?
        AND rsv.Fecha = ?
      ORDER BY rsv.Hora ASC;
    `;
  } else {
    return res.status(400).json({ error: "Tipo de usuario inválido" });
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("❌ Error en consulta:", err);
      return res.status(500).json([]);
    }

    const turnos = results.map(t => ({
      idReserva: t.idReserva,
      fecha: t.Fecha,
      hora: t.Hora,
      cliente: t.Cliente,
      dni: t.DNI,
      telefono: t.Telefono,
      sede: t.Sede
    }));

    res.json(turnos);
  });
});

// =======================================================
// 🔹 API para guardar agenda del médico/cancha
// =======================================================
app.post("/api/turnos/guardar-agenda", (req, res) => {
  if (!req.session.user) return res.status(403).json({ error: "No estás logueado" });

  const email = req.session.user.email;
  const tipo = req.session.user.tipo;
  const { turnos } = req.body;

  if (!turnos || !Array.isArray(turnos) || turnos.length === 0) {
    return res.status(400).json({ success: false, message: "No hay turnos para guardar" });
  }

  function normalizarHora(hora) {
    if (!hora) return null;
    // elimina cualquier offset o Z
  return hora.split(/[+-]/)[0].replace('T', ''); 
}
const insertarTurnos = (recursoId, queryInsert) => {
  const promises = turnos.map(t => {
    return new Promise((resolve, reject) => {
      const params = [
        t.fechaInicio, t.fechaFin, t.horario, normalizarHora(t.horaInicio), normalizarHora(t.horaFin), t.diaSemana, recursoId, // para INSERT
        t.fechaInicio, t.fechaFin, t.horario, normalizarHora(t.horaInicio), normalizarHora(t.horaFin), t.diaSemana, recursoId // para WHERE NOT EXISTS
      ];

      db.query(queryInsert, params, (err2, result) => {
        if (err2) reject(err2);
        else resolve(result);
      });
    });
  });

  return Promise.all(promises)
    .then(() => {
      res.json({ success: true, message: "Turnos guardados correctamente" });
    })
    .catch(e => {
      console.error("❌ Error al insertar turnos:", e);
      res.status(500).json({ success: false, message: "Error al guardar turnos" });
    });
};

  if (tipo === "medico") {
    // 1️⃣ Obtener idRecurso del médico
    const queryRecurso = `SELECT Recurso_idRecurso FROM Recurso_Medico WHERE correo_electronico = ? LIMIT 1`;
    db.query(queryRecurso, [email], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "Error al obtener idRecurso" });
      if (results.length === 0) return res.status(404).json({ success: false, message: "Médico no encontrado" });

      const recursoId = results[0].Recurso_idRecurso; 
      const queryInsert = `
        INSERT INTO agenda_medico 
        (fecha_inicio, fecha_fin, duracion, hora_inicio, hora_fin, disponible, dia_semana, recurso_medico_idRecurso_Medico)
        SELECT ?, ?, ?, ?, ?, 'D', ?, ?
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM agenda_medico 
          WHERE fecha_inicio = ? AND fecha_fin = ? AND duracion = ? AND hora_inicio = ? AND hora_fin = ? AND dia_semana = ? AND recurso_medico_idRecurso_Medico = ?
        );`;
      console.log("📩 Datos recibidos en /guardar-agenda (medico):", turnos);
      insertarTurnos(recursoId, queryInsert);
    });

  } else if (tipo === "cancha") {
    // 1️⃣ Obtener idRecurso de la cancha
    const queryRecurso = `SELECT Recurso_idRecurso FROM Recurso_Cancha WHERE correo_electronico = ? LIMIT 1`;
    db.query(queryRecurso, [email], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "Error al obtener idRecurso" });
      if (results.length === 0) return res.status(404).json({ success: false, message: "Cancha no encontrada" });

      const recursoId = results[0].Recurso_idRecurso;
      const queryInsert = `
        INSERT INTO agenda_cancha
        (fecha_inicio, fecha_fin, duracion, hora_inicio, hora_fin, disponible, dia_semana, recurso_cancha_idRecurso_Cancha)
        SELECT ?, ?, ?, ?, ?, 'D', ?, ?
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM agenda_cancha 
          WHERE fecha_inicio = ? AND fecha_fin = ? AND duracion = ? AND hora_inicio = ? AND hora_fin = ? AND dia_semana = ? AND recurso_cancha_idRecurso_Cancha = ?
          );`;
      console.log("📩 Datos recibidos en /guardar-agenda (cancha):", turnos);
      insertarTurnos(recursoId, queryInsert);
    });

  } else {
    return res.status(400).json({ error: "Tipo de usuario inválido" });
  }
});

// =======================================================
// 📤 API para obtener agenda del médico o cancha
// =======================================================
app.get("/api/turnos/agenda", (req, res) => {
  if (!req.session.user) return res.status(403).json({ error: "No estás logueado" });

  const email = req.session.user.email;
  const tipo = req.session.user.tipo;

  let queryRecurso, queryAgenda;

  if (tipo === "medico") {
    queryRecurso = `SELECT Recurso_idRecurso FROM Recurso_Medico WHERE correo_electronico = ? LIMIT 1`;
    queryAgenda = `
      SELECT fecha_inicio, fecha_fin, duracion, hora_inicio, hora_fin, dia_semana
      FROM agenda_medico
      WHERE recurso_medico_idRecurso_Medico = ?
    `;
  } else if (tipo === "cancha") {
    queryRecurso = `SELECT Recurso_idRecurso FROM Recurso_Cancha WHERE correo_electronico = ? LIMIT 1`;
    queryAgenda = `
      SELECT fecha_inicio, fecha_fin, duracion, hora_inicio, hora_fin, dia_semana
      FROM agenda_cancha
      WHERE recurso_cancha_idRecurso_Cancha = ?
    `;
  } else {
    return res.status(400).json({ error: "Tipo de usuario inválido" });
  }

  // 1️⃣ Buscamos id recurso
  db.query(queryRecurso, [email], (err, results) => {
    if (err) return res.status(500).json({ error: "Error al obtener recurso" });
    if (results.length === 0) return res.status(404).json({ error: "Recurso no encontrado" });

    const recursoId = results[0].Recurso_idRecurso;

    // 2️⃣ Obtenemos agenda guardada
    db.query(queryAgenda, [recursoId], (err2, agenda) => {
      if (err2) return res.status(500).json({ error: "Error al obtener agenda" });
      res.json({ success: true, agenda });
    });
  });
});

// =======================================================
// 📤 API para obtener los datos del paciente
// =======================================================
app.get("/api/turnos/datos-paciente", (req, res) => {
  if (!req.session.user) {
    return res.status(403).json({ error: "No estás logueado" });
  }
  const dni = req.query.dni;

  if (!dni) {
    return res.status(400).json({ success: false, error: "Falta el parámetro DNI" });
  }

  const query = `
    SELECT idCliente, Nombre, Apellido, DNI, Telefono
    FROM cliente
    WHERE DNI = ?
    LIMIT 1;
  `;

  db.query(query, [dni], (err, results) => {
    if (err) {
      console.error("❌ Error en consulta datos-paciente:", err);
      return res.status(500).json({ success: false, error: "Error en servidor" });
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, error: "Paciente no encontrado" });
    }

    const row = results[0];
    return res.status(200).json({
      success: true,
      paciente: {
        idCliente: row.idCliente,
        nombre: row.Nombre,
        apellido: row.Apellido,
        dni: row.DNI,
        telefono: row.Telefono
      }
    });
  });
});

// =======================================================
// 🔹 API para guardar turno nuevo del paciente por HOME
// =======================================================
app.post("/api/turnos/guardar-turno", (req, res) => {
  if (!req.session.user) return res.status(403).json({ error: "No estás logueado" });

  const email = req.session.user.email;
  const tipo = req.session.user.tipo;
  const { turno } = req.body;

  if (!turno || !Array.isArray(turno) || turno.length === 0) {
    return res.status(400).json({ success: false, message: "No hay turnos para guardar" });
  }

  // 🧠 Función para verificar si un turno ya existe en la base
  const verificarTurnoExistente = (fecha, hora, recursoId, idParticular) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) AS total
        FROM reserva
        WHERE Fecha = ? 
          AND Hora = ? 
          AND Recurso_idRecurso = ? 
          AND (recurso_medico_idRecurso_Medico = ? OR recurso_cancha_idRecurso_Cancha = ?)
      `;
      db.query(query, [fecha, hora, recursoId, idParticular, idParticular], (err, results) => {
        if (err) return reject(err);
        resolve(results[0].total > 0);
      });
    });
  };

  // 🧱 Función para insertar turnos con validación
  const insertarTurno = (recursoId, idParticular, queryInsert) => {
    const promises = turno.map(async t => {
      const existe = await verificarTurnoExistente(t.fecha, t.hora, recursoId, idParticular);
      if (existe) {
        console.log(`⚠️ Turno ya ocupado: ${t.fecha} ${t.hora}`);
        return { ocupado: true, fecha: t.fecha, hora: t.hora };
      }

      return new Promise((resolve, reject) => {
        const params = [
          t.fecha, t.hora, t.fecha_creacion, t.idCliente, recursoId, idParticular,
          t.fecha, t.hora, t.fecha_creacion, t.idCliente, recursoId, idParticular,
        ];

        db.query(queryInsert, params, (err2, result) => {
          if (err2) reject(err2);
          else resolve({ ocupado: false });
        });
      });
    });

    Promise.all(promises)
      .then(resultados => {
        const ocupados = resultados.filter(r => r && r.ocupado);
        if (ocupados.length > 0) {
          const msg = ocupados.map(o => `${o.fecha} ${o.hora}`).join(", ");
          return res.json({
            success: false,
            message: `Los siguientes turnos ya fueron reservados: ${msg}`,
          });
        }

        res.json({ success: true, message: "Turnos guardados correctamente ✅" });
      })
      .catch(e => {
        console.error("❌ Error al insertar turnos:", e);
        res.status(500).json({ success: false, message: "Error al guardar turnos" });
      });
  };

  // 👨‍⚕️ Para médicos
  if (tipo === "medico") {
    const queryRecurso  = `SELECT Recurso_idRecurso, idRecurso_medico FROM Recurso_Medico WHERE correo_electronico = ? LIMIT 1`;
    db.query(queryRecurso, [email], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "Error al obtener idRecurso" });
      if (results.length === 0) return res.status(404).json({ success: false, message: "Médico no encontrado" });

      const { idRecurso_medico, Recurso_idRecurso } = results[0];

      const queryInsert = `
        INSERT INTO reserva 
        (Fecha, Hora, Estado, fecha_creacion, Cliente_idCliente, Recurso_idRecurso, recurso_medico_idRecurso_Medico, recurso_cancha_idRecurso_Cancha)
        SELECT ?, ?, 'confirmada', ?, ?, ?, ?, NULL
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM reserva 
          WHERE Fecha = ? AND Hora = ? AND fecha_creacion = ? 
          AND Cliente_idCliente = ? AND Recurso_idRecurso = ? 
          AND recurso_medico_idRecurso_Medico = ? AND recurso_cancha_idRecurso_Cancha IS NULL
        );
      `;

      console.log("📩 Datos recibidos en /guardar-turno (médico):", turno);
      insertarTurno(Recurso_idRecurso, idRecurso_medico, queryInsert);
    });

  // 🏟️ Para canchas
  } else if (tipo === "cancha") {
    const queryRecurso = `SELECT Recurso_idRecurso FROM Recurso_Cancha WHERE correo_electronico = ? LIMIT 1`;
    db.query(queryRecurso, [email], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "Error al obtener idRecurso" });
      if (results.length === 0) return res.status(404).json({ success: false, message: "Cancha no encontrada" });

      const recursoId = results[0].Recurso_idRecurso;

      const queryInsert = `
        INSERT INTO reserva 
        (Fecha, Hora, Estado, fecha_creacion, Cliente_idCliente, Recurso_idRecurso, recurso_medico_idRecurso_Medico, recurso_cancha_idRecurso_Cancha)
        SELECT ?, ?, 'confirmada', ?, ?, ?, NULL, ?
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM reserva 
          WHERE Fecha = ? AND Hora = ? AND fecha_creacion = ? 
          AND Cliente_idCliente = ? AND Recurso_idRecurso = ? 
          AND recurso_medico_idRecurso_Medico IS NULL AND recurso_cancha_idRecurso_Cancha = ?
        );
      `;

      console.log("📩 Datos recibidos en /guardar-turno (cancha):", turno);
      insertarTurno(recursoId, recursoId, queryInsert);
    });

  } else {
    return res.status(400).json({ error: "Tipo de usuario inválido" });
  }
});
// =======================================================
// 🔹 API para listar clientes (usado por la página mostrar_bd.html)
// =======================================================
app.get('/api/cliente', (req, res) => {
  if (!db2) {
    console.error('BD CLIENTES no disponible (db2 undefined)');
    return res.status(500).json([]);
  }

  // Usar SELECT * para evitar errores por nombres de columnas diferentes en esquemas
  const query = `SELECT * FROM cliente ORDER BY idCliente DESC LIMIT 1000`;
  db2.query(query, (err, results) => {
    if (err) {
      console.error('❌ Error al obtener clientes:', err);
      return res.status(500).json([]);
    }
    res.json(results || []);
  });
});
// =======================================================
// 🔹 API para crear cliente (recibe JSON)
// =======================================================
app.post('/api/cliente', async (req, res) => {
  if (!db2) return res.status(500).json({ error: 'BD CLIENTES no disponible' });
  const datos = req.body || {};

  try {
    // Obtener columnas reales de la tabla
    const [cols] = await new Promise((resolve, reject) => db2.query('DESCRIBE cliente', (err, rows) => err ? reject(err) : resolve([rows])));
    const colNames = cols.map(c => c.Field);

    // Mapa case-insensitive: lowerCase -> actualField
    const colMap = {};
    cols.forEach(c => { colMap[c.Field.toLowerCase()] = c.Field; });

    // Filtrar datos mapeando case-insensitivamente
    const inputKeys = Object.keys(datos || {});
    const keys = [];
    inputKeys.forEach(k => {
      const mapped = colMap[k.toLowerCase()];
      if (mapped && !keys.includes(mapped)) keys.push(mapped);
    });

    if (keys.length === 0) return res.status(400).json({ error: 'No se enviaron campos válidos' });

    // Detectar columnas NOT NULL sin default que faltan
    const requiredCols = cols.filter(c => c.Null === 'NO' && (c.Default === null || typeof c.Default === 'undefined') && !/auto_increment/i.test(c.Extra)).map(c => c.Field);
    const missingRequired = requiredCols.filter(rc => !keys.includes(rc));
    if (missingRequired.length > 0) {
      return res.status(400).json({ error: 'Faltan campos obligatorios', missing: missingRequired });
    }

    // Si viene contrasena (case-insensitive), hashearla usando el nombre real de la columna
    const contrCol = colMap['contrasena'];
    if (contrCol && keys.includes(contrCol) && datos.contrasena) {
      datos[contrCol] = await bcrypt.hash(datos.contrasena, 10);
    }

    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO cliente (${keys.join(',')}) VALUES (${placeholders})`;
    const params = keys.map(k => datos[k]);

    db2.query(sql, params, (err, result) => {
      if (err) {
        console.error('Error al insertar cliente:', err);
        return res.status(500).json({ error: 'Error al insertar cliente', details: err.message });
      }
      // Si en el payload venía un servicio_id, crear la relación en servicio_contratado
      const servicioId = datos.servicio_id || datos.servicio || datos.servicioId || datos.servicio_id;
      if (servicioId) {
        const clienteId = result.insertId;
        const sqlRel = `INSERT INTO servicio_contratado (cliente_id, servicio_id) VALUES (?, ?)`;
        db2.query(sqlRel, [clienteId, servicioId], (err2) => {
          if (err2) {
            console.error('Error al insertar servicio_contratado:', err2);
            // No hacer rollback automático: informar al cliente pero devolver insertId
            return res.json({ success: true, insertId: result.insertId, warning: 'Cliente creado, pero fallo al asociar servicio', servicioError: err2.message });
          }
          return res.json({ success: true, insertId: result.insertId });
        });
      } else {
        res.json({ success: true, insertId: result.insertId });
      }
    });
  } catch (err) {
    console.error('Error al procesar /api/cliente POST:', err);
    res.status(500).json({ error: 'Error en servidor' });
  }
});
// =======================================================
// 🔹 Endpoint para inspeccionar esquema de la tabla cliente
// =======================================================
app.get('/api/cliente/schema', (req, res) => {
  if (!db2) return res.status(500).json({ error: 'BD CLIENTES no disponible' });
  db2.query('DESCRIBE cliente', (err, rows) => {
    if (err) {
      console.error('Error al describir tabla cliente:', err);
      return res.status(500).json({ error: 'Error al describir tabla' });
    }
    res.json(rows);
  });
});
// =======================================================
// 🔹 API para listar servicios (usado por formulario de cliente)
// =======================================================
app.get('/api/servicio', (req, res) => {
  if (!db2) return res.status(500).json([]);
  db2.query('SELECT idServicio, nombre, precio, descripcion FROM servicio ORDER BY nombre ASC', (err, rows) => {
    if (err) {
      console.error('Error al obtener servicios:', err);
      return res.status(500).json([]);
    }
    res.json(rows || []);
  });
});
// =======================================================
// 🔹 API para listar servicios contratados con nombre de cliente y servicio
// =======================================================
app.get('/api/servicio_contratado', (req, res) => {
  if (!db2) return res.status(500).json([]);
  const sql = `
    SELECT sc.cliente_id AS cliente_id, sc.servicio_id AS servicio_id,
    c.Nombre AS nombre_cliente, c.Apellido AS apellido_cliente,
    s.nombre AS nombre_servicio, s.precio, s.descripcion
    FROM servicio_contratado sc
    LEFT JOIN cliente c ON sc.cliente_id = c.idCliente
    LEFT JOIN servicio s ON sc.servicio_id = s.idServicio
    ORDER BY c.Nombre ASC, s.nombre ASC
  `;
  db2.query(sql, (err, rows) => {
    if (err) {
      console.error('Error al obtener servicio_contratado:', err);
      return res.status(500).json([]);
    }
    res.json(rows || []);
  });
});

// =======================================================
// 🔹 Servidor
// =======================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});

