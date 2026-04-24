from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "AI工坊平台", "version": "0.1.0"}

@router.get("/demo")
def demo_data():
    return [{"id": 1, "name": "测试项目", "description": "联调测试数据"}]
