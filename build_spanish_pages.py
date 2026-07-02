from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "es"
SOURCES = (ROOT / "index.html", ROOT / "referral.html")
SKIP_TAGS = {"script", "style", "svg", "code"}
TRANSLATABLE_ATTRIBUTES = {"alt", "aria-label", "placeholder", "title"}
PROTECTED_TERMS = (
    "PillowFlow Founding Drivers",
    "American Trucking Associations",
    "U.S. Bureau of Labor Statistics",
    "HomeAssist Home Health",
    "TV InstallationOne",
    "DAT Freight & Analytics",
    "Bovenzi & Hulshof",
    "Kolich & Taboun",
    "De Looze et al.",
    "Symple Foods",
    "Gyi & Porter",
    "connect@pillowflow.com",
    "PillowFlow LLC",
    "PillowFlow",
    "EVA Foam",
    "PF-X01",
    "PF—X01",
)
MANUAL_TRANSLATIONS = {
    "Most fleets track mileage, maintenance, and fuel to the decimal. Few track the cumulative cost of driver discomfort — until it shows up on the turnover report.":
        "La mayoría de las flotas controlan al detalle el kilometraje, el mantenimiento y el combustible. Pocas miden el costo acumulado de la incomodidad del conductor, hasta que aparece en el informe de rotación de personal.",
    "Continuous pedal work can keep the accelerator leg partially elevated for long periods.":
        "El uso continuo de los pedales puede mantener la pierna del acelerador parcialmente elevada durante períodos prolongados.",
}


def should_translate(value: str) -> bool:
    text = value.strip()
    return bool(re.search(r"[A-Za-z]", text)) and text not in {
        "PillowFlow", "PF-X01", "WhatsApp", "SMS", "Reuters", "NIOSH", "EN", "ES",
        "Bovenzi", "Hulshof", "Gyi", "Porter", "Kolich", "Taboun", "DAT Freight", "Analytics"
    }


class Collector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.skip_depth = 0
        self.strings: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in SKIP_TAGS:
            self.skip_depth += 1
        for name, value in attrs:
            if value is None:
                continue
            is_description = tag == "meta" and name == "content" and any(
                key == "name" and val == "description" for key, val in attrs
            )
            if (name in TRANSLATABLE_ATTRIBUTES or is_description) and should_translate(value):
                self.strings.add(value.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag in SKIP_TAGS:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip_depth and should_translate(data):
            self.strings.add(data.strip())


def translate_one(text: str) -> tuple[str, str]:
    if text in MANUAL_TRANSLATIONS:
        return text, MANUAL_TRANSLATIONS[text]
    protected = text
    replacements: dict[str, str] = {}
    for index, term in enumerate(PROTECTED_TERMS):
        if term in protected:
            token = f"8675309{index:03d}13579"
            protected = protected.replace(term, token)
            replacements[token] = term
    query = urllib.parse.urlencode({
        "client": "gtx", "sl": "en", "tl": "es", "dt": "t", "q": protected
    })
    request = urllib.request.Request(
        "https://translate.googleapis.com/translate_a/single?" + query,
        headers={"User-Agent": "Mozilla/5.0 PillowFlow localization build"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            translated = "".join(part[0] for part in payload[0] if part[0])
            for token, term in replacements.items():
                translated = translated.replace(token, term)
            return text, translated
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("Translation retry loop ended unexpectedly")


class Renderer(HTMLParser):
    def __init__(self, translations: dict[str, str]) -> None:
        super().__init__(convert_charrefs=False)
        self.translations = translations
        self.skip_depth = 0
        self.output: list[str] = []

    def translated(self, value: str) -> str:
        leading = value[: len(value) - len(value.lstrip())]
        trailing = value[len(value.rstrip()):]
        return leading + self.translations.get(value.strip(), value.strip()) + trailing

    def attributes(self, tag: str, attrs: list[tuple[str, str | None]]) -> str:
        rendered: list[str] = []
        is_description = tag == "meta" and any(
            key == "name" and val == "description" for key, val in attrs
        )
        for name, value in attrs:
            if value is None:
                rendered.append(name)
                continue
            if (name in TRANSLATABLE_ATTRIBUTES or (is_description and name == "content")) and should_translate(value):
                value = self.translated(value)
            if name in {"href", "src"} and value.startswith("assets/"):
                value = "../" + value
            rendered.append(f'{name}="{html.escape(value, quote=True)}"')
        return (" " + " ".join(rendered)) if rendered else ""

    def handle_decl(self, decl: str) -> None:
        self.output.append(f"<!{decl}>")

    def handle_comment(self, data: str) -> None:
        self.output.append(f"<!--{data}-->")

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "html":
            attrs = [(name, "es" if name == "lang" else value) for name, value in attrs]
        self.output.append(f"<{tag}{self.attributes(tag, attrs)}>")
        if tag in SKIP_TAGS:
            self.skip_depth += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.output.append(f"<{tag}{self.attributes(tag, attrs)}>")

    def handle_endtag(self, tag: str) -> None:
        self.output.append(f"</{tag}>")
        if tag in SKIP_TAGS:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        self.output.append(self.translated(data) if not self.skip_depth and should_translate(data) else data)

    def handle_entityref(self, name: str) -> None:
        self.output.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.output.append(f"&#{name};")


def localized_metadata(source_name: str) -> str:
    if source_name == "index.html":
        return """<link rel="canonical" href="https://pillowflow.us/es/">
<link rel="alternate" hreflang="en" href="https://pillowflow.us/">
<link rel="alternate" hreflang="es" href="https://pillowflow.us/es/">
<link rel="alternate" hreflang="x-default" href="https://pillowflow.us/">"""
    return """<link rel="canonical" href="https://pillowflow.us/es/referral.html">
  <link rel="alternate" hreflang="en" href="https://pillowflow.us/referral.html">
  <link rel="alternate" hreflang="es" href="https://pillowflow.us/es/referral.html">
  <link rel="alternate" hreflang="x-default" href="https://pillowflow.us/referral.html">"""


def localize_page(source: Path, translations: dict[str, str]) -> None:
    renderer = Renderer(translations)
    renderer.feed(source.read_text(encoding="utf-8"))
    result = "".join(renderer.output)
    result = re.sub(
        r'<link rel="canonical"[^>]*>\s*<link rel="alternate" hreflang="en"[^>]*>\s*'
        r'<link rel="alternate" hreflang="es"[^>]*>\s*<link rel="alternate" hreflang="x-default"[^>]*>',
        localized_metadata(source.name),
        result,
        count=1,
    )
    if source.name == "index.html":
        result = result.replace(
            '<a class="active" href="/" lang="en" hreflang="en" aria-current="page">EN</a>\n      <a href="/es/" lang="es" hreflang="es">ES</a>',
            '<a href="/" lang="en" hreflang="en">EN</a>\n      <a class="active" href="/es/" lang="es" hreflang="es" aria-current="page">ES</a>',
        )
    else:
        result = result.replace(
            '<a class="active" href="/referral.html" lang="en" hreflang="en" aria-current="page">EN</a><a href="/es/referral.html" lang="es" hreflang="es">ES</a>',
            '<a href="/referral.html" lang="en" hreflang="en">EN</a><a class="active" href="/es/referral.html" lang="es" hreflang="es" aria-current="page">ES</a>',
        )
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / source.name).write_text(result, encoding="utf-8", newline="\n")


def main() -> None:
    collector = Collector()
    for source in SOURCES:
        collector.feed(source.read_text(encoding="utf-8"))
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(translate_one, text) for text in sorted(collector.strings)]
        translations = dict(future.result() for future in as_completed(futures))
    for source in SOURCES:
        localize_page(source, translations)
    print(f"Generated {len(SOURCES)} Spanish pages from {len(translations)} translated strings.")


if __name__ == "__main__":
    main()
