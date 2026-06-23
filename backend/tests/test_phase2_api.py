from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_phase2_project_requirement_tag_and_match_flow():
    tag_response = client.post(
        "/api/v1/tags",
        json={"name": "工业自动化", "category": "industry"},
    )
    assert tag_response.status_code == 201
    tag = tag_response.json()
    assert tag["name"] == "工业自动化"

    project_response = client.post(
        "/api/v1/projects",
        json={
            "name": "预测性维护预研",
            "description": "面向关键设备的预测性维护能力验证",
            "owner": "研发团队",
            "status": "researching",
            "tag_ids": [tag["id"]],
        },
    )
    assert project_response.status_code == 201
    project = project_response.json()
    assert project["name"] == "预测性维护预研"
    assert project["tags"][0]["id"] == tag["id"]

    requirement_response = client.post(
        "/api/v1/requirements",
        json={
            "title": "客户需要设备异常提前预警",
            "description": "客户希望提前发现产线关键设备故障风险",
            "customer": "西安工厂客户",
            "contact": "销售一组",
            "urgency": "high",
            "status": "new",
            "tag_ids": [tag["id"]],
        },
    )
    assert requirement_response.status_code == 201
    requirement = requirement_response.json()
    assert requirement["customer"] == "西安工厂客户"
    assert requirement["tags"][0]["name"] == "工业自动化"

    match_response = client.post(
        "/api/v1/matches",
        json={
            "project_id": project["id"],
            "requirement_id": requirement["id"],
            "coverage_status": "partial",
            "note": "预研方向匹配，需要补现场数据接入。",
        },
    )
    assert match_response.status_code == 201
    match = match_response.json()
    assert match["project"]["id"] == project["id"]
    assert match["requirement"]["id"] == requirement["id"]
    assert match["coverage_status"] == "partial"

    list_response = client.get("/api/v1/matches")
    assert list_response.status_code == 200
    assert any(item["id"] == match["id"] for item in list_response.json())


def test_duplicate_match_returns_existing_link():
    project = client.post(
        "/api/v1/projects",
        json={"name": "重复匹配项目", "owner": "研发", "status": "researching", "tag_ids": []},
    ).json()
    requirement = client.post(
        "/api/v1/requirements",
        json={
            "title": "重复匹配需求",
            "description": "验证重复关联不产生多条记录",
            "customer": "测试客户",
            "urgency": "medium",
            "status": "new",
            "tag_ids": [],
        },
    ).json()

    payload = {
        "project_id": project["id"],
        "requirement_id": requirement["id"],
        "coverage_status": "covered",
        "note": "第一次创建",
    }
    first = client.post("/api/v1/matches", json=payload)
    second = client.post("/api/v1/matches", json={**payload, "note": "第二次创建"})

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["note"] == "第一次创建"


def test_match_requires_existing_project_and_requirement():
    response = client.post(
        "/api/v1/matches",
        json={
            "project_id": 999999,
            "requirement_id": 999999,
            "coverage_status": "uncovered",
            "note": "不存在的关联",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"
