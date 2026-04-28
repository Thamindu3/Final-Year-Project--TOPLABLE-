import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url: string;
  sizes: string[];
  colors: string[];
  similarity_score?: number;
  similarity_percent?: number;
  recommendation_rank?: number;
}

interface RecommendationResponse {
  success: boolean;
  source_product?: Product;
  recommendations: Product[];
  algorithm?: string;
  total_candidates?: number;
  returned?: number;
  features_used?: string[];
  message?: string;
}

const API_BASE_URL = 'http://localhost:8000';

const RecommendationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [sourceProduct, setSourceProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [algorithm, setAlgorithm] = useState<string>('');
  const [featuresUsed, setFeaturesUsed] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    searchParams.get('product_id') ? Number(searchParams.get('product_id')) : null
  );
  const [topK, setTopK] = useState<number>(5);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    fetchAllProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId !== null) {
      fetchRecommendations(selectedProductId);
    } else {
      fetchPopular();
    }
  }, [selectedProductId, topK, categoryFilter]);

  const fetchAllProducts = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/products`);
      setAllProducts(res.data.products || []);
    } catch (e) {
      console.error('Failed to load products', e);
    }
  };

  const fetchRecommendations = async (productId: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        product_id: String(productId),
        top_k: String(topK),
      };
      if (categoryFilter) params.category_filter = categoryFilter;

      const res = await axios.get<RecommendationResponse>(
        `${API_BASE_URL}/api/recommendations`,
        { params }
      );
      if (res.data.success) {
        setSourceProduct(res.data.source_product || null);
        setRecommendations(res.data.recommendations || []);
        setAlgorithm(res.data.algorithm || '');
        setFeaturesUsed(res.data.features_used || []);
      } else {
        setError('Recommendation engine returned an error.');
      }
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
          'Failed to load recommendations. Make sure backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchPopular = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<RecommendationResponse>(
        `${API_BASE_URL}/api/recommendations/popular`,
        { params: { top_k: topK } }
      );
      if (res.data.success) {
        setSourceProduct(null);
        setRecommendations(res.data.recommendations || []);
        setAlgorithm(res.data.algorithm || '');
        setFeaturesUsed([]);
      }
    } catch (e: any) {
      setError('Failed to load popular products.');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (id: number) => {
    setSelectedProductId(id);
    setSearchParams({ product_id: String(id) });
  };

  const handleReset = () => {
    setSelectedProductId(null);
    setSearchParams({});
    setCategoryFilter('');
  };

  const categories = Array.from(new Set(allProducts.map((p) => p.category))).sort();

  /* ─── Loading ─────────────────────────────────────── */
  if (loading) {
    return (
      <div style={loadingWrapStyle}>
        <style>{fonts}</style>
        <div style={loadingInnerStyle}>
          <div style={loadingBarStyle} />
          <p style={loadingTextStyle}>Analysing Recommendations</p>
        </div>
      </div>
    );
  }

  /* ─── Error ───────────────────────────────────────── */
  if (error) {
    return (
      <div style={errorWrapStyle}>
        <style>{fonts}</style>
        <p style={errorOverlineStyle}>Error</p>
        <h2 style={errorTitleStyle}>Recommendations Unavailable</h2>
        <p style={errorMsgStyle}>{error}</p>
        <button
          onClick={() =>
            selectedProductId ? fetchRecommendations(selectedProductId) : fetchPopular()
          }
          style={retryBtnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#c9a96e')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
        >
          Retry
        </button>
      </div>
    );
  }

  /* ─── Main render ────────────────────────────────── */
  return (
    <div style={wrapperStyle}>
      <style>{fonts + dynamicCSS}</style>

      <Navbar />

      {/* ── PAGE HEADER ── */}
      <header style={pageHeaderStyle}>
        <div style={pageHeaderInnerStyle}>
          <p style={pageOverlineStyle}>AI-Powered Discovery</p>
          <h1 style={pageTitleStyle}>
            Style<br />
            <em>Recommendations</em>
          </h1>
          <p style={pageSubtitleStyle}>
            {sourceProduct
              ? `Showing items similar to "${sourceProduct.name}"`
              : 'Curated picks across our collection'}
          </p>
        </div>
        <div style={headerMetaStyle}>
          {algorithm && (
            <div style={algorithmBadgeStyle}>
              <span style={algorithmDotStyle} />
              <p style={algorithmTextStyle}>{algorithm}</p>
            </div>
          )}
          {featuresUsed.length > 0 && (
            <div style={featuresRowStyle}>
              {featuresUsed.map((f) => (
                <span key={f} style={featurePillStyle}>
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── DIVIDER ── */}
      <div style={dividerStyle} />

      {/* ── CONTROLS ── */}
      <section style={controlsSectionStyle}>
        <div style={controlsInnerStyle}>
          {/* Source product selector */}
          <div style={controlGroupStyle}>
            <label style={controlLabelStyle}>Base Product</label>
            <select
              value={selectedProductId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  handleReset();
                } else {
                  handleProductSelect(Number(val));
                }
              }}
              style={selectStyle}
            >
              <option value=''>— Popular Picks —</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div style={controlGroupStyle}>
            <label style={controlLabelStyle}>Filter by Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={selectStyle}
            >
              <option value=''>All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Top K selector */}
          <div style={controlGroupStyle}>
            <label style={controlLabelStyle}>Results Count</label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={selectStyle}
            >
              {[3, 4, 5, 6, 8].map((k) => (
                <option key={k} value={k}>
                  Top {k}
                </option>
              ))}
            </select>
          </div>

          {/* Reset */}
          {selectedProductId && (
            <button
              onClick={handleReset}
              style={resetBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#c9a96e';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = '#c9a96e';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#1a1a1a';
                e.currentTarget.style.borderColor = '#1a1a1a';
              }}
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* ── SOURCE PRODUCT CARD ── */}
      {sourceProduct && (
        <section style={sourceSectionStyle}>
          <div style={sourceInnerStyle}>
            <p style={sourceOverlineStyle}>Recommending based on</p>
            <div style={sourceCardStyle}>
              <div
                style={{
                  ...sourceImageStyle,
                  background: sourceProduct.image_url
                    ? `url(http://localhost:8000${sourceProduct.image_url}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${getCategoryColor(sourceProduct.category)} 0%, #e8ddd0 100%)`,
                }}
              >
                {!sourceProduct.image_url && (
                  <span style={sourceInitialStyle}>{sourceProduct.name.charAt(0)}</span>
                )}
              </div>
              <div style={sourceBodyStyle}>
                <span style={sourceCategoryStyle}>{sourceProduct.category}</span>
                <h3 style={sourceNameStyle}>{sourceProduct.name}</h3>
                <p style={sourcePriceStyle}>LKR {sourceProduct.price.toFixed(0)}</p>
                <p style={sourceDescStyle}>{sourceProduct.description}</p>
                <div style={sourceSizesStyle}>
                  {sourceProduct.sizes.map((s) => (
                    <span key={s} style={sizeChipStyle}>{s}</span>
                  ))}
                </div>
                <Link to='/virtual-tryon' style={sourceTryOnBtnStyle}>
                  Try On →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── RECOMMENDATIONS GRID ── */}
      <main style={gridWrapStyle}>
        {recommendations.length === 0 ? (
          <div style={emptyStateStyle}>
            <p style={emptyOverlineStyle}>No Results</p>
            <h2 style={emptyTitleStyle}>No Recommendations Found</h2>
            <p style={emptyMsgStyle}>
              Try selecting a different base product or removing the category filter.
            </p>
          </div>
        ) : (
          <>
            <div style={gridHeaderStyle}>
              <p style={pageOverlineStyle}>
                {recommendations.length} Suggestion{recommendations.length !== 1 ? 's' : ''}
              </p>
              {sourceProduct && (
                <p style={pageCountStyle}>
                  Sorted by similarity score
                </p>
              )}
            </div>

            <div style={productGridStyle}>
              {recommendations.map((product, i) => (
                <article
                  key={product.id}
                  style={{
                    ...cardStyle,
                    animationDelay: `${i * 80}ms`,
                  }}
                  className='viton-rec-card'
                  onMouseEnter={() => setHoveredId(product.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Image */}
                  <div style={cardImageWrapStyle}>
                    <div
                      style={{
                        ...cardImageStyle,
                        background: product.image_url
                          ? `url(http://localhost:8000${product.image_url}) center/cover no-repeat`
                          : `linear-gradient(135deg, ${getCategoryColor(product.category)} 0%, #e8ddd0 100%)`,
                      }}
                    >
                      {!product.image_url && (
                        <span style={cardInitialStyle}>{product.name.charAt(0)}</span>
                      )}
                    </div>

                    {/* Hover overlay */}
                    <div
                      style={{
                        ...cardOverlayStyle,
                        opacity: hoveredId === product.id ? 1 : 0,
                      }}
                    >
                      <button
                        style={quickViewBtnStyle}
                        onClick={() => handleProductSelect(product.id)}
                      >
                        Find Similar
                      </button>
                    </div>

                    {/* Category badge */}
                    <span style={categoryBadgeStyle}>{product.category}</span>

                    {/* Similarity badge — only shown when a source product is selected */}
                    {product.similarity_percent !== undefined && (
                      <span style={similarityBadgeStyle}>
                        {product.similarity_percent}% match
                      </span>
                    )}

                    {/* Rank badge */}
                    {product.recommendation_rank !== undefined && (
                      <span style={rankBadgeStyle}>#{product.recommendation_rank}</span>
                    )}
                  </div>

                  {/* Card body */}
                  <div style={cardBodyStyle}>
                    <div style={cardTopRowStyle}>
                      <h3 style={cardNameStyle}>{product.name}</h3>
                      <p style={cardPriceStyle}>LKR {product.price.toFixed(0)}</p>
                    </div>

                    <p style={cardDescStyle}>{product.description}</p>

                    {/* Similarity bar */}
                    {product.similarity_percent !== undefined && (
                      <div style={simBarWrapStyle}>
                        <div style={simBarLabelRowStyle}>
                          <span style={simBarLabelStyle}>Similarity</span>
                          <span style={simBarValueStyle}>{product.similarity_percent}%</span>
                        </div>
                        <div style={simBarTrackStyle}>
                          <div
                            style={{
                              ...simBarFillStyle,
                              width: `${product.similarity_percent}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={cardFooterStyle}>
                      <div style={sizesWrapStyle}>
                        {product.sizes.map((size) => (
                          <span key={size} style={sizeChipStyle}>
                            {size}
                          </span>
                        ))}
                      </div>
                      <div style={actionBtnsStyle}>
                        <button
                          style={findSimilarBtnStyle}
                          onClick={() => handleProductSelect(product.id)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f5f3ef';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          Similar
                        </button>
                        <Link to='/virtual-tryon' style={tryOnBtnStyle}>
                          Try On
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── HOW IT WORKS SECTION ── */}
      <section style={howItWorksSectionStyle}>
        <div style={howItWorksInnerStyle}>
          <p style={pageOverlineStyle}>About This Feature</p>
          <h2 style={sectionTitleStyle}>
            How AI Recommendations
            <br />
            <em>Work</em>
          </h2>
        </div>

        <div style={howItWorksGridStyle}>
          {[
            {
              num: '01',
              title: 'Feature Extraction',
              desc: 'Each product is converted into a numeric vector using its category, price range, available colours, and sizes.',
            },
            {
              num: '02',
              title: 'KNN Algorithm',
              desc: 'K-Nearest Neighbours with cosine similarity finds the products whose feature vectors are closest to your selected item.',
            },
            {
              num: '03',
              title: 'Ranked Results',
              desc: 'Products are ranked by similarity score — a higher percentage means more attributes in common with your chosen item.',
            },
            {
              num: '04',
              title: 'Content-Based',
              desc: 'No user history needed. Recommendations are based purely on product attributes, solving the cold-start problem.',
            },
          ].map((item) => (
            <div key={item.num} className='viton-info-card' style={infoCardStyle}>
              <span style={infoNumStyle}>{item.num}</span>
              <h3 style={infoTitleStyle}>{item.title}</h3>
              <p style={infoDescStyle}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={ctaSectionStyle}>
        <div style={ctaInnerStyle}>
          <p style={pageOverlineStyle}>Next Step</p>
          <h2 style={ctaTitleStyle}>
            See How the Garment
            <br />
            <em>Looks on You</em>
          </h2>
          <div style={ctaButtonsStyle}>
            <Link to='/virtual-tryon' style={btnPrimaryStyle}>
              Try It On
            </Link>
            <Link to='/products' style={btnSecondaryStyle}>
              Browse Collection
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ─── Helper ──────────────────────────────────────────────────────────── */
function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    tops: '#d4c8b8',
    bottoms: '#c8d0d4',
    dresses: '#d4c8cc',
    outerwear: '#c8ccc0',
    accessories: '#d0d4c8',
  };
  return map[cat?.toLowerCase()] || '#d4cfc8';
}

/* ─── CSS ─────────────────────────────────────────────────────────────── */
const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
`;

const dynamicCSS = `
  .viton-rec-card {
    animation: fadeSlideUp 0.6s both;
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .viton-rec-card:hover .viton-rec-image {
    transform: scale(1.04);
  }
  .viton-info-card {
    transition: background 0.3s ease, transform 0.2s ease;
  }
  .viton-info-card:hover {
    background: #f2ede7 !important;
    transform: translateY(-2px);
  }
`;

/* Wrapper */
const wrapperStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  background: '#fff',
  color: '#1a1a1a',
  minHeight: '100vh',
};

/* Loading */
const loadingWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fafaf8',
};
const loadingInnerStyle: React.CSSProperties = { textAlign: 'center' };
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

/* Error */
const errorWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px',
  background: '#fafaf8',
  textAlign: 'center',
};
const errorOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};
const errorTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '40px',
  fontWeight: 300,
  color: '#1a1a1a',
  marginBottom: '16px',
};
const errorMsgStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  color: '#6b6560',
  marginBottom: '36px',
  maxWidth: '400px',
  lineHeight: 1.8,
};
const retryBtnStyle: React.CSSProperties = {
  padding: '14px 40px',
  background: '#1a1a1a',
  color: '#fff',
  border: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'background 0.3s ease',
};

/* Page Header */
const pageHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '72px 48px 40px',
  flexWrap: 'wrap',
  gap: '24px',
  background: 'linear-gradient(135deg, #fafaf8 0%, #f5f3ef 100%)',
  borderBottom: '1px solid #e8e4de',
};
const pageHeaderInnerStyle: React.CSSProperties = {};
const pageOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '12px',
};
const pageTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(40px, 6vw, 72px)',
  fontWeight: 300,
  lineHeight: 0.95,
  color: '#1a1a1a',
  marginBottom: '16px',
};
const pageSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  color: '#6b6560',
  maxWidth: '400px',
  lineHeight: 1.8,
};
const pageCountStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 400,
  letterSpacing: '2px',
  color: '#9a9590',
  textTransform: 'uppercase',
};
const headerMetaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  alignItems: 'flex-end',
};
const algorithmBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  background: '#fff',
  border: '1px solid #e8e4de',
};
const algorithmDotStyle: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: '#c9a96e',
  flexShrink: 0,
};
const algorithmTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 400,
  letterSpacing: '1px',
  color: '#6b6560',
};
const featuresRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};
const featurePillStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  padding: '4px 10px',
  border: '1px solid #d4cfc8',
  color: '#6b6560',
};

/* Divider */
const dividerStyle: React.CSSProperties = {
  height: '1px',
  background: '#e8e4de',
};

/* Controls */
const controlsSectionStyle: React.CSSProperties = {
  padding: '32px 48px',
  borderBottom: '1px solid #e8e4de',
  background: '#fafaf8',
};
const controlsInnerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'flex',
  gap: '24px',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
};
const controlGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  flex: '1 1 200px',
  minWidth: '180px',
  maxWidth: '320px',
};
const controlLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#6b6560',
};
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cfcfcf',
  background: '#fff',
  outline: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  color: '#1a1a1a',
  cursor: 'pointer',
};
const resetBtnStyle: React.CSSProperties = {
  padding: '12px 24px',
  background: 'transparent',
  border: '1px solid #1a1a1a',
  color: '#1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  alignSelf: 'flex-end',
};

/* Source product section */
const sourceSectionStyle: React.CSSProperties = {
  padding: '48px 48px 0',
  background: '#fff',
};
const sourceInnerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
};
const sourceOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};
const sourceCardStyle: React.CSSProperties = {
  display: 'flex',
  gap: '32px',
  padding: '32px',
  background: '#fafaf8',
  border: '1px solid #e8e4de',
  flexWrap: 'wrap',
};
const sourceImageStyle: React.CSSProperties = {
  width: '160px',
  height: '200px',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};
const sourceInitialStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '60px',
  fontWeight: 300,
  color: 'rgba(26,26,26,0.15)',
};
const sourceBodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};
const sourceCategoryStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#c9a96e',
};
const sourceNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '28px',
  fontWeight: 400,
  color: '#1a1a1a',
  lineHeight: 1.2,
};
const sourcePriceStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '14px',
  fontWeight: 500,
  color: '#c9a96e',
};
const sourceDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  color: '#6b6560',
  lineHeight: 1.8,
  maxWidth: '480px',
};
const sourceSizesStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
};
const sourceTryOnBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '8px',
  padding: '10px 24px',
  background: '#c9a96e',
  color: '#fff',
  textDecoration: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  width: 'fit-content',
};

/* Grid */
const gridWrapStyle: React.CSSProperties = {
  padding: '48px',
};
const gridHeaderStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '12px',
};
const productGridStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '1px',
  background: '#e8e4de',
  border: '1px solid #e8e4de',
};

/* Empty state */
const emptyStateStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '80px 48px',
  textAlign: 'center',
};
const emptyOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};
const emptyTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '36px',
  fontWeight: 300,
  color: '#1a1a1a',
  marginBottom: '16px',
};
const emptyMsgStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  color: '#6b6560',
  lineHeight: 1.8,
};

/* Product card — identical to ProductsPage */
const cardStyle: React.CSSProperties = {
  background: '#fff',
  cursor: 'pointer',
};
const cardImageWrapStyle: React.CSSProperties = {
  position: 'relative',
  height: '280px',
  overflow: 'hidden',
};
const cardImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 0.6s ease',
};
const cardInitialStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '80px',
  fontWeight: 300,
  color: 'rgba(26,26,26,0.15)',
  userSelect: 'none',
};
const cardOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(26,26,26,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'opacity 0.3s ease',
};
const quickViewBtnStyle: React.CSSProperties = {
  padding: '12px 28px',
  background: '#fff',
  border: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  color: '#1a1a1a',
};
const categoryBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '16px',
  left: '16px',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#fff',
  background: 'rgba(26,26,26,0.7)',
  padding: '5px 10px',
};
const similarityBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '16px',
  right: '16px',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1px',
  color: '#fff',
  background: '#c9a96e',
  padding: '4px 10px',
};
const rankBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '16px',
  fontWeight: 400,
  color: '#c9a96e',
  background: '#fff',
  padding: '2px 8px',
  border: '1px solid #e8e4de',
};
const cardBodyStyle: React.CSSProperties = {
  padding: '24px',
};
const cardTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '10px',
  gap: '12px',
};
const cardNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '22px',
  fontWeight: 400,
  color: '#1a1a1a',
  lineHeight: 1.2,
};
const cardPriceStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 500,
  color: '#c9a96e',
  whiteSpace: 'nowrap',
};
const cardDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 300,
  lineHeight: 1.8,
  color: '#6b6560',
  marginBottom: '16px',
};

/* Similarity bar */
const simBarWrapStyle: React.CSSProperties = {
  marginBottom: '16px',
};
const simBarLabelRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '6px',
};
const simBarLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#9a9590',
};
const simBarValueStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  color: '#c9a96e',
};
const simBarTrackStyle: React.CSSProperties = {
  height: '2px',
  background: '#e8e4de',
  width: '100%',
};
const simBarFillStyle: React.CSSProperties = {
  height: '2px',
  background: '#c9a96e',
  transition: 'width 0.6s ease',
};

/* Card footer */
const cardFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
};
const sizesWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
};
const sizeChipStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  color: '#6b6560',
  border: '1px solid #d4cfc8',
  padding: '4px 8px',
};
const actionBtnsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};
const findSimilarBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  border: '1px solid #d4cfc8',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  color: '#6b6560',
  transition: 'background 0.2s ease',
};
const tryOnBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 14px',
  background: '#1a1a1a',
  border: '1px solid #1a1a1a',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  color: '#fff',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

/* How It Works section */
const howItWorksSectionStyle: React.CSSProperties = {
  padding: '80px 48px',
  background: '#fafaf8',
  borderTop: '1px solid #e8e4de',
};
const howItWorksInnerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto 48px',
};
const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(32px, 5vw, 52px)',
  fontWeight: 300,
  lineHeight: 1.2,
  color: '#1a1a1a',
  marginTop: '12px',
};
const howItWorksGridStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '1px',
  background: '#e8e4de',
  border: '1px solid #e8e4de',
};
const infoCardStyle: React.CSSProperties = {
  padding: '48px 36px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};
const infoNumStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '14px',
  fontWeight: 400,
  letterSpacing: '2px',
  color: '#c9a96e',
};
const infoTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '24px',
  fontWeight: 400,
  color: '#1a1a1a',
  lineHeight: 1.2,
};
const infoDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: '#6b6560',
};

/* CTA */
const ctaSectionStyle: React.CSSProperties = {
  padding: '100px 48px',
  background: 'linear-gradient(135deg, #fafaf8 0%, #f5f3ef 100%)',
  borderTop: '1px solid #e8e4de',
};
const ctaInnerStyle: React.CSSProperties = {
  maxWidth: '700px',
  margin: '0 auto',
  textAlign: 'center',
};
const ctaTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(36px, 5vw, 56px)',
  fontWeight: 300,
  lineHeight: 1.2,
  color: '#1a1a1a',
  marginBottom: '48px',
  marginTop: '24px',
};
const ctaButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  justifyContent: 'center',
  flexWrap: 'wrap',
};
const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '16px 40px',
  background: '#c9a96e',
  color: '#fff',
  textDecoration: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  transition: 'background 0.3s ease',
};
const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '15px 40px',
  background: 'transparent',
  color: '#1a1a1a',
  textDecoration: 'none',
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  border: '1px solid #1a1a1a',
  transition: 'all 0.3s ease',
};

export default RecommendationPage;