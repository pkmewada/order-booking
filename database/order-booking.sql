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

CREATE TABLE IF NOT EXISTS `pieceItemList` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqueName` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `pieceItemList` (`name`) VALUES
    ('Shirt'), ('Jeans'), ('Jacket'), ('Cap'), ('Frock');

-- Production and manufacturing workflow state, migrated from browser storage on first visit.
CREATE TABLE IF NOT EXISTS `manufacturingStateMeta` (
    `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    `revision` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `initialized` BOOLEAN NOT NULL DEFAULT FALSE,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `manufacturingStateMetaSingleRow` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `manufacturingStateMeta` (`id`, `revision`, `initialized`) VALUES (1, 0, FALSE);

CREATE TABLE IF NOT EXISTS `manufacturingState` (
    `stateKey` VARCHAR(100) NOT NULL PRIMARY KEY,
    `stateData` LONGTEXT NOT NULL,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `manufacturingStateJsonCheck` CHECK (JSON_VALID(`stateData`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Shared BOM Master / Product Creation record.
CREATE TABLE IF NOT EXISTS productRecords (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 brand VARCHAR(100) NOT NULL,
 designNumber BIGINT UNSIGNED NOT NULL,
 colourId INT UNSIGNED NOT NULL,
 pattern VARCHAR(150) NOT NULL DEFAULT '',
 mrp DECIMAL(12,2) NULL,
 photo VARCHAR(255) NULL,
 pieces LONGTEXT NOT NULL,
 pieceCount TINYINT UNSIGNED NOT NULL DEFAULT 1,
 createdFrom ENUM('bom','product') NOT NULL,
 inProductList BOOLEAN NOT NULL DEFAULT FALSE,
 bomCompleted BOOLEAN NOT NULL DEFAULT FALSE,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uniqueDesign (designNumber),
 CONSTRAINT productColourFk FOREIGN KEY (colourId) REFERENCES colourRecords(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS productItemLinks (
 productId BIGINT UNSIGNED NOT NULL,
 pieceNumber TINYINT UNSIGNED NOT NULL,
 itemId INT UNSIGNED NOT NULL,
 role ENUM('piece','material') NOT NULL,
 PRIMARY KEY(productId, pieceNumber, itemId, role),
 FOREIGN KEY(productId) REFERENCES productRecords(id) ON DELETE CASCADE,
 FOREIGN KEY(itemId) REFERENCES itemList(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS productWorkLinks (
 productId BIGINT UNSIGNED NOT NULL,
 pieceNumber TINYINT UNSIGNED NOT NULL,
 workId INT UNSIGNED NOT NULL,
 stage ENUM('Before Cutting','After Cutting','After Stitching') NOT NULL,
 PRIMARY KEY(productId, pieceNumber, workId, stage),
 FOREIGN KEY(productId) REFERENCES productRecords(id) ON DELETE CASCADE,
 FOREIGN KEY(workId) REFERENCES additionalWork(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
