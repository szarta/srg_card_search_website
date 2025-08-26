#!/usr/bin/env python3
import csv
import html
import json
import sys
from pathlib import Path
from datetime import datetime

TEMPLATE = """<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
  body { margin:0; font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,"Helvetica Neue",Arial;background:#fff;color:#111; }
  header { padding:20px 16px; }
  h1 { margin:0 0 4px; font-size:20px; }
  .muted { color:#555; }
  .table-wrap { padding:0 16px 24px; }
  table { border-collapse:collapse; width:100%; }
  thead th { position:sticky; top:0; background:#f7f7f8; border-bottom:1px solid #ddd; text-align:left; padding:10px 8px; font-weight:600; }
  tbody td { border-bottom:1px solid #eee; padding:8px; vertical-align:top; word-break:break-word; }
  tbody tr:nth-child(odd) td { background:#fafafa; }
  .caption { margin:0 16px 12px; color:#666; font-size:12px; }
</style>
<header>
  <h1>{title}</h1>
  <div class="muted">{count} item(s) • Exported {timestamp}</div>
</header>
<p class="caption">Embed this file directly or copy the &lt;table&gt; markup below.</p>
<div class="table-wrap">
  <table>
    <thead><tr>{thead}</tr></thead>
    <tbody>{tbody}</tbody>
  </table>
</div>
</html>"""


def cell(v):
    if v is None:
        return ""
    if isinstance(v, (list, dict)):
        v = json.dumps(v, ensure_ascii=False)
    return html.escape(str(v), quote=True)


def csv_to_html(csv_path, html_path=None, title="SRG Card List"):
    csv_file = Path(csv_path)
    if html_path is None:
        html_file = csv_file.with_suffix(".html")
    else:
        html_file = Path(html_path)

    with csv_file.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        # ensure deck_card_number present if any row has it (handles odd CSVs)
        rows = list(reader)
        if any(
            "deck_card_number" in r and r["deck_card_number"] not in (None, "")
            for r in rows
        ):
            if "deck_card_number" not in fieldnames:
                fieldnames.append("deck_card_number")

    thead = "".join(f"<th>{cell(h)}</th>" for h in fieldnames)
    body_rows = []
    for r in rows:
        tds = "".join(f"<td>{cell(r.get(h, ''))}</td>" for h in fieldnames)
        body_rows.append(f"<tr>{tds}</tr>")
    tbody = "".join(body_rows)

    html_str = TEMPLATE.format(
        title=html.escape(title, quote=True),
        count=len(rows),
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        thead=thead,
        tbody=tbody,
    )
    html_file.write_text(html_str, encoding="utf-8")
    print(f"Wrote {len(rows)} rows → {html_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: csv_to_html_table.py input.csv [output.html] [title...]")
        sys.exit(1)
    csv_path = sys.argv[1]
    html_path = (
        sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else None
    )
    title = (
        " ".join(arg for arg in sys.argv[3:] if not arg.startswith("--"))
        or "SRG Card List"
    )
    csv_to_html(csv_path, html_path, title)
