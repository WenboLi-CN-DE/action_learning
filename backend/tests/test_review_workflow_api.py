from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _create_requirement(status: str = "pending_review"):
    initial_status = "draft" if status == "draft" else "pending_review"
    requirement = client.post(
        "/api/v1/requirements",
        json={
            "title": "冷站节能评估审核需求",
            "description": "客户希望先完成冷站运行数据评估，再确认优化范围。",
            "customer": "华东园区客户",
            "contact": "张销售",
            "urgency": "high",
            "status": initial_status,
            "submitted_by": "张销售",
            "tag_ids": [],
        },
    ).json()
    if status == "accepted":
        return client.post(
            f"/api/v1/requirements/{requirement['id']}/review",
            json={"action": "approve", "reviewer": "测试管理员"},
        ).json()
    return requirement


def _create_project():
    return client.post(
        "/api/v1/projects",
        json={
            "name": "冷站群控优化能力",
            "description": "提供冷站诊断、策略优化和节能评估。",
            "owner": "李研发",
            "status": "demo_ready",
            "tag_ids": [],
        },
    ).json()


def test_admin_can_approve_pending_requirement_and_audit_is_visible():
    requirement = _create_requirement()

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/review",
        json={
            "action": "approve",
            "reviewer": "王管理员",
            "note": "信息完整，同意受理。",
        },
    )

    assert response.status_code == 200
    reviewed = response.json()
    assert reviewed["status"] == "accepted"
    assert reviewed["reviewed_by"] == "王管理员"
    assert reviewed["review_note"] == "信息完整，同意受理。"
    assert reviewed["reviewed_at"] is not None

    events = client.get(
        f"/api/v1/review-events?target_type=requirement&target_id={requirement['id']}"
    )
    assert events.status_code == 200
    assert events.json()[-1]["action"] == "approve"
    assert events.json()[-1]["actor"] == "王管理员"


def test_admin_can_return_requirement_to_draft():
    requirement = _create_requirement()

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/review",
        json={
            "action": "return",
            "reviewer": "王管理员",
            "note": "请补充现场接口和时间计划。",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "draft"


def test_returning_requirement_requires_a_review_note():
    requirement = _create_requirement()

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/review",
        json={
            "action": "return",
            "reviewer": "王管理员",
        },
    )

    assert response.status_code == 400


def test_admin_can_assign_legacy_requirement_to_a_reviewer():
    requirement = client.post(
        "/api/v1/requirements",
        json={
            "title": "历史需求纳入审核",
            "description": "管理员指派审核负责人后进入待审核状态。",
            "customer": "历史客户",
            "status": "new",
            "submitted_by": "张销售",
            "tag_ids": [],
        },
    ).json()

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/assign-reviewer",
        json={
            "reviewer": "王管理员",
            "actor": "李管理员",
        },
    )

    assert response.status_code == 200
    assert response.json()["assigned_reviewer"] == "王管理员"
    assert response.json()["status"] == "pending_review"

    events = client.get(
        f"/api/v1/review-events?target_type=requirement&target_id={requirement['id']}"
    ).json()
    assert events[-1]["action"] == "assign_reviewer"
    assert events[-1]["actor"] == "李管理员"


def test_only_assigned_reviewer_can_review_requirement():
    requirement = _create_requirement()
    assigned = client.post(
        f"/api/v1/requirements/{requirement['id']}/assign-reviewer",
        json={
            "reviewer": "王管理员",
            "actor": "李管理员",
        },
    )
    assert assigned.status_code == 200

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/review",
        json={
            "action": "approve",
            "reviewer": "赵管理员",
        },
    )

    assert response.status_code == 409


def test_match_requires_technical_confirmation_and_final_approval():
    requirement = _create_requirement(status="accepted")
    project = _create_project()

    created = client.post(
        "/api/v1/matches",
        json={
            "project_id": project["id"],
            "requirement_id": requirement["id"],
            "coverage_status": "partial",
            "note": "能力方向匹配，需确认数据接口。",
            "created_by": "王管理员",
        },
    )

    assert created.status_code == 201
    assert created.json()["review_status"] == "technical_pending"

    technical_approved = client.post(
        f"/api/v1/matches/{created.json()['id']}/review",
        json={
            "action": "technical_approve",
            "reviewer": "赵研发",
            "note": "确认能力可进入联合方案设计。",
        },
    )

    assert technical_approved.status_code == 200
    assert technical_approved.json()["review_status"] == "final_pending"
    assert technical_approved.json()["reviewed_by"] == "赵研发"

    requirement_before_final_approval = client.get(
        f"/api/v1/requirements/{requirement['id']}"
    ).json()
    assert requirement_before_final_approval["status"] == "matching"

    final_approved = client.post(
        f"/api/v1/matches/{created.json()['id']}/review",
        json={
            "action": "final_approve",
            "reviewer": "李管理员",
            "note": "审核链完整，同意正式生效。",
        },
    )

    assert final_approved.status_code == 200
    assert final_approved.json()["review_status"] == "approved"
    assert final_approved.json()["reviewed_by"] == "李管理员"
    assert final_approved.json()["reviewed_at"] is not None

    requirement_after_final_approval = client.get(
        f"/api/v1/requirements/{requirement['id']}"
    ).json()
    assert requirement_after_final_approval["status"] == "matched"

    events = client.get(
        f"/api/v1/review-events?target_type=match&target_id={created.json()['id']}"
    ).json()
    assert [event["action"] for event in events[-2:]] == [
        "technical_approve",
        "final_approve",
    ]


def test_rejecting_the_last_pending_match_returns_requirement_to_accepted():
    requirement = _create_requirement(status="accepted")
    project = _create_project()
    created = client.post(
        "/api/v1/matches",
        json={
            "project_id": project["id"],
            "requirement_id": requirement["id"],
            "coverage_status": "partial",
            "created_by": "王管理员",
        },
    ).json()

    rejected = client.post(
        f"/api/v1/matches/{created['id']}/review",
        json={
            "action": "technical_reject",
            "reviewer": "赵研发",
            "note": "当前能力范围不足。",
        },
    )

    assert rejected.status_code == 200
    assert rejected.json()["review_status"] == "rejected"
    refreshed_requirement = client.get(
        f"/api/v1/requirements/{requirement['id']}"
    ).json()
    assert refreshed_requirement["status"] == "accepted"


def test_match_creator_cannot_review_own_association():
    requirement = _create_requirement(status="accepted")
    project = _create_project()
    created = client.post(
        "/api/v1/matches",
        json={
            "project_id": project["id"],
            "requirement_id": requirement["id"],
            "coverage_status": "partial",
            "created_by": "王管理员",
        },
    ).json()

    response = client.post(
        f"/api/v1/matches/{created['id']}/review",
        json={
            "action": "technical_approve",
            "reviewer": "王管理员",
        },
    )

    assert response.status_code == 409


def test_rejecting_a_match_requires_a_review_note():
    requirement = _create_requirement(status="accepted")
    project = _create_project()
    created = client.post(
        "/api/v1/matches",
        json={
            "project_id": project["id"],
            "requirement_id": requirement["id"],
            "coverage_status": "partial",
            "created_by": "王管理员",
        },
    ).json()

    response = client.post(
        f"/api/v1/matches/{created['id']}/review",
        json={
            "action": "technical_reject",
            "reviewer": "赵研发",
        },
    )

    assert response.status_code == 400


def test_invalid_requirement_review_transition_is_rejected():
    requirement = _create_requirement(status="draft")

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/review",
        json={"action": "approve", "reviewer": "王管理员"},
    )

    assert response.status_code == 409


def test_returned_draft_can_be_resubmitted_for_review():
    requirement = _create_requirement(status="draft")

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/transition",
        json={
            "target_status": "pending_review",
            "actor": "张销售",
            "note": "已补充现场接口和时间计划。",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "pending_review"

    events = client.get(
        f"/api/v1/review-events?target_type=requirement&target_id={requirement['id']}"
    ).json()
    assert events[-1]["action"] == "transition"
    assert events[-1]["to_status"] == "pending_review"


def test_legacy_new_requirement_can_enter_the_review_workflow():
    requirement = client.post(
        "/api/v1/requirements",
        json={
            "title": "历史新需求",
            "description": "兼容旧版 new 状态进入审核流程。",
            "customer": "历史客户",
            "status": "new",
            "tag_ids": [],
        },
    ).json()

    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/transition",
        json={"target_status": "pending_review", "actor": "张销售"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "pending_review"


def test_generic_edit_cannot_bypass_requirement_state_machine():
    requirement = _create_requirement(status="accepted")

    response = client.patch(
        f"/api/v1/requirements/{requirement['id']}",
        json={"status": "matched"},
    )

    assert response.status_code == 409


def test_requirement_cannot_be_created_in_a_later_workflow_state():
    response = client.post(
        "/api/v1/requirements",
        json={
            "title": "绕过审核的需求",
            "description": "不允许在创建时直接进入已匹配。",
            "customer": "测试客户",
            "status": "matched",
            "tag_ids": [],
        },
    )

    assert response.status_code == 409
