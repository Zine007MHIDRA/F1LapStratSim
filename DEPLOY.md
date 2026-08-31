# Deploying the F1 Pit-Wall Simulator

## TL;DR — Vercel won't run this

Streamlit is a **stateful server**: it keeps a Python process alive and holds a
WebSocket open to every connected browser. Vercel only runs **stateless
serverless functions** with a hard 10–60 s execution limit (the strategy
optimizer alone takes 70 s+) and no long-lived WebSocket. There is no
supported way to run a Streamlit app on Vercel.

Use one of the hosts below (all free, all built for this). If you specifically
need your Vercel domain in front of it, see
[§4 — Vercel as a front door](#4-optional-keep-a-vercel-url).

The app's only runtime dependencies are `streamlit`, `plotly`, `numpy`
(`requirements.txt`). `matplotlib` / `fastf1` are dev-only
(`requirements-dev.txt`) and are **not** installed on deploy.

---

## 0. One-time: put the code on GitHub

Every option below deploys *from a GitHub repo*. Run this from the folder that
contains `app.py`:

```bash
git init
git add .
git commit -m "F1 pit-wall simulator"
git branch -M main
gh repo create f1-pitwall-sim --public --source=. --push
```

(or create the repo on github.com and `git remote add origin … && git push -u origin main`)

---

## 1. Streamlit Community Cloud — recommended

Zero config, free, made for exactly this.

1. Go to <https://share.streamlit.io> and sign in with GitHub.
2. **Create app** → pick your repo, branch `main`, **Main file path** `app.py`
   (or `f1sim/app.py` if you committed the parent folder).
3. **Advanced settings → Python version → 3.12**.
4. **Deploy**. First build ~2 min; you get `https://<name>.streamlit.app`.

It auto-redeploys on every `git push`. `requirements.txt` and
`.streamlit/config.toml` are picked up automatically.

---

## 2. Hugging Face Spaces — also great, free

1. <https://huggingface.co/new-space> → **SDK: Streamlit**, hardware **CPU basic (free)**.
2. Push your code to the Space's git remote (it's just a git repo):
   ```bash
   git remote add hf https://huggingface.co/spaces/<user>/<space>
   git push hf main
   ```
3. HF looks for `app.py` at the repo root and `requirements.txt` beside it —
   both already correct here. Add this frontmatter to the **top** of a
   `README.md` in the Space (or set it in the Space UI):
   ```
   ---
   title: F1 Pit-Wall Simulator
   emoji: 🏎️
   sdk: streamlit
   app_file: app.py
   python_version: "3.12"
   pinned: false
   ---
   ```

---

## 3. Render — if you want a custom domain / always-on

Uses `render.yaml` (already in the repo).

1. <https://dashboard.render.com> → **New → Blueprint** → connect the repo.
2. Render reads `render.yaml`: Python 3.12, `pip install -r requirements.txt`,
   and starts with
   `streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true`.
3. Free tier sleeps after ~15 min idle (cold start ~30 s). Bump to the
   Starter plan for always-on + a custom domain.

If a reverse proxy ever blocks the WebSocket (rare on current Streamlit), add
`--server.allowedHosts "*"` to the start command, or set
`server.corsAllowedOrigins` in `.streamlit/config.toml`.

The repo also has a **`Procfile`** with the same start command, so Railway,
Heroku, Fly.io, etc. work the same way (`web:` process → Streamlit on `$PORT`).

---

## 4. (Optional) Keep a Vercel URL

If the app must live *behind* a Vercel domain, deploy the Streamlit app on
one of the hosts above, then use Vercel purely to forward traffic.

**`vercel.json`** in this repo does a redirect — edit the placeholder URL:

```json
{
  "redirects": [
    { "source": "/(.*)", "destination": "https://your-app.streamlit.app/$1", "permanent": false }
  ]
}
```

`vercel deploy --prod` and `yourproject.vercel.app` now bounces to the real app.
A `redirect` changes the address bar; a `rewrite` would proxy and keep your
domain, but Vercel's proxy does not reliably upgrade Streamlit's WebSocket, so
**redirect is the safe choice**.

---

## Hosted-demo tips

- **Optimizer speed.** `find_best_strategy` is brute force — a 53-lap search at
  the "Balanced" resolution is ~1–2 min on a free-tier CPU. Point users at the
  **"Fast" (40 m)** resolution, or lower the default lap count, if the wait
  feels broken.
- **No writable disk needed.** The app never writes files, so ephemeral
  filesystems (Streamlit Cloud, HF, Render free) are fine. Only the FastF1
  calibration scripts write to `f1_cache/`, and those don't run in the app.
- **Secrets.** None required. `.streamlit/secrets.toml` is git-ignored if you
  ever add any.
