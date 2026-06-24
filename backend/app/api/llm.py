from fastapi import APIRouter, HTTPException

from app import llm_service
from app.schemas import LLMStatusRead, LLMStructureRequest, LLMStructureResult

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/status", response_model=LLMStatusRead)
def get_llm_status():
    return LLMStatusRead(configured=llm_service.has_system_api_key(), model=llm_service.get_default_model())


def structure_text(payload: LLMStructureRequest, target_type: str) -> LLMStructureResult:
    api_key, model, base_url = llm_service.resolve_qwen_config(payload.api_key, payload.model, payload.base_url)
    try:
        result = llm_service.call_qwen_for_structure(
            raw_text=payload.raw_text,
            target_type=target_type,
            api_key=api_key,
            model=model,
            base_url=base_url,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：{exc.__class__.__name__}") from exc
    return LLMStructureResult(**result, model=model)


@router.post("/structure-requirement", response_model=LLMStructureResult)
def structure_requirement(payload: LLMStructureRequest):
    return structure_text(payload, "requirement")


@router.post("/structure-project", response_model=LLMStructureResult)
def structure_project(payload: LLMStructureRequest):
    return structure_text(payload, "project")
