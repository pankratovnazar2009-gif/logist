"""Тонкий клиент к внутренним эндпоинтам backend (единственная точка записи в БД)."""

import httpx

from config import Config


def _headers(cfg: Config) -> dict:
    return {"x-internal-key": cfg.internal_api_key}


def get_active_groups(cfg: Config) -> list[dict]:
    res = httpx.get(f"{cfg.backend_url}/api/internal/fb-groups", headers=_headers(cfg), timeout=30)
    res.raise_for_status()
    return res.json()["groups"]


def mark_group_checked(cfg: Config, group_id: str) -> None:
    res = httpx.post(
        f"{cfg.backend_url}/api/internal/fb-groups/{group_id}/checked", headers=_headers(cfg), timeout=30
    )
    res.raise_for_status()


def submit_load(cfg: Config, payload: dict) -> dict:
    res = httpx.post(f"{cfg.backend_url}/api/internal/loads", headers=_headers(cfg), json=payload, timeout=30)
    res.raise_for_status()
    return res.json()
