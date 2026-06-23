from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_create_and_list_project_comments():
    project = client.post(
        "/api/v1/projects",
        json={"name": "评论项目", "owner": "研发", "status": "researching", "tag_ids": []},
    ).json()

    create_response = client.post(
        "/api/v1/comments",
        json={
            "target_type": "project",
            "target_id": project["id"],
            "author": "销售一组",
            "content": "客户对这个预研方向有兴趣。",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["target_type"] == "project"
    assert created["target_id"] == project["id"]
    assert created["author"] == "销售一组"
    assert created["content"] == "客户对这个预研方向有兴趣。"

    list_response = client.get(f"/api/v1/comments?target_type=project&target_id={project['id']}")
    assert list_response.status_code == 200
    comments = list_response.json()
    assert len(comments) == 1
    assert comments[0]["id"] == created["id"]


def test_create_and_list_requirement_comments():
    requirement = client.post(
        "/api/v1/requirements",
        json={
            "title": "评论需求",
            "description": "客户需要补充说明",
            "customer": "测试客户",
            "urgency": "medium",
            "status": "new",
            "tag_ids": [],
        },
    ).json()

    create_response = client.post(
        "/api/v1/comments",
        json={
            "target_type": "requirement",
            "target_id": requirement["id"],
            "author": "咨询顾问",
            "content": "需要研发确认边界条件。",
        },
    )

    assert create_response.status_code == 201
    list_response = client.get(f"/api/v1/comments?target_type=requirement&target_id={requirement['id']}")
    assert list_response.status_code == 200
    assert [comment["content"] for comment in list_response.json()] == ["需要研发确认边界条件。"]


def test_comment_requires_valid_target():
    invalid_type_response = client.post(
        "/api/v1/comments",
        json={
            "target_type": "unknown",
            "target_id": 1,
            "author": "测试",
            "content": "非法类型",
        },
    )
    assert invalid_type_response.status_code == 400
    assert invalid_type_response.json()["detail"] == "Invalid comment target type"

    missing_target_response = client.post(
        "/api/v1/comments",
        json={
            "target_type": "project",
            "target_id": 999999,
            "author": "测试",
            "content": "不存在的对象",
        },
    )
    assert missing_target_response.status_code == 404
    assert missing_target_response.json()["detail"] == "Project not found"
