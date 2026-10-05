# `models/` — where the trained artifacts go

This folder holds the **inference artifacts produced by your training pipeline**.
The backend never trains anything: it only loads what you export here.

## Accepted layouts (auto-detected, first match wins)

### Layout A — one fitted pipeline (recommended)

```
models/
├── model.joblib        # Pipeline([('tfidf', TfidfVectorizer), ('clf', LogisticRegression)])
└── metadata.json       # optional
```

`MODEL_PATH` (default `models/model.joblib`) is loaded first. Steps are detected
**by type**, not by name, so `tfidf` / `vect` / `bow` / `features` all work, and
anything between the vectorizer and the classifier (`'passthrough'`,
`SelectKBest`, a custom transformer, a nested pipeline) is preserved.

### Layout B — two separate files

```
models/
├── vectorizer.joblib   # the fitted TfidfVectorizer
├── classifier.joblib   # the fitted LogisticRegression
└── metadata.json       # optional
```

Used only when `models/model.joblib` does not exist.

### Layout C — optional label encoder

```
models/
├── vectorizer.joblib
├── classifier.joblib
└── label_encoder.joblib   # optional
```

If the classifier predicts integer indices (`classes_ == [0, 1, 2]`), the label
encoder's `classes_` provides the names. When the encoder is absent, the
classifier's own `classes_` is used. **Class names in the API always come from
the artifact - they are never hard-coded in the backend.**

## Optional metadata file

`models/metadata.json` (path configurable with `MODEL_METADATA_PATH`) is read
when present and may contain:

```json
{
  "model_name": "TF-IDF (1-2 grams) + Logistic Regression",
  "trained_date": "2026-01-15",
  "sklearn_version": "1.5.2",
  "preprocessing_version": "training-v3"
}
```

Every key is optional. Missing keys are reported as `null` by `GET /model-info`;
the backend never guesses a value. If the file sits next to `model.joblib` it is
picked up automatically.

## Version note (important)

`joblib` / `pickle` artifacts are **not portable across scikit-learn versions**.
Install the same scikit-learn version you trained with, otherwise loading may
fail - or, worse, succeed with different feature behaviour.

```bash
python -c "import sklearn; print(sklearn.__version__)"   # in your training env
```

Put that version in `requirements.txt` (see the marked placeholder at the top of
the file). When the running version differs from the version recorded in
`metadata.json`, the API logs a warning and keeps serving; it does not crash.

## Pickle security warning

> **`joblib.load` and `pickle.load` execute arbitrary code.**
>
> Only load artifacts you produced yourself from a trusted training run. Never
> load a `.joblib` / `.pkl` file that came from the internet, an email, a chat
> message or a user upload. The backend only ever loads paths from
> `MODEL_PATH` / `VECTORIZER_PATH` / `CLASSIFIER_PATH` / `LABEL_ENCODER_PATH`
> - never a path or URL coming from an HTTP request - and it validates that a
> classifier exposes `predict_proba` before using it.

## How to export the artifacts

```python
# In your training notebook / script, after fitting:
import joblib

pipeline = Pipeline([("tfidf", tfidf_vectorizer), ("clf", logistic_regression)])
joblib.dump(pipeline, "models/model.joblib")

# Optional, for nicer /model-info output:
import json, sklearn
with open("models/metadata.json", "w", encoding="utf-8") as fh:
    json.dump({"model_name": "TF-IDF (1-2 grams) + Logistic Regression",
               "sklearn_version": sklearn.__version__}, fh, indent=2)
```

**The backend must use the same preprocessing as training** - copy your training
preprocessing into `clean_text` in `src/preprocessing.py` (see the marked block
in that function) and, if your pipeline cleans internally, set
`APPLY_EXTERNAL_PREPROCESSING=false`.
