@echo off
REM ================================================================
REM  run_training_and_eval.bat
REM  Trains recommendation models and evaluates VITON-HD quality.
REM  Run from the VITON-UNIFIED root folder.
REM ================================================================

echo.
echo ================================================================
echo   VITON-UNIFIED  --  Full Training and Evaluation Pipeline
echo ================================================================
echo.

REM ── 1. Install extra metrics packages ──────────────────────────
echo [1/4] Installing metrics packages...
pip install scikit-image scikit-learn --quiet
echo       Done.
echo.

REM ── 2. Generate recommendation dataset (if not present) ────────
echo [2/4] Checking recommendation dataset...
if not exist "backend\recommendation\clothing_data.csv" (
    echo       Generating 100,000-row synthetic dataset...
    cd backend
    python recommendation/generate_dataset.py
    cd ..
) else (
    echo       clothing_data.csv already exists, skipping generation.
)
echo.

REM ── 3. Train recommendation models ─────────────────────────────
echo [3/4] Training recommendation models (RF, ExtraTrees, GBM)...
echo       This compares 3 classifiers + 5-fold cross-validation.
echo       Estimated time: 3-8 minutes depending on CPU.
echo.
cd backend
python recommendation/train_model.py
cd ..
echo.

REM ── 4. Evaluate VITON-HD model ──────────────────────────────────
echo [4/4] Evaluating VITON-HD model on 50 test pairs...
echo       Estimated time: 30-90 minutes on CPU.
echo       (Use --num_samples 10 for a quick 5-minute test)
echo.
cd viton-hd
python evaluate_metrics.py --num_samples 50
cd ..

echo.
echo ================================================================
echo   Pipeline complete!
echo   Results saved to:
echo     backend\models\training_report.json
echo     viton-hd\evaluation_results\viton_metrics_report.json
echo     viton-hd\evaluation_results\viton_metrics_report.txt
echo ================================================================
echo.
pause
