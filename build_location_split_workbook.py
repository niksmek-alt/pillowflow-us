import html
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

SOURCE = Path("lead_handling_standard.xlsx")
OUTPUT = Path("lead_handling_by_location.xlsx")
SUMMARY_JSON = Path("lead_handling_location_summary.json")

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

OUTPUT_HEADERS = [
    "Origin Location",
    "Destination",
    "Route",
    "Lead / Company",
    "Operator Sheet",
    "Lead Date",
    "Travel Dates",
    "Status",
    "Potential",
    "Quotes Sent",
    "Call Touches",
    "Feedback",
]


def col_index(cell_ref):
    letters = re.match(r"[A-Z]+", cell_ref).group(0)
    index = 0
    for char in letters:
        index = index * 26 + ord(char) - 64
    return index - 1


def col_letter(index):
    index += 1
    letters = ""
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def safe_sheet_name(value, used):
    name = re.sub(r"[\[\]:*?/\\]", " ", str(value or "Blank")).strip()[:31] or "Blank"
    base = name
    n = 2
    while name in used:
        suffix = f" {n}"
        name = base[: 31 - len(suffix)] + suffix
        n += 1
    used.add(name)
    return name


def read_shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values = []
    for si in root.findall("main:si", NS):
        values.append("".join(node.text or "" for node in si.findall(".//main:t", NS)))
    return values


def sheet_paths(zf):
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_by_id = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall("pkgrel:Relationship", NS)
    }
    result = []
    for sheet in workbook.findall("main:sheets/main:sheet", NS):
        rid = sheet.attrib["{%s}id" % NS["rel"]]
        target = rel_by_id[rid]
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        result.append((sheet.attrib["name"], target))
    return result


def read_sheet(zf, path, shared):
    root = ET.fromstring(zf.read(path))
    rows = []
    for row in root.findall(".//main:sheetData/main:row", NS):
        values = []
        for cell in row.findall("main:c", NS):
            idx = col_index(cell.attrib["r"])
            while len(values) <= idx:
                values.append("")
            cell_type = cell.attrib.get("t")
            if cell_type == "inlineStr":
                text = "".join(t.text or "" for t in cell.findall(".//main:t", NS))
            else:
                v = cell.find("main:v", NS)
                raw = v.text if v is not None else ""
                if cell_type == "s" and raw != "":
                    text = shared[int(raw)]
                else:
                    text = raw
            values[idx] = str(text).strip() if text is not None else ""
        rows.append(values)
    return rows


def find_header_row(rows):
    for idx, row in enumerate(rows[:25]):
        normalized = [str(v).strip().lower() for v in row]
        if "from/to" in normalized:
            return idx
    return None


def first_idx(headers, names):
    lookup = {str(h).strip().lower(): i for i, h in enumerate(headers)}
    for name in names:
        if name.lower() in lookup:
            return lookup[name.lower()]
    return None


def row_value(row, idx):
    if idx is None or idx >= len(row):
        return ""
    return row[idx]


def parse_route(route):
    route = re.sub(r"\s+", " ", (route or "").strip())
    if not route or "-" not in route:
        return "", ""
    origin, dest = route.split("-", 1)
    return origin.strip().upper(), dest.strip().upper()


def looks_like_date_marker(row, route_idx):
    non_empty = [v for v in row if str(v).strip()]
    if len(non_empty) != 1:
        return ""
    if route_idx is not None and route_idx < len(row) and row[route_idx]:
        return ""
    value = str(non_empty[0]).strip()
    return value if re.search(r"\d{4}|\d{1,2}[./-]\d{1,2}", value) else ""


def touch_count(row, day_indexes):
    total = 0
    for idx in day_indexes:
        value = row_value(row, idx).lower()
        if "done" in value or "vm" in value or "call" in value:
            total += 1
    return total


def collect_records():
    records = []
    sheet_summaries = []
    with zipfile.ZipFile(SOURCE) as zf:
        shared = read_shared_strings(zf)
        for sheet_name, path in sheet_paths(zf):
            rows = read_sheet(zf, path, shared)
            header_idx = find_header_row(rows)
            if header_idx is None:
                continue
            headers = rows[header_idx]
            route_idx = first_idx(headers, ["From/To"])
            name_idx = first_idx(headers, ["Lead link", "Name of PAX"])
            travel_idx = first_idx(headers, ["Travel Dates", "Date"])
            status_idx = first_idx(headers, ["Status", "Senior's Status", "Follow up"])
            potential_idx = first_idx(headers, ["Potential", "Closed"])
            quotes_idx = first_idx(headers, ["3 Quotes sent", "3 Quotes Sent"])
            feedback_idx = first_idx(headers, ["Feedback", "Supervisor's note", "Supervisor's Note"])
            date_idx = first_idx(headers, ["Lead taken date", "Date"])
            day_indexes = [
                i for i, header in enumerate(headers)
                if re.match(r"day\s+\d+", str(header).strip(), flags=re.I)
            ]
            current_date = ""
            count = 0
            for row in rows[header_idx + 1:]:
                date_marker = looks_like_date_marker(row, route_idx)
                if date_marker:
                    current_date = date_marker
                    continue
                route = row_value(row, route_idx)
                origin, destination = parse_route(route)
                if not origin:
                    continue
                lead_date = row_value(row, date_idx) or current_date
                record = {
                    "Origin Location": origin,
                    "Destination": destination,
                    "Route": route,
                    "Lead / Company": row_value(row, name_idx),
                    "Operator Sheet": sheet_name,
                    "Lead Date": lead_date,
                    "Travel Dates": row_value(row, travel_idx),
                    "Status": row_value(row, status_idx),
                    "Potential": row_value(row, potential_idx),
                    "Quotes Sent": row_value(row, quotes_idx),
                    "Call Touches": str(touch_count(row, day_indexes)),
                    "Feedback": row_value(row, feedback_idx),
                }
                records.append(record)
                count += 1
            sheet_summaries.append({"sheet": sheet_name, "records": count})
    return records, sheet_summaries


def xml_text(value):
    value = "" if value is None else str(value)
    return f'<is><t xml:space="preserve">{html.escape(value, quote=False)}</t></is>'


def rows_to_sheet_xml(rows, widths=None):
    widths = widths or [18] * (len(rows[0]) if rows else 1)
    cols = "".join(
        f'<col min="{i + 1}" max="{i + 1}" width="{width}" customWidth="1"/>'
        for i, width in enumerate(widths)
    )
    xml_rows = []
    for r, row in enumerate(rows, start=1):
        cells = []
        style = ' s="1"' if r == 1 else ""
        for c, value in enumerate(row, start=1):
            ref = f"{col_letter(c - 1)}{r}"
            cells.append(f'<c r="{ref}" t="inlineStr"{style}>{xml_text(value)}</c>')
        xml_rows.append(f'<row r="{r}">{"".join(cells)}</row>')
    dimension = f"A1:{col_letter(len(rows[0]) - 1)}{len(rows)}" if rows else "A1"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="{dimension}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        f'<cols>{cols}</cols><sheetData>{"".join(xml_rows)}</sheetData>'
        f'<autoFilter ref="{dimension}"/>'
        '</worksheet>'
    )


def write_xlsx(sheets):
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml(len(sheets)))
        zf.writestr("_rels/.rels", root_rels_xml())
        zf.writestr("xl/workbook.xml", workbook_xml(sheets))
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml(len(sheets)))
        zf.writestr("xl/styles.xml", styles_xml())
        zf.writestr("docProps/core.xml", core_xml())
        zf.writestr("docProps/app.xml", app_xml())
        for idx, (_, rows, widths) in enumerate(sheets, start=1):
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", rows_to_sheet_xml(rows, widths))


def content_types_xml(sheet_count):
    sheet_overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for i in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        f'{sheet_overrides}</Types>'
    )


def root_rels_xml():
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )


def workbook_xml(sheets):
    sheet_xml = "".join(
        f'<sheet name="{html.escape(name)}" sheetId="{i}" r:id="rId{i}"/>'
        for i, (name, _, _) in enumerate(sheets, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets>{sheet_xml}</sheets></workbook>'
    )


def workbook_rels_xml(sheet_count):
    rels = []
    for i in range(1, sheet_count + 1):
        rels.append(
            f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
        )
    rels.append(
        f'<Relationship Id="rId{sheet_count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(rels)
        + '</Relationships>'
    )


def styles_xml():
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )


def core_xml():
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:title>Lead Handling by Location</dc:title><dc:creator>ChatGPT</dc:creator>'
        '</cp:coreProperties>'
    )


def app_xml():
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>Microsoft Excel</Application></Properties>'
    )


records, sheet_summaries = collect_records()
origin_counts = Counter(r["Origin Location"] for r in records)
status_counts = Counter((r["Status"] or "Blank").strip() for r in records)
top_origins = [origin for origin, _ in origin_counts.most_common(25)]

summary_rows = [
    ["Metric", "Value"],
    ["Total separated records", str(len(records))],
    ["Unique origin locations", str(len(origin_counts))],
    ["Dedicated location tabs", str(len(top_origins))],
    ["Other Locations records", str(sum(count for origin, count in origin_counts.items() if origin not in top_origins))],
    ["", ""],
    ["Top Origin Location", "Records"],
] + [[origin, str(count)] for origin, count in origin_counts.most_common(30)] + [
    ["", ""],
    ["Status", "Records"],
] + [[status, str(count)] for status, count in status_counts.most_common(30)]

sheet_summary_rows = [["Operator Sheet", "Separated Records"]] + [
    [item["sheet"], str(item["records"])] for item in sheet_summaries if item["records"]
]

all_rows = [OUTPUT_HEADERS] + [
    [record[h] for h in OUTPUT_HEADERS]
    for record in sorted(records, key=lambda r: (r["Origin Location"], r["Destination"], r["Lead / Company"]))
]

widths = [16, 16, 22, 28, 18, 15, 18, 18, 14, 14, 12, 70]
used_names = set()
sheets = [
    (safe_sheet_name("Summary", used_names), summary_rows, [26, 18]),
    (safe_sheet_name("Operator Tabs", used_names), sheet_summary_rows, [24, 20]),
    (safe_sheet_name("All Leads Sorted", used_names), all_rows, widths),
]

for origin in top_origins:
    rows = [OUTPUT_HEADERS] + [
        [record[h] for h in OUTPUT_HEADERS]
        for record in sorted(
            (r for r in records if r["Origin Location"] == origin),
            key=lambda r: (r["Destination"], r["Lead / Company"]),
        )
    ]
    sheets.append((safe_sheet_name(origin, used_names), rows, widths))

other_rows = [OUTPUT_HEADERS] + [
    [record[h] for h in OUTPUT_HEADERS]
    for record in sorted(
        (r for r in records if r["Origin Location"] not in top_origins),
        key=lambda r: (r["Origin Location"], r["Destination"], r["Lead / Company"]),
    )
]
sheets.append((safe_sheet_name("Other Locations", used_names), other_rows, widths))

write_xlsx(sheets)

SUMMARY_JSON.write_text(
    json.dumps(
        {
            "total_records": len(records),
            "unique_origin_locations": len(origin_counts),
            "top_origins": origin_counts.most_common(20),
            "statuses": status_counts.most_common(20),
            "operator_sheets": sheet_summaries,
            "output": str(OUTPUT),
        },
        indent=2,
    ),
    encoding="utf-8",
)

print(json.dumps({"output": str(OUTPUT), "records": len(records), "unique_origins": len(origin_counts)}, indent=2))
