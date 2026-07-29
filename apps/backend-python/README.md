# FBGroupScraper Pro 🚀

**FBGroupScraper Pro** is a modern, full-stack application designed to scrape public and private Facebook Group posts, manage scraper jobs using a background task queue, export results in multiple formats (Excel, CSV, JSON, Markdown, PDF), and analyze group engagement trends using rich visual charts.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS (Vibrant UI, support for Dark/Light Mode, Glassmorphic components).
- **Backend API**: FastAPI (Python) for fast, asynchronous endpoints and live status feeds via WebSockets.
- **Background Runner**: Celery Worker + Redis Broker (concurrency control and decoupled task management).
- **Database**: PostgreSQL (Docker environment) / SQLite (flexible local dev).
- **Scraper Engine**: Playwright Python with stealth patches to emulate human-like behavior (random delays, scrolling, cookie session injection).

---

## 🚀 Getting Started (Docker Compose)

The easiest way to run the entire stack is using **Docker Compose**:

### 1. Clone & Set Up Environment
Copy the env template file to configure connection keys:
```bash
cp .env.example .env
```

### 2. Boot Services
Build and start all components (PostgreSQL, Redis, FastAPI, Celery, and Nginx/React):
```bash
docker-compose up --build
```

### 3. Open Application
Once the build completes and services show running:
- Open your browser and navigate to: **`http://localhost:3000`**
- Register a new account (e.g., `test@example.com` / `password123`) and log in.

---

## 🧪 Testing in Demo / Simulation Mode (Recommended)

Since scraping Facebook requires credentials and can be subject to anti-bot challenges (CAPTCHAs), a **Simulation Mode** is built-in. This allows you to test the complete end-to-end flow, including real-time progress bars, analytics dashboards, and download exports, without triggering Facebook blocks.

### Step 1: Add a Demo Profile
1. Navigate to **Settings** from the sidebar.
2. Click the **"Quick Add Demo Account"** button in the top right.
3. This creates a mock profile with email `demo@example.com`.

### Step 2: Launch a Simulated Scrape
1. Go back to the **Dashboard**.
2. Enter any Facebook Group URL (e.g. `https://www.facebook.com/groups/demogroup`).
3. Select the `demo@example.com` account in the drop-down.
4. Set the limit (e.g. 20 posts) and click **"Launch Scraper Task"**.
5. You will be redirected to the details page, where you will see the progress bar update in real-time via WebSockets.

### Step 3: Review Results and Analytics
- **Results**: Browse the generated posts, reactions, comments, and attachments in a searchable table.
- **Analytics**: Look at the beautiful charts showing engagement timelines, reaction pie distributions, top posters, and keyword trends (word cloud).
- **Exports**: Click **Excel**, **CSV**, or **Markdown** to download files containing the scraped database rows.

---

## 🕵️ How to Configure Real Facebook Scraping

To scrape actual Facebook Groups, you must load a logged-in session into Playwright:

1. **Extract Cookies**:
   - Install a browser extension like **EditThisCookie** on your main browser.
   - Log in to Facebook (`https://www.facebook.com`).
   - Open the extension and export your cookies as a JSON array.
2. **Add to Settings**:
   - Go to **Settings** on FBGroupScraper Pro.
   - Enter your Facebook account email.
   - Paste the cookies JSON array into the **Session Cookies JSON** textarea and click **Save**.
3. **Launch Scrape**:
   - From the Dashboard, select your saved account, enter the target Facebook Group URL, and start the scraper.
   - Playwright will load your cookies, bypass the login screen, scroll through the group feed, parse posts, and save them.
