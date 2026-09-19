import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


@dataclass(frozen=True)
class Config:
    backend_url: str
    internal_api_key: str
    openai_api_key: str
    openai_model: str
    fb_storage_state_path: str
    poll_interval_seconds: int


def load_config() -> Config:
    return Config(
        backend_url=os.environ.get("BACKEND_URL", "http://localhost:4000"),
        internal_api_key=_require("INTERNAL_API_KEY"),
        openai_api_key=_require("OPENAI_API_KEY"),
        openai_model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        fb_storage_state_path=os.environ.get("FB_STORAGE_STATE_PATH", "./fb_storage_state.json"),
        poll_interval_seconds=int(os.environ.get("POLL_INTERVAL_SECONDS", "900")),
    )
