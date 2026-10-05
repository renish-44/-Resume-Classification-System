"""
Deep Learning Module — DistilBERT Fine-Tuning for Resume Classification.
Samatrix ResumeForge 2026.

Pipeline:
  Raw Text -> DistilBERT Tokenizer -> DistilBERT Encoder -> Classification Head
  -> Softmax -> Category Prediction

Features:
  - Hugging Face distilbert-base-uncased backbone
  - Resume-length aware truncation (512 tokens max)
  - Class-weighted cross-entropy loss for imbalanced classes
  - Early stopping on validation macro-F1
  - Per-epoch metrics, confusion matrix, full classification report
  - Model saved as models/dl_model/ (HuggingFace format)
  - Comparison table: SVM vs LR vs DistilBERT
"""

import os, sys, json, time, random, warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW

from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    get_linear_schedule_with_warmup,
)

try:
    from src.preprocessing import clean_text
except ModuleNotFoundError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from src.preprocessing import clean_text

# ── CONFIG ────────────────────────────────────────────────────────────────────
RANDOM_STATE = 42
MODEL_NAME   = "distilbert-base-uncased"
MAX_LEN      = 256
BATCH_SIZE   = 16
EPOCHS       = 10
LR           = 2e-5
WARMUP_RATIO = 0.1
PATIENCE     = 3
WEIGHT_DECAY = 0.01

DATA_TRAIN = "data/processed/train.csv"
DATA_VAL   = "data/processed/val.csv"
DATA_TEST  = "data/processed/test.csv"
OUT_MODEL_DIR  = "models/dl_model"
OUT_REPORT_DIR = "reports/dl"

os.makedirs(OUT_MODEL_DIR,  exist_ok=True)
os.makedirs(OUT_REPORT_DIR, exist_ok=True)
os.makedirs(f"{OUT_REPORT_DIR}/figures", exist_ok=True)

random.seed(RANDOM_STATE)
np.random.seed(RANDOM_STATE)
torch.manual_seed(RANDOM_STATE)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(RANDOM_STATE)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[INFO] Using device: {DEVICE}")


class ResumeDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len=MAX_LEN):
        self.texts, self.labels, self.tokenizer, self.max_len = texts, labels, tokenizer, max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        enc = self.tokenizer(
            self.texts[idx], max_length=self.max_len,
            padding="max_length", truncation=True, return_tensors="pt",
        )
        return {
            "input_ids":      enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "label":          torch.tensor(self.labels[idx], dtype=torch.long),
        }


def train_epoch(model, loader, optimizer, scheduler, loss_fn, device):
    model.train()
    total_loss, all_preds, all_labels = 0.0, [], []
    for batch in loader:
        ids  = batch["input_ids"].to(device)
        mask = batch["attention_mask"].to(device)
        lbl  = batch["label"].to(device)
        optimizer.zero_grad()
        logits = model(input_ids=ids, attention_mask=mask).logits
        loss   = loss_fn(logits, lbl)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step(); scheduler.step()
        total_loss += loss.item()
        all_preds.extend(torch.argmax(logits, dim=1).cpu().numpy())
        all_labels.extend(lbl.cpu().numpy())
    avg = total_loss / len(loader)
    return avg, accuracy_score(all_labels, all_preds), f1_score(all_labels, all_preds, average="macro", zero_division=0)


def eval_epoch(model, loader, loss_fn, device):
    model.eval()
    total_loss, all_preds, all_labels = 0.0, [], []
    with torch.no_grad():
        for batch in loader:
            ids  = batch["input_ids"].to(device)
            mask = batch["attention_mask"].to(device)
            lbl  = batch["label"].to(device)
            logits = model(input_ids=ids, attention_mask=mask).logits
            total_loss += loss_fn(logits, lbl).item()
            all_preds.extend(torch.argmax(logits, dim=1).cpu().numpy())
            all_labels.extend(lbl.cpu().numpy())
    avg = total_loss / len(loader)
    return avg, accuracy_score(all_labels, all_preds), f1_score(all_labels, all_preds, average="macro", zero_division=0), all_preds, all_labels


def plot_training_curves(history, out_dir):
    epochs = range(1, len(history["train_loss"]) + 1)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("DistilBERT Training Curves — Samatrix ResumeForge 2026", fontsize=13, fontweight="bold")
    axes[0].plot(epochs, history["train_loss"], "b-o", label="Train Loss")
    axes[0].plot(epochs, history["val_loss"],   "r-o", label="Val Loss")
    axes[0].set_title("Loss"); axes[0].set_xlabel("Epoch"); axes[0].legend(); axes[0].grid(alpha=0.3)
    axes[1].plot(epochs, history["train_f1"], "b-o", label="Train Macro-F1")
    axes[1].plot(epochs, history["val_f1"],   "r-o", label="Val Macro-F1")
    axes[1].set_title("Macro-F1"); axes[1].set_xlabel("Epoch"); axes[1].legend(); axes[1].grid(alpha=0.3)
    plt.tight_layout()
    p = f"{out_dir}/figures/training_curves.png"
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"[INFO] Saved: {p}")


def plot_confusion_matrix(y_true, y_pred, classes, out_dir):
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(16, 13))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=classes, yticklabels=classes, ax=ax)
    ax.set_title("DistilBERT — Test Confusion Matrix", fontsize=14, fontweight="bold")
    ax.set_ylabel("True"); ax.set_xlabel("Predicted")
    plt.xticks(rotation=45, ha="right"); plt.tight_layout()
    p = f"{out_dir}/figures/confusion_matrix_dl.png"
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"[INFO] Saved: {p}")


def train_distilbert():
    print("\n" + "="*70)
    print("  DISTILBERT FINE-TUNING — Samatrix ResumeForge 2026")
    print("="*70)

    for path in [DATA_TRAIN, DATA_VAL, DATA_TEST]:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing: '{path}'. Run python -m src.train_ml first.")

    df_train = pd.read_csv(DATA_TRAIN)
    df_val   = pd.read_csv(DATA_VAL)
    df_test  = pd.read_csv(DATA_TEST)
    for df in [df_train, df_val, df_test]:
        df.columns = [c.strip().lower() for c in df.columns]
        if "resume_text" in df.columns: df.rename(columns={"resume_text": "text"}, inplace=True)
        if "label" in df.columns: df.rename(columns={"label": "category"}, inplace=True)
    df_train.dropna(subset=["text","category"], inplace=True)
    df_val.dropna(subset=["text","category"],   inplace=True)
    df_test.dropna(subset=["text","category"],  inplace=True)
    print(f"Train: {len(df_train):,} | Val: {len(df_val):,} | Test: {len(df_test):,}")

    le = LabelEncoder()
    le.fit(df_train["category"])
    classes   = list(le.classes_)
    n_classes = len(classes)
    print(f"{n_classes} categories")

    with open(os.path.join(OUT_MODEL_DIR, "label_classes.json"), "w") as f:
        json.dump(classes, f, indent=2)

    y_train = le.transform(df_train["category"])
    y_val   = le.transform(df_val["category"])
    y_test  = le.transform(df_test["category"])

    print("Preprocessing text...")
    X_train = [clean_text(t) for t in df_train["text"]]
    X_val   = [clean_text(t) for t in df_val["text"]]
    X_test  = [clean_text(t) for t in df_test["text"]]

    print(f"Loading tokenizer: {MODEL_NAME}")
    tokenizer    = DistilBertTokenizerFast.from_pretrained(MODEL_NAME)
    train_loader = DataLoader(ResumeDataset(X_train, y_train, tokenizer), batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(ResumeDataset(X_val,   y_val,   tokenizer), batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader  = DataLoader(ResumeDataset(X_test,  y_test,  tokenizer), batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    print(f"Building DistilBERT ({n_classes} classes)...")
    model = DistilBertForSequenceClassification.from_pretrained(
        MODEL_NAME, num_labels=n_classes, ignore_mismatched_sizes=True
    ).to(DEVICE)

    cw = compute_class_weight("balanced", classes=np.unique(y_train), y=y_train)
    loss_fn   = nn.CrossEntropyLoss(weight=torch.tensor(cw, dtype=torch.float).to(DEVICE))
    optimizer = AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    total_steps = len(train_loader) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(optimizer, int(total_steps*WARMUP_RATIO), total_steps)

    print(f"\nTraining (up to {EPOCHS} epochs, patience={PATIENCE})...")
    history  = {"train_loss":[],"val_loss":[],"train_acc":[],"val_acc":[],"train_f1":[],"val_f1":[]}
    best_f1  = 0.0; best_epoch = 0; patience_counter = 0
    best_path = os.path.join(OUT_MODEL_DIR, "best_distilbert")

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_acc, tr_f1 = train_epoch(model, train_loader, optimizer, scheduler, loss_fn, DEVICE)
        vl_loss, vl_acc, vl_f1, _, _ = eval_epoch(model, val_loader, loss_fn, DEVICE)
        for k, v in [("train_loss",tr_loss),("val_loss",vl_loss),("train_acc",tr_acc),
                      ("val_acc",vl_acc),("train_f1",tr_f1),("val_f1",vl_f1)]:
            history[k].append(v)
        print(f"Epoch {epoch:02d}/{EPOCHS} | Tr Loss={tr_loss:.4f} F1={tr_f1:.4f} | Val Loss={vl_loss:.4f} F1={vl_f1:.4f} | {time.time()-t0:.0f}s")
        if vl_f1 > best_f1:
            best_f1 = vl_f1; best_epoch = epoch; patience_counter = 0
            model.save_pretrained(best_path); tokenizer.save_pretrained(best_path)
            print(f"  ✅ Best val F1={best_f1:.4f} saved.")
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"  Early stop at epoch {epoch}.")
                break

    print(f"\nLoading best model (epoch {best_epoch}) for test eval...")
    model = DistilBertForSequenceClassification.from_pretrained(
        best_path, num_labels=n_classes, ignore_mismatched_sizes=True
    ).to(DEVICE)
    _, test_acc, test_macro_f1, y_pred_enc, y_true_enc = eval_epoch(model, test_loader, loss_fn, DEVICE)
    y_pred = le.inverse_transform(y_pred_enc)
    y_true = le.inverse_transform(y_true_enc)
    test_weighted_f1 = f1_score(y_true_enc, y_pred_enc, average="weighted", zero_division=0)

    print("\n" + "="*70)
    print("  TEST RESULTS — DistilBERT")
    print(f"  Accuracy   : {test_acc*100:.2f}%")
    print(f"  Macro-F1   : {test_macro_f1:.4f}")
    print(f"  Weighted-F1: {test_weighted_f1:.4f}")
    print("="*70)
    print(classification_report(y_true, y_pred, digits=4, zero_division=0))

    pd.DataFrame(classification_report(y_true, y_pred, output_dict=True, zero_division=0)).T \
      .to_csv(f"{OUT_REPORT_DIR}/per_class_metrics_dl.csv")

    metrics = {
        "model": "DistilBERT (distilbert-base-uncased)",
        "max_len": MAX_LEN, "batch_size": BATCH_SIZE,
        "best_epoch": best_epoch,
        "best_val_macro_f1": round(best_f1, 4),
        "test_accuracy": round(test_acc, 4),
        "test_macro_f1": round(test_macro_f1, 4),
        "test_weighted_f1": round(test_weighted_f1, 4),
        "n_classes": n_classes, "classes": classes,
    }
    with open(f"{OUT_REPORT_DIR}/dl_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(f"{OUT_REPORT_DIR}/training_history.json", "w") as f:
        json.dump(history, f, indent=2)

    plot_training_curves(history, OUT_REPORT_DIR)
    plot_confusion_matrix(y_true, y_pred, classes, OUT_REPORT_DIR)

    # Comparison chart
    comp = []
    if os.path.exists("reports/model_results.csv"):
        for _, r in pd.read_csv("reports/model_results.csv").iterrows():
            comp.append({"Model": r.get("Model","?"), "Macro-F1": float(r.get("Macro-F1",0)), "Type":"Classical ML"})
    comp.append({"Model":"DistilBERT (fine-tuned)", "Macro-F1": round(test_macro_f1,4), "Type":"Deep Learning"})
    df_comp = pd.DataFrame(comp).sort_values("Macro-F1", ascending=False)
    df_comp.to_csv(f"{OUT_REPORT_DIR}/model_comparison.csv", index=False)
    print(df_comp.to_string(index=False))

    fig, ax = plt.subplots(figsize=(12, 6))
    colors = ["#4A90D9" if t=="Deep Learning" else "#7F8C9A" for t in df_comp["Type"]]
    bars = ax.barh(df_comp["Model"], df_comp["Macro-F1"], color=colors, height=0.6)
    ax.set_xlabel("Macro-F1 Score"); ax.set_title("Classical ML vs DistilBERT — Samatrix ResumeForge 2026", fontweight="bold")
    for b, v in zip(bars, df_comp["Macro-F1"]):
        ax.text(b.get_width()+0.002, b.get_y()+b.get_height()/2, f"{v:.4f}", va="center", fontsize=9)
    ax.set_xlim(0, df_comp["Macro-F1"].max()+0.1); ax.grid(axis="x", alpha=0.3)
    plt.tight_layout()
    plt.savefig(f"{OUT_REPORT_DIR}/figures/model_comparison.png", dpi=150, bbox_inches="tight"); plt.close()

    print(f"\n✅ Done! Model at: {best_path}/")
    return metrics


def predict_dl(resume_text, model_dir=None, top_k=3):
    if model_dir is None:
        model_dir = os.path.join(OUT_MODEL_DIR, "best_distilbert")
    with open(os.path.join(OUT_MODEL_DIR, "label_classes.json")) as f:
        classes = json.load(f)
    tok   = DistilBertTokenizerFast.from_pretrained(model_dir)
    model = DistilBertForSequenceClassification.from_pretrained(model_dir, num_labels=len(classes)).to(DEVICE)
    model.eval()
    cleaned = clean_text(resume_text)
    enc = tok(cleaned, max_length=MAX_LEN, padding="max_length", truncation=True, return_tensors="pt")
    with torch.no_grad():
        logits = model(input_ids=enc["input_ids"].to(DEVICE), attention_mask=enc["attention_mask"].to(DEVICE)).logits
    probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
    idx   = np.argsort(probs)[::-1]
    return {
        "category":   classes[idx[0]],
        "confidence": round(float(probs[idx[0]]), 4),
        "top_predictions": [{"category": classes[i], "probability": round(float(probs[i]),4)} for i in idx[:top_k]],
        "model": "DistilBERT",
    }


if __name__ == "__main__":
    train_distilbert()
