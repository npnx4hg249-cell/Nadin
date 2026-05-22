# Nadin — Data Analysis & Insights

## Overview

The Analysis Workspace is the core of Nadin's data intelligence capability. It connects uploaded datasets to a columnar query engine and an optional local LLM, producing results that can be saved as Insights and shared via Reports and Dashboards.

---

## Data Ingest

### Supported Formats

| Format | Extension(s) | Notes |
|--------|-------------|-------|
| CSV | `.csv` | Polars auto-detects delimiter and types |
| Excel | `.xlsx`, `.xls` | openpyxl engine; first sheet only |
| JSON | `.json` | Array-of-objects or newline-delimited |
| Parquet | `.parquet` | Native; most efficient format |

### Upload Process

1. Navigate to **Data Sources** → **Upload Dataset**
2. Select file, set name/description, optionally make public
3. Optionally enable **Auto-translate data** (see below)
4. Click **Upload**

Files are stored as Parquet with `zstd` compression in `/data/datasets/{id}.parquet`. Column types and schema are stored in PostgreSQL (`schema_info` JSONB).

### Auto-Translate Data

When enabled, the upload pipeline runs two translation passes via the Ollama LLM before writing the Parquet file:

1. **Column names** — all column headers are sent as a JSON array and translated in one call
2. **String values** — for each text/string column, unique values are collected and translated in batches of 40; the translations are then applied to every row

**Target language**: English (default) or German. Set in the upload modal.

**Notes:**
- Translation requires the LLM service to be running and a model to be available
- Translation failures fall back silently to the original values — the upload always succeeds
- Numeric, date, and boolean columns are never translated
- Translated column names are reflected in the Analysis Workspace schema explorer

---

## Analysis Workspace

Navigate to **Analysis** from the sidebar. Select a dataset using the dropdown at the top of the left panel.

### Schema Explorer

The left panel shows all columns with their data types. Hover over a column to reveal:
- **+metric** — adds the column to the Metrics builder
- **+group** — adds the column to the Group By list

### Query Modes

Switch between modes using the tab strip at the top of the main panel.

---

#### Metric Builder

The visual query builder. No SQL knowledge required.

1. Add metrics from the Schema Explorer or the **+Add Metric** row
2. For each metric, choose:
   - **Column** — the data column to aggregate
   - **Function** — `sum`, `avg`, `min`, `max`, `count`, `count_distinct`, `stddev`, `variance`, `median`
   - **Alias** (optional) — output column name
3. Add **Group By** columns for breakdowns
4. Click **Run Analysis**

---

#### Natural Language

Describe what you want to know in plain English (or German). The LLM translates your question into SQL.

1. Type your question in the text area (e.g. *"Show me total revenue by product category, sorted highest first"*)
2. Click **Generate SQL**
3. The generated SQL is displayed in an editable box — review and modify if needed
4. Click **Run Analysis**

**Requirements**: Ollama must be running and a model must be loaded. If the LLM is unavailable, an error badge is shown.

**Tips:**
- The LLM receives the table schema automatically — refer to column names as they appear in the Schema Explorer
- The table is always named `dataset` in SQL
- Generated SQL uses DuckDB syntax (standard SQL with `read_parquet` internals)
- Edit the SQL before running if the LLM output needs correction

---

#### Raw SQL

Write DuckDB SQL directly.

```sql
SELECT
    region,
    SUM(revenue) AS total_revenue,
    COUNT(*) AS transaction_count
FROM dataset
WHERE year = 2024
GROUP BY region
ORDER BY total_revenue DESC
LIMIT 20
```

**Constraints:**
- Only `SELECT` statements are permitted
- The table name is always `dataset`
- DuckDB SQL syntax (mostly standard SQL; see [DuckDB docs](https://duckdb.org/docs/sql/introduction))

---

## Results

After running an analysis, results appear in the main panel.

### Table View

Scrollable data table with alternating row colours. `null` values are shown in italics. Supports up to the engine's row limit (default 1,000 rows; configurable per query in Raw SQL mode with `LIMIT`).

### Chart View

Click the **Chart** tab to visualise results. Select chart type:

| Type | Best for |
|------|----------|
| Bar | Comparing discrete categories |
| Line | Trends over time or ordered values |
| Pie | Part-to-whole relationships |
| Scatter | Correlation between two numeric columns |

The first column is always used as the X/label axis. All remaining columns are treated as Y-axis series.

### Export

From the results toolbar:

| Button | Output |
|--------|--------|
| **CSV** | Raw data download as `.csv` |
| **PDF** | Formatted report PDF via ReportLab |
| **Grafana** | Grafana dashboard JSON (schema v38) — import directly into Grafana |

---

## Insights

An Insight is a saved snapshot of an analysis result — the SQL (or metric configuration), the result data, and optional chart settings.

### Saving an Insight

After running an analysis, click **Save as Insight**:
- Enter a **name** (required) and optional **description**
- The current chart type is saved with the insight
- The full result set (up to 2,000 rows) is stored in PostgreSQL

### Adding to a Report or Dashboard

After saving, the **Save as Insight** button changes to **Add to Report/Dashboard**:

1. Click the button to open the target selector
2. Select one or more **Reports** and/or **Dashboards** from the lists
3. Click **Add to Selected**

The insight's ID is appended to the `report_ids` / `dashboard_ids` arrays in the database. Reports and dashboards can then reference insights when rendering.

> **Note:** You must create the Report or Dashboard first (under the **Reports** section) before it will appear in the jump list.

---

## API Reference

See [API.md](./API.md) for full endpoint documentation. Key analysis endpoints:

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/datasets` | Upload a dataset (multipart) |
| `GET` | `/datasets` | List datasets |
| `POST` | `/engine/query` | Run raw SQL against a dataset |
| `GET` | `/engine/datasets/{id}/preview` | Preview first N rows |
| `POST` | `/analysis/run` | Run analysis from MetricDef list |
| `POST` | `/analysis/configs` | Save an analysis configuration |
| `POST` | `/analysis/insights` | Save an Insight |
| `GET` | `/analysis/insights` | List your Insights |
| `POST` | `/analysis/insights/{id}/add-to` | Link Insight to reports/dashboards |
| `POST` | `/llm/nl-to-sql` | Convert natural language question to SQL |
| `GET` | `/llm/health` | Check Ollama availability |
| `POST` | `/output/csv` | Export result as CSV |
| `POST` | `/output/pdf` | Generate PDF report |
| `POST` | `/output/grafana` | Generate Grafana dashboard JSON |

---

## LLM Setup

### Pulling a Model (first run)

```bash
docker exec nadin-ollama-1 ollama pull qwen2.5-coder:7b-instruct
```

The model is stored in the `ollama_data` Docker volume (~4.5 GB for the default model). This only needs to be done once.

### Changing the Model

Set `OLLAMA_MODEL` in `.env` before starting:

```bash
OLLAMA_MODEL=qwen2.5:7b-instruct          # Better for German translation
OLLAMA_MODEL=sqlcoder:7b                   # Optimised for SQL generation
OLLAMA_MODEL=llama3.1:8b                   # General purpose
```

Any model available on Ollama Hub can be used. For SQL tasks, code-specialised models perform best.

### Disabling LLM Features

```bash
LLM_ENABLED=false
```

This disables NL→SQL and data translation. The rest of the application works normally.

### Offline / Air-Gapped Model Loading

On a connected machine:
```bash
ollama pull qwen2.5-coder:7b-instruct
# Locate model blobs:
# Linux: ~/.ollama/models/
# macOS: ~/.ollama/models/
```

Copy the `~/.ollama/models/` directory to the target machine and mount it as the `ollama_data` volume, or load via:

```bash
docker cp ./ollama-models/. nadin-ollama-1:/root/.ollama/models/
```
