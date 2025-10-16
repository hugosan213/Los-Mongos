-- =======================
-- CONSULTAS
-- =======================


TRUNCATE TABLE agenda_cancha;
truncate table agenda_medico;
TRUNCATE TABLE reserva;
TRUNCATE TABLE cliente;
TRUNCATE TABLE recurso;
TRUNCATE TABLE recurso_cancha;
TRUNCATE TABLE recurso_medico;
TRUNCATE TABLE sede;



SELECT
  res.idReserva,
  c.DNI,
  c.Nombre AS ClienteNombre,
  c.Apellido AS ClienteApellido,
  res.Fecha,
  res.Hora,
  res.Estado,
  rec.Nombre AS Recurso,
  GROUP_CONCAT(CONCAT(rm.Nombre, ' ', rm.Apellido, ' (', rm.Especialidad, ')') SEPARATOR ', ') AS Profesionales
FROM reserva res
JOIN cliente c ON res.Cliente_idCliente = c.idCliente
LEFT JOIN recurso rec ON res.Recurso_idRecurso = rec.idRecurso
LEFT JOIN recurso_medico rm ON rm.Recurso_idRecurso = rec.idRecurso
GROUP BY res.idReserva, c.DNI, c.Nombre, c.Apellido, res.Fecha, res.Hora, res.Estado, rec.Nombre
ORDER BY res.Fecha, res.Hora;

