# Evaluation reports (optional)

Drop the files your training/evaluation step produced here and they will be served
by `GET /results`. **Every file is optional; missing files are reported as empty
and nothing is ever invented.**

| File | Shape | Notes |
| --- | --- | --- |
| `model_results.csv` | header row + one row per model | e.g. `model,accuracy,precision,recall,macro_f1,weighted_f1` |
| `per_class_metrics.csv` | header row + one row per class | e.g. `category,precision,recall,f1,support` |
| `confusion_matrix.json` | `{"labels": [...], "matrix": [[...]]}` | row = true class, column = predicted class |
| `error_analysis.csv` | header row + one row per misclassified sample | capped at 200 rows by the API |

Examples:

```json
// confusion_matrix.json
{"labels": ["Accounting", "Data Science"], "matrix": [[3, 1], [0, 4]]}
```

```csv
// per_class_metrics.csv
category,precision,recall,f1,support
Accounting,0.85,0.83,0.84,120
Data Science,0.91,0.89,0.90,240
```

The folder ships empty on purpose: `GET /results` then answers
`{"available": false, "model_results": [], "per_class_metrics": [],
"confusion_matrix": null, "error_analysis": []}` instead of showing invented
numbers.
