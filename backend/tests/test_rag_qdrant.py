"""Qdrant 向量后端集成测试（使用内存 Qdrant + fastembed）。
首次运行会自动下载 embedding 模型（约 50MB），后续缓存在本地。
"""
import pytest

from app.rag.service import QdrantBackend


@pytest.fixture
def backend():
    b = QdrantBackend()
    b.clear()
    yield b
    b.clear()


def test_qdrant_ingest_and_retrieve(backend: QdrantBackend):
    doc_id, chunk_count = backend.ingest(
        title="楼宇节能方案",
        content="该方案支持楼宇能耗监测、告警和优化建议，适用于商业楼宇场景。基于 AI 算法分析能源消耗。",
        source_type="project",
        source_id="P-100",
        tags=["楼宇", "节能"],
        owner_role="研发",
    )

    assert doc_id.startswith("doc-")
    assert chunk_count >= 1

    results = backend.retrieve(query="楼宇能耗优化", top_k=3, filters={})
    assert len(results) >= 1
    assert "楼宇" in results[0].chunk.text
    assert results[0].score > 0


def test_qdrant_filter_by_source_type(backend: QdrantBackend):
    backend.ingest(
        title="数据中心冷却",
        content="数据中心冷却系统优化，减少 PUE 值。",
        source_type="project",
        source_id="P-200",
        tags=["数据中心"],
        owner_role="研发",
    )
    backend.ingest(
        title="客户需要楼宇管理系统",
        content="XX 客户需要楼宇管理系统，实现智能照明与空调控制。",
        source_type="requirement",
        source_id="R-300",
        tags=["楼宇"],
        owner_role="销售",
    )

    # 只检索 project
    results = backend.retrieve(query="管理系统", top_k=5, filters={"source_type": "project"})
    for r in results:
        assert r.chunk.source_type == "project"


def test_qdrant_filter_by_tags(backend: QdrantBackend):
    backend.ingest(
        title="能效分析平台",
        content="面向工业场景的能效分析和优化平台，覆盖电力和水务。",
        source_type="project",
        source_id="P-400",
        tags=["工业", "能效"],
        owner_role="研发",
    )
    backend.ingest(
        title="楼宇 HVAC 控制",
        content="楼宇暖通空调智能控制系统。",
        source_type="project",
        source_id="P-500",
        tags=["楼宇", "HVAC"],
        owner_role="研发",
    )

    results = backend.retrieve(query="能效优化", top_k=5, filters={"tags": ["工业"]})
    assert len(results) >= 1
    assert any("工业" in r.chunk.tags for r in results)
