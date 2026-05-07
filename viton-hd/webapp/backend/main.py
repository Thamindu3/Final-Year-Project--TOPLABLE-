from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil, os, subprocess, uuid, glob, sys

app = FastAPI(title="VITON-HD Virtual Try-On API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
VITON_ROOT       = os.path.abspath(os.path.join(BASE_DIR, "../../"))
DATASET_DIR      = os.path.join(VITON_ROOT, "datasets")        # datasets/
DATASET_TEST_DIR = os.path.join(DATASET_DIR, "test")           # datasets/test/
RESULT_DIR       = os.path.join(VITON_ROOT, "results")

PYTHON_EXE = sys.executable

# Create dirs
for d in ["image","cloth","cloth-mask","image-parse-v3","openpose-json",
          "openpose-img","agnostic-v3.2","agnostic-mask","image-densepose"]:
    os.makedirs(os.path.join(DATASET_TEST_DIR, d), exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)

@app.get("/")
def root():
    return {
        "message": "VITON-HD backend running",
        "python": PYTHON_EXE,
        "dataset_dir_used": DATASET_DIR,
        "docs": "/docs"
    }

@app.get("/persons")
def list_persons():
    image_dir = os.path.join(DATASET_TEST_DIR, "image")
    persons = sorted([f for f in os.listdir(image_dir) if f.endswith(".jpg")])
    return {"count": len(persons), "persons": persons}

@app.post("/upload/cloth")
async def upload_cloth(file: UploadFile = File(...)):
    dest = os.path.join(DATASET_TEST_DIR, "cloth", "custom_cloth.jpg")
    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "cloth image uploaded", "saved_as": "custom_cloth.jpg"}

@app.post("/upload/person")
async def upload_person(file: UploadFile = File(...)):
    dest = os.path.join(DATASET_TEST_DIR, "image", "custom_person_00.jpg")
    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "person image uploaded", "saved_as": "custom_person_00.jpg"}

@app.post("/preprocess/cloth-mask")
async def generate_cloth_mask():
    try:
        from rembg import remove
        from PIL import Image

        cloth_path = os.path.join(DATASET_TEST_DIR, "cloth", "custom_cloth.jpg")
        mask_path  = os.path.join(DATASET_TEST_DIR, "cloth-mask", "custom_cloth.jpg")

        if not os.path.exists(cloth_path):
            raise HTTPException(status_code=400, detail="Upload cloth first")

        img = Image.open(cloth_path).convert("RGB")
        result = remove(img)
        _, _, _, alpha = result.split()
        mask = alpha.point(lambda x: 255 if x > 128 else 0).convert("L")
        mask.save(mask_path)
        return {"status": "cloth mask generated"}

    except ImportError:
        raise HTTPException(status_code=500, detail="Run: pip install rembg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/run")
async def run_tryon(
    person_name: str = Query(
        default="00006_00.jpg",
        description="Person filename from GET /persons, e.g. 00006_00.jpg"
    )
):
    job_name = f"job_{uuid.uuid4().hex[:8]}"

    # Validate files exist
    person_path = os.path.join(DATASET_TEST_DIR, "image", person_name)
    if not os.path.exists(person_path):
        raise HTTPException(status_code=400,
            detail=f"Person '{person_name}' not found. Check GET /persons")

    cloth_path = os.path.join(DATASET_TEST_DIR, "cloth", "custom_cloth.jpg")
    mask_path  = os.path.join(DATASET_TEST_DIR, "cloth-mask", "custom_cloth.jpg")

    if not os.path.exists(cloth_path):
        raise HTTPException(status_code=400, detail="Upload cloth first")
    if not os.path.exists(mask_path):
        raise HTTPException(status_code=400, detail="Generate mask first")

    # Write pairs file inside datasets/test/ so test.py finds it correctly
    pairs_path = os.path.join(DATASET_TEST_DIR, "custom_pairs.txt")
    with open(pairs_path, "w") as f:
        f.write(f"{person_name} custom_cloth.jpg\n")

    # IMPORTANT: --dataset_dir must be datasets/ (NOT datasets/test/)
    # because test.py appends "test/" internally via dataset_mode
    cmd = [
        PYTHON_EXE,
        os.path.join(VITON_ROOT, "test.py"),
        "--name", job_name,
        "--dataset_dir", DATASET_DIR + os.sep,   # datasets/  <-- KEY FIX
        "--dataset_list", "custom_pairs.txt",      # relative, found in datasets/test/
    ]

    try:
        proc = subprocess.run(cmd, cwd=VITON_ROOT,
            capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out")

    if proc.returncode != 0:
        return JSONResponse(status_code=500, content={
            "status": "inference failed",
            "error": proc.stderr[-2000:],
            "stdout": proc.stdout[-500:],
        })

    output_images = glob.glob(os.path.join(RESULT_DIR, job_name, "*.jpg"))
    if not output_images:
        return JSONResponse(status_code=500, content={"status": "no output found"})

    filename = os.path.basename(output_images[0])
    return {
        "status": "success",
        "job_name": job_name,
        "result_image": filename,
        "view_url": f"/result/{job_name}/{filename}"
    }

@app.get("/person-image/{name}")
def get_person_image(name: str):
    path = os.path.join(DATASET_TEST_DIR, "image", name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="image/jpeg")

@app.get("/result/{job_name}/{filename}")
def get_result(job_name: str, filename: str):
    path = os.path.join(RESULT_DIR, job_name, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="image/jpeg")

@app.get("/results")
def list_results():
    if not os.path.exists(RESULT_DIR):
        return {"jobs": {}}
    jobs = {}
    for job in os.listdir(RESULT_DIR):
        job_path = os.path.join(RESULT_DIR, job)
        if os.path.isdir(job_path):
            jobs[job] = [f for f in os.listdir(job_path) if f.endswith(".jpg")]
    return {"jobs": jobs}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)