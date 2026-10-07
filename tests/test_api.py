import pytest
from fastapi.testclient import TestClient

import api

pytestmark = pytest.mark.integration


@pytest.fixture
def client():
    api.sessions.clear()
    api.attempts.clear()
    api.codes = api.VerificationCodes()
    with TestClient(
        api.app, headers={"X-Baxi-Request": "1", "Origin": "http://127.0.0.1:5173"}
    ) as connection:
        yield connection


def login(client, role="client", phone="09120000010"):
    code = client.post("/api/auth/code", json={"phone": phone}).json()["demo_code"]
    result = client.post(
        "/api/auth/verify", json={"phone": phone, "code": code, "role": role}
    )
    assert result.status_code == 200
    assert "HttpOnly" in result.headers["set-cookie"]
    return result


def test_anonymous_and_csrf_denied(client):
    assert client.get("/api/history").status_code == 401
    assert (
        client.post(
            "/api/auth/code",
            json={"phone": "09120000010"},
            headers={"Origin": "https://untrusted.example"},
        ).status_code
        == 403
    )


def test_client_identity_and_role_cannot_be_forged(client):
    login(client)
    assert client.get("/api/me").json()["role"] == "client"
    assert client.get("/api/staff/drivers").status_code == 403
    assert (
        client.post(
            "/api/available", json={"latitude": 35.7005, "longitude": 51.3376}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/wallet/demo", json={"amount": 100, "key": "a" * 32, "client_id": 999}
        ).status_code
        == 422
    )
    assert client.post("/api/auth/logout", json={}).status_code == 200
    assert client.get("/api/me").status_code == 401


def test_private_responses_not_cacheable(client):
    login(client)
    result = client.get("/api/history")
    assert result.headers["cache-control"] == "no-store"
    assert all("password" not in record for record in result.json())


def test_server_rejects_outside_tehran_for_quote_request_and_driver(client):
    login(client)
    for path in ["/api/quote", "/api/requests"]:
        response = client.post(
            path,
            json={
                "service": "baxi",
                "pickup": [35.7005, 51.3376],
                "dropoff": [34.798, 48.515],
            },
        )
        assert response.status_code == 400
        assert "within Tehran" in response.json()["detail"]
    client.post("/api/auth/logout", json={})
    login(client, "driver", "09120000030")
    response = client.post(
        "/api/available", json={"latitude": 35.84, "longitude": 50.94}
    )
    assert response.status_code == 400
    assert "within Tehran" in response.json()["detail"]


def test_employee_reports_require_manager(client):
    assert (
        client.post(
            "/api/auth/staff", json={"code": 9002, "password": "BaxiDemo!2026"}
        ).status_code
        == 200
    )
    assert client.get("/api/staff/drivers").status_code == 200
    assert client.get("/api/staff/reports").status_code == 400


def test_staff_report_and_document_access(client):
    client.post("/api/auth/staff", json={"code": 9001, "password": "BaxiDemo!2026"})
    assert len(client.get("/api/staff/reports").json()) == 20
    driver = client.get("/api/staff/drivers").json()[0]
    assert client.get(f"/api/documents/{driver['id']}/national").status_code == 200
    assert client.get(f"/api/documents/{driver['id']}/vehicle").status_code == 200
    assert "national_code" not in driver and "shaba_number" not in driver


def test_driver_cannot_read_other_drivers_documents(client):
    login(client, "driver", "09120000030")
    own_id = client.get("/api/me").json()["account"]["id"]
    assert client.get(f"/api/documents/{own_id}/national").status_code == 200
    assert client.get(f"/api/documents/{own_id + 1}/national").status_code == 403


def test_pending_driver_cannot_reference_another_upload(client):
    import uuid

    phone = "09" + str(uuid.uuid4().int % 10**9).zfill(9)
    code = client.post("/api/auth/code", json={"phone": phone}).json()["demo_code"]
    assert (
        client.post(
            "/api/auth/verify",
            json={"phone": phone, "code": code, "role": "driver", "signup": True},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/documents", files={"file": ("fake.png", b"not-an-image", "image/png")}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/register",
            json={
                "first_name": "Test",
                "last_name": "Synthetic",
                "birth": "1990-01-01",
                "sex": "M",
                "documents": {
                    name: "data/uploads/somebody-elses.png"
                    for name in ("license", "national", "judicial", "vehicle")
                },
            },
        ).status_code
        == 403
    )


def test_auth_rate_limit(client):
    for _ in range(20):
        client.post("/api/auth/staff", json={"code": 9001, "password": "incorrect"})
    assert (
        client.post(
            "/api/auth/staff", json={"code": 9001, "password": "incorrect"}
        ).status_code
        == 429
    )
