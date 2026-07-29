from datetime import timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api.pilot import router as pilot_router
from app.database import get_session
from app.models import (
    Project,
    ProjectRequirementMatch,
    Requirement,
    ReviewEvent,
    Tag,
    utc_now,
)


def build_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(pilot_router, prefix="/api/v1")

    def session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    return TestClient(app), engine


def seed_task_scenario(engine):
    now = utc_now()
    with Session(engine) as session:
        pending = Requirement(
            title="待审核节能需求",
            description="客户希望在本季度完成能耗分析并形成优化建议。",
            customer="示例客户",
            urgency="high",
            status="pending_review",
            submitted_by="销售甲",
            assigned_reviewer="管理员甲",
            created_at=now - timedelta(hours=60),
            updated_at=now - timedelta(hours=1),
        )
        unassigned = Requirement(
            title="待指派审核人",
            description="客户希望对产线设备异常进行提前预警和闭环管理。",
            customer="制造客户",
            urgency="medium",
            status="pending_review",
            submitted_by="销售乙",
            created_at=now - timedelta(hours=12),
            updated_at=now - timedelta(hours=12),
        )
        accepted = Requirement(
            title="待编排能力关联",
            description="客户需要在多个站点统一分析配电设备运行风险。",
            customer="园区客户",
            urgency="medium",
            status="accepted",
            submitted_by="销售甲",
            created_at=now - timedelta(hours=90),
            reviewed_at=now - timedelta(hours=80),
            updated_at=now - timedelta(hours=1),
        )
        draft = Requirement(
            title="需要补充的需求",
            description="客户希望补充具体业务场景和预期交付成果。",
            customer="测试客户",
            urgency="low",
            status="draft",
            submitted_by="销售甲",
            created_at=now - timedelta(hours=4),
            updated_at=now - timedelta(hours=4),
        )
        technical_requirement = Requirement(
            title="等待技术确认的需求",
            description="客户需要评估现有能力是否能够覆盖能源管理场景。",
            customer="能源客户",
            urgency="high",
            status="matching",
            submitted_by="销售丙",
            created_at=now - timedelta(hours=90),
            updated_at=now - timedelta(hours=80),
        )
        project = Project(
            name="能耗分析能力",
            description="支持能耗监测、基线分析和节能建议。",
            owner="研发甲",
            status="demo_ready",
        )
        session.add_all(
            [pending, unassigned, accepted, draft, technical_requirement, project]
        )
        session.commit()
        for item in [
            pending,
            unassigned,
            accepted,
            draft,
            technical_requirement,
            project,
        ]:
            session.refresh(item)

        technical = ProjectRequirementMatch(
            project_id=project.id,
            requirement_id=technical_requirement.id,
            coverage_status="partial",
            source="ai",
            created_by="管理员甲",
            review_status="technical_pending",
            created_at=now - timedelta(hours=80),
            updated_at=now - timedelta(hours=80),
        )
        final = ProjectRequirementMatch(
            project_id=project.id,
            requirement_id=pending.id,
            coverage_status="covered",
            source="manual",
            created_by="管理员乙",
            review_status="final_pending",
            reviewed_by="研发乙",
            reviewed_at=now - timedelta(hours=50),
            created_at=now - timedelta(hours=60),
            updated_at=now - timedelta(hours=1),
        )
        session.add_all([technical, final])
        session.add_all(
            [
                ReviewEvent(
                    target_type="requirement",
                    target_id=pending.id,
                    action="assign_reviewer",
                    actor="管理员乙",
                    note="指派审核负责人：管理员甲",
                    from_status="pending_review",
                    to_status="pending_review",
                    created_at=now - timedelta(hours=60),
                ),
                ReviewEvent(
                    target_type="requirement",
                    target_id=accepted.id,
                    action="match_rejected",
                    actor="管理员乙",
                    from_status="matching",
                    to_status="accepted",
                    created_at=now - timedelta(hours=80),
                ),
            ]
        )
        session.commit()


def test_personal_tasks_follow_role_responsibility_and_sla():
    client, engine = build_client()
    seed_task_scenario(engine)

    admin = client.get(
        "/api/v1/pilot/tasks",
        params={"role": "admin", "actor": "管理员甲"},
    )
    assert admin.status_code == 200
    admin_payload = admin.json()
    assert admin_payload["total"] == 4
    assert admin_payload["overdue"] == 3
    assert [item["task_type"] for item in admin_payload["items"]] == [
        "review_requirement",
        "final_review",
        "orchestrate_match",
        "assign_reviewer",
    ]
    assert admin_payload["items"][0]["sla_hours"] == 48
    assert admin_payload["items"][0]["overdue"] is True
    assert admin_payload["items"][0]["action_label"] == "审核需求"

    research = client.get(
        "/api/v1/pilot/tasks",
        params={"role": "research", "actor": "研发甲"},
    )
    assert research.status_code == 200
    assert research.json()["total"] == 1
    assert research.json()["items"][0]["task_type"] == "technical_review"
    assert research.json()["items"][0]["sla_hours"] == 72

    sales = client.get(
        "/api/v1/pilot/tasks",
        params={"role": "sales", "actor": "销售甲"},
    )
    assert sales.status_code == 200
    assert sales.json()["total"] == 1
    assert sales.json()["items"][0]["task_type"] == "complete_draft"


def test_personal_tasks_reject_unknown_role_or_blank_actor():
    client, _ = build_client()

    unknown_role = client.get(
        "/api/v1/pilot/tasks",
        params={"role": "guest", "actor": "访客"},
    )
    assert unknown_role.status_code == 400

    blank_actor = client.get(
        "/api/v1/pilot/tasks",
        params={"role": "admin", "actor": "   "},
    )
    assert blank_actor.status_code == 400


def seed_metrics_scenario(engine):
    now = utc_now()
    with Session(engine) as session:
        tag = Tag(name="数据中心", category="industry")
        high_project = Project(
            name="数据中心能效能力",
            description="支持能耗采集、基线分析、PUE 诊断和节能优化建议。",
            owner="研发甲",
            status="demo_ready",
            tags=[tag],
        )
        low_project = Project(
            name="历史能力",
            description=None,
            owner="历史负责人",
            status="researching",
        )
        reviewed_a = Requirement(
            title="完成受理的需求",
            description="客户需要完成能耗基线分析并识别制冷系统的节能空间。",
            customer="客户 A",
            contact="联系人 A",
            urgency="high",
            status="accepted",
            submitted_by="销售甲",
            assigned_reviewer="管理员甲",
            reviewed_by="管理员甲",
            created_at=now - timedelta(hours=100),
            updated_at=now - timedelta(hours=80),
            tags=[tag],
        )
        reviewed_b = Requirement(
            title="被退回的需求",
            description="客户需要补充设备范围、数据接口和预期交付结果。",
            customer="客户 B",
            contact="联系人 B",
            urgency="medium",
            status="draft",
            submitted_by="销售乙",
            assigned_reviewer="管理员乙",
            created_at=now - timedelta(hours=70),
            updated_at=now - timedelta(hours=10),
            tags=[tag],
        )
        matched = Requirement(
            title="AI 已采纳样例",
            description="客户需要通过统一监控和分析降低数据中心整体能源消耗。",
            customer="客户 C",
            contact="联系人 C",
            urgency="high",
            status="matched",
            submitted_by="销售甲",
            created_at=now - timedelta(hours=120),
            updated_at=now - timedelta(hours=20),
            tags=[tag],
        )
        rejected = Requirement(
            title="AI 未采纳样例",
            description="客户需要评估当前方案是否能够覆盖实时数据处理场景。",
            customer="客户 D",
            contact="联系人 D",
            urgency="medium",
            status="accepted",
            submitted_by="销售乙",
            created_at=now - timedelta(hours=80),
            updated_at=now - timedelta(hours=10),
            tags=[tag],
        )
        accepted_without_match = Requirement(
            title="尚无候选能力",
            description="客户需要分析园区多个站点的配电设备健康状态。",
            customer="客户 E",
            contact="联系人 E",
            urgency="low",
            status="accepted",
            submitted_by="销售甲",
            created_at=now - timedelta(hours=50),
            updated_at=now - timedelta(hours=40),
            tags=[tag],
        )
        assigned_pending = Requirement(
            title="已指派待审核",
            description="客户需要确认楼宇控制系统升级的范围和实施计划。",
            customer="客户 F",
            urgency="medium",
            status="pending_review",
            submitted_by="销售甲",
            assigned_reviewer="管理员甲",
        )
        unassigned_pending = Requirement(
            title="未指派待审核",
            description="客户需要确认工厂能源管理平台的建设边界和目标。",
            customer="客户 G",
            urgency="medium",
            status="pending_review",
            submitted_by="销售乙",
        )
        low_requirement = Requirement(
            title="历史低质量需求",
            description="具体可联系",
            customer="历史客户",
            urgency="medium",
            status="new",
        )
        invalid_requirement = Requirement(
            title="",
            description="客户希望形成一份包含业务范围、数据来源、分析目标和预期交付结果的完整报告。",
            customer="",
            urgency="unexpected",
            status="new",
            submitted_by="销售丙",
        )
        invalid_project = Project(
            name="",
            description="支持现场数据采集、运行诊断和优化建议输出。",
            owner="",
            status="",
        )
        session.add_all(
            [
                high_project,
                low_project,
                invalid_project,
                reviewed_a,
                reviewed_b,
                matched,
                rejected,
                accepted_without_match,
                assigned_pending,
                unassigned_pending,
                low_requirement,
                invalid_requirement,
            ]
        )
        session.commit()
        for item in [
            high_project,
            low_project,
            reviewed_a,
            reviewed_b,
            matched,
            rejected,
        ]:
            session.refresh(item)

        approved_match = ProjectRequirementMatch(
            project_id=high_project.id,
            requirement_id=matched.id,
            coverage_status="covered",
            source="ai",
            ai_score=90,
            ai_reason="需求场景与能力高度一致。",
            ai_gaps=["现场接口"],
            review_status="approved",
            created_by="管理员甲",
            reviewed_by="管理员乙",
            created_at=now - timedelta(hours=100),
            updated_at=now - timedelta(hours=20),
        )
        rejected_match = ProjectRequirementMatch(
            project_id=low_project.id,
            requirement_id=rejected.id,
            coverage_status="partial",
            source="ai",
            ai_score=70,
            ai_reason="基础方向相关，但交付能力不足。",
            ai_gaps=["现场接口", "实时数据"],
            review_status="rejected",
            created_by="管理员甲",
            reviewed_by="研发甲",
            created_at=now - timedelta(hours=60),
            updated_at=now - timedelta(hours=10),
        )
        pending_match = ProjectRequirementMatch(
            project_id=high_project.id,
            requirement_id=reviewed_a.id,
            coverage_status="partial",
            source="ai",
            ai_score=80,
            ai_reason="需要进一步确认数据范围。",
            review_status="technical_pending",
            created_by="管理员乙",
            created_at=now - timedelta(hours=12),
            updated_at=now - timedelta(hours=12),
        )
        session.add_all([approved_match, rejected_match, pending_match])
        session.commit()
        session.refresh(approved_match)
        session.refresh(rejected_match)

        session.add_all(
            [
                ReviewEvent(
                    target_type="requirement",
                    target_id=reviewed_a.id,
                    action="approve",
                    actor="管理员甲",
                    from_status="pending_review",
                    to_status="accepted",
                    created_at=now - timedelta(hours=80),
                ),
                ReviewEvent(
                    target_type="requirement",
                    target_id=reviewed_b.id,
                    action="return",
                    actor="管理员乙",
                    from_status="pending_review",
                    to_status="draft",
                    created_at=now - timedelta(hours=10),
                ),
                ReviewEvent(
                    target_type="match",
                    target_id=approved_match.id,
                    action="final_approve",
                    actor="管理员乙",
                    from_status="final_pending",
                    to_status="approved",
                    created_at=now - timedelta(hours=20),
                ),
                ReviewEvent(
                    target_type="match",
                    target_id=rejected_match.id,
                    action="final_reject",
                    actor="管理员甲",
                    from_status="final_pending",
                    to_status="rejected",
                    created_at=now - timedelta(hours=10),
                ),
            ]
        )
        session.commit()


def test_pilot_metrics_expose_quality_workflow_and_ai_evaluation():
    client, engine = build_client()
    seed_metrics_scenario(engine)

    response = client.get("/api/v1/pilot/metrics")
    assert response.status_code == 200
    payload = response.json()

    quality_records = {
        (item["target_type"], item["title"]): item
        for item in payload["data_quality"]["records"]
    }
    assert quality_records[("requirement", "历史低质量需求")]["score"] == 40
    assert quality_records[("requirement", "历史低质量需求")]["issues"] == [
        "需求描述不足",
        "缺少联系人",
        "缺少提交人",
        "缺少标签",
    ]
    assert quality_records[("project", "历史能力")]["score"] == 55
    assert quality_records[("project", "历史能力")]["issues"] == [
        "缺少能力描述",
        "缺少标签",
    ]
    assert quality_records[("requirement", "")]["issues"] == [
        "缺少需求标题",
        "缺少客户",
        "缺少联系人",
        "缺少标签",
        "紧急度未规范",
    ]
    assert quality_records[("project", "")]["issues"] == [
        "缺少能力名称",
        "缺少负责人",
        "缺少能力状态",
        "缺少标签",
    ]

    workflow = payload["workflow"]
    assert workflow["reviewer_assignment_rate"] == 50
    assert workflow["candidate_coverage_rate"] == 75
    assert workflow["average_requirement_review_hours"] == 40
    assert workflow["average_match_cycle_hours"] == 65

    ai = payload["ai_evaluation"]
    assert ai["total_candidates"] == 3
    assert ai["reviewed_candidates"] == 2
    assert ai["approved_candidates"] == 1
    assert ai["rejected_candidates"] == 1
    assert ai["adoption_rate"] == 50
    assert ai["average_score"] == 80
    assert ai["samples"][0]["outcome"] in {
        "待技术确认",
        "已采纳",
        "未采纳",
    }

    assert payload["gap_distribution"] == [
        {"gap": "现场接口", "count": 2},
        {"gap": "实时数据", "count": 1},
    ]
