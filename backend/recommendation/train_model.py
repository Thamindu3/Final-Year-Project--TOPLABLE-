# =============================================================
# FILE: backend/recommendation/train_model.py
# RUN:  python recommendation/train_model.py   (from backend/)
# =============================================================

import pandas as pd
import numpy as np
import pickle, os, time, json, warnings
warnings.filterwarnings("ignore")

from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier,
    ExtraTreesClassifier, HistGradientBoostingClassifier,
)
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score
)
from sklearn.preprocessing import LabelEncoder

try:
    from sklearn.metrics import roc_auc_score
    HAS_AUC = True
except ImportError:
    HAS_AUC = False

# ── Paths ─────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CSV_PATH   = os.path.join(BASE_DIR, "clothing_data.csv")
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
REPORT_DIR = os.path.join(BASE_DIR, "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

BANNER = "=" * 65

def banner(title):
    print(f"\n{BANNER}\n  {title}\n{BANNER}")


# ══════════════════════════════════════════════════════════════
# 1. LOAD DATASET
# ══════════════════════════════════════════════════════════════
banner("STEP 1 — Load Dataset")

if not os.path.exists(CSV_PATH):
    print("  ERROR: clothing_data.csv not found!")
    print("  Run:  python recommendation/generate_dataset.py")
    exit(1)

df = pd.read_csv(CSV_PATH)
print(f"  Rows loaded  : {len(df):,}")
print(f"  Columns      : {list(df.columns)}")
print(f"  Null values  : {df.isnull().sum().sum()}")
print(f"  Duplicates   : {df.duplicated().sum():,}")

FEATURES    = ["Height", "Weight", "BMI", "Gender_Code", "Skin_Tone_Code"]
X           = df[FEATURES].values
y_style_raw = df["Recommended_Style"].values
y_color_raw = df["Recommended_Color_Palette"].values

print(f"\n  Features     : {FEATURES}")
print(f"  Style classes: {sorted(set(y_style_raw))}")
print(f"  Color classes: {sorted(set(y_color_raw))}")

le_style = LabelEncoder().fit(y_style_raw)
le_color = LabelEncoder().fit(y_color_raw)
y_style  = le_style.transform(y_style_raw)
y_color  = le_color.transform(y_color_raw)


# ══════════════════════════════════════════════════════════════
# 2. TRAIN / TEST SPLIT
# ══════════════════════════════════════════════════════════════
banner("STEP 2 — Train / Test Split  (80 / 20, stratified)")

# Use a single index split so X, y_style, y_color stay aligned.
# The old approach (two separate splits with different stratify columns)
# caused X_tr rows to mismatch yc_tr labels, giving a broken color model.
idx = np.arange(len(X))
train_idx, test_idx = train_test_split(idx, test_size=0.2, random_state=42)
X_tr,  X_te  = X[train_idx],       X[test_idx]
ys_tr, ys_te = y_style[train_idx], y_style[test_idx]
yc_tr, yc_te = y_color[train_idx], y_color[test_idx]

print(f"  Train rows   : {len(X_tr):,}")
print(f"  Test  rows   : {len(X_te):,}")


# ══════════════════════════════════════════════════════════════
# 3. CLASSIFIERS TO COMPARE
# ══════════════════════════════════════════════════════════════
# class_weight='balanced' fixes minority-class suppression (Problem 1 & 2):
# the classifier upweights rare classes so Bold_Brights / Muted_Pastels
# are no longer completely ignored.
CLASSIFIERS = {
    "RandomForest"        : RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1, class_weight="balanced"),
    "ExtraTrees"          : ExtraTreesClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1, class_weight="balanced"),
    "GradientBoosting"    : GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42),
    "HistGradientBoosting": HistGradientBoostingClassifier(max_iter=300, max_depth=6, learning_rate=0.08, random_state=42),
}


def metrics_dict(y_true, y_pred, y_prob=None, label_names=None):
    acc = accuracy_score(y_true, y_pred)
    f1w = f1_score(y_true, y_pred, average="weighted")
    f1m = f1_score(y_true, y_pred, average="macro")
    pre = precision_score(y_true, y_pred, average="weighted", zero_division=0)
    rec = recall_score(y_true, y_pred, average="weighted", zero_division=0)
    d = dict(accuracy=acc, f1_weighted=f1w, f1_macro=f1m,
             precision_weighted=pre, recall_weighted=rec)
    if HAS_AUC and y_prob is not None:
        try:
            auc = roc_auc_score(y_true, y_prob, multi_class="ovr", average="weighted")
            d["roc_auc_weighted"] = auc
        except Exception:
            pass
    return d


def print_confusion(y_true, y_pred, class_names, title="Confusion Matrix"):
    cm     = confusion_matrix(y_true, y_pred)
    labels = [c[:10].ljust(10) for c in class_names]
    width  = max(len(l) for l in labels)
    print(f"\n  {title}")
    header = "  " + " " * (width + 2) + "  ".join(labels)
    print(header)
    for i, row in enumerate(cm):
        row_str = "  " + labels[i].ljust(width) + "  " + "  ".join(f"{v:10d}" for v in row)
        print(row_str)


# ══════════════════════════════════════════════════════════════
# 4. TRAIN & EVALUATE ALL CLASSIFIERS
# ══════════════════════════════════════════════════════════════
results = {}
best_style_acc = 0.0
best_color_acc = 0.0
best_style_model = None
best_color_model = None
best_style_name = ""
best_color_name = ""

for clf_name, clf_proto in CLASSIFIERS.items():
    banner(f"CLASSIFIER: {clf_name}")

    # ── STYLE ──────────────────────────────────────────────
    print(f"\n  [STYLE MODEL]")
    t0 = time.time()
    import copy
    clf_style = copy.deepcopy(clf_proto)
    clf_style.fit(X_tr, ys_tr)
    ys_pred = clf_style.predict(X_te)
    ys_prob = clf_style.predict_proba(X_te) if hasattr(clf_style, "predict_proba") else None
    st_time = time.time() - t0
    sm = metrics_dict(ys_te, ys_pred, ys_prob, le_style.classes_)

    print(f"  Accuracy         : {sm['accuracy']*100:.2f}%")
    print(f"  F1 (weighted)    : {sm['f1_weighted']*100:.2f}%")
    print(f"  F1 (macro)       : {sm['f1_macro']*100:.2f}%")
    print(f"  Precision (wt.)  : {sm['precision_weighted']*100:.2f}%")
    print(f"  Recall (wt.)     : {sm['recall_weighted']*100:.2f}%")
    if "roc_auc_weighted" in sm:
        print(f"  ROC-AUC (wt.)    : {sm['roc_auc_weighted']:.4f}")
    print(f"  Training time    : {st_time:.1f} s")

    print(f"\n  Per-class report:")
    print(classification_report(ys_te, ys_pred, target_names=le_style.classes_, digits=4))
    print_confusion(ys_te, ys_pred, list(le_style.classes_), "Confusion Matrix — Style")

    # ── COLOR ──────────────────────────────────────────────
    print(f"\n  [COLOR MODEL]")
    t0 = time.time()
    clf_color = copy.deepcopy(clf_proto)
    clf_color.fit(X_tr, yc_tr)
    yc_pred = clf_color.predict(X_te)
    yc_prob = clf_color.predict_proba(X_te) if hasattr(clf_color, "predict_proba") else None
    ct_time = time.time() - t0
    cm_ = metrics_dict(yc_te, yc_pred, yc_prob, le_color.classes_)

    print(f"  Accuracy         : {cm_['accuracy']*100:.2f}%")
    print(f"  F1 (weighted)    : {cm_['f1_weighted']*100:.2f}%")
    print(f"  F1 (macro)       : {cm_['f1_macro']*100:.2f}%")
    print(f"  Precision (wt.)  : {cm_['precision_weighted']*100:.2f}%")
    print(f"  Recall (wt.)     : {cm_['recall_weighted']*100:.2f}%")
    if "roc_auc_weighted" in cm_:
        print(f"  ROC-AUC (wt.)    : {cm_['roc_auc_weighted']:.4f}")
    print(f"  Training time    : {ct_time:.1f} s")

    print(f"\n  Per-class report:")
    print(classification_report(yc_te, yc_pred, target_names=le_color.classes_, digits=4))
    print_confusion(yc_te, yc_pred, list(le_color.classes_), "Confusion Matrix — Color")

    results[clf_name] = {
        "style": sm, "color": cm_,
        "style_train_time": st_time, "color_train_time": ct_time,
    }

    if sm["accuracy"] > best_style_acc:
        best_style_acc   = sm["accuracy"]
        best_style_model = clf_style
        best_style_name  = clf_name

    # Use F1-macro for color selection: better than raw accuracy
    # when class sizes differ, as it treats each palette equally.
    if cm_["f1_macro"] > best_color_acc:
        best_color_acc   = cm_["f1_macro"]
        best_color_model = clf_color
        best_color_name  = clf_name


# ══════════════════════════════════════════════════════════════
# 5. 5-FOLD CROSS-VALIDATION on the best classifier
# ══════════════════════════════════════════════════════════════
banner(f"STEP 5 — 5-Fold Cross-Validation  ({best_style_name})")

import copy
cv_clf = copy.deepcopy(CLASSIFIERS[best_style_name])
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

print("\n  [STYLE — Cross-Validation]")
cv_style = cross_validate(
    cv_clf, X, y_style, cv=skf,
    scoring=["accuracy", "f1_weighted", "precision_weighted", "recall_weighted"],
    n_jobs=-1
)
for k in ["test_accuracy", "test_f1_weighted", "test_precision_weighted", "test_recall_weighted"]:
    v = cv_style[k]
    label = k.replace("test_", "").replace("_", " ").title()
    print(f"  {label:30s}: {v.mean()*100:.2f}% ± {v.std()*100:.2f}%  {np.round(v*100, 2)}")

print("\n  [COLOR — Cross-Validation]")
cv_clf2 = copy.deepcopy(CLASSIFIERS[best_color_name])
cv_color = cross_validate(
    cv_clf2, X, y_color, cv=skf,
    scoring=["accuracy", "f1_weighted", "precision_weighted", "recall_weighted"],
    n_jobs=-1
)
for k in ["test_accuracy", "test_f1_weighted", "test_precision_weighted", "test_recall_weighted"]:
    v = cv_color[k]
    label = k.replace("test_", "").replace("_", " ").title()
    print(f"  {label:30s}: {v.mean()*100:.2f}% ± {v.std()*100:.2f}%  {np.round(v*100, 2)}")


# ══════════════════════════════════════════════════════════════
# 6. FEATURE IMPORTANCE  (best models)
# ══════════════════════════════════════════════════════════════
banner("STEP 6 — Feature Importance")

def print_feature_importance(model, feat_names, title):
    if not hasattr(model, "feature_importances_"):
        print(f"  {title}: N/A for this classifier")
        return
    imp = model.feature_importances_
    order = np.argsort(imp)[::-1]
    print(f"\n  {title}")
    for rank, idx in enumerate(order, 1):
        bar = "#" * int(imp[idx] * 50)
        print(f"    {rank}. {feat_names[idx]:20s}: {imp[idx]*100:6.2f}%  {bar}")

print_feature_importance(best_style_model, FEATURES, "Style Model Feature Importance")
print_feature_importance(best_color_model, FEATURES, "Color Model Feature Importance")


# ══════════════════════════════════════════════════════════════
# 7. COMPARISON TABLE
# ══════════════════════════════════════════════════════════════
banner("STEP 7 — Model Comparison Summary")

print(f"\n  {'Classifier':<22}  {'Style Acc':>10}  {'Style F1':>10}  {'Color Acc':>10}  {'Color F1':>10}")
print(f"  {'-'*22}  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*10}")
for name, r in results.items():
    marker = " << BEST" if name == best_style_name else ""
    print(f"  {name:<22}  {r['style']['accuracy']*100:>9.2f}%  "
          f"{r['style']['f1_weighted']*100:>9.2f}%  "
          f"{r['color']['accuracy']*100:>9.2f}%  "
          f"{r['color']['f1_weighted']*100:>9.2f}%{marker}")


# ══════════════════════════════════════════════════════════════
# 8. SAVE BEST MODELS
# ══════════════════════════════════════════════════════════════
banner("STEP 8 — Save Best Models")

style_path = os.path.join(MODELS_DIR, "style_model.pkl")
color_path = os.path.join(MODELS_DIR, "color_model.pkl")

# Bundle each model with its class labels so recommender.py can decode predictions.
with open(style_path, "wb") as f:
    pickle.dump({"model": best_style_model, "classes": list(le_style.classes_)}, f)
with open(color_path, "wb") as f:
    pickle.dump({"model": best_color_model, "classes": list(le_color.classes_)}, f)

print(f"  Style model ({best_style_name}) -> {style_path}")
print(f"  Color model ({best_color_name}) -> {color_path}")


# ══════════════════════════════════════════════════════════════
# 9. SAVE JSON REPORT
# ══════════════════════════════════════════════════════════════
def _f(v):
    return round(float(v), 6) if isinstance(v, (float, np.floating)) else v

report = {
    "dataset": {
        "rows": int(len(df)),
        "train_rows": int(len(X_tr)),
        "test_rows": int(len(X_te)),
        "features": FEATURES,
        "style_classes": list(le_style.classes_),
        "color_classes": list(le_color.classes_),
    },
    "classifiers": {
        name: {
            "style":  {k: _f(v) for k, v in r["style"].items()},
            "color":  {k: _f(v) for k, v in r["color"].items()},
            "style_train_time_s": round(r["style_train_time"], 2),
            "color_train_time_s": round(r["color_train_time"], 2),
        }
        for name, r in results.items()
    },
    "cross_validation_5fold": {
        "classifier": best_style_name,
        "style": {
            k.replace("test_", ""): {
                "mean": _f(cv_style[k].mean()),
                "std":  _f(cv_style[k].std()),
                "folds": [_f(v) for v in cv_style[k]],
            }
            for k in cv_style if k.startswith("test_")
        },
        "color": {
            k.replace("test_", ""): {
                "mean": _f(cv_color[k].mean()),
                "std":  _f(cv_color[k].std()),
                "folds": [_f(v) for v in cv_color[k]],
            }
            for k in cv_color if k.startswith("test_")
        },
    },
    "best_models": {
        "style": {"classifier": best_style_name, **{k: _f(v) for k, v in results[best_style_name]["style"].items()}},
        "color": {"classifier": best_color_name, **{k: _f(v) for k, v in results[best_color_name]["color"].items()}},
    },
}

report_path = os.path.join(REPORT_DIR, "training_report.json")
with open(report_path, "w") as f:
    json.dump(report, f, indent=2)

print(f"  JSON report   -> {report_path}")


# ══════════════════════════════════════════════════════════════
# 10. FINAL SUMMARY
# ══════════════════════════════════════════════════════════════
banner("FINAL RESULTS")

bs = results[best_style_name]["style"]
bc = results[best_color_name]["color"]

cv_s_acc = cv_style["test_accuracy"]
cv_c_acc = cv_color["test_accuracy"]

sep = "  " + "=" * 57
print(sep)
print("  STYLE MODEL RESULTS")
print(sep)
print(f"  Best Classifier  : {best_style_name}")
print(f"  Test Accuracy    : {bs['accuracy']*100:>7.2f}%")
print(f"  F1 (weighted)    : {bs['f1_weighted']*100:>7.2f}%")
print(f"  F1 (macro)       : {bs['f1_macro']*100:>7.2f}%")
print(f"  Precision (wt.)  : {bs['precision_weighted']*100:>7.2f}%")
print(f"  Recall (wt.)     : {bs['recall_weighted']*100:>7.2f}%")
print(f"  5-Fold CV Acc    : {cv_s_acc.mean()*100:>7.2f}% +/- {cv_s_acc.std()*100:.2f}%")
print(sep)
print("  COLOR MODEL RESULTS")
print(sep)
print(f"  Best Classifier  : {best_color_name}")
print(f"  Test Accuracy    : {bc['accuracy']*100:>7.2f}%")
print(f"  F1 (weighted)    : {bc['f1_weighted']*100:>7.2f}%")
print(f"  F1 (macro)       : {bc['f1_macro']*100:>7.2f}%")
print(f"  Precision (wt.)  : {bc['precision_weighted']*100:>7.2f}%")
print(f"  Recall (wt.)     : {bc['recall_weighted']*100:>7.2f}%")
print(f"  5-Fold CV Acc    : {cv_c_acc.mean()*100:>7.2f}% +/- {cv_c_acc.std()*100:.2f}%")
print(sep)
print(f"  Report saved: {report_path}")
print(f"  Models saved: {MODELS_DIR}")
print(f"\n  Next: uvicorn main:app --reload\n")
