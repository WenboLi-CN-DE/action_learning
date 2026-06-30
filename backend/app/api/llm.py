import re

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app import llm_service
from app.schemas import LLMImageRecognitionResult, LLMStatusRead, LLMStructureRequest, LLMStructureResult

router = APIRouter(prefix="/llm", tags=["llm"])
SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def redact_api_keys(text: str) -> str:
    return re.sub(r"sk-[A-Za-z0-9_\-]+", "[redacted]", text)


def extract_upstream_error(exc: httpx.HTTPStatusError) -> str:
    status_code = exc.response.status_code
    message = exc.response.text
    try:
        payload = exc.response.json()
        if isinstance(payload, dict):
            message = str(payload.get("message") or payload.get("error") or payload.get("detail") or message)
    except ValueError:
        pass
    return f"Qwen API 返回 {status_code}：{redact_api_keys(message)}"


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
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：{extract_upstream_error(exc)}") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：无法连接 Qwen API（{exc.__class__.__name__}）") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：{exc.__class__.__name__}") from exc
    return LLMStructureResult(**llm_service.normalize_structure_payload(result), model=model)


@router.post("/recognize-image", response_model=LLMImageRecognitionResult)
async def recognize_image(
    file: UploadFile = File(...),
    prompt: str = Form("请识别图片中的文字和业务信息，整理成可用于需求池或能力池录入的中文描述。"),
    api_key: str | None = Form(None),
    model: str | None = Form(None),
    base_url: str | None = Form(None),
):
    mime_type = file.content_type or ""
    if mime_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 PNG、JPG、JPEG、WEBP 图片")

    resolved_api_key, resolved_model, resolved_base_url = llm_service.resolve_qwen_config(api_key, model, base_url)
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="图片内容不能为空")

    try:
        text = llm_service.call_qwen_for_image_recognition(
            image_bytes=image_bytes,
            mime_type=mime_type,
            prompt=prompt,
            api_key=resolved_api_key,
            model=resolved_model,
            base_url=resolved_base_url,
        )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：{extract_upstream_error(exc)}") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：无法连接 Qwen API（{exc.__class__.__name__}）") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：{exc.__class__.__name__}") from exc

    return LLMImageRecognitionResult(text=text, model=resolved_model)


@router.post("/structure-requirement", response_model=LLMStructureResult)
def structure_requirement(payload: LLMStructureRequest):
    return structure_text(payload, "requirement")


@router.post("/structure-project", response_model=LLMStructureResult)
def structure_project(payload: LLMStructureRequest):
    return structure_text(payload, "project")
