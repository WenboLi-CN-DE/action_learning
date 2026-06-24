from fastapi import APIRouter

from app.llm_service import get_default_model, has_system_api_key
from app.schemas import LLMStatusRead

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/status", response_model=LLMStatusRead)
def get_llm_status():
    return LLMStatusRead(configured=has_system_api_key(), model=get_default_model())
