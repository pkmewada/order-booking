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
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `nameIndex` (`name`),
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
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `nameIndex` (`name`),
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
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `nameIndex` (`name`),
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
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `nameIndex` (`name`),
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
    `itemType` ENUM('Cutting','Non-Cutting') NULL DEFAULT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqueName` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pieceItemList` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `photo` VARCHAR(255) NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniqueName` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `pieceItemList` (`name`) VALUES
    ('Shirt'), ('Jeans'), ('Jacket'), ('Cap'), ('Frock'), ('Pant'), ('Tie');

CREATE TABLE IF NOT EXISTS `patternRecords` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `pieceCount` TINYINT UNSIGNED NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `patternRecordsUniqueName` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `patternPieceLinks` (
    `patternId` INT UNSIGNED NOT NULL,
    `pieceNumber` TINYINT UNSIGNED NOT NULL,
    `pieceItemId` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`patternId`, `pieceNumber`),
    UNIQUE KEY `patternPieceLinksUniqueItem` (`patternId`, `pieceItemId`),
    CONSTRAINT `patternPieceLinksPatternFk` FOREIGN KEY (`patternId`) REFERENCES `patternRecords` (`id`) ON DELETE CASCADE,
    CONSTRAINT `patternPieceLinksItemFk` FOREIGN KEY (`pieceItemId`) REFERENCES `pieceItemList` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
 stage ENUM('Before Cutting','After Cutting','After Stitching','After Ironing') NOT NULL,
 PRIMARY KEY(productId, pieceNumber, workId, stage),
 FOREIGN KEY(productId) REFERENCES productRecords(id) ON DELETE CASCADE,
 FOREIGN KEY(workId) REFERENCES additionalWork(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Ordered work instances define the BOM route. After Cutting can have up to five
-- parallel branches that converge at Stitching. After Stitching and After Ironing
-- each allow one sequential work step. Repeated catalog work IDs remain distinct.
CREATE TABLE IF NOT EXISTS productWorkSteps (
 productId BIGINT UNSIGNED NOT NULL,
 pieceNumber TINYINT UNSIGNED NOT NULL,
 workOrder SMALLINT UNSIGNED NOT NULL,
 workId INT UNSIGNED NOT NULL,
 stage ENUM('Before Cutting','After Cutting','After Stitching','After Ironing') NOT NULL,
 PRIMARY KEY(productId, pieceNumber, workOrder),
 KEY productWorkStepsWorkIdx(workId),
 KEY productWorkStepsStageOrderIdx(productId, pieceNumber, stage, workOrder),
 FOREIGN KEY(productId) REFERENCES productRecords(id) ON DELETE CASCADE,
 FOREIGN KEY(workId) REFERENCES additionalWork(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Additive schema updates for existing installs re-importing this file.
ALTER TABLE `itemList`
    ADD COLUMN IF NOT EXISTS `itemType` ENUM('Cutting','Non-Cutting') NULL DEFAULT NULL AFTER `name`;

ALTER TABLE `pieceItemList`
    ADD COLUMN IF NOT EXISTS `photo` VARCHAR(255) NULL AFTER `name`;

ALTER TABLE `productWorkSteps`
    ADD INDEX IF NOT EXISTS `productWorkStepsStageOrderIdx` (`productId`, `pieceNumber`, `stage`, `workOrder`);

-- SAP Phase 1: orders, dispatch and delivery (same DDL as database/cli-migrations/20261112_001_customer-orders.sql).
-- After importing this file, run `php cli/orders-admin.php migrate` to verify and record the schema;
-- the order APIs stay disabled (503) until then.

CREATE TABLE IF NOT EXISTS `customerOrders` (
    `id` VARCHAR(40) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
    `customerId` VARCHAR(64) NOT NULL DEFAULT '',
    `customerName` VARCHAR(150) NOT NULL DEFAULT '',
    `shopName` VARCHAR(150) NOT NULL DEFAULT '',
    `city` VARCHAR(100) NOT NULL DEFAULT '',
    `contact` VARCHAR(40) NOT NULL DEFAULT '',
    `existingCustomer` VARCHAR(10) NOT NULL DEFAULT '',
    `agentId` VARCHAR(64) NULL,
    `agentName` VARCHAR(150) NOT NULL DEFAULT '',
    `transporterId` VARCHAR(64) NULL,
    `transportName` VARCHAR(150) NOT NULL DEFAULT '',
    `distributorId` VARCHAR(64) NULL,
    `orderTakenBy` VARCHAR(150) NULL,
    `deliveryDate` DATE NULL,
    `totalSets` INT UNSIGNED NOT NULL DEFAULT 0,
    `totalPcs` INT UNSIGNED NOT NULL DEFAULT 0,
    `dispatchPassedAt` DATETIME(3) NULL,
    `dispatchStatus` VARCHAR(20) NULL,
    `dispatchConfirmedAt` DATETIME(3) NULL,
    `dispatchCompletedAt` DATETIME(3) NULL,
    `dispatchConfirmedItems` TEXT NULL,
    `deliveredAt` DATETIME(3) NULL,
    `deliveryStatus` VARCHAR(20) NULL,
    `version` INT UNSIGNED NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NULL,
    `legacyData` LONGTEXT NULL,
    `legacyHash` CHAR(64) NULL,
    `importedAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`),
    KEY `customerOrdersCreatedIdx` (`createdAt`),
    KEY `customerOrdersDispatchIdx` (`dispatchPassedAt`),
    KEY `customerOrdersCustomerIdx` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customerOrderItems` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(40) NOT NULL,
    `sortOrder` INT UNSIGNED NOT NULL,
    `barcode` VARCHAR(150) NOT NULL DEFAULT '',
    `description` VARCHAR(255) NOT NULL DEFAULT '',
    `designNumber` VARCHAR(100) NULL,
    `brand` VARCHAR(100) NOT NULL DEFAULT '',
    `size` VARCHAR(50) NOT NULL DEFAULT '',
    `color` VARCHAR(150) NULL,
    `piecesPerSet` INT UNSIGNED NOT NULL DEFAULT 1,
    `qty` INT UNSIGNED NOT NULL DEFAULT 0,
    `dispatchScannedPieces` INT UNSIGNED NOT NULL DEFAULT 0,
    `dispatchDeliveredPieces` INT UNSIGNED NOT NULL DEFAULT 0,
    `dispatchChecked` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `customerOrderItemsOrderIdx` (`orderId`, `sortOrder`),
    CONSTRAINT `customerOrderItemsOrderFk` FOREIGN KEY (`orderId`) REFERENCES `customerOrders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `deliveryBatches` (
    `id` VARCHAR(80) NOT NULL,
    `orderId` VARCHAR(40) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'In Progress',
    `createdAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `isLegacy` TINYINT(1) NOT NULL DEFAULT 0,
    `pdfState` VARCHAR(10) NOT NULL DEFAULT 'none',
    `pdfFile` VARCHAR(64) NULL,
    `pdfName` VARCHAR(150) NULL,
    `pdfSize` INT UNSIGNED NULL,
    `pdfSha256` CHAR(64) NULL,
    `pdfUploadedAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `deliveryBatchesPdfFileUnique` (`pdfFile`),
    KEY `deliveryBatchesOrderIdx` (`orderId`),
    CONSTRAINT `deliveryBatchesOrderFk` FOREIGN KEY (`orderId`) REFERENCES `customerOrders` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `deliveryBatchItems` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `batchId` VARCHAR(80) NOT NULL,
    `orderItemId` BIGINT UNSIGNED NULL,
    `sortOrder` INT UNSIGNED NOT NULL,
    `barcode` VARCHAR(150) NOT NULL DEFAULT '',
    `description` VARCHAR(255) NOT NULL DEFAULT '',
    `designNumber` VARCHAR(100) NULL,
    `brand` VARCHAR(100) NOT NULL DEFAULT '',
    `size` VARCHAR(50) NOT NULL DEFAULT '',
    `color` VARCHAR(150) NULL,
    `piecesPerSet` INT UNSIGNED NOT NULL DEFAULT 1,
    `sets` DECIMAL(12,4) NOT NULL DEFAULT 0,
    `pieces` INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `deliveryBatchItemsBatchIdx` (`batchId`, `sortOrder`),
    CONSTRAINT `deliveryBatchItemsBatchFk` FOREIGN KEY (`batchId`) REFERENCES `deliveryBatches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
