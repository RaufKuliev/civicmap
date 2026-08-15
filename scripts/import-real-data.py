from __future__ import annotations

import hashlib
import json
import re
import shutil
import unicodedata
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw" / "2026-08-14" / "sources"
OUT = DATA / "regions"
PUBLIC = ROOT / "public" / "data"
CLIENT_MAP = ROOT / "src" / "data" / "regions-map.json"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

DISTRICTS_DOC = RAW / "districts-107fz.docx"
CANDIDATES_DOC = RAW / "candidates-nominated-2026-07-18.docx"
MAP_SOURCE = RAW / "ne_10m_admin_1_states_provinces.geojson"

DISTRICT_SOURCE_URL = "https://government.ru/docs/all/159107/"
CANDIDATE_SOURCE_URL = "https://declarator.org/office/view-file/219884/"

PARTIES = [
    ("pensioners", "Российская партия пенсионеров за социальную справедливость", "Партия пенсионеров", "ПЕНСИОНЕРОВ"),
    ("communists-russia", "Коммунистическая партия Коммунисты России", "Коммунисты России", "КОММУНИСТЫ РОССИИ"),
    ("ldpr", "ЛДПР — Либерально-демократическая партия России", "ЛДПР", "ЛДПР"),
    ("kprf", "Коммунистическая партия Российской Федерации", "КПРФ", "КПРФ"),
    ("united-russia", "Всероссийская политическая партия «Единая Россия»", "Единая Россия", "ЕДИНАЯ РОССИЯ"),
    ("new-people", "Политическая партия «Новые люди»", "Новые люди", "НОВЫЕ ЛЮДИ"),
    ("yabloko", "Российская объединённая демократическая партия «Яблоко»", "Яблоко", "ЯБЛОКО"),
    ("fair-russia", "Социалистическая политическая партия «Справедливая Россия»", "Справедливая Россия", "СПРАВЕДЛИВАЯ РОССИЯ"),
    ("rodina", "Всероссийская политическая партия «Родина»", "Родина", "РОДИНА"),
    ("direct-democracy", "Политическая партия «Партия прямой демократии»", "Партия прямой демократии", "ПРЯМОЙ ДЕМОКРАТИИ"),
    ("greens", "Российская экологическая партия «Зелёные»", "Зелёные", "ЗЕЛЁНЫЕ"),
]

MONTHS = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4,
    "мая": 5, "июня": 6, "июля": 7, "августа": 8,
    "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}

FEDERAL_DISTRICTS = {
    "Центральный федеральный округ": {
        "Белгородская область", "Брянская область", "Владимирская область", "Воронежская область",
        "Ивановская область", "Калужская область", "Костромская область", "Курская область",
        "Липецкая область", "Московская область", "Орловская область", "Рязанская область",
        "Смоленская область", "Тамбовская область", "Тверская область", "Тульская область",
        "Ярославская область", "Город Москва",
    },
    "Северо-Западный федеральный округ": {
        "Республика Карелия", "Республика Коми", "Архангельская область", "Вологодская область",
        "Калининградская область", "Ленинградская область", "Мурманская область", "Новгородская область",
        "Псковская область", "Город Санкт-Петербург", "Ненецкий автономный округ",
    },
    "Южный федеральный округ": {
        "Республика Адыгея", "Республика Калмыкия", "Республика Крым", "Краснодарский край",
        "Астраханская область", "Волгоградская область", "Ростовская область", "Город Севастополь",
        "Донецкая Народная Республика", "Луганская Народная Республика", "Запорожская область", "Херсонская область",
    },
    "Северо-Кавказский федеральный округ": {
        "Республика Дагестан", "Республика Ингушетия", "Кабардино-Балкарская Республика",
        "Карачаево-Черкесская Республика", "Республика Северная Осетия-Алания", "Чеченская Республика",
        "Ставропольский край",
    },
    "Приволжский федеральный округ": {
        "Республика Башкортостан", "Республика Марий Эл", "Республика Мордовия", "Республика Татарстан",
        "Удмуртская Республика", "Чувашская Республика", "Пермский край", "Кировская область",
        "Нижегородская область", "Оренбургская область", "Пензенская область", "Самарская область",
        "Саратовская область", "Ульяновская область",
    },
    "Уральский федеральный округ": {
        "Курганская область", "Свердловская область", "Тюменская область", "Челябинская область",
        "Ханты-Мансийский автономный округ", "Ямало-Ненецкий автономный округ",
    },
    "Сибирский федеральный округ": {
        "Республика Алтай", "Республика Тыва", "Республика Хакасия", "Алтайский край", "Красноярский край",
        "Иркутская область", "Кемеровская область – Кузбасс", "Новосибирская область", "Омская область", "Томская область",
    },
    "Дальневосточный федеральный округ": {
        "Республика Бурятия", "Республика Саха (Якутия)", "Забайкальский край", "Камчатский край",
        "Приморский край", "Хабаровский край", "Амурская область", "Магаданская область",
        "Сахалинская область", "Еврейская автономная область", "Чукотский автономный округ",
    },
}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def docx_paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    paragraphs = []
    for paragraph in root.findall(".//w:body/w:p", NS):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", NS))
        paragraphs.append(re.sub(r"\s+", " ", text).strip())
    return paragraphs


def docx_table_rows(path: Path) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    rows = []
    for row in root.findall(".//w:tbl[1]/w:tr", NS):
        cells = []
        for cell in row.findall("./w:tc", NS):
            text = " ".join("".join(node.text or "" for node in p.findall(".//w:t", NS)) for p in cell.findall(".//w:p", NS))
            cells.append(re.sub(r"\s+", " ", text).strip())
        rows.append(cells)
    return rows


def federal_district(region_name: str) -> str:
    matches = [name for name, members in FEDERAL_DISTRICTS.items() if region_name in members]
    if len(matches) != 1:
        raise ValueError(f"Не найден федеральный округ для {region_name!r}")
    return matches[0]


def parse_districts() -> tuple[list[dict], dict[int, str]]:
    by_number: dict[int, dict] = {}
    region_by_number: dict[int, str] = {}
    current_region = ""
    for cells in docx_table_rows(DISTRICTS_DOC)[3:]:
        if len(cells) < 4:
            continue
        match = re.search(r"\d+", cells[0])
        if not match:
            continue
        number = int(match.group())
        if number in by_number:
            continue
        if cells[1]:
            current_region = cells[1]
        if not current_region:
            raise ValueError(f"Не удалось определить регион округа № {number}")
        full_name = cells[2].strip()
        short_name = re.sub(r"\s+одномандатный избирательный округ$", "", full_name, flags=re.I)
        by_number[number] = {
            "number": number,
            "name": short_name,
            "territory_description": full_name,
            "electoral_commission": cells[3] or None,
            "official_source": {
                "title": "Федеральный закон от 23.05.2025 № 107-ФЗ и приложение со схемой 225 округов",
                "url": DISTRICT_SOURCE_URL,
            },
            "geometry_status": "not_published",
            "data_as_of": "2026-08-14",
        }
        region_by_number[number] = current_region
    if set(by_number) != set(range(1, 226)):
        raise ValueError(f"Ожидались округа 1–225, получено {len(by_number)}")
    return [by_number[number] for number in sorted(by_number)], region_by_number


def detect_party(text: str) -> str | None:
    upper = text.upper()
    if "ОДНОМАНДАТН" not in upper:
        return None
    for party_id, _name, _short, marker in PARTIES:
        if marker in upper:
            return party_id
    return None


def parse_birth_date(text: str) -> str | None:
    match = re.search(r"дата рождения\s*[–—-]\s*(\d{1,2})\s+([а-яё]+)\s+(\d{4})", text, re.I)
    if not match:
        return None
    return date(int(match.group(3)), MONTHS[match.group(2).lower()], int(match.group(1))).isoformat()


def parse_candidates() -> list[dict]:
    paragraphs = docx_paragraphs(CANDIDATES_DOC)
    current_party: str | None = None
    pending_district: int | None = None
    records: dict[tuple[str, int], dict] = {}
    for index, paragraph in enumerate(paragraphs):
        heading_context = " ".join(paragraphs[max(0, index - 4):index + 1])
        party = detect_party(heading_context) if "по одномандатн" in paragraph.lower() else None
        if party:
            current_party = party
            pending_district = None
            continue
        district_match = re.search(r"одномандатн\w* избирательн\w* округ\s*№\s*(\d{1,3})", paragraph, re.I)
        if district_match and current_party:
            pending_district = int(district_match.group(1))
            continue
        candidate_match = re.match(r"^\d+\.\s*([^,]+),\s*дата рождения", paragraph, re.I)
        if not candidate_match or not current_party or pending_district is None:
            continue
        full_name = re.sub(r"\s+", " ", candidate_match.group(1)).strip()
        birth_date = parse_birth_date(paragraph)
        fingerprint = hashlib.sha1(f"{current_party}|{pending_district}|{full_name}|{birth_date}".encode()).hexdigest()[:10]
        records[(current_party, pending_district)] = {
            "id": f"c{pending_district}-{current_party}-{fingerprint}",
            "full_name": full_name,
            "birth_date": birth_date,
            "district_number": pending_district,
            "nomination_type": "party",
            "party_id": current_party,
            "status": "certified_list",
            "status_as_of": "2026-07-18",
            "official_source": {
                "title": "Заверенные ЦИК России партийные списки по одномандатным округам (срез на 18.07.2026; опубликованная копия документа)",
                "url": CANDIDATE_SOURCE_URL,
                "accessed_at": "2026-08-14",
                "source_kind": "party_list",
            },
            "synthetic": False,
        }
        pending_district = None
    result = sorted(records.values(), key=lambda item: (item["district_number"], item["full_name"]))
    if len(result) < 1000:
        raise ValueError(f"Слишком мало кандидатов: {len(result)}")
    return result


def normalize_region_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower().replace("ё", "е")
    value = value.replace("город ", "").replace("республика ", "")
    value = re.sub(r"\s*\([^)]*\)", "", value)
    value = value.replace(" – кузбасс", "")
    value = re.sub(r"\b(область|край|автономный округ)\b", "", value)
    value = re.sub(r"[^а-яa-z0-9]+", "", value)
    aliases = {
        "саха": "якутия", "севернаяосетияалания": "севернаяосетия", "чувашская": "чувашия",
        "кабардинобалкарская": "кабардинобалкар", "карачаевочеркесская": "карачаевочеркес",
        "еврейскаяавтономная": "еврейская", "хантымансийский": "хантымансийск",
        "ямалоненецкий": "ямалоненец", "горноалтай": "алтай",
    }
    return aliases.get(value, value)


def build_map(regions: list[dict]) -> int:
    source = json.loads(MAP_SOURCE.read_text(encoding="utf-8"))
    lookup = {normalize_region_name(region["name"]): region for region in regions}
    exact_lookup = {region["name"]: region for region in regions}
    map_aliases = {
        "Карачаево-Черкесия": "Карачаево-Черкесская Республика",
        "Кабардино-Балкария": "Кабардино-Балкарская Республика",
        "Чечня": "Чеченская Республика",
        "Автономная Республика Крым": "Республика Крым",
        "Ханты-Мансийский автономный округ — Югра": "Ханты-Мансийский автономный округ",
        "Чувашия": "Чувашская Республика",
        "Удмуртия": "Удмуртская Республика",
    }
    matched = 0
    features = []
    map_regions = []

    def project(point: list[float]) -> tuple[float, float]:
        longitude, latitude = point[:2]
        if longitude < 0:
            longitude += 360
        return ((longitude - 19) / 181 * 900, (82 - latitude) / 41 * 420)

    def distance_to_segment(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
        px, py = point
        x1, y1 = start
        x2, y2 = end
        dx, dy = x2 - x1, y2 - y1
        if dx == 0 and dy == 0:
            return (px - x1) ** 2 + (py - y1) ** 2
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        return (px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2

    def simplify(points: list[tuple[float, float]], tolerance: float = 0.65) -> list[tuple[float, float]]:
        if len(points) <= 3:
            return points
        maximum, index = 0.0, 0
        for candidate_index in range(1, len(points) - 1):
            distance = distance_to_segment(points[candidate_index], points[0], points[-1])
            if distance > maximum:
                maximum, index = distance, candidate_index
        if maximum > tolerance * tolerance:
            left = simplify(points[:index + 1], tolerance)
            right = simplify(points[index:], tolerance)
            return left[:-1] + right
        return [points[0], points[-1]]

    def geometry_path(geometry: dict) -> str:
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        commands = []
        for polygon in polygons:
            for ring in polygon:
                projected = [project(point) for point in ring]
                reduced = simplify(projected)
                if len(reduced) < 3:
                    continue
                commands.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in reduced) + "Z")
        return "".join(commands)
    for feature in source["features"]:
        props = feature.get("properties", {})
        if props.get("adm0_a3") != "RUS" and props.get("admin") != "Russia":
            continue
        russian_name = props.get("name_ru")
        aliased_name = map_aliases.get(russian_name, russian_name)
        region = exact_lookup.get(aliased_name) if aliased_name else None
        candidates = [russian_name, props.get("gn_name"), props.get("name")]
        if not region:
            region = next((lookup.get(normalize_region_name(name)) for name in candidates if name and lookup.get(normalize_region_name(name))), None)
        if region:
            matched += 1
        feature["properties"] = {
            "regionId": region["id"] if region else None,
            "displayName": region["name"] if region else (props.get("name_ru") or props.get("name")),
            "sourceName": props.get("name"),
        }
        features.append(feature)
        path_data = geometry_path(feature["geometry"])
        if path_data:
            map_regions.append({"id": region["id"] if region else None, "name": feature["properties"]["displayName"], "path": path_data})
    write_json(CLIENT_MAP, map_regions)
    public_map = PUBLIC / "regions-map.json"
    if public_map.exists():
        public_map.unlink()
    legacy_geojson = PUBLIC / "regions.geojson"
    if legacy_geojson.exists():
        legacy_geojson.unlink()
    return matched


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    districts, region_by_number = parse_districts()
    candidates = parse_candidates()
    districts_by_region: dict[str, list[dict]] = defaultdict(list)
    for district in districts:
        districts_by_region[region_by_number[district["number"]]].append(district)

    regions = []
    for index, region_name in enumerate(districts_by_region, 1):
        region = {
            "id": f"{index:03d}-region",
            "name": region_name,
            "federal_district": federal_district(region_name),
            "district_count": len(districts_by_region[region_name]),
            "data_as_of": "2026-08-14",
        }
        regions.append(region)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    region_by_district = {number: name for number, name in region_by_number.items()}
    candidates_by_region: dict[str, list[dict]] = defaultdict(list)
    for candidate in candidates:
        candidates_by_region[region_by_district[candidate["district_number"]]].append(candidate)
    for region in regions:
        directory = OUT / region["id"]
        write_json(directory / "region.json", region)
        write_json(directory / "districts.json", districts_by_region[region["name"]])
        write_json(directory / "candidates.json", candidates_by_region[region["name"]])
        write_json(directory / "resources.json", [])
        write_json(directory / "news.json", [])

    write_json(DATA / "regions.json", regions)
    write_json(DATA / "parties.json", [
        {"id": party_id, "name": name, "short_name": short_name, "synthetic": False}
        for party_id, name, short_name, _marker in PARTIES
    ])
    write_json(DATA / "election.json", {
        "title": "Выборы депутатов Государственной Думы девятого созыва",
        "election_date": "2026-09-20",
        "data_as_of": "2026-07-18",
        "candidate_status_as_of": "2026-08-14",
        "dataset_kind": "official",
        "expected_district_count": 225,
        "real_release_district_count": 225,
        "methodology_version": "0.2.0",
    })
    write_json(DATA / "raw" / "2026-07-18" / "manifest.json", {
        "dataset_kind": "official",
        "generated_at": "2026-08-14",
        "note": "Промежуточный срез заверенных партийных списков. Не является окончательным перечнем зарегистрированных кандидатов.",
        "source": {"file": "../2026-08-14/sources/candidates-nominated-2026-07-18.docx", "sha256": checksum(CANDIDATES_DOC)},
        "sources": [
            {"file": "../2026-08-14/sources/candidates-nominated-2026-07-18.docx", "sha256": checksum(CANDIDATES_DOC), "url": CANDIDATE_SOURCE_URL},
            {"file": "../2026-08-14/sources/districts-107fz.docx", "sha256": checksum(DISTRICTS_DOC), "url": DISTRICT_SOURCE_URL},
            {"file": "../2026-08-14/sources/ne_10m_admin_1_states_provinces.geojson", "sha256": checksum(MAP_SOURCE), "url": "https://github.com/nvkelso/natural-earth-vector"},
        ],
    })
    write_json(DATA / "snapshots" / "2026-07-18" / "manifest.json", {
        "schema_version": 1,
        "snapshot_id": "duma-2026-2026-07-18",
        "election_id": "duma-2026",
        "as_of": "2026-07-18",
        "created_on": "2026-08-14",
        "dataset_kind": "official",
        "predecessor_snapshot_id": None,
        "sources": [
            {
                "id": "cik-party-lists-2026-07-18",
                "title": "Заверенные ЦИК России партийные списки по одномандатным округам",
                "url": CANDIDATE_SOURCE_URL,
                "publisher": "ЦИК России; опубликованная копия документа",
                "source_kind": "party_list",
                "published_on": "2026-07-18",
                "accessed_on": "2026-08-14",
                "sha256": checksum(CANDIDATES_DOC),
                "archived_path": "data/raw/2026-08-14/sources/candidates-nominated-2026-07-18.docx",
            },
            {
                "id": "federal-law-107-fz",
                "title": "Федеральный закон от 23.05.2025 № 107-ФЗ и схема округов",
                "url": DISTRICT_SOURCE_URL,
                "publisher": "Правительство России",
                "source_kind": "official_document",
                "published_on": "2025-05-23",
                "accessed_on": "2026-08-14",
                "sha256": checksum(DISTRICTS_DOC),
                "archived_path": "data/raw/2026-08-14/sources/districts-107fz.docx",
            },
            {
                "id": "natural-earth-admin-1",
                "title": "Natural Earth Admin 1 states and provinces",
                "url": "https://github.com/nvkelso/natural-earth-vector",
                "publisher": "Natural Earth",
                "source_kind": "official_document",
                "published_on": None,
                "accessed_on": "2026-08-14",
                "sha256": checksum(MAP_SOURCE),
                "archived_path": None,
            },
        ],
        "record_counts": {"regions": len(regions), "districts": len(districts), "candidates": len(candidates)},
    })
    map_matches = build_map(regions)
    print(f"Готово: {len(regions)} регионов, {len(districts)} округов, {len(candidates)} кандидатов, {map_matches} совпадений на карте.")


if __name__ == "__main__":
    main()
