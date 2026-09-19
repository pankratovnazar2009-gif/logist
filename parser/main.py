"""
Точка входа парсера. Раз в POLL_INTERVAL_SECONDS обходит активные группы (список берётся
у backend), скрейпит новые посты, прогоняет каждый через LLM и, если пост релевантен,
шлёт структурированные данные в backend (POST /api/internal/loads) — там уже происходит
дедупликация по хэшу текста, матчинг с перевозчиками и отправка SMS.

Запуск (после того как один раз сделан `python save_session.py`):
    python main.py
"""

import hashlib
import time

from backend_client import get_active_groups, mark_group_checked, submit_load
from config import load_config
from fb_scraper import run_scrape_cycle
from llm_parser import parse_post


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def run_once() -> None:
    cfg = load_config()
    groups = get_active_groups(cfg)
    if not groups:
        print("[main] Brak aktywnych grup do sprawdzenia")
        return

    group_urls = [g["url"] for g in groups]
    scraped_by_url = run_scrape_cycle(cfg, group_urls)

    for group in groups:
        posts = scraped_by_url.get(group["url"], [])
        for post in posts:
            try:
                parsed = parse_post(cfg, post.text)
            except Exception as err:  # noqa: BLE001
                print(f"[main] LLM parse failed: {err}")
                continue

            if not parsed.get("is_relevant"):
                continue

            payload = {
                "origin": parsed.get("origin"),
                "destination": parsed.get("destination"),
                "origin_region": parsed.get("origin_region"),
                "destination_region": parsed.get("destination_region"),
                "truck_required": parsed.get("truck_required"),
                "price": parsed.get("price"),
                "contact_info": parsed.get("contact_info") or post.permalink,
                "raw_text": post.text,
                "raw_text_hash": hash_text(post.text),
            }

            try:
                result = submit_load(cfg, payload)
                if result.get("inserted"):
                    print(f"[main] Nowy ładunek dodany, powiadomiono {result.get('notified', 0)} przewoźników")
            except Exception as err:  # noqa: BLE001
                print(f"[main] submit_load failed: {err}")

        try:
            mark_group_checked(cfg, group["id"])
        except Exception as err:  # noqa: BLE001
            print(f"[main] mark_group_checked failed dla {group['url']}: {err}")


def main() -> None:
    cfg = load_config()
    while True:
        try:
            run_once()
        except Exception as err:  # noqa: BLE001 — cykl nie powinien ubić całego procesu
            print(f"[main] Cykl zakończony błędem: {err}")
        time.sleep(cfg.poll_interval_seconds)


if __name__ == "__main__":
    main()
