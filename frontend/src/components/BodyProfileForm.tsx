// frontend/src/components/BodyProfileForm.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image_url: string;
  colors: string[];
  sizes: string[];
  match_score?: number;
  matching_colors?: string[];
}

interface APIResult {
  body_analysis: {
    bmi: number;
    bmi_category: string;
    height_cm: number;
    weight_kg: number;
    gender: string;
    skin_tone: string;
  };
  predictions: {
    style: string;
    color_palette: string;
    style_confidence_pct: number;
    color_confidence_pct: number;
    color_palette_secondary?: string;
    color_confidence_secondary_pct?: number;
  };
  palette_colors_secondary?: string[];
  size_recommendation?: { recommended_size: string; measurements: string };
  recommended_products: Product[];
  palette_colors: string[];
  method: string;
}

const SKIN_TONES = [
  { value: "Cool",    hint: "Pink or bluish undertones",      swatch: "#c8b8c8" },
  { value: "Neutral", hint: "Mix of warm and cool",           swatch: "#d4c4a8" },
  { value: "Warm",    hint: "Golden or yellowish undertones", swatch: "#c8944c" },
];

const COLOR_HEX: Record<string, string> = {
  navy:"#001F5B", emerald:"#50C878", burgundy:"#800020", purple:"#800080",
  cobalt:"#0047AB", teal:"#008080", sapphire:"#0F52BA", ruby:"#E0115F",
  lavender:"#E6E6FA", blush:"#FFB6C1", mint:"#98FF98", sky:"#87CEEB",
  rose:"#FF007F", peach:"#FFCBA4", lilac:"#C8A2C8", powder:"#B0E0E6",
  brown:"#964B00", beige:"#F5F5DC", olive:"#808000", mustard:"#FFDB58",
  camel:"#C19A6B", rust:"#B7410E", cream:"#FFFDD0", terracotta:"#E2725B",
  red:"#FF3333", orange:"#FF6600", yellow:"#FFD700", pink:"#FF69B4",
  fuchsia:"#FF00FF", lime:"#32CD32", coral:"#FF6F61", turquoise:"#40E0D0",
  white:"#F5F5F5", black:"#222222", gray:"#808080", ivory:"#FFFFF0", charcoal:"#36454F",
};

const API = "http://localhost:8000";

const BodyProfileForm: React.FC = () => {
  const navigate = useNavigate();

  // Form values
  const [height,   setHeight]   = useState(165);
  const [weight,   setWeight]   = useState(62);
  const [gender,   setGender]   = useState("Female");
  const [skinTone, setSkinTone] = useState("Neutral");

  // UI state
  const [editOpen,  setEditOpen]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");
  const [result,    setResult]    = useState<APIResult | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const bmi = weight / ((height / 100) ** 2);
  const bmiLabel = bmi < 18.5 ? "Slim" : bmi < 25 ? "Average" : bmi < 30 ? "Overweight" : "Plus";

  const runAnalysis = useCallback(async (h: number, w: number, s: string, g: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/recommend/by-body`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ height: h, weight: w, skin_tone: s, gender: g }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Request failed"); }
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message || "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load saved profile on mount and auto-run analysis
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return;
    const user = JSON.parse(stored);
    const userId = user?.user_id ?? user?.userId ?? user?.id;
    if (!userId) return;
    setIsLoggedIn(true);

    fetch(`${API}/api/user/${userId}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const p = data?.profile;
        if (!p) return;
        const h = p.height ? Math.round(p.height) : 165;
        const w = p.weight ? Math.round(p.weight) : 62;
        const s = p.skin_tone || "Neutral";
        const g = p.gender || "Female";
        setHeight(h); setWeight(w); setSkinTone(s); setGender(g);
        if (p.height && p.weight) {
          setHasProfile(true);
          runAnalysis(h, w, s, g);
        }
      })
      .catch(() => {});
  }, [runAnalysis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await runAnalysis(height, weight, skinTone, gender);
    setEditOpen(false);
  };

  const handleSave = async () => {
    const stored = localStorage.getItem("user");
    if (!stored) { setError("Log in to save your profile."); return; }
    const user = JSON.parse(stored);
    const userId = user?.user_id ?? user?.userId ?? user?.id;
    if (!userId) { setError("Log in to save your profile."); return; }
    setSaving(true);
    try {
      const bmiCat = bmi < 18.5 ? "Slim" : bmi < 25 ? "Average" : bmi < 30 ? "Overweight" : "Plus";
      await fetch(`${API}/api/user/${userId}/body-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height, weight, gender, skin_tone: skinTone, body_type: bmiCat,
          preferred_style: result?.predictions.style ?? null,
        }),
      });
      setHasProfile(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.page}>
      <style>{css}</style>

      {/* ── PAGE HEADER ───────────────────────────────────────── */}
      <header style={s.hero}>
        <span style={s.overline}>Personalised AI Styling</span>
        <h1 style={s.heroTitle}>Body Fit Recommendations</h1>
        <p style={s.heroSub}>
          Our AI matches your body profile to the most flattering styles and
          colours from our collection — automatically.
        </p>
      </header>

      <div style={s.divider} />

      {/* ── BODY ANALYSIS CARD (shown when result exists) ─────── */}
      {result && (
        <section style={s.analysisSection}>
          <div style={s.analysisTitleRow}>
            <div>
              <span style={s.overline}>Your Body Analysis</span>
              <p style={s.analysisMeta}>
                {result.body_analysis.gender} · {result.body_analysis.height_cm} cm ·{" "}
                {result.body_analysis.weight_kg} kg · {result.body_analysis.skin_tone} skin tone
              </p>
            </div>
            <button
              onClick={() => { setEditOpen(o => !o); setSaved(false); }}
              style={s.editBtn}
              className="bp-edit-btn"
            >
              {editOpen ? "✕ Cancel" : "✎ Edit Profile"}
            </button>
          </div>

          {/* Stats grid */}
          <div style={s.statsGrid}>
            <div style={s.statCard}>
              <span style={s.statLabel}>BMI</span>
              <span style={s.statValue}>{result.body_analysis.bmi}</span>
              <span style={s.statSub}>{result.body_analysis.bmi_category}</span>
            </div>
            <div style={s.statCard}>
              <span style={s.statLabel}>Style Match</span>
              <span style={{ ...s.statValue, fontSize: "18px" }}>
                {result.predictions.style.replace(/_/g, " ")}
              </span>
              <span style={s.statSub}>{result.predictions.style_confidence_pct}% confidence</span>
            </div>
            <div style={s.statCard}>
              <span style={s.statLabel}>Primary Palette</span>
              <span style={{ ...s.statValue, fontSize: "18px" }}>
                {result.predictions.color_palette.replace(/_/g, " ")}
              </span>
              <span style={s.statSub}>{result.predictions.color_confidence_pct}% confidence</span>
            </div>
            {result.predictions.color_palette_secondary && (
              <div style={s.statCard}>
                <span style={s.statLabel}>Alt. Palette</span>
                <span style={{ ...s.statValue, fontSize: "16px", color: "#9a9590" }}>
                  {result.predictions.color_palette_secondary.replace(/_/g, " ")}
                </span>
                <span style={s.statSub}>
                  {result.predictions.color_confidence_secondary_pct}% confidence
                </span>
              </div>
            )}
            {result.size_recommendation && (
              <div style={{ ...s.statCard, borderLeft: "3px solid #c9a96e" }}>
                <span style={s.statLabel}>Recommended Size</span>
                <span style={{ ...s.statValue, fontSize: "38px", color: "#c9a96e", lineHeight: 1 }}>
                  {result.size_recommendation.recommended_size}
                </span>
                <span style={s.statSub}>{result.size_recommendation.measurements}</span>
              </div>
            )}
          </div>

          {/* Colour palettes */}
          <div style={s.palettesRow}>
            {result.palette_colors.length > 0 && (
              <div style={s.paletteBlock}>
                <p style={s.paletteLabel}>
                  {result.predictions.color_palette.replace(/_/g, " ")} — Your Best Colours
                </p>
                <div style={s.swatchRow}>
                  {result.palette_colors.map(color => (
                    <div key={color} style={s.swatchItem}>
                      <div style={{ ...s.colorDot, background: COLOR_HEX[color.toLowerCase()] || "#ccc" }} />
                      <span style={s.colorName}>{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.palette_colors_secondary && result.palette_colors_secondary.length > 0 && (
              <div style={s.paletteBlock}>
                <p style={{ ...s.paletteLabel, color: "#9a9590" }}>
                  {result.predictions.color_palette_secondary?.replace(/_/g, " ")} — Alternative
                </p>
                <div style={s.swatchRow}>
                  {result.palette_colors_secondary.map(color => (
                    <div key={color} style={s.swatchItem}>
                      <div style={{ ...s.colorDot, background: COLOR_HEX[color.toLowerCase()] || "#ccc", opacity: 0.7 }} />
                      <span style={s.colorName}>{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── EDIT / INPUT FORM ─────────────────────────────────── */}
      {(!result || editOpen) && (
        <section style={s.formSection} className={editOpen ? "bp-form-panel open" : "bp-form-panel"}>
          {!result && !loading && (
            <div style={s.formIntro}>
              <p style={s.formIntroTitle}>
                {isLoggedIn ? "No body profile saved yet." : "You're not logged in."}
              </p>
              <p style={s.formIntroSub}>
                {isLoggedIn
                  ? "Enter your measurements below to get personalised recommendations."
                  : "Sign in or create an account to save your profile for automatic loading next time."}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.formGrid}>

              {/* Gender */}
              <div style={s.field}>
                <label style={s.label}>GENDER</label>
                <div style={s.genderRow}>
                  {["Female", "Male"].map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      style={gender === g ? { ...s.genderBtn, ...s.genderActive } : s.genderBtn}>
                      {g === "Female" ? "♀ Female" : "♂ Male"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height */}
              <div style={s.field}>
                <div style={s.sliderHead}>
                  <label style={s.label}>HEIGHT</label>
                  <span style={s.sliderVal}>{height} cm</span>
                </div>
                <input type="range" min={140} max={210} step={1} value={height}
                  onChange={e => setHeight(Number(e.target.value))}
                  className="bp-slider" style={s.sliderBase} />
                <div style={s.marks}>
                  <span style={s.markTxt}>140</span>
                  <span style={s.markTxt}>175</span>
                  <span style={s.markTxt}>210</span>
                </div>
              </div>

              {/* Weight */}
              <div style={s.field}>
                <div style={s.sliderHead}>
                  <label style={s.label}>WEIGHT</label>
                  <span style={s.sliderVal}>{weight} kg</span>
                </div>
                <input type="range" min={35} max={150} step={1} value={weight}
                  onChange={e => setWeight(Number(e.target.value))}
                  className="bp-slider" style={s.sliderBase} />
                <div style={s.marks}>
                  <span style={s.markTxt}>35</span>
                  <span style={s.markTxt}>90</span>
                  <span style={s.markTxt}>150</span>
                </div>
              </div>

              {/* Live BMI */}
              <div style={s.bmiBox}>
                <span style={s.bmiLabel}>Live BMI</span>
                <span style={s.bmiVal}>{bmi.toFixed(1)}</span>
                <span style={s.bmiCat}>— {bmiLabel}</span>
              </div>

              {/* Skin tone */}
              <div style={s.field}>
                <label style={s.label}>SKIN UNDERTONE</label>
                <div style={s.skinGrid}>
                  {SKIN_TONES.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setSkinTone(opt.value)}
                      style={skinTone === opt.value ? { ...s.skinBtn, ...s.skinActive } : s.skinBtn}>
                      <span style={{
                        ...s.skinSwatch,
                        background: opt.swatch,
                        border: skinTone === opt.value ? "2px solid #c9a96e" : "2px solid transparent",
                      }} />
                      <div style={s.skinTxt}>
                        <span style={s.skinName}>{opt.value}</span>
                        <span style={s.skinHint}>{opt.hint}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {error && (
              <div style={s.errBox}>
                <span style={s.errDot} />
                <p style={s.errTxt}>{error}</p>
              </div>
            )}

            <div style={s.formActions}>
              <button type="submit" disabled={loading}
                style={loading ? { ...s.submitBtn, ...s.submitDisabled } : s.submitBtn}
                className="bp-submit">
                {loading ? "Analysing…" : result ? "Re-Analyse →" : "Get My Recommendations →"}
              </button>
              {isLoggedIn && (
                <button type="button" onClick={handleSave} disabled={saving || saved}
                  style={saved ? { ...s.saveBtn, ...s.saveDone } : s.saveBtn}
                  className="bp-save">
                  {saved ? "✓ Saved" : saving ? "Saving…" : "Save Profile"}
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* ── LOADING SPINNER ───────────────────────────────────── */}
      {loading && (
        <div style={s.loadingWrap}>
          <div style={s.spinner} className="bp-spin" />
          <p style={s.loadingTxt}>Analysing your profile and finding matching products…</p>
        </div>
      )}

      {/* ── NO RESULT EMPTY STATE ─────────────────────────────── */}
      {!result && !loading && !editOpen && (
        <div style={s.emptyWrap}>
          <span style={s.emptyIcon}>◎</span>
          <p style={s.emptyTitle}>Your recommendations will appear here</p>
          <p style={s.emptySub}>
            {isLoggedIn
              ? "Complete your body profile above to get started."
              : "Sign in to load your saved profile automatically."}
          </p>
          {!isLoggedIn && (
            <button onClick={() => navigate("/login")} style={s.signInBtn} className="bp-submit">
              Sign In
            </button>
          )}
        </div>
      )}

      {/* ── PRODUCT GRID ──────────────────────────────────────── */}
      {result && !loading && (
        <section style={s.productsSection}>
          <div style={s.productsHeader}>
            <span style={s.overline}>
              {result.recommended_products.length} Products Recommended For You
            </span>
            <p style={s.productsMeta}>
              Matched to your <strong>{result.predictions.color_palette.replace(/_/g, " ")}</strong> palette
              and <strong>{result.predictions.style.replace(/_/g, " ")}</strong> fit
            </p>
          </div>

          <div style={s.grid}>
            {result.recommended_products.map(product => (
              <article key={product.id} style={s.card} className="bp-card">
                <div style={s.imgWrap}>
                  <div style={{
                    ...s.img,
                    backgroundImage: product.image_url ? `url(${product.image_url})` : undefined,
                    background: product.image_url
                      ? `url(${product.image_url}) center/cover no-repeat`
                      : "linear-gradient(135deg,#d4c8b8,#e8ddd0)",
                  }}>
                    {!product.image_url && (
                      <span style={s.imgInitial}>{product.name.charAt(0)}</span>
                    )}
                  </div>
                  <span style={s.catBadge}>{product.category}</span>
                  {product.match_score !== undefined && product.match_score > 0 && (() => {
                    const primary = new Set((result.palette_colors || []).map(c => c.toLowerCase()));
                    const best = (product.matching_colors || []).some(c => primary.has(c.toLowerCase()));
                    return (
                      <span style={{ ...s.matchBadge, background: best ? "rgba(26,26,26,0.85)" : "#c9a96e" }}>
                        ✓ {best ? "Best" : "Good"} Match
                      </span>
                    );
                  })()}
                  <div style={s.overlay} className="bp-overlay">
                    <button onClick={() => navigate(`/products/${product.id}`)}
                      style={s.ovBtn} className="bp-ov-btn">View Product</button>
                    <button onClick={() => navigate(`/virtual-tryon?productId=${product.id}`)}
                      style={{ ...s.ovBtn, background: "#c9a96e", color: "#fff" }}
                      className="bp-ov-btn">Try On</button>
                  </div>
                </div>
                <div style={s.cardBody} onClick={() => navigate(`/products/${product.id}`)}
                  className="bp-card-body">
                  <h3 style={s.cardName}>{product.name}</h3>
                  <p style={s.cardPrice}>LKR {product.price.toFixed(0)}</p>
                  {product.matching_colors && product.matching_colors.length > 0 && (
                    <p style={s.cardMatch}>Palette match: {product.matching_colors.join(", ")}</p>
                  )}
                  <div style={s.sizesRow}>
                    {product.sizes.map(sz => (
                      <span key={sz} style={s.sizeChip}>{sz}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

/* ─── CSS ─────────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;700&family=Oswald:wght@500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }

  .bp-slider {
    -webkit-appearance:none; appearance:none;
    width:100%; height:2px; background:#e8e4de;
    outline:none; border-radius:2px; cursor:pointer; display:block; margin:8px 0;
  }
  .bp-slider::-webkit-slider-thumb {
    -webkit-appearance:none; width:20px; height:20px; border-radius:50%;
    background:#c9a96e; cursor:pointer; border:2px solid #fff;
    box-shadow:0 2px 8px rgba(201,169,110,0.5);
  }

  .bp-edit-btn:hover  { background:#1a1a1a !important; color:#fff !important; }
  .bp-submit:hover:not(:disabled) { background:#0c2440 !important; }
  .bp-save:hover:not(:disabled)   { background:#b8955a !important; }

  .bp-card { transition:transform 0.25s ease, box-shadow 0.25s ease; }
  .bp-card:hover { transform:translateY(-4px); box-shadow:0 12px 28px rgba(0,0,0,0.1); }
  .bp-overlay { opacity:0; transition:opacity 0.25s ease; }
  .bp-card:hover .bp-overlay { opacity:1; }
  .bp-card-body { cursor:pointer; }
  .bp-ov-btn:hover { opacity:0.85; }

  @keyframes bp-spin { to { transform:rotate(360deg); } }
  .bp-spin { animation:bp-spin 0.9s linear infinite; }

  .bp-form-panel { transition: max-height 0.35s ease, opacity 0.3s ease; }

  @media (max-width:768px) {
    .bp-stats-grid { grid-template-columns:repeat(2,1fr) !important; }
    .bp-form-grid  { grid-template-columns:1fr !important; }
    .bp-product-grid { grid-template-columns:repeat(2,1fr) !important; }
  }
  @media (max-width:480px) {
    .bp-product-grid { grid-template-columns:1fr !important; }
    .bp-stats-grid   { grid-template-columns:1fr !important; }
  }
`;

/* ─── Styles ──────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:        { fontFamily:"'Montserrat',sans-serif", background:"#fff", color:"#1a1a1a", minHeight:"100vh" },

  // Hero
  hero:        { padding:"72px 56px 48px", background:"linear-gradient(135deg,#fafaf8 0%,#f0ede8 100%)", borderBottom:"1px solid #e8e4de" },
  overline:    { fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:500, letterSpacing:"3px", textTransform:"uppercase", color:"#c9a96e", marginBottom:"12px", display:"block" },
  heroTitle:   { fontFamily:"'Oswald',sans-serif", fontSize:"clamp(30px,4vw,52px)", fontWeight:700, letterSpacing:"2px", textTransform:"uppercase", lineHeight:1.05, color:"#1a1a1a", marginBottom:"16px" },
  heroSub:     { fontFamily:"'Montserrat',sans-serif", fontSize:"13px", fontWeight:300, lineHeight:1.9, color:"#6b6560", maxWidth:"560px" },
  divider:     { height:"1px", background:"#e8e4de" },

  // Analysis section
  analysisSection: { padding:"48px 56px 36px", borderBottom:"1px solid #e8e4de", background:"#fafaf8" },
  analysisTitleRow:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px", flexWrap:"wrap", gap:"16px" },
  analysisMeta:    { fontFamily:"'Montserrat',sans-serif", fontSize:"11px", fontWeight:300, color:"#9a9590", letterSpacing:"0.5px", marginTop:"6px" },
  editBtn:     { padding:"10px 22px", background:"#fff", border:"1px solid #1a1a1a", fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:500, letterSpacing:"2px", textTransform:"uppercase", cursor:"pointer", color:"#1a1a1a", transition:"all 0.25s ease", whiteSpace:"nowrap" },

  statsGrid:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"20px", marginBottom:"32px" },
  statCard:    { padding:"20px 22px", background:"#fff", border:"1px solid #e8e4de", display:"flex", flexDirection:"column", gap:"6px" },
  statLabel:   { fontFamily:"'Montserrat',sans-serif", fontSize:"9px", fontWeight:500, letterSpacing:"2px", textTransform:"uppercase", color:"#9a9590" },
  statValue:   { fontFamily:"'Oswald',sans-serif", fontSize:"22px", fontWeight:600, letterSpacing:"1px", color:"#1a1a1a", lineHeight:1.2 },
  statSub:     { fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:300, color:"#c9a96e" },

  palettesRow: { display:"flex", flexWrap:"wrap", gap:"32px", borderTop:"1px solid #e8e4de", paddingTop:"24px" },
  paletteBlock:{ flex:"1 1 280px" },
  paletteLabel:{ fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:500, letterSpacing:"2px", textTransform:"uppercase", color:"#6b6560", marginBottom:"12px" },
  swatchRow:   { display:"flex", gap:"10px", flexWrap:"wrap" },
  swatchItem:  { display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" },
  colorDot:    { width:"32px", height:"32px", borderRadius:"50%", border:"1px solid rgba(0,0,0,0.1)" },
  colorName:   { fontFamily:"'Montserrat',sans-serif", fontSize:"9px", fontWeight:400, color:"#9a9590", textTransform:"capitalize" },

  // Form section
  formSection: { padding:"40px 56px", borderBottom:"1px solid #e8e4de", background:"#fff" },
  formIntro:   { marginBottom:"28px", padding:"20px 24px", background:"#fafaf8", border:"1px solid #e8e4de" },
  formIntroTitle: { fontFamily:"'Oswald',sans-serif", fontSize:"18px", fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase", color:"#1a1a1a", marginBottom:"6px" },
  formIntroSub:   { fontFamily:"'Montserrat',sans-serif", fontSize:"12px", fontWeight:300, color:"#6b6560", lineHeight:1.7 },
  form:        { display:"flex", flexDirection:"column", gap:"0" },
  formGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"28px 40px", marginBottom:"28px" },
  field:       { display:"flex", flexDirection:"column", gap:"10px" },
  label:       { fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:500, letterSpacing:"2.5px", textTransform:"uppercase", color:"#6b6560" },
  genderRow:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" },
  genderBtn:   { padding:"13px", background:"#fff", border:"1px solid #d4cfc8", fontFamily:"'Montserrat',sans-serif", fontSize:"12px", fontWeight:400, letterSpacing:"1px", color:"#6b6560", cursor:"pointer", transition:"all 0.25s ease" },
  genderActive:{ background:"#1a1a1a", borderColor:"#1a1a1a", color:"#fff" },
  sliderHead:  { display:"flex", justifyContent:"space-between", alignItems:"center" },
  sliderVal:   { fontFamily:"'Oswald',sans-serif", fontSize:"22px", fontWeight:600, color:"#c9a96e" },
  sliderBase:  { width:"100%" },
  marks:       { display:"flex", justifyContent:"space-between" },
  markTxt:     { fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:300, color:"#9a9590" },
  bmiBox:      { display:"flex", alignItems:"center", gap:"12px", padding:"14px 18px", background:"#fafaf8", border:"1px solid #e8e4de" },
  bmiLabel:    { fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:500, letterSpacing:"2px", textTransform:"uppercase", color:"#9a9590" },
  bmiVal:      { fontFamily:"'Oswald',sans-serif", fontSize:"26px", fontWeight:700, color:"#c9a96e" },
  bmiCat:      { fontFamily:"'Montserrat',sans-serif", fontSize:"12px", fontWeight:300, color:"#6b6560" },
  skinGrid:    { display:"flex", flexDirection:"column", gap:"6px" },
  skinBtn:     { display:"flex", alignItems:"center", gap:"14px", padding:"12px 14px", background:"#fff", border:"1px solid #d4cfc8", cursor:"pointer", textAlign:"left", transition:"all 0.25s ease" },
  skinActive:  { borderColor:"#c9a96e", background:"#fdf8f2" },
  skinSwatch:  { width:"28px", height:"28px", borderRadius:"50%", flexShrink:0, transition:"border 0.25s ease" },
  skinTxt:     { display:"flex", flexDirection:"column", gap:"2px" },
  skinName:    { fontFamily:"'Oswald',sans-serif", fontSize:"15px", fontWeight:600, letterSpacing:"1px", textTransform:"uppercase", color:"#1a1a1a" },
  skinHint:    { fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:300, color:"#6b6560", lineHeight:1.4 },
  errBox:      { display:"flex", alignItems:"flex-start", gap:"10px", padding:"14px 16px", background:"#fee", border:"1px solid #fcc", marginBottom:"20px" },
  errDot:      { width:"8px", height:"8px", borderRadius:"50%", background:"#c33", marginTop:"5px", flexShrink:0 },
  errTxt:      { fontFamily:"'Montserrat',sans-serif", fontSize:"12px", fontWeight:300, color:"#c33", lineHeight:1.6 },
  formActions: { display:"flex", gap:"14px", flexWrap:"wrap" },
  submitBtn:   { padding:"16px 32px", background:"#1a1a1a", border:"none", color:"#fff", fontFamily:"'Montserrat',sans-serif", fontSize:"11px", fontWeight:500, letterSpacing:"3px", textTransform:"uppercase", cursor:"pointer", transition:"background 0.3s ease" },
  submitDisabled: { background:"#d4cfc8", cursor:"not-allowed" },
  saveBtn:     { padding:"16px 28px", background:"#c9a96e", border:"none", color:"#fff", fontFamily:"'Montserrat',sans-serif", fontSize:"11px", fontWeight:500, letterSpacing:"2px", textTransform:"uppercase", cursor:"pointer", transition:"background 0.3s ease" },
  saveDone:    { background:"#4a7c59", cursor:"default" },

  // Loading
  loadingWrap: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"72px 24px", gap:"20px" },
  spinner:     { width:"40px", height:"40px", border:"2px solid #e8e4de", borderTop:"2px solid #c9a96e", borderRadius:"50%" },
  loadingTxt:  { fontFamily:"'Montserrat',sans-serif", fontSize:"12px", fontWeight:300, color:"#9a9590", letterSpacing:"1px" },

  // Empty state
  emptyWrap:   { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 24px", gap:"12px" },
  emptyIcon:   { fontSize:"56px", color:"#d4cfc8" },
  emptyTitle:  { fontFamily:"'Oswald',sans-serif", fontSize:"20px", fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase", color:"#6b6560" },
  emptySub:    { fontFamily:"'Montserrat',sans-serif", fontSize:"12px", fontWeight:300, color:"#9a9590", lineHeight:1.8, textAlign:"center", maxWidth:"360px" },
  signInBtn:   { marginTop:"12px", padding:"14px 32px", background:"#1a1a1a", border:"none", color:"#fff", fontFamily:"'Montserrat',sans-serif", fontSize:"11px", fontWeight:500, letterSpacing:"3px", textTransform:"uppercase", cursor:"pointer", transition:"background 0.3s ease" },

  // Products
  productsSection: { padding:"48px 56px 64px" },
  productsHeader:  { marginBottom:"32px" },
  productsMeta:    { fontFamily:"'Montserrat',sans-serif", fontSize:"12px", fontWeight:300, color:"#6b6560", marginTop:"8px", lineHeight:1.7 },
  grid:        { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:"1px", background:"#e8e4de", border:"1px solid #e8e4de" },
  card:        { background:"#fff", position:"relative" },
  imgWrap:     { position:"relative", height:"260px", overflow:"hidden" },
  img:         { width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
  imgInitial:  { fontFamily:"'Oswald',sans-serif", fontSize:"60px", fontWeight:700, color:"rgba(26,26,26,0.1)" },
  catBadge:    { position:"absolute", top:"12px", left:"12px", fontFamily:"'Montserrat',sans-serif", fontSize:"9px", fontWeight:500, letterSpacing:"2px", textTransform:"uppercase", color:"#fff", background:"rgba(26,26,26,0.72)", padding:"4px 10px" },
  matchBadge:  { position:"absolute", bottom:"12px", right:"12px", fontFamily:"'Montserrat',sans-serif", fontSize:"9px", fontWeight:500, color:"#fff", padding:"4px 10px" },
  overlay:     { position:"absolute", inset:0, background:"rgba(0,0,0,0.42)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"10px" },
  ovBtn:       { padding:"10px 24px", background:"#fff", border:"none", fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:500, letterSpacing:"2px", textTransform:"uppercase", color:"#1a1a1a", cursor:"pointer", width:"160px", transition:"opacity 0.2s" },
  cardBody:    { padding:"18px", display:"flex", flexDirection:"column", gap:"6px" },
  cardName:    { fontFamily:"'Montserrat',sans-serif", fontSize:"13px", fontWeight:500, color:"#1a1a1a", lineHeight:1.3 },
  cardPrice:   { fontFamily:"'Montserrat',sans-serif", fontSize:"13px", fontWeight:500, color:"#c9a96e" },
  cardMatch:   { fontFamily:"'Montserrat',sans-serif", fontSize:"10px", fontWeight:300, color:"#9a9590", fontStyle:"italic", textTransform:"capitalize" },
  sizesRow:    { display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"4px" },
  sizeChip:    { fontFamily:"'Montserrat',sans-serif", fontSize:"9px", fontWeight:500, letterSpacing:"1.5px", color:"#6b6560", border:"1px solid #d4cfc8", padding:"3px 8px" },
};

export default BodyProfileForm;
