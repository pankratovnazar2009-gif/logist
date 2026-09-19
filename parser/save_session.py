"""
Одноразовый скрипт: открывает настоящий видимый браузер, ты сам логинишься в Facebook
(руками, как обычный пользователь — включая любую 2FA/проверку, если Facebook её покажет),
после чего скрипт сохраняет cookies/storage state в файл. Дальше fb_scraper.py переиспользует
этот файл и никогда сам не вводит логин/пароль и не проходит проверки.

Запуск:
    python save_session.py
"""

from playwright.sync_api import sync_playwright

from config import load_config

def main() -> None:
    cfg = load_config()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://www.facebook.com/login")

        print("Zaloguj się ręcznie w otwartym oknie przeglądarki.")
        input("Gdy będziesz zalogowany(a) i widzisz swój feed — wciśnij Enter tutaj... ")

        context.storage_state(path=cfg.fb_storage_state_path)
        print(f"Zapisano sesję do {cfg.fb_storage_state_path}")
        browser.close()


if __name__ == "__main__":
    main()
