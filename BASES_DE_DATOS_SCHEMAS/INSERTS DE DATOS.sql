
-- Insertar clientes
INSERT INTO cliente (Nombre, Apellido, DNI, Telefono) VALUES
('Juan', 'Pérez', '30711222', '2945123456'),
('María', 'Gómez', '32111323', '2945123457'),
('Carlos', 'Ramírez', '33111944', '2945123458'),
('Ana', 'Torres', '34111505', '2945123459');

-- Insertar sedes
INSERT INTO sede (Nombre, Direccion, Localidad) VALUES
('Molino', 'Av. Fontana 123', 'Esquel'),
('Pucon', 'Ruta 259 Km 5', 'Esquel'),
('Fleming', 'Av. Ameghino 456', 'Esquel'),
('Clinica del Sur', '25 de Mayo 890', 'Esquel'),
('Sanatorio Esquel', 'Av. Alvear 1200', 'Esquel');

-- Insertar recursos
INSERT INTO recurso (Nombre, Sede_idSede) VALUES
('Canchas Molino', 1),
('Canchas Pucon', 2),
('Canchas Fleming', 3),
('Consultorios Clinica Sur', 4),
('Consultorios Sanatorio Esquel', 5);

-- Insertar canchas
INSERT INTO recurso_cancha (Nombre, Numero_Cancha, Tipo_deporte, Estado, Recurso_idRecurso, correo_electronico) VALUES
('Cancha Interior Molino', '1', 'Fútbol 5', 'D', 1, 'molino1@canchas.com'),
('Cancha Exterior Molino', '2', 'Fútbol 7', 'D', 1, 'molino2@canchas.com'),
('Cancha Exterior Molino', '3', 'Padel', 'D', 1, 'molino3@canchas.com'),
('Cancha Exterior Pucon', '1', 'Fútbol 7', 'D', 2, 'pucon1@canchas.com'),
('Cancha Interior Pucon', '2', 'Padel', 'D', 2, 'pucon2@canchas.com'),
('Cancha Interior Pucon', '3', 'Tenis', 'D', 2, 'pucon3@canchas.com'),
('Cancha Fleming', '1', 'Fútbol 5', 'D', 3, 'fleming1@canchas.com'),
('Cancha Fleming', '2', 'Padel', 'D', 3, 'fleming2@canchas.com');

-- Insertar médicos
INSERT INTO recurso_medico (Nombre, Apellido, Especialidad, Estado, Recurso_idRecurso, correo_electronico) VALUES
('Roberto', 'Suarez', 'Cardiología', 'D', 4, 'rsuarez@clinicasur.com'),
('Laura', 'Fernandez', 'Pediatría', 'D', 4, 'lfernandez@clinicasur.com'),
('Martín', 'López', 'Clínica Médica', 'D', 5, 'mlopez@sanatorio.com'),
('Cecilia', 'Martinez', 'Traumatología', 'D', 5, 'cmartinez@sanatorio.com'),
('Martin','Pensacola','Clínica Médica','D',5,'pensacola@autocompletar.com');

-- Insertar reservas
INSERT INTO reserva (Fecha, Hora, Estado, Cliente_idCliente, Recurso_idRecurso, recurso_medico_idRecurso_Medico, recurso_cancha_idRecurso_Cancha) VALUES
('2025-09-15', '18:00:00', 'confirmada', 1, 1, NULL, 1), -- Juan reserva cancha Interior Molino
('2025-09-15', '19:30:00', 'confirmada', 2, 2, NULL, 4), -- María reserva cancha Exterior Pucon
('2025-09-16', '10:00:00', 'confirmada', 3, 4, 1, NULL), -- Carlos turno médico Roberto Suarez (Clínica Sur)
('2025-09-16', '11:30:00', 'confirmada', 4, 5, 3, NULL), -- Ana turno médico Martín López (Sanatorio Esquel)
('2025-09-17', '20:00:00', 'confirmada', 1, 3, NULL, 7); -- Juan juega en cancha Fleming


-- Agenda médicos (rangos con duración variable)

INSERT INTO agenda_medico 
(fecha_inicio, fecha_fin, duracion, hora_inicio, hora_fin, disponible, dia_semana, recurso_medico_idRecurso_Medico) VALUES
('2025-10-14','2025-12-01','00:20:00','09:00:00','11:30:00','D',1,1), -- Lunes 09-11:30 Roberto Suarez (20 min) - 45 días
('2025-10-14','2025-11-28','00:30:00','14:00:00','17:00:00','D',1,1), -- Lunes 14-17 Roberto Suarez (30 min) - 45 días
('2025-10-14','2025-11-14','01:00:00','14:00:00','17:00:00','D',3,1), -- Miércoles 14-17 Roberto Suarez (1h) - 30 días
('2025-10-14','2025-10-28','00:15:00','12:30:00','13:30:00','D',3,2), -- Miércoles 12:30-13:30 Laura Fernandez (15 min) - 15 días
('2025-10-14','2025-11-11','00:45:00','10:30:00','11:30:00','D',5,2), -- Viernes 10:30-11:30 Laura Fernandez (45 min) - 30 días
('2025-10-14','2025-11-30','00:30:00','09:00:00','12:30:00','D',1,3), -- Lunes 09-12:30 Martín López (30 min) - 45 días
('2025-10-14','2025-10-29','01:00:00','14:00:00','18:00:00','D',3,3), -- Miércoles 14-18 Martín López (1h) - 15 días
('2025-10-14','2025-11-14','00:20:00','12:30:00','13:30:00','D',4,4), -- Jueves 12:30-13:30 Cecilia Martinez (20 min) - 30 días
('2025-10-14','2025-11-28','00:30:00','10:30:00','13:30:00','D',2,4), -- Martes 10:30-13:30 Cecilia Martinez (30 min) - 45 días

-- Médico 5
('2025-10-14','2025-11-14','00:30:00','08:00:00','11:30:00','D',5,5), -- Viernes 08-11:30 (30 min) - 30 días
('2025-10-14','2025-11-28','00:45:00','14:00:00','17:30:00','D',4,5); -- Jueves 14-17:30 (45 min) - 45 días

-- Agenda canchas (con duración según tipo de deporte)
INSERT INTO agenda_cancha 
(fecha_inicio, fecha_fin, duracion, hora_inicio, hora_fin, disponible, dia_semana, recurso_cancha_idRecurso_Cancha) VALUES
-- Cancha Interior Molino (Fútbol 5, duración 1h)
('2025-09-19','2025-10-06','01:00:00','09:00:00','11:30:00','D',1,1),
('2025-09-19','2025-10-06','01:00:00','14:00:00','17:00:00','D',1,1),

-- Cancha Exterior Molino (Fútbol 7, duración 1h)
('2025-09-19','2025-10-06','01:00:00','14:00:00','17:00:00','D',3,2),

-- Cancha Exterior Molino (Pádel, duración 1h30m)
('2025-09-19','2025-10-06','01:30:00','12:30:00','13:30:00','D',3,3),

-- Cancha Interior Pucon (Pádel, duración 1h30m)
('2025-09-19','2025-10-06','01:30:00','10:30:00','11:30:00','D',5,5),

-- Cancha Interior Pucon (Tenis, duración 1h)
('2025-09-22','2025-10-29','01:00:00','09:00:00','12:30:00','D',1,6),

-- Cancha Fleming (Fútbol 5, duración 1h)
('2025-09-22','2025-10-10','01:00:00','14:00:00','18:00:00','D',3,7),

-- Cancha Fleming (Pádel, duración 1h30m)
('2025-09-22','2025-10-09','01:30:00','12:30:00','13:30:00','D',4,8),

-- Cancha Exterior Pucon (Fútbol 7, duración 1h)
('2025-09-22','2025-10-13','01:00:00','10:30:00','13:30:00','D',2,4);






