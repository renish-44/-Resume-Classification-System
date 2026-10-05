/* ============================================================================
 * SITE CONTENT — all static copy lives here so components stay presentational.
 * Edit freely. Nothing in this file contains fabricated results: numeric claims
 * deliberately point at the /results page instead.
 * ========================================================================== */

import type { LucideIcon } from 'lucide-react';
import {
  Binary,
  BrainCircuit,
  FileSearch,
  Layers,
  Repeat2,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

/* -------------------------------------------------------------------------
 * Pipeline (landing page stepper)
 * ---------------------------------------------------------------------- */

export interface PipelineStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const pipelineSteps: PipelineStep[] = [
  {
    id: 'ingest',
    title: 'Upload / Paste',
    description: 'Drop a PDF or DOCX, or paste extracted resume text directly.',
    icon: FileSearch,
  },
  {
    id: 'extract',
    title: 'Text extraction',
    description: 'PDF/DOCX parsers strip layout and return a single clean text block.',
    icon: Layers,
  },
  {
    id: 'preprocess',
    title: 'Preprocessing',
    description: 'Lowercasing, noise removal and token-safe cleanup that keeps technical tokens.',
    icon: SlidersHorizontal,
  },
  {
    id: 'features',
    title: 'Features',
    description:
      'TF-IDF sparse features for classical models, Word2Vec embeddings for the deep model.',
    icon: Binary,
  },
  {
    id: 'predict',
    title: 'Model prediction',
    description:
      'Naive Bayes, Logistic Regression, Linear SVM or the BiLSTM classifier scores every class.',
    icon: BrainCircuit,
  },
  {
    id: 'result',
    title: 'Category + confidence',
    description: 'Top predicted category, calibrated confidence and the runner-up categories.',
    icon: ShieldCheck,
  },
];

/* -------------------------------------------------------------------------
 * Features grid
 * ---------------------------------------------------------------------- */

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const features: FeatureItem[] = [
  {
    id: 'input',
    title: 'PDF, DOCX and raw text',
    description:
      'Three input paths — upload a PDF, upload a DOCX, or paste text — all routed through the same prediction contract.',
    icon: FileSearch,
  },
  {
    id: 'tokens',
    title: 'Technical-token-safe preprocessing',
    description:
      'Cleanup that keeps C++, C#, .NET and Node.js intact instead of shredding them into meaningless fragments.',
    icon: ShieldCheck,
  },
  {
    id: 'leak-free',
    title: 'Leak-free evaluation',
    description:
      'Stratified splits with the vectorizer fitted on training data only, so test scores are not self-reported numbers.',
    icon: Repeat2,
  },
  {
    id: 'compare',
    title: 'Classical + deep comparison',
    description:
      'Multinomial Naive Bayes, Logistic Regression, Linear SVM and Word2Vec + BiLSTM evaluated side by side.',
    icon: BrainCircuit,
  },
  {
    id: 'confidence',
    title: 'Confidence and top-N',
    description:
      'Every prediction ships with a confidence score and the runner-up categories, so ambiguity stays visible.',
    icon: SlidersHorizontal,
  },
  {
    id: 'reproducible',
    title: 'Reproducible pipeline',
    description:
      'Notebook-to-production path: one preprocessing function, one feature step, one predict contract.',
    icon: Layers,
  },
];

/* -------------------------------------------------------------------------
 * Problem section
 * ---------------------------------------------------------------------- */

export const problemPoints = {
  manual: [
    'Hundreds of resumes read one by one, every single posting.',
    'Judgement drifts with fatigue, recruiter load and time of day.',
    'Near-duplicate roles get filed under different labels.',
    'Nothing about the decision is traceable after the fact.',
  ],
  ml: [
    'One pass produces a consistent label for every resume.',
    'Scoring is reproducible and can be audited on the same sample.',
    'Confidence exposes the ambiguous cases instead of hiding them.',
    'The pipeline grows with the dataset, not with the hiring season.',
  ],
};

/* -------------------------------------------------------------------------
 * FAQ
 * ---------------------------------------------------------------------- */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const faqs: FaqItem[] = [
  {
    id: 'file-types',
    question: 'Which file types can I upload?',
    answer:
      'PDF and DOCX up to 5 MB per file. You can also paste resume text directly, which is the fastest way to try the demo because it skips parsing.',
  },
  {
    id: 'storage',
    question: 'Is my data stored?',
    answer:
      'In the hackathon demo, uploaded text is processed for prediction only. Nothing is retained, and predictions stay in your browser session.',
  },
  {
    id: 'accuracy',
    question: 'How accurate is it?',
    answer:
      'Accuracy, precision, recall, macro-F1 and weighted-F1 for every model are published on the Results page, along with the per-class breakdown and the confusion matrix. We deliberately do not quote numbers on this page.',
  },
  {
    id: 'best-model',
    question: 'Which model is best?',
    answer:
      'The comparison table highlights a single row chosen by macro-F1 rather than accuracy alone, because accuracy can look strong on a class-imbalanced dataset while minority categories score poorly.',
  },
  {
    id: 'misclassify',
    question: 'Can it misclassify a resume?',
    answer:
      'Yes. Overlapping categories, generic resumes, very short documents, noisy extracted text and possibly inconsistent labels in the source data all cause errors. The error-analysis section lists concrete examples.',
  },
  {
    id: 'validation',
    question: 'How was it validated?',
    answer:
      'A stratified split keeps the class balance of training and test data identical, the TF-IDF vocabulary is fitted on training data only, duplicates are checked for leakage, and the test set stays untouched until the final evaluation.',
  },
];

/* -------------------------------------------------------------------------
 * About page — methodology timeline
 * ---------------------------------------------------------------------- */

export interface TimelineItem {
  id: string;
  title: string;
  description: string;
  status: string;
}

/**
 * Methodology timeline.
 *
 * HONESTY RULE: a stage is marked "Complete" only when the artefact exists in
 * this repository. "Planned" means the step is described in the project README
 * but no code, notebook or report for it is committed yet. Edit these strings
 * as the team ships each stage — do not mark anything complete without evidence.
 */
export const methodologyTimeline: TimelineItem[] = [
  {
    id: 'understanding',
    title: 'Problem understanding',
    description:
      'Defined the single-label classification task, the target column and the intended use (organise resumes, never decide hiring).',
    status: 'Complete',
  },
  {
    id: 'data-audit',
    title: 'Data audit',
    description:
      'Row counts, class balance, duplicates and empty-document checks on Resume.csv. No audit notebook is committed yet, so the numbers stay unreported.',
    status: 'Planned',
  },
  {
    id: 'eda',
    title: 'Exploratory analysis',
    description:
      'Length distributions, vocabulary inspection and class-level term frequency. notebooks/ is empty in this repository.',
    status: 'Planned',
  },
  {
    id: 'preprocessing',
    title: 'Text preprocessing',
    description:
      'One reusable cleaner (resumeforge-backend/src/preprocessing.py) applied identically at training and inference time.',
    status: 'Complete',
  },
  {
    id: 'classical',
    title: 'TF-IDF + logistic regression',
    description:
      'The shipped artifact is a TF-IDF (1-2 grams) + Logistic Regression pipeline. Naive Bayes and Linear SVM are described in the README but not implemented or measured here.',
    status: 'Partial — logistic regression only',
  },
  {
    id: 'deep',
    title: 'Word2Vec + BiLSTM',
    description:
      'Planned deep-learning comparison. There is no gensim/tensorflow/torch dependency and no model artifact in resumeforge-backend/models/.',
    status: 'Planned',
  },
  {
    id: 'evaluation',
    title: 'Evaluation',
    description:
      'GET /results serves reports/model_results.csv, per_class_metrics.csv, confusion_matrix.json and error_analysis.csv. Those files are not present yet, so the site shows Pending instead of metrics.',
    status: 'Partial — pipeline ready, reports missing',
  },
  {
    id: 'errors',
    title: 'Error analysis',
    description:
      'Per-class inspection and confusion-matrix review are wired end to end; the misclassified rows themselves arrive from reports/error_analysis.csv.',
    status: 'Partial — pipeline ready, rows missing',
  },
  {
    id: 'pipeline',
    title: 'Final prediction pipeline',
    description:
      'POST /predict accepts PDF, DOCX, TXT or raw text and returns the ranked categories with confidence (resumeforge-backend/api + src), covered by the backend test suite.',
    status: 'Complete',
  },
  {
    id: 'demo',
    title: 'Demo & write-up',
    description:
      'This React site plus the FastAPI contract it talks to, with mock mode for offline demos and an honest Pending state when no model is loaded.',
    status: 'Complete',
  },
];

/* -------------------------------------------------------------------------
 * About page — preprocessing decisions
 * ---------------------------------------------------------------------- */

export const preprocessingDecisions: { title: string; body: string }[] = [
  {
    title: 'Technical tokens are preserved',
    body: 'Patterns such as C++, C#, .NET, Node.js and similar identifiers are protected before normalisation, because destroying them removes exactly the words that separate engineering resumes from the rest.',
  },
  {
    title: 'Contact details are neutralised',
    body: 'Emails, URLs and phone numbers are replaced with placeholders so the model cannot memorise identity strings instead of learning job language.',
  },
  {
    title: 'One function, both sides of the pipeline',
    body: 'Training and inference call the exact same cleaner, so a preprocessing mismatch can never quietly degrade live predictions.',
  },
  {
    title: 'Whitespace, casing and markup noise',
    body: 'Layout artefacts from HTML-based resumes, repeated headers and collapsed whitespace are removed before vectorisation.',
  },
];

/* -------------------------------------------------------------------------
 * About page — validation rigor
 * ---------------------------------------------------------------------- */

export const validationPractices: { title: string; body: string }[] = [
  {
    title: 'Stratified split',
    body: 'Classes are split proportionally, so rare categories are represented on both sides instead of vanishing from the test set.',
  },
  {
    title: 'Vectorizer fitted on train only',
    body: 'The TF-IDF vocabulary and IDF weights are learned from the training split and then applied to the test split. Fitting on everything would leak test statistics into training.',
  },
  {
    title: 'Duplicate-leakage checks',
    body: 'Near-duplicate resumes are inspected so the same document cannot appear in both splits and inflate the score.',
  },
  {
    title: 'Untouched test set',
    body: 'The test split is used once, for the final evaluation, so the reported numbers describe unseen data rather than a tuned fit.',
  },
];

/* -------------------------------------------------------------------------
 * About page — limitations & future work
 * ---------------------------------------------------------------------- */

export const limitations: string[] = [
  'Bag-of-words features ignore word order and context, which limits separation between categories that share vocabulary.',
  'Confidence values from an uncalibrated classifier should be read as relative scores, not as probabilities.',
  'Predictions inherit any labelling noise present in the source dataset.',
  'Extraction quality depends on the uploaded document: scanned or badly encoded PDFs produce degraded text.',
  'The pipeline classifies into a fixed set of categories and cannot propose a new one.',
];

export const futureWork: string[] = [
  'Fine-tune transformer encoders for contextual document embeddings.',
  'Add probability calibration so confidence scores become trustworthy probabilities.',
  'Support multi-label predictions for genuinely hybrid roles.',
  'Ship a containerised inference service with request logging for auditing.',
  'Turn the dataset into an anonymised benchmark so results can be reproduced independently.',
];

/* -------------------------------------------------------------------------
 * About page — tech stack badges
 * ---------------------------------------------------------------------- */

export interface StackItem {
  name: string;
  role: string;
}

export const frontendStack: StackItem[] = [
  { name: 'React 18', role: 'UI runtime' },
  { name: 'TypeScript', role: 'Strict typing' },
  { name: 'Vite', role: 'Build tool' },
  { name: 'Tailwind CSS', role: 'Design tokens' },
  { name: 'Framer Motion', role: 'Animation' },
  { name: 'Recharts', role: 'Charts' },
  { name: 'lucide-react', role: 'Icons' },
  { name: 'React Router', role: 'Routing' },
];

/**
 * Model-side stack.
 *
 * HONESTY RULE: only list libraries that appear in
 * resumeforge-backend/requirements.txt or in resumeforge-backend/src.
 * Gensim/Word2Vec, BiLSTM and Matplotlib/Seaborn are NOT part of this build and
 * have been removed; add them back when the code and the dependency actually
 * land in the repository.
 */
export const mlStack: StackItem[] = [
  { name: 'Python 3.14', role: 'Runtime' },
  { name: 'scikit-learn', role: 'TF-IDF + Logistic Regression' },
  { name: 'TF-IDF 1-2 grams', role: 'Features' },
  { name: 'joblib', role: 'Artifact loading' },
  { name: 'FastAPI + uvicorn', role: 'Prediction API' },
  { name: 'pypdf / python-docx', role: 'PDF + DOCX extraction' },
  { name: 'pytest + httpx', role: 'Test suite' },
];
