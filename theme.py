"""
theme.py — Ultra-Modern F1 Race Control & Pit-Wall Telemetry Design System.

Visual identity grounded in real F1 timing towers, telemetry consoles, and
Pirelli tyre compound standards:
  - F1 Racing Red (#E10600) = brand highlight / aggressive braking / alert
  - Neon Cyan (#00E5FF) = speed telemetry / primary accent
  - Sector Purple (#B026FF) = fastest / personal best sector
  - Pirelli Tyre Compounds: Soft (#FF1801), Medium (#FFD200), Hard (#FFFFFF), Inter (#39B54A), Wet (#0072CE)
  - Telemetry Amber (#FF8C00) = active lap / session delta
  - Track Green (#00E676) = throttle / open DRS / green flag
"""

import streamlit as st
import numpy as np

COLORS = {
    "bg": "#0B0E14",
    "bg_card": "rgba(20, 26, 36, 0.75)",
    "bg_card_solid": "#141A24",
    "bg_card_alt": "rgba(28, 36, 50, 0.8)",
    "bg_glass": "rgba(15, 20, 30, 0.65)",
    "border": "#232D3F",
    "border_highlight": "#38455A",
    "border_glow": "rgba(0, 229, 255, 0.3)",
    "text": "#F0F4F8",
    "text_muted": "#8E9AA8",
    "text_dim": "#5C6777",
    "f1_red": "#E10600",
    "f1_red_glow": "rgba(225, 6, 0, 0.4)",
    "cyan": "#00E5FF",
    "cyan_glow": "rgba(0, 229, 255, 0.35)",
    "purple": "#B026FF",
    "purple_glow": "rgba(176, 38, 255, 0.35)",
    "amber": "#FF8C00",
    "positive": "#00E676",
    "negative": "#FF2A4D",
    # Pirelli Tyre Compounds
    "soft": "#FF1801",
    "medium": "#FFD200",
    "hard": "#FFFFFF",
    "inter": "#39B54A",
    "wet": "#0072CE",
}

FONT_DISPLAY = "'Orbitron', 'Rajdhani', sans-serif"
FONT_TECH = "'Rajdhani', sans-serif"
FONT_MONO = "'JetBrains Mono', 'Roboto Mono', monospace"
FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"


def inject_css():
    st.markdown(f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700;800&family=Orbitron:wght@500;600;700;800;900&family=Rajdhani:wght@500;600;700&display=swap');

    /* Global Root Variables & Reset */
    :root {{
        --bg-main: {COLORS['bg']};
        --f1-red: {COLORS['f1_red']};
        --cyan: {COLORS['cyan']};
        --purple: {COLORS['purple']};
        --text: {COLORS['text']};
    }}

    html, body, [class*="css"] {{
        font-family: {FONT_BODY};
        color: {COLORS['text']};
        letter-spacing: -0.01em;
    }}

    /* Futuristic Carbon/Grid Backdrop */
    .stApp {{
        background-color: {COLORS['bg']};
        background-image: 
            radial-gradient(circle at 15% 15%, rgba(0, 229, 255, 0.035) 0%, transparent 40%),
            radial-gradient(circle at 85% 85%, rgba(225, 6, 0, 0.035) 0%, transparent 40%),
            linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
        background-size: 100% 100%, 100% 100%, 36px 36px, 36px 36px;
        background-attachment: fixed;
    }}

    /* Main Container Padding */
    .block-container {{
        padding-top: 1.5rem !important;
        padding-bottom: 3rem !important;
        max-width: 1300px !important;
    }}

    /* ========================================================
       SIDEBAR STYLING
       ======================================================== */
    [data-testid="stSidebar"] {{
        background: linear-gradient(180deg, #10151E 0%, #0A0D14 100%) !important;
        border-right: 1px solid {COLORS['border']};
        box-shadow: 4px 0 24px rgba(0,0,0,0.5);
    }}
    [data-testid="stSidebar"] [data-testid="stVerticalBlock"] {{
        gap: 0.85rem;
    }}
    [data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2, [data-testid="stSidebar"] h3 {{
        font-family: {FONT_DISPLAY};
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: {COLORS['text']};
        margin-bottom: 0.2rem;
    }}
    [data-testid="stSidebar"] label {{
        font-family: {FONT_TECH} !important;
        font-size: 0.92rem !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: {COLORS['text_muted']} !important;
    }}

    /* Sidebar Logo / Banner */
    .sidebar-header-box {{
        padding: 0.8rem 1rem;
        background: linear-gradient(135deg, rgba(225,6,0,0.15) 0%, rgba(20,26,36,0.8) 100%);
        border: 1px solid rgba(225,6,0,0.4);
        border-radius: 8px;
        margin-bottom: 0.8rem;
    }}
    .sidebar-title {{
        font-family: {FONT_DISPLAY};
        font-weight: 900;
        font-size: 1.25rem;
        letter-spacing: 0.08em;
        color: #FFFFFF;
        display: flex;
        align-items: center;
        gap: 8px;
    }}
    .sidebar-title-badge {{
        background: {COLORS['f1_red']};
        color: #FFF;
        font-size: 0.65rem;
        font-family: {FONT_MONO};
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 3px;
        letter-spacing: 0.05em;
    }}
    .sidebar-subtitle {{
        font-family: {FONT_MONO};
        font-size: 0.72rem;
        color: {COLORS['text_muted']};
        letter-spacing: 0.04em;
        margin-top: 4px;
    }}

    /* ========================================================
       TABS - HIGH TECH FORMULA 1 PILL NAVIGATION
       ======================================================== */
    [data-testid="stTabs"] [data-baseweb="tab-list"] {{
        background: {COLORS['bg_card_solid']};
        border: 1px solid {COLORS['border']};
        padding: 5px;
        border-radius: 10px;
        gap: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        margin-bottom: 1.2rem;
    }}
    [data-testid="stTabs"] [data-baseweb="tab"] {{
        font-family: {FONT_TECH};
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: {COLORS['text_muted']};
        background: transparent;
        border-radius: 6px;
        padding: 0.5rem 1.1rem;
        border: 1px solid transparent;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }}
    [data-testid="stTabs"] [data-baseweb="tab"]:hover {{
        color: {COLORS['cyan']};
        background: rgba(0, 229, 255, 0.05);
        border-color: rgba(0, 229, 255, 0.2);
    }}
    [data-testid="stTabs"] [aria-selected="true"] {{
        background: linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(20, 26, 36, 0.9) 100%) !important;
        color: {COLORS['cyan']} !important;
        border: 1px solid {COLORS['cyan']} !important;
        box-shadow: 0 0 14px {COLORS['cyan_glow']};
    }}
    [data-testid="stTabs"] [data-baseweb="tab-highlight"] {{
        display: none !important;
    }}

    /* ========================================================
       BUTTONS - GLOWING TELEMETRY ACTION BUTTONS
       ======================================================== */
    .stButton > button {{
        font-family: {FONT_DISPLAY};
        font-weight: 700;
        font-size: 0.85rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: linear-gradient(135deg, {COLORS['f1_red']} 0%, #A60400 100%);
        color: #FFFFFF !important;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        padding: 0.55rem 1.4rem;
        box-shadow: 0 4px 14px rgba(225, 6, 0, 0.35);
        transition: all 0.2s ease;
    }}
    .stButton > button:hover {{
        background: linear-gradient(135deg, #FF1F1A 0%, {COLORS['f1_red']} 100%);
        box-shadow: 0 0 20px {COLORS['f1_red_glow']}, 0 4px 14px rgba(225, 6, 0, 0.5);
        transform: translateY(-1px);
        border-color: rgba(255,255,255,0.4);
    }}
    .stButton > button:active {{
        transform: translateY(1px);
        box-shadow: 0 2px 8px rgba(225, 6, 0, 0.4);
    }}

    /* Secondary / Download Buttons */
    [data-testid="stDownloadButton"] > button {{
        background: {COLORS['bg_card_solid']};
        color: {COLORS['cyan']} !important;
        border: 1px solid {COLORS['cyan']};
        font-family: {FONT_TECH};
        font-weight: 700;
        text-transform: uppercase;
    }}

    /* ========================================================
       INPUTS, SELECTBOXES, SLIDERS & EXPANDERS
       ======================================================== */
    [data-baseweb="select"] > div,
    [data-baseweb="input"] > div,
    [data-baseweb="base-input"] {{
        background-color: {COLORS['bg_card_solid']} !important;
        border-color: {COLORS['border']} !important;
        color: {COLORS['text']} !important;
        border-radius: 6px !important;
        font-family: {FONT_MONO};
    }}
    [data-baseweb="select"] > div:hover,
    [data-baseweb="input"] > div:focus-within {{
        border-color: {COLORS['cyan']} !important;
        box-shadow: 0 0 8px {COLORS['cyan_glow']} !important;
    }}
    [data-testid="stExpander"] {{
        background-color: {COLORS['bg_card']};
        border: 1px solid {COLORS['border']} !important;
        border-radius: 8px !important;
        backdrop-filter: blur(12px);
    }}
    [data-testid="stExpander"] summary {{
        font-family: {FONT_TECH};
        font-weight: 600;
        color: {COLORS['text_muted']};
        font-size: 0.95rem;
    }}
    [data-testid="stExpander"] summary:hover {{
        color: {COLORS['cyan']};
    }}

    /* Slider track & thumb */
    [data-baseweb="slider"] [role="slider"] {{
        background-color: {COLORS['cyan']} !important;
        border: 2px solid #FFFFFF !important;
        box-shadow: 0 0 10px {COLORS['cyan_glow']} !important;
    }}

    /* Alerts */
    [data-testid="stAlertContainer"] {{
        background-color: {COLORS['bg_card_solid']} !important;
        border: 1px solid {COLORS['border']};
        border-left: 4px solid {COLORS['cyan']};
        border-radius: 6px;
        backdrop-filter: blur(8px);
    }}

    /* ========================================================
       CUSTOM HUD COMPONENTS
       ======================================================== */
    
    /* Top Header Bar */
    .f1-race-header {{
        background: linear-gradient(90deg, rgba(16,21,30,0.95) 0%, rgba(20,26,38,0.75) 50%, rgba(16,21,30,0.95) 100%);
        border: 1px solid {COLORS['border']};
        border-top: 2px solid {COLORS['f1_red']};
        border-radius: 10px;
        padding: 0.9rem 1.4rem;
        margin-bottom: 1.4rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        backdrop-filter: blur(16px);
    }}
    .f1-header-brand {{
        display: flex;
        align-items: center;
        gap: 12px;
    }}
    .f1-logo-badge {{
        background: {COLORS['f1_red']};
        color: #FFFFFF;
        font-family: {FONT_DISPLAY};
        font-weight: 900;
        font-size: 1.1rem;
        padding: 4px 10px;
        border-radius: 4px;
        letter-spacing: 0.1em;
        box-shadow: 0 0 12px {COLORS['f1_red_glow']};
    }}
    .f1-title-group {{
        display: flex;
        flex-direction: column;
    }}
    .f1-main-title {{
        font-family: {FONT_DISPLAY};
        font-size: 1.4rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        color: #FFFFFF;
        line-height: 1.1;
    }}
    .f1-sub-title {{
        font-family: {FONT_MONO};
        font-size: 0.72rem;
        color: {COLORS['text_muted']};
        letter-spacing: 0.05em;
    }}
    .f1-header-meta {{
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }}
    .f1-meta-chip {{
        background: {COLORS['bg_card_solid']};
        border: 1px solid {COLORS['border']};
        border-radius: 6px;
        padding: 5px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
    }}
    .f1-meta-chip-label {{
        font-family: {FONT_TECH};
        font-size: 0.75rem;
        color: {COLORS['text_dim']};
        font-weight: 600;
        text-transform: uppercase;
    }}
    .f1-meta-chip-val {{
        font-family: {FONT_MONO};
        font-size: 0.82rem;
        color: {COLORS['cyan']};
        font-weight: 700;
    }}

    /* Live Track Beacon */
    .f1-status-beacon {{
        display: flex;
        align-items: center;
        gap: 7px;
        background: rgba(0, 230, 118, 0.1);
        border: 1px solid rgba(0, 230, 118, 0.3);
        padding: 5px 10px;
        border-radius: 20px;
    }}
    .f1-pulse-dot {{
        width: 8px;
        height: 8px;
        background-color: {COLORS['positive']};
        border-radius: 50%;
        box-shadow: 0 0 8px {COLORS['positive']};
        animation: pulse 1.5s infinite;
    }}
    @keyframes pulse {{
        0% {{ transform: scale(0.95); opacity: 0.7; }}
        50% {{ transform: scale(1.2); opacity: 1; }}
        100% {{ transform: scale(0.95); opacity: 0.7; }}
    }}
    .f1-status-text {{
        font-family: {FONT_TECH};
        font-size: 0.76rem;
        font-weight: 700;
        color: {COLORS['positive']};
        letter-spacing: 0.08em;
    }}

    /* Telemetry KPI Cards */
    .telemetry-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 12px;
        margin: 0.8rem 0 1.4rem 0;
    }}
    .telemetry-card {{
        background: {COLORS['bg_card']};
        border: 1px solid {COLORS['border']};
        border-radius: 8px;
        padding: 0.85rem 1rem;
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(12px);
        transition: transform 0.15s ease, border-color 0.15s ease;
    }}
    .telemetry-card:hover {{
        border-color: var(--card-accent, {COLORS['cyan']});
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    }}
    .telemetry-card::before {{
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: 3.5px;
        background: var(--card-accent, {COLORS['cyan']});
        box-shadow: 0 0 10px var(--card-accent, {COLORS['cyan']});
    }}
    .telemetry-label {{
        font-family: {FONT_TECH};
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: {COLORS['text_muted']};
        margin-bottom: 0.3rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }}
    .telemetry-value {{
        font-family: {FONT_MONO};
        font-size: 1.7rem;
        font-weight: 800;
        color: #FFFFFF;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }}
    .telemetry-unit {{
        font-size: 0.85rem;
        font-weight: 500;
        color: {COLORS['text_muted']};
        margin-left: 4px;
    }}
    .telemetry-sub {{
        font-family: {FONT_MONO};
        font-size: 0.7rem;
        color: {COLORS['text_dim']};
        margin-top: 0.25rem;
    }}

    /* Circuit Metadata Card */
    .circuit-card {{
        background: {COLORS['bg_card']};
        border: 1px solid {COLORS['border']};
        border-radius: 8px;
        padding: 0.85rem 1rem;
        margin-bottom: 1rem;
        backdrop-filter: blur(10px);
    }}
    .circuit-title {{
        font-family: {FONT_DISPLAY};
        font-size: 1rem;
        font-weight: 700;
        color: #FFF;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 6px;
    }}
    .circuit-stat-row {{
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 0.82rem;
    }}
    .circuit-stat-label {{
        font-family: {FONT_TECH};
        color: {COLORS['text_muted']};
        text-transform: uppercase;
    }}
    .circuit-stat-value {{
        font-family: {FONT_MONO};
        font-weight: 600;
        color: {COLORS['text']};
    }}

    /* Section Subheaders */
    .section-title {{
        font-family: {FONT_DISPLAY};
        font-size: 1.05rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #FFFFFF;
        margin: 1.2rem 0 0.6rem 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }}
    .section-title::before {{
        content: '';
        display: inline-block;
        width: 4px;
        height: 16px;
        background: {COLORS['f1_red']};
        border-radius: 2px;
    }}

    /* Tyre Strategy Timeline */
    .stint-timeline-container {{
        background: {COLORS['bg_card_solid']};
        border: 1px solid {COLORS['border']};
        border-radius: 8px;
        padding: 1rem 1.2rem;
        margin: 1rem 0;
    }}
    .stint-bar-wrapper {{
        display: flex;
        height: 38px;
        width: 100%;
        border-radius: 6px;
        overflow: hidden;
        box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
        margin: 0.6rem 0;
        border: 1px solid rgba(255,255,255,0.1);
    }}
    .stint-bar-segment {{
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: {FONT_MONO};
        font-size: 0.8rem;
        font-weight: 800;
        position: relative;
        transition: opacity 0.2s;
    }}
    .stint-bar-segment:hover {{
        opacity: 0.9;
    }}
    .stint-legend-row {{
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-top: 0.5rem;
    }}
    .stint-legend-item {{
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: {FONT_TECH};
        font-size: 0.82rem;
        font-weight: 600;
        color: {COLORS['text_muted']};
        text-transform: uppercase;
    }}
    .compound-badge-dot {{
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.3);
    }}
    </style>
    """, unsafe_allow_html=True)


def render_header(track_name: str, lap_length: float, car_label: str):
    """Modern F1 Pit-Wall HUD Session Header."""
    render_f1_header(track_name, lap_length, car_label)


def render_f1_header(track_name: str, lap_length: float, car_label: str, status: str = "TRACK GREEN"):
    """Full F1 broadcast styled header with live track beacons and session telemetry."""
    html = f"""
    <div class="f1-race-header">
        <div class="f1-header-brand">
            <div class="f1-logo-badge">F1</div>
            <div class="f1-title-group">
                <div class="f1-main-title">RACE CONTROL &bull; TELEMETRY</div>
                <div class="f1-sub-title">PHYSICS-GRADE LAP &amp; PIT STRATEGY SOLVER</div>
            </div>
        </div>
        <div class="f1-header-meta">
            <div class="f1-meta-chip">
                <span class="f1-meta-chip-label">CIRCUIT</span>
                <span class="f1-meta-chip-val">{track_name.upper()}</span>
            </div>
            <div class="f1-meta-chip">
                <span class="f1-meta-chip-label">LENGTH</span>
                <span class="f1-meta-chip-val">{lap_length:.0f} M</span>
            </div>
            <div class="f1-meta-chip">
                <span class="f1-meta-chip-label">REG</span>
                <span class="f1-meta-chip-val">{car_label}</span>
            </div>
            <div class="f1-status-beacon">
                <div class="f1-pulse-dot"></div>
                <span class="f1-status-text">{status}</span>
            </div>
        </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def render_readout_row(items):
    """
    Renders responsive high-tech Telemetry HUD cards.
    items: list of (label, value, unit/sub_text_or_None, accent_color_hex)
    """
    cards = ""
    for label, value, sub, accent in items:
        sub_html = f'<div class="telemetry-sub">{sub}</div>' if sub else ""
        cards += f"""
        <div class="telemetry-card" style="--card-accent: {accent};">
            <div class="telemetry-label">
                <span>{label}</span>
            </div>
            <div class="telemetry-value">{value}</div>
            {sub_html}
        </div>
        """
    st.markdown(f'<div class="telemetry-grid">{cards}</div>', unsafe_allow_html=True)


def render_track_card(track_name: str, lap_length: float, pit_loss: float, segments):
    """Render circuit quick facts in sidebar or detail page."""
    n_corners = sum(1 for seg in segments if seg.kind == "corner")
    straights_len = sum(seg.length for seg in segments if seg.kind == "straight")
    straight_pct = (straights_len / lap_length * 100) if lap_length > 0 else 0
    
    html = f"""
    <div class="circuit-card">
        <div class="circuit-title">📍 {track_name}</div>
        <div class="circuit-stat-row">
            <span class="circuit-stat-label">Lap Length</span>
            <span class="circuit-stat-value">{lap_length:.0f} m</span>
        </div>
        <div class="circuit-stat-row">
            <span class="circuit-stat-label">Corner Count</span>
            <span class="circuit-stat-value">{n_corners} turns</span>
        </div>
        <div class="circuit-stat-row">
            <span class="circuit-stat-label">Full Throttle %</span>
            <span class="circuit-stat-value">~{straight_pct:.0f}%</span>
        </div>
        <div class="circuit-stat-row">
            <span class="circuit-stat-label">Pit Lane Delta</span>
            <span class="circuit-stat-value">~{pit_loss:.1f}s</span>
        </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def render_stint_timeline(stint_inputs, total_laps: int):
    """Visualizes an F1 broadcast-style horizontal tyre compound stint timeline."""
    compound_colors = {
        "soft": COLORS["soft"],
        "medium": COLORS["medium"],
        "hard": COLORS["hard"],
    }
    text_colors = {
        "soft": "#FFFFFF",
        "medium": "#0B0E14",
        "hard": "#0B0E14",
    }
    
    bars = ""
    current_lap = 0
    for i, (compound, laps) in enumerate(stint_inputs):
        pct = (laps / total_laps) * 100
        bg = compound_colors.get(compound, COLORS["cyan"])
        fg = text_colors.get(compound, "#FFFFFF")
        start_lap = current_lap + 1
        end_lap = current_lap + laps
        current_lap = end_lap
        
        bars += f"""
        <div class="stint-bar-segment" style="width: {pct:.2f}%; background: {bg}; color: {fg};"
             title="Stint {i+1}: {compound.upper()} ({laps} laps, L{start_lap}-L{end_lap})">
            <span>S{i+1}: {compound[:1].upper()} ({laps}L)</span>
        </div>
        """
        
    html = f"""
    <div class="stint-timeline-container">
        <div style="display: flex; justify-content: space-between; font-family: {FONT_TECH}; font-size: 0.85rem; font-weight: 700; color: {COLORS['text_muted']}; text-transform: uppercase;">
            <span>🏁 LAP 1 (START)</span>
            <span>STRATEGY TIMELINE</span>
            <span>CHEQUERED FLAG (L{total_laps}) 🏁</span>
        </div>
        <div class="stint-bar-wrapper">
            {bars}
        </div>
        <div class="stint-legend-row">
            <div class="stint-legend-item"><span class="compound-badge-dot" style="background: {COLORS['soft']};"></span> Soft (C3/C4)</div>
            <div class="stint-legend-item"><span class="compound-badge-dot" style="background: {COLORS['medium']};"></span> Medium (C2/C3)</div>
            <div class="stint-legend-item"><span class="compound-badge-dot" style="background: {COLORS['hard']};"></span> Hard (C1/C2)</div>
        </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def render_strategy_table(results, best_time: float, top_n: int = 10):
    """
    Custom strategy leaderboard with real FIA tyre compound color badges
    and gap indicators.
    """
    compound_colors = {"soft": COLORS["soft"], "medium": COLORS["medium"], "hard": COLORS["hard"]}
    rows = ""
    for i, (t, plan) in enumerate(results[:top_n]):
        gap = t - best_time
        if gap <= 1e-9:
            gap_html = f'<span style="color:{COLORS["positive"]};font-weight:800;background:rgba(0,230,118,0.12);padding:2px 8px;border-radius:4px;border:1px solid rgba(0,230,118,0.3);">OPTIMAL</span>'
        else:
            gap_html = f'<span style="color:{COLORS["amber"]};font-family:{FONT_MONO};font-weight:700;">+{gap:.2f}s</span>'
            
        badges = ""
        for compound, laps in plan:
            c = compound_colors.get(compound, COLORS["text_dim"])
            text_color = "#0A0C0F" if compound in ("medium", "hard") else "#FFFFFF"
            badges += (
                f'<span style="background:{c};color:{text_color};font-weight:800;'
                f'font-family:{FONT_MONO};font-size:0.75rem;padding:3px 9px;'
                f'border-radius:4px;margin-right:6px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">'
                f'{compound.upper()} &bull; {laps}L</span>'
            )
            
        stops = len(plan) - 1
        stops_badge = f'<span style="font-family:{FONT_TECH};font-size:0.8rem;color:{COLORS["text_dim"]};font-weight:600;">{stops}-STOP</span>'
        
        row_bg = COLORS["bg_card_alt"] if i % 2 == 0 else COLORS["bg_card_solid"]
        rank_accent = COLORS["purple"] if i == 0 else (COLORS["cyan"] if i == 1 else COLORS["text_dim"])
        
        rows += f"""
        <tr style="background:{row_bg};border-bottom:1px solid {COLORS['border']};">
            <td style="padding:10px 14px;font-family:{FONT_MONO};font-weight:800;color:{rank_accent};font-size:0.95rem;">P{i+1}</td>
            <td style="padding:10px 14px;">{badges}</td>
            <td style="padding:10px 14px;">{stops_badge}</td>
            <td style="padding:10px 14px;font-family:{FONT_MONO};color:#FFFFFF;font-weight:700;font-size:0.95rem;">{format_time_local(t)}</td>
            <td style="padding:10px 14px;">{gap_html}</td>
        </tr>
        """
        
    header_style = (
        f'font-family:{FONT_TECH};font-size:0.82rem;letter-spacing:0.08em;'
        f'color:{COLORS["text_muted"]};text-transform:uppercase;padding:10px 14px;'
        f'border-bottom:2px solid {COLORS["f1_red"]};text-align:left;background:{COLORS["bg_card_solid"]};'
    )
    
    table_html = f"""
    <div style="border:1px solid {COLORS['border']};border-radius:8px;overflow:hidden;margin-top:1rem;box-shadow:0 6px 20px rgba(0,0,0,0.3);">
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr>
                    <th style="{header_style}">Pos</th>
                    <th style="{header_style}">Stint Strategy Breakdown</th>
                    <th style="{header_style}">Stops</th>
                    <th style="{header_style}">Race Time</th>
                    <th style="{header_style}">Delta</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
    </div>
    """
    st.markdown(table_html, unsafe_allow_html=True)


def render_corner_table(segments, result):
    """Extract and display corner apex speed breakdown table."""
    s_arr = result["s"]
    v_arr = result["v_profile"] * 3.6
    seg_idx_arr = result["seg_idx"]
    
    rows = ""
    corner_count = 0
    for idx, seg in enumerate(segments):
        if seg.kind == "corner":
            corner_count += 1
            mask = (seg_idx_arr == idx)
            if np.any(mask):
                v_seg = v_arr[mask]
                apex_speed = np.min(v_seg)
                entry_speed = v_seg[0]
                exit_speed = v_seg[-1]
            else:
                apex_speed = entry_speed = exit_speed = 0.0
                
            turn_dir = "➡️ Right" if seg.direction > 0 else "⬅️ Left"
            row_bg = COLORS["bg_card_alt"] if corner_count % 2 == 0 else COLORS["bg_card_solid"]
            
            rows += f"""
            <tr style="background:{row_bg};border-bottom:1px solid {COLORS['border']};">
                <td style="padding:8px 12px;font-family:{FONT_MONO};font-weight:700;color:{COLORS['cyan']};">T{corner_count}</td>
                <td style="padding:8px 12px;font-family:{FONT_BODY};font-weight:600;color:{COLORS['text']};">{seg.name}</td>
                <td style="padding:8px 12px;font-family:{FONT_TECH};color:{COLORS['text_muted']};">{turn_dir} (R={seg.radius:.0f}m)</td>
                <td style="padding:8px 12px;font-family:{FONT_MONO};color:{COLORS['text_muted']};">{entry_speed:.1f} km/h</td>
                <td style="padding:8px 12px;font-family:{FONT_MONO};font-weight:800;color:{COLORS['amber']};">{apex_speed:.1f} km/h</td>
                <td style="padding:8px 12px;font-family:{FONT_MONO};color:{COLORS['positive']};">{exit_speed:.1f} km/h</td>
            </tr>
            """
            
    header_style = (
        f'font-family:{FONT_TECH};font-size:0.78rem;letter-spacing:0.08em;'
        f'color:{COLORS["text_muted"]};text-transform:uppercase;padding:8px 12px;'
        f'border-bottom:2px solid {COLORS["cyan"]};text-align:left;background:{COLORS["bg_card_solid"]};'
    )
    
    table_html = f"""
    <div style="border:1px solid {COLORS['border']};border-radius:8px;overflow:hidden;margin-top:0.8rem;max-height:340px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr>
                    <th style="{header_style}">Turn</th>
                    <th style="{header_style}">Corner Name</th>
                    <th style="{header_style}">Type</th>
                    <th style="{header_style}">Entry</th>
                    <th style="{header_style}">Apex (Min)</th>
                    <th style="{header_style}">Exit</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
    </div>
    """
    st.markdown(table_html, unsafe_allow_html=True)


def format_time_local(t):
    mins = int(t // 60)
    secs = t % 60
    return f"{mins}:{secs:05.2f}" if mins > 0 else f"{secs:.3f}s"


def themed_layout_kwargs(height: int = None):
    """Plotly layout overrides matching the high-tech F1 Race Control console."""
    kwargs = dict(
        paper_bgcolor="rgba(16, 21, 30, 0.8)",
        plot_bgcolor="rgba(12, 16, 24, 0.9)",
        font=dict(family=FONT_MONO, color=COLORS["text_muted"], size=11),
        title_font=dict(family=FONT_DISPLAY, color="#FFFFFF", size=15),
        xaxis=dict(
            gridcolor="rgba(255,255,255,0.06)",
            zerolinecolor="rgba(255,255,255,0.1)",
            tickfont=dict(family=FONT_MONO, size=10, color=COLORS["text_dim"]),
            title=dict(font=dict(family=FONT_TECH, size=12, color=COLORS["text_muted"])),
        ),
        yaxis=dict(
            gridcolor="rgba(255,255,255,0.06)",
            zerolinecolor="rgba(255,255,255,0.1)",
            tickfont=dict(family=FONT_MONO, size=10, color=COLORS["text_dim"]),
            title=dict(font=dict(family=FONT_TECH, size=12, color=COLORS["text_muted"])),
        ),
        legend=dict(
            bgcolor="rgba(20, 26, 36, 0.8)",
            bordercolor=COLORS["border"],
            borderwidth=1,
            font=dict(family=FONT_TECH, size=11, color=COLORS["text"]),
        ),
        margin=dict(t=55, b=45, l=55, r=35),
    )
    if height:
        kwargs["height"] = height
    return kwargs
