"""Seed synthetic data once. Reruns do not reset balances or existing trips."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import services as svc
from config import ROOT, settings
from database import execute, one, transaction
from security import hash_password

DEMO_PASSWORD = "BaxiDemo!2026"
DOCUMENTS = {
    name: f"assets/demo-documents/{name}.svg"
    for name in ("license", "national", "judicial", "vehicle")
}


def make_documents():
    folder = ROOT / "assets/demo-documents"
    folder.mkdir(parents=True, exist_ok=True)
    for name in DOCUMENTS:
        (folder / f"{name}.svg").write_text(
            f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" rx="20" fill="#f3eefb"/><rect x="24" y="24" width="592" height="352" rx="12" fill="white" stroke="#7040bd"/><text x="320" y="130" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#7040bd">BAXI · SYNTHETIC DOCUMENT</text><text x="320" y="220" text-anchor="middle" font-family="sans-serif" font-size="30">{name.upper()}</text><text x="320" y="300" text-anchor="middle" font-family="sans-serif" font-size="18">Demonstration only · No real identity data</text></svg>""",
            encoding="utf-8",
        )


def seed():
    if not settings().demo:
        raise RuntimeError("Seeding is only available with BAXI_DEMO_MODE=true.")
    make_documents()
    with transaction("baxi_staff"):
        for code, first, position in [
            (9001, "مدیر", "department manager"),
            (9002, "کارشناس", "basic employee"),
        ]:
            if not one(
                "SELECT personnel_code FROM employees WHERE personnel_code=%s",
                (code,),
                "baxi_staff",
            ):
                execute(
                    """INSERT INTO employees(personnel_code,shaba_number,password,first_name,last_name,birth_date,salary,department,proficiency,education,position)
                    VALUES(%s,%s,%s,%s,'نمونه','1990-01-01',50000000,'HR','advanced','bachelor',%s)""",
                    (
                        code,
                        "IR" + str(code).zfill(24),
                        hash_password(DEMO_PASSWORD),
                        first,
                        position,
                    ),
                    "baxi_staff",
                )
    for phone, first, sex in [
        ("09120000010", "مسافر", "M"),
        ("09120000020", "مسافر بانوان", "F"),
    ]:
        if not one("SELECT id FROM clients WHERE phone_number=%s", (phone[1:],)):
            account = svc.register_client(phone, first, "نمونه", "1995-05-23", sex)
            svc.demo_transfer(account["id"], "client", 1000000)
    drivers = [
        ("09120000030", "راننده", "M", "baxi", 4),
        ("09120000040", "راننده بانوان", "F", "women", 4),
        ("09120000050", "پیک", "M", "box", 30),
        ("09120000060", "راننده بار", "M", "baar", 2000),
        ("09120000070", "در انتظار بررسی", "F", "baxi", 4),
        ("09120000080", "راننده دوم", "M", "baxi", 4),
    ]
    created = []
    for i, (phone, first, sex, service, capacity) in enumerate(drivers, 1):
        if not one("SELECT id FROM drivers WHERE phone_number=%s", (phone[1:],)):
            account = svc.register_driver(
                phone,
                first,
                "نمونه",
                "1990-01-01",
                sex,
                "IR" + str(100 + i).zfill(24),
                str(i).zfill(10),
                DOCUMENTS,
                {
                    "name": "Demo vehicle",
                    "color": "white",
                    "plate": f"DEMO-{i}",
                    "capacity": capacity,
                    "year": 2020,
                    "fuel": "gasoline",
                },
                service,
            )
            execute(
                "UPDATE drivers SET wallet_balance=200000,latitude=34.798,longitude=48.515 WHERE id=%s",
                (account["id"],),
            )
            if phone != "09120000070":
                svc.review_driver(9002, account["id"], True)
            created.append(phone)
    if created and not one("SELECT id FROM service_requests LIMIT 1"):
        for service, passenger_phone, driver_phone in [
            ("baxi", "9120000010", "9120000030"),
            ("women", "9120000020", "9120000040"),
            ("box", "9120000010", "9120000050"),
            ("baar", "9120000010", "9120000060"),
        ]:
            passenger = one(
                "SELECT id FROM clients WHERE phone_number=%s", (passenger_phone,)
            )["id"]
            driver = one(
                "SELECT id FROM drivers WHERE phone_number=%s", (driver_phone,)
            )["id"]
            draft = svc.TripDraft(
                service,
                (34.798, 48.515),
                (34.806, 48.53),
                cargo_weight=5,
                cargo_value=100000,
            )
            request = svc.create_request(passenger, draft)
            svc.accept_request(driver, request)
            svc.start_trip(driver, request)
            svc.complete_trip(driver, request)
            svc.rate_trip(passenger, "client", request, 5)
            svc.rate_trip(driver, "driver", request, 5)
        svc.refresh_monthly_income(date.today().replace(day=1))
    print("Synthetic demo ready. Staff: 9001 / 9002. Password: BaxiDemo!2026")
    print(
        "Passenger: 09120000010; female passenger: 09120000020; drivers: 09120000030..80"
    )


if __name__ == "__main__":
    seed()
