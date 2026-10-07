-- Back up both schemas first. Additive, repeatable upgrade; no historical repricing.
USE baxi_users;
CREATE TABLE IF NOT EXISTS pricing_policies (
 version VARCHAR(64) PRIMARY KEY,
 fingerprint CHAR(64) NOT NULL,
 policy JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))
);
CREATE TABLE IF NOT EXISTS fare_quotes (
 id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 client_id INT NOT NULL,
 policy_version VARCHAR(64) NOT NULL,
 draft JSON NOT NULL,
 price JSON NOT NULL,
 expires_at DATETIME(6) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
 FOREIGN KEY(client_id) REFERENCES clients(id),
 FOREIGN KEY(policy_version) REFERENCES pricing_policies(version),
 INDEX quote_expiry(expires_at)
);
CREATE TABLE IF NOT EXISTS trip_pricing (
 request_id BIGINT PRIMARY KEY,
 quote_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 policy_version VARCHAR(64) NOT NULL,
 breakdown JSON NOT NULL,
 cost BIGINT NOT NULL CHECK(cost>=0),
 commission_irr BIGINT NOT NULL CHECK(commission_irr>=0),
 driver_net_irr BIGINT NOT NULL CHECK(driver_net_irr>=0),
 commission_bps INT NOT NULL CHECK(commission_bps BETWEEN 0 AND 10000),
 CHECK(cost=commission_irr+driver_net_irr),
 FOREIGN KEY(request_id) REFERENCES service_requests(id),
 FOREIGN KEY(quote_id) REFERENCES fare_quotes(id),
 FOREIGN KEY(policy_version) REFERENCES pricing_policies(version)
);
CREATE OR REPLACE VIEW trip_costs AS
 SELECT t.request_id,COALESCE(p.cost,t.cost) AS cost FROM baxi_trips t LEFT JOIN trip_pricing p ON p.request_id=t.request_id
 UNION ALL SELECT t.request_id,COALESCE(p.cost,t.cost) FROM heavy_transports t LEFT JOIN trip_pricing p ON p.request_id=t.request_id
 UNION ALL SELECT t.request_id,COALESCE(p.cost,t.cost) FROM light_transports t LEFT JOIN trip_pricing p ON p.request_id=t.request_id;
DELIMITER //
DROP TRIGGER IF EXISTS immutable_trip_pricing//
CREATE TRIGGER immutable_trip_pricing BEFORE UPDATE ON trip_pricing FOR EACH ROW
BEGIN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booked pricing is immutable';
END//
DROP TRIGGER IF EXISTS update_wallets//
CREATE TRIGGER update_wallets AFTER INSERT ON service_acceptances FOR EACH ROW
BEGIN
 DECLARE fare BIGINT; DECLARE customer INT; DECLARE net BIGINT;
 SELECT c.cost,r.client_id,COALESCE(p.driver_net_irr,FLOOR(c.cost*0.8)) INTO fare,customer,net
 FROM trip_costs c JOIN service_requests r ON r.id=c.request_id
 LEFT JOIN trip_pricing p ON p.request_id=c.request_id WHERE c.request_id=NEW.request_id;
 IF NEW.method_of_payment='wallet-to-wallet' THEN
  UPDATE clients SET wallet_balance=wallet_balance-fare WHERE id=customer;
  UPDATE drivers SET wallet_balance=wallet_balance+net WHERE id=NEW.driver_id;
 ELSE
  UPDATE drivers SET wallet_balance=wallet_balance-(fare-net) WHERE id=NEW.driver_id;
 END IF;
END//
DELIMITER ;
