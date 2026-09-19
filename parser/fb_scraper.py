"""
Скрейпер открытых постов Facebook-групп через Playwright с уже сохранённой сессией.

Важное ограничение (сознательное, не баг): скрипт НИКОГДА не пытается сам пройти логин,
капчу или checkpoint/проверку личности. Если Facebook показывает что-то из этого —
is_checkpoint() возвращает True, run_scrape_cycle() прерывает обход и возвращает то,
что успело собраться, залогировав предупреждение. В таком случае нужно руками перезапустить
save_session.py и обновить fb_storage_state.json.
"""

import re
from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from config import Config

CHECKPOINT_MARKERS = ("checkpoint", "login", "two_step_verification", "recover")


@dataclass
class ScrapedPost:
    text: str
    permalink: str | None


def is_checkpoint(page: Page) -> bool:
    url = page.url.lower()
    return any(marker in url for marker in CHECKPOINT_MARKERS)


def scrape_group(page: Page, group_url: str, max_posts: int = 15) -> list[ScrapedPost]:
    page.goto(group_url, wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(2_000)

    if is_checkpoint(page):
        raise RuntimeError(f"Facebook wymaga weryfikacji (checkpoint) na {page.url} — sesja wygasła")

    # Facebook nie ma stabilnych, publicznych selektorów CSS — struktura DOM zmienia się
    # regularnie. role="article" jest najbardziej odpornym punktem zaczepienia dla postów.
    for _ in range(4):
        page.mouse.wheel(0, 2500)
        page.wait_for_timeout(1_200)

    articles = page.locator('div[role="article"]').all()
    posts: list[ScrapedPost] = []

    for article in articles[:max_posts]:
        text = article.inner_text().strip()
        if not text:
            continue

        permalink = None
        link = article.locator('a[href*="/posts/"], a[href*="/permalink/"]').first
        if link.count() > 0:
            href = link.get_attribute("href")
            if href:
                permalink = re.sub(r"\?.*$", "", href)

        posts.append(ScrapedPost(text=text, permalink=permalink))

    return posts


def run_scrape_cycle(cfg: Config, group_urls: list[str]) -> dict[str, list[ScrapedPost]]:
    """Возвращает {group_url: [ScrapedPost, ...]}. Останавливается на первом checkpoint'е."""
    storage_path = Path(cfg.fb_storage_state_path)
    if not storage_path.exists():
        raise RuntimeError(
            f"Brak pliku sesji {storage_path}. Uruchom najpierw: python save_session.py"
        )

    results: dict[str, list[ScrapedPost]] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(storage_path))
        page = context.new_page()

        for url in group_urls:
            try:
                results[url] = scrape_group(page, url)
            except RuntimeError as err:
                print(f"[fb_scraper] STOP: {err}")
                break
            except Exception as err:  # noqa: BLE001 — logujemy i idziemy dalej do kolejnej grupy
                print(f"[fb_scraper] Błąd przy {url}: {err}")
                results[url] = []

        browser.close()

    return results
