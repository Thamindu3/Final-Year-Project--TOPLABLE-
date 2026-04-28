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
  // Pre-loaded models
  const [persons, setPersons] = useState<PersonImage[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(true);

  // Selected person (either uploaded or pre-loaded)
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

  const clothInputRef = useRef<HTMLInputElement>(null);
  const personUploadRef = useRef<HTMLInputElement>(null);
  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => { loadPersonImages(); }, []);

  const loadPersonImages = async () => {
    setLoadingPersons(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/persons`, { timeout: 10000 });
      if (resp.data.persons?.length) {
        setPersons(resp.data.persons);
      }
    } catch (_) {
      // silently fail — user can still upload their own photo
    } finally {
      setLoadingPersons(false);
    }
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

    setUploadingPerson(true);
    setUploadProgress('Uploading your photo...');
    setError('');
    setResultImage('');

    try {
      const form = new FormData();
      form.append('file', file);
      setUploadProgress('Processing your photo (30-60 s)...');

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
        setTimeout(() => {
          setUploadProgress('');
          setUploadingPerson(false);
        }, 3000);
      } else {
        throw new Error('Upload failed');
      }
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
      try {
        await axios.post(`${API_BASE_URL}/preprocess/cloth-mask`, {}, { timeout: 30000 });
      } catch (_) {}

      setProgress('Running AI try-on (this may take 30-60 seconds)...');
      const resp = await axios.post(
        `${API_BASE_URL}/run`,
        {},
        {
          params: { person_name: selectedPerson.filename },
          timeout: 150000,
        }
      );

      if (resp.data.status === 'success') {
        setResultImage(`${API_BASE_URL}${resp.data.view_url}`);
        setPersonImageUrl(`${API_BASE_URL}${resp.data.person_url}`);
        setClothImageUrl(`${API_BASE_URL}${resp.data.cloth_url}`);
        setProgress('Complete!');
      } else {
        throw new Error(resp.data.error || 'Inference failed');
      }
    } catch (e: any) {
      let msg = 'Failed to generate try-on. ';
      if (e.code === 'ECONNABORTED') msg += 'Request timed out.';
      else if (e.response?.status === 500) msg += 'Backend processing error.';
      else if (e.response?.status === 400) msg += e.response.data?.detail || 'Invalid request.';
      else if (e.request) msg += 'Cannot connect to backend.';
      else msg += e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
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

  return (
    <div style={wrapperStyle}>
      <style>{fonts + dynamicCSS}</style>

      <Navbar />

      {/* ── HERO HEADER ── */}
      <header style={heroStyle}>
        <div style={heroInnerStyle}>
          <p style={heroOverlineStyle}>AI-Powered Experience</p>
          <h1 style={heroTitleStyle}>
            Virtual
            <br />
            <em>Try-On</em>
          </h1>
          <p style={heroSubtitleStyle}>
            See how any garment looks on you before making a purchase. Upload your photo or choose
            a model, then select clothing to visualize the perfect fit.
          </p>
        </div>
      </header>

      {/* ── DIVIDER ── */}
      <div style={dividerStyle} />

      {/* ── ERROR BANNER ── */}
      {error && (
        <div style={errorBannerStyle}>
          <span style={errorDotStyle} />
          <p style={errorTextStyle}>{error}</p>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main style={mainStyle}>
        {/* STEP 1: Upload Your Photo */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <p style={sectionOverlineStyle}>Step 1</p>
            <h2 style={sectionTitleStyle}>
              Upload Your
              <br />
              <em>Photo</em>
            </h2>
          </div>

          <div style={uploadBoxStyle}>
            <input
              ref={personUploadRef}
              type="file"
              accept="image/*"
              onChange={handlePersonUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => personUploadRef.current?.click()}
              disabled={uploadingPerson}
              style={{
                ...uploadBtnStyle,
                ...(uploadingPerson ? uploadBtnDisabledStyle : {}),
              }}
              onMouseEnter={(e) => {
                if (!uploadingPerson) {
                  e.currentTarget.style.background = '#c9a96e';
                  e.currentTarget.style.borderColor = '#c9a96e';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!uploadingPerson) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = '#1a1a1a';
                  e.currentTarget.style.color = '#1a1a1a';
                }
              }}
            >
              {uploadingPerson ? 'Processing...' : 'Choose File'}
            </button>

            {uploadProgress && <p style={uploadProgressTextStyle}>{uploadProgress}</p>}

            {uploadedPersonId && (
              <div style={successBadgeStyle}>
                <span style={successDotStyle} />
                <p style={successTextStyle}>Photo processed: {uploadedPersonId}</p>
              </div>
            )}

            {personPreview && (
              <div style={personPreviewWrapStyle}>
                <img src={personPreview} alt="Your uploaded person" style={clothPreviewImgStyle} />
              </div>
            )}

            {/* Photo tips */}
            <div style={photoTipsStyle}>
              <p style={photoTipsTitleStyle}>For best results:</p>
              <ul style={photoTipsListStyle}>
                <li>Full body visible — head to feet in frame</li>
                <li>Stand straight, arms at your sides (not crossed)</li>
                <li>Plain, solid-color background (not transparent)</li>
                <li>Good lighting, front-facing</li>
                <li>JPEG or PNG — no transparent backgrounds</li>
              </ul>
            </div>
          </div>
        </section>

        {/* STEP 2: Choose a Pre-loaded Model */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <p style={sectionOverlineStyle}>Step 2 — Alternative</p>
            <h2 style={sectionTitleStyle}>
              Choose a
              <br />
              <em>Pre-loaded Model</em>
            </h2>
            {persons.length > 0 && (
              <p style={modelCountStyle}>{persons.length} Models Available</p>
            )}
          </div>

          {loadingPersons ? (
            <div style={loadingBoxStyle}>
              <div style={loadingBarStyle} />
              <p style={loadingTextStyle}>Loading models...</p>
            </div>
          ) : persons.length === 0 ? (
            <p style={loadingTextStyle}>No pre-loaded models found.</p>
          ) : (
            <div style={modelGridWrapperStyle}>
              <div style={modelGridStyle}>
                {persons.map((person) => (
                  <div
                    key={person.id || person.filename}
                    onClick={() => handlePersonSelect(person)}
                    className={`viton-model-card ${selectedPerson?.filename === person.filename && !uploadedPersonId ? 'selected' : ''}`}
                    style={{
                      ...modelCardStyle,
                      ...(selectedPerson?.filename === person.filename && !uploadedPersonId ? modelCardSelectedStyle : {}),
                    }}
                  >
                    <div style={{ ...modelImageStyle, backgroundImage: `url(${API_BASE_URL}${person.url})` }} />
                    <p style={modelLabelStyle}>{person.filename.replace(/_00\.jpg$/, '').replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* STEP 3: Upload Clothing */}
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <p style={sectionOverlineStyle}>Step 3</p>
            <h2 style={sectionTitleStyle}>
              Upload
              <br />
              <em>Clothing</em>
            </h2>
          </div>

          <div style={uploadBoxStyle}>
            <input
              ref={clothInputRef}
              type="file"
              accept="image/*"
              onChange={handleClothSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => clothInputRef.current?.click()}
              style={uploadBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#c9a96e';
                e.currentTarget.style.borderColor = '#c9a96e';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#1a1a1a';
                e.currentTarget.style.color = '#1a1a1a';
              }}
            >
              Choose Clothing Image
            </button>

            {clothPreview && (
              <div style={clothPreviewWrapStyle}>
                <img src={clothPreview} alt="Cloth preview" style={clothPreviewImgStyle} />
              </div>
            )}
          </div>
        </section>

        {/* ACTION BUTTONS */}
        <section style={actionSectionStyle}>
          <button
            onClick={handleGenerate}
            disabled={!selectedPerson || !clothFile || loading}
            style={{
              ...generateBtnStyle,
              ...(!selectedPerson || !clothFile || loading ? generateBtnDisabledStyle : {}),
            }}
            onMouseEnter={(e) => {
              if (selectedPerson && clothFile && !loading) {
                e.currentTarget.style.background = '#0c2440';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPerson && clothFile && !loading) {
                e.currentTarget.style.background = '#1a1a1a';
              }
            }}
          >
            {loading ? 'Generating...' : 'Generate Try-On'}
          </button>

          <button
            onClick={handleReset}
            style={resetBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#6b6560';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#9a9590';
            }}
          >
            Reset
          </button>
        </section>

        {progress && (
          <div style={progressBoxStyle}>
            <div style={progressBarStyle} />
            <p style={progressTextStyle}>{progress}</p>
          </div>
        )}

        {/* RESULT SECTION */}
        {resultImage && (
          <section style={resultSectionStyle}>
            <div style={sectionHeaderStyle}>
              <p style={sectionOverlineStyle}>Result</p>
              <h2 style={sectionTitleStyle}>
                Your Virtual
                <br />
                <em>Try-On</em>
              </h2>
            </div>

            <div style={resultGridStyle}>
              {/* Original Model */}
              <div style={resultCardStyle}>
                <p style={resultCardTitleStyle}>Original Model</p>
                <div style={resultImageContainerStyle}>
                  {personImageUrl ? (
                    <img
                      src={personImageUrl}
                      alt="Original Model"
                      style={resultImageImgStyle}
                    />
                  ) : (
                    <div style={placeholderStyle}>Loading...</div>
                  )}
                </div>
              </div>

              {/* Clothing */}
              <div style={resultCardStyle}>
                <p style={resultCardTitleStyle}>Clothing</p>
                <div style={resultImageContainerStyle}>
                  {clothImageUrl ? (
                    <img
                      src={clothImageUrl}
                      alt="Clothing"
                      style={resultImageImgStyle}
                    />
                  ) : (
                    <div style={placeholderStyle}>Loading...</div>
                  )}
                </div>
              </div>

              {/* Try-On Result */}
              <div style={resultCardStyle}>
                <p style={resultCardTitleStyle}>Try-On Result</p>
                <div style={resultImageContainerStyle}>
                  <img
                    src={resultImage}
                    alt="Try-On Result"
                    style={resultImageImgStyle}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleDownload}
              style={downloadBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#c9a96e';
                e.currentTarget.style.borderColor = '#c9a96e';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#1a1a1a';
                e.currentTarget.style.color = '#1a1a1a';
              }}
            >
              Download Result
            </button>
          </section>
        )}

        {/* FEATURES GRID */}
        <section style={featuresSectionStyle}>
          <div style={featuresGridStyle}>
            {[
              {
                icon: '🤖',
                title: 'AI-Powered',
                desc: 'Advanced VITON-HD technology for realistic results',
              },
              {
                icon: '📸',
                title: 'Your Photos',
                desc: 'Upload your own photos with automatic preprocessing',
              },
              {
                icon: '⚡',
                title: 'Fast Processing',
                desc: 'Get results in under 2 minutes',
              },
              {
                icon: '✨',
                title: 'High Quality',
                desc: 'Photorealistic results with accurate details',
              },
            ].map((item, i) => (
              <div key={i} style={featureCardStyle} className="viton-feature-card">
                <span style={featureIconStyle}>{item.icon}</span>
                <h3 style={featureTitleStyle}>{item.title}</h3>
                <p style={featureDescStyle}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

/* ─── Styles ─────────────────────────────────────────────────────────── */

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
`;

const dynamicCSS = `
  .viton-model-card {
    transition: all 0.3s ease;
    cursor: pointer;
  }
  .viton-model-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.12);
  }
  .viton-model-card.selected {
    border-color: #c9a96e !important;
    box-shadow: 0 0 0 3px #c9a96e;
  }
  .viton-feature-card {
    transition: background 0.3s ease, transform 0.2s ease;
  }
  .viton-feature-card:hover {
    background: #f2ede7;
    transform: translateY(-2px);
  }

  /* ── NAV BAR BUTTON HOVER STYLES ── */
  .tryon-nav-recs-btn {
    transition: border-color 0.25s ease, background 0.25s ease,
                transform 0.25s ease, box-shadow 0.25s ease, color 0.25s ease !important;
  }
  .tryon-nav-recs-btn:hover {
    border-color: #c9a96e !important;
    background: rgba(201,169,110,0.15) !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(201,169,110,0.3);
    color: #c9a96e !important;
  }
  .tryon-nav-login-btn {
    transition: border-color 0.25s ease, background 0.25s ease,
                transform 0.25s ease, box-shadow 0.25s ease !important;
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
  }
`;

/* ── All original styles below ───────────────────────────────── */

const wrapperStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  background: '#fff',
  color: '#1a1a1a',
  minHeight: '100vh',
};

const heroStyle: React.CSSProperties = {
  padding: '80px 48px 60px',
  background: 'linear-gradient(135deg, #fafaf8 0%, #f5f3ef 100%)',
  borderBottom: '1px solid #e8e4de',
};

const heroInnerStyle: React.CSSProperties = {
  maxWidth: '800px',
  margin: '0 auto',
  textAlign: 'center',
};

const heroOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};

const heroTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(48px, 8vw, 80px)',
  fontWeight: 300,
  lineHeight: 0.95,
  color: '#1a1a1a',
  marginBottom: '24px',
};

const heroSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: '#6b6560',
  maxWidth: '600px',
  margin: '0 auto',
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  background: '#e8e4de',
};

const errorBannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '16px 48px',
  background: '#fee',
  borderBottom: '1px solid #fcc',
};

const errorDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#c33',
  marginTop: '6px',
  flexShrink: 0,
};

const errorTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.7,
  color: '#c33',
};

const mainStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '80px 48px',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '80px',
};

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: '32px',
};

const sectionOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(32px, 5vw, 48px)',
  fontWeight: 300,
  lineHeight: 1.1,
  color: '#1a1a1a',
};

const uploadBoxStyle: React.CSSProperties = {
  padding: '48px 36px',
  border: '2px dashed #d4cfc8',
  background: '#fafaf8',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '20px',
};

const uploadBtnStyle: React.CSSProperties = {
  padding: '14px 36px',
  background: 'transparent',
  border: '1px solid #1a1a1a',
  color: '#1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
};

const uploadBtnDisabledStyle: React.CSSProperties = {
  background: '#e8e4de',
  borderColor: '#d4cfc8',
  color: '#9a9590',
  cursor: 'not-allowed',
};

const uploadProgressTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 400,
  color: '#c9a96e',
};

const successBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 20px',
  background: '#d4edda',
  border: '1px solid #c3e6cb',
};

const successDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#155724',
  flexShrink: 0,
};

const successTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 400,
  color: '#155724',
};

const modelCountStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 400,
  letterSpacing: '2px',
  color: '#9a9590',
  textTransform: 'uppercase',
  marginTop: '12px',
};

const loadingBoxStyle: React.CSSProperties = {
  padding: '48px',
  textAlign: 'center',
};

const loadingBarStyle: React.CSSProperties = {
  width: '120px',
  height: '1px',
  background: '#c9a96e',
  margin: '0 auto 24px',
};

const loadingTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '4px',
  textTransform: 'uppercase',
  color: '#9a9590',
};

const modelGridWrapperStyle: React.CSSProperties = {
  maxHeight: '600px',
  overflowY: 'auto',
  overflowX: 'hidden',
  border: '1px solid #e8e4de',
  background: '#fafaf8',
  padding: '24px',
};

const modelGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: '16px',
};

const modelCardStyle: React.CSSProperties = {
  border: '1px solid #e8e4de',
  background: '#fff',
  overflow: 'hidden',
  cursor: 'pointer',
};

const modelCardSelectedStyle: React.CSSProperties = {
  borderColor: '#c9a96e',
  boxShadow: '0 0 0 3px #c9a96e',
};

const modelImageStyle: React.CSSProperties = {
  width: '100%',
  height: '200px',
  backgroundSize: 'cover',
  backgroundPosition: 'top center',
};

const modelLabelStyle: React.CSSProperties = {
  padding: '10px',
  textAlign: 'center',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 400,
  letterSpacing: '1px',
  color: '#1a1a1a',
  background: '#fafaf8',
  borderTop: '1px solid #e8e4de',
  textTransform: 'uppercase',
};

const personPreviewWrapStyle: React.CSSProperties = {
  marginTop: '16px',
};

const photoTipsStyle: React.CSSProperties = {
  padding: '16px 20px',
  background: '#fffbf0',
  border: '1px solid #e8d9b0',
  textAlign: 'left',
  maxWidth: '400px',
  width: '100%',
};

const photoTipsTitleStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '10px',
};

const photoTipsListStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  lineHeight: 2,
  color: '#6b6560',
  paddingLeft: '16px',
};

const clothPreviewWrapStyle: React.CSSProperties = {
  marginTop: '20px',
};

const clothPreviewImgStyle: React.CSSProperties = {
  maxWidth: '320px',
  maxHeight: '320px',
  objectFit: 'contain',
  border: '1px solid #e8e4de',
};

const actionSectionStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  justifyContent: 'center',
  marginBottom: '40px',
  flexWrap: 'wrap',
};

const generateBtnStyle: React.CSSProperties = {
  padding: '16px 48px',
  background: '#1a1a1a',
  border: 'none',
  color: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.3s ease',
};

const generateBtnDisabledStyle: React.CSSProperties = {
  background: '#e8e4de',
  color: '#9a9590',
  cursor: 'not-allowed',
};

const resetBtnStyle: React.CSSProperties = {
  padding: '16px 48px',
  background: '#9a9590',
  border: 'none',
  color: '#fff',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.3s ease',
};

const progressBoxStyle: React.CSSProperties = {
  padding: '20px 24px',
  background: '#e7f3ff',
  border: '1px solid #bee5eb',
  marginBottom: '40px',
  textAlign: 'center',
};

const progressBarStyle: React.CSSProperties = {
  width: '80px',
  height: '1px',
  background: '#0066cc',
  margin: '0 auto 16px',
};

const progressTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 500,
  color: '#0066cc',
};

const resultSectionStyle: React.CSSProperties = {
  marginTop: '80px',
  paddingTop: '80px',
  borderTop: '1px solid #e8e4de',
};

const resultGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '24px',
  marginBottom: '40px',
};

const resultCardStyle: React.CSSProperties = {
  textAlign: 'center',
};

const resultCardTitleStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#6b6560',
  marginBottom: '16px',
};

const resultImageContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '500px',
  border: '1px solid #e8e4de',
  background: '#fafaf8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const resultImageImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center',
};

const placeholderStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f0f0f0',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  color: '#9a9590',
};

const downloadBtnStyle: React.CSSProperties = {
  display: 'block',
  margin: '0 auto',
  padding: '14px 36px',
  background: 'transparent',
  border: '1px solid #1a1a1a',
  color: '#1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
};

const featuresSectionStyle: React.CSSProperties = {
  marginTop: '80px',
  paddingTop: '80px',
  borderTop: '1px solid #e8e4de',
};

const featuresGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '1px',
  background: '#e8e4de',
  border: '1px solid #e8e4de',
};

const featureCardStyle: React.CSSProperties = {
  padding: '48px 36px',
  background: '#fafaf8',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '16px',
};

const featureIconStyle: React.CSSProperties = {
  fontSize: '40px',
};

const featureTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '22px',
  fontWeight: 400,
  color: '#1a1a1a',
};

const featureDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.8,
  color: '#6b6560',
};

export default VirtualTryOnPage;
