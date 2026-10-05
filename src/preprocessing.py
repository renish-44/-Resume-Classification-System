"""
Data Preprocessing Module for Resume Classification.
Samatrix ResumeForge 2026.

Provides text cleaning, normalization, token preservation, and memoized linguistic processing.
Preserves key technical tokens: Python, C++, C#, SQL, AWS, .NET, Node.js, TensorFlow, NLP.
Supports basic cleaning, stopword removal, stemming, and lemmatization.
"""

import re
import string
from functools import lru_cache
import nltk
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer, WordNetLemmatizer

# Initialize NLTK download helpers safely
try:
    _STOPWORDS = set(stopwords.words("english"))
except LookupError:
    nltk.download("stopwords", quiet=True)
    _STOPWORDS = set(stopwords.words("english"))

try:
    _LEMMATIZER = WordNetLemmatizer()
    _LEMMATIZER.lemmatize("testing")
except LookupError:
    nltk.download("wordnet", quiet=True)
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
    _LEMMATIZER = WordNetLemmatizer()

_STEMMER = PorterStemmer()

# Fast Memoized Caches
@lru_cache(maxsize=100000)
def _cached_stem(tok: str) -> str:
    return _STEMMER.stem(tok)

@lru_cache(maxsize=100000)
def _cached_lemmatize(tok: str) -> str:
    return _LEMMATIZER.lemmatize(tok)

# Technical tokens to protect against over-stripping punctuation
PROTECTED_TOKENS = {
    r"\bc\+\+": " cplusplus ",
    r"\bc#": " csharp ",
    r"\.net\b": " dotnet ",
    r"\bnode\.js\b": " nodejs ",
    r"\bnext\.js\b": " nextjs ",
    r"\bvue\.js\b": " vuejs ",
    r"\breact\.js\b": " reactjs ",
    r"\btensorflow\b": " tensorflow ",
    r"\bpytorch\b": " pytorch ",
    r"\bnlp\b": " nlp ",
    r"\baws\b": " aws ",
    r"\bsql\b": " sql ",
    r"\bci/cd\b": " cicd "
}

REVERSE_PROTECTED_TOKENS = {
    "cplusplus": "c++",
    "csharp": "c#",
    "dotnet": ".net",
    "nodejs": "node.js",
    "nextjs": "next.js",
    "vuejs": "vue.js",
    "reactjs": "react.js",
    "cicd": "ci/cd"
}


def clean_text(
    text: str,
    remove_stopwords: bool = False,
    lemmatize: bool = False,
    stem: bool = False,
    preserve_canonical_names: bool = True
) -> str:
    """
    Cleans raw resume text through normalization, regex entity replacement,
    punctuation stripping while retaining technical tokens, and optional linguistic processing.
    """
    if text is None:
        return ""
    
    text = str(text).lower()

    # 1. Normalize line breaks and tabs
    text = re.sub(r"[\r\n\t]+", " ", text)

    # 2. Remove HTML tags and entities
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"&[a-z0-9]+;", " ", text)

    # 3. Replace URLs, emails, phone numbers with standardized tokens
    text = re.sub(r"https?://\S+|www\.\S+", " url ", text)
    text = re.sub(r"\b[\w\.-]+@[\w\.-]+\.\w+\b", " email ", text)
    text = re.sub(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", " phone ", text)

    # 4. Protect critical technical domain tokens
    for pattern, replacement in PROTECTED_TOKENS.items():
        text = re.sub(pattern, replacement, text)

    # 5. Remove non-alphanumeric characters (keep basic spaces and letters)
    text = re.sub(r"[^a-z0-9\s]", " ", text)

    # 6. Normalize multiple spaces
    text = re.sub(r"\s+", " ", text).strip()

    # 7. Token-level linguistic processing (Stopwords, Lemmatization, Stemming)
    tokens = text.split()

    if remove_stopwords:
        tokens = [tok for tok in tokens if tok not in _STOPWORDS and len(tok) > 1]

    if lemmatize:
        tokens = [_cached_lemmatize(tok) for tok in tokens]
    elif stem:
        tokens = [_cached_stem(tok) for tok in tokens]

    # Optional restoration of token formats if desired
    if preserve_canonical_names:
        tokens = [REVERSE_PROTECTED_TOKENS.get(tok, tok) for tok in tokens]

    return " ".join(tokens)


def preprocess_corpus(texts, variant="basic"):
    """
    Preprocesses an iterable of resume texts using one of 4 pipeline variants.
    """
    variant = variant.lower()
    if variant == "basic":
        return [clean_text(t, remove_stopwords=False, lemmatize=False, stem=False) for t in texts]
    elif variant == "stopwords":
        return [clean_text(t, remove_stopwords=True, lemmatize=False, stem=False) for t in texts]
    elif variant == "stemming":
        return [clean_text(t, remove_stopwords=True, lemmatize=False, stem=True) for t in texts]
    elif variant == "lemmatization":
        return [clean_text(t, remove_stopwords=True, lemmatize=True, stem=False) for t in texts]
    else:
        raise ValueError(f"Unknown variant '{variant}'. Choose from: 'basic', 'stopwords', 'stemming', 'lemmatization'.")