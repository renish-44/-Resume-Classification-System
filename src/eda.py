"""
Complete EDA - Samatrix ResumeForge 2026
Produces ALL required plots:
  1. Class distribution bar chart
  2. Resume length distribution (chars, words)
  3. Text length box-plot per class
  4. Top-20 unigrams / bigrams / trigrams
  5. Class-wise top TF-IDF terms heatmap
  6. WordCloud - overall
  7. WordCloud - per class (top 8 categories)
  8. Data quality summary bar
"""

import os
import sys
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer

try:
    from wordcloud import WordCloud
    HAS_WC = True
except ImportError:
    HAS_WC = False
    print("[WARN] wordcloud not installed - skipping WordCloud plots")

sys.path.insert(0, os.path.abspath("."))
from src.preprocessing import clean_text, _STOPWORDS

OUT = "reports/eda"
os.makedirs(OUT, exist_ok=True)
plt.rcParams.update({"figure.dpi": 130, "font.size": 11})


# ==========================================================
# LOAD DATA
# ==========================================================
frames = []
for p in ["data/processed/train.csv", "data/processed/val.csv", "data/processed/test.csv"]:
    if os.path.exists(p):
        d = pd.read_csv(p)
        d.columns = [c.strip().lower() for c in d.columns]
        if "resume_text" in d.columns:
            d.rename(columns={"resume_text": "text"}, inplace=True)
        if "label" in d.columns:
            d.rename(columns={"label": "category"}, inplace=True)
        frames.append(d)

if not frames:
    raise FileNotFoundError("No processed splits found. Run src/train_ml.py first.")

df = pd.concat(frames, ignore_index=True)
print(f"[EDA] Loaded {len(df)} rows, {df['category'].nunique()} categories")

# ==========================================================
# DATA QUALITY
# ==========================================================
n_total = len(df)
n_missing = int(df["text"].isna().sum())
n_empty = int((df["text"].fillna("").str.strip() == "").sum())
n_short = int((df["text"].fillna("").str.split().str.len() < 20).sum())
n_dup = int(df.duplicated(subset=["text"], keep=False).sum())

pd.DataFrame([{
    "total": n_total, "missing": n_missing, "empty": n_empty,
    "short_resumes": n_short, "duplicates": n_dup
}]).to_csv(f"{OUT}/data_quality_summary.csv", index=False)
print(f"  missing={n_missing}, empty={n_empty}, short={n_short}, dups={n_dup}")


# ==========================================================
# PLOT 1: CLASS DISTRIBUTION
# ==========================================================
print("[EDA] Plot 1: Class distribution")
cc = df["category"].value_counts().sort_values(ascending=True)
fig, ax = plt.subplots(figsize=(10, 8))
colors = plt.cm.tab20(np.linspace(0, 1, len(cc)))
bars = ax.barh(cc.index, cc.values, color=colors, edgecolor="white", height=0.75)
for b, v in zip(bars, cc.values):
    ax.text(b.get_width() + 5, b.get_y() + b.get_height() / 2,
            str(v), va="center", fontsize=9, fontweight="bold")
ax.set_xlabel("Number of Resumes")
ax.set_title("Resume Category Distribution\nSamatrix ResumeForge 2026",
             fontsize=13, fontweight="bold")
ax.set_xlim(0, cc.max() * 1.15)
ax.grid(axis="x", alpha=0.3)
plt.tight_layout()
plt.savefig(f"{OUT}/01_class_distribution.png", bbox_inches="tight")
plt.close()


# ==========================================================
# PLOT 2: TEXT LENGTH DISTRIBUTIONS
# ==========================================================
print("[EDA] Plot 2: Text length distributions")
df["char_len"] = df["text"].fillna("").str.len()
df["word_count"] = df["text"].fillna("").str.split().str.len()
med_char = df["char_len"].median()
med_word = df["word_count"].median()

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle("Resume Length Distribution - Samatrix ResumeForge 2026",
             fontsize=13, fontweight="bold")

axes[0].hist(df["char_len"], bins=50, color="#4A90D9", edgecolor="white", alpha=0.85)
axes[0].axvline(med_char, color="red", linestyle="--",
                label="Median={:.0f}".format(med_char))
axes[0].set_title("Character Count per Resume")
axes[0].set_xlabel("Characters")
axes[0].legend()
axes[0].grid(alpha=0.3)

axes[1].hist(df["word_count"], bins=50, color="#E67E22", edgecolor="white", alpha=0.85)
axes[1].axvline(med_word, color="red", linestyle="--",
                label="Median={:.0f}".format(med_word))
axes[1].set_title("Word Count per Resume")
axes[1].set_xlabel("Words")
axes[1].legend()
axes[1].grid(alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT}/02_text_length_distribution.png", bbox_inches="tight")
plt.close()


# ==========================================================
# PLOT 3: BOX-PLOT PER CLASS
# ==========================================================
print("[EDA] Plot 3: Word count box-plot per class")
order = df.groupby("category")["word_count"].median().sort_values(ascending=False).index
fig, ax = plt.subplots(figsize=(14, 7))
sns.boxplot(data=df, x="category", y="word_count", order=order,
            palette="tab20", linewidth=0.8, fliersize=2, ax=ax)
ax.set_xticklabels(ax.get_xticklabels(), rotation=45, ha="right", fontsize=9)
ax.set_title("Word Count per Category - Samatrix ResumeForge 2026",
             fontsize=13, fontweight="bold")
ax.set_xlabel("Category")
ax.set_ylabel("Word Count")
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig(f"{OUT}/03_length_boxplot_per_class.png", bbox_inches="tight")
plt.close()


# ==========================================================
# PLOT 4: N-GRAM ANALYSIS
# ==========================================================
print("[EDA] Plot 4: N-gram frequency analysis")
clean_corpus = [clean_text(t, remove_stopwords=True) for t in df["text"].fillna("").tolist()]

fig, axes = plt.subplots(1, 3, figsize=(20, 7))
fig.suptitle("Top N-Gram Frequencies (stopwords removed)\nSamatrix ResumeForge 2026",
             fontsize=13, fontweight="bold")

for ax, n, title in zip(axes, [1, 2, 3], ["Unigrams", "Bigrams", "Trigrams"]):
    vec = CountVectorizer(ngram_range=(n, n), max_features=5000).fit(clean_corpus)
    bag = vec.transform(clean_corpus)
    freqs = np.asarray(bag.sum(axis=0)).flatten()
    top = freqs.argsort()[::-1][:20]
    terms = np.array(vec.get_feature_names_out())[top]
    counts = freqs[top]
    clrs = plt.cm.Blues_r(np.linspace(0.2, 0.9, 20))
    ax.barh(terms[::-1], counts[::-1], color=clrs[::-1])
    ax.set_title("Top 20 {}".format(title), fontsize=11, fontweight="bold")
    ax.set_xlabel("Frequency")
    ax.grid(axis="x", alpha=0.3)

plt.tight_layout()
plt.savefig(f"{OUT}/04_ngram_analysis.png", bbox_inches="tight")
plt.close()


# ==========================================================
# PLOT 5: CLASS-WISE TF-IDF HEATMAP
# ==========================================================
print("[EDA] Plot 5: Class-wise TF-IDF heatmap")
tfidf = TfidfVectorizer(max_features=8000, ngram_range=(1, 2),
                        stop_words=list(_STOPWORDS), sublinear_tf=True)
X = tfidf.fit_transform(clean_corpus)
fn = np.array(tfidf.get_feature_names_out())
categories = sorted(df["category"].unique())
TOP = 6

rows_out = []
top_terms_data = {}
for cat in categories:
    mask = (df["category"] == cat).values   # numpy bool array
    if mask.sum() == 0:
        continue
    mean_t = np.asarray(X[mask].mean(axis=0)).flatten()
    top_idx = mean_t.argsort()[::-1][:TOP]
    top_terms_data[cat] = [(fn[i], round(float(mean_t[i]), 4)) for i in top_idx]
    for rank, (term, score) in enumerate(top_terms_data[cat], 1):
        rows_out.append({"category": cat, "rank": rank, "term": term, "tfidf_score": score})

pd.DataFrame(rows_out).to_csv(f"{OUT}/class_tfidf_terms.csv", index=False)

all_terms = list(dict.fromkeys(
    [t for terms in top_terms_data.values() for t, _ in terms]
))[:50]
heat = pd.DataFrame(0.0, index=categories, columns=all_terms)
for cat, terms in top_terms_data.items():
    for term, score in terms:
        if term in heat.columns:
            heat.loc[cat, term] = score

fig, ax = plt.subplots(figsize=(22, 10))
sns.heatmap(heat, cmap="YlOrRd", linewidths=0.3, ax=ax,
            cbar_kws={"label": "Mean TF-IDF Score"})
ax.set_title("Class-wise Top TF-IDF Terms - Samatrix ResumeForge 2026",
             fontsize=13, fontweight="bold")
ax.set_xticklabels(ax.get_xticklabels(), rotation=45, ha="right", fontsize=8)
ax.set_yticklabels(ax.get_yticklabels(), rotation=0, fontsize=9)
plt.tight_layout()
plt.savefig(f"{OUT}/05_class_tfidf_heatmap.png", bbox_inches="tight")
plt.close()


# ==========================================================
# PLOTS 6-7: WORDCLOUDS
# ==========================================================
if HAS_WC:
    print("[EDA] Plot 6: Overall WordCloud")
    all_text = " ".join(clean_corpus)
    wc = WordCloud(width=1400, height=700, background_color="white",
                   colormap="tab20", max_words=200,
                   stopwords=_STOPWORDS).generate(all_text)
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.imshow(wc, interpolation="bilinear")
    ax.axis("off")
    ax.set_title("Overall Resume WordCloud - Samatrix ResumeForge 2026",
                 fontsize=14, fontweight="bold", pad=12)
    plt.tight_layout()
    plt.savefig(f"{OUT}/06_wordcloud_overall.png", bbox_inches="tight")
    plt.close()

    print("[EDA] Plot 7: Per-class WordClouds")
    top_cats = df["category"].value_counts().head(8).index.tolist()
    fig, axes = plt.subplots(2, 4, figsize=(22, 10))
    fig.suptitle("Per-Class WordClouds (Top 8 Categories)\nSamatrix ResumeForge 2026",
                 fontsize=13, fontweight="bold")
    cmaps = ["Blues", "Oranges", "Greens", "Reds", "Purples", "YlOrBr", "PuBu", "GnBu"]
    for ax, cat, cmap in zip(axes.flat, top_cats, cmaps):
        cat_text = " ".join(
            clean_text(t, remove_stopwords=True)
            for t in df[df["category"] == cat]["text"].fillna("").tolist()
        )
        if not cat_text.strip():
            ax.axis("off")
            continue
        wc_c = WordCloud(width=600, height=400, background_color="white",
                         colormap=cmap, max_words=100,
                         stopwords=_STOPWORDS).generate(cat_text)
        ax.imshow(wc_c, interpolation="bilinear")
        ax.axis("off")
        ax.set_title(cat, fontsize=10, fontweight="bold")
    plt.tight_layout()
    plt.savefig(f"{OUT}/07_wordcloud_per_class.png", bbox_inches="tight")
    plt.close()


# ==========================================================
# PLOT 8: DATA QUALITY SUMMARY
# ==========================================================
print("[EDA] Plot 8: Data quality summary")
issue_labels = ["Total\nResumes", "Missing\nText", "Empty\nText", "Short\n(<20w)", "Duplicates"]
issue_values = [n_total, n_missing, n_empty, n_short, n_dup]
bar_colors = ["#2ECC71", "#E74C3C", "#E74C3C", "#F39C12", "#F39C12"]

fig, ax = plt.subplots(figsize=(9, 5))
bars = ax.bar(issue_labels, issue_values, color=bar_colors, edgecolor="white", width=0.55)
for b, v in zip(bars, issue_values):
    ax.text(b.get_x() + b.get_width() / 2, b.get_height() + max(issue_values) * 0.02,
            str(v), ha="center", fontsize=11, fontweight="bold")
ax.set_title("Data Quality Summary - Samatrix ResumeForge 2026",
             fontsize=13, fontweight="bold")
ax.set_ylabel("Count")
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig(f"{OUT}/08_data_quality.png", bbox_inches="tight")
plt.close()


# ==========================================================
# DONE
# ==========================================================
print("\n" + "=" * 60)
print("  EDA COMPLETE - All plots saved to reports/eda/")
print("=" * 60)
for fname in sorted(os.listdir(OUT)):
    if fname.endswith(".png") or fname.endswith(".csv"):
        print("  " + fname)
