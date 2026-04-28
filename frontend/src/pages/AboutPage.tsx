import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const AboutPage: React.FC = () => {
  return (
    <div style={wrapperStyle}>
      <style>{fonts + dynamicCSS}</style>

      <Navbar />

      {/* ── HERO SECTION ── */}
      <section style={heroSectionStyle}>
        <div style={heroInnerStyle}>
          <p style={heroOverlineStyle}>About Us</p>
          <h1 style={heroTitleStyle}>
            Bridging the Gap Between
            <br />
            <em>Digital & Physical Fashion</em>
          </h1>
          <p style={heroSubtitleStyle}>
            We are pioneering AI-powered virtual try-on experiences that help shoppers feel confident
            before they buy. Our mission is to transform online fashion retail through intelligent,
            accessible technology designed for the Sri Lankan market.
          </p>
        </div>
      </section>

      {/* ── MISSION STATEMENT ── */}
      <section style={missionSectionStyle}>
        <div style={missionInnerStyle}>
          <div style={missionColStyle}>
            <p style={sectionOverlineStyle}>Our Mission</p>
            <h2 style={sectionTitleStyle}>
              Making Online Fashion
              <br />
              <em>Feel Real</em>
            </h2>
          </div>
          <div style={missionTextColStyle}>
            <p style={bodyTextStyle}>
              Shopping for clothes online should not feel like a gamble. We believe every customer
              deserves to see how a garment will actually look on their unique body before making a
              purchase decision.
            </p>
            <p style={bodyTextStyle}>
              By combining advanced computer vision models with personalized recommendation engines,
              we are building tools that reduce uncertainty, increase confidence, and help local
              fashion brands compete in the digital age.
            </p>
          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY SECTION ── */}
      <section style={techSectionStyle}>
        <div style={techHeaderStyle}>
          <p style={sectionOverlineStyle}>Technology</p>
          <h2 style={sectionTitleStyle}>
            Powered by
            <br />
            <em>Cutting-Edge AI</em>
          </h2>
        </div>

        <div style={techGridStyle}>
          {[
            {
              label: 'VITON-HD',
              title: 'Virtual Try-On',
              desc: 'Our 2D image-based virtual try-on system uses the VITON-HD deep learning model to realistically overlay clothing onto your photo while preserving texture, fit, and pose.',
            },
            {
              label: 'KNN Algorithm',
              title: 'Smart Recommendations',
              desc: 'A content-based recommendation engine analyzes product attributes, your style preferences, and interaction history to suggest outfits you will love.',
            },
            {
              label: 'FastAPI Backend',
              title: 'Lightning Fast',
              desc: 'Built on Python FastAPI for high-performance image processing, our backend handles uploads, model inference, and results delivery in seconds.',
            },
          ].map((item, i) => (
            <div key={i} className="viton-tech-card" style={techCardStyle}>
              <span style={techLabelStyle}>{item.label}</span>
              <h3 style={techTitleStyle}>{item.title}</h3>
              <p style={techDescStyle}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── VALUES SECTION ── */}
      <section style={valuesSectionStyle}>
        <div style={valuesHeaderStyle}>
          <p style={sectionOverlineStyle}>Our Values</p>
          <h2 style={sectionTitleStyle}>
            What We
            <br />
            <em>Stand For</em>
          </h2>
        </div>

        <div style={valuesGridStyle}>
          {[
            {
              num: '01',
              title: 'Accessibility',
              desc: 'Advanced AI should not be exclusive to global giants. We are making virtual try-on technology accessible for Sri Lankan SMEs and local brands.',
            },
            {
              num: '02',
              title: 'Privacy First',
              desc: 'Your photos are processed securely and never stored permanently. We believe in transparency and respect for user data.',
            },
            {
              num: '03',
              title: 'Local Context',
              desc: 'Our models and recommendations are built with Sri Lankan body types, fashion preferences, and cultural context in mind.',
            },
            {
              num: '04',
              title: 'Open Innovation',
              desc: 'We leverage open-source tools and frameworks to keep costs low while maintaining cutting-edge capabilities.',
            },
          ].map((item) => (
            <div key={item.num} className="viton-value-card" style={valueCardStyle}>
              <span style={valueNumStyle}>{item.num}</span>
              <h3 style={valueTitleStyle}>{item.title}</h3>
              <p style={valueDescStyle}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── IMPACT STATS ── */}
      <section style={statsSectionStyle}>
        <div style={statsInnerStyle}>
          {[
            { value: '2D', label: 'Image-Based System' },
            { value: 'PyTorch', label: 'Framework' },
            { value: 'Open Source', label: 'Philosophy' },
            { value: 'Sri Lanka', label: 'Designed For' },
          ].map((s, i) => (
            <div key={i} className={i > 0 ? 'viton-stat' : ''} style={statItemStyle}>
              <p style={statValueStyle}>{s.value}</p>
              <p style={statLabelStyle}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TEAM SECTION ── */}
      <section style={teamSectionStyle}>
        <div style={teamHeaderStyle}>
          <p style={sectionOverlineStyle}>The Team</p>
          <h2 style={sectionTitleStyle}>
            Built by Students,
            <br />
            <em>For the Future</em>
          </h2>
        </div>

        <div style={teamContentStyle}>
          <p style={bodyTextStyle}>
            This project was developed as part of the PUSL3190 Computing Project at the University
            of Plymouth, supervised by Miss. Chathurma Wijesinghe. It represents months of research,
            development, and testing to create a functional prototype that demonstrates how AI can
            transform the online fashion retail experience.
          </p>
          <p style={bodyTextStyle}>
            The goal was not just to build a working system - it was to prove that advanced
            e-commerce features can be implemented affordably using open-source tools, making them
            accessible to local businesses who need them most.
          </p>

          <div style={teamMetaStyle}>
            <div style={teamMetaItemStyle}>
              <p style={teamMetaLabelStyle}>Project</p>
              <p style={teamMetaValueStyle}>PUSL3190 Computing Project</p>
            </div>
            <div style={teamMetaItemStyle}>
              <p style={teamMetaLabelStyle}>Supervisor</p>
              <p style={teamMetaValueStyle}>Miss. Chathurma Wijesinghe</p>
            </div>
            <div style={teamMetaItemStyle}>
              <p style={teamMetaLabelStyle}>Institution</p>
              <p style={teamMetaValueStyle}>University of Plymouth</p>
            </div>
            <div style={teamMetaItemStyle}>
              <p style={teamMetaLabelStyle}>Program</p>
              <p style={teamMetaValueStyle}>BSc (Hons) Computer Science</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── RESEARCH SECTION ── */}
      <section style={researchSectionStyle}>
        <div style={researchInnerStyle}>
          <div style={researchColStyle}>
            <p style={sectionOverlineStyle}>Research & Development</p>
            <h2 style={sectionTitleStyle}>
              Academic
              <br />
              <em>Foundation</em>
            </h2>
          </div>
          <div style={researchTextColStyle}>
            <p style={bodyTextStyle}>
              Our work is built on peer-reviewed research in computer vision, virtual try-on
              networks, and fashion recommendation systems. We have studied approaches from VITON (Han
              et al., 2018) to recent context-aware models adapted for South Asian populations.
            </p>
            <p style={bodyTextStyle}>
              Key research areas include image-based garment transfer, pose estimation, human
              parsing, content-based filtering, and cold-start recommendation challenges specific to
              emerging e-commerce markets.
            </p>

            <div style={researchLinksStyle}>
              <a href="#" style={researchLinkStyle}>
                Read the Full Report →
              </a>
              <a href="#" style={researchLinkStyle}>
                View Bibliography →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={finalCTAStyle}>
        <div style={finalCTAInnerStyle}>
          <p style={finalCTAOverlineStyle}>Experience It Yourself</p>
          <h2 style={finalCTATitleStyle}>
            See How Virtual Try-On
            <br />
            <em>Can Work For You</em>
          </h2>
          <div style={finalCTAButtonsStyle}>
            <Link to="/virtual-tryon" style={btnPrimaryStyle}>
              Try It Now
            </Link>
            <Link to="/products" style={btnSecondaryStyle}>
              Browse Products
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ─── CSS ─────────────────────────────────────────────────────────────── */

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
`;

const dynamicCSS = `
  .viton-tech-card, .viton-value-card {
    transition: background 0.3s ease, transform 0.2s ease;
  }
  .viton-tech-card:hover, .viton-value-card:hover {
    background: #f2ede7;
    transform: translateY(-2px);
  }
  .viton-stat {
    border-left: 1px solid #d4cfc8;
  }
`;

const wrapperStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  background: '#fff',
  color: '#1a1a1a',
  minHeight: '100vh',
};

/* Hero */
const heroSectionStyle: React.CSSProperties = {
  padding: '120px 48px 80px',
  background: 'linear-gradient(135deg, #fafaf8 0%, #f5f3ef 100%)',
  borderBottom: '1px solid #e8e4de',
};

const heroInnerStyle: React.CSSProperties = {
  maxWidth: '900px',
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
  marginBottom: '24px',
};

const heroTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(48px, 7vw, 80px)',
  fontWeight: 300,
  lineHeight: 1.1,
  color: '#1a1a1a',
  marginBottom: '32px',
};

const heroSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '14px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: '#6b6560',
  maxWidth: '700px',
  margin: '0 auto',
};

/* Mission */
const missionSectionStyle: React.CSSProperties = {
  padding: '100px 48px',
  borderBottom: '1px solid #e8e4de',
};

const missionInnerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '64px',
  alignItems: 'flex-start',
};

const missionColStyle: React.CSSProperties = {};

const missionTextColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const sectionOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '16px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(36px, 5vw, 56px)',
  fontWeight: 300,
  lineHeight: 1.2,
  color: '#1a1a1a',
};

const bodyTextStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 300,
  lineHeight: 2,
  color: '#6b6560',
};

/* Technology */
const techSectionStyle: React.CSSProperties = {
  padding: '100px 48px',
  background: '#fafaf8',
};

const techHeaderStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto 64px',
};

const techGridStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '1px',
  background: '#e8e4de',
  border: '1px solid #e8e4de',
};

const techCardStyle: React.CSSProperties = {
  padding: '48px 36px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const techLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: '#c9a96e',
};

const techTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '28px',
  fontWeight: 400,
  color: '#1a1a1a',
  lineHeight: 1.2,
};

const techDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: '#6b6560',
};

/* Values */
const valuesSectionStyle: React.CSSProperties = {
  padding: '100px 48px',
  borderBottom: '1px solid #e8e4de',
};

const valuesHeaderStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto 64px',
};

const valuesGridStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1px',
  background: '#e8e4de',
  border: '1px solid #e8e4de',
};

const valueCardStyle: React.CSSProperties = {
  padding: '48px 36px',
  background: '#fafaf8',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const valueNumStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '14px',
  fontWeight: 400,
  letterSpacing: '2px',
  color: '#c9a96e',
};

const valueTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '26px',
  fontWeight: 400,
  color: '#1a1a1a',
  lineHeight: 1.2,
};

const valueDescStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.9,
  color: '#6b6560',
};

/* Stats */
const statsSectionStyle: React.CSSProperties = {
  background: '#1a1a1a',
  borderTop: '1px solid rgba(255,255,255,0.08)',
};

const statsInnerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
};

const statItemStyle: React.CSSProperties = {
  padding: '56px 36px',
  textAlign: 'center',
};

const statValueStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '32px',
  fontWeight: 300,
  color: '#c9a96e',
  marginBottom: '12px',
  letterSpacing: '1px',
};

const statLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 400,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.5)',
};

/* Team */
const teamSectionStyle: React.CSSProperties = {
  padding: '100px 48px',
  background: '#fafaf8',
};

const teamHeaderStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto 48px',
};

const teamContentStyle: React.CSSProperties = {
  maxWidth: '800px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const teamMetaStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '32px',
  marginTop: '48px',
  padding: '48px',
  background: '#fff',
  border: '1px solid #e8e4de',
};

const teamMetaItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const teamMetaLabelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  color: '#c9a96e',
};

const teamMetaValueStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '13px',
  fontWeight: 400,
  color: '#1a1a1a',
};

/* Research */
const researchSectionStyle: React.CSSProperties = {
  padding: '100px 48px',
  borderTop: '1px solid #e8e4de',
};

const researchInnerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '64px',
  alignItems: 'flex-start',
};

const researchColStyle: React.CSSProperties = {};

const researchTextColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const researchLinksStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  marginTop: '16px',
};

const researchLinkStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#1a1a1a',
  textDecoration: 'none',
  borderBottom: '1px solid #1a1a1a',
  paddingBottom: '4px',
  display: 'inline-block',
  width: 'fit-content',
  transition: 'color 0.3s, border-color 0.3s',
};

/* Final CTA */
const finalCTAStyle: React.CSSProperties = {
  padding: '120px 48px',
  background: 'linear-gradient(135deg, #fafaf8 0%, #f5f3ef 100%)',
  borderTop: '1px solid #e8e4de',
};

const finalCTAInnerStyle: React.CSSProperties = {
  maxWidth: '700px',
  margin: '0 auto',
  textAlign: 'center',
};

const finalCTAOverlineStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  marginBottom: '24px',
};

const finalCTATitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(36px, 5vw, 56px)',
  fontWeight: 300,
  lineHeight: 1.2,
  color: '#1a1a1a',
  marginBottom: '48px',
};

const finalCTAButtonsStyle: React.CSSProperties = {
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

export default AboutPage;