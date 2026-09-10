# MicroEvals 🔬

<div align="center">

**A lightweight, high-performance LLM benchmarking, streaming arena & evaluation platform.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111%2B-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4%2B-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com)

**English** • [简体中文](README_zh.md)

[Key Features](#-key-features) • [UI & Demo](#-ui-screenshots--live-demo) • [Quick Start](#-quick-start) • [Architecture](#-project-architecture) • [Testing](#-running-tests) • [License](#-license)

</div>

---

## 📖 Overview

**MicroEvals** is an open-source, lightweight, and high-performance benchmarking and arena platform designed for AI developers, researchers, and engineering teams. It enables side-by-side concurrent streaming comparisons across multiple LLMs, capturing sub-second latency, TTFT (Time to First Token), throughput (Tokens/s), and token costs in real time. It also provides automated batch dataset evaluations, pass-rate assertions, visual analytics leaderboards, and report exports.

No complex setup is required—the platform includes a **built-in zero-key Sandbox Demo Mode**, allowing you to test multi-model streaming, tool calling, and text diffing out of the box without providing any API keys.

---

## ✨ Key Features

- ⚡ **Multi-Model Streaming Arena (Playground)**
  - Compare 2 to 4 frontier LLMs side by side, broadcasting a single prompt simultaneously.
  - Granular control over sampling parameters: Temperature, Top-P, Presence/Frequency Penalty, and Stop Sequences.
  - Native Tool Calling / Function Calling support with structured execution feedback.
- 📊 **Sub-Second Performance Profiling**
  - **TTFT** (Time to First Token) monitoring.
  - **TPS** (Tokens per Second) generation throughput.
  - **Total Latency** & accurate token counting.
  - **Estimated Cost** calculation based on real-time model pricing models.
- 🔍 **Visual Text Diffing (Diff Viewer)**
  - One-click diff viewer to highlight subtle variances in reasoning paths, code generation, and structured outputs across models.
- 🏆 **Batch Benchmarking & Leaderboard**
  - Built-in benchmarks (e.g., StrawberryEval reasoning, p5.js physics animation, SVG generation, complex QA).
  - Custom dataset management: upload and persist CSV / JSONL test suites.
  - Visual charts for latency distribution, generation speed, and overall pass rates.
  - Export reports instantly to Markdown, CSV, or JSON formats.
- 🔌 **Universal Provider Compatibility**
  - Fully compatible with the standard OpenAI API specification.
  - Pre-configured profiles for **DeepSeek** (`deepseek-chat`, `deepseek-reasoner`), **OpenAI** (`gpt-4o`, `o3-mini`), **SiliconFlow**, **Ollama (local)**, and **Sandbox Demo**.
  - Add any custom OpenAI-compatible endpoint with one click.
- 🌐 **Bilingual & Modern Dark UI**
  - High-aesthetic developer-first dark mode interface with instant English / Chinese (i18n) switching.

---

## 📸 UI Screenshots & Live Demo

Below are captures of the running platform after startup:

### 1. Multi-Model Streaming Playground
> Configure multiple models side by side and evaluate prompts simultaneously with instant token estimation and reset controls.

![01 - Playground Initial View](docs/images/01-playground-initial.png)

---

### 2. Real-Time Streaming, Metrics & Text Diffing
> Parallel streaming generation with live TTFT, TPS, duration, and cost tracking, plus inline text diff comparison.

![02 - Streaming Responses & Diff Viewer](docs/images/02-playground-stream-diff.png)

---

### 3. Batch Evaluation Leaderboard & Analytics
> Run batch test suites and view comprehensive comparison charts (throughput, end-to-end latency, pass rates) and ranking tables.

![03 - Batch Evaluation Leaderboard](docs/images/03-batch-evals-report.png)

---

### 4. Built-in Benchmark Presets & Dataset Management
> Out-of-the-box benchmark test suites and custom CSV/JSONL dataset upload and management.

![04 - Presets & Dataset Manager](docs/images/04-batch-evals-datasets.png)

---

### 5. Provider & API Key Configuration
> Centralized management of provider base URLs, credentials, and available models with online connectivity checks.

![05 - Provider & API Key Settings](docs/images/05-provider-settings.png)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 9.0.0
- **Python** >= 3.10
- **uv** (recommended) or pip

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/hydrz/microevals.git
cd microevals

# Install frontend dependencies
pnpm install

# Create and activate Python virtual environment (using uv)
uv venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install backend core libraries and service in editable mode
uv pip install -e "packages/core" -e "packages/cli" -e "apps/api"
```

### 2. Start Frontend & Backend Concurrently

Run the following command at the root of the repository:

```bash
pnpm dev
```

The services will be available at:
- 🖥️ **Frontend Web Application**: `http://localhost:5173`
- ⚙️ **Backend API Server**: `http://localhost:8000`
- 📚 **Interactive Swagger API Docs**: `http://localhost:8000/docs`

> **Note**: You can also launch services individually:
> ```bash
> # Start only backend API
> pnpm dev:api
> 
> # Start only frontend
> pnpm dev:web
> ```

---

## 🏗️ Project Architecture

The project is structured as a **Monorepo**:

```
microevals/
├── apps/
│   ├── api/                 # FastAPI backend application
│   │   ├── app/api/         # API Routers (Playground, Evals, Providers, Presets, Datasets)
│   │   ├── app/core/        # Database, migrations, and app configuration
│   │   ├── app/models/      # SQLAlchemy ORM models
│   │   └── app/main.py      # Main application entry point
│   │
│   └── web/                 # React 18 + Vite frontend application
│       ├── src/components/  # UI Components (Playground, Evals, Analytics, Settings)
│       ├── src/hooks/       # Custom hooks (SSE streaming, etc.)
│       ├── src/i18n/        # Bilingual localization (EN / ZH)
│       ├── src/services/    # Client-side API services
│       └── src/App.tsx      # Main application component
│
├── packages/
│   ├── core/                # Core evaluation and model runner engine
│   │   ├── microevals_core/
│   │   │   ├── agent_sandbox/  # Tool definitions & sandbox execution
│   │   │   ├── runner/         # OpenAI-compatible streaming runner & metrics tracker
│   │   │   └── assertions/     # Automated scoring & assertion engine
│   │
│   └── cli/                 # MicroEvals CLI utility
│       └── microevals_cli/  # Terminal-based evaluation execution and exports
│
├── docs/
│   ├── agents/              # AI Agent guidelines and specifications
│   └── images/              # Application screenshots and demo media
├── package.json             # Root monorepo scripts and dependencies
├── pyproject.toml           # Python workspace definition
└── pnpm-workspace.yaml      # Monorepo workspace configuration
```

---

## 🧪 Running Tests

Execute unit and integration test suites:

```bash
pnpm test
```

Or run pytest directly:

```bash
.\.venv\Scripts\python -m pytest packages/core/tests packages/cli/tests apps/api/tests
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
