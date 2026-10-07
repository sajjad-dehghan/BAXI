-- Local demo user: no global, event-scheduler or schema-creation permissions.
GRANT SELECT, INSERT, UPDATE, DELETE ON baxi_users.* TO 'baxi'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON baxi_staff.* TO 'baxi'@'%';
