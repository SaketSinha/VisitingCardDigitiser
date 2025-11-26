# Visiting Card Digitiser 📇

A **premium, AI-powered** web application that digitises business cards using your webcam. It combines local OCR (Tesseract.js) with the intelligence of OpenAI to accurately extract and structure contact information.

![App Screenshot](logo.png)

## ✨ Features

-   **📸 Instant Capture**: Use your webcam to snap a photo of any visiting card.
-   **🧠 AI-Powered Extraction**:
    -   Integrates with **OpenAI (GPT-4o-mini)** for superior accuracy.
    -   Intelligently identifies Name, Phone, Email, Company, Title, and Address.
    -   Handles complex layouts and non-standard card designs.
-   **⚡ Local OCR Fallback**: Works offline using **Tesseract.js** if no API key is provided.
-   **🎨 Premium UI**:
    -   Glassmorphism design with a sleek dark mode.
    -   Responsive layout for desktop and mobile.
    -   Smooth micro-animations and interactive elements.
-   **🔒 Privacy First**:
    -   Your OpenAI API Key is **never saved to a server**. It lives only in your browser's session.
    -   Images are processed locally or sent directly to OpenAI (only when AI mode is on).
-   **💾 Export Data**: Download your collected contacts as a `cards.json` file.

## 🚀 Getting Started

### 1. Run Locally
Since this is a static web app, you don't need to install anything!

1.  **Clone or Download** this repository.
2.  **Open `index.html`** directly in your browser (Chrome, Edge, Firefox, etc.).
3.  **Allow Camera Access** when prompted.

### 2. Enable AI Mode (Recommended)
For the best results, use your OpenAI API Key:

1.  Click the **Settings Gear ⚙️** (top right) or the **AI Status Badge** (above the capture button).
2.  Paste your **OpenAI API Key** (starts with `sk-...`).
3.  The status badge will turn **Green** (✨ AI Enhanced Mode: ON).
4.  Scan a card! The app will now use GPT-4o-mini to parse the text.

*Note: If you don't have a key, the app will use standard Regex parsing, which is faster but less accurate.*

## 🌐 Deployment

You can host this app for **free** on any static site provider (Railway, Netlify, Vercel, GitHub Pages).

### Deploy to Railway (Easiest)
1.  Push this folder to a **GitHub Repository**.
2.  Log in to [Railway](https://railway.app/).
3.  Click **New Project** → **Deploy from GitHub repo**.
4.  Select your repository.
5.  Railway will detect it as a static site and deploy it instantly.

**No server configuration is needed!**

## 📂 Project Structure

```
VisitingCardDigitiser/
├── index.html      # Main application structure
├── style.css       # Premium styling & animations
├── script.js       # Core logic (Webcam, OCR, AI integration)
├── logo.png        # App logo
├── README.md       # Documentation
└── package.json    # (Optional) For Node.js based deployments
```

## 🛠️ Technologies Used
-   **Frontend**: HTML5, CSS3 (Glassmorphism), JavaScript (ES6+)
-   **OCR Engine**: Tesseract.js (WASM)
-   **AI Intelligence**: OpenAI API (GPT-4o-mini)
-   **Fonts**: Google Fonts (Inter)

## 📄 License
MIT License. Feel free to modify and use for your own projects!
