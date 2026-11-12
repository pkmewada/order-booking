-- Phase 2: login accounts (authentication). There was no user table before.
-- Applied only by `php cli/orders-admin.php migrate` (never from a web request).
-- Additive and idempotent: one new table, CREATE TABLE IF NOT EXISTS.
-- Accounts are created with `php cli/users-admin.php create ...` or the admin Users page; no default user exists.
-- Roles: admin (everything) and employee (Order Booking and Manufacturing; see includes/auth.php AUTH_API_RULES).

CREATE TABLE IF NOT EXISTS `appUsers` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `displayName` VARCHAR(150) NOT NULL DEFAULT '',
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `authVersion` INT UNSIGNED NOT NULL DEFAULT 1,
    `failedLogins` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME NULL,
    `lastLoginAt` DATETIME NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `appUsersUsername` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
