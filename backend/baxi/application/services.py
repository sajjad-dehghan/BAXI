"""Application rules for a local, educational BAXI installation.

Each multi-table change commits as one transaction. There is no remote API or
payment provider: database credentials belong on the local demo machine only.
"""

import json
import re
import secrets
import shutil
import uuid
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path

from baxi.core.config import ROOT, settings
from baxi.core.security import hash_password, normalize_phone, verify_password
from baxi.db.queries import execute, one, rows, transaction
from baxi.geo.coordinates import coordinates, get_lat_lon_info, trip_km
from baxi.geo.service_area import require_tehran
from baxi.pricing.engine import calculate, canonical, load_policy, policy_hash

VEHICLES = {"baxi": "baxi", "women": "baxi", "box": "baxi_box", "baar": "baxi_baar"}
DETAILS = {
    "baxi": "baxi_trips",
    "women": "baxi_trips",
    "box": "light_transports",
    "baar": "heavy_transports",
}


def required(value, label, maximum=50):
    value = str(value or "").strip()
    if not value or len(value) > maximum:
        raise ValueError(f"{label} is required (maximum {maximum} characters).")
    return value


def integer(value, label, minimum=0, maximum=10**12):
    if isinstance(value, bool) or not str(value).isascii() or not str(value).isdigit():
        raise ValueError(f"{label} must be a whole number.")
    value = int(value)
    if not minimum <= value <= maximum:
        raise ValueError(f"{label} must be between {minimum} and {maximum}.")
    return value


def birth_date(value, minimum_age):
    value = date.fromisoformat(str(value))
    today = date.today()
    age = (
        today.year - value.year - ((today.month, today.day) < (value.month, value.day))
    )
    if not minimum_age <= age <= 120:
        raise ValueError(
            f"Age must be between {minimum_age} and 120. Enter a Gregorian birth date."
        )
    return value


def person_fields(first_name, last_name, birth, sex, minimum_age):
    if sex not in {"M", "F"}:
        raise ValueError("Select a gender.")
    return (
        required(first_name, "First name"),
        required(last_name, "Last name"),
        birth_date(birth, minimum_age),
        sex,
    )


def document_path(relative):
    path = (ROOT / relative).resolve()
    allowed = [
        (ROOT / "data/uploads").resolve(),
        (ROOT / "assets/demo-documents").resolve(),
    ]
    if not any(path.is_relative_to(folder) for folder in allowed) or not path.is_file():
        raise ValueError("Document is missing or outside the BAXI document folders.")
    return path


def import_document(source):
    source = Path(source)
    if (
        source.suffix.lower() not in {".png", ".jpg", ".jpeg", ".pdf"}
        or not source.is_file()
        or source.stat().st_size > 10 * 1024 * 1024
    ):
        raise ValueError("Select a PNG, JPEG or PDF document smaller than 10 MB.")
    folder = ROOT / "data/uploads"
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / (uuid.uuid4().hex + source.suffix.lower())
    shutil.copyfile(source, target)
    return target.relative_to(ROOT).as_posix()


def login_mobile(phone, role):
    table = {"client": "clients", "driver": "drivers"}.get(role)
    if not table:
        raise ValueError("Unknown role")
    record = one(
        f"SELECT * FROM {table} WHERE phone_number=%s", (normalize_phone(phone),)
    )
    if not record:
        raise ValueError("No account exists for this number and role. Register first.")
    return record


def register_client(phone, first_name, last_name, birth, sex):
    fields = person_fields(first_name, last_name, birth, sex, 15)
    account_id, _ = execute(
        "INSERT INTO clients(phone_number,first_name,last_name,birth_date,sex) VALUES(%s,%s,%s,%s,%s)",
        (normalize_phone(phone), *fields),
    )
    return one("SELECT * FROM clients WHERE id=%s", (account_id,))


def register_driver(
    phone,
    first_name,
    last_name,
    birth,
    sex,
    shaba,
    national_code,
    documents,
    vehicle,
    service,
):
    fields = person_fields(first_name, last_name, birth, sex, 18)
    if not {"name", "color", "plate", "capacity", "year", "fuel"}.issubset(vehicle):
        raise ValueError("Complete all vehicle fields.")
    if set(documents) != {"license", "national", "judicial", "vehicle"}:
        raise ValueError("Upload all four documents.")
    if service not in VEHICLES or (service == "women" and sex != "F"):
        raise ValueError("This driver cannot register for the selected service.")
    if not re.fullmatch(r"IR[0-9]{24}", shaba) or not re.fullmatch(
        r"[0-9]{10}", national_code
    ):
        raise ValueError(
            "IBAN must be IR + 24 digits; national code must contain 10 digits."
        )
    for field in ("license", "national", "judicial", "vehicle"):
        document_path(documents[field])
    name = required(vehicle["name"], "Vehicle name")
    color = required(vehicle["color"], "Vehicle color")
    plate = required(vehicle["plate"], "Vehicle plate", 20)
    capacity = integer(vehicle["capacity"], "Vehicle capacity", 1, 100000)
    year = integer(
        vehicle["year"], "Vehicle production year", 1950, date.today().year + 1
    )
    fuel = vehicle["fuel"]
    if fuel not in {"gasoline", "CNG", "dual", "electricity"}:
        raise ValueError("Unknown fuel type")
    with transaction():
        account_id, _ = execute(
            """INSERT INTO drivers(phone_number,first_name,last_name,birth_date,sex,shaba_number,national_code,
            referral_code,license_photo_path,national_card_photo_path,judicial_letter_path)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                normalize_phone(phone),
                *fields,
                shaba,
                national_code,
                secrets.token_hex(5),
                documents["license"],
                documents["national"],
                documents["judicial"],
            ),
        )
        execute(
            f"""INSERT INTO {VEHICLES[service]}(driver_id,vehicle_name,vehicle_color,vehicle_license_plate,vehicle_capacity,
            vehicle_production_date,vehicle_fuel_type,vehicle_card_photo) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                account_id,
                name,
                color,
                plate,
                capacity,
                date(year, 1, 1),
                fuel,
                documents["vehicle"],
            ),
        )
    return one("SELECT * FROM drivers WHERE id=%s", (account_id,))


@dataclass(frozen=True)
class TripDraft:
    service: str
    pickup: tuple
    dropoff: tuple
    round_trip: bool = False
    cargo_weight: int = 1
    cargo_value: int = 0
    cargo_type: str = "unfragile"
    client_helped: bool = False
    payment: str | None = None
    pickup_label: str = ""
    dropoff_label: str = ""


def quote(draft, policy=None):
    if draft.payment not in {None, "wallet-to-wallet", "cash"}:
        raise ValueError("Unknown payment method")
    if draft.service not in VEHICLES:
        raise ValueError("Unknown service")
    pickup, dropoff = coordinates(*draft.pickup), coordinates(*draft.dropoff)
    require_tehran(*pickup)
    require_tehran(*dropoff)
    if pickup == dropoff:
        raise ValueError("Pickup and destination must be different.")
    weight = integer(draft.cargo_weight, "Cargo weight", 1, 100000)
    value = integer(draft.cargo_value, "Cargo value")
    if draft.cargo_type not in {"fragile", "unfragile"}:
        raise ValueError("Unknown cargo type")
    if draft.service in {"box", "baar"} and draft.round_trip:
        raise ValueError("Round trips are available for passenger services only.")
    estimate = calculate(
        draft.service, trip_km(pickup, dropoff), draft.round_trip, weight, policy
    )
    return {
        **estimate,
        "weight": weight,
        "value": value,
    }


def priced_draft(draft):
    # Labels and payment may change without affecting the fare. Cargo details
    # are bound as well, even when they are informational rather than surcharges.
    return {
        key: value
        for key, value in asdict(draft).items()
        if key not in {"payment", "pickup_label", "dropoff_label"}
    }


def register_pricing_policy(policy):
    execute(
        "INSERT IGNORE INTO pricing_policies(version,fingerprint,policy) VALUES(%s,%s,%s)",
        (policy["version"], policy_hash(policy), canonical(policy)),
    )
    stored = one(
        "SELECT fingerprint FROM pricing_policies WHERE version=%s",
        (policy["version"],),
    )
    if stored["fingerprint"] != policy_hash(policy):
        raise ValueError("Pricing configuration changed: increment the policy version.")


def issue_quote(client_id, draft):
    policy = load_policy()
    estimate = quote(draft, policy)
    with transaction():
        client = one("SELECT sex FROM clients WHERE id=%s", (client_id,))
        if not client or (draft.service == "women" and client["sex"] != "F"):
            raise ValueError("This passenger cannot request the selected service.")
        register_pricing_policy(policy)
        quote_id = uuid.uuid4().hex
        execute(
            """INSERT INTO fare_quotes(id,client_id,policy_version,draft,price,expires_at)
                   VALUES(%s,%s,%s,%s,%s,UTC_TIMESTAMP(6)+INTERVAL 300 SECOND)""",
            (
                quote_id,
                client_id,
                policy["version"],
                canonical(priced_draft(draft)),
                canonical(estimate),
            ),
        )
        expiry = one("SELECT expires_at FROM fare_quotes WHERE id=%s", (quote_id,))[
            "expires_at"
        ]
    return {
        key: value
        for key, value in {
            **estimate,
            "quote_id": quote_id,
            "expires_at": expiry.isoformat() + "Z",
        }.items()
        if key not in {"driver_net_irr", "commission_irr", "commission_bps"}
    }


def cleanup_quotes():
    # Booked quotes are retained for auditability, including cancelled trips.
    return execute("""DELETE q FROM fare_quotes q LEFT JOIN trip_pricing p ON p.quote_id=q.id
                      WHERE q.expires_at<UTC_TIMESTAMP(6)-INTERVAL 1 DAY AND p.request_id IS NULL""")[
        1
    ]


def create_request(client_id, draft, quote_id):
    if draft.payment not in {None, "wallet-to-wallet", "cash"}:
        raise ValueError("Unknown payment method")
    origin, destination = (
        get_lat_lon_info(*draft.pickup),
        get_lat_lon_info(*draft.dropoff),
    )
    with transaction():
        client = one("SELECT * FROM clients WHERE id=%s FOR UPDATE", (client_id,))
        if not client or (draft.service == "women" and client["sex"] != "F"):
            raise ValueError("This passenger cannot request the selected service.")
        offered = one(
            "SELECT *,expires_at<=UTC_TIMESTAMP(6) AS expired FROM fare_quotes WHERE id=%s AND client_id=%s FOR UPDATE",
            (quote_id, client_id),
        )
        if not offered:
            raise ValueError("Invalid quote; request a new price.")
        if canonical(json.loads(offered["draft"])) != canonical(priced_draft(draft)):
            raise ValueError("Quote does not match this request; request a new price.")
        booked = one(
            "SELECT request_id FROM trip_pricing WHERE quote_id=%s", (quote_id,)
        )
        if booked:
            return booked["request_id"]
        if offered["expired"]:
            raise ValueError("Quote expired; request a new price and confirm it.")
        estimate = json.loads(offered["price"])
        if (
            draft.payment == "wallet-to-wallet"
            and client["wallet_balance"] < estimate["cost"]
        ):
            raise ValueError("Insufficient wallet balance; choose cash or top up.")
        if one(
            "SELECT id FROM service_requests WHERE client_id=%s AND state IN ('requested','accepted','in_progress')",
            (client_id,),
        ):
            raise ValueError(
                "Finish or cancel your current request before making another."
            )
        request_id, _ = execute(
            """INSERT INTO service_requests(client_id,service_type,pickup_latitude,pickup_longitude,pickup_province,pickup_city,preferred_payment,pickup_label,dropoff_label)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                client_id,
                draft.service,
                *coordinates(*draft.pickup),
                origin["state"],
                origin["city"],
                draft.payment,
                str(draft.pickup_label).strip()[:240] or None,
                str(draft.dropoff_label).strip()[:240] or None,
            ),
        )
        execute(
            "INSERT INTO destinations(request_id,latitude,longitude,city) VALUES(%s,%s,%s,%s)",
            (request_id, *coordinates(*draft.dropoff), destination["city"]),
        )
        if draft.service in {"baxi", "women"}:
            execute(
                "INSERT INTO baxi_trips(request_id,cost,round_trip) VALUES(%s,%s,%s)",
                (request_id, estimate["cost"], draft.round_trip),
            )
        else:
            extra = "client_helped" if draft.service == "baar" else "insurance_cost"
            execute(
                f"""INSERT INTO {DETAILS[draft.service]}(request_id,cost,cargo_weight,cargo_value,dropoff_latitude,dropoff_longitude,dropoff_city,cargo_type,{extra})
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    request_id,
                    estimate["cost"],
                    estimate["weight"],
                    estimate["value"],
                    *coordinates(*draft.dropoff),
                    destination["city"],
                    draft.cargo_type,
                    draft.client_helped
                    if draft.service == "baar"
                    else estimate["insurance"],
                ),
            )
        execute(
            """INSERT INTO trip_pricing(request_id,quote_id,policy_version,breakdown,cost,commission_irr,driver_net_irr,commission_bps)
                   VALUES(%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                request_id,
                quote_id,
                estimate["policy_version"],
                canonical(estimate["breakdown"]),
                estimate["cost"],
                estimate["commission_irr"],
                estimate["driver_net_irr"],
                estimate["commission_bps"],
            ),
        )
    return request_id


REQUEST_SELECT = """SELECT r.*, c.first_name AS client_first_name,c.last_name AS client_last_name,
    dr.first_name AS driver_first_name,dr.last_name AS driver_last_name,
    COALESCE(v.vehicle_name,vb.vehicle_name,vh.vehicle_name) AS vehicle_name,
    COALESCE(v.vehicle_color,vb.vehicle_color,vh.vehicle_color) AS vehicle_color,
    COALESCE(v.vehicle_license_plate,vb.vehicle_license_plate,vh.vehicle_license_plate) AS vehicle_plate,
    d.latitude AS dropoff_latitude,d.longitude AS dropoff_longitude,t.cost,
    a.driver_rating,a.client_rating,a.method_of_payment,
    p.policy_version,p.breakdown AS pricing_breakdown,
    COALESCE(p.driver_net_irr,FLOOR(t.cost*0.8)) AS driver_net_irr,
    COALESCE(p.commission_irr,t.cost-FLOOR(t.cost*0.8)) AS commission_irr,
    COALESCE(h.cargo_weight,l.cargo_weight,0) AS cargo_weight,
    COALESCE(h.cargo_type,l.cargo_type,'unfragile') AS cargo_type
    FROM service_requests r JOIN clients c ON c.id=r.client_id
    JOIN destinations d ON d.request_id=r.id AND d.stop_number=1 JOIN trip_costs t ON t.request_id=r.id
    LEFT JOIN service_acceptances a ON a.request_id=r.id
    LEFT JOIN trip_pricing p ON p.request_id=r.id
    LEFT JOIN drivers dr ON dr.id=r.assigned_driver_id
    LEFT JOIN baxi v ON v.driver_id=dr.id AND r.service_type IN ('baxi','women')
    LEFT JOIN baxi_box vb ON vb.driver_id=dr.id AND r.service_type='box'
    LEFT JOIN baxi_baar vh ON vh.driver_id=dr.id AND r.service_type='baar'
    LEFT JOIN heavy_transports h ON h.request_id=r.id LEFT JOIN light_transports l ON l.request_id=r.id"""


def history(account_id, role):
    if role not in {"client", "driver"}:
        raise ValueError("Unknown role")
    column = "client_id" if role == "client" else "assigned_driver_id"
    return rows(
        REQUEST_SELECT + f" WHERE r.{column}=%s ORDER BY r.id DESC", (account_id,)
    )


def available_requests(driver_id, latitude, longitude):
    lat, lon = coordinates(latitude, longitude)
    require_tehran(lat, lon)
    driver = one("SELECT * FROM drivers WHERE id=%s", (driver_id,))
    if not driver or driver["verification_status"] != "approved":
        raise ValueError("Your driver account must be approved by staff first.")
    execute(
        "UPDATE drivers SET latitude=%s,longitude=%s WHERE id=%s", (lat, lon, driver_id)
    )
    result = rows(
        REQUEST_SELECT
        + """ WHERE r.state='requested'
        AND ST_Distance_Sphere(POINT(%s,%s),POINT(r.pickup_longitude,r.pickup_latitude))<=5000 ORDER BY r.id""",
        (lon, lat),
    )
    vehicles = {
        service: one(
            f"SELECT vehicle_capacity FROM {table} WHERE driver_id=%s", (driver_id,)
        )
        for service, table in VEHICLES.items()
    }
    return [
        r
        for r in result
        if vehicles[r["service_type"]]
        and (r["service_type"] != "women" or driver["sex"] == "F")
        and (
            r["service_type"] in {"baxi", "women"}
            or r["cargo_weight"] <= vehicles[r["service_type"]]["vehicle_capacity"]
        )
    ]


def accept_request(driver_id, request_id):
    with transaction():
        driver = one("SELECT * FROM drivers WHERE id=%s FOR UPDATE", (driver_id,))
        request = one(
            "SELECT * FROM service_requests WHERE id=%s FOR UPDATE", (request_id,)
        )
        if (
            not driver
            or driver["verification_status"] != "approved"
            or not request
            or request["state"] != "requested"
        ):
            raise ValueError(
                "This request is no longer available or your account is not approved."
            )
        if driver["latitude"] is None or driver["longitude"] is None:
            raise ValueError("Set your location first.")
        require_tehran(driver["latitude"], driver["longitude"])
        require_tehran(request["pickup_latitude"], request["pickup_longitude"])
        vehicle = one(
            f"SELECT * FROM {VEHICLES[request['service_type']]} WHERE driver_id=%s",
            (driver_id,),
        )
        if not vehicle or (request["service_type"] == "women" and driver["sex"] != "F"):
            raise ValueError(
                "Your vehicle or driver account is not eligible for this service."
            )
        distance = one(
            "SELECT ST_Distance_Sphere(POINT(%s,%s),POINT(%s,%s)) AS metres",
            (
                driver["longitude"],
                driver["latitude"],
                request["pickup_longitude"],
                request["pickup_latitude"],
            ),
        )["metres"]
        if distance > 5000:
            raise ValueError("The pickup is more than 5 km away.")
        if request["service_type"] in {"box", "baar"}:
            cargo = one(
                f"SELECT cargo_weight FROM {DETAILS[request['service_type']]} WHERE request_id=%s",
                (request_id,),
            )
            if cargo["cargo_weight"] > vehicle["vehicle_capacity"]:
                raise ValueError("Cargo exceeds vehicle capacity.")
        if one(
            "SELECT id FROM service_requests WHERE assigned_driver_id=%s AND state IN ('accepted','in_progress')",
            (driver_id,),
        ):
            raise ValueError("Complete your current trip first.")
        execute(
            "UPDATE service_requests SET state='accepted',assigned_driver_id=%s,accepted_at=NOW(6) WHERE id=%s",
            (driver_id, request_id),
        )


def start_trip(driver_id, request_id):
    _, changed = execute(
        "UPDATE service_requests SET state='in_progress',started_at=NOW(6) WHERE id=%s AND assigned_driver_id=%s AND state='accepted'",
        (request_id, driver_id),
    )
    if not changed:
        raise ValueError("Only the assigned driver can start an accepted trip.")


def complete_trip(driver_id, request_id, payment="wallet-to-wallet"):
    if payment not in {"wallet-to-wallet", "cash"}:
        raise ValueError("Unknown payment method")
    with transaction():
        driver = one("SELECT id FROM drivers WHERE id=%s FOR UPDATE", (driver_id,))
        request = one(
            "SELECT * FROM service_requests WHERE id=%s FOR UPDATE", (request_id,)
        )
        if not driver or not request or request["assigned_driver_id"] != driver_id:
            raise ValueError("Only the assigned driver can finish this trip.")
        if request["state"] == "completed":
            return  # Network/UI retry does not settle twice.
        if request["state"] != "in_progress":
            raise ValueError("Start the trip before finishing it.")
        if request["preferred_payment"] and payment != request["preferred_payment"]:
            raise ValueError("Use the passenger's selected payment method.")
        one("SELECT id FROM clients WHERE id=%s FOR UPDATE", (request["client_id"],))
        execute(
            """INSERT INTO service_acceptances(request_id,driver_id,estimated_end_time,method_of_payment)
            VALUES(%s,%s,%s,%s)""",
            (
                request_id,
                driver_id,
                request["accepted_at"] + timedelta(minutes=15),
                payment,
            ),
        )
        execute(
            "UPDATE service_requests SET state='completed',completed_at=NOW(6) WHERE id=%s",
            (request_id,),
        )


def cancel_request(client_id, request_id):
    _, changed = execute(
        "UPDATE service_requests SET state='cancelled' WHERE id=%s AND client_id=%s AND state IN ('requested','accepted')",
        (request_id, client_id),
    )
    if not changed:
        raise ValueError("Only your unstarted requests can be cancelled.")


def rate_trip(account_id, role, request_id, rating):
    rating = integer(rating, "Rating", 0, 5)
    if role not in {"client", "driver"}:
        raise ValueError("Unknown role")
    owner = "client_id" if role == "client" else "assigned_driver_id"
    column = "driver_rating" if role == "client" else "client_rating"
    _, changed = execute(
        f"""UPDATE service_acceptances a JOIN service_requests r ON r.id=a.request_id SET a.{column}=%s
        WHERE r.id=%s AND r.{owner}=%s AND r.state='completed' AND a.{column} IS NULL""",
        (rating, request_id, account_id),
    )
    if not changed:
        raise ValueError(
            "This trip cannot be rated, or your rating is already recorded."
        )


def balance(account_id, role):
    table = {"client": "clients", "driver": "drivers"}.get(role)
    if not table:
        raise ValueError("Unknown role")
    result = one(f"SELECT wallet_balance FROM {table} WHERE id=%s", (account_id,))
    if not result:
        raise ValueError("Account not found")
    return result["wallet_balance"]


def demo_transfer(account_id, role, amount, tracking_code=None):
    if not settings().demo:
        raise ValueError(
            "No payment gateway is connected. Wallet simulation requires demo mode."
        )
    amount = integer(amount, "Amount", 1, 10**9)
    code = tracking_code or uuid.uuid4().hex
    if not re.fullmatch(r"[a-f0-9]{32}", code):
        raise ValueError("Invalid transaction key")
    table, link, owner, kind = {
        "client": ("clients", "deposits", "client_id", "card-to-wallet"),
        "driver": ("drivers", "withdrawals", "driver_id", "wallet-to-card"),
    }.get(role, (None, None, None, None))
    if not table:
        raise ValueError("Unknown role")
    with transaction():
        if not one(f"SELECT id FROM {table} WHERE id=%s FOR UPDATE", (account_id,)):
            raise ValueError("Account not found")
        existing = one(
            "SELECT * FROM transactions WHERE tracking_code=%s FOR UPDATE", (code,)
        )
        if existing:
            posted = one(f"SELECT {owner} FROM {link} WHERE tracking_code=%s", (code,))
            if (
                not posted
                or posted[owner] != account_id
                or existing["amount"] != amount
                or existing["type"] != kind
            ):
                raise ValueError(
                    "Transaction key was already used for a different operation."
                )
            return code
        execute(
            "INSERT INTO transactions(tracking_code,shaba_number,amount,state,type) VALUES(%s,%s,%s,'completed',%s)",
            (code, "IR" + "0" * 24, amount, kind),
        )
        execute(
            f"INSERT INTO {link}(tracking_code,{owner}) VALUES(%s,%s)",
            (code, account_id),
        )
    return code


def authenticate_staff(code, password):
    staff = one(
        "SELECT * FROM employees WHERE personnel_code=%s",
        (integer(code, "Personnel code", 1),),
        "baxi_staff",
    )
    if not staff or not verify_password(password, staff["password"]):
        raise ValueError("Incorrect personnel code or password")
    return {k: v for k, v in staff.items() if k != "password"}


def staff_permission(code, manager=False):
    staff = one(
        "SELECT department,position FROM employees WHERE personnel_code=%s",
        (code,),
        "baxi_staff",
    )
    if not staff or (
        manager
        and (staff["department"] != "HR" or staff["position"] != "department manager")
    ):
        raise ValueError("This action requires an HR manager.")
    if not manager and staff["department"] not in {"HR", "support"}:
        raise ValueError("Only HR and support staff can review drivers.")


def driver_reviews(code):
    staff_permission(code)
    return rows("SELECT * FROM drivers ORDER BY verification_status, id")


def review_driver(code, driver_id, approved, reason=""):
    staff_permission(code)
    if not approved:
        reason = required(reason, "Rejection reason", 500)
    with transaction():
        driver = one("SELECT * FROM drivers WHERE id=%s FOR UPDATE", (driver_id,))
        if not driver or driver["verification_status"] != "pending":
            raise ValueError("This driver has already been reviewed.")
        if approved:
            for field in (
                "license_photo_path",
                "national_card_photo_path",
                "judicial_letter_path",
            ):
                document_path(driver[field])
            vehicle = one(
                """SELECT vehicle_card_photo AS path FROM baxi WHERE driver_id=%s
                UNION ALL SELECT vehicle_card_photo FROM baxi_box WHERE driver_id=%s
                UNION ALL SELECT vehicle_card_photo FROM baxi_baar WHERE driver_id=%s LIMIT 1""",
                (driver_id, driver_id, driver_id),
            )
            if not vehicle:
                raise ValueError("Vehicle document is missing.")
            document_path(vehicle["path"])
            execute(
                """UPDATE drivers SET verification_status='approved',license_verification_date=CURDATE(),
                judicial_letter_verification_date=CURDATE(),final_verification_date=CURDATE(),verifier_personnel_code=%s,rejection_reason=NULL WHERE id=%s""",
                (code, driver_id),
            )
        else:
            execute(
                "UPDATE drivers SET verification_status='rejected',rejection_reason=%s,verifier_personnel_code=%s WHERE id=%s",
                (reason, code, driver_id),
            )


def hire_employee(
    manager_code,
    first_name,
    last_name,
    birth,
    shaba,
    password,
    salary,
    department="support",
    proficiency="basic",
    education="none",
    position="basic employee",
):
    staff_permission(manager_code, manager=True)
    fields = person_fields(first_name, last_name, birth, "M", 18)
    if not re.fullmatch(r"IR[0-9]{24}", shaba):
        raise ValueError("IBAN must be IR + 24 digits.")
    if (
        department
        not in {"marketing", "accounting", "finance", "HR", "support", "development"}
        or proficiency
        not in {"basic", "intermediate", "advanced", "proficient", "expert"}
        or position not in {"department manager", "basic employee", "programmer"}
    ):
        raise ValueError("Invalid staff classification")
    return execute(
        """INSERT INTO employees(first_name,last_name,birth_date,shaba_number,password,salary,department,proficiency,education,position)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            *fields[:3],
            shaba,
            hash_password(password),
            integer(salary, "Salary"),
            department,
            proficiency,
            required(education, "Education"),
            position,
        ),
        "baxi_staff",
    )[0]


def refresh_monthly_income(month):
    month = date.fromisoformat(str(month)).replace(day=1)
    # SUM each completed trip once, including two distinct trips with the same fare.
    with transaction():
        execute("DELETE FROM monthly_incomes WHERE month=%s", (month,))
        execute(
            """INSERT INTO monthly_incomes(driver_id,month,gross_income,net_income)
            SELECT a.driver_id,%s,SUM(t.cost),SUM(COALESCE(p.driver_net_irr,FLOOR(t.cost*0.8))) FROM service_acceptances a
            JOIN trip_costs t ON t.request_id=a.request_id LEFT JOIN trip_pricing p ON p.request_id=a.request_id WHERE a.end_time >= %s AND a.end_time < DATE_ADD(%s, INTERVAL 1 MONTH)
            GROUP BY a.driver_id""",
            (month, month, month),
        )
