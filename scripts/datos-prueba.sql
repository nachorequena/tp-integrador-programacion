-- =============================================================================
-- DATOS DE PRUEBA PARA LA ENTREGA FINAL (frontend semanas 2 a 4)
-- =============================================================================
--
-- Qué hace: completa la base con lo que pide la consigna final para poder
-- probar el sistema con los cuatro roles:
--
--   * al menos tres médicos con distintas especialidades:
--       - Ana Lopez       (Traumatologia)  dni 20111222
--       - Carlos Ruiz     (Clinica medica) dni 25333444
--       - Lucia Fernandez (Cardiologia)    dni 27444555  ← se crea acá
--   * uno de ellos (Ana Lopez) con agenda en MÁS DE UNA SEDE (Centro y Norte);
--   * turnos en los tres estados: confirmado, cancelado y atendido (con su
--     historial clínico);
--   * un segundo paciente (Laura Martinez) y dos coberturas más.
--
-- Orden de ejecución sobre una base nueva (ver README):
--   1. docs/clinica_ampliada.sql     ← script de la cátedra (tablas + seed)
--   2. scripts/usuarios-prueba.sql   ← contraseñas reales + 2do médico
--   3. scripts/datos-prueba.sql      ← este archivo
--
-- Las fechas son RELATIVAS al día en que se ejecuta (CURDATE()): así siempre
-- hay agenda "para hoy" y para los próximos días, que es lo que muestran por
-- defecto las pantallas del médico y del operador.
--
-- Es idempotente: cada INSERT está protegido con NOT EXISTS, así que correrlo
-- dos veces el mismo día no duplica nada. Correrlo otro día suma la agenda de
-- los días nuevos (no rompe nada).
--
-- Contraseñas (hashes bcrypt reales, los mismos de usuarios-prueba.sql):
--   médicos  → medico123
--   pacientes → paciente123
--
-- Ojo con el tope de los `tinyint` del script de la cátedra (127 filas por
-- tabla): este archivo agrega unas 25 agendas y 9 turnos.
-- =============================================================================

-- ── Catálogos ────────────────────────────────────────────────────────────────

INSERT INTO especialidad (descripcion)
SELECT 'Clinica medica' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM especialidad WHERE descripcion = 'Clinica medica');

INSERT INTO especialidad (descripcion)
SELECT 'Cardiologia' FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM especialidad WHERE descripcion = 'Cardiologia');

INSERT INTO cobertura (nombre)
SELECT 'OSDE' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cobertura WHERE nombre = 'OSDE');

INSERT INTO cobertura (nombre)
SELECT 'Particular' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cobertura WHERE nombre = 'Particular');

SET @trauma  = (SELECT id FROM especialidad WHERE descripcion = 'Traumatologia' LIMIT 1);
SET @clinica = (SELECT id FROM especialidad WHERE descripcion = 'Clinica medica' LIMIT 1);
SET @cardio  = (SELECT id FROM especialidad WHERE descripcion = 'Cardiologia' LIMIT 1);
SET @osde    = (SELECT id FROM cobertura WHERE nombre = 'OSDE' LIMIT 1);
SET @centro  = 1; -- Sede Centro (seed de la cátedra)
SET @norte   = 2; -- Sede Norte  (seed de la cátedra)

-- ── Usuarios nuevos ──────────────────────────────────────────────────────────

-- Tercera médica (medico123), asignada a la Sede Centro.
INSERT INTO usuario (apellido, nombre, fecha_nacimiento, password, rol, email, telefono, dni, id_sede, id_cobertura)
SELECT 'Fernandez', 'Lucia', '1985-04-22',
       '$2b$10$IqkaAJE7F3hMXNX9BPiAhelyiCgliZAmGqIU5X1rjlgKCyF0QyVIa',
       'medico', 'lfernandez@clinica.com', '3424444555', '27444555', 1, NULL
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE dni = '27444555');

-- Segundo paciente (paciente123), con cobertura OSDE.
INSERT INTO usuario (apellido, nombre, fecha_nacimiento, password, rol, email, telefono, dni, id_sede, id_cobertura)
SELECT 'Martinez', 'Laura', '1990-07-15',
       '$2b$10$jlPU0OELfT3OUAzkUK8wVei6PE0mrEKe8HgW2MEKellgUNLyj6zV2',
       'paciente', 'lmartinez@mail.com', '3425666777', '40111222', NULL, @osde
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE dni = '40111222');

SET @lopez     = (SELECT id FROM usuario WHERE dni = '20111222');
SET @ruiz      = (SELECT id FROM usuario WHERE dni = '25333444');
SET @fernandez = (SELECT id FROM usuario WHERE dni = '27444555');
SET @friggeri  = (SELECT id FROM usuario WHERE dni = '36000960');
SET @martinez  = (SELECT id FROM usuario WHERE dni = '40111222');

-- ── Especialidades de los médicos (medico_especialidad) ──────────────────────

INSERT INTO medico_especialidad (id_medico, id_especialidad)
SELECT @ruiz, @clinica FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM medico_especialidad WHERE id_medico = @ruiz AND id_especialidad = @clinica);

INSERT INTO medico_especialidad (id_medico, id_especialidad)
SELECT @fernandez, @cardio FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM medico_especialidad WHERE id_medico = @fernandez AND id_especialidad = @cardio);

-- ── Agenda ───────────────────────────────────────────────────────────────────
-- Una tabla temporal con los rangos a cargar evita repetir el mismo INSERT
-- protegido 25 veces. `dia` es el desplazamiento respecto de hoy (-1 = ayer).

DROP TEMPORARY TABLE IF EXISTS agenda_prueba;
CREATE TEMPORARY TABLE agenda_prueba (
  dia INT, entrada VARCHAR(5), salida VARCHAR(5),
  id_medico INT, id_especialidad INT, id_sede INT
);

INSERT INTO agenda_prueba VALUES
  -- Ana Lopez: mañanas en Centro y tardes en Norte → agenda en dos sedes.
  (-1, '08:00', '12:00', @lopez, @trauma, @centro),
  ( 0, '08:00', '12:00', @lopez, @trauma, @centro),
  ( 0, '15:00', '19:00', @lopez, @trauma, @norte),
  ( 1, '08:00', '12:00', @lopez, @trauma, @centro),
  ( 2, '15:00', '19:00', @lopez, @trauma, @norte),
  ( 3, '08:00', '12:00', @lopez, @trauma, @centro),
  ( 4, '15:00', '19:00', @lopez, @trauma, @norte),
  ( 5, '08:00', '12:00', @lopez, @trauma, @centro),
  ( 7, '08:00', '12:00', @lopez, @trauma, @centro),
  -- Carlos Ruiz: Clínica médica en la Sede Norte.
  ( 0, '09:00', '13:00', @ruiz, @clinica, @norte),
  ( 1, '09:00', '13:00', @ruiz, @clinica, @norte),
  ( 2, '09:00', '13:00', @ruiz, @clinica, @norte),
  ( 3, '09:00', '13:00', @ruiz, @clinica, @norte),
  ( 4, '09:00', '13:00', @ruiz, @clinica, @norte),
  ( 6, '09:00', '13:00', @ruiz, @clinica, @norte),
  -- Lucía Fernández: Cardiología en la Sede Centro, a la tarde.
  ( 0, '14:00', '18:00', @fernandez, @cardio, @centro),
  ( 1, '14:00', '18:00', @fernandez, @cardio, @centro),
  ( 2, '14:00', '18:00', @fernandez, @cardio, @centro),
  ( 3, '14:00', '18:00', @fernandez, @cardio, @centro),
  ( 5, '14:00', '18:00', @fernandez, @cardio, @centro);

INSERT INTO agenda (hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede)
SELECT p.entrada, p.salida, DATE_ADD(CURDATE(), INTERVAL p.dia DAY),
       p.id_medico, p.id_especialidad, p.id_sede
  FROM agenda_prueba p
 WHERE NOT EXISTS (
         SELECT 1 FROM agenda a
          WHERE a.id_medico = p.id_medico
            AND a.fecha = DATE_ADD(CURDATE(), INTERVAL p.dia DAY)
            AND a.hora_entrada = p.entrada);

DROP TEMPORARY TABLE agenda_prueba;

-- ── Turnos en los tres estados ───────────────────────────────────────────────
-- Cada turno se engancha al rango de agenda que lo contiene (mismo médico,
-- fecha y sede). La cobertura es la del paciente, como exige la consigna.

DROP TEMPORARY TABLE IF EXISTS turno_prueba;
CREATE TEMPORARY TABLE turno_prueba (
  dia INT, hora VARCHAR(5), id_medico INT, id_sede INT,
  id_paciente INT, estado VARCHAR(20), nota VARCHAR(40)
);

INSERT INTO turno_prueba VALUES
  -- Atendido (ayer), con historial clínico más abajo.
  (-1, '09:00', @lopez, @centro, @friggeri, 'atendido',   'Dolor de rodilla'),
  -- Confirmados de hoy, en las dos sedes de Ana Lopez.
  ( 0, '10:00', @lopez, @centro, @friggeri, 'confirmado', 'Control de esguince'),
  ( 0, '11:00', @lopez, @centro, @martinez, 'confirmado', 'Dolor lumbar'),
  ( 0, '16:00', @lopez, @norte,  @martinez, 'confirmado', 'Control post operatorio'),
  ( 0, '10:30', @ruiz,  @norte,  @friggeri, 'confirmado', 'Chequeo anual'),
  -- Cancelado.
  ( 1, '09:30', @lopez, @centro, @friggeri, 'cancelado',  'Consulta por golpe'),
  -- Confirmados de los próximos días.
  ( 1, '08:30', @lopez, @centro, @friggeri, 'confirmado', 'Traer radiografia'),
  ( 1, '15:00', @fernandez, @centro, @martinez, 'confirmado', 'Electrocardiograma'),
  ( 2, '16:30', @lopez, @norte,  @friggeri, 'confirmado', 'Seguimiento');

INSERT INTO turno (nota, id_agenda, fecha, hora, id_paciente, id_cobertura, estado)
SELECT p.nota, a.id, a.fecha, p.hora, p.id_paciente, u.id_cobertura, p.estado
  FROM turno_prueba p
  JOIN agenda a ON a.id_medico = p.id_medico
               AND a.id_sede = p.id_sede
               AND a.fecha = DATE_ADD(CURDATE(), INTERVAL p.dia DAY)
               AND p.hora >= a.hora_entrada AND p.hora < a.hora_salida
  JOIN usuario u ON u.id = p.id_paciente
 WHERE NOT EXISTS (
         SELECT 1 FROM turno t
          WHERE t.id_agenda = a.id AND t.hora = p.hora AND t.id_paciente = p.id_paciente);

DROP TEMPORARY TABLE turno_prueba;

-- Historial del turno atendido de ayer.
INSERT INTO historial_clinico (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
SELECT t.id, @lopez, @friggeri,
       'Tendinitis rotuliana leve', 'Antiinflamatorios por 7 dias y hielo local',
       'Evitar deportes de impacto por dos semanas'
  FROM turno t
  JOIN agenda a ON a.id = t.id_agenda
 WHERE a.id_medico = @lopez AND t.id_paciente = @friggeri AND t.estado = 'atendido'
   AND t.fecha = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND t.hora = '09:00'
   AND NOT EXISTS (SELECT 1 FROM historial_clinico h WHERE h.id_turno = t.id);

-- ── Verificación rápida ──────────────────────────────────────────────────────

SELECT u.dni, CONCAT(u.nombre, ' ', u.apellido) AS medico,
       GROUP_CONCAT(DISTINCT e.descripcion) AS especialidades,
       COUNT(DISTINCT a.id_sede) AS sedes_con_agenda
  FROM usuario u
  LEFT JOIN medico_especialidad me ON me.id_medico = u.id
  LEFT JOIN especialidad e ON e.id = me.id_especialidad
  LEFT JOIN agenda a ON a.id_medico = u.id
 WHERE u.rol = 'medico'
 GROUP BY u.id, u.dni, u.nombre, u.apellido;

SELECT estado, COUNT(*) AS cantidad FROM turno GROUP BY estado;
