# ResumeForge — Web App

The front end for **ResumeForge — Resume Classification System**, built for
**SAMATRIX RESUMEFORGE 2026**.

Four routes: marketing landing page, a working demo, a results dashboard driven
entirely by one editable data file, and an about/methodology page.

---

## Stack

| Concern     | Choice                                        |
| ----------- | --------------------------------------------- |
| Framework   | React 18 + TypeScript (strict)                |
| Build       | Vite 5                                        |
| Styling     | Tailwind CSS with a custom design-token theme |
| Animation   | Framer Motion (reduced-motion aware)          |
| Charts      | Recharts                                      |
| Icons       | lucide-react                                  |
| Routing     | react-router-dom (lazy-loaded pages)          |
| Lint/format | ESLint 9 (flat config) + Prettier             |

No backend is required to run or build this app.

---

## 1. Install and run

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check (tsc -b) + production build into dist/
npm run preview      # serve the production build on http://localhost:4173
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write
npm run typecheck    # tsc project build, no bundle
```

> `npm run dev` runs the app in **mock mode** out of the box (see below), so it
> works immediately with no Python service running.

---

## 2. The one file you must edit: `src/data/results.ts`

Every metric, class label, chart series and table row on the site comes from
`src/data/results.ts`. Nothing numeric is hard-coded in a component.

Replace each `PENDING` value with your real result:

```ts
export const PENDING = 'TBD';

export const modelMetrics: ModelMetricRow[] = [
  {
    id: 'logistic-regression',
    model: 'Logistic Regression',
    family: 'Classical ML',
    description: 'Linear softmax classifier …',
    accuracy: 0.912, // was PENDING
    precision: 0.874,
    recall: 0.869,
    macroF1: 0.871,
    weightedF1: 0.911,
    trainingTimeSec: 3.42, // seconds
  },
  // …
];
```

Rules:

- Metrics are **decimals between 0 and 1** (`0.931` = 93.1%).
- `trainingTimeSec` is in seconds (accepts decimals).
- Fill the arrays `perClassMetrics`, `classDistribution`,
  `resumeLengthHistogram`, `errorRows` with your real rows.
- `confusionMatrix` needs `labels` and a matching square `matrix`.
- Set `selectedModelId` if you want a specific row highlighted in the
  comparison table; otherwise the UI highlights the macro-F1 leader.
- Any value left as `PENDING`, and any empty array, renders an elegant
  **“Pending — add results to src/data/results.ts”** state. No chart is ever
  drawn with invented numbers.

Copy strings you own (pipeline steps, FAQ, limitations, timeline, stack) live in
`src/data/content.ts`. Brand, nav, API URL, upload limits and the
low-confidence threshold live in `src/data/site.ts`.

---

## 3. Connect your Python backend

### Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local     # Windows: copy .env.example .env.local
```

| Variable                        | Purpose                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `VITE_API_URL`                  | Base URL of your FastAPI service, e.g. `http://localhost:8000`. **Empty ⇒ mock mode.** |
| `VITE_LOW_CONFIDENCE_THRESHOLD` | Below this value the demo shows the low-confidence warning (default `0.5`).            |
| `VITE_GITHUB_URL`               | Repository link used in the navbar and footer.                                         |
| `VITE_MODEL_LABEL`              | Optional badge shown next to the model name.                                           |

Vite only exposes variables prefixed with `VITE_`, and they are read at **build**
time for production builds — rebuild after changing them.

### API contract expected by the client

```
POST {VITE_API_URL}/predict

multipart/form-data   file=<pdf|docx>
application/json      { "text": "..." }
```

Success:

```json
{
  "predicted_category": "Data Science",
  "confidence": 0.87,
  "top_predictions": [
    { "category": "Data Science", "probability": 0.87 },
    { "category": "Engineering", "probability": 0.06 }
  ],
  "model": "logistic-regression",
  "extracted_chars": 2481
}
```

Failure: `{ "error": "message shown to the user" }`

The client validates and normalises whatever it receives
(`parsePredictResponse` in `src/lib/api.ts`): probabilities are clamped to 0–1,
the top predictions are sorted and truncated to five, and a missing
`predicted_category` becomes a friendly error. Any non-2xx response is surfaced
as an inline alert, never a crash.

### Mock mode

With `VITE_API_URL` empty the app answers itself with a **deterministic** mock
response (FNV-1a hash → seeded PRNG, so the same text always yields the same
output) and the demo shows a prominent “Demo mode — simulated output” banner
plus a “Simulated output” chip on every result. The JSON you copy or download
includes `"mode": "simulated"` so a mock result can never be mistaken for a real
one.

### Minimal FastAPI reference

Your own backend is the source of truth — this is only the shape the front end
expects (adjust freely, no file is included in this folder):

```python
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
import sys, pathlib
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from predict import predict_text, extract_text, MODEL_NAME  # your module

app = FastAPI()

class TextIn(BaseModel):
    text: str

@app.post("/predict")
async def predict(payload: TextIn | None = None, file: UploadFile | None = File(None)):
    try:
        if file is not None:
            raw = await file.read()
            text = extract_text(file.filename, raw)   # pdf / docx parser
        elif payload is not None and payload.text.strip():
            text = payload.text
        else:
            raise HTTPException(status_code=400, detail={"error": "Provide a file or text."})

        category, confidence, top = predict_text(text)
        return {
            "predicted_category": category,
            "confidence": float(confidence),
            "top_predictions": [{"category": c, "probability": float(p)} for c, p in top[:5]],
            "model": MODEL_NAME,
            "extracted_chars": len(text),
        }
    except Exception as exc:                       # noqa: BLE001
        raise HTTPException(status_code=500, detail={"error": str(exc)}) from exc
```

Run it with `uvicorn main:app --reload --port 8000` (or whatever your app module
is called), then set `VITE_API_URL=http://localhost:8000` and restart
`npm run dev`. If the browser blocks the request, enable CORS on the API:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
```

---

## 4. Before you submit — checklist

- [ ] `src/data/results.ts`: every `PENDING` replaced with real values; arrays filled.
- [ ] Responsible-AI statement kept verbatim in `responsibleAiNotice`.
- [ ] `dataHandlingNote` still true for your deployment.
- [ ] `VITE_API_URL` set in `.env.local` (or leave empty to demo in mock mode).
- [ ] `VITE_GITHUB_URL` / `GITHUB_URL` in `src/data/site.ts` points at your repo.
- [ ] Logo: swap the inline SVG in `src/components/ui/Logo.tsx` (and
      `public/favicon.svg`, `public/og-cover.svg`).
- [ ] `index.html` meta description tuned for your final numbers.
- [ ] `npm run lint && npm run build` clean.

---

## 5. Project structure

```
frontend/
├─ .env.example               # environment template
├─ index.html                 # SEO meta, Open Graph, font loading, theme pre-paint script
├─ vite.config.ts             # @ alias, manual vendor chunks
├─ tailwind.config.ts         # design tokens (colours, type, shadows, keyframes)
├─ eslint.config.js           # flat config: TS strict + react-hooks + react-refresh
├─ public/                    # favicon.svg, og-cover.svg, site.webmanifest
└─ src/
   ├─ main.tsx                # React root + ThemeProvider + BrowserRouter
   ├─ App.tsx                 # lazy routes + page transitions
   ├─ styles/index.css        # tokens, glass, gradient mesh, grain, skeleton, tables
   ├─ data/
   │  ├─ results.ts           # ← ALL metrics live here
   │  ├─ content.ts           # pipeline, features, FAQ, timeline, limitations, stack
   │  ├─ site.ts              # brand, nav, API URL, upload limits
   │  └─ samples.ts           # 3 fictional sample resumes
   ├─ lib/
   │  ├─ api.ts               # typed /predict client + deterministic mock
   │  ├─ prediction.ts        # JSON payload for copy/download
   │  ├─ validators.ts        # file + text validation
   │  ├─ format.ts            # percent / count / duration formatting, pending handling
   │  ├─ results.ts           # derived selectors (best model, pending checks)
   │  ├─ scoreTones.ts        # shared confidence colour bands
   │  ├─ theme.ts             # theme storage helpers
   │  ├─ motion.ts            # shared variants & easing
   │  ├─ download.ts          # JSON download helpers
   │  └─ cn.ts                # class joiner + clamp
   ├─ hooks/                  # useTheme, useCountUp, useMediaQuery, useCopyToClipboard, useDocumentMeta
   ├─ components/
   │  ├─ ui/                  # Button, Card, Badge, Tabs, Accordion, Gauge, Dropzone,
   │  │                       # DataTable, Heatmap, ChartFrame, ProgressBar, Alert, Container,
   │  │                       # Section, Skeleton/PendingState, Logo, Spinner, Reveal
   │  ├─ layout/              # Layout, Navbar, Footer, ThemeProvider, ThemeToggle, ScrollToTop
   │  ├─ charts/              # ModelComparisonChart, ClassDistributionChart, LengthHistogram, ChartTooltip
   │  ├─ sections/            # landing page sections
   │  └─ demo/                # InputPanel, ResultPanel, MockModeBanner
   └─ pages/                  # HomePage, DemoPage, ResultsPage, AboutPage, NotFoundPage
```

---

## 6. Design notes

- **Dark first, light available.** Dark by default, toggle in the navbar, stored
  in `localStorage`, applied before first paint by a tiny inline script so there
  is no flash. Semantic colours live in CSS variables, so both themes come from
  one set of Tailwind utilities (`bg-surface`, `text-muted`, `border-line`…).
- **Motion is decoration, never information.** Every animation has a
  `prefers-reduced-motion` path, and nothing communicates state through motion
  alone.
- **Accessibility.** Skip link, keyboard-operable tabs (arrow keys/Home/End),
  `role="tablist"`/`tabpanel`, `aria-expanded` accordions, progressbar and
  switch semantics, `aria-live` for errors and results, visible focus rings,
  ≥ 4.5:1 text contrast in both themes, and a real `<table>` for the confusion
  matrix with sticky headers.
- **Honesty about data.** The hero mockup is explicitly labelled “Illustrative
  preview” and shows no numbers; the responsible-AI statement appears on the
  landing page and under the demo result panel; “Pending” states never pretend.
- **Performance.** Route-level code splitting, vendor chunks for React, charts
  and motion, `font-display: swap`-style async font loading, and no third-party
  tracking of any kind.
