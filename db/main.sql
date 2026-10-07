-- BAXI educational demo. MySQL 8.4 / InnoDB / utf8mb4. Money: integer IRR.
-- Initialize once on an EMPTY LOCAL database; not a legacy-server migration.
CREATE DATABASE baxi_staff CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE baxi_users CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE baxi_staff;
CREATE TABLE employees (
 personnel_code INT PRIMARY KEY AUTO_INCREMENT, shaba_number CHAR(26) NOT NULL UNIQUE,
 signup_time DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), password VARCHAR(255) NOT NULL,
 first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL, birth_date DATE NOT NULL,
 salary BIGINT NOT NULL CHECK(salary>=0),
 department ENUM('marketing','accounting','finance','HR','support','development') NOT NULL,
 proficiency ENUM('basic','intermediate','advanced','proficient','expert') NOT NULL,
 education VARCHAR(50) NOT NULL DEFAULT 'none',
 position ENUM('department manager','basic employee','programmer') NOT NULL,
 profile_picture_path VARCHAR(512)
) ENGINE=InnoDB;
CREATE VIEW managers AS SELECT personnel_code, first_name, last_name, department FROM employees WHERE position='department manager';
USE baxi_users;
CREATE TABLE clients (
 id INT PRIMARY KEY AUTO_INCREMENT, phone_number CHAR(10) NOT NULL UNIQUE,
 wallet_balance BIGINT NOT NULL DEFAULT 0 CHECK(wallet_balance>=0),
 signup_time DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL, birth_date DATE NOT NULL,
 sex ENUM('M','F') NOT NULL, email VARCHAR(254)
) ENGINE=InnoDB;
CREATE TABLE drivers (
 id INT PRIMARY KEY AUTO_INCREMENT, phone_number CHAR(10) NOT NULL UNIQUE,
 shaba_number CHAR(26) NOT NULL UNIQUE, referral_code CHAR(10) NOT NULL UNIQUE,
 wallet_balance BIGINT NOT NULL DEFAULT 0 CHECK(wallet_balance>=0),
 signup_time DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), disability VARCHAR(100) NOT NULL DEFAULT 'none',
 first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL, birth_date DATE NOT NULL,
 national_code CHAR(10) NOT NULL, license_photo_path VARCHAR(512) NOT NULL, national_card_photo_path VARCHAR(512) NOT NULL,
 sex ENUM('M','F') NOT NULL, license_verification_date DATE, judicial_letter_path VARCHAR(512),
 judicial_letter_verification_date DATE, final_verification_date DATE,
 verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', rejection_reason VARCHAR(500),
 latitude DOUBLE CHECK(latitude BETWEEN -90 AND 90), longitude DOUBLE CHECK(longitude BETWEEN -180 AND 180),
 profile_picture_path VARCHAR(512), verifier_personnel_code INT,
 FOREIGN KEY(verifier_personnel_code) REFERENCES baxi_staff.employees(personnel_code),
 INDEX driver_verification(verification_status)
) ENGINE=InnoDB;
CREATE TABLE baxi (
 driver_id INT PRIMARY KEY, vehicle_license_plate VARCHAR(20) NOT NULL UNIQUE,
 vehicle_capacity INT NOT NULL CHECK(vehicle_capacity>0), vehicle_color VARCHAR(50) NOT NULL,
 vehicle_name VARCHAR(50) NOT NULL, vehicle_production_date DATE NOT NULL,
 vehicle_card_photo VARCHAR(512) NOT NULL, vehicle_fuel_type ENUM('gasoline','CNG','dual','electricity') NOT NULL,
 FOREIGN KEY(driver_id) REFERENCES drivers(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE baxi_baar LIKE baxi;
ALTER TABLE baxi_baar ADD FOREIGN KEY(driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
CREATE TABLE baxi_box LIKE baxi;
ALTER TABLE baxi_box ADD FOREIGN KEY(driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
CREATE TABLE service_requests (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, client_id INT NOT NULL,
 request_time DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 service_type ENUM('baxi','women','box','baar') NOT NULL,
 state ENUM('requested','accepted','in_progress','completed','cancelled') NOT NULL DEFAULT 'requested',
 assigned_driver_id INT, pickup_latitude DOUBLE NOT NULL CHECK(pickup_latitude BETWEEN -90 AND 90),
 pickup_longitude DOUBLE NOT NULL CHECK(pickup_longitude BETWEEN -180 AND 180),
 pickup_province VARCHAR(100) NOT NULL, pickup_city VARCHAR(100) NOT NULL,
 accepted_at DATETIME(6), started_at DATETIME(6), completed_at DATETIME(6),
 FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(assigned_driver_id) REFERENCES drivers(id),
 INDEX available_requests(state,service_type), INDEX client_history(client_id,request_time),
 INDEX driver_history(assigned_driver_id,request_time)
) ENGINE=InnoDB;
CREATE TABLE baxi_trips (
 request_id BIGINT PRIMARY KEY, cost BIGINT NOT NULL CHECK(cost>=0), round_trip BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE heavy_transports (
 request_id BIGINT PRIMARY KEY, cost BIGINT NOT NULL CHECK(cost>=0),
 cargo_weight INT NOT NULL CHECK(cargo_weight>0), cargo_value BIGINT NOT NULL CHECK(cargo_value>=0),
 dropoff_latitude DOUBLE NOT NULL CHECK(dropoff_latitude BETWEEN -90 AND 90),
 dropoff_longitude DOUBLE NOT NULL CHECK(dropoff_longitude BETWEEN -180 AND 180), dropoff_city VARCHAR(100) NOT NULL,
 cargo_type ENUM('unfragile','fragile') NOT NULL, client_helped BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE light_transports (
 request_id BIGINT PRIMARY KEY, cost BIGINT NOT NULL CHECK(cost>=0),
 cargo_weight INT NOT NULL CHECK(cargo_weight>0), cargo_value BIGINT NOT NULL CHECK(cargo_value>=0),
 dropoff_latitude DOUBLE NOT NULL CHECK(dropoff_latitude BETWEEN -90 AND 90),
 dropoff_longitude DOUBLE NOT NULL CHECK(dropoff_longitude BETWEEN -180 AND 180), dropoff_city VARCHAR(100) NOT NULL,
 cargo_type ENUM('unfragile','fragile') NOT NULL, insurance_cost BIGINT NOT NULL CHECK(insurance_cost>=0),
 FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE destinations (
 request_id BIGINT NOT NULL, stop_number INT NOT NULL DEFAULT 1 CHECK(stop_number>0),
 latitude DOUBLE NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude DOUBLE NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 city VARCHAR(100) NOT NULL, PRIMARY KEY(request_id,stop_number),
 FOREIGN KEY(request_id) REFERENCES service_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE transactions (
 tracking_code CHAR(32) PRIMARY KEY, time DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 shaba_number CHAR(26) NOT NULL, amount BIGINT NOT NULL CHECK(amount>0),
 state ENUM('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
 type ENUM('card-to-wallet','wallet-to-card') NOT NULL
) ENGINE=InnoDB;
CREATE TABLE deposits (
 tracking_code CHAR(32) PRIMARY KEY, client_id INT NOT NULL,
 FOREIGN KEY(tracking_code) REFERENCES transactions(tracking_code), FOREIGN KEY(client_id) REFERENCES clients(id)
) ENGINE=InnoDB;
CREATE TABLE withdrawals (
 tracking_code CHAR(32) PRIMARY KEY, driver_id INT NOT NULL, type ENUM('daily','momentary') NOT NULL DEFAULT 'momentary',
 FOREIGN KEY(tracking_code) REFERENCES transactions(tracking_code), FOREIGN KEY(driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB;
CREATE TABLE service_acceptances (
 request_id BIGINT PRIMARY KEY, driver_id INT NOT NULL, end_time DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 estimated_end_time DATETIME(6) NOT NULL, method_of_payment ENUM('cash','wallet-to-wallet') NOT NULL,
 wait_time INT NOT NULL DEFAULT 0 CHECK(wait_time>=0),
 driver_rating TINYINT CHECK(driver_rating BETWEEN 0 AND 5), client_rating TINYINT CHECK(client_rating BETWEEN 0 AND 5),
 FOREIGN KEY(request_id) REFERENCES service_requests(id), FOREIGN KEY(driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB;
CREATE TABLE referrals (
 referred_id INT PRIMARY KEY, referrer_id INT NOT NULL, CHECK(referrer_id<>referred_id),
 FOREIGN KEY(referrer_id) REFERENCES drivers(id), FOREIGN KEY(referred_id) REFERENCES drivers(id)
) ENGINE=InnoDB;
CREATE TABLE reports (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, client_id INT NOT NULL, driver_id INT NOT NULL,
 description VARCHAR(500) NOT NULL,
 state ENUM('pending','under investigation','dismissed','driver deactivated','client deactivated') NOT NULL DEFAULT 'pending',
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB;
CREATE TABLE addresses (
 client_id INT NOT NULL, address_name VARCHAR(100) NOT NULL,
 latitude DOUBLE NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude DOUBLE NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 PRIMARY KEY(client_id,address_name), FOREIGN KEY(client_id) REFERENCES clients(id)
) ENGINE=InnoDB;
CREATE TABLE compliments (
 request_id BIGINT NOT NULL, point VARCHAR(100) NOT NULL, PRIMARY KEY(request_id,point),
 FOREIGN KEY(request_id) REFERENCES service_acceptances(request_id)
) ENGINE=InnoDB;
CREATE TABLE complaints LIKE compliments;
ALTER TABLE complaints ADD FOREIGN KEY(request_id) REFERENCES service_acceptances(request_id);
CREATE TABLE company_deposits (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, employee_personnel_code INT NOT NULL, driver_id INT NOT NULL,
 amount BIGINT NOT NULL CHECK(amount>0), time DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), type ENUM('reward','fuel quota') NOT NULL,
 FOREIGN KEY(employee_personnel_code) REFERENCES baxi_staff.employees(personnel_code), FOREIGN KEY(driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB;
CREATE TABLE compensatory_deposits (
 tracking_code CHAR(32) PRIMARY KEY, driver_id INT NOT NULL,
 FOREIGN KEY(tracking_code) REFERENCES transactions(tracking_code), FOREIGN KEY(driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB;
CREATE TABLE monthly_incomes (
 driver_id INT NOT NULL, month DATE NOT NULL, gross_income BIGINT NOT NULL CHECK(gross_income>=0), net_income BIGINT NOT NULL CHECK(net_income>=0),
 PRIMARY KEY(driver_id,month), FOREIGN KEY(driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB;
CREATE VIEW trip_costs AS SELECT request_id,cost FROM baxi_trips
 UNION ALL SELECT request_id,cost FROM heavy_transports UNION ALL SELECT request_id,cost FROM light_transports;
CREATE VIEW female_drivers AS SELECT id,first_name,last_name FROM drivers WHERE sex='F' AND verification_status='approved';
CREATE VIEW male_drivers AS SELECT id,first_name,last_name FROM drivers WHERE sex='M' AND verification_status='approved';
CREATE VIEW baar_drivers AS SELECT d.id,d.first_name,d.last_name,b.vehicle_name FROM drivers d JOIN baxi_baar b ON b.driver_id=d.id;
CREATE VIEW box_drivers AS SELECT d.id,d.first_name,d.last_name,b.vehicle_name FROM drivers d JOIN baxi_box b ON b.driver_id=d.id;
DELIMITER //
CREATE TRIGGER client_age_check BEFORE INSERT ON clients FOR EACH ROW
BEGIN
 IF TIMESTAMPDIFF(YEAR,NEW.birth_date,CURDATE())<15 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Clients must be at least 15'; END IF;
END//
CREATE TRIGGER driver_age_check BEFORE INSERT ON drivers FOR EACH ROW
BEGIN
 IF TIMESTAMPDIFF(YEAR,NEW.birth_date,CURDATE())<18 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Drivers must be at least 18'; END IF;
END//
CREATE TRIGGER update_wallets AFTER INSERT ON service_acceptances FOR EACH ROW
BEGIN
 DECLARE fare BIGINT; DECLARE customer INT;
 SELECT c.cost,r.client_id INTO fare,customer FROM trip_costs c JOIN service_requests r ON r.id=c.request_id WHERE c.request_id=NEW.request_id;
 IF NEW.method_of_payment='wallet-to-wallet' THEN
  UPDATE clients SET wallet_balance=wallet_balance-fare WHERE id=customer;
  UPDATE drivers SET wallet_balance=wallet_balance+FLOOR(fare*0.8) WHERE id=NEW.driver_id;
 ELSE
  UPDATE drivers SET wallet_balance=wallet_balance-(fare-FLOOR(fare*0.8)) WHERE id=NEW.driver_id;
 END IF;
END//
CREATE TRIGGER commit_deposit BEFORE INSERT ON deposits FOR EACH ROW
BEGIN
 DECLARE money BIGINT; DECLARE tx_state VARCHAR(20); DECLARE tx_type VARCHAR(20);
 SELECT amount,state,type INTO money,tx_state,tx_type FROM transactions WHERE tracking_code=NEW.tracking_code;
 IF tx_state<>'completed' OR tx_type<>'card-to-wallet' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only completed incoming transactions can be posted'; END IF;
 UPDATE clients SET wallet_balance=wallet_balance+money WHERE id=NEW.client_id;
END//
CREATE TRIGGER commit_withdrawal BEFORE INSERT ON withdrawals FOR EACH ROW
BEGIN
 DECLARE money BIGINT; DECLARE tx_state VARCHAR(20); DECLARE tx_type VARCHAR(20);
 SELECT amount,state,type INTO money,tx_state,tx_type FROM transactions WHERE tracking_code=NEW.tracking_code;
 IF tx_state<>'completed' OR tx_type<>'wallet-to-card' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only completed outgoing transactions can be posted'; END IF;
 UPDATE drivers SET wallet_balance=wallet_balance-money WHERE id=NEW.driver_id;
END//
CREATE TRIGGER immutable_completed_transaction BEFORE UPDATE ON transactions FOR EACH ROW
BEGIN
 IF OLD.state='completed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Completed transactions are immutable'; END IF;
END//
CREATE TRIGGER commit_company_deposit AFTER INSERT ON company_deposits FOR EACH ROW
BEGIN
 UPDATE drivers SET wallet_balance=wallet_balance+NEW.amount WHERE id=NEW.driver_id;
END//
CREATE TRIGGER commit_referral_bonus AFTER INSERT ON referrals FOR EACH ROW
BEGIN
 UPDATE drivers SET wallet_balance=wallet_balance+50000 WHERE id=NEW.referred_id;
END//
CREATE TRIGGER commit_compensatory_deposit BEFORE INSERT ON compensatory_deposits FOR EACH ROW
BEGIN
 DECLARE money BIGINT; DECLARE tx_state VARCHAR(20); DECLARE tx_type VARCHAR(20);
 SELECT amount,state,type INTO money,tx_state,tx_type FROM transactions WHERE tracking_code=NEW.tracking_code;
 IF tx_state<>'completed' OR tx_type<>'card-to-wallet' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Compensation requires a completed incoming transaction'; END IF;
 UPDATE drivers SET wallet_balance=wallet_balance+money WHERE id=NEW.driver_id;
END//
DELIMITER ;
