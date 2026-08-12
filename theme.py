"""
theme.py

Visual identity for the F1 simulator, grounded in real F1 timing-tower /
pit-wall display conventions rather than a generic dark theme:

  - amber (#FF6B00)  = live/current reading (timing screens use this family
                        for the currently-running lap)
  - cyan   (#00D4FF) = fast / highlight
  - purple (#9D4EDD) = personal-best / fastest-ever (homage to real F1
                        timing's "purple sector" convention)
  - tyre compound colors (red/yellow/white) = the actual FIA colors,
    already used in tyre_model.py, carried through into the UI

Signature element: "timing-tower readout cards" — a colored left-edge strip
+ small-caps mono label + large tabular-mono number, standing in for
Streamlit's generic st.metric() and directly referencing real broadcast
timing screens.
"""

import streamlit as st

COLORS = {
    "bg": "#0A0C0F",
    "bg_panel": "#14171C",
    "bg_panel_alt": "#1B1F26",
    "border": "#2A2F38",
    "text": "#EDEEF0",
    "text_dim": "#8A8F98",
    "amber": "#FF6B00",
    "cyan": "#00D4FF",
    "purple": "#9D4EDD",
    "positive": "#00E676",
    "negative": "#FF3B3B",
    "soft": "#FF3B3B",
    "medium": "#FFD400",
    "hard": "#F5F5F5",
}

FONT_DISPLAY = "'Chakra Petch', sans-serif"
FONT_MONO = "'JetBrains Mono', monospace"
FONT_BODY = "'IBM Plex Sans', sans-serif"


def inject_css():
    st.markdown(f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

    html, body, [class*="css"] {{
        font-family: {FONT_BODY};
    }}

    .stApp {{
        background:
            repeating-linear-gradient(115deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 5px),
            {COLORS['bg']};
    }}

    /* ---------- Sidebar ---------- */
    [data-testid="stSidebar"] {{
        background-color: {COLORS['bg_panel']};
        border-right: 1px solid {COLORS['border']};
    }}
    [data-testid="stSidebar"] h1 {{
        font-family: {FONT_DISPLAY};
        font-weight: 700;
        letter-spacing: 0.04em;
        color: {COLORS['text']};
        font-size: 1.3rem;
        text-transform: uppercase;
        border-bottom: 2px solid {COLORS['amber']};
        padding-bottom: 0.5rem;
    }}
    [data-testid="stSidebar"] label, [data-testid="stSidebar"] p {{
        font-family: {FONT_BODY};
        color: {COLORS['text_dim']};
    }}
    [data-testid="stSidebar"] .stCaption {{
        font-family: {FONT_MONO};
        letter-spacing: 0.03em;
    }}

    /* ---------- Headings ---------- */
    h1, h2, h3 {{
        font-family: {FONT_DISPLAY};
        letter-spacing: 0.02em;
    }}
    h2, h3 {{
        text-transform: uppercase;
        font-size: 1.05rem !important;
        color: {COLORS['text_dim']};
        border-left: 3px solid {COLORS['amber']};
        padding-left: 0.6rem;
    }}

    /* ---------- Tabs (segmented pill style) ---------- */
    [data-testid="stTabs"] [data-baseweb="tab-list"] {{
        gap: 4px;
        background-color: {COLORS['bg_panel']};
        padding: 4px;
        border-radius: 8px;
        border: 1px solid {COLORS['border']};
    }}
    [data-testid="stTabs"] [data-baseweb="tab"] {{
        font-family: {FONT_DISPLAY};
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        font-size: 0.82rem;
        border-radius: 6px;
        color: {COLORS['text_dim']};
    }}
    [data-testid="stTabs"] [aria-selected="true"] {{
        background-color: {COLORS['bg_panel_alt']};
        color: {COLORS['amber']} !important;
    }}

    /* ---------- Buttons ---------- */
    .stButton > button {{
        font-family: {FONT_DISPLAY};
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        font-size: 0.85rem;
        background-color: {COLORS['amber']};
        color: #0A0C0F;
        border: none;
        border-radius: 4px;
        transition: box-shadow 0.15s ease, transform 0.05s ease;
    }}
    .stButton > button:hover {{
        box-shadow: 0 0 16px rgba(255,107,0,0.55);
        color: #0A0C0F;
    }}
    .stButton > button:active {{
        transform: scale(0.98);
    }}

    /* ---------- Misc widgets ---------- */
    [data-testid="stMetricValue"] {{
        font-family: {FONT_MONO};
    }}
    .stCaption, [data-testid="stCaptionContainer"] {{
        font-family: {FONT_BODY};
        color: {COLORS['text_dim']};
    }}
    hr {{
        border-color: {COLORS['border']};
    }}

    /* ---------- Alert boxes (info/success/warning/error) ---------- */
    [data-testid="stAlertContainer"] {{
        background-color: {COLORS['bg_panel']} !important;
        border: 1px solid {COLORS['border']};
        border-left: 3px solid {COLORS['cyan']};
        font-family: {FONT_BODY};
    }}
    [data-testid="stAlertContainer"] p {{
        color: {COLORS['text']} !important;
    }}

    /* ---------- Signature: timing-tower readout card ---------- */
    .readout-row {{
        display: flex;
        gap: 12px;
        margin: 0.4rem 0 1.1rem 0;
        flex-wrap: wrap;
    }}
    .readout-card {{
        flex: 1 1 160px;
        background-color: {COLORS['bg_panel']};
        border: 1px solid {COLORS['border']};
        border-left: 4px solid var(--accent, {COLORS['amber']});
        border-radius: 4px;
        padding: 0.7rem 0.9rem;
    }}
    .readout-label {{
        font-family: {FONT_MONO};
        font-size: 0.68rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: {COLORS['text_dim']};
        margin-bottom: 0.15rem;
    }}
    .readout-value {{
        font-family: {FONT_MONO};
        font-weight: 700;
        font-size: 1.65rem;
        color: {COLORS['text']};
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }}
    .readout-sub {{
        font-family: {FONT_MONO};
        font-size: 0.72rem;
        color: {COLORS['text_dim']};
        margin-top: 0.1rem;
    }}

    /* ---------- Header banner ---------- */
    .session-banner {{
        border-top: 1px solid {COLORS['border']};
        border-bottom: 2px solid {COLORS['amber']};
        padding: 0.55rem 0 0.55rem 0;
        margin-bottom: 1.2rem;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 0.5rem;
    }}
    .session-title {{
        font-family: {FONT_DISPLAY};
        font-weight: 700;
        font-size: 1.5rem;
        letter-spacing: 0.03em;
        color: {COLORS['text']};
        text-transform: uppercase;
    }}
    .session-title .accent {{ color: {COLORS['amber']}; }}
    .session-meta {{
        font-family: {FONT_MONO};
        font-size: 0.78rem;
        letter-spacing: 0.04em;
        color: {COLORS['text_dim']};
        text-transform: uppercase;
    }}
    .session-meta .dot {{
        color: {COLORS['amber']};
        margin: 0 0.4em;
    }}
    </style>
    """, unsafe_allow_html=True)


def render_header(track_name: str, lap_length: float, car_label: str):
    html = (
        '<div class="session-banner">'
        '<div class="session-title">F1 <span class="accent">TELEMETRY</span> SIM</div>'
        f'<div class="session-meta">{track_name}<span class="dot">&#9679;</span>{lap_length:.0f} M'
        f'<span class="dot">&#9679;</span>{car_label}</div>'
        '</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_readout_row(items):
    """items: list of (label, value, sub_text_or_None, accent_color_hex)"""
    cards = ""
    for label, value, sub, accent in items:
        sub_html = f'<div class="readout-sub">{sub}</div>' if sub else ""
        cards += (
            f'<div class="readout-card" style="--accent: {accent};">'
            f'<div class="readout-label">{label}</div>'
            f'<div class="readout-value">{value}</div>'
            f'{sub_html}'
            '</div>'
        )
    st.markdown(f'<div class="readout-row">{cards}</div>', unsafe_allow_html=True)


def render_strategy_table(results, best_time: float, top_n: int = 10):
    """Custom strategy leaderboard with real FIA tyre-compound color badges
    (red/yellow/white) instead of a plain text table."""
    compound_colors = {"soft": COLORS["soft"], "medium": COLORS["medium"], "hard": COLORS["hard"]}
    rows = ""
    for i, (t, plan) in enumerate(results[:top_n]):
        gap = t - best_time
        gap_html = (f'<span style="color:{COLORS["positive"]};font-weight:700;">BEST</span>'
                    if gap <= 1e-9 else f'<span style="color:{COLORS["text_dim"]};">+{gap:.1f}s</span>')
        badges = ""
        for compound, laps in plan:
            c = compound_colors.get(compound, COLORS["text_dim"])
            text_color = "#0A0C0F" if compound in ("medium", "hard") else "#FFFFFF"
            badges += (f'<span style="background:{c};color:{text_color};font-weight:700;'
                       f'font-family:{FONT_MONO};font-size:0.72rem;padding:2px 7px;'
                       f'border-radius:3px;margin-right:5px;">{compound.upper()} {laps}</span>')
        row_bg = COLORS["bg_panel_alt"] if i % 2 == 0 else COLORS["bg_panel"]
        rows += (
            f'<tr style="background:{row_bg};">'
            f'<td style="padding:8px 10px;font-family:{FONT_MONO};color:{COLORS["text_dim"]};">{i+1}</td>'
            f'<td style="padding:8px 10px;">{badges}</td>'
            f'<td style="padding:8px 10px;font-family:{FONT_MONO};color:{COLORS["text"]};font-weight:600;">{format_time_local(t)}</td>'
            f'<td style="padding:8px 10px;">{gap_html}</td>'
            '</tr>'
        )
    header_style = (f'font-family:{FONT_MONO};font-size:0.7rem;letter-spacing:0.08em;'
                     f'color:{COLORS["text_dim"]};text-transform:uppercase;padding:8px 10px;'
                     f'border-bottom:2px solid {COLORS["amber"]};text-align:left;')
    table_html = (
        f'<table style="width:100%;border-collapse:collapse;border:1px solid {COLORS["border"]};border-radius:4px;overflow:hidden;">'
        '<thead><tr>'
        f'<th style="{header_style}">Rank</th>'
        f'<th style="{header_style}">Strategy</th>'
        f'<th style="{header_style}">Total Time</th>'
        f'<th style="{header_style}">Gap</th>'
        '</tr></thead>'
        f'<tbody>{rows}</tbody>'
        '</table>'
    )
    st.markdown(table_html, unsafe_allow_html=True)


def format_time_local(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"


def themed_layout_kwargs(height: int = None):
    """Common Plotly layout overrides to match the dark timing-tower theme.
    Merge into fig.update_layout(**themed_layout_kwargs())."""
    kwargs = dict(
        paper_bgcolor=COLORS["bg_panel"],
        plot_bgcolor=COLORS["bg_panel"],
        font=dict(family=FONT_MONO, color=COLORS["text_dim"], size=12),
        title_font=dict(family=FONT_DISPLAY, color=COLORS["text"], size=16),
        xaxis=dict(gridcolor=COLORS["border"], zerolinecolor=COLORS["border"]),
        yaxis=dict(gridcolor=COLORS["border"], zerolinecolor=COLORS["border"]),
        margin=dict(t=50, b=40, l=50, r=30),
    )
    if height:
        kwargs["height"] = height
    return kwargs
