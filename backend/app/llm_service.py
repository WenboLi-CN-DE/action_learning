import os

DEFAULT_QWEN_MODEL = "qwen3.6-plus"


def get_default_model() -> str:
    return os.getenv("QWEN_MODEL", DEFAULT_QWEN_MODEL)


def has_system_api_key() -> bool:
    return bool(os.getenv("QWEN_API_KEY"))
