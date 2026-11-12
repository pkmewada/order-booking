-- SAP Phase 1: orders, dispatch and delivery move from browser storage to MySQL.
-- Applied only by `php cli/orders-admin.php migrate` (never from a web request).
-- Additive and idempotent: only new tables, all CREATE TABLE IF NOT EXISTS.
-- Business timestamps are UTC, written by PHP.

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
