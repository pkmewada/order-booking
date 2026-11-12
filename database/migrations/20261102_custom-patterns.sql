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
