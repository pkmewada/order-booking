-- Complete fresh-install schema. Import this ONE file using phpMyAdmin.
-- Phone and email format are also validated by the PHP APIs.
CREATE DATABASE IF NOT EXISTS `order-booking` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `order-booking`;

CREATE TABLE IF NOT EXISTS `agents` (
    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `contact` VARCHAR(10) NOT NULL,
    `email` VARCHAR(254) NULL DEFAULT NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_name` (`name`),
    UNIQUE KEY `uniqueEmail` (`email`),
    CONSTRAINT `agentsPhoneCheck` CHECK (`contact` REGEXP '^[6-9][0-9]{9}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `distributors` (
    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `contact` VARCHAR(10) NOT NULL,
    `email` VARCHAR(254) NULL DEFAULT NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_name` (`name`),
    UNIQUE KEY `uniqueEmail` (`email`),
    CONSTRAINT `distributorsPhoneCheck` CHECK (`contact` REGEXP '^[6-9][0-9]{9}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transporters` (
    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `contact` VARCHAR(10) NOT NULL,
    `email` VARCHAR(254) NULL DEFAULT NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_name` (`name`),
    UNIQUE KEY `uniqueEmail` (`email`),
    CONSTRAINT `transportersPhoneCheck` CHECK (`contact` REGEXP '^[6-9][0-9]{9}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customerRecords` (
    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `shopName` VARCHAR(150) NOT NULL,
    `contact` VARCHAR(10) NOT NULL,
    `email` VARCHAR(254) NULL DEFAULT NULL,
    `city` VARCHAR(100) NOT NULL DEFAULT '',
    `state` VARCHAR(100) NOT NULL DEFAULT '',
    `agentId` VARCHAR(64) NULL,
    `transporterId` VARCHAR(64) NULL,
    `distributorId` VARCHAR(64) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_name` (`name`),
    UNIQUE KEY `uniqueEmail` (`email`),
    CONSTRAINT `customerPhoneCheck` CHECK (`contact` REGEXP '^[6-9][0-9]{9}$'),
    CONSTRAINT `customerAgentFk` FOREIGN KEY (`agentId`) REFERENCES `agents` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `customerTransporterFk` FOREIGN KEY (`transporterId`) REFERENCES `transporters` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `customerDistributorFk` FOREIGN KEY (`distributorId`) REFERENCES `distributors` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Manufacturing master tables (schema only; page/API wiring is a separate phase).
CREATE TABLE IF NOT EXISTS `employeeRecords` (
    `id` VARCHAR(64) NOT NULL PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `category` ENUM('cutting', 'stitching', 'ironing') NOT NULL,
    `employeeType` ENUM('housein', 'outsource') NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqueName` (`name`),
    INDEX `categoryType` (`category`, `employeeType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `colourRecords` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqueName` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `additionalWork` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqueName` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `itemList` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqueName` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

