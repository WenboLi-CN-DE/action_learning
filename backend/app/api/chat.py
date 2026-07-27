import httpx
from fastapi import APIRouter, HTTPException

from app import llm_service
from app.rag import service as rag_service
from app.schemas import ChatRequest, ChatResult, RAGCitationRead


router = APIRouter(prefix="/chat", tags=["chatbot"])


@router.post("", response_model=ChatResult)
def chat(payload: ChatRequest):
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")
    latest = payload.messages[-1]
    if latest.role != "user" or not latest.content.strip():
        raise HTTPException(status_code=400, detail="最后一条消息必须是用户问题")

    results = rag_service.get_backend().retrieve(
        query=latest.content,
        top_k=payload.top_k,
        filters={},
    )
    if not results:
        return ChatResult(
            answer="知识库中暂未检索到足够资料，请补充知识文档后再试。",
            model=payload.model or llm_service.get_default_model(),
        )

    api_key, model, base_url = llm_service.resolve_qwen_config(
        payload.api_key,
        payload.model,
        payload.base_url,
    )
    context = "\n\n".join(
        f"[{index}] {item.chunk.title}\n{item.chunk.text}"
        for index, item in enumerate(results, start=1)
    )
    history = [
        {"role": message.role, "content": message.content}
        for message in payload.messages[:-1]
        if message.role in {"user", "assistant"} and message.content.strip()
    ]
    try:
        answer = llm_service.call_qwen_for_rag_chat(
            question=latest.content,
            history=history,
            context=context,
            api_key=api_key,
            model=model,
            base_url=base_url,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Chatbot 调用失败：上游服务返回 {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Chatbot 调用失败：无法连接模型服务",
        ) from exc
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Chatbot 调用失败：模型返回格式无效",
        ) from exc

    citations = [
        RAGCitationRead(
            chunk_id=item.chunk.chunk_id,
            doc_id=item.chunk.doc_id,
            title=item.chunk.title,
            score=item.score,
        )
        for item in results
    ]
    return ChatResult(answer=answer, citations=citations, model=model)
