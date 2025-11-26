// script.js - Visiting Card Digitiser core logic

// Global state
let cards = [];
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const exportBtn = document.getElementById('exportBtn');
const tableBody = document.querySelector('#cardsTable tbody');

// Settings UI
const settingsBtn = document.getElementById('settingsBtn');
const settingsSidebar = document.getElementById('settingsSidebar');
const closeSettings = document.getElementById('closeSettings');
const apiKeyInput = document.getElementById('apiKey');
const keyStatus = document.getElementById('keyStatus');
const keyDot = keyStatus.querySelector('.dot');
const aiStatusBadge = document.getElementById('aiStatusBadge');

// API Key State (In-memory only, or sessionStorage for refresh persistence)
let openaiKey = sessionStorage.getItem('openai_key') || '';

// Initialize UI state
if (openaiKey) {
    apiKeyInput.value = openaiKey;
    updateKeyStatus(true);
} else {
    updateKeyStatus(false);
}

// Sidebar Toggles
settingsBtn.addEventListener('click', () => settingsSidebar.classList.add('open'));
closeSettings.addEventListener('click', () => settingsSidebar.classList.remove('open'));
aiStatusBadge.addEventListener('click', () => settingsSidebar.classList.add('open'));

// Handle API Key Input
apiKeyInput.addEventListener('input', (e) => {
    const key = e.target.value.trim();
    openaiKey = key;
    if (key) {
        sessionStorage.setItem('openai_key', key);
        updateKeyStatus(true);
    } else {
        sessionStorage.removeItem('openai_key');
        updateKeyStatus(false);
    }
});

function updateKeyStatus(hasKey) {
    if (hasKey) {
        // Sidebar Status
        keyDot.classList.add('active');
        keyStatus.innerHTML = '<span class="dot active"></span> AI Extraction Enabled';

        // Badge Status
        aiStatusBadge.classList.add('active');
        aiStatusBadge.querySelector('.icon').textContent = '✨';
        aiStatusBadge.querySelector('.text').innerHTML = 'AI Enhanced Mode: <strong>ON</strong>';

        captureBtn.textContent = 'Capture Card (AI)';
    } else {
        // Sidebar Status
        keyDot.classList.remove('active');
        keyStatus.innerHTML = '<span class="dot"></span> No key provided (Using basic OCR)';

        // Badge Status
        aiStatusBadge.classList.remove('active');
        aiStatusBadge.querySelector('.icon').textContent = '⚡';
        aiStatusBadge.querySelector('.text').innerHTML = 'AI Enhanced Mode: <strong>OFF</strong> (Click to Enable)';

        captureBtn.textContent = 'Capture Card';
    }
}

// Initialize webcam stream
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) {
        alert('Error accessing webcam: ' + err.message);
    }
}

// Capture current frame to canvas and return a Blob
function captureFrame() {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Preprocess image for better OCR
    preprocessCanvas(canvas);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

// Image Preprocessing
function preprocessCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Grayscale & Contrast
    const factor = 1.2; // Contrast factor
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = avg; // Grayscale

        // Contrast
        data[i] = Math.min(255, data[i] * factor);
        data[i + 1] = Math.min(255, data[i + 1] * factor);
        data[i + 2] = Math.min(255, data[i + 2] * factor);
    }
    ctx.putImageData(imgData, 0, 0);
}

// --- Parsing Logic ---

// 1. OpenAI Parsing
async function parseWithOpenAI(text) {
    if (!openaiKey) return null;

    const prompt = `
    Extract structured contact information from this business card text.
    Return ONLY a JSON object with these keys:
    {
      "name": "Full Name",
      "phones": ["Phone 1", "Phone 2"],
      "email": "Email Address",
      "other": ["Company Name", "Job Title", "Address", "Website"]
    }
    If a field is missing, use empty string or empty array.
    Text:
    """${text}"""
  `;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0
            })
        });

        if (!response.ok) throw new Error('OpenAI API Error');

        const data = await response.json();
        const content = data.choices[0].message.content;
        // Clean up markdown code blocks if present
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (err) {
        console.error('AI Parsing failed:', err);
        return null;
    }
}

// 2. Regex Fallback Parsing
function extractEmails(text) {
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    return text.match(emailRegex) || [];
}
function extractPhones(text) {
    const phoneRegex = /\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g;
    return text.match(phoneRegex) || [];
}
function extractName(lines, emails, phones) {
    // Heuristic: Capitalized words, not email/phone
    const filtered = lines.filter(l => {
        const t = l.trim();
        return t && !emails.includes(t) && !phones.some(p => t.includes(p));
    });

    let bestScore = -1;
    let bestLine = '';

    filtered.forEach(line => {
        const words = line.split(/\s+/);
        const caps = words.filter(w => /^[A-Z]/.test(w)).length;
        if (caps > bestScore) {
            bestScore = caps;
            bestLine = line;
        }
    });

    return bestScore > 0 ? bestLine : (filtered[0] || '');
}
function extractOther(lines, name, emails, phones) {
    const excluded = new Set([name, ...emails, ...phones]);
    return lines.filter(l => {
        const t = l.trim();
        return t && !excluded.has(t);
    });
}

function addCard(card) {
    cards.unshift(card); // newest on top
    renderTable();
    localStorage.setItem('cards', JSON.stringify(cards));
}

function renderTable() {
    tableBody.innerHTML = '';
    cards.forEach((c) => {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.textContent = c.name;

        const tdPhones = document.createElement('td');
        tdPhones.textContent = Array.isArray(c.phones) ? c.phones.join(', ') : c.phones;

        const tdEmail = document.createElement('td');
        tdEmail.textContent = c.email;

        const tdOther = document.createElement('td');
        // Handle both array (AI) and flat array (Regex)
        tdOther.textContent = Array.isArray(c.other) ? c.other.join(' | ') : c.other;

        tr.append(tdName, tdPhones, tdEmail, tdOther);
        tableBody.appendChild(tr);
    });
}

async function processImage(blob) {
    const { data: { text } } = await Tesseract.recognize(blob, 'eng', {
        logger: m => console.log(m)
    });

    console.log("Raw OCR Text:", text);

    // Try AI first
    let card = await parseWithOpenAI(text);

    if (!card) {
        console.log("Falling back to Regex parsing...");
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const emails = extractEmails(text);
        const phones = extractPhones(text);
        const name = extractName(lines, emails, phones);
        const other = extractOther(lines, name, emails, phones);

        card = {
            name: name || 'N/A',
            phones: phones,
            email: emails[0] || 'N/A',
            other: other
        };
    }

    addCard(card);
}

captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    captureBtn.textContent = 'Processing...';
    try {
        const blob = await captureFrame();
        await processImage(blob);
    } catch (e) {
        console.error(e);
        alert("Error processing card");
    }
    captureBtn.textContent = 'Capture Card';
    captureBtn.disabled = false;
});

exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(cards, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cards.json';
    a.click();
    URL.revokeObjectURL(url);
});

// Load persisted cards on start
function loadPersisted() {
    const stored = localStorage.getItem('cards');
    if (stored) {
        try {
            cards = JSON.parse(stored);
            renderTable();
        } catch (e) { console.error('Failed to parse stored cards', e); }
    }
}

// Init everything
initCamera();
loadPersisted();
