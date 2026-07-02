import json
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

XLSX = "lead_handling_standard.xlsx"
NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def col_index(cell_ref):
    letters = re.match(r"[A-Z]+", cell_ref).group(0)
    index = 0
    for char in letters:
        index = index * 26 + ord(char) - 64
    return index - 1


def read_shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values = []
    for si in root.findall("main:si", NS):
        parts = [node.text or "" for node in si.findall(".//main:t", NS)]
        values.append("".join(parts))
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
            values[idx] = text.strip() if isinstance(text, str) else text
        rows.append(values)
    return rows


def route_origin(route):
    route = (route or "").strip()
    if not route or "-" not in route:
        return ""
    return route.split("-", 1)[0].strip().upper().replace("  ", " ")


with zipfile.ZipFile(XLSX) as zf:
    shared = read_shared_strings(zf)
    sheets = sheet_paths(zf)
    inspected = []
    for name, path in sheets:
        rows = read_sheet(zf, path, shared)
        header = rows[0] if rows else []
        try:
            route_idx = next(i for i, h in enumerate(header) if str(h).strip().lower() == "from/to")
        except StopIteration:
            route_idx = None
        origins = Counter()
        data_rows = 0
        if route_idx is not None:
            for row in rows[1:]:
                if len(row) <= route_idx:
                    continue
                origin = route_origin(row[route_idx])
                if origin:
                    origins[origin] += 1
                    data_rows += 1
        inspected.append(
            {
                "sheet": name,
                "rows": len(rows),
                "columns": len(header),
                "headers": header[:14],
                "route_column": route_idx,
                "data_rows_with_origin": data_rows,
                "origin_count": len(origins),
                "top_origins": origins.most_common(20),
            }
        )
    print(json.dumps(inspected, indent=2))
