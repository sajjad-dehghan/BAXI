-- Additive upgrade from the first PWA demo. Completed receipts remain unchanged.
USE baxi_users;
SET @change = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='baxi_users' AND table_name='service_requests' AND column_name='preferred_payment')=0,
 'ALTER TABLE service_requests ADD preferred_payment ENUM("wallet-to-wallet","cash") NULL', 'SELECT 1');
PREPARE upgrade_stmt FROM @change; EXECUTE upgrade_stmt; DEALLOCATE PREPARE upgrade_stmt;
SET @change = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='baxi_users' AND table_name='service_requests' AND column_name='pickup_label')=0,
 'ALTER TABLE service_requests ADD pickup_label VARCHAR(240) NULL', 'SELECT 1');
PREPARE upgrade_stmt FROM @change; EXECUTE upgrade_stmt; DEALLOCATE PREPARE upgrade_stmt;
SET @change = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='baxi_users' AND table_name='service_requests' AND column_name='dropoff_label')=0,
 'ALTER TABLE service_requests ADD dropoff_label VARCHAR(240) NULL', 'SELECT 1');
PREPARE upgrade_stmt FROM @change; EXECUTE upgrade_stmt; DEALLOCATE PREPARE upgrade_stmt;
