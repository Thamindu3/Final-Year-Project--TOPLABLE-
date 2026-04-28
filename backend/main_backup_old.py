from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from PIL import Image, ImageDraw
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

# ==================== PATH CONFIGURATION ====================
BASE_DIR = Path(__file__).resolve().parent.parent
VITON_ROOT = BASE_DIR / "viton-hd"
DATASET_DIR = VITON_ROOT / "datasets"
DATASET_TEST_DIR = DATASET_DIR / "test"
RESULT_DIR = VITON_ROOT / "results"
PYTHON_EXE = sys.executable

print("\n" + "="*60)
print("🚀 VITON-HD Backend Starting")
print("="*60)
print(f"📂 BASE_DIR: {BASE_DIR}")
print(f"📂 VITON_ROOT: {VITON_ROOT}")
print(f"📂 DATASET_DIR: {DATASET_DIR}")
print(f"📂 DATASET_TEST_DIR: {DATASET_TEST_DIR}")
print(f"📂 RESULT_DIR: {RESULT_DIR}")
print(f"🐍 Python: {PYTHON_EXE}")

# Validation
if not VITON_ROOT.exists():
    raise RuntimeError(f"❌ VITON_ROOT not found: {VITON_ROOT}")
if not (VITON_ROOT / "test.py").exists():
    raise RuntimeError(f"❌ test.py not found in {VITON_ROOT}")

# Create directories
RESULT_DIR.mkdir(parents=True, exist_ok=True)
for subdir in ["image", "cloth", "cloth-mask", "openpose-json", "openpose-img", 
               "image-parse", "image-parse-v3", "image-parse-agnostic-v3.2", "agnostic-v3.2"]:
    (DATASET_TEST_DIR / subdir).mkdir(parents=True, exist_ok=True)

# Count preprocessed person images
person_dir = DATASET_TEST_DIR / "image"
openpose_dir = DATASET_TEST_DIR / "openpose-img"
preprocessed_count = 0

if person_dir.exists() and openpose_dir.exists():
    openpose_files = {f.stem.replace('_rendered', '') for f in openpose_dir.glob("*_rendered.png")}
    all_persons = {f.stem for f in person_dir.glob("*.jpg") if f.name[0].isdigit()}
    preprocessed_persons = all_persons & openpose_files
    preprocessed_count = len(preprocessed_persons)
    print(f"✅ Found {preprocessed_count} preprocessed person images (out of {len(all_persons)} total)")
else:
    print(f"⚠️  Person or OpenPose directory not found")

print("="*60 + "\n")

# ==================== HELPER: Get Preprocessed Persons ====================
def get_preprocessed_persons():
    """Get list of person images that have all required preprocessing files"""
    person_dir = DATASET_TEST_DIR / "image"
    openpose_dir = DATASET_TEST_DIR / "openpose-img"
    
    # Try both directories
    parse_dir_v3 = DATASET_TEST_DIR / "image-parse-v3"
    parse_dir = DATASET_TEST_DIR / "image-parse"
    
    if not person_dir.exists() or not openpose_dir.exists():
        return []
    
    # Get preprocessed filenames from openpose-img
    openpose_files = set()
    for f in openpose_dir.glob("*_rendered.png"):
        person_name = f.stem.replace('_rendered', '') + '.jpg'
        openpose_files.add(person_name)
    
    # Check parse files from either directory
    if parse_dir.exists():
        parse_files = {f.stem + '.jpg' for f in parse_dir.glob("*.png")}
        openpose_files = openpose_files & parse_files
    elif parse_dir_v3.exists():
        parse_files = {f.stem + '.jpg' for f in parse_dir_v3.glob("*.png")}
        openpose_files = openpose_files & parse_files
    
    # Filter to only existing person images
    preprocessed = []
    for filename in sorted(openpose_files):
        person_path = person_dir / filename
        if person_path.exists():
            preprocessed.append(filename)
    
    return preprocessed

# ==================== PREPROCESSING FUNCTIONS ====================

async def run_lightweight_pose(image_path: Path, output_json_dir: Path, output_img_dir: Path) -> bool:
    """Lightweight pose detection using MediaPipe."""
    try:
        import mediapipe as mp
        
        mp_pose = mp.solutions.pose
        mp_drawing = mp.solutions.drawing_utils
        
        print(f"   📷 Reading image: {image_path.name}")
        
        # Read image
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"   ❌ Failed to read image: {image_path}")
            return False
            
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image.shape[:2]
        
        print(f"   📐 Image size: {w}x{h}")
        
        # Run pose detection
        print(f"   🔍 Detecting pose landmarks...")
        with mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
            results = pose.process(image_rgb)
            
            if not results.pose_landmarks:
                print("   ❌ No pose detected - make sure person is clearly visible")
                return False
            
            print(f"   ✅ Pose detected with {len(results.pose_landmarks.landmark)} landmarks")
            
            # Convert MediaPipe format to OpenPose format (25 keypoints)
            keypoints = []
            landmark_list = results.pose_landmarks.landmark
            
            # Map MediaPipe landmarks to OpenPose format
            mp_to_openpose = [
                0,   # Nose
                -1,  # Neck (will calculate)
                12,  # Right Shoulder
                14,  # Right Elbow
                16,  # Right Wrist
                11,  # Left Shoulder
                13,  # Left Elbow
                15,  # Left Wrist
                24,  # Right Hip
                26,  # Right Knee
                28,  # Right Ankle
                23,  # Left Hip
                25,  # Left Knee
                27,  # Left Ankle
                2,   # Right Eye
                5,   # Left Eye
                8,   # Right Ear
                7,   # Left Ear
            ]
            
            for idx in mp_to_openpose:
                if idx == -1:
                    keypoints.extend([0.0, 0.0, 0.0])
                else:
                    lm = landmark_list[idx]
                    keypoints.extend([lm.x * w, lm.y * h, lm.visibility])
            
            # Calculate neck (average of shoulders)
            right_shoulder = landmark_list[12]
            left_shoulder = landmark_list[11]
            neck_x = (right_shoulder.x + left_shoulder.x) / 2 * w
            neck_y = (right_shoulder.y + left_shoulder.y) / 2 * h
            neck_conf = (right_shoulder.visibility + left_shoulder.visibility) / 2
            keypoints[3:6] = [neck_x, neck_y, neck_conf]
            
            # Pad to 75 values (25 keypoints * 3)
            while len(keypoints) < 75:
                keypoints.extend([0.0, 0.0, 0.0])
            keypoints = keypoints[:75]
            
            # Save JSON in OpenPose format
            json_data = {
                "version": 1.3,
                "people": [{
                    "pose_keypoints_2d": keypoints,
                    "face_keypoints_2d": [],
                    "hand_left_keypoints_2d": [],
                    "hand_right_keypoints_2d": [],
                }]
            }
            
            json_file = output_json_dir / f"{image_path.stem}_keypoints.json"
            with open(json_file, 'w') as f:
                json.dump(json_data, f)
            
            print(f"   💾 Saved keypoints: {json_file.name}")
            
            # Draw skeleton overlay
            annotated_image = image.copy()
            mp_drawing.draw_landmarks(
                annotated_image,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
            )
            
            output_file = output_img_dir / f"{image_path.stem}_rendered.png"
            cv2.imwrite(str(output_file), annotated_image)
            
            print(f"   💾 Saved rendered pose: {output_file.name}")
            print(f"   ✅ Pose detection complete!")
            return True
            
    except ImportError:
        print("   ❌ MediaPipe not installed. Run: pip install mediapipe")
        return False
    except Exception as e:
        print(f"   ❌ Pose detection error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def run_human_parsing(image_path: Path, output_path: Path) -> bool:
    """Run human parsing using Segformer."""
    try:
        from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation
        import torch
        
        print("   📥 Loading human parsing model...")
        processor = AutoImageProcessor.from_pretrained("mattmdjaga/segformer_b2_clothes")
        model = AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b2_clothes")
        
        # Load and process image
        image = Image.open(image_path).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        
        # Run inference
        print("   🔍 Running parsing inference...")
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
        
        # Resize to original size and get labels
        upsampled_logits = torch.nn.functional.interpolate(
            logits,
            size=image.size[::-1],
            mode="bilinear",
            align_corners=False
        )
        pred = upsampled_logits.argmax(dim=1)[0].cpu().numpy()
        
        # Save parse map as PNG with palette mode
        parse_img = Image.fromarray(pred.astype(np.uint8), mode='P')
        parse_img.save(output_path)
        
        print(f"   ✅ Human parsing complete: {output_path.name}")
        return True
        
    except Exception as e:
        print(f"   ❌ Human parsing error: {e}")
        import traceback
        traceback.print_exc()
        return False


def generate_parse_agnostic(parse_img: Image.Image, pose_data: np.ndarray, w: int = 768, h: int = 1024) -> Image.Image:
    """
    Generate clothing-agnostic parsing map.
    ✅ FIXED: Use OpenCV throughout, no PIL filtering
    """
    # Convert parse image to array
    label_array = np.array(parse_img)
    
    # Create masks using OpenCV (not PIL)
    parse_upper = ((label_array == 5).astype(np.float32) +
                   (label_array == 6).astype(np.float32) +
                   (label_array == 7).astype(np.float32))
    parse_neck = (label_array == 10).astype(np.float32)

    r = 10
    
    # Create agnostic array (start with original)
    agnostic_array = label_array.copy()

    # Mask arms using OpenCV
    for parse_id, pose_ids in [(14, [2, 5, 6, 7]), (15, [5, 2, 3, 4])]:
        # Create mask using OpenCV
        mask_arm = np.zeros((h, w), dtype=np.uint8)
        
        i_prev = pose_ids[0]
        for i in pose_ids[1:]:
            if i >= len(pose_data):
                continue
            if (pose_data[i_prev, 0] == 0.0 and pose_data[i_prev, 1] == 0.0) or \
               (pose_data[i, 0] == 0.0 and pose_data[i, 1] == 0.0):
                continue
            
            # Draw line using OpenCV
            pt1 = tuple(pose_data[i_prev].astype(int))
            pt2 = tuple(pose_data[i].astype(int))
            cv2.line(mask_arm, pt1, pt2, 255, thickness=r*10)
            
            # Draw ellipse using OpenCV
            pointx, pointy = pose_data[i].astype(int)
            radius = r*4 if i == pose_ids[-1] else r*15
            cv2.circle(mask_arm, (pointx, pointy), radius, 255, -1)
            
            i_prev = i
        
        # Apply mask
        parse_arm = (mask_arm / 255) * (label_array == parse_id).astype(np.float32)
        agnostic_array[parse_arm > 0] = 0

    # Mask torso & neck
    agnostic_array[parse_upper > 0] = 0
    agnostic_array[parse_neck > 0] = 0
    
    # ✅ Apply blur using OpenCV (not PIL!)
    agnostic_blurred = cv2.GaussianBlur(agnostic_array, (3, 3), 1.0)
    
    # Convert back to PIL for saving
    agnostic_img = Image.fromarray(agnostic_blurred.astype(np.uint8), mode='P')
    
    # Copy palette if available
    if parse_img.mode == 'P' and parse_img.palette:
        agnostic_img.putpalette(parse_img.getpalette())

    return agnostic_img


def generate_image_agnostic(img: Image.Image, parse: Image.Image, pose_data: np.ndarray) -> Image.Image:
    """
    Generate clothing-agnostic person image.
    ✅ FIXED: Use OpenCV for all operations
    """
    # Convert to arrays
    img_array = np.array(img)
    parse_array = np.array(parse)
    
    parse_head = ((parse_array == 4).astype(np.float32) +
                  (parse_array == 13).astype(np.float32))
    parse_lower = ((parse_array == 9).astype(np.float32) +
                   (parse_array == 12).astype(np.float32) +
                   (parse_array == 16).astype(np.float32) +
                   (parse_array == 17).astype(np.float32) +
                   (parse_array == 18).astype(np.float32) +
                   (parse_array == 19).astype(np.float32))

    # Create agnostic array
    agnostic_array = img_array.copy()

    # Check if we have enough keypoints
    if len(pose_data) < 13:
        print("   ⚠️ Not enough pose keypoints, using simplified agnostic")
        # Just mask with gray
        agnostic_array[(parse_head == 0) & (parse_lower == 0)] = [127, 127, 127]
        return Image.fromarray(agnostic_array)

    try:
        length_a = np.linalg.norm(pose_data[5] - pose_data[2])
        length_b = np.linalg.norm(pose_data[12] - pose_data[9])
        point = (pose_data[9] + pose_data[12]) / 2
        pose_data[9] = point + (pose_data[9] - point) / length_b * length_a
        pose_data[12] = point + (pose_data[12] - point) / length_b * length_a
        r = int(length_a / 16) + 1
    except:
        r = 10

    # Create mask using OpenCV
    h, w = img_array.shape[:2]
    mask = np.ones((h, w), dtype=np.uint8) * 255

    # Mask arms using OpenCV
    pt1 = tuple(pose_data[2].astype(int))
    pt2 = tuple(pose_data[5].astype(int))
    cv2.line(mask, pt1, pt2, 127, thickness=r*10)
    
    for i in [2, 5]:
        pointx, pointy = pose_data[i].astype(int)
        cv2.circle(mask, (pointx, pointy), r*5, 127, -1)
    
    for i in [3, 4, 6, 7]:
        if i >= len(pose_data):
            continue
        if (pose_data[i - 1, 0] == 0.0 and pose_data[i - 1, 1] == 0.0) or \
           (pose_data[i, 0] == 0.0 and pose_data[i, 1] == 0.0):
            continue
        
        pt1 = tuple(pose_data[i-1].astype(int))
        pt2 = tuple(pose_data[i].astype(int))
        cv2.line(mask, pt1, pt2, 127, thickness=r*10)
        
        pointx, pointy = pose_data[i].astype(int)
        cv2.circle(mask, (pointx, pointy), r*5, 127, -1)

    # Mask torso
    for i in [9, 12]:
        if i >= len(pose_data):
            continue
        pointx, pointy = pose_data[i].astype(int)
        cv2.ellipse(mask, (pointx, pointy), (r*3, r*6), 0, 0, 360, 127, -1)
    
    if len(pose_data) > 9 and len(pose_data) > 2:
        cv2.line(mask, tuple(pose_data[2].astype(int)), tuple(pose_data[9].astype(int)), 127, thickness=r*6)
    if len(pose_data) > 12 and len(pose_data) > 5:
        cv2.line(mask, tuple(pose_data[5].astype(int)), tuple(pose_data[12].astype(int)), 127, thickness=r*6)
    if len(pose_data) > 12 and len(pose_data) > 9:
        cv2.line(mask, tuple(pose_data[9].astype(int)), tuple(pose_data[12].astype(int)), 127, thickness=r*12)
        pts = np.array([pose_data[2], pose_data[5], pose_data[12], pose_data[9]], dtype=np.int32)
        cv2.fillPoly(mask, [pts], 127)

    # Mask neck
    if len(pose_data) > 1:
        pointx, pointy = pose_data[1].astype(int)
        cv2.rectangle(mask, (pointx-r*7, pointy-r*7), (pointx+r*7, pointy+r*7), 127, -1)
    
    # Apply mask
    agnostic_array[mask < 200] = [127, 127, 127]
    
    # Restore head and lower body
    agnostic_array[parse_head > 0] = img_array[parse_head > 0]
    agnostic_array[parse_lower > 0] = img_array[parse_lower > 0]

    return Image.fromarray(agnostic_array)


# ==================== ROOT ENDPOINT ====================
@app.get("/")
async def root():
    preprocessed = get_preprocessed_persons()
    
    return {
        "status": "VITON-HD backend running",
        "python": str(PYTHON_EXE),
        "dataset_dir": str(DATASET_DIR),
        "viton_root": str(VITON_ROOT),
        "test_py_exists": (VITON_ROOT / "test.py").exists(),
        "preprocessed_person_images": len(preprocessed),
        "docs": "/docs"
    }

# ==================== PERSON IMAGE ENDPOINTS ====================
@app.get("/persons")
async def list_persons():
    """List all available PREPROCESSED person images"""
    try:
        print(f"\n📂 /persons endpoint called")
        
        preprocessed = get_preprocessed_persons()
        
        print(f"   Found {len(preprocessed)} preprocessed person images")
        
        # Limit to first 50 for performance
        limited = preprocessed[:50]
        
        persons = [
            {
                "filename": filename,
                "url": f"/person-image/{filename}"
            }
            for filename in limited
        ]
        
        print(f"✅ Returning {len(persons)} preprocessed person images")
        
        return {
            "persons": persons,
            "total": len(preprocessed),
            "displayed": len(persons)
        }
    
    except Exception as e:
        print(f"❌ Error in /persons endpoint: {e}")
        import traceback
        traceback.print_exc()
        return {
            "persons": [],
            "total": 0,
            "error": str(e)
        }

@app.get("/person-image/{name}")
async def get_person_image(name: str):
    """Serve a person image from the dataset"""
    path = DATASET_TEST_DIR / "image" / name
    
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Person image not found: {name}")
    
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*"
        }
    )

# ==================== PERSON UPLOAD ====================
@app.post("/upload/person")
async def upload_person_image(file: UploadFile = File(...)):
    """
    Upload and preprocess a person image.
    This endpoint handles the complete preprocessing pipeline.
    """
    try:
        # Generate unique ID for this person
        person_id = str(uuid.uuid4())[:8] + "_person"
        
        print(f"\n{'='*60}")
        print(f"📸 NEW PERSON UPLOAD REQUEST")
        print(f"{'='*60}")
        print(f"Person ID: {person_id}")
        print(f"Original filename: {file.filename}")
        
        # Ensure all required directories exist
        (DATASET_TEST_DIR / "image").mkdir(parents=True, exist_ok=True)
        (DATASET_TEST_DIR / "openpose-json").mkdir(parents=True, exist_ok=True)
        (DATASET_TEST_DIR / "openpose-img").mkdir(parents=True, exist_ok=True)
        (DATASET_TEST_DIR / "image-parse").mkdir(parents=True, exist_ok=True)
        (DATASET_TEST_DIR / "image-parse-agnostic-v3.2").mkdir(parents=True, exist_ok=True)
        (DATASET_TEST_DIR / "agnostic-v3.2").mkdir(parents=True, exist_ok=True)
        
        # Read and validate image
        contents = await file.read()
        print(f"File size: {len(contents):,} bytes")
        
        try:
            image = Image.open(BytesIO(contents)).convert("RGB")
            print(f"Original image size: {image.size[0]}x{image.size[1]}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Resize to VITON-HD standard size (768 x 1024)
        print(f"Resizing to 768x1024...")
        image = image.resize((768, 1024), Image.Resampling.LANCZOS)
        
        # Save original image
        image_file = DATASET_TEST_DIR / "image" / f"{person_id}.jpg"
        image.save(image_file, quality=95)
        print(f"✅ Saved person image: {image_file.name}")
        
        print(f"\n{'='*60}")
        print(f"PREPROCESSING PIPELINE STARTING")
        print(f"{'='*60}\n")
        
        # Step 1: OpenPose detection
        print("🔍 STEP 1/5: Pose Detection")
        print("-" * 60)
        openpose_json_dir = DATASET_TEST_DIR / "openpose-json"
        openpose_img_dir = DATASET_TEST_DIR / "openpose-img"
        
        pose_success = await run_lightweight_pose(image_file, openpose_json_dir, openpose_img_dir)
        if not pose_success:
            raise HTTPException(
                status_code=500, 
                detail="Pose detection failed. Please use a clear full-body photo where the person is facing the camera."
            )
        
        # Step 2: Human parsing
        print(f"\n🎨 STEP 2/5: Human Parsing (Body Segmentation)")
        print("-" * 60)
        parse_path = DATASET_TEST_DIR / "image-parse" / f"{person_id}.png"
        
        parse_success = await run_human_parsing(image_file, parse_path)
        if not parse_success:
            raise HTTPException(
                status_code=500, 
                detail="Human parsing failed. Please try a different photo with better lighting."
            )
        
        # Load pose data
        pose_json_file = openpose_json_dir / f"{person_id}_keypoints.json"
        print(f"\n📖 Loading pose data from: {pose_json_file.name}")
        with open(pose_json_file, 'r') as f:
            pose_data = json.load(f)['people'][0]['pose_keypoints_2d']
            pose_data = np.array(pose_data).reshape(-1, 3)[:, :2]
        print(f"   ✅ Loaded {len(pose_data)} keypoints")
        
        # Load parse image
        parse_img = Image.open(parse_path)
        print(f"   ✅ Loaded parsing map: {parse_path.name}")
        
        # Step 3: Generate parse agnostic
        print(f"\n🖼️  STEP 3/5: Generate Parse Agnostic")
        print("-" * 60)
        parse_agnostic_dir = DATASET_TEST_DIR / "image-parse-agnostic-v3.2"
        
        print("   Masking upper body clothing in parsing map...")
        parse_agnostic = generate_parse_agnostic(parse_img, pose_data, 768, 1024)
        parse_agnostic_file = parse_agnostic_dir / f"{person_id}.png"
        parse_agnostic.save(parse_agnostic_file)
        print(f"   ✅ Saved parse agnostic: {parse_agnostic_file.name}")
        
        # Step 4: Generate image agnostic
        print(f"\n👤 STEP 4/5: Generate Person Agnostic Image")
        print("-" * 60)
        agnostic_dir = DATASET_TEST_DIR / "agnostic-v3.2"
        
        print("   Masking upper body clothing in photo...")
        image_agnostic = generate_image_agnostic(image, parse_img, pose_data)
        agnostic_file = agnostic_dir / f"{person_id}.jpg"
        image_agnostic.save(agnostic_file, quality=95)
        print(f"   ✅ Saved person agnostic: {agnostic_file.name}")
        
        # Step 5: Verify all files exist
        print(f"\n✅ STEP 5/5: Verification")
        print("-" * 60)
        openpose_json_path = pose_json_file
        openpose_img_path = openpose_img_dir / f"{person_id}_rendered.png"
        
        required_files = {
            "Person image": image_file,
            "OpenPose JSON": openpose_json_path,
            "OpenPose image": openpose_img_path,
            "Parse image": parse_path,
            "Parse agnostic": parse_agnostic_file,
            "Agnostic image": agnostic_file
        }
        
        missing = []
        for name, path in required_files.items():
            if path.exists():
                size = path.stat().st_size
                print(f"   ✅ {name}: {path.name} ({size:,} bytes)")
            else:
                print(f"   ❌ {name}: MISSING - {path}")
                missing.append(name)
        
        if missing:
            raise HTTPException(status_code=500, detail=f"Missing preprocessing files: {', '.join(missing)}")
        
        print(f"\n{'='*60}")
        print(f"✅ PREPROCESSING COMPLETE!")
        print(f"{'='*60}")
        print(f"Person ID: {person_id}")
        print(f"Ready for virtual try-on!")
        print(f"{'='*60}\n")
        
        return {
            "status": "success",
            "person_id": person_id,
            "filename": f"{person_id}.jpg",
            "message": "Your photo has been processed successfully! You can now try on clothes.",
            "preview_url": f"/person-image/{person_id}.jpg",
            "preprocessing_complete": True,
            "files_created": list(required_files.keys())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ PREPROCESSING FAILED")
        print(f"{'='*60}")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Preprocessing error: {str(e)}")

# ==================== CLOTH UPLOAD ====================
@app.post("/upload/cloth")
async def upload_cloth(file: UploadFile = File(...)):
    """Upload a cloth image"""
    cloth_path = DATASET_TEST_DIR / "cloth" / "custom_cloth.jpg"
    cloth_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Read and resize cloth
    contents = await file.read()
    img = Image.open(BytesIO(contents)).convert("RGB")
    img_resized = img.resize((768, 1024), Image.Resampling.LANCZOS)
    img_resized.save(cloth_path, quality=95)
    
    file_size = cloth_path.stat().st_size
    print(f"✅ Cloth uploaded: {cloth_path} ({file_size:,} bytes)")
    
    return {
        "status": "cloth image uploaded",
        "saved_as": "custom_cloth.jpg",
        "path": str(cloth_path),
        "size_bytes": file_size
    }

# ==================== CLOTH MASK GENERATION ====================
@app.post("/preprocess/cloth-mask")
async def generate_cloth_mask():
    """Generate high-quality cloth mask with multiple fallback methods"""
    cloth_path = DATASET_TEST_DIR / "cloth" / "custom_cloth.jpg"
    mask_path = DATASET_TEST_DIR / "cloth-mask" / "custom_cloth.jpg"
    
    if not cloth_path.exists():
        raise HTTPException(status_code=400, detail="Upload cloth first")
    
    print(f"\n🎭 Generating cloth mask...")
    print(f"   Input: {cloth_path}")
    
    # Method 1: Try rembg with U2NET model (best quality)
    try:
        from rembg import remove, new_session
        
        print("   📥 Using rembg with U2NET model...")
        
        # Create session with U2NET model for better cloth segmentation
        session = new_session("u2net")
        
        img = Image.open(cloth_path).convert("RGB")
        
        # Remove background
        result = remove(img, session=session)
        
        # Extract alpha channel
        if result.mode == 'RGBA':
            _, _, _, alpha = result.split()
        else:
            alpha = Image.new('L', result.size, 255)
        
        # Apply morphological operations to clean up mask
        alpha_np = np.array(alpha)
        
        # Threshold
        _, binary = cv2.threshold(alpha_np, 127, 255, cv2.THRESH_BINARY)
        
        # Morphological closing to fill small holes
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        # Morphological opening to remove small noise
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_open, iterations=1)
        
        # Optional: Dilate slightly to ensure cloth edges are included
        kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        binary = cv2.dilate(binary, kernel_dilate, iterations=1)
        
        mask = Image.fromarray(binary, mode='L')
        
        # Save mask
        mask_path.parent.mkdir(parents=True, exist_ok=True)
        mask.save(mask_path, quality=100)
        
        # Calculate coverage percentage
        white_pixels = np.sum(binary == 255)
        total_pixels = binary.size
        coverage = (white_pixels / total_pixels) * 100
        
        print(f"   ✅ High-quality mask generated with rembg (U2NET)")
        print(f"   📊 Mask coverage: {coverage:.1f}%")
        
        # Warn if coverage seems wrong
        if coverage < 10:
            print(f"   ⚠️  Warning: Mask coverage is very low. Consider using a plain background.")
        elif coverage > 90:
            print(f"   ⚠️  Warning: Mask coverage is very high. Background removal may have failed.")
        
        return {
            "status": "success",
            "method": "rembg_u2net_enhanced",
            "mask_coverage_percent": round(coverage, 2),
            "quality": "high"
        }
    
    except ImportError:
        print("   ⚠️  rembg not available, trying alternative methods...")
    
    except Exception as e:
        print(f"   ⚠️  rembg failed: {e}, trying alternative methods...")
    
    # Method 2: Try OpenCV GrabCut (good for simple backgrounds)
    try:
        print("   🔍 Trying GrabCut method...")
        
        img_cv = cv2.imread(str(cloth_path))
        img_rgb = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)
        
        # Initialize mask
        mask_grabcut = np.zeros(img_cv.shape[:2], np.uint8)
        
        # Define rectangle for foreground (assume cloth is centered)
        h, w = img_cv.shape[:2]
        margin = int(min(h, w) * 0.05)  # 5% margin
        rect = (margin, margin, w - 2*margin, h - 2*margin)
        
        # GrabCut parameters
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        # Run GrabCut
        cv2.grabCut(img_cv, mask_grabcut, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        
        # Create binary mask
        mask_binary = np.where((mask_grabcut == 2) | (mask_grabcut == 0), 0, 1).astype('uint8')
        mask_binary = mask_binary * 255
        
        # Clean up mask
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        mask = Image.fromarray(mask_binary, mode='L')
        mask_path.parent.mkdir(parents=True, exist_ok=True)
        mask.save(mask_path, quality=100)
        
        coverage = (np.sum(mask_binary == 255) / mask_binary.size) * 100
        
        print(f"   ✅ Mask generated with GrabCut")
        print(f"   📊 Mask coverage: {coverage:.1f}%")
        
        return {
            "status": "success",
            "method": "opencv_grabcut",
            "mask_coverage_percent": round(coverage, 2),
            "quality": "medium"
        }
    
    except Exception as e:
        print(f"   ⚠️  GrabCut failed: {e}, using simple threshold...")
    
    # Method 3: Simple threshold-based mask (fallback)
    try:
        print("   🔧 Using simple threshold method...")
        
        img = Image.open(cloth_path).convert("RGB")
        img_np = np.array(img)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        
        # Otsu's thresholding
        _, mask_binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Invert if background is darker than cloth
        if np.mean(mask_binary) < 128:
            mask_binary = cv2.bitwise_not(mask_binary)
        
        # Clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask_binary = cv2.morphologyEx(mask_binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        mask = Image.fromarray(mask_binary, mode='L')
        mask_path.parent.mkdir(parents=True, exist_ok=True)
        mask.save(mask_path, quality=100)
        
        coverage = (np.sum(mask_binary == 255) / mask_binary.size) * 100
        
        print(f"   ✅ Basic mask generated")
        print(f"   📊 Mask coverage: {coverage:.1f}%")
        
        return {
            "status": "success",
            "method": "threshold",
            "mask_coverage_percent": round(coverage, 2),
            "quality": "basic"
        }
    
    except Exception as e:
        print(f"   ❌ All mask generation methods failed: {e}")
        
        # Last resort: white mask
        cloth_img = Image.open(cloth_path)
        mask = Image.new('L', cloth_img.size, 255)
        mask_path.parent.mkdir(parents=True, exist_ok=True)
        mask.save(mask_path, quality=100)
        
        print(f"   ⚠️  Using fallback white mask")
        
        return {
            "status": "fallback",
            "method": "white_mask",
            "mask_coverage_percent": 100.0,
            "quality": "low",
            "warning": "Please use cloth images with plain backgrounds for best results"
        }

# ==================== CLOTH IMAGE ENDPOINT ====================
@app.get("/cloth-image/{name}")
async def get_cloth_image(name: str):
    """Serve cloth image"""
    path = DATASET_TEST_DIR / "cloth" / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Cloth image not found")
    return FileResponse(path, media_type="image/jpeg")

# ==================== VIRTUAL TRY-ON ====================
@app.post("/run")
async def run_tryon(person_name: str = Query(..., description="Person image filename")):
    """Run VITON-HD inference"""
    job_name = f"job_{uuid.uuid4().hex[:8]}"
    
    person_path = DATASET_TEST_DIR / "image" / person_name
    cloth_path = DATASET_TEST_DIR / "cloth" / "custom_cloth.jpg"
    mask_path = DATASET_TEST_DIR / "cloth-mask" / "custom_cloth.jpg"
    
    # Verify person is preprocessed
    person_base = person_name.replace('.jpg', '')
    openpose_file = DATASET_TEST_DIR / "openpose-img" / f"{person_base}_rendered.png"
    
    # Check in image-parse directory (not image-parse-v3)
    parse_file = DATASET_TEST_DIR / "image-parse" / f"{person_base}.png"
    
    # Fallback to v3 if not found
    if not parse_file.exists():
        parse_file_v3 = DATASET_TEST_DIR / "image-parse-v3" / f"{person_base}.png"
        if parse_file_v3.exists():
            parse_file = parse_file_v3
    
    print("\n" + "="*60)
    print(f"🎨 VITON-HD Inference - Job: {job_name}")
    print("="*60)
    
    if not person_path.exists():
        raise HTTPException(status_code=400, detail=f"Person image not found: {person_name}")
    
    if not openpose_file.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Person {person_name} missing preprocessing: {openpose_file.name}"
        )
    
    if not parse_file.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Person {person_name} missing preprocessing: parse image not found in image-parse/ or image-parse-v3/"
        )
    
    if not cloth_path.exists():
        raise HTTPException(status_code=400, detail="Upload cloth image first")
    
    person_size = person_path.stat().st_size
    cloth_size = cloth_path.stat().st_size
    
    print(f"✅ Person: {person_name} ({person_size:,} bytes)")
    print(f"✅ OpenPose verified: {openpose_file.name}")
    print(f"✅ Parse verified: {parse_file.name}")
    print(f"✅ Cloth: custom_cloth.jpg ({cloth_size:,} bytes)")
    
    # Generate mask if missing
    if not mask_path.exists():
        cloth_img = Image.open(cloth_path)
        mask = Image.new('L', cloth_img.size, 255)
        mask_path.parent.mkdir(parents=True, exist_ok=True)
        mask.save(mask_path)
        print(f"✅ Generated white mask")
    
    # Create SINGLE-ENTRY pairs file in datasets/ folder
    pairs_file = DATASET_DIR / f"test_pairs_{job_name}.txt"
    pairs_content = f"{person_name} custom_cloth.jpg\n"
    pairs_file.write_text(pairs_content)
    print(f"✅ Pairs file: {pairs_file}")
    print(f"   Content: {pairs_content.strip()}")
    
    # Run VITON-HD with unique pairs file
    test_py = VITON_ROOT / "test.py"
    checkpoint_dir = VITON_ROOT / "checkpoints"
    
    cmd = [
        str(PYTHON_EXE),
        str(test_py),
        "--name", job_name,
        "--dataset_dir", str(DATASET_DIR),
        "--dataset_list", pairs_file.name,
        "--checkpoint_dir", str(checkpoint_dir),
        "--save_dir", str(RESULT_DIR),
        "--batch_size", "1"
    ]
    
    print(f"\n🚀 Running VITON-HD inference...")
    print(f"   Dataset list: {pairs_file.name}")
    
    try:
        result = subprocess.run(
            cmd,
            cwd=str(VITON_ROOT),
            capture_output=True,
            text=True,
            timeout=300
        )
        
        # Clean up pairs file
        if pairs_file.exists():
            pairs_file.unlink()
        
        if result.stdout:
            print(f"📋 VITON-HD output (first 500 chars):")
            print(result.stdout[:500])
        
        if result.returncode != 0:
            print(f"❌ VITON-HD error:")
            print("="*60)
            print(result.stderr)
            print("="*60)
            raise HTTPException(status_code=500, detail=f"VITON-HD failed. Check backend logs.")
        
        # Find result
        result_dir = RESULT_DIR / job_name
        if not result_dir.exists():
            raise HTTPException(status_code=500, detail="Result directory not created")
        
        person_base = person_name.replace('.jpg', '')
        patterns = [
            f"{person_base}_custom_cloth.jpg",
            f"{person_base}_*.jpg",
            "*.jpg",
            "*.png"
        ]
        
        result_image = None
        for pattern in patterns:
            matches = list(result_dir.glob(pattern))
            if matches:
                result_image = matches[0].name
                print(f"✅ Found result: {result_image}")
                break
        
        if not result_image:
            all_files = list(result_dir.glob("*"))
            print(f"❌ No result image found. Directory contents:")
            for f in all_files:
                print(f"   - {f.name}")
            raise HTTPException(status_code=500, detail="Result image not found")
        
        result_size = (result_dir / result_image).stat().st_size
        
        print(f"\n✅ SUCCESS!")
        print(f"   Job: {job_name}")
        print(f"   Result: {result_image} ({result_size:,} bytes)")
        print("="*60 + "\n")
        
        return {
            "status": "success",
            "job_name": job_name,
            "result_image": result_image,
            "view_url": f"/result/{job_name}/{result_image}",
            "person_url": f"/person-image/{person_name}",  # ✅ Added
            "cloth_url": f"/cloth-image/custom_cloth.jpg",  # ✅ Added
            "person_used": person_name,
            "cloth_used": "custom_cloth.jpg",
            "result_size_bytes": result_size
        }
    
    except subprocess.TimeoutExpired:
        if pairs_file.exists():
            pairs_file.unlink()
        print("❌ Inference timed out after 5 minutes")
        raise HTTPException(status_code=504, detail="Inference timed out")
    
    except HTTPException:
        raise
    
    except Exception as e:
        if pairs_file.exists():
            pairs_file.unlink()
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== RESULT ENDPOINTS ====================
@app.get("/result/{job_name}/{filename}")
async def get_result_image(job_name: str, filename: str):
    """Serve result image"""
    path = RESULT_DIR / job_name / filename
    
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result not found")
    
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*"
        }
    )

@app.get("/results")
async def list_results():
    """List all results"""
    if not RESULT_DIR.exists():
        return {"results": []}
    
    results = []
    for job_dir in RESULT_DIR.iterdir():
        if job_dir.is_dir():
            images = [img.name for img in job_dir.glob("*.jpg")]
            if images:
                results.append({
                    "job_name": job_dir.name,
                    "images": images
                })
    return {"results": results}

# ==================== DEBUG ENDPOINT ====================
@app.get("/debug/cloth-mask")
async def get_cloth_mask():
    """Debug endpoint to view generated cloth mask"""
    mask_path = DATASET_TEST_DIR / "cloth-mask" / "custom_cloth.jpg"
    
    if not mask_path.exists():
        raise HTTPException(status_code=404, detail="No mask generated yet")
    
    return FileResponse(
        mask_path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*"
        }
    )

# ==================== PRODUCT API ====================
SAMPLE_PRODUCTS = [
    {"id": 1, "name": "Classic White T-Shirt", "price": 29.99, "category": "tops", "description": "Premium cotton t-shirt with modern fit", "image_url": "http://localhost:8000/static/products/white-tshirt.jpg", "sizes": ["S", "M", "L", "XL"], "colors": ["white", "black", "gray"]},
    {"id": 2, "name": "Blue Denim Jacket", "price": 89.99, "category": "outerwear", "description": "Classic denim jacket with vintage wash", "image_url": "http://localhost:8000/static/products/denim-jacket.jpg", "sizes": ["S", "M", "L", "XL"], "colors": ["blue", "black"]},
    {"id": 3, "name": "Floral Summer Dress", "price": 59.99, "category": "dresses", "description": "Lightweight floral print dress perfect for summer", "image_url": "http://localhost:8000/static/products/floral-dress.jpg", "sizes": ["XS", "S", "M", "L"], "colors": ["pink", "blue", "yellow"]},
    {"id": 4, "name": "Slim Fit Jeans", "price": 69.99, "category": "bottoms", "description": "Modern slim fit jeans with stretch comfort", "image_url": "http://localhost:8000/static/products/slim-jeans.jpg", "sizes": ["28", "30", "32", "34", "36"], "colors": ["blue", "black"]},
    {"id": 5, "name": "Striped Long Sleeve Shirt", "price": 49.99, "category": "tops", "description": "Casual striped shirt with button-down collar", "image_url": "http://localhost:8000/static/products/striped-shirt.jpg", "sizes": ["S", "M", "L", "XL"], "colors": ["blue-white", "red-white"]}
]

@app.get("/api/products")
async def get_all_products():
    return {"success": True, "count": len(SAMPLE_PRODUCTS), "products": SAMPLE_PRODUCTS}

@app.get("/api/products/{product_id}")
async def get_product(product_id: int):
    product = next((p for p in SAMPLE_PRODUCTS if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True, "product": product}

# ==================== RUN SERVER ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
