# =============================================================
# FILE: viton-hd/evaluate_metrics.py
# PURPOSE: Compute image quality metrics for the VITON-HD model
#
# Metrics computed:
#   - SSIM  (Structural Similarity Index)
#   - PSNR  (Peak Signal-to-Noise Ratio)
#   - LPIPS (Learned Perceptual Image Patch Similarity) — if installed
#   - FID   (Fréchet Inception Distance) — if pytorch_fid installed
#
# Evaluation strategy:
#   PAIRED test — run inference with each person's OWN cloth,
#   compare output to the original person image (reconstruction test).
#   This is the standard benchmark used in the VITON-HD paper.
#
# RUN:
#   cd viton-hd
#   python evaluate_metrics.py --num_samples 50
#   python evaluate_metrics.py --num_samples 200 --compute_fid
# =============================================================

import argparse, os, json, time, sys, warnings
warnings.filterwarnings("ignore")

import numpy as np
from pathlib import Path

# ── PIL / OpenCV ──────────────────────────────────────────────
from PIL import Image
import cv2

# ── scikit-image (SSIM, PSNR) ────────────────────────────────
try:
    from skimage.metrics import structural_similarity as _ssim
    from skimage.metrics import peak_signal_noise_ratio as _psnr
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False
    print("  [WARN] scikit-image not found. Install: pip install scikit-image")

# ── PyTorch (LPIPS, FID backbone) ────────────────────────────
try:
    import torch
    import torchvision.transforms as T
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    print("  [WARN] PyTorch not found — LPIPS / FID will be skipped.")

# ── LPIPS ─────────────────────────────────────────────────────
try:
    import lpips
    _lpips_fn = lpips.LPIPS(net="alex", verbose=False)
    HAS_LPIPS = True
except Exception:
    HAS_LPIPS = False

# ── FID ───────────────────────────────────────────────────────
try:
    from pytorch_fid.fid_score import calculate_fid_given_paths
    HAS_FID = True
except ImportError:
    HAS_FID = False


BANNER = "=" * 65

def banner(t):
    print(f"\n{BANNER}\n  {t}\n{BANNER}")


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

def load_img_np(path, size=(768, 1024)):
    """Load image as uint8 numpy array (H, W, 3) resized to (W, H)."""
    img = Image.open(path).convert("RGB")
    img = img.resize(size, Image.LANCZOS)
    return np.array(img)


def compute_ssim(img_a, img_b):
    if not HAS_SKIMAGE:
        return None
    return float(_ssim(img_a, img_b, channel_axis=2, data_range=255))


def compute_psnr(img_a, img_b):
    if not HAS_SKIMAGE:
        return None
    return float(_psnr(img_a, img_b, data_range=255))


def compute_lpips(img_a_np, img_b_np):
    if not HAS_LPIPS or not HAS_TORCH:
        return None
    to_t = T.Compose([T.ToTensor(), T.Normalize(0.5, 0.5)])
    a = to_t(Image.fromarray(img_a_np)).unsqueeze(0)
    b = to_t(Image.fromarray(img_b_np)).unsqueeze(0)
    with torch.no_grad():
        d = _lpips_fn(a, b)
    return float(d.item())


def run_viton_inference(pairs_filename, save_dir, args):
    """Run test.py. pairs_filename is just the bare filename inside dataset_dir."""
    cmd = (
        f'python test.py --name eval_run '
        f'--dataset_dir "{args.dataset_dir}" '
        f'--dataset_list "{pairs_filename}" '
        f'--checkpoint_dir "{args.checkpoint_dir}" '
        f'--save_dir "{save_dir}" '
        f'--batch_size 1 --workers 1'
    )
    print(f"\n  Running: {cmd}\n")
    ret = os.system(cmd)
    return ret == 0


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="VITON-HD Image Quality Evaluation")
    parser.add_argument("--dataset_dir",    default="./datasets/",    help="Root dataset folder")
    parser.add_argument("--checkpoint_dir", default="./checkpoints/", help="Checkpoint folder")
    parser.add_argument("--save_dir",       default="./results/",     help="Inference output folder")
    parser.add_argument("--eval_dir",       default="./evaluation_results/", help="Where to save metrics report")
    parser.add_argument("--num_samples",    type=int, default=50,
                        help="How many test pairs to evaluate (default 50; use 0 for all)")
    parser.add_argument("--compute_fid",    action="store_true", help="Compute FID score (slow)")
    parser.add_argument("--skip_inference", action="store_true",
                        help="Skip VITON inference (use existing results in --save_dir)")
    args = parser.parse_args()

    os.makedirs(args.eval_dir, exist_ok=True)

    # ── Locate test images ────────────────────────────────────
    test_img_dir   = os.path.join(args.dataset_dir, "test", "image")
    test_cloth_dir = os.path.join(args.dataset_dir, "test", "cloth")

    if not os.path.isdir(test_img_dir):
        print(f"  ERROR: dataset test/image not found at {test_img_dir}")
        sys.exit(1)

    # ── Build PAIRED list (person + their own cloth) ──────────
    # In VITON-HD the person filename == the cloth filename for paired eval.
    # e.g. "05006_00.jpg" wears cloth "05006_00.jpg" originally.
    all_persons = sorted([
        f for f in os.listdir(test_img_dir)
        if f.endswith(".jpg") or f.endswith(".png")
    ])
    paired = [(f, f) for f in all_persons if os.path.exists(os.path.join(test_cloth_dir, f))]

    if len(paired) == 0:
        print("  ERROR: No paired samples found (person + same cloth ID).")
        print("  Make sure your test/image/ and test/cloth/ directories share matching filenames.")
        sys.exit(1)

    N = len(paired) if args.num_samples == 0 else min(args.num_samples, len(paired))
    paired = paired[:N]

    banner(f"PAIRED EVALUATION  ({N} samples)")
    print(f"  Dataset dir  : {args.dataset_dir}")
    print(f"  Checkpoint   : {args.checkpoint_dir}")
    print(f"  Paired total : {len(all_persons)} available, using {N}")

    # ── Write temporary pairs file into dataset_dir ──────────
    # test.py opens:  open(join(dataset_dir, dataset_list))
    # so the file must live inside dataset_dir; we only pass the bare filename.
    pairs_filename = "eval_pairs.txt"
    pairs_file     = os.path.join(args.dataset_dir, pairs_filename)
    os.makedirs(args.dataset_dir, exist_ok=True)
    with open(pairs_file, "w") as f:
        for person, cloth in paired:
            f.write(f"{person} {cloth}\n")
    print(f"  Pairs file   : {pairs_file}")

    # ── Run VITON inference ───────────────────────────────────
    gen_dir = os.path.join(args.save_dir, "eval_run")
    if not args.skip_inference:
        banner("Running VITON-HD Inference")
        print("  This may take several minutes on CPU.")
        t_inf = time.time()
        success = run_viton_inference(pairs_filename, args.save_dir, args)
        if not success:
            print("  WARNING: test.py returned non-zero exit code.")
        print(f"  Inference done in {time.time() - t_inf:.1f} s")
    else:
        print(f"\n  Skipping inference, using existing results in: {gen_dir}")

    if not os.path.isdir(gen_dir):
        print(f"  ERROR: Generated results not found at {gen_dir}")
        print("  Run without --skip_inference to generate them first.")
        sys.exit(1)

    # ── Collect generated images ──────────────────────────────
    gen_files = sorted([f for f in os.listdir(gen_dir) if f.endswith(".jpg") or f.endswith(".png")])
    if len(gen_files) == 0:
        print(f"  ERROR: No generated images found in {gen_dir}")
        sys.exit(1)

    banner(f"Computing Metrics  ({len(gen_files)} generated images)")

    ssim_scores  = []
    psnr_scores  = []
    lpips_scores = []
    per_image    = []
    skipped      = 0

    for idx, gen_fname in enumerate(gen_files):
        # Generated filename format from test.py: {person_id}_{cloth_name}
        # Ground truth is the original person image
        person_id = gen_fname.split("_")[0]
        person_fname = f"{person_id}_00.jpg"
        gt_path  = os.path.join(test_img_dir, person_fname)
        gen_path = os.path.join(gen_dir, gen_fname)

        if not os.path.exists(gt_path):
            skipped += 1
            continue

        gen_np = load_img_np(gen_path, size=(768, 1024))
        gt_np  = load_img_np(gt_path,  size=(768, 1024))

        ssim_val  = compute_ssim(gen_np, gt_np)
        psnr_val  = compute_psnr(gen_np, gt_np)
        lpips_val = compute_lpips(gen_np, gt_np)

        if ssim_val  is not None: ssim_scores.append(ssim_val)
        if psnr_val  is not None: psnr_scores.append(psnr_val)
        if lpips_val is not None: lpips_scores.append(lpips_val)

        per_image.append({
            "generated": gen_fname,
            "ground_truth": person_fname,
            "ssim":  round(ssim_val, 6)  if ssim_val  is not None else None,
            "psnr":  round(psnr_val, 4)  if psnr_val  is not None else None,
            "lpips": round(lpips_val, 6) if lpips_val is not None else None,
        })

        done = idx + 1
        if done % 10 == 0 or done == len(gen_files):
            ssim_s = f"SSIM={np.mean(ssim_scores):.4f}" if ssim_scores else ""
            psnr_s = f"PSNR={np.mean(psnr_scores):.2f}" if psnr_scores else ""
            print(f"  [{done:4d}/{len(gen_files)}]  {ssim_s}  {psnr_s}")

    print(f"\n  Skipped (no GT match): {skipped}")

    # ── FID Score ─────────────────────────────────────────────
    fid_score = None
    if args.compute_fid:
        banner("Computing FID Score")
        if not HAS_FID:
            print("  pytorch_fid not installed. Run: pip install pytorch-fid")
        else:
            try:
                fid_score = calculate_fid_given_paths(
                    [test_img_dir, gen_dir],
                    batch_size=16,
                    device="cpu",
                    dims=2048
                )
                print(f"  FID Score: {fid_score:.4f}")
            except Exception as e:
                print(f"  FID failed: {e}")

    # ── Summary ───────────────────────────────────────────────
    banner("EVALUATION RESULTS")

    def stat(arr):
        if not arr:
            return {"mean": None, "std": None, "min": None, "max": None}
        return {
            "mean": round(float(np.mean(arr)), 6),
            "std":  round(float(np.std(arr)),  6),
            "min":  round(float(np.min(arr)),  6),
            "max":  round(float(np.max(arr)),  6),
        }

    ssim_stat  = stat(ssim_scores)
    psnr_stat  = stat(psnr_scores)
    lpips_stat = stat(lpips_scores)

    print(f"""
  Samples evaluated  : {len(per_image)}
  ┌────────────────────────────────────────────────────┐
  │  METRIC    │     MEAN  │    STD   │   MIN  │  MAX  │
  ├────────────────────────────────────────────────────┤""")

    def row(name, s):
        if s["mean"] is None:
            print(f"  │  {name:<10}│  Not available (install scikit-image)         │")
        else:
            print(f"  │  {name:<10}│  {s['mean']:>7.4f}  │  {s['std']:>6.4f}  │  {s['min']:>5.3f} │{s['max']:>5.3f} │")

    row("SSIM ↑",    ssim_stat)
    row("PSNR ↑",    psnr_stat)
    row("LPIPS ↓",   lpips_stat)
    print(f"  └────────────────────────────────────────────────────┘")

    if fid_score is not None:
        print(f"  FID ↓       :  {fid_score:.4f}  (lower = better)")

    print(f"""
  METRIC INTERPRETATION:
    SSIM  (0-1) : 1.0 = perfect reconstruction. >0.80 = very good.
    PSNR (dB)   : Higher is better. >25 dB = good quality.
    LPIPS (0-1) : 0.0 = identical. <0.20 = perceptually similar.
    FID         : 0 = identical distributions. <50 = good quality.
""")

    # ── Save report ───────────────────────────────────────────
    report = {
        "evaluation": {
            "samples_evaluated": len(per_image),
            "skipped": skipped,
            "eval_mode": "paired (person with own cloth — reconstruction test)",
        },
        "metrics_summary": {
            "SSIM":  ssim_stat,
            "PSNR":  psnr_stat,
            "LPIPS": lpips_stat,
            "FID":   fid_score,
        },
        "packages": {
            "scikit_image": HAS_SKIMAGE,
            "lpips":        HAS_LPIPS,
            "pytorch_fid":  HAS_FID,
        },
        "per_image_metrics": per_image,
    }

    json_path = os.path.join(args.eval_dir, "viton_metrics_report.json")
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2)

    txt_path = os.path.join(args.eval_dir, "viton_metrics_report.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("VITON-HD EVALUATION METRICS\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Samples evaluated : {len(per_image)}\n\n")
        for metric, s in [("SSIM (higher=better)", ssim_stat), ("PSNR (higher=better)", psnr_stat), ("LPIPS (lower=better)", lpips_stat)]:
            if s["mean"] is not None:
                f.write(f"{metric:<24}: mean={s['mean']:.6f}  std={s['std']:.6f}  "
                        f"min={s['min']:.6f}  max={s['max']:.6f}\n")
        if fid_score is not None:
            f.write(f"FID (lower=better)      : {fid_score:.4f}\n")
        f.write("\nPer-image results:\n")
        f.write(f"{'Generated':<40}  {'SSIM':>8}  {'PSNR':>8}  {'LPIPS':>8}\n")
        f.write("-" * 70 + "\n")
        for r in per_image:
            s = f"{r['ssim']:.4f}" if r['ssim'] is not None else "  N/A  "
            p = f"{r['psnr']:.2f}"  if r['psnr'] is not None else "  N/A  "
            l = f"{r['lpips']:.4f}" if r['lpips'] is not None else "  N/A  "
            f.write(f"{r['generated']:<40}  {s:>8}  {p:>8}  {l:>8}\n")

    print(f"  JSON report → {json_path}")
    print(f"  TXT report  → {txt_path}\n")


if __name__ == "__main__":
    main()
