from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint_accessible_from_frontend_proxy():
    """验证 /api/v1/health 端点可被前端通过 proxy 访问（前端 /api 请求转发到后端）"""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"

def test_demo_endpoint_returns_list():
    """验证 /api/v1/demo 端点返回数组数据"""
    response = client.get("/api/v1/demo")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["name"] == "测试项目"

def test_cors_allows_frontend_origin():
    """验证 CORS 允许 http://localhost:5173 来源"""
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        }
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
