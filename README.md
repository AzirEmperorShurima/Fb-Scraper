# FbScraper Pro 🚀

**FbScraper Pro** is a modern, full-stack application designed to scrape public and private Facebook Group posts, manage scraper jobs using a background task queue, export results in multiple formats, and analyze group engagement trends using rich visual charts.

## 🛠️ Architecture & Tech Stack

This project is structured as a **Monorepo** with independent services:

- **Frontend (`apps/frontend`)**: React 18 + TypeScript + Tailwind CSS (Vibrant UI, Dark/Light Mode, Glassmorphic components).
- **Backend - Node (`apps/backend-node`)**: Express.js API, handling specific scraper tasks with Playwright.
- **Backend - Python (`apps/backend-python`)**: FastAPI service for fast, asynchronous endpoints, background worker (Celery/Redis).
- **Chrome Extension (`apps/extension`)**: Extension for scraping and session cookie extraction.

## 🚀 Getting Started (Docker Compose)

The easiest way to run the stack is using **Docker Compose**. We have split the configuration into separate files for flexibility:

### 1. Frontend
```bash
docker-compose -f docker-compose.frontend.yml up --build
```
Access at: `http://localhost:3000`

### 2. Backend - Node
```bash
docker-compose -f docker-compose.node.yml up --build
```
Access at: `http://localhost:8080`

### 3. Backend - Python
```bash
docker-compose -f docker-compose.python.yml up --build
```
Access at: `http://localhost:8000`

---

## 🏗️ Development

You can use `pnpm` at the root to manage dependencies across the monorepo workspaces.

### Documentation
Please see the `docs/` folder for more detailed information, rules, and user manuals.
