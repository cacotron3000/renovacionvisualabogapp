-- =============================================================================
-- Esquema MySQL/MariaDB — Generador de Escritos (plantillas en servidor)
-- Compatible con cPanel (MySQL 5.7+ / MariaDB 10.2+)
-- =============================================================================
-- Uso:
--   1) En cPanel → MySQL Databases: crear una base de datos (ej. `cpuser_escritos`)
--      y un usuario con contraseña; asignar al usuario TODOS los privilegios
--      sobre esa base.
--   2) En cPanel → phpMyAdmin: seleccionar la base y usar la pestaña "Importar"
--      para cargar este archivo, o pegar el contenido en la pestaña "SQL".
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -----------------------------------------------------------------------------
-- Plantillas de causa (encabezado completo del escrito)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantillas (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid            CHAR(36)     NOT NULL,
  nombre          VARCHAR(255) NOT NULL,
  encabezado_json MEDIUMTEXT   NOT NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  eliminado_en    DATETIME(3)  NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plantillas_uuid (uuid),
  KEY ix_plantillas_actualizado (actualizado_en),
  KEY ix_plantillas_eliminado   (eliminado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Biblioteca de otrosíes (título + contenido reutilizables)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otrosies_biblioteca (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid            CHAR(36)     NOT NULL,
  titulo          VARCHAR(255) NOT NULL,
  contenido       MEDIUMTEXT   NOT NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  eliminado_en    DATETIME(3)  NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_otrosies_uuid (uuid),
  KEY ix_otrosies_actualizado (actualizado_en),
  KEY ix_otrosies_eliminado   (eliminado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
