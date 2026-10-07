"""Same-origin PWA API. Session identities stay on the server, never in localStorage."""

import os
import secrets
import tempfile
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from mysql.connector import Error as DatabaseError
from pydantic import BaseModel, ConfigDict, Field

import services as svc
from config import settings
from database import one, rows
from generate_random_number import VerificationCodes
from places import search_places
from reports import REPORTS, run_report
from security import normalize_phone

app = FastAPI(
    title="BAXI PWA",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
codes = VerificationCodes()
auth_lock = Lock()


@dataclass
class Identity:
    role: str
    account_id: int | None
    phone: str = ""
    expires: float = 0
    uploads: set = field(default_factory=set)


sessions: dict[str, Identity] = {}
attempts = defaultdict(deque)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PhoneInput(Input):
    phone: str = Field(max_length=30)


class VerifyInput(PhoneInput):
    code: str = Field(min_length=6, max_length=6)
    role: str
    signup: bool = False


class StaffInput(Input):
    code: int
    password: str = Field(max_length=128)


class RegisterInput(Input):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    birth: str
    sex: str
    shaba: str = ""
    national_code: str = ""
    documents: dict[str, str] = Field(default_factory=dict)
    vehicle: dict = Field(default_factory=dict)
    service: str = "baxi"


class DraftInput(Input):
    service: str
    pickup: tuple[float, float]
    dropoff: tuple[float, float]
    round_trip: bool = False
    cargo_weight: int = Field(default=1, gt=0, le=100000)
    cargo_value: int = Field(default=0, ge=0, le=10**12)
    cargo_type: str = "unfragile"
    client_helped: bool = False
    payment: str | None = None
    pickup_label: str = Field(default="", max_length=240)
    dropoff_label: str = Field(default="", max_length=240)


class LocationInput(Input):
    latitude: float
    longitude: float


class PaymentInput(Input):
    payment: str = "wallet-to-wallet"


class RatingInput(Input):
    rating: int = Field(ge=0, le=5)


class TransferInput(Input):
    amount: int = Field(gt=0, le=10**9)
    key: str = Field(pattern=r"^[a-f0-9]{32}$")


class ReviewInput(Input):
    approved: bool
    reason: str = Field(default="", max_length=500)


class HireInput(Input):
    first_name: str
    last_name: str
    birth: str
    shaba: str
    password: str = Field(min_length=8, max_length=128)
    salary: int = Field(ge=0, le=10**12)
    department: str = "support"
    proficiency: str = "basic"
    education: str = "none"
    position: str = "basic employee"


def limited(request: Request):
    key = request.client.host if request.client else "local"
    now = time.monotonic()
    with auth_lock:
        # Bound anonymous-IP state as well as each rolling window.
        if len(attempts) > 10000:
            for address in list(attempts):
                if not attempts[address] or attempts[address][-1] < now - 60:
                    del attempts[address]
        queue = attempts[key]
        while queue and queue[0] < now - 60:
            queue.popleft()
        if len(queue) >= 20:
            raise HTTPException(
                429, "تعداد تلاش‌ها زیاد است. یک دقیقه بعد دوباره امتحان کنید."
            )
        queue.append(now)


def set_session(response, identity):
    now = time.monotonic()
    with auth_lock:
        for token in list(sessions):
            if sessions[token].expires <= now:
                del sessions[token]
        if len(sessions) >= 10000:
            raise HTTPException(503, "لطفاً کمی بعد دوباره تلاش کنید.")
        token = secrets.token_urlsafe(32)
        identity.expires = now + 12 * 3600
        sessions[token] = identity
    response.set_cookie(
        "baxi_session",
        token,
        httponly=True,
        secure=os.getenv("BAXI_COOKIE_SECURE", "false").lower() == "true",
        samesite="strict",
        max_age=12 * 3600,
        path="/api",
    )


def current(request: Request):
    token = request.cookies.get("baxi_session", "")
    with auth_lock:
        identity = sessions.get(token)
        if not identity or identity.expires <= time.monotonic():
            sessions.pop(token, None)
            raise HTTPException(401, "برای ادامه وارد حساب شوید.")
    return identity


def require(identity, *roles):
    if identity.role not in roles:
        raise HTTPException(403, "این بخش برای نقش شما در دسترس نیست.")


@app.middleware("http")
async def same_origin_and_private_cache(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        allowed = os.getenv(
            "BAXI_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:8080,http://127.0.0.1:8080",
        ).split(",")
        origin = request.headers.get("origin")
        if request.headers.get("x-baxi-request") != "1" or (
            origin and origin not in allowed
        ):
            return JSONResponse(
                status_code=403, content={"detail": "درخواست نامعتبر است."}
            )
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(ValueError)
async def validation_error(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(DatabaseError)
async def database_error(request, exc):
    if exc.errno == 1062:
        message, status = "این اطلاعات قبلاً ثبت شده است.", 409
    elif exc.errno in {3819, 1644}:
        message, status = "موجودی یا اطلاعات برای انجام این عملیات معتبر نیست.", 400
    else:
        message, status = "ارتباط با سرویس برقرار نشد. کمی بعد دوباره تلاش کنید.", 503
    return JSONResponse(status_code=status, content={"detail": message})


@app.get("/api/health")
def health():
    one("SELECT 1 AS healthy")
    return {"status": "ok", "demo": settings().demo}


@app.post("/api/auth/code", dependencies=[Depends(limited)])
def issue_code(body: PhoneInput):
    with auth_lock:
        code = codes.issue(body.phone)
    return {"demo": True, "demo_code": code}


@app.post("/api/auth/verify", dependencies=[Depends(limited)])
def verify_code(body: VerifyInput, response: Response):
    if body.role not in {"client", "driver"}:
        raise ValueError("Unknown role")
    with auth_lock:
        valid = codes.verify(body.phone, body.code)
    if not valid:
        raise HTTPException(400, "کد نادرست است یا اعتبار آن تمام شده.")
    phone = normalize_phone(body.phone)
    if body.signup:
        table = "clients" if body.role == "client" else "drivers"
        if one(f"SELECT id FROM {table} WHERE phone_number=%s", (phone,)):
            raise ValueError("An account already exists. Sign in instead.")
        set_session(response, Identity("pending_" + body.role, None, phone))
        return {"signup": True}
    account = svc.login_mobile(phone, body.role)
    set_session(response, Identity(body.role, account["id"], phone))
    return {"signup": False}


@app.post("/api/auth/staff", dependencies=[Depends(limited)])
def staff_login(body: StaffInput, response: Response):
    staff = svc.authenticate_staff(body.code, body.password)
    set_session(response, Identity("staff", staff["personnel_code"]))
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    with auth_lock:
        sessions.pop(request.cookies.get("baxi_session", ""), None)
    response.delete_cookie("baxi_session", path="/api")
    return {"ok": True}


@app.get("/api/me")
def me(identity=Depends(current)):
    if identity.role.startswith("pending_"):
        return {"role": identity.role, "phone": identity.phone, "demo": settings().demo}
    if identity.role == "staff":
        record = one(
            "SELECT personnel_code,first_name,last_name,department,position FROM employees WHERE personnel_code=%s",
            (identity.account_id,),
            "baxi_staff",
        )
        manager = (
            record
            and record["department"] == "HR"
            and record["position"] == "department manager"
        )
        return {
            "role": "staff",
            "account": record,
            "manager": manager,
            "demo": settings().demo,
        }
    table = "clients" if identity.role == "client" else "drivers"
    record = one(
        f"SELECT id,first_name,last_name,phone_number,wallet_balance,sex{',verification_status,rejection_reason' if identity.role == 'driver' else ''} FROM {table} WHERE id=%s",
        (identity.account_id,),
    )
    if not record:
        raise HTTPException(401, "حساب در دسترس نیست.")
    return {"role": identity.role, "account": record, "demo": settings().demo}


@app.post("/api/register")
def register(body: RegisterInput, response: Response, identity=Depends(current)):
    require(identity, "pending_client", "pending_driver")
    if identity.role == "pending_client":
        account = svc.register_client(
            identity.phone, body.first_name, body.last_name, body.birth, body.sex
        )
        role = "client"
    else:
        if set(body.documents) != {"license", "national", "judicial", "vehicle"}:
            raise ValueError("Upload all four documents.")
        demo_paths = {
            f"assets/demo-documents/{name}.svg"
            for name in ("license", "national", "judicial", "vehicle")
        }
        if any(
            path not in identity.uploads
            and not (settings().demo and path in demo_paths)
            for path in body.documents.values()
        ):
            raise HTTPException(403, "مدارک متعلق به این ثبت‌نام نیستند.")
        account = svc.register_driver(
            identity.phone,
            body.first_name,
            body.last_name,
            body.birth,
            body.sex,
            body.shaba,
            body.national_code,
            body.documents,
            body.vehicle,
            body.service,
        )
        role = "driver"
    identity.role, identity.account_id = role, account["id"]
    return {"ok": True}


@app.post("/api/documents")
def upload_document(file: UploadFile = File(...), identity=Depends(current)):
    require(identity, "pending_driver")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".pdf"}:
        raise ValueError("Select a PNG, JPEG or PDF document.")
    data = file.file.read(10 * 1024 * 1024 + 1)
    valid = (
        data.startswith(b"\x89PNG\r\n\x1a\n")
        if suffix == ".png"
        else data.startswith(b"%PDF-")
        if suffix == ".pdf"
        else data.startswith(b"\xff\xd8\xff")
    )
    if not valid or len(data) > 10 * 1024 * 1024:
        raise ValueError("Invalid document or document larger than 10 MB.")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
        temporary.write(data)
        path = Path(temporary.name)
    try:
        relative = svc.import_document(path)
    finally:
        path.unlink(missing_ok=True)
    identity.uploads.add(relative)
    return {"path": relative}


@app.get("/api/documents/{driver_id}/{kind}")
def get_document(driver_id: int, kind: str, identity=Depends(current)):
    require(identity, "staff", "driver")
    if identity.role == "staff":
        svc.staff_permission(identity.account_id)
    elif identity.account_id != driver_id:
        raise HTTPException(403, "دسترسی ندارید.")
    column = {
        "license": "license_photo_path",
        "national": "national_card_photo_path",
        "judicial": "judicial_letter_path",
    }.get(kind)
    if kind == "vehicle":
        driver = one(
            """SELECT vehicle_card_photo AS path FROM baxi WHERE driver_id=%s
            UNION ALL SELECT vehicle_card_photo FROM baxi_box WHERE driver_id=%s
            UNION ALL SELECT vehicle_card_photo FROM baxi_baar WHERE driver_id=%s LIMIT 1""",
            (driver_id, driver_id, driver_id),
        )
    elif not column:
        raise HTTPException(404)
    else:
        driver = one(f"SELECT {column} AS path FROM drivers WHERE id=%s", (driver_id,))
    if not driver or not driver["path"]:
        raise HTTPException(404)
    return FileResponse(
        svc.document_path(driver["path"]),
        headers={"Cache-Control": "no-store", "Content-Security-Policy": "sandbox"},
    )


@app.post("/api/quote")
def quote(body: DraftInput, identity=Depends(current)):
    require(identity, "client")
    return svc.quote(svc.TripDraft(**body.model_dump()))


@app.post("/api/requests")
def create_request(body: DraftInput, identity=Depends(current)):
    require(identity, "client")
    return {
        "id": svc.create_request(
            identity.account_id, svc.TripDraft(**body.model_dump())
        )
    }


@app.get("/api/history")
def history(identity=Depends(current)):
    require(identity, "client", "driver")
    return svc.history(identity.account_id, identity.role)


@app.get("/api/places")
def places(q: str, identity=Depends(current)):
    require(identity, "client", "driver")
    return search_places(q)


@app.post("/api/available")
def available(body: LocationInput, identity=Depends(current)):
    require(identity, "driver")
    return svc.available_requests(identity.account_id, body.latitude, body.longitude)


@app.post("/api/requests/{request_id}/accept")
def accept(request_id: int, identity=Depends(current)):
    require(identity, "driver")
    svc.accept_request(identity.account_id, request_id)
    return {"ok": True}


@app.post("/api/requests/{request_id}/start")
def start(request_id: int, identity=Depends(current)):
    require(identity, "driver")
    svc.start_trip(identity.account_id, request_id)
    return {"ok": True}


@app.post("/api/requests/{request_id}/complete")
def complete(request_id: int, body: PaymentInput, identity=Depends(current)):
    require(identity, "driver")
    svc.complete_trip(identity.account_id, request_id, body.payment)
    return {"ok": True}


@app.post("/api/requests/{request_id}/cancel")
def cancel(request_id: int, identity=Depends(current)):
    require(identity, "client")
    svc.cancel_request(identity.account_id, request_id)
    return {"ok": True}


@app.post("/api/requests/{request_id}/rating")
def rating(request_id: int, body: RatingInput, identity=Depends(current)):
    require(identity, "client", "driver")
    svc.rate_trip(identity.account_id, identity.role, request_id, body.rating)
    return {"ok": True}


@app.post("/api/wallet/demo")
def transfer(body: TransferInput, identity=Depends(current)):
    require(identity, "client", "driver")
    return {
        "key": svc.demo_transfer(
            identity.account_id, identity.role, body.amount, body.key
        )
    }


@app.get("/api/wallet")
def wallet_history(identity=Depends(current)):
    require(identity, "client", "driver")
    link, owner = (
        ("deposits", "client_id")
        if identity.role == "client"
        else ("withdrawals", "driver_id")
    )
    return rows(
        f"SELECT t.tracking_code,t.time,t.amount,t.type,t.state FROM transactions t JOIN {link} l ON l.tracking_code=t.tracking_code WHERE l.{owner}=%s ORDER BY t.time DESC LIMIT 50",
        (identity.account_id,),
    )


@app.get("/api/staff/drivers")
def driver_reviews(identity=Depends(current)):
    require(identity, "staff")
    # Never send private document paths or bank/national identifiers in the list.
    return [
        {
            k: d[k]
            for k in (
                "id",
                "first_name",
                "last_name",
                "verification_status",
                "rejection_reason",
                "sex",
            )
        }
        for d in svc.driver_reviews(identity.account_id)
    ]


@app.post("/api/staff/drivers/{driver_id}/review")
def review(driver_id: int, body: ReviewInput, identity=Depends(current)):
    require(identity, "staff")
    svc.review_driver(identity.account_id, driver_id, body.approved, body.reason)
    return {"ok": True}


@app.post("/api/staff/employees")
def hire(body: HireInput, identity=Depends(current)):
    require(identity, "staff")
    return {"code": svc.hire_employee(identity.account_id, **body.model_dump())}


@app.get("/api/staff/reports")
def reports(identity=Depends(current)):
    require(identity, "staff")
    svc.staff_permission(identity.account_id, manager=True)
    return [{"id": i + 1, "title": r.title} for i, r in enumerate(REPORTS)]


@app.get("/api/staff/reports/{report_id}")
def report(report_id: int, identity=Depends(current)):
    require(identity, "staff")
    return run_report(identity.account_id, report_id)
