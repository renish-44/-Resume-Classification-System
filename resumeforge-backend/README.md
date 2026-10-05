# ResumeForge — Resume Classification API (Backend)

**SAMATRIX RESUMEFORGE 2026** · inference-only FastAPI backend for the
TF-IDF (1–2 grams) + Logistic Regression resume classifier.

This service does **no training**. It loads the artifacts produced by your
teammate's training pipeline, extracts text from a resume, and returns ranked job
categories with confidence scores. A separate React frontend calls it over HTTP.

> **Responsible AI** — This system is intended for resume classification/organization
> and should not be used as the sole basis for employment decisions.

---

## 1. Architecture

```mermaid
flowchart LR
    subgraph Client
        FE[React frontend<br/>VITE_API_URL=http://localhost:8000]
    end

    subgraph API["FastAPI application (api/)"]
        MW[Middleware<br/>CORS · request-id · timing · security headers]
        RL[Rate limiting<br/>slowapi · per client IP]
        R[Routes<br/>/health /classes /model-info<br/>/results /predict /predict/batch]
        E[Error handlers<br/>error · code · request_id]
    end

    subgraph Core["Inference core (src/)"]
        TX[text_extraction<br/>PDF · DOCX · TXT in memory]
        PP[preprocessing<br/>clean_text]
        ML[model_loader<br/>artifact discovery + self-check]
        PR[predict<br/>ResumeClassifier]
    end

    subgraph Artifacts["Local artifacts (never from the internet)"]
        M[models/*.joblib]
        MD[models/metadata.json]
        RP[reports/*.csv|json]
    end

    FE --> MW --> RL --> R
    R --> E
    R --> TX --> PP --> PR
    PR --> ML
    ML --> M
    ML --> MD
    R --> RP
```

Request flow for `POST /predict`:

1. middleware assigns a request id, records latency, sets security headers;
2. the body is streamed into memory with a hard size cap (413 above the limit);
3. `multipart/form-data` (file) → `text_extraction` → text, or
   `application/json` → text directly;
4. `clean_text` (unless `APPLY_EXTERNAL_PREPROCESSING=false`);
5. `transform` → `predict_proba` → sort → top-k mapped to the model's own class names;
6. `{"predicted_category", "confidence", "top_predictions", "model",
   "extracted_chars", "low_confidence"}`.

---

## 2. Project structure

```
resumeforge-backend/
├── README.md                  # this file
├── requirements.txt           # pinned dependencies (+ scikit-learn placeholder)
├── .env.example               # every setting, documented, with defaults
├── .gitignore                 # hygiene only (no venv, .env, model binaries)
├── Dockerfile                 # python:3.10-slim, non-root, healthcheck
├── docker-compose.yml         # runs the API, mounts ./models read-only
├── api/
│   ├── __init__.py
│   ├── main.py                # app factory, lifespan, middleware, exception handlers
│   ├── routes.py              # all route handlers (APIRouter factory)
│   ├── schemas.py             # Pydantic v2 request/response models + examples
│   ├── settings.py            # pydantic-settings Settings class
│   ├── errors.py              # custom exceptions + handlers -> {"error", "code", "request_id"}
│   └── dependencies.py        # get_classifier(), rate limiter, request-id helpers
├── src/
│   ├── __init__.py
│   ├── config.py              # paths, constants, canonical settings defaults
│   ├── model_loader.py        # artifact detection, loading, startup self-check
│   ├── preprocessing.py       # clean_text (REPLACE with the training version)
│   ├── predict.py             # ResumeClassifier + CLI (python -m src.predict)
│   ├── text_extraction.py     # PDF / DOCX / TXT extraction, validated in memory
│   └── utils.py               # structured logging with PII redaction, helpers
├── models/
│   └── README.md              # accepted artifact layouts + pickle security note
├── reports/                   # optional: model_results.csv, per_class_metrics.csv,
│                              #           confusion_matrix.json, error_analysis.csv
└── tests/
    ├── conftest.py            # synthetic model + synthetic documents (no real resume)
    ├── test_preprocessing.py
    ├── test_model_loader.py
    ├── test_predict.py
    ├── test_text_extraction.py
    └── test_api.py
```

---

## 3. Install and run

```bash
cd resumeforge-backend

# 1) virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# Linux/macOS: python3 -m venv .venv && source .venv/bin/activate

# 2) dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 3) configuration (optional - the defaults work)
copy .env.example .env        # Windows PowerShell:  Copy-Item .env.example .env
# Linux/macOS: cp .env.example .env

# 4) run the API
uvicorn api.main:app --reload --port 8000
```

* Swagger UI: <http://localhost:8000/docs>
* ReDoc: <http://localhost:8000/redoc>
* OpenAPI JSON: <http://localhost:8000/openapi.json>

The API **starts even if the model is missing**: it logs the reason, serves
`/health` with `model_loaded: false` and returns `503` for prediction endpoints.
Put the artifacts in `models/` and restart.

### Docker (optional)

```bash
docker build -t resumeforge-backend .
docker run --rm -p 8000:8000 --env-file .env \
  -v "$(pwd)/models:/app/models:ro" -v "$(pwd)/reports:/app/reports:ro" \
  resumeforge-backend
# or: docker compose up --build
```

### Run the tests

```bash
python -m pytest -q          # 146 tests, no real model required
python -m pytest -q tests/test_api.py
```

The suite builds its own tiny `TfidfVectorizer(ngram_range=(1, 2)) +
LogisticRegression` pipeline on synthetic sentences in a temp directory, and
generates its PDFs/DOCX files in memory. **No real resume and no real artifact is
needed to run the tests.**

---

## 4. Add the teammate's model files

The backend auto-detects the layout, in this order:

### Layout A — one fitted pipeline (recommended)

```
models/
├── model.joblib       # joblib.dump(Pipeline([("tfidf", TfidfVectorizer(ngram_range=(1,2))),
│                      #                  ("clf", LogisticRegression(...))]).fit(texts, labels))
└── metadata.json      # optional, see below
```

### Layout B — two separate files

```
models/
├── vectorizer.joblib  # the fitted TfidfVectorizer
└── classifier.joblib  # the fitted LogisticRegression
```

Used only when `models/model.joblib` does not exist.

### Layout C — optional label encoder

```
models/
├── vectorizer.joblib
├── classifier.joblib
└── label_encoder.joblib    # used when the classifier predicts integer indices
```

Without a label encoder the classifier's own `classes_` is used.
**Class names always come from the artifact — never from this code.**

### Optional metadata

```json
{
  "model_name": "TF-IDF (1-2 grams) + Logistic Regression",
  "trained_date": "2026-01-15",
  "sklearn_version": "1.5.2"
}
```

Every key is optional; unknown values are returned as `null` by `/model-info`.
Details: [`models/README.md`](models/README.md).

> ⚠️ **Pickle security** — `joblib.load` / `pickle.load` can execute arbitrary
> code. Only load artifacts from your own trusted training run. This service only
> ever reads the paths configured in the settings; a path or URL from an HTTP
> request is never used to load anything.

---

## 5. Make preprocessing match training (most important step)

A TF-IDF model only recognises the text it was fitted on. Copy your teammate's
training-time preprocessing into `clean_text`:

1. open the training notebook / module that produced the `Resume_str` column;
2. copy the **whole** transformation chain: HTML stripping, URL/e-mail/phone
   handling, lower-casing, stop-words, punctuation rules, whitespace
   normalisation, tokenisation — in the same order;
3. paste it into the marked block in `src/preprocessing.py`:

   ```python
   def clean_text(text: str) -> str:
       # =================================================================== #
       # REPLACE THE BODY OF clean_text WITH THE EXACT PREPROCESSING USED      #
       # DURING TRAINING.                                                   #
       ...
   ```

   The signature must stay `clean_text(text: str) -> str` and it must never raise;
4. bump `PREPROCESSING_VERSION` at the top of the module (`"default-v1"` →
   `"training-v2"`, …). `GET /model-info` reports it, so drift stays traceable;
5. update the reference strings in `tests/test_preprocessing.py` to the new
   expected output and re-run the tests;
6. if your saved pipeline already cleans internally (a `FunctionTransformer` or a
   custom analyzer), set `APPLY_EXTERNAL_PREPROCESSING=false` so the raw text goes
   straight to the vectorizer.

The shipped default handles `None`/non-string input, unicode and encoding repair,
HTML tags, URLs, e-mails, phone numbers, whitespace, lower-casing and preserves
technical tokens (`C++`, `C#`, `.NET`, `Node.js`, `SQL`, `AWS`, `TensorFlow`,
`NLP`, …). It is a **runnable fallback, not the training version**.

---

## 6. Match the scikit-learn version

```bash
# in the training environment
python -c "import sklearn; print(sklearn.__version__)"
```

Put that exact version in `requirements.txt` (see the marked placeholder at the
top of the file). Artifacts are not portable across scikit-learn versions.

* If the running version differs from the version in `metadata.json`, the API logs
  a warning and keeps serving.
* The same happens when `ngram_range` is not `(1, 2)`.
* Class names are read from the artifact, so no code change is needed for a new
  category set.

---

## 7. Settings

Every setting can be an environment variable or a line in `.env`
(see [`.env.example`](.env.example)).

| Name | Default | Description |
| --- | --- | --- |
| `MODEL_PATH` | `models/model.joblib` | Full fitted sklearn Pipeline (vectorizer + classifier) as a `.joblib` file. |
| `VECTORIZER_PATH` | `models/vectorizer.joblib` | Standalone fitted `TfidfVectorizer`; used only when `MODEL_PATH` is absent. |
| `CLASSIFIER_PATH` | `models/classifier.joblib` | Standalone fitted `LogisticRegression`; used only when `MODEL_PATH` is absent. |
| `LABEL_ENCODER_PATH` | `models/label_encoder.joblib` | Optional fitted `LabelEncoder` used to map class indices to names. |
| `MODEL_METADATA_PATH` | `models/metadata.json` | Optional JSON with training metadata (versions, date, model name). |
| `REPORTS_DIR` | `reports` | Directory holding the optional evaluation report files. |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of browser origins allowed by CORS. |
| `MAX_UPLOAD_MB` | `5` | Maximum accepted upload size in megabytes. |
| `MAX_TEXT_CHARS` | `100000` | Maximum accepted resume text length in characters. |
| `MIN_TEXT_CHARS` | `50` | Minimum accepted resume text length in characters. |
| `TOP_K` | `5` | Default number of ranked alternatives returned by `/predict`. |
| `CONFIDENCE_THRESHOLD` | `0.5` | Confidence below which a prediction is flagged `low_confidence`. |
| `APPLY_EXTERNAL_PREPROCESSING` | `true` | Apply `clean_text` before inference; disable if the saved pipeline already cleans. |
| `RATE_LIMIT` | `30/minute` | slowapi rate limit applied to `/predict` and `/predict/batch`. |
| `LOG_LEVEL` | `INFO` | Python logging level name (`DEBUG`…`CRITICAL`). |
| `ENVIRONMENT` | `development` | Deployment environment label. |
| `RESUMEFORGE_BASE_DIR` | *(project dir)* | Optional: relocate the base directory used to resolve relative paths. |

Relative artifact paths are resolved against the project directory (never
hard-coded absolute or Windows paths).

---

## 8. API reference

`POST /predict` accepts **either** `multipart/form-data` with a `file` field
(PDF / DOCX / TXT) **or** `application/json` `{"text": "..."}`. Sending both or
neither is a `400`. Optional query parameter: `top_k` (1–10).

All responses below are **real responses from the synthetic test fixture** (a
3-class model). Replace the category names and probabilities with the ones your
trained model produces.

### `GET /health`

```bash
curl -s http://localhost:8000/health
```

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_name": "TfidfVectorizer+LogisticRegression",
  "version": "1.0.0"
}
```

When the artifacts are missing the service still answers, with
`"model_loaded": false` and `"model_name": null`.

### `GET /classes`

```bash
curl -s http://localhost:8000/classes
```

```json
{
  "classes": ["Accounting", "Data Science", "Human Resources"],
  "count": 3
}
```

`503 MODEL_NOT_LOADED` when no model is loaded.

### `GET /model-info`

```bash
curl -s http://localhost:8000/model-info
```

```json
{
  "model_name": "TfidfVectorizer+LogisticRegression",
  "model_type": "sklearn_pipeline",
  "ngram_range": [1, 2],
  "num_classes": 3,
  "vocab_size": 159,
  "preprocessing_version": "default-v1",
  "sklearn_runtime_version": "1.9.1",
  "sklearn_trained_version": "1.5.2",
  "trained_date": "2026-01-15",
  "confidence_threshold": 0.5
}
```

`sklearn_trained_version` and `trained_date` are `null` when no metadata file is
present — nothing is guessed.

### `GET /results`

```bash
curl -s http://localhost:8000/results
```

```json
{
  "available": true,
  "model_results": [],
  "per_class_metrics": [
    {
      "category": "Accounting",
      "precision": "0.85",
      "recall": "0.83",
      "f1": "0.84",
      "support": "120"
    },
    {
      "category": "Data Science",
      "precision": "0.91",
      "recall": "0.89",
      "f1": "0.90",
      "support": "240"
    },
    {
      "category": "Human Resources",
      "precision": "0.88",
      "recall": "0.86",
      "f1": "0.87",
      "support": "180"
    }
  ],
  "confusion_matrix": null,
  "error_analysis": []
}
```

Reads `reports/model_results.csv`, `reports/per_class_metrics.csv`,
`reports/confusion_matrix.json` and `reports/error_analysis.csv`
(capped at 200 rows) **only when those files exist**. With an empty `reports/`
folder:

```json
{
  "available": false,
  "model_results": [],
  "per_class_metrics": [],
  "confusion_matrix": null,
  "error_analysis": []
}
```

### `POST /predict` — JSON text

```bash
curl -s -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "Data scientist with five years of experience. Built and evaluated machine learning models in Python with pandas, numpy and scikit-learn, deployed them on AWS with a SQL feature store, and presented forecasting results to business stakeholders."}'
```

```json
{
  "predicted_category": "Data Science",
  "confidence": 0.471,
  "top_predictions": [
    { "category": "Data Science", "probability": 0.471 },
    { "category": "Human Resources", "probability": 0.2694 },
    { "category": "Accounting", "probability": 0.2597 }
  ],
  "model": "TfidfVectorizer+LogisticRegression",
  "extracted_chars": 318,
  "low_confidence": true
}
```

With `?top_k=2`:

```json
{
  "predicted_category": "Data Science",
  "confidence": 0.471,
  "top_predictions": [
    { "category": "Data Science", "probability": 0.471 },
    { "category": "Human Resources", "probability": 0.2694 }
  ],
  "model": "TfidfVectorizer+LogisticRegression",
  "extracted_chars": 318,
  "low_confidence": true
}
```

### `POST /predict` — PDF upload

```bash
curl -s -X POST http://localhost:8000/predict \
  -F "file=@resume.pdf"
```

```json
{
  "predicted_category": "Data Science",
  "confidence": 0.471,
  "top_predictions": [
    { "category": "Data Science", "probability": 0.471 },
    { "category": "Human Resources", "probability": 0.2694 },
    { "category": "Accounting", "probability": 0.2597 }
  ],
  "model": "TfidfVectorizer+LogisticRegression",
  "extracted_chars": 318,
  "low_confidence": true
}
```

### `POST /predict` — DOCX upload

```bash
curl -s -X POST http://localhost:8000/predict \
  -F "file=@resume.docx"
```

```json
{
  "predicted_category": "Data Science",
  "confidence": 0.4373,
  "top_predictions": [
    { "category": "Data Science", "probability": 0.4373 },
    { "category": "Accounting", "probability": 0.2814 },
    { "category": "Human Resources", "probability": 0.2813 }
  ],
  "model": "TfidfVectorizer+LogisticRegression",
  "extracted_chars": 67,
  "low_confidence": true
}
```

(DOCX paragraphs **and** table cells are extracted, so `extracted_chars` is
smaller than the whole document.)

### `POST /predict` — TXT upload

```bash
curl -s -X POST http://localhost:8000/predict \
  -F "file=@resume.txt"
```

Same shape as the JSON example (`"extracted_chars": 318`, `"confidence": 0.471`).

### `POST /predict/batch`

```bash
curl -s -X POST http://localhost:8000/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Data scientist with five years of experience building machine learning models in Python with pandas and SQL on AWS.", "Mechanical engineer with CAD, SolidWorks and manufacturing process improvement experience across two plants."]}'
```

```json
[
  {
    "predicted_category": "Data Science",
    "confidence": 0.471,
    "top_predictions": [
      { "category": "Data Science", "probability": 0.471 },
      { "category": "Human Resources", "probability": 0.2694 },
      { "category": "Accounting", "probability": 0.2597 }
    ],
    "model": "TfidfVectorizer+LogisticRegression",
    "extracted_chars": 318,
    "low_confidence": true
  }
]
```

Maximum 20 texts per call.

### Command line (no HTTP)

```bash
python -m src.predict --text "data scientist with python, sql and machine learning"
python -m src.predict --file resume.pdf --top-k 5
```

Prints pretty JSON and exits non-zero on any error.

---

## 9. Error format and codes

Every failure returns the same envelope, and the same `request_id` that is echoed
in the `X-Request-ID` response header:

```json
{
  "error": "human readable message",
  "code": "SNAKE_CASE_CODE",
  "request_id": "0e1cfebc591a4519a615e0dd68999c63"
}
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `MISSING_INPUT` | Neither `text` nor a `file` part was sent. |
| 400 | `AMBIGUOUS_INPUT` | Both `text` and a `file` part were sent. |
| 400 | `EMPTY_TEXT` | The JSON `text` field was empty/blank. |
| 400 | `EMPTY_FILE` | The uploaded file contained 0 bytes. |
| 400 | `INVALID_JSON` | The body was not valid UTF-8 JSON, or `text` was not a string. |
| 400 | `MULTIPLE_FILES` | More than one `file` part in the multipart body. |
| 400 | `INPUT_TOO_SHORT` | Text shorter than `MIN_TEXT_CHARS`. |
| 400 | `BATCH_TOO_LARGE` | More than 20 texts in one batch (also reachable via 422). |
| 400 | `BAD_REQUEST` | Malformed multipart body. |
| 404 | `NOT_FOUND` | Unknown endpoint. |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method for an existing endpoint. |
| 413 | `FILE_TOO_LARGE` | Upload above `MAX_UPLOAD_MB` (rejected before parsing). |
| 413 | `INPUT_TOO_LONG` | Text longer than `MAX_TEXT_CHARS`. |
| 413 | `PAYLOAD_TOO_LARGE` | Body above the hard cap. |
| 415 | `UNSUPPORTED_FILE_TYPE` | Not `.pdf` / `.docx` / `.txt`, or magic bytes disagree with the extension. |
| 415 | `UNSUPPORTED_CONTENT_TYPE` | Neither `multipart/form-data` nor `application/json`. |
| 422 | `VALIDATION_ERROR` | Pydantic schema validation (`top_k` out of range, empty `texts`, …). |
| 422 | `CORRUPTED_FILE` | Broken PDF/DOCX container. |
| 422 | `ENCRYPTED_PDF` | Password-protected PDF (no cracking is attempted). |
| 422 | `NO_EXTRACTABLE_TEXT` | No text layer (scanned/image-only PDF). |
| 429 | `RATE_LIMIT_EXCEEDED` | More requests than `RATE_LIMIT` from one IP. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected failure; details are logged only. |
| 503 | `MODEL_NOT_LOADED` | No artifact loaded. |
| 503 | `MODEL_NOT_FOUND` | No artifact found in any configured path. |
| 503 | `MODEL_LOAD_ERROR` | The artifact exists but cannot be used. |

Real examples:

```json
{
  "error": "Send either a file or text, not both.",
  "code": "AMBIGUOUS_INPUT",
  "request_id": "0e1cfebc591a4519a615e0dd68999c63"
}
```

```json
{
  "error": "The uploaded file is larger than the 5 MB limit.",
  "code": "FILE_TOO_LARGE",
  "request_id": "c929cf9f69fd461ea5c8385035e229f4"
}
```

```json
{
  "error": "No text could be extracted from 'scanned.pdf'. Scanned or image-only documents must be converted to text first.",
  "code": "NO_EXTRACTABLE_TEXT",
  "request_id": "40b92da085b24f52aa58cbc8ed95f89c"
}
```

```json
{
  "error": "The classification model is not loaded. Place the trained artifacts in the models directory and restart the API; check /health and the API logs for details.",
  "code": "MODEL_NOT_LOADED",
  "request_id": "48300041de664c4bb9291bc2afcc6080"
}
```

---

## 10. Security and privacy

| Control | Implementation |
| --- | --- |
| No secrets in code | Only `.env.example` is committed; `.env` is git-ignored; no tokens or credentials anywhere. |
| Uploads in memory only | The body is streamed into a `bytearray`; `multipart/form-data` is parsed with in-memory callbacks (no `SpooledTemporaryFile`, no temp file, no disk write). |
| No resume content in logs | Logs contain request metadata only: request id, method, path, status, latency, byte size, file extension. A redaction filter additionally strips e-mails, phone numbers and long digit runs and truncates long messages. |
| File type validation | Extension **and** magic bytes (`%PDF-`, ZIP containing `word/document.xml`, decodable text, binary signatures). |
| Size limits | `MAX_UPLOAD_MB` enforced before parsing and per multipart part; `MAX_TEXT_CHARS` on the text path. |
| Rate limiting | slowapi, per client IP, `RATE_LIMIT` on `/predict` and `/predict/batch`. |
| CORS restricted | Only the origins in `ALLOWED_ORIGINS`; credentials disabled when `*` is configured. |
| Generic 500s | Unexpected errors are logged with a traceback and answered with a fixed message. |
| Local artifacts only | Artifacts are loaded exclusively from the configured local paths — never from user input or a URL. |
| Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on prediction endpoints, `X-Request-ID` on every response. |

### Pickle warning

`models/*.joblib` are pickle-based files: loading one can execute arbitrary
code. Only artifacts produced by your own trusted training run may be placed in
`models/`. Never accept a model file from a user upload, an email or a download.
This warning is repeated in [`models/README.md`](models/README.md) and in the
`src/model_loader.py` module docstring.

---

## 11. Limitations

* **Probabilities are only roughly calibrated.** `confidence` is the maximum
  probability of a multinomial Logistic Regression model. Use it to *rank*
  candidates, not as "the model is N % sure". `low_confidence` is a threshold
  flag, not a guarantee.
* **Scanned / image-only PDFs are unsupported** — they have no text layer
  (`422 NO_EXTRACTABLE_TEXT`). No OCR is performed.
* **Password-protected PDFs are rejected** (`422 ENCRYPTED_PDF`); no attempt is
  made to decrypt them.
* **English resumes are assumed.** The preprocessing and the training vocabulary
  are English; other languages will be misclassified.
* **Categories are dataset-specific.** They are exactly the labels of the trained
  dataset (loaded from the artifact) and are not a general job taxonomy.
* **Single-label evaluation.** Resumes that plausibly belong to several
  categories are penalised by the ground truth, so the reported scores are a
  lower bound for real-world use.
* **Very short or boilerplate-heavy resumes** carry little signal for a
  bag-of-words model; expect `low_confidence: true`.
* **In-memory processing.** Uploads larger than `MAX_UPLOAD_MB` are refused, and
  a single process holds the model in RAM (roughly tens of MB).
* **Metrics are only as good as the report files.** `/results` shows nothing until
  the training step writes the CSVs/JSON into `reports/`.

---

## 12. Responsible AI

> This system is intended for resume classification/organization and should not
> be used as the sole basis for employment decisions.

ResumeForge organises and triages documents (routing, search, dashboards). It
does not and must not make hiring decisions: keep a human in the loop, review
low-confidence predictions, monitor for systematic errors across demographic
groups, and be transparent with candidates about how their data is processed.
Uploaded text is processed for prediction only and is never stored on disk.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `/health` → `model_loaded: false` | No artifact in the configured path | Copy the files into `models/` (see §4) and restart. |
| `IncompatibleArtifactError` at startup | The classifier has no `predict_proba` (e.g. `LinearSVC`) | Export a Logistic Regression instead. |
| Warning `sklearn_version_mismatch` | Runtime ≠ training scikit-learn | Install the training version (§6). |
| Warning `vectorizer_ngram_range_mismatch` | The vectorizer is not `(1, 2)` | Confirm this is intended; otherwise retrain with `(1, 2)`. |
| All predictions look wrong | Inference preprocessing ≠ training preprocessing | Paste the training preprocessing into `clean_text` (§5) and bump `PREPROCESSING_VERSION`. |
| `429` during the demo | `RATE_LIMIT` too low for demo traffic | Raise `RATE_LIMIT` (e.g. `120/minute`) in `.env`. |
| `CORS` errors in the browser | Frontend origin not allowed | Add it to `ALLOWED_ORIGINS` and restart. |
