"""
theme.py — F1 Pit-Wall Race Control & Telemetry design system.

A single source of truth for the console's visual identity:

  * DESIGN TOKENS   — colour palette, typography, elevation, motion
  * GLOBAL CSS      — restyles every native Streamlit widget into tactile,
                      glassmorphic "mission control" hardware
  * HUD COMPONENTS  — Python helpers that emit bespoke HTML/CSS cards:
                      status ticker, telemetry KPI readouts, stint timeline,
                      regulation-versus panel, strategy + corner tables
  * PLOTLY THEME    — a registered `f1_pitwall` template plus layout / axis
                      helpers so every chart matches the console exactly

Colour language (grounded in real F1 timing graphics + Pirelli standards):
  F1 Red  #FF1801  brand / braking / alert
  Cyan    #00F0FF  primary speed telemetry
  Teal    #00D2BE  secondary / energy deployment
  Amber   #FFB703  session delta / active lap
  Purple  #B026FF  fastest / personal-best sector
  Green   #00E676  throttle / DRS open / improvement
  Pirelli Soft #FF3B30 · Medium #FFD60A · Hard #F2F2F7 · Inter #34C759 · Wet #007AFF
"""

from __future__ import annotations

import numpy as np
import streamlit as st
import plotly.graph_objects as go
import plotly.io as pio


# ============================================================================
# 1 · DESIGN TOKENS
# ============================================================================

COLORS = {
    # -- surfaces (deep OLED obsidian, layered) --
    "bg":            "#0B0E14",
    "bg_deep":       "#080A0F",
    "surface_1":     "#10141D",
    "surface_2":     "#161B26",
    "surface_3":     "#1D2432",
    "bg_card":       "rgba(22, 27, 38, 0.75)",
    "bg_card_solid": "#141A24",
    "bg_card_alt":   "rgba(28, 36, 50, 0.80)",
    "bg_glass":      "rgba(15, 20, 30, 0.66)",

    # -- hairlines / borders --
    "border":           "rgba(255, 255, 255, 0.08)",
    "border_solid":     "#232D3F",
    "border_highlight": "#38455A",
    "border_glow":      "rgba(0, 240, 255, 0.30)",

    # -- text --
    "text":       "#EEF2F7",
    "text_muted": "#8E9AA8",
    "text_dim":   "#5C6777",

    # -- brand + telemetry accents --
    "f1_red":      "#FF1801",
    "f1_red_deep": "#E10600",
    "f1_red_glow": "rgba(255, 24, 1, 0.42)",
    "cyan":        "#00F0FF",
    "cyan_glow":   "rgba(0, 240, 255, 0.35)",
    "teal":        "#00D2BE",
    "purple":      "#B026FF",
    "purple_glow": "rgba(176, 38, 255, 0.35)",
    "amber":       "#FFB703",
    "positive":    "#00E676",
    "negative":    "#FF2A4D",

    # -- Pirelli dry + wet compounds --
    "soft":   "#FF3B30",
    "medium": "#FFD60A",
    "hard":   "#F2F2F7",
    "inter":  "#34C759",
    "wet":    "#007AFF",
}

# Font stacks — heavy industrial display, condensed tech labels, tabular mono
FONT_DISPLAY = "'Chakra Petch', 'Rajdhani', 'Inter', sans-serif"
FONT_TECH    = "'Rajdhani', 'Chakra Petch', 'Inter', sans-serif"
FONT_MONO    = "'JetBrains Mono', 'Roboto Mono', 'SFMono-Regular', monospace"
FONT_BODY    = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

# Compound → (fill colour, on-colour text)
COMPOUND_COLORS = {
    "soft":   (COLORS["soft"],   "#FFFFFF"),
    "medium": (COLORS["medium"], "#0B0E14"),
    "hard":   (COLORS["hard"],   "#0B0E14"),
    "inter":  (COLORS["inter"],  "#0B0E14"),
    "wet":    (COLORS["wet"],    "#FFFFFF"),
}

# Illustrative circuit conditions for the status ticker. These are static
# scenario values (the sim has no live weather model) — the ticker labels them
# "SIM CONDITIONS" so they are never mistaken for a prediction.
TRACK_CONDITIONS = {
    "Monza": dict(air=27, track=44, grip="HIGH", wind="12 KM/H NE", sky="CLEAR", humidity=38),
    "Silverstone": dict(air=18, track=29, grip="MEDIUM", wind="24 KM/H SW", sky="OVERCAST", humidity=71),
    "Spa-Francorchamps": dict(air=16, track=23, grip="VARIABLE", wind="18 KM/H W", sky="DAMP PATCHES", humidity=82),
}


# ============================================================================
# 2 · GLOBAL CSS
# ============================================================================

_FONT_IMPORT = (
    "@import url('https://fonts.googleapis.com/css2?"
    "family=Chakra+Petch:wght@400;500;600;700&"
    "family=Inter:wght@300;400;500;600;700&"
    "family=JetBrains+Mono:wght@400;500;700;800&"
    "family=Rajdhani:wght@500;600;700&display=swap');"
)

# Colour tokens exposed to CSS as custom properties — keeps the big static
# stylesheet below free of f-string brace-escaping.
_ROOT_VARS = f"""
:root {{
  --bg:{COLORS['bg']}; --bg-deep:{COLORS['bg_deep']};
  --s1:{COLORS['surface_1']}; --s2:{COLORS['surface_2']}; --s3:{COLORS['surface_3']};
  --card:{COLORS['bg_card']}; --card-solid:{COLORS['bg_card_solid']};
  --card-alt:{COLORS['bg_card_alt']}; --glass:{COLORS['bg_glass']};
  --line:{COLORS['border']}; --line-solid:{COLORS['border_solid']}; --line-bright:{COLORS['border_highlight']};
  --text:{COLORS['text']}; --text-muted:{COLORS['text_muted']}; --text-dim:{COLORS['text_dim']};
  --red:{COLORS['f1_red']}; --red-deep:{COLORS['f1_red_deep']}; --red-glow:{COLORS['f1_red_glow']};
  --cyan:{COLORS['cyan']}; --cyan-glow:{COLORS['cyan_glow']}; --teal:{COLORS['teal']};
  --purple:{COLORS['purple']}; --purple-glow:{COLORS['purple_glow']}; --amber:{COLORS['amber']};
  --pos:{COLORS['positive']}; --neg:{COLORS['negative']};
  --font-display:{FONT_DISPLAY}; --font-tech:{FONT_TECH};
  --font-mono:{FONT_MONO}; --font-body:{FONT_BODY};
}}
"""

_STATIC_CSS = """
/* ========================================================================
   BASE / CANVAS
   ======================================================================== */
html, body, [class*="css"], .stApp, [data-testid="stAppViewContainer"] {
    font-family: var(--font-body);
    color: var(--text);
    letter-spacing: -0.005em;
}

.stApp {
    background-color: var(--bg);
    background-image:
        radial-gradient(1200px 600px at 12% -5%, rgba(0,240,255,0.045) 0%, transparent 55%),
        radial-gradient(1000px 500px at 100% 0%, rgba(255,24,1,0.05) 0%, transparent 55%),
        radial-gradient(900px 600px at 50% 120%, rgba(176,38,255,0.035) 0%, transparent 60%),
        repeating-linear-gradient(45deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 7px),
        repeating-linear-gradient(-45deg, rgba(255,255,255,0.011) 0 1px, transparent 1px 7px),
        linear-gradient(180deg, #0A0D13 0%, #0B0E14 40%, #090B10 100%);
    background-attachment: fixed;
}

/* Streamlit chrome — dissolve it into the console */
[data-testid="stHeader"] { background: transparent !important; }
[data-testid="stHeader"]::before {
    content: ""; position: absolute; inset: 0; height: 3px;
    background: linear-gradient(90deg, var(--red) 0%, var(--amber) 22%, var(--cyan) 55%, var(--purple) 100%);
    opacity: 0.9;
}
[data-testid="stToolbar"] { right: 0.6rem; }
footer, #MainMenu ~ footer { display: none !important; }
[data-testid="stDecoration"] { display: none !important; }

.block-container, [data-testid="stMainBlockContainer"] {
    padding-top: 2.4rem !important;
    padding-bottom: 3.5rem !important;
    max-width: 1380px !important;
}

/* Typography rhythm */
h1, h2, h3, h4 { font-family: var(--font-display); color: #fff; letter-spacing: 0.01em; }
p, li, span, label, div { line-height: 1.55; }
a { color: var(--cyan); text-decoration: none; }
hr { border-color: var(--line); }
code, kbd {
    font-family: var(--font-mono); font-size: 0.85em;
    background: var(--s2); border: 1px solid var(--line);
    border-radius: 4px; padding: 1px 6px; color: var(--cyan);
}
::selection { background: rgba(0,240,255,0.28); color: #fff; }

/* Scrollbars */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg-deep); }
::-webkit-scrollbar-thumb {
    background: linear-gradient(var(--s3), var(--s2));
    border: 1px solid var(--line); border-radius: 6px;
}
::-webkit-scrollbar-thumb:hover { background: var(--line-bright); }

/* ========================================================================
   SIDEBAR · MISSION CONTROL BEZEL
   ======================================================================== */
[data-testid="stSidebar"] {
    background:
        linear-gradient(180deg, #10151E 0%, #0A0D14 60%, #080A10 100%) !important;
    border-right: 1px solid var(--line-solid);
    box-shadow: 6px 0 34px rgba(0,0,0,0.55);
}
[data-testid="stSidebar"] [data-testid="stVerticalBlock"] { gap: 0.85rem; }
[data-testid="stSidebar"] h1,
[data-testid="stSidebar"] h2,
[data-testid="stSidebar"] h3 {
    font-family: var(--font-display); font-weight: 700;
    font-size: 0.95rem !important; letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--text);
    margin: 0.4rem 0 0.1rem 0;
    padding-left: 0.6rem; border-left: 3px solid var(--red);
}
[data-testid="stSidebar"] label {
    font-family: var(--font-tech) !important;
    font-size: 0.85rem !important; font-weight: 600 !important;
    text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--text-muted) !important;
}

.mc-panel {
    padding: 0.9rem 1rem 0.95rem;
    background:
        linear-gradient(135deg, rgba(255,24,1,0.16) 0%, rgba(20,26,36,0.7) 55%),
        var(--card-solid);
    border: 1px solid rgba(255,24,1,0.38);
    border-radius: 10px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 26px rgba(0,0,0,0.45);
    margin-bottom: 0.6rem;
}
.mc-panel-title {
    font-family: var(--font-display); font-weight: 700;
    font-size: 1.32rem; letter-spacing: 0.13em; color: #fff;
    display: flex; align-items: center; gap: 9px;
}
.mc-panel-badge {
    font-family: var(--font-mono); font-weight: 800; font-size: 0.6rem;
    background: var(--red); color: #fff; letter-spacing: 0.08em;
    padding: 3px 6px; border-radius: 3px;
}
.mc-panel-sub {
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--text-muted); letter-spacing: 0.05em; margin-top: 6px;
}
.mc-status-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.mc-led-row {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-tech); font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.09em; text-transform: uppercase; color: var(--text-muted);
}
.mc-led {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--pos); box-shadow: 0 0 8px var(--pos);
    animation: mc-blink 2.4s ease-in-out infinite;
}
.mc-led.amber { background: var(--amber); box-shadow: 0 0 8px var(--amber); animation-delay: 0.6s; }
.mc-led.cyan  { background: var(--cyan);  box-shadow: 0 0 8px var(--cyan);  animation-delay: 1.2s; }
@keyframes mc-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ========================================================================
   TABS · PIT-WALL MONITOR STRIP
   ======================================================================== */
[data-testid="stTabs"] [data-baseweb="tab-list"] {
    background: linear-gradient(180deg, var(--s2), var(--s1));
    border: 1px solid var(--line-solid);
    border-radius: 12px; padding: 6px; gap: 6px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.4);
    margin-bottom: 1.4rem;
}
[data-testid="stTabs"] [data-baseweb="tab"] {
    font-family: var(--font-tech); font-size: 0.92rem; font-weight: 700;
    letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--text-muted); background: transparent;
    border-radius: 7px; padding: 0.5rem 1.1rem;
    border: 1px solid transparent; position: relative;
    transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
}
[data-testid="stTabs"] [data-baseweb="tab"]:hover {
    color: var(--cyan); background: rgba(0,240,255,0.06);
}
[data-testid="stTabs"] [aria-selected="true"] {
    color: #fff !important;
    background: linear-gradient(180deg, rgba(0,240,255,0.14), rgba(20,26,36,0.9)) !important;
    border-color: rgba(0,240,255,0.45) !important;
    box-shadow: 0 0 16px var(--cyan-glow), inset 0 -2px 0 var(--cyan);
}
[data-testid="stTabs"] [data-baseweb="tab-highlight"],
[data-testid="stTabs"] [data-baseweb="tab-border"] { display: none !important; }

/* ========================================================================
   BUTTONS
   ======================================================================== */
.stButton > button, [data-testid="stBaseButton-secondary"], [data-testid="stBaseButton-primary"] {
    font-family: var(--font-display); font-weight: 700;
    font-size: 0.82rem; letter-spacing: 0.09em; text-transform: uppercase;
    background: linear-gradient(135deg, var(--red) 0%, #A60400 100%);
    color: #fff !important;
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 7px; padding: 0.58rem 1.4rem;
    box-shadow: 0 4px 16px rgba(255,24,1,0.32), inset 0 1px 0 rgba(255,255,255,0.25);
    transition: all 0.16s ease;
}
.stButton > button:hover, [data-testid="stBaseButton-secondary"]:hover {
    background: linear-gradient(135deg, #FF3B24 0%, var(--red) 100%);
    box-shadow: 0 0 22px var(--red-glow), 0 6px 18px rgba(255,24,1,0.45);
    transform: translateY(-1px); border-color: rgba(255,255,255,0.4);
}
.stButton > button:active { transform: translateY(1px); box-shadow: 0 2px 8px rgba(255,24,1,0.4); }
.stButton > button:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }

[data-testid="stDownloadButton"] > button {
    background: var(--card-solid); color: var(--cyan) !important;
    border: 1px solid var(--cyan);
    font-family: var(--font-tech); font-weight: 700; text-transform: uppercase;
    box-shadow: 0 0 14px rgba(0,240,255,0.2);
}

/* ========================================================================
   INPUTS · SELECT · NUMBER · SLIDER · RADIO
   ======================================================================== */
[data-baseweb="select"] > div,
[data-baseweb="input"] > div,
[data-baseweb="base-input"],
[data-testid="stNumberInput"] input,
[data-testid="stTextInput"] input {
    background-color: var(--card-solid) !important;
    border-color: var(--line-solid) !important;
    color: var(--text) !important;
    border-radius: 7px !important;
    font-family: var(--font-mono) !important;
}
[data-baseweb="select"] > div:hover,
[data-baseweb="input"] > div:focus-within,
[data-testid="stNumberInput"] div:focus-within {
    border-color: var(--cyan) !important;
    box-shadow: 0 0 10px var(--cyan-glow) !important;
}
[data-baseweb="popover"] [role="listbox"] {
    background: var(--card-solid) !important;
    border: 1px solid var(--line-solid) !important;
}
[data-baseweb="popover"] [role="option"]:hover { background: rgba(0,240,255,0.1) !important; }

[data-testid="stNumberInput"] button {
    background: var(--s2) !important; border-color: var(--line-solid) !important;
    color: var(--cyan) !important;
}

/* Slider + select-slider rail / thumb */
[data-baseweb="slider"] [role="slider"] {
    background: var(--cyan) !important;
    border: 2px solid #fff !important;
    box-shadow: 0 0 12px var(--cyan-glow) !important;
}
[data-baseweb="slider"] [data-testid="stSliderTrack"] > div { background: var(--cyan) !important; }
[data-testid="stSliderTickBarMin"], [data-testid="stSliderTickBarMax"] {
    font-family: var(--font-mono); color: var(--text-dim);
}

/* Radio → segmented tactile switches */
[data-testid="stRadio"] > div { gap: 0.45rem; }
[data-testid="stRadio"] label {
    background: var(--card-solid);
    border: 1px solid var(--line-solid);
    border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0 !important;
    transition: all 0.15s ease;
}
[data-testid="stRadio"] label:hover { border-color: var(--line-bright); }
[data-testid="stRadio"] label:has(input:checked) {
    border-color: var(--cyan);
    background: linear-gradient(135deg, rgba(0,240,255,0.12), rgba(20,26,36,0.9));
    box-shadow: 0 0 12px var(--cyan-glow);
}
[data-testid="stRadio"] label:has(input:checked) p { color: #fff !important; }

/* Checkbox */
[data-testid="stCheckbox"] label span[data-baseweb="checkbox"] div {
    background: var(--card-solid) !important; border-color: var(--line-bright) !important;
}
[data-testid="stCheckbox"] input:checked ~ div { background: var(--cyan) !important; border-color: var(--cyan) !important; }

/* Expander */
[data-testid="stExpander"] {
    background: var(--card);
    border: 1px solid var(--line-solid) !important;
    border-radius: 9px !important;
    backdrop-filter: blur(12px);
}
[data-testid="stExpander"] summary {
    font-family: var(--font-tech); font-weight: 600;
    color: var(--text-muted); font-size: 0.92rem; letter-spacing: 0.03em;
}
[data-testid="stExpander"] summary:hover { color: var(--cyan); }

/* Bordered containers → instrument panels */
[data-testid="stVerticalBlockBorderWrapper"] > div > [data-testid="stVerticalBlock"] {
    gap: 0.7rem;
}
div[data-testid="stVerticalBlock"] > div:has(> [data-testid="stVerticalBlockBorderWrapper"]) { }
[data-testid="stExpander"], .stAlert, [data-testid="stVerticalBlockBorderWrapper"] {
    border-color: var(--line-solid) !important;
}
[data-testid="stVerticalBlockBorderWrapper"] {
    border-radius: 12px !important;
    background: linear-gradient(180deg, rgba(18,23,33,0.55), rgba(11,14,20,0.35));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}

/* Alerts */
[data-testid="stAlert"], [data-testid="stAlertContainer"] {
    background: var(--card-solid) !important;
    border: 1px solid var(--line-solid);
    border-left: 4px solid var(--cyan);
    border-radius: 7px; backdrop-filter: blur(8px);
    font-family: var(--font-body);
}
[data-testid="stAlert"][data-baseweb="notification"] { color: var(--text); }

/* Captions → tech annotation */
[data-testid="stCaptionContainer"], .stCaption {
    font-family: var(--font-mono) !important;
    font-size: 0.76rem !important; color: var(--text-dim) !important;
    letter-spacing: 0.01em;
}

/* Native st.metric (fallback styling) */
[data-testid="stMetric"] {
    background: var(--card); border: 1px solid var(--line-solid);
    border-radius: 9px; padding: 0.8rem 1rem;
}
[data-testid="stMetricValue"] { font-family: var(--font-mono); font-weight: 800; color: #fff; }
[data-testid="stMetricLabel"] {
    font-family: var(--font-tech); text-transform: uppercase; letter-spacing: 0.09em;
    color: var(--text-muted);
}

/* Plotly chart frame */
[data-testid="stPlotlyChart"] {
    border: 1px solid var(--line-solid);
    border-radius: 12px; overflow: hidden;
    background: rgba(9,12,18,0.55);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);
}
[data-testid="stPlotlyChart"] > div { border-radius: 12px; }

/* Dataframe */
[data-testid="stDataFrame"] { border: 1px solid var(--line-solid); border-radius: 9px; }

/* ========================================================================
   HUD COMPONENT LIBRARY
   ======================================================================== */

/* --- Session header + status ticker --- */
.f1-header {
    background:
        linear-gradient(90deg, rgba(14,18,27,0.96) 0%, rgba(21,27,39,0.72) 50%, rgba(14,18,27,0.96) 100%);
    border: 1px solid var(--line-solid);
    border-top: 2px solid var(--red);
    border-radius: 12px;
    padding: 0.95rem 1.35rem 0;
    margin-bottom: 1.5rem;
    box-shadow: 0 12px 34px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
    backdrop-filter: blur(16px);
    overflow: hidden;
}
.f1-header-top {
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 1rem; padding-bottom: 0.9rem;
}
.f1-brand { display: flex; align-items: center; gap: 13px; }
.f1-logo {
    background: var(--red); color: #fff;
    font-family: var(--font-display); font-weight: 700; font-size: 1.15rem;
    padding: 3px 11px; border-radius: 5px; letter-spacing: 0.12em;
    box-shadow: 0 0 16px var(--red-glow);
}
.f1-titles { display: flex; flex-direction: column; }
.f1-title {
    font-family: var(--font-display); font-size: 1.32rem; font-weight: 700;
    letter-spacing: 0.05em; color: #fff; line-height: 1.15;
}
.f1-subtitle {
    font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted);
    letter-spacing: 0.06em;
}
.f1-beacon {
    display: flex; align-items: center; gap: 8px;
    background: rgba(0,230,118,0.1); border: 1px solid rgba(0,230,118,0.32);
    padding: 6px 12px; border-radius: 20px;
}
.f1-beacon-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--pos); box-shadow: 0 0 10px var(--pos);
    animation: f1-pulse 1.5s infinite;
}
@keyframes f1-pulse {
    0% { transform: scale(0.9); opacity: 0.7; }
    50% { transform: scale(1.25); opacity: 1; }
    100% { transform: scale(0.9); opacity: 0.7; }
}
.f1-beacon-text {
    font-family: var(--font-tech); font-size: 0.74rem; font-weight: 700;
    color: var(--pos); letter-spacing: 0.09em;
}
.f1-ticker {
    display: flex; align-items: stretch; flex-wrap: wrap;
    gap: 0; border-top: 1px solid var(--line);
    margin: 0 -1.35rem; padding: 0;
    background: linear-gradient(90deg, rgba(0,0,0,0.25), rgba(0,0,0,0.05), rgba(0,0,0,0.25));
}
.f1-tick {
    flex: 1 1 auto; min-width: 128px;
    display: flex; flex-direction: column; gap: 2px;
    padding: 0.55rem 1.1rem;
    border-right: 1px solid var(--line);
}
.f1-tick:last-child { border-right: none; }
.f1-tick-label {
    font-family: var(--font-tech); font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.13em; text-transform: uppercase; color: var(--text-dim);
}
.f1-tick-value {
    font-family: var(--font-mono); font-size: 0.92rem; font-weight: 700;
    color: var(--cyan); letter-spacing: 0.01em;
}
.f1-tick-value.warm { color: var(--amber); }
.f1-tick-value.neutral { color: var(--text); }

/* --- Telemetry KPI readout grid --- */
.tele-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(178px, 1fr));
    gap: 13px; margin: 0.4rem 0 1.4rem;
}
.tele-card {
    --accent: var(--cyan);
    position: relative; overflow: hidden;
    background: var(--card);
    border: 1px solid var(--line-solid);
    border-radius: 10px; padding: 0.9rem 1.05rem 0.95rem;
    backdrop-filter: blur(12px);
    transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}
.tele-card::before {
    content: ""; position: absolute; top: 0; left: 0; bottom: 0; width: 3px;
    background: var(--accent); box-shadow: 0 0 12px var(--accent);
}
.tele-card::after {
    content: ""; position: absolute; top: -1px; right: -1px;
    width: 14px; height: 14px;
    border-top: 2px solid var(--accent); border-right: 2px solid var(--accent);
    border-top-right-radius: 10px; opacity: 0.55;
}
.tele-card:hover {
    transform: translateY(-2px); border-color: var(--accent);
    box-shadow: 0 10px 26px rgba(0,0,0,0.4);
}
.tele-label {
    font-family: var(--font-tech); font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.11em; text-transform: uppercase; color: var(--text-muted);
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 0.35rem;
}
.tele-trend {
    font-family: var(--font-mono); font-size: 0.68rem; font-weight: 700;
    padding: 1px 6px; border-radius: 4px;
}
.tele-trend.up   { color: var(--pos); background: rgba(0,230,118,0.13); }
.tele-trend.down { color: var(--neg); background: rgba(255,42,77,0.13); }
.tele-trend.flat { color: var(--text-dim); background: rgba(255,255,255,0.05); }
.tele-value {
    font-family: var(--font-mono); font-size: 1.72rem; font-weight: 800;
    color: #fff; font-variant-numeric: tabular-nums; line-height: 1.08;
    text-shadow: 0 0 22px var(--accent);
}
.tele-sub {
    font-family: var(--font-mono); font-size: 0.68rem;
    color: var(--text-dim); margin-top: 0.28rem; letter-spacing: 0.02em;
}

/* --- Circuit fact card --- */
.circuit-card {
    background: var(--card); border: 1px solid var(--line-solid);
    border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 0.8rem;
    backdrop-filter: blur(10px);
}
.circuit-title {
    font-family: var(--font-display); font-size: 0.98rem; font-weight: 700;
    color: #fff; margin-bottom: 0.55rem;
    display: flex; align-items: center; gap: 7px;
    padding-bottom: 0.45rem; border-bottom: 1px solid var(--line);
}
.circuit-row {
    display: flex; justify-content: space-between; padding: 4px 0;
    font-size: 0.8rem;
}
.circuit-row .k { font-family: var(--font-tech); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.circuit-row .v { font-family: var(--font-mono); font-weight: 600; color: var(--text); }

/* --- Section header --- */
.section-head { margin: 1.5rem 0 0.7rem; }
.section-title {
    font-family: var(--font-display); font-size: 1.08rem; font-weight: 700;
    letter-spacing: 0.05em; text-transform: uppercase; color: #fff;
    display: flex; align-items: center; gap: 9px;
}
.section-title::before {
    content: ""; width: 4px; height: 17px; border-radius: 2px;
    background: var(--red); box-shadow: 0 0 10px var(--red-glow);
}
.section-sub {
    font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-dim);
    margin-top: 0.3rem; padding-left: 13px;
}

/* --- Chips --- */
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 0.4rem 0 0.9rem; }
.chip {
    font-family: var(--font-tech); font-size: 0.74rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 4px 11px; border-radius: 5px;
    background: var(--card-solid); border: 1px solid var(--line-solid);
    color: var(--text-muted);
    display: inline-flex; align-items: center; gap: 6px;
}
.chip .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 7px var(--cyan); }
.chip.accent { color: var(--cyan); border-color: rgba(0,240,255,0.35); }

/* --- Stint timeline --- */
.stint-wrap {
    background: var(--card-solid); border: 1px solid var(--line-solid);
    border-radius: 10px; padding: 1rem 1.2rem; margin: 0.9rem 0;
}
.stint-head {
    display: flex; justify-content: space-between;
    font-family: var(--font-tech); font-size: 0.78rem; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;
}
.stint-bar {
    display: flex; height: 42px; width: 100%; border-radius: 7px;
    overflow: hidden; margin: 0.7rem 0 0.5rem;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.55);
}
.stint-seg {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: var(--font-mono); font-size: 0.78rem; font-weight: 800;
    position: relative; border-right: 2px solid rgba(0,0,0,0.45);
    background-image: repeating-linear-gradient(115deg, rgba(255,255,255,0.10) 0 10px, transparent 10px 22px);
}
.stint-seg:last-child { border-right: none; }
.stint-seg .lap-range { font-family: var(--font-mono); font-size: 0.6rem; font-weight: 600; opacity: 0.8; }
.stint-pit {
    display: flex; align-items: center; justify-content: center;
    width: 0; overflow: visible; position: relative; z-index: 2;
}
.stint-pit span {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    font-family: var(--font-tech); font-size: 0.58rem; font-weight: 800;
    color: #fff; background: var(--red); padding: 2px 5px; border-radius: 3px;
    white-space: nowrap; box-shadow: 0 0 10px var(--red-glow);
}
.stint-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 0.6rem; }
.stint-legend-item {
    display: flex; align-items: center; gap: 6px;
    font-family: var(--font-tech); font-size: 0.78rem; font-weight: 600;
    color: var(--text-muted); text-transform: uppercase;
}
.compound-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.35); }
.delta-tag {
    font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;
    padding: 2px 8px; border-radius: 4px; margin-left: 8px;
}
.delta-tag.gain { color: var(--pos); background: rgba(0,230,118,0.13); border: 1px solid rgba(0,230,118,0.3); }
.delta-tag.loss { color: var(--neg); background: rgba(255,42,77,0.13); border: 1px solid rgba(255,42,77,0.3); }

/* --- Regulation versus panel --- */
.reg-wrap {
    background: var(--card-solid); border: 1px solid var(--line-solid);
    border-radius: 10px; padding: 1rem 1.2rem 1.1rem; margin: 0.6rem 0 1.2rem;
}
.reg-legend {
    display: flex; justify-content: center; gap: 22px; margin-bottom: 0.9rem;
    font-family: var(--font-tech); font-size: 0.78rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
}
.reg-legend .a { color: var(--cyan); }
.reg-legend .b { color: var(--purple); }
.reg-row {
    display: grid; grid-template-columns: 1fr 66px 150px 66px 1fr;
    align-items: center; gap: 10px; padding: 7px 0;
    border-bottom: 1px solid var(--line);
}
.reg-row:last-child { border-bottom: none; }
.reg-bar { height: 9px; border-radius: 4px; background: rgba(255,255,255,0.05); position: relative; overflow: hidden; }
.reg-bar > i { position: absolute; top: 0; bottom: 0; display: block; border-radius: 4px; }
.reg-bar.l > i { right: 0; background: linear-gradient(90deg, transparent, var(--cyan)); box-shadow: 0 0 10px var(--cyan-glow); }
.reg-bar.r > i { left: 0; background: linear-gradient(90deg, var(--purple), transparent); box-shadow: 0 0 10px var(--purple-glow); }
.reg-metric {
    text-align: center; font-family: var(--font-tech); font-size: 0.74rem;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);
}
.reg-val { font-family: var(--font-mono); font-size: 0.9rem; font-weight: 700; color: #fff; text-align: center; }
.reg-val.a { text-align: right; color: var(--cyan); }
.reg-val.b { text-align: left; color: var(--purple); }

/* --- Data tables --- */
.f1-table-wrap {
    border: 1px solid var(--line-solid); border-radius: 10px; overflow: hidden;
    margin-top: 0.9rem; box-shadow: 0 8px 24px rgba(0,0,0,0.32);
}
.f1-table { width: 100%; border-collapse: collapse; }
.f1-table th {
    font-family: var(--font-tech); font-size: 0.74rem; letter-spacing: 0.09em;
    color: var(--text-muted); text-transform: uppercase; text-align: left;
    padding: 11px 14px; background: var(--card-solid);
    border-bottom: 2px solid var(--red); position: sticky; top: 0;
}
.f1-table td { padding: 9px 14px; border-bottom: 1px solid var(--line); }
.f1-table tr:last-child td { border-bottom: none; }
.f1-scroll { max-height: 360px; overflow-y: auto; }

@media (max-width: 640px) {
    .reg-row { grid-template-columns: 1fr 48px 60px 48px 1fr; }
    .tele-value { font-size: 1.45rem; }
}
"""


def inject_css():
    """Inject the full console stylesheet. Call once, right after set_page_config."""
    st.markdown(
        "<style>" + _FONT_IMPORT + _ROOT_VARS + _STATIC_CSS + "</style>",
        unsafe_allow_html=True,
    )


# ============================================================================
# 3 · HTML RENDER HELPERS
# ============================================================================

def render_html(html: str):
    """Render bespoke HTML without Streamlit's Markdown parser turning indented
    fragments into code blocks. Lines are stripped and concatenated, so keep
    each text phrase on a single source line."""
    compact = "".join(line.strip() for line in html.splitlines())
    st.markdown(compact, unsafe_allow_html=True)


def section(title: str, subtitle: str | None = None):
    """Styled section header: red tick + uppercase title + mono subtitle."""
    sub = f'<div class="section-sub">{subtitle}</div>' if subtitle else ""
    render_html(
        f'<div class="section-head">'
        f'<div class="section-title">{title}</div>{sub}'
        f'</div>'
    )


def chips(items):
    """Row of status chips. items: list of str, or (label, accent_bool) tuples."""
    out = []
    for it in items:
        if isinstance(it, (tuple, list)):
            label, accent = it[0], (len(it) > 1 and it[1])
        else:
            label, accent = it, False
        cls = "chip accent" if accent else "chip"
        out.append(f'<span class="{cls}"><span class="dot"></span>{label}</span>')
    render_html(f'<div class="chip-row">{"".join(out)}</div>')


# ============================================================================
# 4 · SESSION HEADER + STATUS TICKER
# ============================================================================

def render_header(track_name: str, lap_length: float, car_label: str):
    """Backwards-compatible alias."""
    render_f1_header(track_name, lap_length, car_label)


def render_f1_header(track_name: str, lap_length: float, car_label: str,
                     status: str = "TRACK GREEN"):
    """Broadcast-style session header with a live telemetry ticker strip
    (circuit, length, regulation, air/track temp, grip, wind)."""
    cond = TRACK_CONDITIONS.get(track_name, dict(
        air=22, track=34, grip="MEDIUM", wind="15 KM/H", sky="CLEAR", humidity=50))

    ticks = [
        ("Circuit", track_name.upper(), "neutral"),
        ("Lap Length", f"{lap_length:,.0f} M", "neutral"),
        ("Regulation", car_label, ""),
        ("Air Temp", f"{cond['air']}&deg;C", "warm"),
        ("Track Temp", f"{cond['track']}&deg;C", "warm"),
        ("Grip Index", cond["grip"], ""),
        ("Wind", cond["wind"], "neutral"),
        ("Sky", cond["sky"], "neutral"),
    ]
    tick_html = "".join(
        f'<div class="f1-tick">'
        f'<span class="f1-tick-label">{lbl}</span>'
        f'<span class="f1-tick-value {cls}">{val}</span>'
        f'</div>'
        for lbl, val, cls in ticks
    )

    render_html(
        f'<div class="f1-header">'
        f'<div class="f1-header-top">'
        f'<div class="f1-brand">'
        f'<div class="f1-logo">F1</div>'
        f'<div class="f1-titles">'
        f'<div class="f1-title">RACE CONTROL &bull; TELEMETRY</div>'
        f'<div class="f1-subtitle">PHYSICS-GRADE LAP &amp; PIT STRATEGY SOLVER &bull; SIM CONDITIONS</div>'
        f'</div></div>'
        f'<div class="f1-beacon"><div class="f1-beacon-dot"></div>'
        f'<span class="f1-beacon-text">{status}</span></div>'
        f'</div>'
        f'<div class="f1-ticker">{tick_html}</div>'
        f'</div>'
    )


def sidebar_mission_control(status_rows=None):
    """Render the sidebar 'Pit-Wall' bezel with glowing status LEDs."""
    rows = status_rows or [
        ("", "SIMULATION ENGINE LIVE"),
        ("cyan", "TELEMETRY ONLINE"),
        ("amber", "STRATEGY MODEL ARMED"),
    ]
    leds = "".join(
        f'<div class="mc-led-row"><span class="mc-led {tone}"></span>{label}</div>'
        for tone, label in rows
    )
    render_html(
        f'<div class="mc-panel">'
        f'<div class="mc-panel-title">PIT-WALL<span class="mc-panel-badge">PRO v2.0</span></div>'
        f'<div class="mc-panel-sub">F1 TELEMETRY &amp; VEHICLE DYNAMICS ENGINE</div>'
        f'<div class="mc-status-list">{leds}</div>'
        f'</div>'
    )


# ============================================================================
# 5 · TELEMETRY KPI READOUTS
# ============================================================================

def render_readout_row(items):
    """Responsive telemetry KPI cards.

    items: list of tuples
        (label, value, sub_text_or_None, accent_color)
        (label, value, sub_text_or_None, accent_color, trend_text)
      trend_text starting with '+', '-', '▲', '▼' is auto-coloured.
    """
    cards = []
    for it in items:
        label, value, sub, accent = it[0], it[1], it[2], it[3]
        trend = it[4] if len(it) > 4 else None

        trend_html = ""
        if trend:
            # trend may be a plain string (tone inferred from sign) or an
            # explicit (text, tone) pair where tone in {"up","down","flat"}.
            if isinstance(trend, (tuple, list)):
                t, cls = str(trend[0]).strip(), str(trend[1])
            else:
                t = str(trend).strip()
                if t[:1] in ("+", "▲") or t.upper().startswith("UP"):
                    cls = "up"
                elif t[:1] in ("-", "▼") or t.upper().startswith("DOWN"):
                    cls = "down"
                else:
                    cls = "flat"
            trend_html = f'<span class="tele-trend {cls}">{t}</span>'

        sub_html = f'<div class="tele-sub">{sub}</div>' if sub else ""
        cards.append(
            f'<div class="tele-card" style="--accent:{accent};">'
            f'<div class="tele-label"><span>{label}</span>{trend_html}</div>'
            f'<div class="tele-value">{value}</div>'
            f'{sub_html}'
            f'</div>'
        )
    render_html(f'<div class="tele-grid">{"".join(cards)}</div>')


# ============================================================================
# 6 · CIRCUIT CARD
# ============================================================================

def render_track_card(track_name: str, lap_length: float, pit_loss: float, segments):
    n_corners = sum(1 for s in segments if s.kind == "corner")
    straights = sum(s.length for s in segments if s.kind == "straight")
    straight_pct = (straights / lap_length * 100) if lap_length else 0

    render_html(
        f'<div class="circuit-card">'
        f'<div class="circuit-title">&#128205; {track_name}</div>'
        f'<div class="circuit-row"><span class="k">Lap Length</span><span class="v">{lap_length:,.0f} m</span></div>'
        f'<div class="circuit-row"><span class="k">Corner Segments</span><span class="v">{n_corners}</span></div>'
        f'<div class="circuit-row"><span class="k">Full-Throttle</span><span class="v">~{straight_pct:.0f}%</span></div>'
        f'<div class="circuit-row"><span class="k">Pit Lane Delta</span><span class="v">~{pit_loss:.1f}s</span></div>'
        f'</div>'
    )


# ============================================================================
# 7 · STINT TIMELINE  (compound stripes + undercut / overcut deltas)
# ============================================================================

def render_stint_timeline(stint_inputs, total_laps: int, delta_vs=None):
    """Broadcast-style horizontal tyre-compound stint timeline.

    stint_inputs : list of (compound_name, n_laps)
    total_laps   : int
    delta_vs     : optional float — race-time delta (s) vs a baseline strategy;
                   rendered as an undercut (gain) / overcut (loss) tag.
    """
    if total_laps <= 0:
        return

    segs = []
    cursor = 0
    for i, (compound, laps) in enumerate(stint_inputs):
        pct = max(laps / total_laps * 100.0, 0.0)
        fill, fg = COMPOUND_COLORS.get(compound, (COLORS["cyan"], "#fff"))
        start, end = cursor + 1, cursor + laps
        cursor = end
        if i > 0:
            segs.append('<div class="stint-pit"><span>PIT</span></div>')
        segs.append(
            f'<div class="stint-seg" style="width:{pct:.3f}%;background:{fill};color:{fg};">'
            f'<span>S{i+1} &bull; {compound[:1].upper()}</span>'
            f'<span class="lap-range">L{start}&ndash;L{end} ({laps})</span>'
            f'</div>'
        )

    delta_html = ""
    if delta_vs is not None:
        if delta_vs < 0:
            delta_html = f'<span class="delta-tag gain">UNDERCUT {delta_vs:+.2f}s</span>'
        elif delta_vs > 0:
            delta_html = f'<span class="delta-tag loss">OVERCUT {delta_vs:+.2f}s</span>'

    render_html(
        f'<div class="stint-wrap">'
        f'<div class="stint-head">'
        f'<span>&#127937; LAP 1</span>'
        f'<span>STRATEGY TIMELINE{delta_html}</span>'
        f'<span>FLAG &bull; L{total_laps} &#127937;</span>'
        f'</div>'
        f'<div class="stint-bar">{"".join(segs)}</div>'
        f'<div class="stint-legend">'
        f'<div class="stint-legend-item"><span class="compound-dot" style="background:{COLORS["soft"]};"></span>Soft C4/C5</div>'
        f'<div class="stint-legend-item"><span class="compound-dot" style="background:{COLORS["medium"]};"></span>Medium C2/C3</div>'
        f'<div class="stint-legend-item"><span class="compound-dot" style="background:{COLORS["hard"]};"></span>Hard C1/C2</div>'
        f'</div>'
        f'</div>'
    )


# ============================================================================
# 8 · REGULATION VERSUS PANEL
# ============================================================================

def render_reg_comparison(rows, label_a="2025 FIXED AERO", label_b="2026 ACTIVE AERO"):
    """Mirror-bar comparison panel: 2025 grows left (cyan), 2026 grows right (purple).

    rows : list of dict(label, a_val, b_val, a_frac, b_frac, [note])
           *_val  : display strings
           *_frac : 0..1 bar fill fraction (relative to the larger of the pair)
    """
    body = []
    for r in rows:
        af = max(0.0, min(1.0, float(r.get("a_frac", 0)))) * 100
        bf = max(0.0, min(1.0, float(r.get("b_frac", 0)))) * 100
        body.append(
            f'<div class="reg-row">'
            f'<div class="reg-val a">{r["a_val"]}</div>'
            f'<div class="reg-bar l"><i style="width:{af:.1f}%"></i></div>'
            f'<div class="reg-metric">{r["label"]}</div>'
            f'<div class="reg-bar r"><i style="width:{bf:.1f}%"></i></div>'
            f'<div class="reg-val b">{r["b_val"]}</div>'
            f'</div>'
        )
    render_html(
        f'<div class="reg-wrap">'
        f'<div class="reg-legend"><span class="a">&#9664; {label_a}</span>'
        f'<span class="b">{label_b} &#9654;</span></div>'
        f'{"".join(body)}'
        f'</div>'
    )


# ============================================================================
# 9 · STRATEGY + CORNER TABLES
# ============================================================================

def render_strategy_table(results, best_time: float, top_n: int = 10):
    """Leaderboard of pit strategies with FIA compound badges + gap tags."""
    rows = ""
    for i, (t, plan) in enumerate(results[:top_n]):
        gap = t - best_time
        if gap <= 1e-9:
            gap_html = (
                f'<span style="color:{COLORS["positive"]};font-weight:800;'
                f'background:rgba(0,230,118,0.12);padding:2px 9px;border-radius:4px;'
                f'border:1px solid rgba(0,230,118,0.3);font-family:{FONT_TECH};">OPTIMAL</span>'
            )
        else:
            gap_html = f'<span style="color:{COLORS["amber"]};font-family:{FONT_MONO};font-weight:700;">+{gap:.2f}s</span>'

        badges = ""
        for compound, laps in plan:
            fill, fg = COMPOUND_COLORS.get(compound, (COLORS["text_dim"], "#fff"))
            badges += (
                f'<span style="background:{fill};color:{fg};font-weight:800;'
                f'font-family:{FONT_MONO};font-size:0.74rem;padding:3px 9px;'
                f'border-radius:4px;margin-right:6px;box-shadow:0 2px 6px rgba(0,0,0,0.35);">'
                f'{compound.upper()} &bull; {laps}L</span>'
            )

        stops = len(plan) - 1
        rank_accent = COLORS["purple"] if i == 0 else (COLORS["cyan"] if i == 1 else COLORS["text_dim"])
        row_bg = COLORS["bg_card_alt"] if i % 2 == 0 else COLORS["bg_card_solid"]
        rows += (
            f'<tr style="background:{row_bg};">'
            f'<td style="font-family:{FONT_MONO};font-weight:800;color:{rank_accent};">P{i+1}</td>'
            f'<td>{badges}</td>'
            f'<td style="font-family:{FONT_TECH};color:{COLORS["text_dim"]};font-weight:700;">{stops}-STOP</td>'
            f'<td style="font-family:{FONT_MONO};color:#fff;font-weight:700;">{format_time_local(t)}</td>'
            f'<td>{gap_html}</td>'
            f'</tr>'
        )

    render_html(
        f'<div class="f1-table-wrap"><table class="f1-table"><thead><tr>'
        f'<th>Pos</th><th>Stint Strategy</th><th>Stops</th><th>Race Time</th><th>Delta</th>'
        f'</tr></thead><tbody>{rows}</tbody></table></div>'
    )


def render_corner_table(segments, result):
    """Per-corner entry / apex / exit speed breakdown."""
    v_arr = result["v_profile"] * 3.6
    seg_idx_arr = result["seg_idx"]

    rows = ""
    n = 0
    for idx, seg in enumerate(segments):
        if seg.kind != "corner":
            continue
        n += 1
        mask = (seg_idx_arr == idx)
        if np.any(mask):
            v_seg = v_arr[mask]
            apex, entry, exit_ = float(np.min(v_seg)), float(v_seg[0]), float(v_seg[-1])
        else:
            apex = entry = exit_ = 0.0
        turn_dir = "&#8594; R" if seg.direction > 0 else "&#8592; L"
        row_bg = COLORS["bg_card_alt"] if n % 2 == 0 else COLORS["bg_card_solid"]
        rows += (
            f'<tr style="background:{row_bg};">'
            f'<td style="font-family:{FONT_MONO};font-weight:700;color:{COLORS["cyan"]};">T{n}</td>'
            f'<td style="font-family:{FONT_BODY};font-weight:600;color:{COLORS["text"]};">{seg.name}</td>'
            f'<td style="font-family:{FONT_TECH};color:{COLORS["text_muted"]};">{turn_dir} &bull; R{seg.radius:.0f}m</td>'
            f'<td style="font-family:{FONT_MONO};color:{COLORS["text_muted"]};">{entry:.0f}</td>'
            f'<td style="font-family:{FONT_MONO};font-weight:800;color:{COLORS["amber"]};">{apex:.0f}</td>'
            f'<td style="font-family:{FONT_MONO};color:{COLORS["positive"]};">{exit_:.0f}</td>'
            f'</tr>'
        )

    render_html(
        f'<div class="f1-table-wrap"><div class="f1-scroll"><table class="f1-table"><thead><tr>'
        f'<th>Turn</th><th>Corner</th><th>Type</th><th>Entry km/h</th><th>Apex km/h</th><th>Exit km/h</th>'
        f'</tr></thead><tbody>{rows}</tbody></table></div></div>'
    )


def format_time_local(t: float) -> str:
    mins = int(t // 60)
    secs = t % 60
    return f"{mins}:{secs:06.3f}" if mins > 0 else f"{secs:.3f}s"


# ============================================================================
# 10 · PLOTLY THEME
# ============================================================================

_GRID = "rgba(255,255,255,0.055)"
_ZERO = "rgba(255,255,255,0.14)"
_AXIS = "rgba(255,255,255,0.18)"
PLOT_PAPER = "rgba(13,17,24,0.0)"
PLOT_BG = "rgba(9,12,18,0.35)"

PLOTLY_COLORWAY = [
    COLORS["cyan"], COLORS["f1_red"], COLORS["amber"],
    COLORS["purple"], COLORS["positive"], COLORS["wet"], COLORS["teal"],
]


def _register_template():
    axis = dict(
        gridcolor=_GRID, zerolinecolor=_ZERO, linecolor=_AXIS,
        tickfont=dict(family=FONT_MONO, size=10, color=COLORS["text_dim"]),
        title=dict(font=dict(family=FONT_TECH, size=12, color=COLORS["text_muted"])),
        showspikes=True, spikecolor="rgba(0,240,255,0.45)",
        spikethickness=1, spikedash="dot", spikemode="across",
    )
    tmpl = go.layout.Template(
        layout=dict(
            paper_bgcolor=PLOT_PAPER,
            plot_bgcolor=PLOT_BG,
            colorway=PLOTLY_COLORWAY,
            font=dict(family=FONT_MONO, color=COLORS["text_muted"], size=11),
            title=dict(font=dict(family=FONT_DISPLAY, color="#FFFFFF", size=15),
                       x=0.012, xanchor="left", y=0.97),
            xaxis=axis, yaxis=axis,
            legend=dict(bgcolor="rgba(11,14,20,0.78)", bordercolor=COLORS["border_solid"],
                        borderwidth=1, font=dict(family=FONT_TECH, size=11, color=COLORS["text"])),
            hoverlabel=dict(bgcolor="rgba(9,12,18,0.94)", bordercolor=COLORS["cyan"],
                            font=dict(family=FONT_MONO, size=12, color="#FFFFFF")),
            margin=dict(t=58, b=48, l=58, r=32),
        )
    )
    pio.templates["f1_pitwall"] = tmpl
    try:
        pio.templates.default = "plotly_dark+f1_pitwall"
    except Exception:
        pio.templates.default = "f1_pitwall"


_register_template()


def themed_layout_kwargs(height: int | None = None, *, transparent: bool = True,
                         unified_hover: bool = True, **overrides):
    """Layout kwargs matching the console. Spread into ``fig.update_layout()``."""
    kwargs = dict(
        template="f1_pitwall",
        paper_bgcolor="rgba(0,0,0,0)" if transparent else "rgba(13,17,24,0.85)",
        plot_bgcolor=PLOT_BG,
        font=dict(family=FONT_MONO, color=COLORS["text_muted"], size=11),
        colorway=PLOTLY_COLORWAY,
        title=dict(font=dict(family=FONT_DISPLAY, color="#FFFFFF", size=15),
                   x=0.012, xanchor="left"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1,
                    bgcolor="rgba(11,14,20,0.0)", bordercolor=COLORS["border_solid"],
                    font=dict(family=FONT_TECH, size=11, color=COLORS["text"])),
        hoverlabel=dict(bgcolor="rgba(9,12,18,0.94)", bordercolor=COLORS["cyan"],
                        font=dict(family=FONT_MONO, size=12, color="#FFFFFF")),
        margin=dict(t=64, b=52, l=60, r=34),
    )
    if unified_hover:
        kwargs["hovermode"] = "x unified"
    if height:
        kwargs["height"] = height
    kwargs.update(overrides)
    return kwargs


def style_axes(fig, *, spikes: bool = True):
    """Apply console axis styling across every subplot of a figure."""
    common = dict(
        gridcolor=_GRID, zerolinecolor=_ZERO, linecolor=_AXIS,
        tickfont=dict(family=FONT_MONO, size=10, color=COLORS["text_dim"]),
        title_font=dict(family=FONT_TECH, size=12, color=COLORS["text_muted"]),
    )
    fig.update_xaxes(**common)
    fig.update_yaxes(**common)
    if spikes:
        fig.update_xaxes(showspikes=True, spikecolor="rgba(0,240,255,0.45)",
                         spikethickness=1, spikedash="dot", spikemode="across")
    return fig


def style_annotations(fig):
    """Restyle subplot titles (paper-anchored annotations) to the tech label
    treatment, leaving data-anchored annotations (e.g. sector flags) alone."""
    for ann in fig.layout.annotations:
        if (ann.xref in (None, "paper")) and (ann.yref in (None, "paper")):
            ann.font = dict(family=FONT_TECH, color=COLORS["text_muted"], size=12)
    return fig


def add_sector_bands(fig, sector_edges, *, y_domain=True, row=None, col=None):
    """Shade S1 / S2 / S3 as alternating vertical bands with boundary flags.

    sector_edges : iterable of distance values (m) where a new sector starts,
                   e.g. [0, s1_end, s2_end, lap_length].
    """
    edges = list(sector_edges)
    tints = ["rgba(0,240,255,0.05)", "rgba(255,183,3,0.05)", "rgba(176,38,255,0.06)"]
    for i in range(len(edges) - 1):
        fig.add_vrect(
            x0=edges[i], x1=edges[i + 1],
            fillcolor=tints[i % len(tints)], line_width=0, layer="below",
            row=row, col=col,
        )
    for i, x in enumerate(edges[1:-1], start=1):
        fig.add_vline(
            x=x, line_width=1, line_dash="dot", line_color="rgba(255,255,255,0.25)",
            annotation_text=f"S{i} / S{i+1}", annotation_position="top",
            annotation_font=dict(family=FONT_TECH, size=9, color=COLORS["text_dim"]),
            row=row, col=col,
        )
    return fig


def glow_scatter(x, y, color, name, *, width=2.4, fill=False, glow=True, **kw):
    """A telemetry curve: crisp core line + optional soft outer glow + area fill.
    Returns a list of go.Scatter traces (add each with fig.add_trace)."""
    traces = []
    rgb = _hex_to_rgb(color)
    if glow:
        traces.append(go.Scatter(
            x=x, y=y, mode="lines", name=name, legendgroup=name, showlegend=False,
            line=dict(width=width * 3.4, color=f"rgba({rgb[0]},{rgb[1]},{rgb[2]},0.16)"),
            hoverinfo="skip",
        ))
    core = go.Scatter(
        x=x, y=y, mode="lines", name=name, legendgroup=name,
        line=dict(width=width, color=color),
        **kw,
    )
    if fill:
        core.update(fill="tozeroy", fillcolor=f"rgba({rgb[0]},{rgb[1]},{rgb[2]},0.14)")
    traces.append(core)
    return traces


def _hex_to_rgb(c: str):
    c = c.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def build_radar(categories, series, *, height: int = 420, title: str | None = None):
    """Radar / spider chart comparing regulation packages.

    categories : list[str]
    series     : list of (name, values(list[float] 0..100), color)
    """
    fig = go.Figure()
    for name, values, color in series:
        rgb = _hex_to_rgb(color)
        fig.add_trace(go.Scatterpolar(
            r=list(values) + [values[0]],
            theta=list(categories) + [categories[0]],
            fill="toself", name=name,
            line=dict(color=color, width=2.4),
            fillcolor=f"rgba({rgb[0]},{rgb[1]},{rgb[2]},0.16)",
            hovertemplate="%{theta}: %{r:.0f}<extra>" + name + "</extra>",
        ))
    fig.update_layout(**themed_layout_kwargs(height=height, unified_hover=False))
    fig.update_layout(
        polar=dict(
            bgcolor="rgba(9,12,18,0.4)",
            radialaxis=dict(range=[0, 100], showline=False, gridcolor=_GRID,
                            tickfont=dict(family=FONT_MONO, size=9, color=COLORS["text_dim"])),
            angularaxis=dict(gridcolor=_GRID,
                             tickfont=dict(family=FONT_TECH, size=11, color=COLORS["text_muted"])),
        ),
        showlegend=True,
    )
    if title:
        fig.update_layout(title=title)
    return fig


def plotly_config(*, static: bool = False):
    """Config dict for ``st.plotly_chart(fig, config=theme.plotly_config())``."""
    return {
        "displaylogo": False,
        "staticPlot": static,
        "modeBarButtonsToRemove": [
            "lasso2d", "select2d", "autoScale2d", "toggleSpikelines",
            "hoverClosestCartesian", "hoverCompareCartesian",
        ],
        "toImageButtonOptions": {"format": "png", "scale": 2, "filename": "f1_telemetry"},
    }
