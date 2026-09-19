"""Структурирование сырого текста поста из FB в JSON через LLM (OpenAI gpt-4o-mini)."""

import json

from openai import OpenAI

from config import Config

SYSTEM_PROMPT = """Jesteś parserem JSON dla polskiej branży TSL (transport-spedycja-logistyka).
Z tekstu posta z grupy facebookowej wyciągnij pola:
- is_relevant (bool): czy to realna oferta ładunku/transportu/magazynu z konkretnymi danymi
  (nie pytanie ogólne, nie reklama niezwiązana z transportem, nie spam)
- origin (string|null): miasto/miejscowość załadunku
- destination (string|null): miasto/miejscowość rozładunku
- origin_region (string|null): kod regionu załadunku — polskie województwo w formacie
  'PL-MZ','PL-MA','PL-WP','PL-DS','PL-LD','PL-PM','PL-SL','PL-LU','PL-PK','PL-PD','PL-ZP',
  'PL-LB','PL-KP','PL-WM','PL-SK','PL-OP', albo dwuliterowy kod kraju UE ('DE','FR','NL'...)
  jeśli miejscowości nie da się jednoznacznie przypisać — null
- destination_region (string|null): jak wyżej, dla miejsca docelowego
- truck_required (string|null): wymagany typ nadwozia, jedno z: firanka, chlodnia, bus, plandeka,
  albo null jeśli nie podano
- price (string|null): stawka/cena jeśli podana w tekście, jako surowy string
- contact_info (string|null): numer telefonu lub e-mail z tekstu (dokładnie jak w poście)

Odpowiedz WYŁĄCZNIE poprawnym JSON-em, bez żadnego dodatkowego tekstu."""


def parse_post(cfg: Config, raw_text: str) -> dict:
    client = OpenAI(api_key=cfg.openai_api_key)
    completion = client.chat.completions.create(
        model=cfg.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ],
        temperature=0,
    )
    content = completion.choices[0].message.content
    if not content:
        raise ValueError("Empty LLM response")
    return json.loads(content)
