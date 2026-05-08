import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';

interface PersonImage {
  id: string;
  filename: string;
  url: string;
  size?: number;
}

const VirtualTryOnPage: React.FC = () => {
  const [persons, setPersons] = useState<PersonImage[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<PersonImage | null>(null);
  const [clothFile, setClothFile] = useState<File | null>(null);
  const [clothPreview, setClothPreview] = useState<string>('');
  const [personPreview, setPersonPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [resultImage, setResultImage] = useState<string>('');
  const [personImageUrl, setPersonImageUrl] = useState<string>('');
  const [clothImageUrl, setClothImageUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [uploadingPerson, setUploadingPerson] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadedPersonId, setUploadedPersonId] = useState<string | null>(null);
  const [clothDragOver, setClothDragOver] = useState(false);
  const [personDragOver, setPersonDragOver] = useState(false);

  const clothInputRef = useRef<HTMLInputElement>(null);
  const personUploadRef = useRef<HTMLInputElement>(null);
  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => { loadPersonImages(); }, []);

  const loadPersonImages = async () => {
    setLoadingPersons(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/persons`, { timeout: 10000 });
      if (resp.data.persons?.length) setPersons(resp.data.persons);
    } catch (_) {}
    finally { setLoadingPersons(false); }
  };

  const handlePersonSelect = (p: PersonImage) => {
    setSelectedPerson(p);
    setPersonPreview(`${API_BASE_URL}${p.url}`);
    setUploadedPersonId(null);
    setError('');
    setResultImage('');
  };

  const handlePersonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processPersonFile(file);
  };

  const processPersonFile = async (file: File) => {
    setUploadingPerson(true);
    setUploadProgress('Uploading your photo...');
    setError('');
    setResultImage('');
    try {
      const form = new FormData();
      form.append('file', file);
      setUploadProgress('Processing your photo (30–60 s)...');
      const resp = await axios.post(`${API_BASE_URL}/upload/person`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (ev) => {
          const pct = Math.round((ev.loaded * 100) / (ev.total || 1));
          setUploadProgress(pct < 100 ? `Uploading: ${pct}%` : 'Running AI preprocessing...');
        },
      });
      if (resp.data.status === 'success') {
        const pers: PersonImage = {
          id: resp.data.person_id,
          filename: resp.data.filename,
          url: resp.data.preview_url,
        };
        setUploadedPersonId(resp.data.person_id);
        setSelectedPerson(pers);
        setPersonPreview(`${API_BASE_URL}${resp.data.preview_url}`);
        setUploadProgress('Photo processed successfully!');
        setTimeout(() => { setUploadProgress(''); setUploadingPerson(false); }, 3000);
      } else throw new Error('Upload failed');
    } catch (e: any) {
      let msg = 'Failed to process your photo. ';
      if (e.code === 'ECONNABORTED') msg += 'Processing timed out.';
      else if (e.response?.status === 500) msg += e.response.data?.detail || 'Server error.';
      else if (e.response?.status === 400) msg += e.response.data?.detail || 'Invalid image.';
      else if (e.request) msg += 'Cannot connect to backend.';
      else msg += e.message;
      setError(msg);
      setUploadingPerson(false);
      setUploadProgress('');
    }
  };

  const handleClothSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setClothFile(f);
    const r = new FileReader();
    r.onloadend = () => setClothPreview(r.result as string);
    r.readAsDataURL(f);
    setError('');
    setResultImage('');
  };

  const handleClothDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setClothDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setClothFile(f);
    const r = new FileReader();
    r.onloadend = () => setClothPreview(r.result as string);
    r.readAsDataURL(f);
    setError('');
    setResultImage('');
  };

  const handlePersonDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setPersonDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await processPersonFile(f);
  };

  const handleGenerate = async () => {
    if (!selectedPerson || !clothFile) {
      setError('Please select a person and upload a clothing image');
      return;
    }
    setLoading(true);
    setError('');
    setResultImage('');
    setPersonImageUrl('');
    setClothImageUrl('');
    setProgress('Uploading clothing...');
    try {
      const fm = new FormData();
      fm.append('file', clothFile);
      await axios.post(`${API_BASE_URL}/upload/cloth`, fm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setProgress('Generating cloth mask...');
      try { await axios.post(`${API_BASE_URL}/preprocess/cloth-mask`, {}, { timeout: 30000 }); } catch (_) {}
      setProgress('Running AI try-on (30–60 seconds)...');
      const resp = await axios.post(`${API_BASE_URL}/run`, {}, {
        params: { person_name: selectedPerson.filename },
        timeout: 150000,
      });
      if (resp.data.status === 'success') {
        setResultImage(`${API_BASE_URL}${resp.data.view_url}`);
        setPersonImageUrl(`${API_BASE_URL}${resp.data.person_url}`);
        setClothImageUrl(`${API_BASE_URL}${resp.data.cloth_url}`);
        setProgress('Complete!');

        // save result to DB if user is logged in
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            const userId = user?.user_id ?? user?.userId ?? user?.id;
            if (userId) {
              await axios.post(`${API_BASE_URL}/api/tryon/save`, {
                user_id: userId,
                output_image_path: resp.data.view_url,
                person_image_path: resp.data.person_url,
                cloth_image_path: resp.data.cloth_url,
              });
            }
          } catch (_) {}
        }
      } else throw new Error(resp.data.error || 'Inference failed');
    } catch (e: any) {
      let msg = 'Failed to generate try-on. ';
      if (e.code === 'ECONNABORTED') msg += 'Request timed out.';
      else if (e.response?.status === 500) msg += 'Backend processing error.';
      else if (e.response?.status === 400) msg += e.response.data?.detail || 'Invalid request.';
      else if (e.request) msg += 'Cannot connect to backend.';
      else msg += e.message;
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleReset = () => {
    setSelectedPerson(null);
    setClothFile(null);
    setClothPreview('');
    setResultImage('');
    setPersonImageUrl('');
    setClothImageUrl('');
    setError('');
    setProgress('');
    setUploadedPersonId(null);
    setUploadProgress('');
    if (clothInputRef.current) clothInputRef.current.value = '';
    if (personUploadRef.current) personUploadRef.current.value = '';
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `tryon-${Date.now()}.jpg`;
    a.click();
  };

  const activeStep = !selectedPerson ? 1 : !clothFile ? 2 : 3;

  return (
    <div className="vto-root">
      <style>{CSS}</style>
      <Navbar />

      {/* ── HERO ── */}
      <section className="vto-hero">
        <div className="vto-hero-badge">AI-Powered</div>
        <h1 className="vto-hero-title">Virtual <span>Try-On</span></h1>
        <p className="vto-hero-sub">
          See any garment on you before you buy. Upload your photo, pick clothing, and let the AI do the rest.
        </p>

        {/* Step progress pills */}
        <div className="vto-steps">
          {['Choose Model', 'Pick Clothing', 'Generate'].map((label, i) => (
            <React.Fragment key={i}>
              <div className={`vto-step-pill ${activeStep === i + 1 ? 'active' : activeStep > i + 1 ? 'done' : ''}`}>
                <span className="vto-step-num">{activeStep > i + 1 ? '✓' : i + 1}</span>
                <span className="vto-step-label">{label}</span>
              </div>
              {i < 2 && <div className={`vto-step-line ${activeStep > i + 1 ? 'done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── ERROR ── */}
      {error && (
        <div className="vto-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7.5" stroke="#ef4444" />
            <path d="M8 4.5v4M8 10.5v1" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}

      <main className="vto-main">
        {/* ── TWO-COLUMN SETUP ── */}
        <div className="vto-setup-grid">

          {/* LEFT: person selection */}
          <div className="vto-card">
            <div className="vto-card-header">
              <span className="vto-card-step">Step 1</span>
              <h2 className="vto-card-title">Choose a Model</h2>
              <p className="vto-card-desc">Upload your photo or pick a pre-loaded model below.</p>
            </div>

            {/* Upload zone */}
            <div
              className={`vto-dropzone ${personDragOver ? 'drag' : ''} ${personPreview ? 'has-preview' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setPersonDragOver(true); }}
              onDragLeave={() => setPersonDragOver(false)}
              onDrop={handlePersonDrop}
              onClick={() => !uploadingPerson && personUploadRef.current?.click()}
            >
              <input ref={personUploadRef} type="file" accept="image/*" onChange={handlePersonUpload} style={{ display: 'none' }} />
              {personPreview ? (
                <div className="vto-preview-wrap">
                  <img src={personPreview} alt="Selected model" className="vto-preview-img" />
                  <div className="vto-preview-overlay">
                    <span>Change Photo</span>
                  </div>
                </div>
              ) : (
                <div className="vto-dropzone-inner">
                  <div className="vto-upload-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="vto-dropzone-title">{uploadingPerson ? 'Processing…' : 'Upload Your Photo'}</p>
                  <p className="vto-dropzone-hint">Drag & drop or click to browse</p>
                </div>
              )}
              {uploadProgress && <div className="vto-upload-progress">{uploadProgress}</div>}
            </div>

            {uploadedPersonId && (
              <div className="vto-success-badge">
                <span className="vto-success-dot" /> Photo ready: {uploadedPersonId}
              </div>
            )}

            <div className="vto-tips">
              <p className="vto-tips-title">Photo tips</p>
              <ul>
                <li>Full body, head to feet in frame</li>
                <li>Arms at your sides, front-facing</li>
                <li>Plain background, good lighting</li>
                <li>JPEG or PNG</li>
              </ul>
            </div>

            {/* Model grid */}
            <div className="vto-model-section">
              <p className="vto-model-label">
                Or choose a pre-loaded model
                {persons.length > 0 && <span className="vto-model-count"> · {persons.length} available</span>}
              </p>
              {loadingPersons ? (
                <div className="vto-skeleton-grid">
                  {[...Array(6)].map((_, i) => <div key={i} className="vto-skeleton" />)}
                </div>
              ) : persons.length === 0 ? (
                <p className="vto-empty">No pre-loaded models found.</p>
              ) : (
                <div className="vto-model-grid">
                  {persons.map((person) => {
                    const isSelected = selectedPerson?.filename === person.filename && !uploadedPersonId;
                    return (
                      <button
                        key={person.id || person.filename}
                        onClick={() => handlePersonSelect(person)}
                        className={`vto-model-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div
                          className="vto-model-img"
                          style={{ backgroundImage: `url(${API_BASE_URL}${person.url})` }}
                        />
                        {isSelected && <div className="vto-model-check">✓</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: clothing + generate */}
          <div className="vto-right-col">
            {/* Clothing card */}
            <div className="vto-card">
              <div className="vto-card-header">
                <span className="vto-card-step">Step 2</span>
                <h2 className="vto-card-title">Pick Clothing</h2>
                <p className="vto-card-desc">Upload a flat-lay or product image of the garment.</p>
              </div>

              <div
                className={`vto-dropzone ${clothDragOver ? 'drag' : ''} ${clothPreview ? 'has-preview' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setClothDragOver(true); }}
                onDragLeave={() => setClothDragOver(false)}
                onDrop={handleClothDrop}
                onClick={() => clothInputRef.current?.click()}
              >
                <input ref={clothInputRef} type="file" accept="image/*" onChange={handleClothSelect} style={{ display: 'none' }} />
                {clothPreview ? (
                  <div className="vto-preview-wrap">
                    <img src={clothPreview} alt="Clothing" className="vto-preview-img vto-preview-contain" />
                    <div className="vto-preview-overlay"><span>Change Clothing</span></div>
                  </div>
                ) : (
                  <div className="vto-dropzone-inner">
                    <div className="vto-upload-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 21V9" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="vto-dropzone-title">Upload Clothing</p>
                    <p className="vto-dropzone-hint">Drag & drop or click to browse</p>
                  </div>
                )}
              </div>
            </div>

            {/* Generate card */}
            <div className="vto-card vto-generate-card">
              <div className="vto-card-header">
                <span className="vto-card-step">Step 3</span>
                <h2 className="vto-card-title">Generate</h2>
              </div>

              <div className="vto-readiness">
                <div className={`vto-ready-item ${selectedPerson ? 'done' : ''}`}>
                  <span className="vto-ready-dot" />
                  {selectedPerson ? 'Model selected' : 'No model selected'}
                </div>
                <div className={`vto-ready-item ${clothFile ? 'done' : ''}`}>
                  <span className="vto-ready-dot" />
                  {clothFile ? 'Clothing ready' : 'No clothing selected'}
                </div>
              </div>

              {progress && progress !== 'Complete!' && (
                <div className="vto-progress-bar-wrap">
                  <div className="vto-progress-track">
                    <div className="vto-progress-fill" />
                  </div>
                  <p className="vto-progress-text">{progress}</p>
                </div>
              )}

              <div className="vto-action-row">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedPerson || !clothFile || loading}
                  className="vto-btn-generate"
                >
                  {loading ? (
                    <><span className="vto-spinner" /> Generating…</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                      Generate Try-On
                    </>
                  )}
                </button>
                <button onClick={handleReset} className="vto-btn-reset">Reset</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RESULT ── */}
        {resultImage && (
          <section className="vto-result">
            <div className="vto-result-header">
              <span className="vto-card-step">Result</span>
              <h2 className="vto-card-title">Your Virtual Try-On</h2>
            </div>
            <div className="vto-result-grid">
              {[
                { label: 'Original Model', src: personImageUrl },
                { label: 'Clothing', src: clothImageUrl },
                { label: 'Try-On Result', src: resultImage, highlight: true },
              ].map(({ label, src, highlight }) => (
                <div key={label} className={`vto-result-card ${highlight ? 'highlight' : ''}`}>
                  <p className="vto-result-label">{label}</p>
                  <div className="vto-result-img-wrap">
                    {src ? (
                      <img src={src} alt={label} className="vto-result-img" />
                    ) : (
                      <div className="vto-result-placeholder">Loading…</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="vto-result-actions">
              <button onClick={handleDownload} className="vto-btn-download">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Result
              </button>
            </div>
          </section>
        )}

        {/* ── FEATURES ── */}
        <section className="vto-features">
          {[
            { icon: '✦', title: 'AI-Powered', desc: 'VITON-HD technology for photorealistic results' },
            { icon: '⬆', title: 'Your Photos', desc: 'Upload any photo with automatic preprocessing' },
            { icon: '⚡', title: 'Fast Results', desc: 'Results delivered in under 2 minutes' },
            { icon: '◈', title: 'High Quality', desc: 'Accurate details, true-to-life color rendering' },
          ].map((f, i) => (
            <div key={i} className="vto-feature">
              <span className="vto-feature-icon">{f.icon}</span>
              <h3 className="vto-feature-title">{f.title}</h3>
              <p className="vto-feature-desc">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

/* ─── CSS ──────────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── KEYFRAMES ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes shimmer { to { background-position: -200% 0; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes progressPulse { from { width: 20%; } to { width: 85%; } }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  @keyframes iconFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(201,169,110,0); }
    50% { box-shadow: 0 0 0 6px rgba(201,169,110,0.15); }
  }

  .vto-root {
    font-family: 'Inter', sans-serif;
    background: #0f0f11;
    color: #e8e4de;
    min-height: 100vh;
  }

  /* ── HERO ── */
  .vto-hero {
    padding: 100px 48px 72px;
    text-align: center;
    background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,169,110,0.12) 0%, transparent 70%),
                linear-gradient(180deg, #16141a 0%, #0f0f11 100%);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: relative;
    overflow: hidden;
  }
  .vto-hero-badge {
    display: inline-block;
    padding: 6px 16px;
    border-radius: 100px;
    border: 1px solid rgba(201,169,110,0.4);
    color: #c9a96e;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 28px;
    background: rgba(201,169,110,0.06);
    animation: fadeUp 0.6s ease both;
    animation-delay: 0.1s;
  }
  .vto-hero-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(52px, 8vw, 88px);
    font-weight: 300;
    line-height: 1;
    color: #fff;
    margin-bottom: 20px;
    animation: fadeUp 0.7s ease both;
    animation-delay: 0.2s;
  }
  .vto-hero-title span {
    font-style: italic;
    color: #c9a96e;
  }
  .vto-hero-sub {
    font-size: 14px;
    font-weight: 300;
    color: #8b8580;
    max-width: 500px;
    margin: 0 auto 48px;
    line-height: 1.8;
    animation: fadeUp 0.7s ease both;
    animation-delay: 0.35s;
  }

  /* ── STEP PILLS ── */
  .vto-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    flex-wrap: wrap;
    row-gap: 12px;
    animation: fadeUp 0.7s ease both;
    animation-delay: 0.5s;
  }
  .vto-step-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    font-size: 12px;
    color: #5a5660;
    transition: border-color 0.35s ease, background 0.35s ease, color 0.35s ease, transform 0.2s ease;
  }
  .vto-step-pill.active {
    border-color: rgba(201,169,110,0.5);
    background: rgba(201,169,110,0.1);
    color: #c9a96e;
  }
  .vto-step-pill.done {
    border-color: rgba(74,222,128,0.4);
    background: rgba(74,222,128,0.06);
    color: #4ade80;
  }
  .vto-step-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: currentColor;
    color: #0f0f11;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  .vto-step-pill.done .vto-step-num { transform: scale(1.1); }
  .vto-step-label { font-weight: 500; letter-spacing: 0.5px; }
  .vto-step-line {
    width: 40px;
    height: 1px;
    background: rgba(255,255,255,0.08);
    margin: 0 4px;
    transition: background 0.5s ease, width 0.3s ease;
  }
  .vto-step-line.done { background: rgba(74,222,128,0.3); }

  /* ── ERROR ── */
  .vto-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 48px;
    background: rgba(239,68,68,0.08);
    border-bottom: 1px solid rgba(239,68,68,0.2);
    font-size: 13px;
    color: #f87171;
    animation: slideDown 0.35s ease both;
  }

  /* ── MAIN ── */
  .vto-main {
    max-width: 1280px;
    margin: 0 auto;
    padding: 60px 32px 100px;
  }

  /* ── SETUP GRID ── */
  .vto-setup-grid {
    display: grid;
    grid-template-columns: 1fr 420px;
    gap: 24px;
    align-items: start;
  }
  @media (max-width: 960px) {
    .vto-setup-grid { grid-template-columns: 1fr; }
  }

  /* ── CARDS ── */
  .vto-card {
    background: #16141a;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 28px;
    margin-bottom: 20px;
    animation: fadeUp 0.6s ease both;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .vto-card:hover {
    border-color: rgba(255,255,255,0.11);
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  }
  .vto-setup-grid > div:nth-child(1) .vto-card:nth-child(1) { animation-delay: 0.1s; }
  .vto-right-col .vto-card:nth-child(1) { animation-delay: 0.2s; }
  .vto-right-col .vto-card:nth-child(2) { animation-delay: 0.3s; }
  .vto-card-header { margin-bottom: 20px; }
  .vto-card-step {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #c9a96e;
    display: block;
    margin-bottom: 8px;
  }
  .vto-card-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    font-weight: 300;
    color: #fff;
    margin-bottom: 6px;
  }
  .vto-card-desc {
    font-size: 12px;
    color: #5a5660;
    line-height: 1.7;
  }

  /* ── DROPZONE ── */
  .vto-dropzone {
    border: 1.5px dashed rgba(255,255,255,0.1);
    border-radius: 14px;
    background: rgba(255,255,255,0.02);
    cursor: pointer;
    transition: border-color 0.25s ease, background 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
    overflow: hidden;
    position: relative;
    min-height: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }
  .vto-dropzone:hover {
    border-color: rgba(201,169,110,0.5);
    background: rgba(201,169,110,0.04);
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(0,0,0,0.25);
  }
  .vto-dropzone.drag {
    border-color: #c9a96e;
    background: rgba(201,169,110,0.07);
    transform: scale(1.01);
    box-shadow: 0 0 0 3px rgba(201,169,110,0.2), 0 12px 32px rgba(0,0,0,0.3);
  }
  .vto-dropzone.has-preview { min-height: 280px; border-style: solid; border-color: rgba(255,255,255,0.08); }
  .vto-dropzone.has-preview:hover { transform: none; box-shadow: none; }
  .vto-dropzone-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 32px 24px;
  }
  .vto-upload-icon {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: rgba(201,169,110,0.08);
    border: 1px solid rgba(201,169,110,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c9a96e;
    margin-bottom: 4px;
    transition: background 0.25s ease, transform 0.25s ease;
    animation: iconFloat 3s ease-in-out infinite;
  }
  .vto-dropzone:hover .vto-upload-icon {
    background: rgba(201,169,110,0.16);
    transform: scale(1.08);
    animation: none;
  }
  .vto-dropzone-title {
    font-size: 14px;
    font-weight: 500;
    color: #c8c4be;
    transition: color 0.2s ease;
  }
  .vto-dropzone:hover .vto-dropzone-title { color: #e8e4de; }
  .vto-dropzone-hint {
    font-size: 12px;
    color: #5a5660;
    transition: color 0.2s ease;
  }
  .vto-dropzone:hover .vto-dropzone-hint { color: #8b8580; }

  /* ── PREVIEW ── */
  .vto-preview-wrap {
    width: 100%;
    height: 100%;
    position: relative;
    min-height: 280px;
  }
  .vto-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
    min-height: 280px;
    transition: transform 0.4s ease;
  }
  .vto-preview-wrap:hover .vto-preview-img { transform: scale(1.03); }
  .vto-preview-contain { object-fit: contain; background: #0f0f11; }
  .vto-preview-contain:hover { transform: none; }
  .vto-preview-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.25s ease;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    letter-spacing: 1px;
    backdrop-filter: blur(2px);
  }
  .vto-preview-wrap:hover .vto-preview-overlay { opacity: 1; }
  .vto-upload-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px;
    background: rgba(201,169,110,0.9);
    color: #0f0f11;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    letter-spacing: 1px;
    animation: slideDown 0.3s ease both;
  }

  /* ── SUCCESS ── */
  .vto-success-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    background: rgba(74,222,128,0.06);
    border: 1px solid rgba(74,222,128,0.2);
    font-size: 12px;
    color: #4ade80;
    margin-bottom: 16px;
    animation: slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .vto-success-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    flex-shrink: 0;
    animation: pulse 2s ease infinite;
  }

  /* ── TIPS ── */
  .vto-tips {
    padding: 14px 18px;
    border-radius: 10px;
    background: rgba(201,169,110,0.04);
    border: 1px solid rgba(201,169,110,0.12);
    margin-bottom: 24px;
  }
  .vto-tips-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #c9a96e;
    margin-bottom: 10px;
  }
  .vto-tips ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .vto-tips li {
    font-size: 11px;
    color: #6b6560;
    padding-left: 12px;
    position: relative;
    line-height: 1.6;
  }
  .vto-tips li::before {
    content: '·';
    position: absolute;
    left: 0;
    color: #c9a96e;
  }

  /* ── MODEL SECTION ── */
  .vto-model-section { }
  .vto-model-label {
    font-size: 11px;
    font-weight: 500;
    color: #5a5660;
    letter-spacing: 1px;
    margin-bottom: 14px;
    text-transform: uppercase;
  }
  .vto-model-count { color: #3a3640; }
  .vto-model-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    max-height: 440px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .vto-model-grid::-webkit-scrollbar { width: 4px; }
  .vto-model-grid::-webkit-scrollbar-track { background: transparent; }
  .vto-model-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  .vto-model-card {
    border: 1.5px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    background: none;
    padding: 0;
    position: relative;
    transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    aspect-ratio: 2/3;
  }
  .vto-model-card:hover {
    border-color: rgba(201,169,110,0.4);
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 10px 28px rgba(0,0,0,0.4);
  }
  .vto-model-card.selected {
    border-color: #c9a96e;
    box-shadow: 0 0 0 2px rgba(201,169,110,0.3);
    animation: glowPulse 2.5s ease infinite;
  }
  .vto-model-img {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: top center;
    transition: transform 0.4s ease;
  }
  .vto-model-card:hover .vto-model-img { transform: scale(1.05); }
  .vto-model-check {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #c9a96e;
    color: #0f0f11;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .vto-skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
  .vto-skeleton {
    aspect-ratio: 2/3;
    border-radius: 12px;
    background: linear-gradient(90deg, #1e1c22 25%, #252330 50%, #1e1c22 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer { to { background-position: -200% 0; } }
  .vto-empty { font-size: 13px; color: #5a5660; }

  /* ── RIGHT COLUMN ── */
  .vto-right-col { position: sticky; top: 24px; }

  /* ── GENERATE CARD ── */
  .vto-generate-card { }
  .vto-readiness {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }
  .vto-ready-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #5a5660;
    transition: color 0.4s ease;
  }
  .vto-ready-item.done { color: #4ade80; }
  .vto-ready-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.4s ease;
  }
  .vto-ready-item.done .vto-ready-dot {
    transform: scale(1.2);
    animation: pulse 2s ease infinite;
  }

  /* ── PROGRESS ── */
  .vto-progress-bar-wrap { margin-bottom: 20px; }
  .vto-progress-track {
    height: 3px;
    border-radius: 2px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
    margin-bottom: 8px;
  }
  .vto-progress-fill {
    height: 100%;
    width: 60%;
    border-radius: 2px;
    background: linear-gradient(90deg, #c9a96e, #e2c07a);
    animation: progressPulse 1.5s ease-in-out infinite alternate;
  }
  @keyframes progressPulse { from { width: 20%; } to { width: 85%; } }
  .vto-progress-text { font-size: 11px; color: #c9a96e; font-weight: 500; }

  /* ── ACTION BUTTONS ── */
  .vto-action-row { display: flex; gap: 12px; }
  .vto-btn-generate {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #c9a96e 0%, #d4b87a 100%);
    color: #0f0f11;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.25s ease, opacity 0.2s ease;
    letter-spacing: 0.3px;
    position: relative;
    overflow: hidden;
  }
  .vto-btn-generate::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0);
    transition: background 0.2s ease;
  }
  .vto-btn-generate:hover:not(:disabled)::after { background: rgba(255,255,255,0.08); }
  .vto-btn-generate:active:not(:disabled) { transform: translateY(1px) scale(0.98); }
  .vto-btn-generate:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(201,169,110,0.4);
  }
  .vto-btn-generate:disabled {
    background: rgba(255,255,255,0.06);
    color: #3a3640;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .vto-btn-reset {
    padding: 14px 20px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: #5a5660;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
  }
  .vto-btn-reset:hover { background: rgba(255,255,255,0.06); color: #8b8580; border-color: rgba(255,255,255,0.14); }
  .vto-btn-reset:active { transform: scale(0.97); }

  /* ── SPINNER ── */
  .vto-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: #0f0f11;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── RESULT ── */
  .vto-result {
    margin-top: 60px;
    padding-top: 60px;
    border-top: 1px solid rgba(255,255,255,0.06);
    animation: fadeUp 0.6s ease both;
  }
  .vto-result-header { margin-bottom: 32px; }
  .vto-result-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 32px;
  }
  @media (max-width: 768px) { .vto-result-grid { grid-template-columns: 1fr; } }
  .vto-result-card {
    border-radius: 16px;
    background: #16141a;
    border: 1px solid rgba(255,255,255,0.07);
    overflow: hidden;
    animation: fadeUp 0.5s ease both;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .vto-result-grid > *:nth-child(1) { animation-delay: 0.05s; }
  .vto-result-grid > *:nth-child(2) { animation-delay: 0.15s; }
  .vto-result-grid > *:nth-child(3) { animation-delay: 0.25s; }
  .vto-result-card:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,0.35); }
  .vto-result-card.highlight {
    border-color: rgba(201,169,110,0.35);
    box-shadow: 0 0 0 1px rgba(201,169,110,0.1), 0 16px 40px rgba(0,0,0,0.4);
  }
  .vto-result-card.highlight:hover { box-shadow: 0 0 0 1px rgba(201,169,110,0.2), 0 20px 50px rgba(0,0,0,0.5); }
  .vto-result-label {
    padding: 14px 16px 12px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #5a5660;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .vto-result-card.highlight .vto-result-label { color: #c9a96e; }
  .vto-result-img-wrap {
    height: 480px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f0f11;
    overflow: hidden;
  }
  .vto-result-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.4s ease;
  }
  .vto-result-card:hover .vto-result-img { transform: scale(1.02); }
  .vto-result-placeholder {
    font-size: 12px;
    color: #3a3640;
    animation: pulse 1.5s ease infinite;
  }
  .vto-result-actions {
    text-align: center;
    animation: fadeUp 0.5s ease both;
    animation-delay: 0.35s;
  }
  .vto-btn-download {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    border-radius: 12px;
    border: 1px solid rgba(201,169,110,0.3);
    background: rgba(201,169,110,0.06);
    color: #c9a96e;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }
  .vto-btn-download:hover {
    background: rgba(201,169,110,0.12);
    border-color: rgba(201,169,110,0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(201,169,110,0.2);
  }
  .vto-btn-download:active { transform: translateY(0) scale(0.98); }

  /* ── FEATURES ── */
  .vto-features {
    margin-top: 80px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 20px;
    overflow: hidden;
    animation: fadeUp 0.6s ease both;
    animation-delay: 0.2s;
  }
  @media (max-width: 768px) { .vto-features { grid-template-columns: repeat(2, 1fr); } }
  .vto-feature {
    padding: 40px 28px;
    background: #16141a;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    transition: background 0.25s ease, transform 0.25s ease;
    cursor: default;
  }
  .vto-feature:hover { background: #1c1a22; transform: translateY(-2px); }
  .vto-feature-icon {
    font-size: 22px;
    color: #c9a96e;
    margin-bottom: 4px;
    display: block;
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  .vto-feature:hover .vto-feature-icon { transform: scale(1.25) rotate(-5deg); }
  .vto-feature-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px;
    font-weight: 400;
    color: #e8e4de;
    transition: color 0.2s ease;
  }
  .vto-feature:hover .vto-feature-title { color: #fff; }
  .vto-feature-desc {
    font-size: 12px;
    font-weight: 300;
    color: #5a5660;
    line-height: 1.7;
    transition: color 0.2s ease;
  }
  .vto-feature:hover .vto-feature-desc { color: #8b8580; }

  /* ── NAV OVERRIDES ── */
  .tryon-nav-recs-btn {
    transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease, color 0.25s ease !important;
  }
  .tryon-nav-recs-btn:hover {
    border-color: #c9a96e !important;
    background: rgba(201,169,110,0.15) !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(201,169,110,0.3);
    color: #c9a96e !important;
  }
  .tryon-nav-login-btn {
    transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease !important;
  }
  .tryon-nav-login-btn:hover {
    border-color: #c9a96e !important;
    background: rgba(201,169,110,0.15) !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(201,169,110,0.3);
  }
  @media (max-width: 640px) {
    .tryon-nav-recs-text { display: none; }
    .tryon-nav-recs-btn  { padding: 9px 12px !important; }
    .vto-hero { padding: 80px 24px 56px; }
    .vto-main { padding: 40px 16px 80px; }
  }
`;

export default VirtualTryOnPage;
