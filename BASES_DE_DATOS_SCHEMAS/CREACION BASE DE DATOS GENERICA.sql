-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema bdgenerica
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema bdgenerica
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `bdgenerica` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci ;
USE `bdgenerica` ;

-- -----------------------------------------------------
-- Table `bdgenerica`.`sede`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`sede` (
  `idSede` INT NOT NULL AUTO_INCREMENT,
  `Nombre` VARCHAR(45) NOT NULL,
  `Direccion` VARCHAR(45) NULL DEFAULT NULL,
  `Localidad` VARCHAR(45) NULL DEFAULT NULL,
  PRIMARY KEY (`idSede`))
ENGINE = InnoDB
AUTO_INCREMENT = 6
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `bdgenerica`.`recurso`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`recurso` (
  `idRecurso` INT NOT NULL AUTO_INCREMENT,
  `Nombre` VARCHAR(45) NOT NULL,
  `Sede_idSede` INT NULL DEFAULT NULL,
  PRIMARY KEY (`idRecurso`),
  INDEX `Sede_idSede` (`Sede_idSede` ASC) VISIBLE,
  CONSTRAINT `recurso_ibfk_1`
    FOREIGN KEY (`Sede_idSede`)
    REFERENCES `bdgenerica`.`sede` (`idSede`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 6
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `bdgenerica`.`recurso_cancha`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`recurso_cancha` (
  `idRecurso_Cancha` INT NOT NULL AUTO_INCREMENT,
  `Nombre` VARCHAR(60) NOT NULL,
  `Numero_Cancha` VARCHAR(60) NULL DEFAULT NULL,
  `Tipo_deporte` VARCHAR(60) NULL DEFAULT NULL,
  `Estado` ENUM('D', 'ND') NULL DEFAULT 'D',
  `Recurso_idRecurso` INT NULL DEFAULT NULL,
  `correo_electronico` VARCHAR(100) NULL DEFAULT NULL,
  PRIMARY KEY (`idRecurso_Cancha`),
  INDEX `Recurso_idRecurso` (`Recurso_idRecurso` ASC) VISIBLE,
  CONSTRAINT `recurso_cancha_ibfk_1`
    FOREIGN KEY (`Recurso_idRecurso`)
    REFERENCES `bdgenerica`.`recurso` (`idRecurso`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 9
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `bdgenerica`.`agenda_cancha`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`agenda_cancha` (
  `idAgendaCancha` INT NOT NULL AUTO_INCREMENT,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NULL DEFAULT NULL,
  `duracion` TIME NULL DEFAULT NULL,
  `hora_inicio` TIME NOT NULL,
  `hora_fin` TIME NOT NULL,
  `disponible` ENUM('D', 'ND') NULL DEFAULT 'ND',
  `dia_semana` TINYINT NULL DEFAULT NULL,
  `recurso_cancha_idRecurso_Cancha` INT NOT NULL,
  PRIMARY KEY (`idAgendaCancha`),
  INDEX `fk_agenda_cancha_recurso_cancha1_idx` (`recurso_cancha_idRecurso_Cancha` ASC) VISIBLE,
  CONSTRAINT `fk_agenda_cancha_recurso_cancha1`
    FOREIGN KEY (`recurso_cancha_idRecurso_Cancha`)
    REFERENCES `bdgenerica`.`recurso_cancha` (`idRecurso_Cancha`))
ENGINE = InnoDB
AUTO_INCREMENT = 10
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `bdgenerica`.`recurso_medico`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`recurso_medico` (
  `idRecurso_Medico` INT NOT NULL AUTO_INCREMENT,
  `Nombre` VARCHAR(60) NOT NULL,
  `Apellido` VARCHAR(60) NULL DEFAULT NULL,
  `Especialidad` VARCHAR(60) NULL DEFAULT NULL,
  `Estado` ENUM('D', 'ND') NULL DEFAULT 'D',
  `Recurso_idRecurso` INT NULL DEFAULT NULL,
  `correo_electronico` VARCHAR(100) NULL DEFAULT NULL,
  PRIMARY KEY (`idRecurso_Medico`),
  INDEX `Recurso_idRecurso` (`Recurso_idRecurso` ASC) VISIBLE,
  CONSTRAINT `recurso_medico_ibfk_1`
    FOREIGN KEY (`Recurso_idRecurso`)
    REFERENCES `bdgenerica`.`recurso` (`idRecurso`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 6
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `bdgenerica`.`agenda_medico`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`agenda_medico` (
  `idAgendaMedico` INT NOT NULL AUTO_INCREMENT,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `duracion` TIME NOT NULL,
  `hora_inicio` TIME NOT NULL,
  `hora_fin` TIME NOT NULL,
  `disponible` ENUM('D', 'ND') NULL DEFAULT 'ND',
  `dia_semana` TINYINT NULL DEFAULT NULL,
  `recurso_medico_idRecurso_Medico` INT NOT NULL,
  PRIMARY KEY (`idAgendaMedico`),
  INDEX `fk_agenda_medico_recurso_medico1_idx` (`recurso_medico_idRecurso_Medico` ASC) VISIBLE,
  CONSTRAINT `fk_agenda_medico_recurso_medico1`
    FOREIGN KEY (`recurso_medico_idRecurso_Medico`)
    REFERENCES `bdgenerica`.`recurso_medico` (`idRecurso_Medico`))
ENGINE = InnoDB
AUTO_INCREMENT = 12
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `bdgenerica`.`cliente`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`cliente` (
  `idCliente` INT NOT NULL AUTO_INCREMENT,
  `Nombre` VARCHAR(45) NOT NULL,
  `Apellido` VARCHAR(45) NOT NULL,
  `DNI` VARCHAR(15) NULL DEFAULT NULL,
  `Telefono` VARCHAR(15) NULL DEFAULT NULL,
  PRIMARY KEY (`idCliente`))
ENGINE = InnoDB
AUTO_INCREMENT = 11
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


-- -----------------------------------------------------
-- Table `bdgenerica`.`reserva`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `bdgenerica`.`reserva` (
  `idReserva` INT NOT NULL AUTO_INCREMENT,
  `Fecha` DATE NOT NULL,
  `expiracion` DATETIME NULL,
  `Hora` TIME NOT NULL,
  `Estado` ENUM('provisional', 'confirmada', 'cancelada') NULL DEFAULT 'provisional',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Cliente_idCliente` INT NULL DEFAULT NULL,
  `Recurso_idRecurso` INT NULL DEFAULT NULL,
  `recurso_medico_idRecurso_Medico` INT NULL DEFAULT NULL,
  `recurso_cancha_idRecurso_Cancha` INT NULL DEFAULT NULL,
  PRIMARY KEY (`idReserva`),
  UNIQUE INDEX `idx_turno_unico` (`Fecha` ASC, `Hora` ASC, `Recurso_idRecurso` ASC) VISIBLE,
  INDEX `Cliente_idCliente` (`Cliente_idCliente` ASC) VISIBLE,
  INDEX `Recurso_idRecurso` (`Recurso_idRecurso` ASC) VISIBLE,
  INDEX `fk_reserva_recurso_medico1_idx` (`recurso_medico_idRecurso_Medico` ASC) VISIBLE,
  INDEX `fk_reserva_recurso_cancha1_idx` (`recurso_cancha_idRecurso_Cancha` ASC) VISIBLE,
  CONSTRAINT `fk_reserva_recurso_cancha1`
    FOREIGN KEY (`recurso_cancha_idRecurso_Cancha`)
    REFERENCES `bdgenerica`.`recurso_cancha` (`idRecurso_Cancha`),
  CONSTRAINT `fk_reserva_recurso_medico1`
    FOREIGN KEY (`recurso_medico_idRecurso_Medico`)
    REFERENCES `bdgenerica`.`recurso_medico` (`idRecurso_Medico`),
  CONSTRAINT `reserva_ibfk_1`
    FOREIGN KEY (`Cliente_idCliente`)
    REFERENCES `bdgenerica`.`cliente` (`idCliente`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `reserva_ibfk_2`
    FOREIGN KEY (`Recurso_idRecurso`)
    REFERENCES `bdgenerica`.`recurso` (`idRecurso`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 35
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;


CREATE EVENT limpiar_reservas_provisionales
ON SCHEDULE EVERY 1 MINUTE
DO
  DELETE FROM reserva
  WHERE Estado = 'provisional'
  AND expiracion <= NOW();
  

SHOW EVENTS FROM bdgenerica;