from __future__ import annotations

import csv
import io
from typing import Any, Dict, List

from app.modules.output.schemas import (
    ChartRequest,
    ChartResult,
    GrafanaDashboardRequest,
)


def build_chart_json(request: ChartRequest) -> ChartResult:
    chart_type = request.chart_type.lower()
    columns = request.columns
    rows = request.rows

    column_data: Dict[str, List[Any]] = {col: [] for col in columns}
    for row in rows:
        for i, col in enumerate(columns):
            column_data[col].append(row[i] if i < len(row) else None)

    layout: Dict[str, Any] = {
        "paper_bgcolor": "transparent",
        "plot_bgcolor": "transparent",
        "font": {"color": "#e2e8f0"},
        "title": {"text": request.title or ""},
        "xaxis": {"title": request.x_label or (columns[0] if columns else "")},
        "yaxis": {"title": request.y_label or ""},
    }
    if request.options:
        layout.update(request.options)

    traces: List[Dict[str, Any]] = []

    if chart_type in {"bar", "line", "area", "scatter"}:
        x_values = column_data[columns[0]] if columns else []
        for col in columns[1:]:
            trace: Dict[str, Any] = {"name": col, "x": x_values, "y": column_data[col]}
            if chart_type == "bar":
                trace["type"] = "bar"
            elif chart_type == "line":
                trace["type"] = "scatter"
                trace["mode"] = "lines"
            elif chart_type == "area":
                trace["type"] = "scatter"
                trace["mode"] = "lines"
                trace["fill"] = "tozeroy"
            elif chart_type == "scatter":
                trace["type"] = "scatter"
                trace["mode"] = "markers"
            traces.append(trace)

    elif chart_type == "pie":
        labels_col = columns[0] if columns else ""
        values_col = columns[1] if len(columns) > 1 else ""
        traces.append({
            "type": "pie",
            "labels": column_data.get(labels_col, []),
            "values": column_data.get(values_col, []),
        })

    elif chart_type == "histogram":
        for col in columns:
            traces.append({
                "type": "histogram",
                "x": column_data[col],
                "name": col,
            })

    else:
        raise ValueError(f"Unsupported chart type: {chart_type}")

    return ChartResult(plotly_json={"data": traces, "layout": layout})


def build_grafana_dashboard(request: GrafanaDashboardRequest) -> Dict[str, Any]:
    panels: List[Dict[str, Any]] = []
    for i, panel_def in enumerate(request.panels):
        col = i % 2
        row = i // 2
        grid_pos = {
            "x": col * 12,
            "y": row * 8,
            "w": 12,
            "h": 8,
        }
        panel: Dict[str, Any] = {
            "id": i + 1,
            "title": panel_def.get("title", f"Panel {i + 1}"),
            "type": panel_def.get("type", "timeseries"),
            "gridPos": grid_pos,
            "datasource": {"type": "custom", "uid": "nadin"},
            "targets": [
                {
                    "dataset_id": request.dataset_id,
                    "metrics": panel_def.get("metrics", []),
                    "group_by": panel_def.get("group_by"),
                    "filters": panel_def.get("filters"),
                }
            ],
        }
        panels.append(panel)

    return {
        "schemaVersion": 38,
        "title": request.title,
        "refresh": request.refresh,
        "time": {"from": request.time_range, "to": "now"},
        "panels": panels,
    }


def build_pdf_report(title: str, sections: List[Dict[str, Any]]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(title, styles["Title"]))
    story.append(Spacer(1, 6 * mm))

    for section in sections:
        section_type = section.get("type", "text")

        if section_type == "heading":
            story.append(Paragraph(str(section.get("content", "")), styles["Heading2"]))
            story.append(Spacer(1, 3 * mm))

        elif section_type == "text":
            story.append(Paragraph(str(section.get("content", "")), styles["Normal"]))
            story.append(Spacer(1, 3 * mm))

        elif section_type == "table":
            cols = section.get("columns", [])
            rows = section.get("rows", [])
            table_data = [cols] + [[str(v) for v in row] for row in rows]
            tbl = Table(table_data)
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]))
            story.append(tbl)
            story.append(Spacer(1, 4 * mm))

    doc.build(story)
    return buffer.getvalue()


def build_csv(columns: List[str], rows: List[List[Any]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(columns)
    for row in rows:
        writer.writerow(row)
    return output.getvalue()
