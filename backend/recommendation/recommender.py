# =============================================================
# FILE: backend/recommendation/recommender.py
# This file is imported by main.py — do NOT run it directly
# =============================================================

import pickle
import numpy as np
import os

# ── Find model files ──────────────────────────────────────────
_THIS_DIR   = os.path.dirname(os.path.abspath(__file__))
_MODELS_DIR = os.path.join(_THIS_DIR, "..", "models")
_STYLE_PATH = os.path.join(_MODELS_DIR, "style_model.pkl")
_COLOR_PATH = os.path.join(_MODELS_DIR, "color_model.pkl")

# ── Encoding maps (must match generate_dataset.py) ────────────
SKIN_TONE_MAP = {"Cool": 0, "Neutral": 1, "Warm": 2}
GENDER_MAP    = {"Male": 1, "Female": 0}

# ── Load models when this file is imported ────────────────────
_style_model    = None
_color_model    = None
_style_classes  = []
_color_classes  = []
_models_loaded  = False
_load_error     = None

def _load_models():
    global _style_model, _color_model, _style_classes, _color_classes, _models_loaded, _load_error
    try:
        if not os.path.exists(_STYLE_PATH):
            raise FileNotFoundError(
                f"Style model not found: {_STYLE_PATH}\n"
                "Run: python recommendation/train_model.py"
            )
        if not os.path.exists(_COLOR_PATH):
            raise FileNotFoundError(
                f"Color model not found: {_COLOR_PATH}\n"
                "Run: python recommendation/train_model.py"
            )
        with open(_STYLE_PATH, "rb") as f:
            style_data = pickle.load(f)
        with open(_COLOR_PATH, "rb") as f:
            color_data = pickle.load(f)

        # Support both old format (bare model) and new format (dict with classes)
        if isinstance(style_data, dict):
            _style_model   = style_data["model"]
            _style_classes = style_data["classes"]
        else:
            _style_model   = style_data
            _style_classes = ["Athletic_Build", "Average_Fit", "Curvy_Chic", "Plus_Comfort", "Slim_Fit"]

        if isinstance(color_data, dict):
            _color_model   = color_data["model"]
            _color_classes = color_data["classes"]
        else:
            _color_model   = color_data
            _color_classes = ["Bold_Brights", "Earth_Tones", "Jewel_Tones", "Muted_Pastels", "Neutral_Classic"]

        _models_loaded = True
        print("[OK] Body recommendation ML models loaded!")
    except Exception as e:
        _load_error = str(e)
        print(f"[WARN] ML models not loaded: {e}")

# Load when imported
_load_models()


def models_ready() -> bool:
    """Returns True if ML models are loaded and ready."""
    return _models_loaded


def predict_body_profile(
    height: float,
    weight: float,
    skin_tone: str,
    gender: str
) -> dict:
    """
    Predicts the best clothing style and color palette
    based on a person's body measurements and skin tone.

    Returns a dict with:
      - predicted_style
      - predicted_palette
      - bmi
      - style_confidence  (percentage)
      - color_confidence  (percentage)
    """
    if not _models_loaded:
        raise ValueError(
            f"ML models not loaded. {_load_error}"
        )

    # Calculate BMI
    bmi = round(weight / ((height / 100) ** 2), 2)

    # Encode categorical inputs to numbers
    skin_code   = SKIN_TONE_MAP.get(skin_tone, 1)
    gender_code = GENDER_MAP.get(gender, 0)

    # Create feature array (order must match train_model.py FEATURES list)
    # FEATURES = ["Height", "Weight", "BMI", "Gender_Code", "Skin_Tone_Code"]
    features = np.array([[height, weight, bmi, gender_code, skin_code]])

    # Style prediction — decode numeric index → class name
    style_proba = _style_model.predict_proba(features)[0]
    style_idx   = int(np.argmax(style_proba))
    predicted_style = _style_classes[style_idx] if _style_classes else str(style_idx)
    style_conf      = round(float(np.max(style_proba)) * 100, 1)

    # Color prediction — return top-2 palettes so minority palettes
    # (Bold_Brights, Muted_Pastels) are surfaced as secondary options.
    color_proba  = _color_model.predict_proba(features)[0]
    top2_idx     = np.argsort(color_proba)[::-1][:2]
    primary_idx  = int(top2_idx[0])
    secondary_idx= int(top2_idx[1])

    predicted_palette           = _color_classes[primary_idx]   if _color_classes else str(primary_idx)
    predicted_palette_secondary = _color_classes[secondary_idx] if _color_classes else str(secondary_idx)
    color_conf           = round(float(color_proba[primary_idx])   * 100, 1)
    color_conf_secondary = round(float(color_proba[secondary_idx]) * 100, 1)

    return {
        "predicted_style":             predicted_style,
        "predicted_palette":           predicted_palette,
        "predicted_palette_secondary": predicted_palette_secondary,
        "bmi":                         bmi,
        "style_confidence":            style_conf,
        "color_confidence":            color_conf,
        "color_confidence_secondary":  color_conf_secondary,
    }
