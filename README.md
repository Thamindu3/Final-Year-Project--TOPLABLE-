# TOP LABLE — Clothing Brand Website with Virtual Try-On & AI Recommendations

> A full-stack fashion e-commerce prototype integrating VITON-HD high-definition virtual garment try-on, KNN content-based product recommendations, and a body-type-aware ML recommendation engine.
>
> **University of Plymouth | PUSL3190 Computing Project**
> **Student:** Samarathunga A Samarathunga (Index: 10953558)
> **Supervisor:** Ms. Thilini Bakmeedeniya
> **Degree:** BSc (Hons) Computer Science

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [AI & ML Models](#6-ai--ml-models)
   - [VITON-HD Virtual Try-On](#61-viton-hd-virtual-try-on)
   - [Body-Type ML Recommendation](#62-body-type-ml-recommendation-engine)
   - [KNN Product Recommendation](#63-knn-content-based-product-recommender)
7. [API Endpoints](#7-api-endpoints)
8. [Database Schema](#8-database-schema)
9. [Getting Started](#9-getting-started)
10. [Model Accuracy & Evaluation](#10-model-accuracy--evaluation)
11. [Screenshots](#11-screenshots)

---

## 1. Project Overview

TOP LABLE solves a core problem in online clothing retail: **customers cannot see how a garment looks on their own body before purchasing**, which reduces confidence and increases return rates — especially for Sri Lankan SMEs where AI-powered tools are largely inaccessible.

The prototype delivers:
- **End-to-end virtual try-on** — upload a photo, select a garment, get a high-resolution composite image
- **Body-type recommendations** — input your measurements, get personalised style and colour palette suggestions
- **Product recommendations** — browse and get AI-driven similar product suggestions per item
- **Full e-commerce functionality** — authentication, product catalogue, cart, orders, and admin dashboard

---

## 2. Key Features

### Virtual Try-On
- Upload a person photo and select any product garment
- Full preprocessing pipeline: pose estimation → human parsing → torso erasure → cloth masking
- VITON-HD three-stage inference: segmentation generation → geometric matching → image synthesis
- Post-processing: colour correction, neck skin restoration, edge smoothing

### AI Recommendations
- **Body-Type Engine**: Input height, weight, gender, skin tone → get predicted style profile + colour palette + size recommendation + 8 matching products
- **KNN Engine**: Select any product → get top-k similar products by category, colour, price, and size using cosine similarity

### E-Commerce
- User registration and login with password hashing
- Product catalogue with category filtering, search, and grid/list view
- Product detail page with image gallery, size/colour selection
- Shopping cart and order placement
- Admin dashboard: manage products, users, and view all orders/try-on results

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)                 │
│  Browse Products → Select Garment → Upload Photo → View Result  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST API (JSON + multipart)
┌────────────────────────────▼────────────────────────────────────┐
│                  Backend API (FastAPI + Uvicorn)                 │
│  Auth │ Products │ Orders │ Try-On │ Recommendations │ Admin     │
└──────────┬─────────────────────────────────┬────────────────────┘
           │                                 │
┌──────────▼──────────┐          ┌───────────▼───────────────────┐
│   AI/ML Pipeline    │          │  Storage Layer                │
│                     │          │                               │
│  MediaPipe Pose     │          │  SQLite DB (toplable.db)      │
│  SegFormer B2       │          │  Products │ Users │ Orders    │
│  GrabCut Masking    │          │  TryOnResults │ BodyProfile   │
│                     │          │                               │
│  VITON-HD Model     │          │  Filesystem                   │
│  ├─ SegGenerator    │          │  /uploads/person/             │
│  ├─ GMM (warp)      │          │  /uploads/cloth/              │
│  └─ ALIASGenerator  │          │  /datasets/test/              │
│                     │          │  /results/                    │
│  ML Recommenders    │          └───────────────────────────────┘
│  ├─ HistGB (style)  │
│  └─ RandomForest    │
│      (colour)       │
└─────────────────────┘
```

---

## 4. Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.4 | UI component framework |
| TypeScript | 4.9.5 | Static type safety |
| React Router | 7.13.0 | Client-side routing |
| Axios | 1.13.5 | HTTP API client |
| Framer Motion | 12.34.0 | Page & component animations |
| Lucide React | 0.564.0 | Icon library |
| React Intersection Observer | 10.0.2 | Scroll-triggered animations |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.8+ | Backend language |
| FastAPI | 0.104.1 | REST API framework |
| Uvicorn | 0.24.0 | ASGI production server |
| SQLite | built-in | Lightweight relational database |
| Python-multipart | 0.0.6 | Image file upload handling |
| Pydantic | — | Request/response validation |

### Computer Vision & AI
| Technology | Version | Purpose |
|---|---|---|
| PyTorch | 2.1.0 | VITON-HD deep learning inference |
| Torchvision | 0.16.0 | Image transforms for VITON-HD |
| OpenCV | 4.8.1.78 | GrabCut masking, image processing |
| Pillow | 10.1.0 | Image loading, saving, format conversion |
| MediaPipe | latest | Pose keypoint estimation (18 points) |
| Transformers (HuggingFace) | latest | SegFormer B2 human parsing |
| Rembg | 2.0.50 | Background removal |

### Machine Learning
| Technology | Purpose |
|---|---|
| scikit-learn | RandomForest, KNN, cross-validation, metrics |
| NumPy | Feature vector construction |
| Joblib | Model serialisation (.pkl) |

---

## 5. Project Structure

```
VITON-UNIFIED/
│
├── frontend/                          # React + TypeScript web app
│   ├── src/
│   │   ├── App.tsx                    # Root router and layout
│   │   ├── api.ts                     # Centralised API client (Axios)
│   │   ├── pages/
│   │   │   ├── HomePage.tsx           # Landing page with hero section
│   │   │   ├── ProductsPage.tsx       # Product catalogue with filters
│   │   │   ├── ProductDetailPage.tsx  # Single product view + KNN recommendations
│   │   │   ├── VirtualTryOnPage.tsx   # Try-on interface (upload + result)
│   │   │   ├── BodyRecommendPage.tsx  # Body profile form + ML recommendations
│   │   │   ├── LoginPage.tsx          # Sign in / Create account
│   │   │   ├── AdminPage.tsx          # Admin dashboard
│   │   │   ├── UserProfilePage.tsx    # User account & body measurements
│   │   │   ├── OrderPage.tsx          # Shopping cart & checkout
│   │   │   └── AboutPage.tsx          # About, FAQ, features
│   │   ├── components/
│   │   │   ├── Navbar.tsx             # Navigation bar
│   │   │   ├── Footer.tsx             # Site footer
│   │   │   └── BodyProfileForm.tsx    # Body measurements input form
│   │   └── index.tsx                  # React entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                           # REACT_APP_API_URL
│
├── backend/                           # FastAPI Python backend
│   ├── main.py                        # All API routes + preprocessing pipeline
│   ├── database.py                    # SQLite schema and queries
│   ├── utils.py                       # Helper utilities
│   ├── requirements.txt               # Python dependencies
│   ├── toplable.db                    # SQLite database file
│   ├── recommendation/
│   │   ├── generate_dataset.py        # Generates 100,000 synthetic training samples
│   │   ├── train_model.py             # Trains and evaluates Style + Colour models
│   │   ├── recommender.py             # Inference: body profile → outfit recommendations
│   │   └── clothing_data.csv          # Generated training dataset (100k rows)
│   ├── models/
│   │   ├── style_model.pkl            # Trained HistGradientBoosting (style prediction)
│   │   ├── color_model.pkl            # Trained RandomForest (colour palette prediction)
│   │   └── training_report.json       # Full training metrics and comparisons
│   ├── static/                        # Served product images
│   └── temp/                          # Temporary processing files
│
├── viton-hd/                          # VITON-HD inference module
│   ├── test.py                        # Main inference script (SegGen + GMM + ALIAS)
│   ├── networks.py                    # SegGenerator, GMM, ALIASGenerator definitions
│   ├── datasets.py                    # VITON-HD data loader
│   ├── evaluate_metrics.py            # SSIM, PSNR, LPIPS, FID evaluation
│   ├── utils.py                       # Thin-plate spline, grid utilities
│   ├── checkpoints/
│   │   ├── seg_final.pth              # SegGenerator pre-trained weights
│   │   ├── gmm_final.pth              # GMM pre-trained weights
│   │   └── alias_final.pth            # ALIASGenerator pre-trained weights
│   ├── datasets/test/
│   │   ├── image/                     # Person images (768×1024)
│   │   ├── cloth/                     # Garment images (768×1024)
│   │   ├── cloth-mask/                # Binary garment masks
│   │   ├── openpose-json/             # 18-keypoint pose JSON files
│   │   ├── openpose-img/              # Rendered pose skeleton images
│   │   ├── image-parse/               # SegFormer semantic labels
│   │   ├── image-parse-v3/            # V3 label format
│   │   ├── image-parse-agnostic-v3.2/ # Upper-body-erased label maps
│   │   └── agnostic-v3.2/             # Torso-erased person images
│   ├── results/                       # Final synthesised try-on images
│   └── evaluation_results/            # Quality metric reports
│
├── run_training_and_eval.bat          # One-click: train models + evaluate VITON-HD
├── .gitattributes                     # Git LFS config for .pkl, .pth, .h5 files
├── .gitignore
└── README.md
```

---

## 6. AI & ML Models

### 6.1 VITON-HD Virtual Try-On

VITON-HD is a three-stage generative pipeline that synthesises a high-resolution (1024×768) image of a person wearing a selected garment.

#### Stage 1 — Preprocessing (backend/main.py)

Before inference, every uploaded person image goes through a 7-step pipeline:

| Step | Tool | Description |
|---|---|---|
| 1. Resize & pad | Pillow | Resize to 768×1024 preserving aspect ratio; composite on white background |
| 2. Pose estimation | MediaPipe Pose | Extract 18 body keypoints (shoulders, elbows, wrists, hips, knees, ankles, face) |
| 3. Pose rendering | OpenCV | Render skeleton on black background (matches VITON-HD training distribution) |
| 4. Human parsing | SegFormer B2 (HuggingFace `mattmdjaga/segformer_b2_clothes`) | Semantic segmentation into 20 body-part labels |
| 5. Neck region inference | Landmark maths | Infer neck label between face and shirt using pose landmarks (prevents collar artefacts) |
| 6. Parse-agnostic generation | NumPy + OpenCV | Erase upper-clothes and arms (dilated 25×25) to guide synthesis |
| 7. Image-agnostic generation | Pillow | Replace torso + arms with neutral grey; keep face, hair, lower body |

Garment images also go through:

| Step | Tool | Description |
|---|---|---|
| Resize & pad | Pillow | 768×1024 with white padding; auto-contrast for low-contrast items |
| Cloth mask (GrabCut) | OpenCV GrabCut | Segment foreground garment from background |

**GrabCut initialisation:**
- White pixels (≥248 in all channels) → definite background
- 12-pixel border strip → probable background
- Centre 80×80 region → definite foreground
- 5 GrabCut iterations → binary mask → morphological close (15×15 ellipse) → largest connected component

#### Stage 2 — VITON-HD Inference (viton-hd/test.py)

Three neural networks run in sequence:

**SegGenerator** (U-Net, 21→13 channels)
- Input: cloth mask, masked cloth, parse-agnostic map, pose map, noise — all at 256×192
- Architecture: 5-level encoder, 4-level decoder with skip connections
- Output: Predicted full-body segmentation map (13 semantic regions)
- Upsampled back to 1024×768 with Gaussian smoothing

**GMM — Geometric Matching Module** (7 channels in, 3 channels cloth)
- Input: parse cloth map + pose map + image-agnostic combined with cloth image
- Architecture: Feature extraction → spatial correlation → thin-plate spline transformation grid
- Output: Spatially warped garment aligned to the body pose
- Computes misalignment mask: regions where predicted clothing and warped mask disagree

**ALIASGenerator** (9 channels: image-agnostic + pose + warped cloth)
- Input: Concatenation of body-agnostic image, pose representation, warped cloth, parse maps, misalignment mask
- Architecture: Encoder-decoder with spectral normalisation (training stability) + ALIAS normalisation (handles misaligned regions)
- Output: Final photorealistic try-on image at 1024×768

#### Stage 3 — Post-Processing (backend/main.py)

Three corrections are applied to the raw VITON-HD output:

| Correction | Method | Problem Solved |
|---|---|---|
| Colour correction | Per-channel mean scaling (clipped 0.45–1.0) with soft mask blend | Washed-out / faded garment colour |
| Neck restoration | Blend original neck skin from person image using Gaussian mask | Dark collar artefacts |
| Edge smoothing | Garment boundary dilation + Gaussian blur (65% blend) | Jagged synthesis boundaries |

---

### 6.2 Body-Type ML Recommendation Engine

#### Problem
Cold-start: no historical user interaction data. Instead, the system predicts personalised style and colour palettes from biometric inputs.

#### Training Data Generation (backend/recommendation/generate_dataset.py)

A synthetic dataset of **100,000 samples** is generated with realistic distributions:

| Feature | Type | Range / Values |
|---|---|---|
| Height (cm) | Float | 150–200 (Normal distribution by gender) |
| Weight (kg) | Float | 45–130 (Normal distribution by gender) |
| BMI | Float | Derived: weight / (height/100)² |
| Gender | Binary | 0 = Female, 1 = Male |
| Skin Tone | Integer | 0 = Fair, 1 = Medium, 2 = Dark |

Labels are assigned based on BMI + gender rules with added random noise (simulates real-world variation):

**Style Labels (5 classes)**
| Class | Assigned When |
|---|---|
| Slim_Fit | BMI < 18.5 |
| Athletic_Build | BMI 18.5–22.9, Male |
| Average_Fit | BMI 18.5–24.9 |
| Curvy_Chic | BMI 25–29.9, Female |
| Plus_Comfort | BMI ≥ 30 |

**Colour Palette Labels (5 classes)**
| Class | Assigned When |
|---|---|
| Earth_Tones | Dark skin tone |
| Jewel_Tones | Dark/Medium skin, Female |
| Neutral_Classic | Male with Average/Athletic build |
| Bold_Brights | BMI < 22, lighter skin |
| Muted_Pastels | Female, lighter skin |

Dataset split: **80,000 training / 20,000 test**

#### Model Selection (backend/recommendation/train_model.py)

Four classifiers were benchmarked with 5-fold cross-validation:

| Classifier | Style Accuracy | Colour Accuracy | Style Train Time | Colour Train Time |
|---|---|---|---|---|
| RandomForest (100 trees) | 92.30% | 95.79% | 4.16 s | 4.49 s |
| ExtraTrees (100 trees) | 91.47% | 94.56% | 1.69 s | 1.95 s |
| GradientBoosting | 92.67% | 95.57% | 52.02 s | 55.23 s |
| **HistGradientBoosting** | **92.83%** | 95.61% | **3.62 s** | **2.80 s** |

**Selected:**
- **Style Model** → `HistGradientBoosting` (best accuracy + fastest training)
- **Colour Model** → `RandomForest` (best accuracy overall)

`class_weight='balanced'` is used to prevent majority-class bias (some colour palettes are rarer in the dataset).

#### Final Model Performance

| Metric | Style Model | Colour Model |
|---|---|---|
| Algorithm | HistGradientBoosting | RandomForest (100 trees) |
| Train Accuracy | 92.83% | 95.79% |
| F1 Score (Weighted) | 92.82% | 95.78% |
| F1 Score (Macro) | 92.44% | 95.47% |
| Precision (Weighted) | 92.82% | 95.79% |
| ROC-AUC (Weighted) | **0.9945** | 0.9719 |
| 5-Fold CV Mean | 93.05% ± 0.023% | 96.05% ± 0.054% |

#### Prediction Output

For a given user's biometrics, the system returns:
- Predicted **style class** + confidence probability
- Predicted **primary colour palette** + confidence
- Predicted **secondary colour palette** (runner-up class)
- BMI + BMI category (Underweight / Normal / Overweight / Obese)
- Recommended **clothing size** (XS–XXL) with bust/waist/hip ranges
- **8 matching products** filtered by style category + palette colours

---

### 6.3 KNN Content-Based Product Recommender

#### Algorithm
`sklearn.neighbors.NearestNeighbors` with **cosine similarity** and brute-force search (small catalogue size).

#### Feature Vector Construction

Each product is encoded into a weighted feature vector:

| Feature | Encoding | Weight |
|---|---|---|
| Category | One-hot (tops, bottoms, dresses, outerwear) | **2.0** (most influential) |
| Colours | One-hot across all catalogue colours | 1.0 |
| Sizes | One-hot (XS, S, M, L, XL, XXL) | 0.5 |
| Price | Normalised 0–1 by max catalogue price | 0.5 |

```
similarity % = (1 − cosine_distance) × 100
```

#### Output
Top-k products (default k=5) with similarity percentage. Used on `ProductDetailPage` to show "You may also like" recommendations.

---

## 7. API Endpoints

Base URL: `http://localhost:8000`

### Authentication
| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, name, mobile_number, birthday}` | Register new user |
| POST | `/api/auth/login` | `{email, password}` | User login |
| POST | `/api/auth/admin/login` | `{email, password}` | Admin login |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List all products |
| GET | `/api/products/{id}` | Get single product by ID |
| POST | `/api/products` | Create product (admin) |
| PUT | `/api/products/{id}` | Update product (admin) |
| DELETE | `/api/products/{id}` | Delete product (admin) |
| POST | `/api/admin/upload-product-image` | Upload product image file |

### Virtual Try-On
| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload/person` | Upload + preprocess person image (pose, parse, agnostic) |
| POST | `/upload/cloth` | Upload garment image |
| POST | `/upload/cloth-from-static` | Use a product's static URL as the cloth |
| POST | `/preprocess/cloth-mask` | Generate GrabCut binary mask for cloth |
| POST | `/run?person_name={id}` | Run VITON-HD inference → returns result image |
| GET | `/persons` | List all preprocessed person images |
| GET | `/person-image/{name}` | Serve person image |
| GET | `/cloth-image/{name}` | Serve cloth image |
| GET | `/result/{job}/{filename}` | Serve synthesised result image |
| GET | `/results` | List all result directories |

### Debug Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/debug/cloth-mask` | View current cloth mask |
| GET | `/debug/agnostic/{person_id}` | View torso-erased person image |
| GET | `/debug/parse/{person_id}` | View colourised human parsing map |
| GET | `/debug/pose/{person_id}` | View rendered pose skeleton |

### Recommendations
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/recommendations?product_id={id}&top_k={k}` | KNN similar products |
| GET | `/api/recommendations/popular?top_k={k}` | Popular products by category |
| POST | `/api/recommend/by-body` | Body profile → ML outfit recommendations |
| GET | `/api/recommend/model-status` | Check if ML models are loaded |

**Body recommendation request body:**
```json
{
  "height": 170,
  "weight": 65,
  "gender": "female",
  "skin_tone": "medium"
}
```

### Orders
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/orders` | Place a new order |
| GET | `/api/user/{user_id}/orders` | Get a user's order history |
| GET | `/api/admin/orders` | Get all orders (admin) |

### User Profile
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/user/{user_id}/profile` | Get user profile + body measurements |
| PUT | `/api/user/{user_id}/profile` | Update personal information |
| PUT | `/api/user/{user_id}/body-profile` | Update body measurements |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List all registered users |
| DELETE | `/api/admin/users/{user_id}` | Delete a user |
| GET | `/api/admin/tryon-results` | All try-on results |
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/products/sales` | Sales by product |

---

## 8. Database Schema

SQLite database: `backend/toplable.db` — 7 tables

```
Users              Products               Orders
─────────────      ────────────────────   ────────────
user_id (PK)       product_id (PK)        order_id (PK)
name               name                   user_id_fk
email (UNIQUE)     category               items (JSON)
password_hash      price                  subtotal
mobile_number      description            shipping
birthday           image_url              discount
created_at         image_gallery (JSON)   total
                   colors (JSON)          status
Admins             sizes (JSON)           address (JSON)
──────────         stock                  created_at
admin_id (PK)      size_stock (JSON)
email (UNIQUE)     color_images (JSON)    TryOnResults
password_hash      created_by_admin_fk    ────────────────
name                                      result_id (PK)
created_at         UserBodyProfile        user_id_fk
                   ───────────────────    product_id_fk
ProductViews       profile_id (PK)        person_image_path
────────────────   user_id_fk (UNIQUE)    output_image_path
view_id (PK)       height                 status
user_id_fk         weight                 error_message
product_id_fk      gender                 created_at
viewed_at          skin_tone
                   body_type
                   chest / waist / hips
                   preferred_style
                   updated_at
```

---

## 9. Getting Started

### Prerequisites

- **Node.js** v16+ and npm
- **Python** 3.8+
- **Git** + **Git LFS** (model weights are stored in LFS)
- 16 GB RAM recommended (8 GB minimum)
- Optional: CUDA-enabled GPU (dramatically speeds up VITON-HD inference)

### 1. Clone the Repository

```bash
git clone https://github.com/Thamindu3/Final-Year-Project--TOPLABLE-.git
cd Final-Year-Project--TOPLABLE-
git lfs pull       # Download .pkl and .pth model weights
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive API docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The app will open at `http://localhost:3000`.

### 4. Train ML Recommendation Models (Optional)

If `backend/models/style_model.pkl` and `color_model.pkl` are not present:

```bash
# From project root
run_training_and_eval.bat

# Or manually:
cd backend
python recommendation/generate_dataset.py   # Creates 100k training samples
python recommendation/train_model.py        # Trains and saves .pkl models
```

Training takes approximately **3–5 minutes** on CPU for both models.

### 5. Using the Virtual Try-On

1. Navigate to `http://localhost:3000/virtual-tryon`
2. Upload a **full-body person photo** (good lighting, simple background, front-facing)
3. Select or upload a **garment image**
4. Click **Generate Try-On**
5. Wait 30–90 seconds (CPU) or 5–15 seconds (GPU) for the result

**For best results:**
- Person photo: good lighting, full body visible, simple background, front-facing
- Garment image: white or plain background, clear product shot

---

## 10. Model Accuracy & Evaluation

### ML Recommendation Models

Evaluated on a held-out test set of **20,000 samples** and 5-fold cross-validation.

#### Style Model (HistGradientBoosting)

| Class | Precision | Recall | F1 |
|---|---|---|---|
| Athletic_Build | ~0.93 | ~0.93 | ~0.93 |
| Average_Fit | ~0.93 | ~0.92 | ~0.92 |
| Curvy_Chic | ~0.92 | ~0.92 | ~0.92 |
| Plus_Comfort | ~0.93 | ~0.93 | ~0.93 |
| Slim_Fit | ~0.93 | ~0.93 | ~0.93 |
| **Overall** | **92.82%** | **92.83%** | **92.82%** |

5-Fold CV: **93.05% ± 0.023%** | ROC-AUC: **0.9945**

#### Colour Model (RandomForest, 100 trees)

| Class | Precision | Recall | F1 |
|---|---|---|---|
| Bold_Brights | ~0.96 | ~0.96 | ~0.96 |
| Earth_Tones | ~0.96 | ~0.96 | ~0.96 |
| Jewel_Tones | ~0.96 | ~0.96 | ~0.96 |
| Muted_Pastels | ~0.95 | ~0.95 | ~0.95 |
| Neutral_Classic | ~0.96 | ~0.96 | ~0.96 |
| **Overall** | **95.79%** | **95.79%** | **95.78%** |

5-Fold CV: **96.05% ± 0.054%** | ROC-AUC: **0.9719**

### VITON-HD Try-On Quality (evaluate_metrics.py)

The VITON-HD model is evaluated using the **paired test protocol** (the person is reconstructed wearing their own original garment, and the output is compared to the real person image):

| Metric | Description | Target |
|---|---|---|
| **SSIM** | Structural Similarity Index — perceptual quality | Higher = better (max 1.0) |
| **PSNR** | Peak Signal-to-Noise Ratio — pixel-level fidelity (dB) | Higher = better |
| **LPIPS** | Learned Perceptual Image Patch Similarity — deep feature distance | Lower = better |
| **FID** | Fréchet Inception Distance — output vs. real image distributions | Lower = better |

Run evaluation:

```bash
cd viton-hd
python evaluate_metrics.py
# Results saved to evaluation_results/viton_metrics_report.json
```

The pre-trained VITON-HD checkpoints (`seg_final.pth`, `gmm_final.pth`, `alias_final.pth`) were trained on **11,647 paired images** from the VITON-HD dataset and evaluated on **2,032 test pairs**.

---

## 11. Screenshots

| Page | Description |
|---|---|
| Homepage | "Wear it before you buy it" hero with feature sections |
| Products Page | Grid catalogue with category filters and search |
| Virtual Try-On | Two-panel upload interface with result display |
| Body Recommend | Measurement form with style + colour palette output |
| Login / Register | Sign in and account creation with validation |
| Admin Dashboard | Product management, user list, order overview |

---

## Acknowledgements

- **VITON-HD** model and architecture: [VITON-HD: High-Resolution Virtual Try-On via Misalignment-Aware Normalization](https://arxiv.org/abs/2010.09095) (Choi et al., 2021)
- **SegFormer B2 Clothes** segmentation model: [mattmdjaga/segformer_b2_clothes](https://huggingface.co/mattmdjaga/segformer_b2_clothes) on HuggingFace
- **MediaPipe** pose estimation: Google
- **scikit-learn** ML library

---

## License

This project is developed as an academic prototype for PUSL3190 Computing Project at the University of Plymouth. All third-party models and libraries are used under their respective open-source licences.
