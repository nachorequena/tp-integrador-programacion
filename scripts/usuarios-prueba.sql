-- ============================================================================
--  USUARIOS DE PRUEBA
-- ============================================================================
--
--  Para qué sirve
--  --------------
--  El script de la cátedra (docs/clinica_ampliada.sql) carga cuatro usuarios
--  con hashes de contraseña FALSOS ('$2b$10$hashdeejemplo1', de 21 caracteres
--  en vez de los 60 que ocupa un hash bcrypt real). Con esos valores NINGUNO
--  puede iniciar sesión: `bcrypt.compare` devuelve false y el login responde
--  401.
--
--  Sin poder loguearse no hay forma de demostrar los criterios de aceptación,
--  que están definidos por rol: "los endpoints de sedes, especialidades y
--  coberturas son accesibles únicamente para el rol administrador", "el médico
--  solo accede/modifica su propia agenda", etc.
--
--  Este script deja a los cuatro usuarios del seed con contraseñas reales y
--  agrega un segundo médico.
--
--  ¿Por qué un segundo médico? El seed trae uno solo (Ana Lopez). Con un único
--  médico es imposible probar que un médico NO puede modificar la agenda de
--  otro: no hay "otro". Carlos Ruiz existe únicamente para poder demostrar ese
--  403.
--
--  Qué NO hace
--  -----------
--  No modifica docs/clinica_ampliada.sql, que se deja tal como lo entregó la
--  cátedra. Acá solo se actualizan datos ya cargados y se agrega una fila.
--
--  Cómo se ejecuta
--  ---------------
--    mysql -u root -p clinica < scripts/usuarios-prueba.sql
--
--  Es idempotente: se puede correr las veces que haga falta.
--
--  Credenciales resultantes (también están en el README)
--  -----------------------------------------------------
--    DNI       | Contraseña   | Rol       | Usuario
--    ----------|--------------|-----------|------------------
--    18222333  | admin123     | admin     | Marcos Gomez
--    15200548  | operador123  | operador  | Juan Perez
--    20111222  | medico123    | medico    | Ana Lopez
--    25333444  | medico123    | medico    | Carlos Ruiz  (agregado acá)
--    36000960  | paciente123  | paciente  | Franco Friggeri
--
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Contraseñas reales para los usuarios del seed
-- ---------------------------------------------------------------------------

-- admin123
UPDATE usuario SET password = '$2b$10$allhMjV82yItbS46BJvGoepoD9rfGnPJHOGVijhLaSOD6HCbcm8pa'
 WHERE dni = '18222333';

-- operador123
UPDATE usuario SET password = '$2b$10$tFK4.91jeN5YpGQc6tKvR.DYlp.MMUhra548jWyYv/dy6UNQ88nQe'
 WHERE dni = '15200548';

-- medico123
UPDATE usuario SET password = '$2b$10$.2IiSA1s0.TA/KGy69ZHfePGMPg3cP63oCKOF5KCXgFVeEBRmhrUa'
 WHERE dni = '20111222';

-- paciente123
UPDATE usuario SET password = '$2b$10$jlPU0OELfT3OUAzkUK8wVei6PE0mrEKe8HgW2MEKellgUNLyj6zV2'
 WHERE dni = '36000960';

-- ---------------------------------------------------------------------------
-- 2. Segundo médico, para poder probar el 403 entre agendas de distintos médicos
-- ---------------------------------------------------------------------------
--
-- El INSERT ... SELECT con WHERE NOT EXISTS hace que correr el script dos veces
-- no duplique la fila (la tabla no tiene UNIQUE en dni que lo impida).
-- La contraseña es medico123, igual que la del otro médico.

INSERT INTO usuario (apellido, nombre, fecha_nacimiento, password, rol, email, telefono, dni, id_sede, id_cobertura)
SELECT 'Ruiz', 'Carlos', '1982-11-05',
       '$2b$10$IqkaAJE7F3hMXNX9BPiAhelyiCgliZAmGqIU5X1rjlgKCyF0QyVIa',
       'medico', 'cruiz@clinica.com', '3424333444', '25333444', 2, NULL
 WHERE NOT EXISTS (SELECT 1 FROM (SELECT 1) AS x WHERE EXISTS (SELECT 1 FROM usuario WHERE dni = '25333444'));

-- Verificación rápida: un hash real ocupa 60 caracteres.
SELECT id, dni, CONCAT(nombre, ' ', apellido) AS usuario, rol, LENGTH(password) AS largo_hash
  FROM usuario
 ORDER BY id;
