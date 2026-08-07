import streamlit as st
import matplotlib.pyplot as plt

from car_model import car_2025, car_2026
from track_model import MONZA_SEGMENTS, total_length
from lap_sim import simulate_lap
from race_sim import simulate_race_strategy
from strategy_optimizer import find_best_strategy, format_plan, format_time

st.set_page_config(page_title="F1 Lap & Strategy Sim", layout="wide")
st.title("F1 Lap Time & Strategy Simulator (Monza)")

# Sidebar Controls
st.sidebar.header("Configuration")
car_era = st.sidebar.radio("Car Era", ["2026 Active Aero", "2025 Fixed Wing"])
car = car_2026() if car_era == "2026 Active Aero" else car_2025()

tab1, tab2, tab3 = st.tabs(["Fastest Lap", "Custom Race Strategy", "Strategy Optimizer"])

# TAB 1: Single Lap Sim
with tab1:
    st.subheader("Single Lap Simulation")
    if st.button("Run Lap Sim"):
        res = simulate_lap(MONZA_SEGMENTS, car, step=2.0)
        t = res["lap_time"]

        col1, col2, col3 = st.columns(3)
        col1.metric("Lap Time", format_time(t))
        col2.metric("Top Speed", f"{res['v_profile'].max() * 3.6:.1f} km/h")
        col3.metric("Avg Speed", f"{(total_length(MONZA_SEGMENTS) / t) * 3.6:.1f} km/h")

        fig, ax = plt.subplots(figsize=(10, 4))
        ax.plot(res["s"], res["v_profile"] * 3.6, color="#e10600", linewidth=2)
        ax.set_xlabel("Distance (m)")
        ax.set_ylabel("Speed (km/h)")
        ax.set_title(f"Monza Speed Trace ({car_era})")
        ax.grid(alpha=0.3)
        st.pyplot(fig)

# TAB 2: Custom Strategy
with tab2:
    st.subheader("Custom Race Strategy")
    total_laps = st.number_input("Total Laps", value=53, min_value=5, max_value=70)

    c1, l1 = st.columns(2)
    stint1_comp = c1.selectbox("Stint 1 Tyre", ["medium", "soft", "hard"])
    stint1_laps = l1.number_input("Stint 1 Laps", value=25, min_value=1, max_value=int(total_laps) - 1)

    stint2_comp = stint1_comp  # fallback logic
    stint2_laps = total_laps - stint1_laps
    st.info(f"Stint 2: Auto-filled with **{total_laps - stint1_laps} laps** remaining")
    stint2_comp = st.selectbox("Stint 2 Tyre", ["hard", "medium", "soft"])

    if st.button("Simulate Strategy"):
        plan = [(stint1_comp, int(stint1_laps)), (stint2_comp, int(stint2_laps))]
        res = simulate_race_strategy(MONZA_SEGMENTS, car, plan, total_laps, step=8.0)

        st.success(f"Total Race Time: **{format_time(res['total_time'])}**")
        st.line_chart(res["lap_times"])

# TAB 3: Auto-Optimizer
with tab3:
    st.subheader("Find Fastest Strategy")
    if st.button("Run Optimizer"):
        with st.spinner("Searching strategies..."):
            results = find_best_strategy(MONZA_SEGMENTS, car, 53, include_2stop=False, step=20.0, verbose=False)

            data = []
            for i, (t, plan) in enumerate(results[:10]):
                data.append({
                    "Rank": i + 1,
                    "Strategy": format_plan(plan),
                    "Total Time": format_time(t),
                    "Gap": f"+{t - results[0][0]:.1f}s" if i > 0 else "BEST"
                })
            st.table(data)
