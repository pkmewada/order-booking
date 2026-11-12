-- LOCAL / TEST ONLY. Production is forward-only: never run this on a live database.
-- `php cli/orders-admin.php down` refuses unless the database name ends in _test on a local host.
DROP TABLE IF EXISTS `appUsers`;
DELETE FROM `appSchemaMigrations` WHERE `migration` = 'cli/20261112_002_app-users.sql';
