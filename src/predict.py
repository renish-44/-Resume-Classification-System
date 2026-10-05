"""
Inference & Prediction Module for Resume Classification.
Samatrix ResumeForge 2026.

Provides inference pipeline for single or batch resume text inputs:
Raw Text -> clean_text() -> TF-IDF Vectorizer -> Model Prediction -> Probabilities/Confidences.
"""

import os
import sys
import json
import numpy as np
from typing import Dict, Any, List, Union

import joblib

# Import local preprocessing module
try:
    from src.preprocessing import clean_text
except ModuleNotFoundError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from src.preprocessing import clean_text

DEFAULT_VECTORIZER_PATH = "models/tfidf_vectorizer.joblib"
DEFAULT_MODEL_PATH = "models/best_ml_model.joblib"
DEFAULT_METADATA_PATH = "models/metadata.json"

_CACHED_VECTORIZER = None
_CACHED_MODEL = None
_CACHED_CLASSES = None


def load_artifacts(
    vectorizer_path: str = DEFAULT_VECTORIZER_PATH,
    model_path: str = DEFAULT_MODEL_PATH,
    metadata_path: str = DEFAULT_METADATA_PATH
):
    """
    Loads and caches the TF-IDF vectorizer, best ML model, and metadata.
    """
    global _CACHED_VECTORIZER, _CACHED_MODEL, _CACHED_CLASSES

    if not os.path.exists(vectorizer_path) or not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model artifacts not found at '{vectorizer_path}' or '{model_path}'. "
            "Please run 'python -m src.train_ml' first to train and save the pipeline."
        )

    _CACHED_VECTORIZER = joblib.load(vectorizer_path)
    _CACHED_MODEL = joblib.load(model_path)

    if hasattr(_CACHED_MODEL, "classes_"):
        _CACHED_CLASSES = _CACHED_MODEL.classes_
    elif os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            meta = json.load(f)
            _CACHED_CLASSES = np.array(meta.get("categories", []))
    else:
        _CACHED_CLASSES = np.array([])

    return _CACHED_VECTORIZER, _CACHED_MODEL, _CACHED_CLASSES


def predict(
    resume_text: str,
    top_k: int = 3,
    vectorizer_path: str = DEFAULT_VECTORIZER_PATH,
    model_path: str = DEFAULT_MODEL_PATH
) -> Dict[str, Any]:
    """
    Predicts the category of a single raw resume string.

    Parameters:
    -----------
    resume_text : str
        The raw resume text string.
    top_k : int, default=3
        Number of top candidate categories to return.

    Returns:
    --------
    dict containing:
        - category: Predicted top category
        - confidence: Float confidence percentage (0.0 to 1.0)
        - top_k_predictions: List of dicts with category and probability
        - cleaned_text_preview: First 150 chars of preprocessed text
    """
    global _CACHED_VECTORIZER, _CACHED_MODEL, _CACHED_CLASSES

    if _CACHED_VECTORIZER is None or _CACHED_MODEL is None:
        load_artifacts(vectorizer_path, model_path)

    # 1. Same preprocessing as training time
    cleaned = clean_text(resume_text, remove_stopwords=False, lemmatize=False)
    if not cleaned.strip():
        return {
            "category": "Unknown",
            "confidence": 0.0,
            "top_k_predictions": [],
            "cleaned_text_preview": ""
        }

    # 2. Vectorize using fitted TF-IDF
    vec_features = _CACHED_VECTORIZER.transform([cleaned])

    # 3. Model prediction & probability estimation
    if hasattr(_CACHED_MODEL, "predict_proba"):
        probs = _CACHED_MODEL.predict_proba(vec_features)[0]
    elif hasattr(_CACHED_MODEL, "decision_function"):
        dfunc = _CACHED_MODEL.decision_function(vec_features)[0]
        # Softmax approximation
        exp_d = np.exp(dfunc - np.max(dfunc))
        probs = exp_d / np.sum(exp_d)
    else:
        pred_label = _CACHED_MODEL.predict(vec_features)[0]
        return {
            "category": pred_label,
            "confidence": 1.0,
            "top_k_predictions": [{"category": pred_label, "probability": 1.0}],
            "cleaned_text_preview": cleaned[:150]
        }

    classes = _CACHED_CLASSES if _CACHED_CLASSES is not None and len(_CACHED_CLASSES) > 0 else _CACHED_MODEL.classes_
    sorted_indices = np.argsort(probs)[::-1]
    top_index = sorted_indices[0]

    predicted_category = classes[top_index]
    top_confidence = float(probs[top_index])

    top_predictions = []
    for idx in sorted_indices[:top_k]:
        top_predictions.append({
            "category": str(classes[idx]),
            "probability": round(float(probs[idx]), 4)
        })

    return {
        "category": predicted_category,
        "confidence": round(top_confidence, 4),
        "top_predictions": top_predictions,
        "cleaned_text_preview": cleaned[:150] + ("..." if len(cleaned) > 150 else "")
    }


def predict_batch(texts: List[str]) -> List[Dict[str, Any]]:
    """Runs predictions on a list of raw resume texts."""
    return [predict(t) for t in texts]


def run_unseen_demo():
    """
    Demonstrates inference on 5 realistic, unseen resume test cases.
    """
    unseen_resumes = [
        {
            "role_target": "Data Science",
            "text": """
            Machine Learning Engineer with 4 years experience building NLP classification pipelines 
            and recommendation engines. Proficient in Python, PyTorch, Scikit-Learn, TensorFlow, 
            Pandas, SQL, and AWS SageMaker. Deployed real-time sentiment analysis models using Docker.
            Contact: candidate_ds@sample.io | +1-800-555-0199
            """
        },
        {
            "role_target": "DevOps Engineer",
            "text": """
            DevOps & Cloud Infrastructure Specialist. Hands-on expertise in Terraform, Kubernetes, 
            Docker containers, AWS (EC2, S3, ECS, IAM), and building automated CI/CD pipelines in Jenkins 
            and GitHub Actions. Designed monitoring dashboards with Prometheus and Grafana.
            Portfolio: https://github.com/cloud-ops-pro
            """
        },
        {
            "role_target": "DotNet Developer",
            "text": """
            Senior .NET Software Engineer with expertise in C#, ASP.NET Core, Entity Framework Core, 
            LINQ, and SQL Server. Built secure enterprise REST APIs, microservices, and migrated 
            legacy Windows services to Microsoft Azure Cloud.
            """
        },
        {
            "role_target": "Testing / QA",
            "text": """
            Lead QA Automation Engineer. Expert in Selenium WebDriver with Java and Python, TestNG, 
            Cucumber BDD framework, Postman API testing, and JIRA issue tracking. Created automated 
            regression test suites reducing release cycle times by 50%.
            """
        },
        {
            "role_target": "HR",
            "text": """
            Human Resources Business Partner with 6+ years in full-lifecycle talent acquisition, 
            candidate onboarding, employee relations, performance reviews, and labor compliance. 
            Proficient in Workday HRIS and strategic workforce planning.
            """
        }
    ]

    print("=" * 75)
    print(" INFERENCE DEMO ON UNSEEN RESUMES (src/predict.py)")
    print("=" * 75)

    for i, sample in enumerate(unseen_resumes, 1):
        res = predict(sample["text"])
        top3_str = ", ".join([f"{p['category']} ({p['probability']*100:.1f}%)" for p in res["top_predictions"]])
        print(f"\n[Test Case {i}] Target: {sample['role_target']}")
        print(f"  -> Predicted Category: {res['category']}")
        print(f"  -> Confidence:         {res['confidence']*100:.2f}%")
        print(f"  -> Top-3 Candidates:   {top3_str}")
        print(f"  -> Cleaned Preview:    {res['cleaned_text_preview']}")


if __name__ == "__main__":
    run_unseen_demo()
