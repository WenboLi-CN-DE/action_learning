from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_returns_200():
    response = client.get("/api/v1/health")
    assert response.status_code == 200

def test_health_returns_ok_status():
    response = client.get("/api/v1/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "AI工坊平台"

def test_demo_endpoint_returns_data():
    response = client.get("/api/v1/demo")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_cors_headers_present():
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        }
    )
    assert "access-control-allow-origin" in response.headers
