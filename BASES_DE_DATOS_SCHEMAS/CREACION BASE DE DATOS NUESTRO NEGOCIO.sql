-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema nuestro_negocio2
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema nuestro_negocio2
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `nuestro_negocio2` DEFAULT CHARACTER SET utf8mb3 ;
USE `nuestro_negocio2` ;

-- -----------------------------------------------------
-- Table `nuestro_negocio2`.`cliente`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nuestro_negocio2`.`cliente` (
  `idCliente` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(45) NOT NULL,
  `apellido` VARCHAR(45) NOT NULL,
  `fecha_alta` DATE NOT NULL,
  `fecha_baja` DATE NULL DEFAULT NULL,
  `direccion` VARCHAR(100) NULL DEFAULT NULL,
  `telefono` VARCHAR(45) NULL DEFAULT NULL,
  `tipo` ENUM('medico', 'cancha') NOT NULL,
  `correo_electronico` VARCHAR(100) NULL DEFAULT NULL,
  `contrasena` VARCHAR(100) NULL DEFAULT NULL,
  PRIMARY KEY (`idCliente`))
ENGINE = InnoDB
AUTO_INCREMENT = 3
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `nuestro_negocio2`.`servicio`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nuestro_negocio2`.`servicio` (
  `idServicio` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(45) NOT NULL,
  `precio` DECIMAL(10,2) NOT NULL,
  `descripcion` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`idServicio`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `nuestro_negocio2`.`servicio_contratado`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nuestro_negocio2`.`servicio_contratado` (
  `cliente_id` INT NOT NULL,
  `servicio_id` INT NOT NULL,
  PRIMARY KEY (`cliente_id`, `servicio_id`),
  INDEX `servicio_id_idx` (`servicio_id` ASC) VISIBLE,
  CONSTRAINT `servicio_contratado_ibfk_1`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `nuestro_negocio2`.`cliente` (`idCliente`),
  CONSTRAINT `servicio_contratado_ibfk_2`
    FOREIGN KEY (`servicio_id`)
    REFERENCES `nuestro_negocio2`.`servicio` (`idServicio`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `nuestro_negocio2`.`pago`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `nuestro_negocio2`.`pago` (
  `idPago` INT NOT NULL AUTO_INCREMENT,
  `monto` DECIMAL(10,2) NOT NULL,
  `fecha_pago` DATE NOT NULL,
  `tipo_pago` VARCHAR(45) NOT NULL,
  `servicio_contratado_cliente_id` INT NOT NULL,
  `servicio_contratado_servicio_id` INT NOT NULL,
  PRIMARY KEY (`idPago`),
  INDEX `fk_pago_servicio_contratado_idx` (`servicio_contratado_cliente_id` ASC, `servicio_contratado_servicio_id` ASC) VISIBLE,
  CONSTRAINT `pago_ibfk_1`
    FOREIGN KEY (`servicio_contratado_cliente_id` , `servicio_contratado_servicio_id`)
    REFERENCES `nuestro_negocio2`.`servicio_contratado` (`cliente_id` , `servicio_id`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb3;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
