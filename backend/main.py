from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import database as db
from pydantic import BaseModel as PydanticBaseModel
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from io import BytesIO
import shutil
import os
import subprocess
import uuid
import sys
import json
import numpy as np
import cv2

app = FastAPI(title="VITON-HD Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== STATIC FILES ====================
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
(STATIC_DIR / "products").mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ==================== PATH CONFIGURATION ====================
BASE_DIR = Path(__file__).resolve().parent.parent
VITON_ROOT = BASE_DIR / "viton-hd"
DATASET_DIR = VITON_ROOT / "datasets"
DATASET_TEST_DIR = DATASET_DIR / "test"
RESULT_DIR = VITON_ROOT / "results"
PYTHON_EXE = sys.executable

print("\n" + "="*60)
print("VITON-HD Backend Starting")
print("="*60)

if not VITON_ROOT.exists():
    raise RuntimeError(f"[ERROR] VITON_ROOT not found: {VITON_ROOT}")
if not (VITON_ROOT / "test.py").exists():
    raise RuntimeError(f"[ERROR] test.py not found in {VITON_ROOT}")

RESULT_DIR.mkdir(parents=True, exist_ok=True)
for subdir in ["image", "cloth", "cloth-mask", "openpose-json", "openpose-img", 
               "image-parse", "image-parse-v3", "image-parse-agnostic-v3.2", "agnostic-v3.2"]:
    (DATASET_TEST_DIR / subdir).mkdir(parents=True, exist_ok=True)

def get_preprocessed_persons():
    person_dir = DATASET_TEST_DIR / "image"
    openpose_dir = DATASET_TEST_DIR / "openpose-img"
    parse_dir_v3 = DATASET_TEST_DIR / "image-parse-v3"
    parse_dir = DATASET_TEST_DIR / "image-parse"
    
    if not person_dir.exists() or not openpose_dir.exists(): return []
    
    openpose_files = set()
    for f in openpose_dir.glob("*_rendered.png"):
        openpose_files.add(f.stem.replace('_rendered', '') + '.jpg')
    
    if parse_dir_v3.exists():
        parse_files = {f.stem + '.jpg' for f in parse_dir_v3.glob("*.png")}
        openpose_files = openpose_files & parse_files
    elif parse_dir.exists():
        parse_files = {f.stem + '.jpg' for f in parse_dir.glob("*.png")}
        openpose_files = openpose_files & parse_files
    
    return [f for f in sorted(openpose_files) if (person_dir / f).exists()]

# ==================== PREPROCESSING FUNCTIONS ====================

async def run_lightweight_pose(image_path: Path, output_json_dir: Path, output_img_dir: Path) -> bool:
    try:
        import mediapipe as mp
        mp_pose = mp.solutions.pose
        mp_drawing = mp.solutions.drawing_utils
        
        image = cv2.imread(str(image_path))
        if image is None: return False
            
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image.shape[:2]
        
        with mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
            results = pose.process(image_rgb)
            if not results.pose_landmarks: return False
            
            keypoints = []
            landmark_list = results.pose_landmarks.landmark
            
            mp_to_openpose = [0, -1, 12, 14, 16, 11, 13, 15, 24, 26, 28, 23, 25, 27, 5, 2, 8, 7]
            
            for idx in mp_to_openpose:
                if idx == -1:
                    keypoints.extend([0.0, 0.0, 0.0])
                else:
                    lm = landmark_list[idx]
                    conf = 1.0 if lm.visibility > 0.5 else 0.0
                    # Zero out low-confidence points so VITON-HD skips them safely
                    if conf > 0:
                        keypoints.extend([float(lm.x * w), float(lm.y * h), conf])
                    else:
                        keypoints.extend([0.0, 0.0, 0.0])
            
            right_shoulder = landmark_list[12]
            left_shoulder = landmark_list[11]
            nose = landmark_list[0]
            # Neck = 30% of the way from shoulder midpoint up toward nose
            sh_x = (right_shoulder.x + left_shoulder.x) / 2 * w
            sh_y = (right_shoulder.y + left_shoulder.y) / 2 * h
            nose_y = nose.y * h
            neck_x = sh_x
            neck_y = sh_y + (nose_y - sh_y) * 0.3  # 30% toward nose from shoulders
            neck_conf = 1.0 if (right_shoulder.visibility > 0.5 and left_shoulder.visibility > 0.5) else 0.0
            keypoints[3:6] = [neck_x, neck_y, neck_conf]
            
            while len(keypoints) < 54: keypoints.extend([0.0, 0.0, 0.0])
            keypoints = keypoints[:54] 
            
            json_data = {
                "version": 1.3,
                "people": [{"pose_keypoints_2d": keypoints, "face_keypoints_2d": [], "hand_left_keypoints_2d": [], "hand_right_keypoints_2d": []}]
            }
            
            with open(output_json_dir / f"{image_path.stem}_keypoints.json", 'w') as f:
                json.dump(json_data, f)
            
            # Render OpenPose-style on BLACK background (VITON-HD was trained with black-background pose images)
            pose_canvas = np.zeros_like(image)
            # OpenPose color scheme per body part (BGR): head=pink, torso=red/orange, limbs=colored
            POSE_COLORS = [
                (255,0,85),(255,0,0),(255,85,0),(255,170,0),(255,255,0),(170,255,0),
                (85,255,0),(0,255,0),(0,255,85),(0,255,170),(0,255,255),(0,170,255),
                (0,85,255),(0,0,255),(85,0,255),(170,0,255),(255,0,255),(255,0,170)
            ]
            POSE_PAIRS = [(0,1),(1,2),(2,3),(3,4),(1,5),(5,6),(6,7),(1,8),(8,9),(9,10),
                          (1,11),(11,12),(12,13),(0,14),(14,16),(0,15),(15,17)]
            kp_xy = [(int(keypoints[i*3]), int(keypoints[i*3+1])) for i in range(18)]
            kp_conf = [keypoints[i*3+2] for i in range(18)]
            for pi, (a, b) in enumerate(POSE_PAIRS):
                if kp_conf[a] > 0 and kp_conf[b] > 0:
                    cv2.line(pose_canvas, kp_xy[a], kp_xy[b], POSE_COLORS[pi % len(POSE_COLORS)], 3)
            for i, (x, y) in enumerate(kp_xy):
                if kp_conf[i] > 0:
                    cv2.circle(pose_canvas, (x, y), 4, POSE_COLORS[i % len(POSE_COLORS)], -1)
            cv2.imwrite(str(output_img_dir / f"{image_path.stem}_rendered.png"), pose_canvas)
            return True
    except Exception as e:
        print(f"Pose error: {e}")
        return False

async def run_human_parsing(image_path: Path, output_path: Path) -> bool:
    try:
        from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation
        import torch
        import numpy as np
        
        processor = AutoImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
        model = AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes")
        
        image = Image.open(image_path).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
        
        upsampled_logits = torch.nn.functional.interpolate(
            logits, size=image.size[::-1], mode="bilinear", align_corners=False
        )
        pred = upsampled_logits.argmax(dim=1)[0].cpu().numpy()
        
        lip_map = np.zeros_like(pred, dtype=np.uint8)
        lip_map[pred == 1] = 1   # Hat
        lip_map[pred == 2] = 2   # Hair
        lip_map[pred == 3] = 4   # Sunglasses
        lip_map[pred == 4] = 5   # Upper-clothes
        lip_map[pred == 5] = 12  # Skirt
        lip_map[pred == 6] = 9   # Pants
        lip_map[pred == 7] = 6   # Dress
        lip_map[pred == 9] = 18  # Left-shoe
        lip_map[pred == 10] = 19 # Right-shoe
        lip_map[pred == 11] = 13 # Face
        lip_map[pred == 12] = 16 # Left-leg
        lip_map[pred == 13] = 17 # Right-leg
        lip_map[pred == 14] = 14 # Left-arm
        lip_map[pred == 15] = 15 # Right-arm
        
        # CRITICAL FIX 1: Lock the palette so Python never saves this as a corrupted black square
        palette = []
        for i in range(256): palette.extend((i, i, i))
        parse_img = Image.fromarray(lip_map, mode='P')
        parse_img.putpalette(palette)
        
        parse_img.save(output_path)
        
        parse_path_v3 = DATASET_TEST_DIR / "image-parse-v3" / output_path.name
        parse_path_v3.parent.mkdir(parents=True, exist_ok=True)
        parse_img.save(parse_path_v3)
        return True
    except Exception as e:
        print(f"Parsing error: {e}")
        return False

def generate_parse_agnostic(parse_img: Image.Image, pose_data: np.ndarray, w: int = 768, h: int = 1024) -> Image.Image:
    label_array = np.array(parse_img)
    agnostic_array = label_array.copy()

    # Erase upper-clothes AND arms so seg generator predicts full shirt region
    mask = ((label_array == 5) | (label_array == 6) | (label_array == 7) |
            (label_array == 14) | (label_array == 15))
    mask_uint8 = mask.astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    mask_dilated = cv2.dilate(mask_uint8, kernel, iterations=1)

    agnostic_array[mask_dilated > 0] = 0
    return Image.fromarray(agnostic_array.astype(np.uint8), mode='L')

def generate_image_agnostic(img: Image.Image, parse: Image.Image, pose_data: np.ndarray) -> Image.Image:
    img_array   = np.array(img)
    parse_array = np.array(parse)
    agnostic_array = img_array.copy()

    # Erase upper-clothes (5,6,7) + arms (14,15) — gray matches VITON-HD training distribution
    cloth_mask = ((parse_array == 5) | (parse_array == 6) | (parse_array == 7) |
                  (parse_array == 14) | (parse_array == 15))
    cloth_uint8 = cloth_mask.astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    cloth_dilated = cv2.dilate(cloth_uint8, kernel, iterations=1)
    agnostic_array[cloth_dilated > 0] = [90, 90, 90]

    # Restore face, hair, lower body, and background
    restore_mask = ((parse_array == 13) | (parse_array == 4) |   # face/glasses
                    (parse_array == 1)  | (parse_array == 2) |   # hair (restores strands on shoulders)
                    (parse_array == 9)  | (parse_array == 12) |  # pants/skirt
                    (parse_array == 16) | (parse_array == 17) |  # legs
                    (parse_array == 18) | (parse_array == 19) |  # shoes
                    (parse_array == 0)).astype(np.uint8) * 255   # background
    agnostic_array[restore_mask > 0] = img_array[restore_mask > 0]

    return Image.fromarray(agnostic_array)


def _postprocess_result(result_path: Path, person_name: str):
    """Correct washed-out garment color, restore neck skin, and smooth jagged edges."""
    try:
        result = np.array(Image.open(result_path).convert('RGB'), dtype=np.float32)
        h, w = result.shape[:2]

        cloth_path  = DATASET_TEST_DIR / "cloth" / "custom_cloth.jpg"
        parse_path  = DATASET_TEST_DIR / "image-parse" / person_name.replace('.jpg', '.png')
        person_path = DATASET_TEST_DIR / "image" / person_name

        if not all(p.exists() for p in [cloth_path, parse_path, person_path]):
            return

        cloth  = np.array(Image.open(cloth_path).convert('RGB').resize((w, h), Image.LANCZOS), dtype=np.float32)
        parse  = np.array(Image.open(parse_path).convert('L').resize((w, h), Image.NEAREST))
        person = np.array(Image.open(person_path).convert('RGB').resize((w, h), Image.LANCZOS), dtype=np.float32)

        # ── 1. Color-correct washed-out garment region ────────────────────
        cloth_region = (parse == 5) | (parse == 6) | (parse == 7)
        if cloth_region.sum() > 1000:
            cloth_nw = (cloth[:,:,0] < 240) | (cloth[:,:,1] < 240) | (cloth[:,:,2] < 240)
            if cloth_nw.any():
                cloth_target  = cloth[cloth_nw].mean(axis=0)          # target [R,G,B]
                result_mean   = result[cloth_region].mean(axis=0)      # current [R,G,B]
                if result_mean.mean() > cloth_target.mean() + 10:
                    scale = np.clip(cloth_target / np.maximum(result_mean, 1.0), 0.45, 1.0)
                    region_u8 = cloth_region.astype(np.uint8) * 255
                    soft_mask = cv2.GaussianBlur(
                        cv2.dilate(region_u8, np.ones((25, 25), np.uint8)).astype(np.float32) / 255.0,
                        (25, 25), 0
                    )[:, :, np.newaxis]
                    corrected = np.clip(np.stack([
                        result[:,:,0] * scale[0],
                        result[:,:,1] * scale[1],
                        result[:,:,2] * scale[2],
                    ], axis=2), 0, 255)
                    result = result * (1 - soft_mask) + corrected * soft_mask

        # ── 2. Restore neck skin to remove dark collar artifact ───────────
        neck_region = (parse == 10)
        if neck_region.sum() > 50:
            neck_mask = cv2.GaussianBlur(
                neck_region.astype(np.uint8) * 255, (15, 15), 0
            ).astype(np.float32) / 255.0
            result = result * (1 - neck_mask[:,:,np.newaxis]) + person * neck_mask[:,:,np.newaxis]

        # ── 3. Smooth jagged cloth boundary edges ─────────────────────────
        if cloth_region.sum() > 1000:
            region_u8 = cloth_region.astype(np.uint8) * 255
            k = np.ones((5, 5), np.uint8)
            boundary = (cv2.dilate(region_u8, k).astype(np.float32) -
                        cv2.erode(region_u8, k).astype(np.float32))
            edge_soft = cv2.GaussianBlur(
                np.clip(boundary / 255.0, 0, 1), (9, 9), 0
            )[:, :, np.newaxis]
            blurred = cv2.GaussianBlur(result.astype(np.uint8), (5, 5), 0).astype(np.float32)
            result = result * (1 - edge_soft * 0.65) + blurred * (edge_soft * 0.65)

        Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).save(result_path, quality=95)
        print("[OK] Post-processing applied: color corrected, neck restored, edges smoothed")
    except Exception as e:
        print(f"Post-process error: {e}")


# ==================== ENDPOINTS ====================
@app.get("/")
async def root(): return {"status": "VITON-HD backend running"}

@app.get("/persons")
async def list_persons():
    try:
        preprocessed = get_preprocessed_persons()
        persons = [{"filename": f, "url": f"/person-image/{f}"} for f in preprocessed[:50]]
        return {"persons": persons, "total": len(preprocessed), "displayed": len(persons)}
    except Exception as e:
        return {"persons": [], "total": 0, "error": str(e)}

@app.get("/person-image/{name}")
async def get_person_image(name: str):
    path = DATASET_TEST_DIR / "image" / name
    if not path.exists(): raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})

@app.post("/upload/person")
async def upload_person_image(file: UploadFile = File(...)):
    try:
        person_id = str(uuid.uuid4())[:8] + "_person"
        contents = await file.read()
        raw = Image.open(BytesIO(contents))
        # Composite transparent PNG on white before converting to RGB
        if raw.mode in ('RGBA', 'LA', 'P'):
            if raw.mode == 'P':
                raw = raw.convert('RGBA')
            background = Image.new('RGB', raw.size, (255, 255, 255))
            mask = raw.split()[-1] if raw.mode in ('RGBA', 'LA') else None
            background.paste(raw, mask=mask)
            image = background
        else:
            image = raw.convert('RGB')

        # Aspect-ratio-preserving resize + white padding (top-aligned, small margin)
        target_w, target_h = 768, 1024
        iw, ih = image.size
        scale = min(target_w / iw, target_h / ih)
        new_w, new_h = int(iw * scale), int(ih * scale)
        image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (target_w, target_h), (255, 255, 255))
        paste_x = (target_w - new_w) // 2
        paste_y = 20  # small top margin — keeps head near top for pose detection
        canvas.paste(image, (paste_x, paste_y))
        image = canvas
        
        image_file = DATASET_TEST_DIR / "image" / f"{person_id}.jpg"
        image.save(image_file, quality=95)
        
        openpose_json_dir = DATASET_TEST_DIR / "openpose-json"
        openpose_img_dir = DATASET_TEST_DIR / "openpose-img"
        await run_lightweight_pose(image_file, openpose_json_dir, openpose_img_dir)
        
        parse_path = DATASET_TEST_DIR / "image-parse" / f"{person_id}.png"
        await run_human_parsing(image_file, parse_path)
        
        with open(openpose_json_dir / f"{person_id}_keypoints.json", 'r') as f:
            pose_data = np.array(json.load(f)['people'][0]['pose_keypoints_2d']).reshape(-1, 3)[:, :2]
            
        parse_img = Image.open(parse_path).convert('L')

        # Add neck label (10) between face and shirt — SegFormer doesn't output this
        # Without it, the seg generator places cloth over the neck skin causing dark collar artifacts
        parse_arr = np.array(parse_img)
        neck_x, neck_y = int(pose_data[1, 0]), int(pose_data[1, 1])
        if neck_x > 0 and neck_y > 0:
            face_rows = np.where((parse_arr == 13).any(axis=1))[0]
            shirt_rows = np.where((parse_arr == 5).any(axis=1))[0]
            if len(face_rows) and len(shirt_rows):
                face_bottom = int(face_rows[-1])
                shirt_top = int(shirt_rows[0])
                if shirt_top > face_bottom:
                    # Fill neck region between face-bottom and shirt-top
                    cv2.ellipse(parse_arr, (neck_x, (face_bottom + shirt_top) // 2),
                                (35, (shirt_top - face_bottom) // 2 + 5), 0, 0, 360, 10, -1)
        parse_img = Image.fromarray(parse_arr, mode='L')
        parse_img.save(parse_path)
        parse_v3_path = DATASET_TEST_DIR / "image-parse-v3" / f"{person_id}.png"
        parse_img.save(parse_v3_path)

        parse_agnostic = generate_parse_agnostic(parse_img, pose_data, 768, 1024)
        parse_agnostic.save(DATASET_TEST_DIR / "image-parse-agnostic-v3.2" / f"{person_id}.png")
        
        image_agnostic = generate_image_agnostic(image, parse_img, pose_data)
        image_agnostic.save(DATASET_TEST_DIR / "agnostic-v3.2" / f"{person_id}.jpg", quality=95)
        
        return {"status": "success", "person_id": person_id, "filename": f"{person_id}.jpg", "preview_url": f"/person-image/{person_id}.jpg"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload/cloth-from-static")
async def upload_cloth_from_static(image_url: str = Query(...)):
    """Set cloth directly from an existing static product URL — avoids cross-origin download on the frontend."""
    prefix = "http://localhost:8000"
    rel = image_url[len(prefix):] if image_url.startswith(prefix) else image_url
    rel = rel.lstrip("/")
    file_path = Path(__file__).resolve().parent / rel
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Product image not found: {rel}")

    cloth_path = DATASET_TEST_DIR / "cloth" / "custom_cloth.jpg"
    raw = Image.open(str(file_path))
    if raw.mode in ('RGBA', 'LA', 'P'):
        if raw.mode == 'P':
            raw = raw.convert('RGBA')
        background = Image.new('RGB', raw.size, (255, 255, 255))
        mask = raw.split()[-1] if raw.mode in ('RGBA', 'LA') else None
        background.paste(raw, mask=mask)
        img = background
    else:
        img = raw.convert('RGB')
    img = ImageOps.pad(img, (768, 1024), color=(255, 255, 255))
    img_arr = np.array(img, dtype=np.float32)
    non_white = (img_arr[:,:,0] < 248) | (img_arr[:,:,1] < 248) | (img_arr[:,:,2] < 248)
    if non_white.any():
        garment_pixels = img_arr[non_white]
        min_val = garment_pixels.min()
        max_val = garment_pixels.max()
        if max_val - min_val < 100:
            orig_range = max(float(max_val - min_val), 10.0)
            target_range = min(orig_range * 3.0, 160.0)
            img_arr[non_white] = np.clip(
                (garment_pixels - min_val) / orig_range * target_range + max(float(min_val) - 50, 0),
                0, 255
            )
            img = Image.fromarray(img_arr.astype(np.uint8))
    img.save(cloth_path, quality=95)
    await generate_cloth_mask()
    return {"status": "cloth image set from static"}

@app.post("/upload/cloth")
async def upload_cloth(file: UploadFile = File(...)):
    cloth_path = DATASET_TEST_DIR / "cloth" / "custom_cloth.jpg"
    contents = await file.read()
    raw = Image.open(BytesIO(contents))
    if raw.mode in ('RGBA', 'LA', 'P'):
        if raw.mode == 'P':
            raw = raw.convert('RGBA')
        background = Image.new('RGB', raw.size, (255, 255, 255))
        mask = raw.split()[-1] if raw.mode in ('RGBA', 'LA') else None
        background.paste(raw, mask=mask)
        img = background
    else:
        img = raw.convert('RGB')
    img = ImageOps.pad(img, (768, 1024), color=(255, 255, 255))
    # Boost contrast for very light garments so VITON-HD renders them visibly
    img_arr = np.array(img, dtype=np.float32)
    non_white = (img_arr[:,:,0] < 248) | (img_arr[:,:,1] < 248) | (img_arr[:,:,2] < 248)
    if non_white.any():
        garment_pixels = img_arr[non_white]
        min_val = garment_pixels.min()
        max_val = garment_pixels.max()
        if max_val - min_val < 100:  # low-contrast garment (light gray, pastels, etc.)
            # Aggressively stretch contrast so VITON-HD can distinguish the garment
            orig_range = max(float(max_val - min_val), 10.0)
            target_range = min(orig_range * 3.0, 160.0)
            img_arr[non_white] = np.clip(
                (garment_pixels - min_val) / orig_range * target_range + max(float(min_val) - 50, 0),
                0, 255
            )
            img = Image.fromarray(img_arr.astype(np.uint8))
    img.save(cloth_path, quality=95)
    # Auto-generate mask immediately so debug endpoint shows current mask
    await generate_cloth_mask()
    return {"status": "cloth image uploaded"}

@app.post("/preprocess/cloth-mask")
async def generate_cloth_mask():
    cloth_path = DATASET_TEST_DIR / "cloth" / "custom_cloth.jpg"
    mask_path = DATASET_TEST_DIR / "cloth-mask" / "custom_cloth.jpg"
    if not cloth_path.exists(): raise HTTPException(status_code=400)
        
    try:
        img_cv = cv2.imread(str(cloth_path))
        h, w = img_cv.shape[:2]
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))

        # GrabCut — works for ANY garment color including gray-on-gray.
        # Initialize the mask using JPEG-robust near-white detection (>= 248 in all channels).
        mask_gc = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)

        # Near-white pixels (JPEG-compressed padding) → definite background
        near_white = (img_cv[:, :, 0] >= 248) & \
                     (img_cv[:, :, 1] >= 248) & \
                     (img_cv[:, :, 2] >= 248)
        mask_gc[near_white] = cv2.GC_BGD

        # Find the photo region (non-near-white area)
        not_nw = ~near_white
        if not_nw.any():
            rows_nw = not_nw.any(axis=1)
            cols_nw = not_nw.any(axis=0)
            r1 = int(np.where(rows_nw)[0][0])
            r2 = int(np.where(rows_nw)[0][-1])
            c1 = int(np.where(cols_nw)[0][0])
            c2 = int(np.where(cols_nw)[0][-1])

            # Outer border of photo → probable background (often shirt edge or BG)
            bdr = 12
            mask_gc[r1:r1 + bdr, c1:c2] = cv2.GC_PR_BGD
            mask_gc[r2 - bdr:r2,  c1:c2] = cv2.GC_PR_BGD
            mask_gc[r1:r2, c1:c1 + bdr] = cv2.GC_PR_BGD
            mask_gc[r1:r2, c2 - bdr:c2] = cv2.GC_PR_BGD

            # Dead center → definite foreground (the garment body is always here)
            cy, cx = (r1 + r2) // 2, (c1 + c2) // 2
            seed = 40
            mask_gc[cy - seed:cy + seed, cx - seed:cx + seed] = cv2.GC_FGD

        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        cv2.grabCut(img_cv, mask_gc, None, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_MASK)

        mask_binary = np.where(
            (mask_gc == cv2.GC_BGD) | (mask_gc == cv2.GC_PR_BGD), 0, 255
        ).astype(np.uint8)

        # Clean up + keep largest blob
        mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_CLOSE, kernel_close)
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_binary)
        if num_labels > 1:
            largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            mask_binary = np.where(labels == largest, 255, 0).astype(np.uint8)
        mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_CLOSE, kernel_close)

        # Fallback: GrabCut found nothing → Otsu grayscale
        if int(mask_binary.sum()) < 5000 * 255:
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            _, mask_binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_CLOSE, kernel_close)

        Image.fromarray(mask_binary, mode='L').save(mask_path)
        return {"status": "success", "white_pixels": int(mask_binary.sum()) // 255}
    except Exception as e:
        Image.new('L', Image.open(cloth_path).size, 0).save(mask_path)
        return {"status": "error", "detail": str(e)}

@app.get("/debug/cloth-mask")
async def debug_cloth_mask():
    mask_path = DATASET_TEST_DIR / "cloth-mask" / "custom_cloth.jpg"
    if not mask_path.exists():
        raise HTTPException(status_code=404, detail="No mask generated yet")
    return FileResponse(str(mask_path), media_type="image/jpeg")

@app.get("/debug/agnostic/{person_id}")
async def debug_agnostic(person_id: str):
    """Returns the agnostic image (person with torso erased) for inspection."""
    path = DATASET_TEST_DIR / "agnostic-v3.2" / f"{person_id}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No agnostic image for {person_id}")
    return FileResponse(str(path), media_type="image/jpeg")

@app.get("/debug/parse/{person_id}")
async def debug_parse(person_id: str):
    """Returns the human parse map (colorized) for inspection."""
    path = DATASET_TEST_DIR / "image-parse" / f"{person_id}.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No parse map for {person_id}")
    # Colorize the label map so it's readable in a browser
    parse = Image.open(path).convert("L")
    parse_np = np.array(parse, dtype=np.uint8)
    colorized = np.zeros((*parse_np.shape, 3), dtype=np.uint8)
    palette = [
        (0,0,0),(128,0,0),(0,128,0),(128,128,0),(0,0,128),(128,0,128),
        (0,128,128),(192,192,192),(64,0,0),(192,0,0),(64,128,0),(192,128,0),
        (64,0,128),(192,0,128),(64,128,128),(192,128,128),(0,64,0),(128,64,0),
        (0,192,0),(128,192,0)
    ]
    for label, color in enumerate(palette):
        colorized[parse_np == label] = color
    buf = BytesIO()
    Image.fromarray(colorized).save(buf, format="PNG")
    buf.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(buf, media_type="image/png")

@app.get("/debug/pose/{person_id}")
async def debug_pose(person_id: str):
    """Returns the pose-rendered image for inspection."""
    path = DATASET_TEST_DIR / "openpose-img" / f"{person_id}_rendered.png"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No pose image for {person_id}")
    return FileResponse(str(path), media_type="image/png")

@app.get("/cloth-image/{name}")
async def get_cloth_image(name: str):
    path = DATASET_TEST_DIR / "cloth" / name
    if not path.exists(): raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/jpeg")

@app.post("/run")
async def run_tryon(person_name: str = Query(...)):
    job_name = f"job_{uuid.uuid4().hex[:8]}"
    person_base = person_name.replace('.jpg', '')
    mask_path = DATASET_TEST_DIR / "cloth-mask" / "custom_cloth.jpg"
    
    if not mask_path.exists(): await generate_cloth_mask()
    
    pairs_file = DATASET_DIR / f"test_pairs_{job_name}.txt"
    pairs_file.write_text(f"{person_name} custom_cloth.jpg\n")
    
    test_py = VITON_ROOT / "test.py"
    checkpoint_dir = VITON_ROOT / "checkpoints"
    
    cmd = [
        str(PYTHON_EXE), str(test_py), "--name", job_name, "--dataset_dir", str(DATASET_DIR),
        "--dataset_list", pairs_file.name, "--checkpoint_dir", str(checkpoint_dir),
        "--save_dir", str(RESULT_DIR), "--batch_size", "1"
    ]
    
    try:
        result = subprocess.run(cmd, cwd=str(VITON_ROOT), capture_output=True, text=True, timeout=300)
        if pairs_file.exists(): pairs_file.unlink()
        
        if result.returncode != 0: raise HTTPException(status_code=500, detail="VITON-HD failed.")
        
        result_dir = RESULT_DIR / job_name
        result_image = None
        for pattern in [f"{person_base}_custom_cloth.jpg", "*.jpg", "*.png"]:
            matches = list(result_dir.glob(pattern))
            if matches:
                result_image = matches[0].name
                break
                
        if not result_image: raise HTTPException(status_code=500, detail="Result image not found")

        # Post-process: fix washed-out color, collar artifact, jagged edges
        _postprocess_result(result_dir / result_image, person_name)

        return {
            "status": "success", "view_url": f"/result/{job_name}/{result_image}",
            "person_url": f"/person-image/{person_name}", "cloth_url": f"/cloth-image/custom_cloth.jpg",
        }
    except Exception as e:
        if pairs_file.exists(): pairs_file.unlink()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/result/{job_name}/{filename}")
async def get_result_image(job_name: str, filename: str):
    path = RESULT_DIR / job_name / filename
    if not path.exists(): raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/jpeg")

@app.get("/results")
async def list_results():
    if not RESULT_DIR.exists(): return {"results": []}
    results = []
    for job_dir in RESULT_DIR.iterdir():
        if job_dir.is_dir():
            images = [img.name for img in job_dir.glob("*.jpg")]
            if images: results.append({"job_name": job_dir.name, "images": images})
    return {"results": results}

# ==================== PRODUCT IMAGE UPLOAD ====================
@app.post("/api/admin/upload-product-image")
async def upload_product_image(file: UploadFile = File(...)):
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only jpg/png/webp/gif allowed")
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = STATIC_DIR / "products" / filename
    with open(dest, "wb") as f:
        f.write(await file.read())
    return {"success": True, "image_url": f"http://localhost:8000/static/products/{filename}"}

# ==================== PRODUCT API ====================

# 30 sample products — colors use the exact names from PALETTE_TO_COLORS
# so the recommendation engine matches them correctly.
SAMPLE_PRODUCTS = [
    # ── TOPS ──────────────────────────────────────────────────
    {"name": "Classic White T-Shirt",       "price": 29.99,  "category": "tops",      "description": "Premium cotton tee with a relaxed modern fit.",         "sizes": ["XS","S","M","L","XL"],    "colors": ["white","black","gray"],            "stock": 50},
    {"name": "Navy Essential Tee",           "price": 32.99,  "category": "tops",      "description": "Soft everyday tee in wardrobe-staple navy.",            "sizes": ["XS","S","M","L","XL"],    "colors": ["navy","white","gray"],             "stock": 45},
    {"name": "Emerald Silk Blouse",          "price": 74.99,  "category": "tops",      "description": "Flowing silk blouse in rich jewel-toned emerald.",      "sizes": ["XS","S","M","L"],         "colors": ["emerald","teal"],                  "stock": 20},
    {"name": "Burgundy Velvet Top",          "price": 64.99,  "category": "tops",      "description": "Luxurious velvet top with a deep burgundy hue.",        "sizes": ["XS","S","M","L","XL"],    "colors": ["burgundy","ruby"],                 "stock": 25},
    {"name": "Camel Knit Sweater",           "price": 89.99,  "category": "tops",      "description": "Cosy cable-knit sweater in warm camel tones.",          "sizes": ["S","M","L","XL"],         "colors": ["camel","beige","cream"],           "stock": 30},
    {"name": "Lavender Puff-Sleeve Top",     "price": 54.99,  "category": "tops",      "description": "Romantic puff-sleeve blouse in soft lavender.",         "sizes": ["XS","S","M","L"],         "colors": ["lavender","blush"],                "stock": 28},
    {"name": "Coral Off-Shoulder Top",       "price": 44.99,  "category": "tops",      "description": "Breezy off-shoulder top in vibrant coral.",             "sizes": ["XS","S","M","L","XL"],    "colors": ["coral","peach"],                   "stock": 35},
    {"name": "Olive Linen Shirt",            "price": 59.99,  "category": "tops",      "description": "Relaxed linen shirt perfect for warm weather.",         "sizes": ["S","M","L","XL","XXL"],   "colors": ["olive","mustard"],                 "stock": 40},
    {"name": "Terracotta Ruched Blouse",     "price": 49.99,  "category": "tops",      "description": "Flattering ruched detail in earthy terracotta.",        "sizes": ["XS","S","M","L","XL"],    "colors": ["terracotta","rust"],               "stock": 22},
    {"name": "Fuchsia Statement Top",        "price": 39.99,  "category": "tops",      "description": "Bold fuchsia top that stands out in any crowd.",        "sizes": ["XS","S","M","L","XL"],    "colors": ["fuchsia","pink"],                  "stock": 30},
    # ── BOTTOMS ───────────────────────────────────────────────
    {"name": "Slim Black Jeans",             "price": 79.99,  "category": "bottoms",   "description": "Classic slim-fit jeans in versatile black.",            "sizes": ["28","30","32","34","36"], "colors": ["black","charcoal"],                "stock": 50},
    {"name": "Navy Wide-Leg Trousers",       "price": 84.99,  "category": "bottoms",   "description": "Elevated wide-leg trousers in deep navy.",              "sizes": ["XS","S","M","L","XL"],    "colors": ["navy","cobalt"],                   "stock": 25},
    {"name": "Camel Wide-Leg Pants",         "price": 89.99,  "category": "bottoms",   "description": "Flowy wide-leg pants in a timeless camel shade.",       "sizes": ["XS","S","M","L","XL"],    "colors": ["camel","beige"],                   "stock": 20},
    {"name": "Olive Cargo Trousers",         "price": 74.99,  "category": "bottoms",   "description": "Functional cargo trousers in utility olive.",           "sizes": ["S","M","L","XL","XXL"],   "colors": ["olive","brown"],                   "stock": 35},
    {"name": "Lavender Midi Skirt",          "price": 59.99,  "category": "bottoms",   "description": "Flowy midi skirt in dreamy muted lavender.",            "sizes": ["XS","S","M","L"],         "colors": ["lavender","lilac"],                "stock": 25},
    {"name": "Red Mini Skirt",               "price": 44.99,  "category": "bottoms",   "description": "Daring mini skirt in classic bold red.",               "sizes": ["XS","S","M","L"],         "colors": ["red","orange"],                    "stock": 20},
    {"name": "Ivory Linen Shorts",           "price": 39.99,  "category": "bottoms",   "description": "Lightweight linen shorts for casual summer days.",      "sizes": ["XS","S","M","L","XL"],    "colors": ["ivory","beige"],                   "stock": 40},
    # ── DRESSES ───────────────────────────────────────────────
    {"name": "Floral Summer Dress",          "price": 69.99,  "category": "dresses",   "description": "Lightweight floral print dress in soft blush tones.",   "sizes": ["XS","S","M","L"],         "colors": ["blush","rose","mint"],             "stock": 30},
    {"name": "Navy Wrap Dress",              "price": 94.99,  "category": "dresses",   "description": "Chic wrap dress in timeless deep navy.",               "sizes": ["XS","S","M","L","XL"],    "colors": ["navy","cobalt"],                   "stock": 22},
    {"name": "Emerald Midi Dress",           "price": 109.99, "category": "dresses",   "description": "Elegant midi dress in rich emerald green.",             "sizes": ["XS","S","M","L"],         "colors": ["emerald","teal"],                  "stock": 18},
    {"name": "Camel Slip Dress",             "price": 79.99,  "category": "dresses",   "description": "Minimalist slip dress in a warm camel tone.",           "sizes": ["XS","S","M","L"],         "colors": ["camel","beige","ivory"],           "stock": 20},
    {"name": "Blush Maxi Dress",             "price": 119.99, "category": "dresses",   "description": "Dreamy maxi dress in romantic blush and rose.",         "sizes": ["XS","S","M","L","XL"],    "colors": ["blush","rose","peach"],            "stock": 15},
    {"name": "Terracotta Sundress",          "price": 64.99,  "category": "dresses",   "description": "Easy-wear sundress in warm earthy terracotta.",         "sizes": ["XS","S","M","L","XL"],    "colors": ["terracotta","rust","mustard"],     "stock": 25},
    {"name": "Yellow Shift Dress",           "price": 54.99,  "category": "dresses",   "description": "Eye-catching shift dress in vibrant yellow.",           "sizes": ["XS","S","M","L"],         "colors": ["yellow","lime"],                   "stock": 20},
    {"name": "Burgundy Evening Gown",        "price": 159.99, "category": "dresses",   "description": "Sophisticated evening gown in deep ruby burgundy.",     "sizes": ["XS","S","M","L"],         "colors": ["burgundy","ruby","purple"],        "stock": 10},
    # ── OUTERWEAR ─────────────────────────────────────────────
    {"name": "Blue Denim Jacket",            "price": 89.99,  "category": "outerwear", "description": "Classic denim jacket in versatile navy wash.",          "sizes": ["S","M","L","XL"],         "colors": ["navy","cobalt"],                   "stock": 30},
    {"name": "Camel Trench Coat",            "price": 189.99, "category": "outerwear", "description": "Timeless trench coat in classic camel beige.",          "sizes": ["S","M","L","XL"],         "colors": ["camel","beige","brown"],           "stock": 15},
    {"name": "Burgundy Blazer",              "price": 129.99, "category": "outerwear", "description": "Sharp tailored blazer in rich burgundy.",               "sizes": ["XS","S","M","L","XL"],    "colors": ["burgundy","ruby"],                 "stock": 18},
    {"name": "Olive Utility Jacket",         "price": 109.99, "category": "outerwear", "description": "Practical utility jacket in deep olive green.",         "sizes": ["S","M","L","XL","XXL"],   "colors": ["olive","brown"],                   "stock": 25},
    {"name": "Sky Blue Windbreaker",         "price": 84.99,  "category": "outerwear", "description": "Lightweight windbreaker in fresh sky blue.",            "sizes": ["S","M","L","XL"],         "colors": ["sky","mint"],                      "stock": 20},
]
db.seed_products_if_empty(SAMPLE_PRODUCTS)

class ProductRequest(PydanticBaseModel):
    name: str
    category: str = "tops"
    price: float
    description: str = ""
    image_url: str = ""
    image_gallery: list = []
    colors: list = []
    sizes: list = []
    stock: int = 0
    size_stock: dict = {}
    color_size_stock: dict = {}
    color_images: dict = {}

@app.get("/api/products")
async def get_all_products():
    products = db.get_all_products()
    return {"success": True, "count": len(products), "products": products}

@app.get("/api/products/sales")
async def get_product_sales():
    """Returns total quantity sold per product, computed from all orders."""
    return {"success": True, "sales": db.get_sales_by_product()}

@app.get("/api/products/{product_id}")
async def get_product(product_id: int):
    product = db.get_product_by_id(product_id)
    if not product: raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True, "product": product}

@app.post("/api/products")
async def add_product(product: ProductRequest):
    try:
        new_product = db.create_product(
            name=product.name, category=product.category, price=product.price,
            description=product.description, image_url=product.image_url,
            image_gallery=product.image_gallery, colors=product.colors,
            sizes=product.sizes, stock=product.stock, size_stock=product.size_stock,
            color_size_stock=product.color_size_stock, color_images=product.color_images,
        )
        return {"success": True, "product": new_product}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/products/{product_id}")
async def update_product(product_id: int, product: ProductRequest):
    try:
        updated = db.update_product(
            product_id=product_id, name=product.name, category=product.category,
            price=product.price, description=product.description,
            image_url=product.image_url, image_gallery=product.image_gallery,
            colors=product.colors, sizes=product.sizes, stock=product.stock,
            size_stock=product.size_stock, color_size_stock=product.color_size_stock,
            color_images=product.color_images,
        )
        if not updated: raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True, "product": updated}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int):
    deleted = db.delete_product(product_id)
    if not deleted: raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True, "message": "Product deleted"}

# ── ORDERS ────────────────────────────────────────────────────

class OrderRequest(PydanticBaseModel):
    user_id: int
    items: list = []
    subtotal: float = 0
    shipping: float = 0
    discount: float = 0
    total: float = 0
    address: dict = {}

@app.post("/api/orders")
async def place_order(order: OrderRequest):
    try:
        new_order = db.create_order(
            user_id=order.user_id, items=order.items,
            subtotal=order.subtotal, shipping=order.shipping,
            discount=order.discount, total=order.total,
            address=order.address,
        )
        return {"success": True, "order": new_order}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{user_id}/orders")
async def get_user_orders(user_id: int):
    orders = db.get_user_orders(user_id)
    return {"success": True, "orders": orders}

@app.post("/api/products/delete")
async def bulk_delete_products(data: dict = Body(...)):
    product_ids = data.get("product_ids", [])
    for pid in product_ids:
        db.delete_product(pid)
    return {"success": True, "deleted": len(product_ids)}

# ============================================================
# KNN RECOMMENDATION ENGINE
# ============================================================
import numpy as np
from sklearn.neighbors import NearestNeighbors

def build_feature_matrix(products: list) -> tuple:
    if not products: return np.array([]), []
    product_ids = [p["id"] for p in products]
    categories = sorted(set(p.get("category", "unknown") for p in products))
    cat_to_idx = {c: i for i, c in enumerate(categories)}
    cat_matrix = np.zeros((len(products), len(categories)))
    for i, p in enumerate(products):
        cat = p.get("category", "unknown")
        if cat in cat_to_idx: cat_matrix[i, cat_to_idx[cat]] = 1.0

    prices = np.array([p.get("price", 0.0) for p in products], dtype=float).reshape(-1, 1)
    price_norm = (prices - prices.min()) / (prices.max() - prices.min()) if prices.max() > prices.min() else np.zeros_like(prices)

    all_colors = sorted(set(c for p in products for c in p.get("colors", [])))
    color_to_idx = {c: i for i, c in enumerate(all_colors)}
    color_matrix = np.zeros((len(products), max(len(all_colors), 1)))
    for i, p in enumerate(products):
        for c in p.get("colors", []):
            if c in color_to_idx: color_matrix[i, color_to_idx[c]] = 1.0

    all_sizes = sorted(set(s for p in products for s in p.get("sizes", [])))
    size_to_idx = {s: i for i, s in enumerate(all_sizes)}
    size_matrix = np.zeros((len(products), max(len(all_sizes), 1)))
    for i, p in enumerate(products):
        for s in p.get("sizes", []):
            if s in size_to_idx: size_matrix[i, size_to_idx[s]] = 1.0

    feature_matrix = np.hstack([cat_matrix * 2.0, price_norm * 0.5, color_matrix * 1.0, size_matrix * 0.5])
    return feature_matrix, product_ids

@app.get("/api/recommendations")
async def get_recommendations(product_id: int, top_k: int = 5, category_filter: str = None):
    try:
        all_products = db.get_all_products()
        source_product = next((p for p in all_products if p["id"] == product_id or p.get("product_id") == product_id), None)
        if not source_product: raise HTTPException(status_code=404)
        candidate_products = [p for p in all_products if p["id"] != product_id]
        if category_filter: candidate_products = [p for p in candidate_products if p.get("category") == category_filter]
        if not candidate_products: return {"success": True, "recommendations": []}

        all_products_for_matrix = [source_product] + candidate_products
        feature_matrix, _ = build_feature_matrix(all_products_for_matrix)
        if feature_matrix.size == 0: return {"success": True, "recommendations": candidate_products[:top_k]}

        source_vector, candidate_matrix = feature_matrix[0:1], feature_matrix[1:]
        k = min(top_k, len(candidate_products))
        knn = NearestNeighbors(n_neighbors=k, metric="cosine", algorithm="brute")
        knn.fit(candidate_matrix)
        distances, indices = knn.kneighbors(source_vector)

        recommendations = []
        for rank, (dist, idx) in enumerate(zip(distances[0], indices[0])):
            product = candidate_products[idx].copy()
            product["similarity_percent"] = round((1 - float(dist)) * 100, 1)
            product["recommendation_rank"] = rank + 1
            recommendations.append(product)

        return {"success": True, "recommendations": recommendations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/recommendations/popular")
async def get_popular_products(top_k: int = 6):
    try:
        all_products = db.get_all_products()
        seen, picks = set(), []
        for p in all_products:
            cat = p.get("category", "unknown")
            if cat not in seen:
                seen.add(cat)
                picks.append(p)
            if len(picks) >= top_k: break
        if len(picks) < top_k:
            rem = [p for p in all_products if p["id"] not in {x["id"] for x in picks}]
            picks.extend(rem[:top_k - len(picks)])
        return {"success": True, "recommendations": picks[:top_k]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# BODY-TYPE ML RECOMMENDATION ENDPOINT
# ============================================================
from recommendation.recommender import predict_body_profile, models_ready

class BodyProfileRequest(PydanticBaseModel):
    height: float; weight: float; skin_tone: str; gender: str

PALETTE_TO_COLORS = {
    "Earth_Tones": ["brown", "beige", "olive", "mustard", "camel", "rust", "cream", "terracotta"],
    "Jewel_Tones": ["navy", "emerald", "burgundy", "purple", "cobalt", "teal", "sapphire", "ruby"],
    "Muted_Pastels": ["lavender", "blush", "mint", "sky", "rose", "peach", "lilac", "powder"],
    "Bold_Brights": ["red", "orange", "yellow", "pink", "fuchsia", "lime", "coral", "turquoise"],
    "Neutral_Classic": ["white", "black", "gray", "navy", "beige", "camel", "ivory", "charcoal"],
}

STYLE_TO_CATEGORIES = {
    "Slim_Fit": ["tops", "dresses"], "Average_Fit": ["tops", "bottoms", "dresses"],
    "Curvy_Chic": ["dresses", "tops", "bottoms"], "Plus_Comfort": ["tops", "dresses", "bottoms"],
    "Athletic_Build": ["tops", "bottoms", "outerwear"],
}

def get_size_recommendation(height: float, weight: float, gender: str) -> dict:
    """Returns recommended clothing size based on height, weight and gender."""
    bmi = weight / ((height / 100) ** 2)
    if gender == "Female":
        if   weight < 48  or bmi < 17.5: size = "XS"
        elif weight < 58  or bmi < 20.5: size = "S"
        elif weight < 70  or bmi < 24.0: size = "M"
        elif weight < 83  or bmi < 27.5: size = "L"
        elif weight < 95  or bmi < 31.0: size = "XL"
        else:                             size = "XXL"
        size_guide = {"XS": "Bust 76-81 cm, Waist 58-63 cm",
                      "S":  "Bust 82-87 cm, Waist 64-68 cm",
                      "M":  "Bust 88-93 cm, Waist 69-74 cm",
                      "L":  "Bust 94-99 cm, Waist 75-80 cm",
                      "XL": "Bust 100-106 cm, Waist 81-87 cm",
                      "XXL":"Bust 107-114 cm, Waist 88-95 cm"}
    else:
        if   weight < 60  or bmi < 18.5: size = "S"
        elif weight < 75  or bmi < 22.0: size = "M"
        elif weight < 90  or bmi < 25.5: size = "L"
        elif weight < 105 or bmi < 29.0: size = "XL"
        else:                             size = "XXL"
        size_guide = {"S":  "Chest 86-91 cm, Waist 71-76 cm",
                      "M":  "Chest 92-97 cm, Waist 77-82 cm",
                      "L":  "Chest 98-103 cm, Waist 83-88 cm",
                      "XL": "Chest 104-109 cm, Waist 89-94 cm",
                      "XXL":"Chest 110-116 cm, Waist 95-100 cm"}
    return {"recommended_size": size, "measurements": size_guide.get(size, "")}


def filter_products_by_profile(products, style, palette, top_k=6):
    p_colors, s_cats = set(PALETTE_TO_COLORS.get(palette, [])), set(STYLE_TO_CATEGORIES.get(style, []))
    scored = []
    for p in products:
        score = 2 if p.get("category", "").lower() in s_cats else 0
        match = set([c.lower() for c in p.get("colors", [])]) & p_colors
        score += len(match)
        enriched = p.copy()
        enriched["match_score"] = score
        enriched["matching_colors"] = list(match)
        scored.append(enriched)
    scored.sort(key=lambda x: (-x["match_score"], -len(x.get("matching_colors", [])), x.get("product_id", 0)))
    return scored[:top_k]

@app.post("/api/recommend/by-body")
async def recommend_by_body_profile(request: BodyProfileRequest):
    if not models_ready():
        bmi = request.weight / ((request.height / 100) ** 2)
        style = "Average_Fit"
        palette = "Neutral_Classic"
        palette2 = ""
        bmi_val, style_conf, color_conf, method = round(bmi, 2), 85.0, 90.0, "rule-based-fallback"
    else:
        try:
            res = predict_body_profile(height=request.height, weight=request.weight, skin_tone=request.skin_tone, gender=request.gender)
            style      = res["predicted_style"]
            palette    = res["predicted_palette"]
            palette2   = res.get("predicted_palette_secondary", "")
            bmi_val    = res["bmi"]
            style_conf = res["style_confidence"]
            color_conf = res["color_confidence"]
            color_conf2= res.get("color_confidence_secondary", 0)
            method     = "random-forest-ml"
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    bmi_cat  = "Underweight" if bmi_val < 18.5 else "Healthy Weight" if bmi_val < 25.0 else "Overweight" if bmi_val < 30.0 else "Obese"
    all_products = db.get_all_products()
    # Get ALL products that actually match each palette (score > 0) up to 4 each
    if palette2:
        primary_all   = filter_products_by_profile(all_products, style, palette, 4)
        secondary_all = filter_products_by_profile(all_products, style, palette2, 4)
        primary_ids   = {p.get("id") for p in primary_all}
        # Include ALL secondary products that have at least 1 matching color, not limited by price
        secondary_matched = [p for p in secondary_all
                             if p.get("id") not in primary_ids and len(p.get("matching_colors", [])) > 0]
        secondary_unmatched = [p for p in secondary_all
                               if p.get("id") not in primary_ids and len(p.get("matching_colors", [])) == 0]
        # Fill slots: all color-matched secondary first, then fill remaining with primary
        matched = primary_all + secondary_matched
        # If still under 8, pad with unmatched secondary products
        if len(matched) < 8:
            matched += secondary_unmatched[:8 - len(matched)]
    else:
        matched = filter_products_by_profile(all_products, style, palette, 8)
    size_rec = get_size_recommendation(request.height, request.weight, request.gender)

    return {
        "status": "success", "method": method,
        "body_analysis": {"bmi": bmi_val, "bmi_category": bmi_cat, "height_cm": request.height, "weight_kg": request.weight, "gender": request.gender, "skin_tone": request.skin_tone},
        "predictions": {
            "style": style, "color_palette": palette,
            "style_confidence_pct": style_conf, "color_confidence_pct": color_conf,
            "color_palette_secondary": palette2, "color_confidence_secondary_pct": color_conf2,
        },
        "size_recommendation": size_rec,
        "recommended_products": matched, "total_recommendations": len(matched),
        "palette_colors": PALETTE_TO_COLORS.get(palette, []),
        "palette_colors_secondary": PALETTE_TO_COLORS.get(palette2, []),
    }

@app.get("/api/recommend/model-status")
async def model_status():
    return {"ml_models_loaded": models_ready()}

# ==================== AUTH ENDPOINTS ====================
from database import create_user, login_user, login_admin, get_all_users, delete_user, get_all_tryon_results, get_all_orders, init_database
from pydantic import BaseModel as PydanticModel

init_database()

class UserRegisterRequest(PydanticModel): name: str; email: str; password: str; mobile: str = None; birthday: str = None
class UserLoginRequest(PydanticModel): email: str; password: str
class AdminLoginRequest(PydanticModel): email: str; password: str

@app.post("/api/auth/register")
async def register_user(request: UserRegisterRequest):
    try:
        user = create_user(name=request.name, email=request.email, password=request.password, mobile=request.mobile, birthday=request.birthday)
        return {"status": "success", "user": user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
async def user_login(request: UserLoginRequest):
    user = login_user(request.email, request.password)
    if not user: raise HTTPException(status_code=401)
    return {"status": "success", "role": "user", "user": user}

@app.post("/api/auth/admin/login")
async def admin_login(request: AdminLoginRequest):
    admin = login_admin(request.email, request.password)
    if not admin: raise HTTPException(status_code=401)
    return {"status": "success", "role": "admin", "admin": admin}

@app.get("/api/admin/users")
async def get_users():
    return {"status": "success", "users": get_all_users()}

@app.delete("/api/admin/users/{user_id}")
async def remove_user(user_id: int):
    delete_user(user_id)
    return {"status": "success"}

@app.get("/api/admin/tryon-results")
async def get_tryon_results():
    return {"status": "success", "results": get_all_tryon_results()}

@app.get("/api/admin/stats")
async def get_admin_stats():
    return {
        "status": "success",
        "total_users": len(get_all_users()),
        "total_tryons": len(get_all_tryon_results()),
        "total_orders": len(get_all_orders()),
    }

@app.get("/api/admin/orders")
async def get_admin_orders():
    return {"success": True, "orders": get_all_orders()}

# ==================== USER PROFILE ENDPOINTS ====================

class UserProfileUpdateRequest(PydanticModel):
    name: str = None
    mobile: str = None
    birthday: str = None

class UserBodyProfileUpdateRequest(PydanticModel):
    height: float = None
    weight: float = None
    gender: str = None
    skin_tone: str = None
    body_type: str = None
    chest: float = None
    waist: float = None
    hips: float = None
    preferred_style: str = None

@app.get("/api/user/{user_id}/profile")
async def get_user_full_profile(user_id: int):
    profile = db.get_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "profile": profile}

@app.put("/api/user/{user_id}/profile")
async def update_user_full_profile(user_id: int, request: UserProfileUpdateRequest):
    profile = db.update_user_info(user_id, name=request.name, mobile=request.mobile, birthday=request.birthday)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "profile": profile}

@app.put("/api/user/{user_id}/body-profile")
async def update_body_profile(user_id: int, request: UserBodyProfileUpdateRequest):
    db.upsert_body_profile(
        user_id,
        height=request.height,
        weight=request.weight,
        gender=request.gender,
        skin_tone=request.skin_tone,
        body_type=request.body_type,
        chest=request.chest,
        waist=request.waist,
        hips=request.hips,
        preferred_style=request.preferred_style,
    )
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)