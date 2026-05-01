// frontend/src/components/BodyProfileForm.tsx
import React, { useState, useEffect } from "react";
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
  size_recommendation?: {
    recommended_size: string;
    measurements: string;
  };
  recommended_products: Product[];
  palette_colors: string[];
  method: string;
}

const SKIN_TONES = [
  { value: "Cool",    hint: "Pink or bluish undertones",  swatch: "#c8b8c8" },
  { value: "Neutral", hint: "Mix of warm and cool",       swatch: "#d4c4a8" },
  { value: "Warm",    hint: "Golden or yellowish undertones", swatch: "#c8944c" },
];

// Map palette color names → CSS hex.
// Names must exactly match PALETTE_TO_COLORS in backend/main.py.
const COLOR_HEX: Record<string, string> = {
  // Jewel Tones
  navy:     "#001F5B", emerald:  "#50C878", burgundy: "#800020",
  purple:   "#800080", cobalt:   "#0047AB", teal:     "#008080",
  sapphire: "#0F52BA", ruby:     "#E0115F",
  // Muted Pastels
  lavender: "#E6E6FA", blush:    "#FFB6C1", mint:     "#98FF98",
  sky:      "#87CEEB", rose:     "#FF007F", peach:    "#FFCBA4",
  lilac:    "#C8A2C8", powder:   "#B0E0E6",
  // Earth Tones
  brown:    "#964B00", beige:    "#F5F5DC", olive:    "#808000",
  mustard:  "#FFDB58", camel:    "#C19A6B", rust:     "#B7410E",
  cream:    "#FFFDD0", terracotta: "#E2725B",
  // Bold Brights
  red:      "#FF3333", orange:   "#FF6600", yellow:   "#FFD700",
  pink:     "#FF69B4", fuchsia:  "#FF00FF", lime:     "#32CD32",
  coral:    "#FF6F61", turquoise:"#40E0D0",
  // Neutral Classic
  white:    "#FFFFFF", black:    "#222222", gray:     "#808080",
  ivory:    "#FFFFF0", charcoal: "#36454F",
};

const API = "http://localhost:8000";

const BodyProfileForm: React.FC = () => {
  const navigate = useNavigate();
  const [height,   setHeight]   = useState(165);
  const [weight,   setWeight]   = useState(62);
  const [gender,   setGender]   = useState("Female");
  const [skinTone, setSkinTone] = useState("Neutral");
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [saved,    setSaved]    = useState(false);
  const [result,   setResult]   = useState<APIResult | null>(null);

  // Pre-load saved body measurements from the logged-in user's profile
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    fetch(`${API}/api/user/${userId}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const p = data?.profile;
        if (!p) return;
        if (p.height)    setHeight(Math.round(p.height));
        if (p.weight)    setWeight(Math.round(p.weight));
        if (p.gender)    setGender(p.gender);
        if (p.skin_tone) setSkinTone(p.skin_tone);
      })
      .catch(() => {});
  }, []);

  // Live BMI preview
  const bmi = weight / ((height / 100) ** 2);
  const bmiLabel = bmi < 18.5 ? "Slim"
                 : bmi < 25   ? "Average"
                 : bmi < 30   ? "Overweight"
                 :              "Plus";

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false);

    try {
      const res = await fetch(`${API}/api/recommend/by-body`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ height, weight, skin_tone: skinTone, gender }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Request failed");
      }
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message || "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { setError("Log in to save your profile."); return; }
    setSaving(true);
    try {
      const bmiCat = bmi < 18.5 ? "Slim" : bmi < 25 ? "Average" : bmi < 30 ? "Overweight" : "Plus";
      await fetch(`${API}/api/user/${userId}/body-profile`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height, weight, gender, skin_tone: skinTone, body_type: bmiCat,
          preferred_style: result?.predictions.style ?? null,
        }),
      });
      setSaved(true);
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <style>{css}</style>

      {/* PAGE HEADER */}
      <header style={styles.header}>
        <p style={styles.overline}>Personalised AI Styling</p>
        <h1 style={styles.title}>
          Find Your<br /><em>Perfect Style</em>
        </h1>
        <p style={styles.subtitle}>
          Enter your body measurements and skin tone. Our AI analyses
          your profile and recommends the most flattering styles and
          colours from our collection.
        </p>
      </header>

      <div style={styles.divider} />

      {/* TWO COLUMN LAYOUT */}
      <div style={styles.layout} className="body-layout">

        {/* LEFT COLUMN: FORM */}
        <div style={styles.formCol} className="body-form-col">
          <form onSubmit={handleSubmit} style={styles.form}>

            {/* Gender */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>GENDER</label>
              <div style={styles.genderRow}>
                {["Female", "Male"].map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    style={{ ...styles.genderBtn, ...(gender === g ? styles.genderBtnActive : {}) }}>
                    {g === "Female" ? "♀ Female" : "♂ Male"}
                  </button>
                ))}
              </div>
            </div>

            {/* Height slider */}
            <div style={styles.fieldGroup}>
              <div style={styles.sliderHeader}>
                <label style={styles.label}>HEIGHT</label>
                <span style={styles.sliderValue}>{height} cm</span>
              </div>
              <input type="range" min={140} max={210} step={1} value={height}
                onChange={e => setHeight(Number(e.target.value))}
                style={styles.slider} className="body-slider" />
              <div style={styles.sliderMarks}>
                <span style={styles.markText}>140</span>
                <span style={styles.markText}>175</span>
                <span style={styles.markText}>210</span>
              </div>
            </div>

            {/* Weight slider */}
            <div style={styles.fieldGroup}>
              <div style={styles.sliderHeader}>
                <label style={styles.label}>WEIGHT</label>
                <span style={styles.sliderValue}>{weight} kg</span>
              </div>
              <input type="range" min={35} max={150} step={1} value={weight}
                onChange={e => setWeight(Number(e.target.value))}
                style={styles.slider} className="body-slider" />
              <div style={styles.sliderMarks}>
                <span style={styles.markText}>35</span>
                <span style={styles.markText}>90</span>
                <span style={styles.markText}>150</span>
              </div>
            </div>

            {/* Live BMI preview */}
            <div style={styles.bmiBox}>
              <span style={styles.bmiLabel}>Live BMI</span>
              <span style={styles.bmiValue}>{bmi.toFixed(1)}</span>
              <span style={styles.bmiCat}>— {bmiLabel}</span>
            </div>

            {/* Skin tone */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>SKIN UNDERTONE</label>
              {SKIN_TONES.map(opt => (
                <button key={opt.value} type="button" onClick={() => setSkinTone(opt.value)}
                  style={{ ...styles.skinBtn, ...(skinTone === opt.value ? styles.skinBtnActive : {}) }}>
                  <span style={{
                    ...styles.swatch, background: opt.swatch,
                    border: skinTone === opt.value ? "2px solid #c9a96e" : "2px solid transparent",
                  }} />
                  <div style={styles.skinText}>
                    <span style={styles.skinName}>{opt.value}</span>
                    <span style={styles.skinHint}>{opt.hint}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Error message */}
            {error && (
              <div style={styles.errorBox}>
                <span style={styles.errorDot} />
                <p style={styles.errorText}>{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button type="submit" disabled={loading}
              style={{ ...styles.submitBtn, ...(loading ? styles.submitDisabled : {}) }}
              className="body-submit">
              {loading ? "Analysing Your Profile…" : "Get My Recommendations →"}
            </button>

            {/* Save to profile button (shown after result) */}
            {result && (
              <button type="button" onClick={handleSaveProfile} disabled={saving || saved}
                style={{ ...styles.saveBtn, ...(saved ? styles.saveBtnDone : {}) }}
                className="body-save">
                {saved ? "✓ Profile Saved" : saving ? "Saving…" : "Save to My Profile"}
              </button>
            )}

          </form>
        </div>

        {/* RIGHT COLUMN: RESULTS */}
        {result && (
          <div style={styles.resultCol} className="body-result-col">

            {/* Analysis card */}
            <div style={styles.analysisCard}>
              <p style={styles.overline}>Your Body Analysis</p>

              <div style={styles.analysisGrid}>
                <div style={styles.analysisItem}>
                  <span style={styles.analysisLabel}>BMI</span>
                  <span style={styles.analysisValue}>{result.body_analysis.bmi}</span>
                  <span style={styles.analysisSub}>{result.body_analysis.bmi_category}</span>
                </div>
                <div style={styles.analysisItem}>
                  <span style={styles.analysisLabel}>Style Match</span>
                  <span style={styles.analysisValue}>{result.predictions.style.replace(/_/g, " ")}</span>
                  <span style={styles.analysisSub}>{result.predictions.style_confidence_pct}% confidence</span>
                </div>
                <div style={styles.analysisItem}>
                  <span style={styles.analysisLabel}>Primary Palette</span>
                  <span style={styles.analysisValue}>{result.predictions.color_palette.replace(/_/g, " ")}</span>
                  <span style={styles.analysisSub}>{result.predictions.color_confidence_pct}% confidence</span>
                </div>
                {result.predictions.color_palette_secondary && (
                  <div style={styles.analysisItem}>
                    <span style={styles.analysisLabel}>Alt. Palette</span>
                    <span style={{ ...styles.analysisValue, fontSize: "16px", color: "#9a9590" }}>
                      {result.predictions.color_palette_secondary.replace(/_/g, " ")}
                    </span>
                    <span style={styles.analysisSub}>{result.predictions.color_confidence_secondary_pct}% confidence</span>
                  </div>
                )}
                {result.size_recommendation && (
                  <div style={{ ...styles.analysisItem, ...styles.sizeItem }}>
                    <span style={styles.analysisLabel}>Recommended Size</span>
                    <span style={styles.sizeValue}>{result.size_recommendation.recommended_size}</span>
                    <span style={styles.analysisSub}>{result.size_recommendation.measurements}</span>
                  </div>
                )}
              </div>

              {/* Primary palette swatches */}
              {result.palette_colors.length > 0 && (
                <div style={styles.paletteRow}>
                  <p style={styles.paletteLabel}>
                    {result.predictions.color_palette.replace(/_/g, " ")} — Your Best Colours
                  </p>
                  <div style={styles.swatchRow}>
                    {result.palette_colors.slice(0, 8).map(color => (
                      <div key={color} style={styles.swatchItem}>
                        <div style={{ ...styles.colorSwatch, background: COLOR_HEX[color.toLowerCase()] || color }} />
                        <span style={styles.colorName}>{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Secondary palette swatches */}
              {result.palette_colors_secondary && result.palette_colors_secondary.length > 0 && (
                <div style={{ ...styles.paletteRow, marginTop: "16px" }}>
                  <p style={{ ...styles.paletteLabel, color: "#9a9590" }}>
                    {result.predictions.color_palette_secondary?.replace(/_/g, " ")} — Alternative Palette
                  </p>
                  <div style={styles.swatchRow}>
                    {result.palette_colors_secondary.slice(0, 8).map(color => (
                      <div key={color} style={styles.swatchItem}>
                        <div style={{ ...styles.colorSwatch, background: COLOR_HEX[color.toLowerCase()] || color, opacity: 0.7 }} />
                        <span style={styles.colorName}>{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Products header */}
            <p style={{ ...styles.overline, marginBottom: "20px" }}>
              {result.recommended_products.length} Products Recommended For You
            </p>

            {/* Product grid */}
            <div style={styles.productGrid}>
              {result.recommended_products.map(product => (
                <article key={product.id} style={styles.productCard} className="body-product-card">
                  {/* Product image */}
                  <div style={styles.imageWrap}>
                    <div style={{
                      ...styles.image,
                      background: product.image_url
                        ? `url(${product.image_url}) center/cover no-repeat`
                        : `linear-gradient(135deg, #d4c8b8, #e8ddd0)`,
                    }}>
                      {!product.image_url && (
                        <span style={styles.initial}>{product.name.charAt(0)}</span>
                      )}
                    </div>
                    <span style={styles.catBadge}>{product.category}</span>
                    {product.match_score !== undefined && product.match_score > 0 && (() => {
                      const primaryColors = new Set((result.palette_colors || []).map(c => c.toLowerCase()));
                      const isBestMatch = (product.matching_colors || []).some(c => primaryColors.has(c.toLowerCase()));
                      return (
                        <span style={{
                          ...styles.matchBadge,
                          background: isBestMatch ? 'rgba(26,26,26,0.82)' : '#c9a96e',
                        }}>
                          ✓ {isBestMatch ? "Best" : "Good"} Match
                        </span>
                      );
                    })()}
                    {/* Hover overlay with action buttons */}
                    <div style={styles.overlay} className="body-overlay">
                      <button
                        onClick={() => navigate(`/products/${product.id}`)}
                        style={styles.overlayBtn}
                        className="body-overlay-btn">
                        View Product
                      </button>
                      <button
                        onClick={() => navigate(`/virtual-tryon?productId=${product.id}`)}
                        style={{ ...styles.overlayBtn, ...styles.overlayBtnGold }}
                        className="body-overlay-btn">
                        Try On
                      </button>
                    </div>
                  </div>

                  {/* Product info */}
                  <div style={styles.productBody}
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="body-product-info">
                    <h3 style={styles.productName}>{product.name}</h3>
                    <p style={styles.productPrice}>LKR {product.price.toFixed(0)}</p>
                    {product.matching_colors && product.matching_colors.length > 0 && (
                      <p style={styles.matchColors}>
                        Palette match: {product.matching_colors.join(", ")}
                      </p>
                    )}
                    <div style={styles.sizesRow}>
                      {product.sizes.map(s => (
                        <span key={s} style={styles.sizeChip}>{s}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>

          </div>
        )}

        {/* Empty state before first analysis */}
        {!result && !loading && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>◎</div>
            <p style={styles.emptyTitle}>Your recommendations will appear here</p>
            <p style={styles.emptyText}>
              Fill in your measurements on the left and click
              <br /><strong>Get My Recommendations</strong>
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

/* ─── CSS ─────────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }

  .body-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 2px;
    background: #e8e4de;
    outline: none;
    border-radius: 2px;
    cursor: pointer;
  }
  .body-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #c9a96e;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(201,169,110,0.5);
  }
  .body-submit:hover:not(:disabled) { background: #0c2440 !important; }
  .body-save:hover:not(:disabled)   { background: #b8955a !important; }

  .body-product-card {
    transition: transform 0.25s ease, box-shadow 0.25s ease;
    cursor: pointer;
    position: relative;
  }
  .body-product-card:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(0,0,0,0.09); }
  .body-overlay { opacity: 0; transition: opacity 0.25s ease; }
  .body-product-card:hover .body-overlay { opacity: 1; }
  .body-product-info { cursor: pointer; }
  .body-overlay-btn:hover { opacity: 0.85; }

  /* ── Mobile responsive (Problem 6 fix) ── */
  @media (max-width: 860px) {
    .body-layout {
      display: block !important;
    }
    .body-form-col {
      position: static !important;
      border-right: none !important;
      border-bottom: 1px solid #e8e4de;
      padding: 28px 20px !important;
    }
    .body-result-col {
      padding: 28px 20px !important;
    }
  }
  @media (max-width: 520px) {
    .body-form-col, .body-result-col { padding: 20px 14px !important; }
  }
`;

/* ─── Styles ──────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  wrapper:       { fontFamily: "'Montserrat', sans-serif", background: "#fff", color: "#1a1a1a", minHeight: "100vh" },
  header:        { padding: "80px 48px 48px", background: "linear-gradient(135deg, #fafaf8 0%, #f5f3ef 100%)", borderBottom: "1px solid #e8e4de", maxWidth: "900px" },
  overline:      { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", color: "#c9a96e", marginBottom: "16px", display: "block" },
  title:         { fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(40px,6vw,68px)", fontWeight: 300, lineHeight: 0.95, color: "#1a1a1a", marginBottom: "20px" },
  subtitle:      { fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 300, lineHeight: 1.9, color: "#6b6560", maxWidth: "560px" },
  divider:       { height: "1px", background: "#e8e4de" },
  layout:        { display: "grid", gridTemplateColumns: "minmax(340px,420px) 1fr", gap: 0, minHeight: "calc(100vh - 260px)", alignItems: "start" },
  formCol:       { padding: "48px", borderRight: "1px solid #e8e4de", background: "#fafaf8", position: "sticky", top: 0 },
  form:          { display: "flex", flexDirection: "column", gap: "32px" },
  fieldGroup:    { display: "flex", flexDirection: "column", gap: "12px" },
  label:         { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 500, letterSpacing: "2.5px", textTransform: "uppercase", color: "#6b6560" },
  genderRow:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  genderBtn:     { padding: "14px", background: "#fff", border: "1px solid #d4cfc8", fontFamily: "'Montserrat', sans-serif", fontSize: "12px", fontWeight: 400, letterSpacing: "1px", color: "#6b6560", cursor: "pointer", transition: "all 0.25s ease" },
  genderBtnActive: { background: "#1a1a1a", borderColor: "#1a1a1a", color: "#fff" },
  sliderHeader:  { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sliderValue:   { fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", fontWeight: 400, color: "#c9a96e" },
  slider:        { width: "100%" },
  sliderMarks:   { display: "flex", justifyContent: "space-between" },
  markText:      { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 300, color: "#9a9590" },
  bmiBox:        { display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", background: "#fff", border: "1px solid #e8e4de" },
  bmiLabel:      { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: "#9a9590" },
  bmiValue:      { fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 400, color: "#c9a96e" },
  bmiCat:        { fontFamily: "'Montserrat', sans-serif", fontSize: "12px", fontWeight: 300, color: "#6b6560" },
  skinBtn:       { display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", background: "#fff", border: "1px solid #d4cfc8", cursor: "pointer", textAlign: "left", transition: "all 0.25s ease", marginBottom: "6px" },
  skinBtnActive: { borderColor: "#c9a96e", background: "#fdf8f2" },
  swatch:        { width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0, transition: "border 0.25s ease" },
  skinText:      { display: "flex", flexDirection: "column", gap: "2px" },
  skinName:      { fontFamily: "'Cormorant Garamond', serif", fontSize: "18px", fontWeight: 400, color: "#1a1a1a" },
  skinHint:      { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 300, color: "#6b6560", lineHeight: 1.4 },
  errorBox:      { display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 16px", background: "#fee", border: "1px solid #fcc" },
  errorDot:      { width: "8px", height: "8px", borderRadius: "50%", background: "#c33", marginTop: "5px", flexShrink: 0 },
  errorText:     { fontFamily: "'Montserrat', sans-serif", fontSize: "12px", fontWeight: 300, color: "#c33", lineHeight: 1.6 },
  submitBtn:     { padding: "18px 32px", background: "#1a1a1a", border: "none", color: "#fff", fontFamily: "'Montserrat', sans-serif", fontSize: "11px", fontWeight: 500, letterSpacing: "3px", textTransform: "uppercase", cursor: "pointer", transition: "background 0.3s ease", marginTop: "8px" },
  submitDisabled:{ background: "#d4cfc8", cursor: "not-allowed" },
  saveBtn:       { padding: "14px 32px", background: "#c9a96e", border: "none", color: "#fff", fontFamily: "'Montserrat', sans-serif", fontSize: "11px", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", transition: "background 0.3s ease" },
  saveBtnDone:   { background: "#4a7c59", cursor: "default" },
  resultCol:     { padding: "48px", background: "#fff" },
  analysisCard:  { padding: "36px", background: "linear-gradient(135deg,#fafaf8 0%,#f5f3ef 100%)", border: "1px solid #e8e4de", marginBottom: "40px" },
  analysisGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "24px", marginTop: "20px", marginBottom: "28px" },
  analysisItem:  { display: "flex", flexDirection: "column", gap: "6px" },
  analysisLabel: { fontFamily: "'Montserrat', sans-serif", fontSize: "9px", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: "#9a9590" },
  analysisValue: { fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", fontWeight: 400, color: "#1a1a1a", lineHeight: 1.2 },
  analysisSub:   { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 300, color: "#c9a96e" },
  sizeItem:      { borderLeft: "2px solid #c9a96e", paddingLeft: "14px" },
  sizeValue:     { fontFamily: "'Cormorant Garamond', serif", fontSize: "36px", fontWeight: 400, color: "#c9a96e", lineHeight: 1 },
  paletteRow:    { borderTop: "1px solid #e8e4de", paddingTop: "20px" },
  paletteLabel:  { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: "#6b6560", marginBottom: "12px" },
  swatchRow:     { display: "flex", gap: "12px", flexWrap: "wrap" },
  swatchItem:    { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" },
  colorSwatch:   { width: "32px", height: "32px", borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)" },
  colorName:     { fontFamily: "'Montserrat', sans-serif", fontSize: "9px", fontWeight: 400, color: "#9a9590", textTransform: "capitalize" },
  productGrid:   { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "1px", background: "#e8e4de", border: "1px solid #e8e4de" },
  productCard:   { background: "#fff" },
  imageWrap:     { position: "relative", height: "220px", overflow: "hidden" },
  image:         { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" },
  initial:       { fontFamily: "'Cormorant Garamond', serif", fontSize: "60px", fontWeight: 300, color: "rgba(26,26,26,0.12)" },
  catBadge:      { position: "absolute", top: "12px", left: "12px", fontFamily: "'Montserrat', sans-serif", fontSize: "9px", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: "#fff", background: "rgba(26,26,26,0.7)", padding: "4px 10px" },
  matchBadge:    { position: "absolute", bottom: "12px", right: "12px", fontFamily: "'Montserrat', sans-serif", fontSize: "9px", fontWeight: 500, color: "#fff", background: "#c9a96e", padding: "4px 10px" },
  overlay:       { position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" },
  overlayBtn:    { padding: "10px 24px", background: "#fff", border: "none", fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: "#1a1a1a", cursor: "pointer", width: "160px", transition: "opacity 0.2s" },
  overlayBtnGold:{ background: "#c9a96e", color: "#fff" },
  productBody:   { padding: "18px", display: "flex", flexDirection: "column", gap: "6px" },
  productName:   { fontFamily: "'Cormorant Garamond', serif", fontSize: "18px", fontWeight: 400, color: "#1a1a1a", lineHeight: 1.2 },
  productPrice:  { fontFamily: "'Montserrat', sans-serif", fontSize: "13px", fontWeight: 500, color: "#c9a96e" },
  matchColors:   { fontFamily: "'Montserrat', sans-serif", fontSize: "10px", fontWeight: 300, color: "#9a9590", fontStyle: "italic", textTransform: "capitalize" },
  sizesRow:      { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" },
  sizeChip:      { fontFamily: "'Montserrat', sans-serif", fontSize: "9px", fontWeight: 500, letterSpacing: "1.5px", color: "#6b6560", border: "1px solid #d4cfc8", padding: "3px 8px" },
  emptyState:    { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 48px", color: "#9a9590" },
  emptyIcon:     { fontSize: "64px", marginBottom: "24px", color: "#d4cfc8" },
  emptyTitle:    { fontFamily: "'Cormorant Garamond', serif", fontSize: "24px", fontWeight: 300, color: "#6b6560", marginBottom: "12px" },
  emptyText:     { fontFamily: "'Montserrat', sans-serif", fontSize: "12px", fontWeight: 300, lineHeight: 1.8, textAlign: "center", color: "#9a9590" },
};

export default BodyProfileForm;
