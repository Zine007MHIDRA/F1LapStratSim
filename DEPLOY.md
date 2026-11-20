# Deploying the F1 Pit-Wall Simulator

## 1. Vercel Deployment (24/7 Uptime, Zero Cold Starts) — Recommended

The simulator has been rebuilt as a **Next.js 16 (React 19 + TypeScript + Tailwind CSS)** application with a client-side physics engine. It runs 100% in the browser with 0 ms server latency, zero serverless execution timeouts, and 24/7 continuous uptime on Vercel without sleep or idling interruptions.

### One-Click Deploy to Vercel
1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Rebuild F1 simulation with Next.js 16 for 24/7 Vercel deployment"
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository (`F1LapStratSim`).
4. Framework Preset will auto-detect as **Next.js**.
5. Click **Deploy**. In under 60 seconds, your simulator is live at `https://<your-project>.vercel.app`!

---

## 2. Local Development (Next.js)

Run the high-speed Next.js pit-wall application locally:

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 3. Python CLI & Streamlit App (Optional)

The original Python vehicle dynamics engine and Streamlit app remain available in the repository:

```bash
# Install python dependencies
pip install -r requirements.txt

# Run the interactive CLI menu
python main.py

# Run the Streamlit web dashboard locally
streamlit run app.py
```
