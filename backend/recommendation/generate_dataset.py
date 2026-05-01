# =============================================================
# FILE: backend/recommendation/generate_dataset.py
# RUN: python recommendation/generate_dataset.py
# (run from inside backend/ folder with venv activated)
# =============================================================

import pandas as pd
import numpy as np
import os
import time

np.random.seed(2024)
NUM_ROWS = 100_000

print("=" * 60)
print("  Clothing Recommendation Dataset Generator")
print("=" * 60)
print(f"\n  Generating {NUM_ROWS:,} rows...")

start_time = time.time()

# ── Step 1: Generate Gender ───────────────────────────────────
# 55% Female, 45% Male
gender_codes = np.random.choice([0, 1], size=NUM_ROWS, p=[0.55, 0.45])
genders = np.where(gender_codes == 0, "Female", "Male")

# ── Step 2: Generate Height ───────────────────────────────────
heights_f = np.round(np.random.uniform(148.0, 182.0, NUM_ROWS), 1)
heights_m = np.round(np.random.uniform(158.0, 198.0, NUM_ROWS), 1)
heights   = np.where(gender_codes == 0, heights_f, heights_m)

# ── Step 3: Generate BMI from realistic normal distribution ──
# FIX (Problem 2): replaces random height*weight which gave
# mean BMI=27.7 and 52% Plus_Comfort. Normal distribution
# centred on healthy BMI gives balanced style classes.
#   Female: mean=23.5, std=4.5  ->  ~57% Average/Curvy
#   Male  : mean=25.0, std=4.5  ->  ~55% Average/Athletic
bmi_f = np.clip(np.random.normal(23.5, 4.5, NUM_ROWS), 15.0, 42.0)
bmi_m = np.clip(np.random.normal(25.0, 4.5, NUM_ROWS), 16.0, 44.0)
bmi_raw = np.where(gender_codes == 0, bmi_f, bmi_m)

# Derive weight from height and target BMI
h_metres = heights / 100.0
weights  = np.round(bmi_raw * (h_metres ** 2), 1)
weights  = np.where(
    gender_codes == 0,
    np.clip(weights, 40.0, 110.0),
    np.clip(weights, 52.0, 130.0),
)

# Recalculate actual BMI after weight clipping
bmis = np.round(weights / (h_metres ** 2), 2)

# Add small noise so the model learns smooth probability
# boundaries rather than hard cutoffs
noise   = np.random.normal(0, 0.5, NUM_ROWS)
bmis_n  = bmis + noise          # noisy BMI used only for labelling

# ── Step 4: Generate Skin Tone ────────────────────────────────
# Cool=28%, Neutral=42%, Warm=30%
skin_codes = np.random.choice([0, 1, 2], size=NUM_ROWS, p=[0.28, 0.42, 0.30])
skin_names = {0: "Cool", 1: "Neutral", 2: "Warm"}
skin_tones = np.array([skin_names[c] for c in skin_codes])

# ── Step 5: Classify Clothing Style ──────────────────────────
# FIX (Problem 3): Curvy_Chic boundary moved from BMI 22-26
# to BMI 25-30 so healthy-weight women aren't mislabelled.
#
# Female styles
f_slim    = (gender_codes == 0) & (bmis_n < 18.5)
f_average = (gender_codes == 0) & (bmis_n >= 18.5) & (bmis_n < 25.0)
f_curvy   = (gender_codes == 0) & (bmis_n >= 25.0) & (bmis_n < 30.0)
f_plus    = (gender_codes == 0) & (bmis_n >= 30.0)

# Male styles
m_slim     = (gender_codes == 1) & (bmis_n < 18.5)
m_average  = (gender_codes == 1) & (bmis_n >= 18.5) & (bmis_n < 23.0)
m_athletic = (gender_codes == 1) & (bmis_n >= 23.0) & (bmis_n < 28.0)
m_plus     = (gender_codes == 1) & (bmis_n >= 28.0)

styles = np.select(
    [f_slim, f_average, f_curvy, f_plus,
     m_slim, m_average, m_athletic, m_plus],
    ["Slim_Fit", "Average_Fit", "Curvy_Chic", "Plus_Comfort",
     "Slim_Fit", "Average_Fit", "Athletic_Build", "Plus_Comfort"],
    default="Average_Fit",
)

# ── Step 6: Classify Color Palette ───────────────────────────
# Deterministic assignment based on Skin_Tone_Code + BMI bands.
# The previous random 60/40 split created a hard ~58% accuracy
# ceiling: the model could not learn what was random by design.
#
# Cool   (0):  BMI < 23            → Jewel_Tones
#              BMI ≥ 23            → Muted_Pastels
# Neutral(1):  BMI < 19.5          → Bold_Brights
#              BMI 19.5–24.9       → Neutral_Classic
#              BMI 25.0–28.9       → Earth_Tones
#              BMI ≥ 29            → Muted_Pastels
# Warm   (2):  BMI < 22            → Bold_Brights
#              BMI ≥ 22            → Earth_Tones
#
# 5% random label flip simulates real-world individual preference
# variation while keeping the signal learnable (theoretical ceiling ~96%).

cool_palette = np.where(bmis < 23.0, "Jewel_Tones", "Muted_Pastels")

neutral_palette = np.select(
    [bmis < 19.5, bmis < 25.0, bmis < 29.0],
    ["Bold_Brights", "Neutral_Classic", "Earth_Tones"],
    default="Muted_Pastels",
)

warm_palette = np.where(bmis < 22.0, "Bold_Brights", "Earth_Tones")

palettes = np.select(
    [skin_codes == 0, skin_codes == 1, skin_codes == 2],
    [cool_palette, neutral_palette, warm_palette],
    default="Neutral_Classic",
)

# 5% random label flip to simulate individual preference variation
_noise_mask    = np.random.uniform(0, 1, NUM_ROWS) < 0.05
_all_palettes  = np.array(["Bold_Brights", "Earth_Tones", "Jewel_Tones",
                            "Muted_Pastels", "Neutral_Classic"])
_noise_labels  = np.random.choice(_all_palettes, size=NUM_ROWS)
palettes       = np.where(_noise_mask, _noise_labels, palettes)

# ── Step 7: Build DataFrame ───────────────────────────────────
df = pd.DataFrame({
    "Height":                    heights,
    "Weight":                    weights,
    "BMI":                       bmis,
    "Gender":                    genders,
    "Gender_Code":               gender_codes,
    "Skin_Tone":                 skin_tones,
    "Skin_Tone_Code":            skin_codes,
    "Recommended_Style":         styles,
    "Recommended_Color_Palette": palettes,
})

# ── Step 8: Print Quality Report ─────────────────────────────
print("\n" + "=" * 60)
print("  QUALITY REPORT")
print("=" * 60)
print(f"  Total rows:      {len(df):,}")
print(f"  Null values:     {df.isnull().sum().sum()}")
print(f"  Duplicate rows:  {df.duplicated().sum():,}")

print(f"\n  GENDER:")
for g, c in df["Gender"].value_counts().items():
    print(f"    {g:8s}: {c:,} ({c/len(df)*100:.1f}%)")

print(f"\n  CLOTHING STYLE:")
for s, c in df["Recommended_Style"].value_counts().items():
    bar = "#" * int(c / len(df) * 50)
    print(f"    {s:16s}: {c:,} ({c/len(df)*100:.1f}%) {bar}")

print(f"\n  COLOR PALETTE:")
for p, c in df["Recommended_Color_Palette"].value_counts().items():
    bar = "#" * int(c / len(df) * 50)
    print(f"    {p:18s}: {c:,} ({c/len(df)*100:.1f}%) {bar}")

print(f"\n  SKIN TONE:")
for sk, c in df["Skin_Tone"].value_counts().items():
    print(f"    {sk:8s}: {c:,} ({c/len(df)*100:.1f}%)")

print(f"\n  BMI -- Min:{df['BMI'].min():.1f}  "
      f"Max:{df['BMI'].max():.1f}  "
      f"Mean:{df['BMI'].mean():.1f}")

# ── Step 9: Save CSV ──────────────────────────────────────────
output_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "clothing_data.csv",
)
df.to_csv(output_path, index=False, encoding="utf-8")

elapsed  = time.time() - start_time
size_mb  = os.path.getsize(output_path) / (1024 * 1024)

print("\n" + "=" * 60)
print("  DONE!")
print("=" * 60)
print(f"  File : clothing_data.csv")
print(f"  Rows : {len(df):,}")
print(f"  Size : {size_mb:.2f} MB")
print(f"  Time : {elapsed:.2f} seconds")
print(f"  Path : {output_path}")
print(f"\n  Next: python recommendation/train_model.py")
print("=" * 60)
