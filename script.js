// script.js - Visiting Card Digitiser core logic

// Global state
let cards = [];
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const exportBtn = document.getElementById('exportBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const tableBody = document.querySelector('#cardsTable tbody');

// Settings UI
const settingsBtn = document.getElementById('settingsBtn');
const settingsSidebar = document.getElementById('settingsSidebar');
const closeSettings = document.getElementById('closeSettings');
const apiKeyInput = document.getElementById('apiKey');
const aiProviderSelect = document.getElementById('aiProvider');
const keyValidationMsg = document.getElementById('keyValidationMsg');
const keyStatus = document.getElementById('keyStatus');
const keyDot = keyStatus.querySelector('.dot');
const aiStatusBadge = document.getElementById('aiStatusBadge');

// API Key State
let apiKey = sessionStorage.getItem('ai_api_key') || '';
let aiProvider = sessionStorage.getItem('ai_provider') || 'openai';

// Initialize UI state
if (apiKey) {
    apiKeyInput.value = apiKey;
    aiProviderSelect.value = aiProvider;
    validateKey(apiKey, aiProvider);
} else {
    updateKeyStatus(false);
}

// Sidebar Toggles
settingsBtn.addEventListener('click', () => settingsSidebar.classList.add('open'));
closeSettings.addEventListener('click', () => settingsSidebar.classList.remove('open'));
aiStatusBadge.addEventListener('click', () => settingsSidebar.classList.add('open'));

// Handle Settings Input
aiProviderSelect.addEventListener('change', (e) => {
    aiProvider = e.target.value;
    sessionStorage.setItem('ai_provider', aiProvider);
    validateKey(apiKey, aiProvider);
});

apiKeyInput.addEventListener('input', (e) => {
    const key = e.target.value.trim();
    apiKey = key;
    if (key) {
        sessionStorage.setItem('ai_api_key', key);
        validateKey(key, aiProvider);
    } else {
        sessionStorage.removeItem('ai_api_key');
        updateKeyStatus(false);
        keyValidationMsg.textContent = '';
        keyValidationMsg.className = 'validation-msg';
    }
});

function validateKey(key, provider) {
    let isValid = false;
    let msg = '';

    if (provider === 'openai') {
        isValid = key.startsWith('sk-');
        msg = isValid ? 'Valid OpenAI Key format' : 'Invalid OpenAI Key (must start with sk-)';
    } else if (provider === 'gemini') {
        isValid = key.length > 20 && !key.startsWith('sk-'); // Simple heuristic
        msg = isValid ? 'Valid Gemini Key format' : 'Invalid Gemini Key format';
    } else if (provider === 'anthropic') {
        isValid = key.startsWith('sk-ant-');
        msg = isValid ? 'Valid Anthropic Key format' : 'Invalid Anthropic Key (must start with sk-ant-)';
    }

    keyValidationMsg.textContent = msg;
    keyValidationMsg.className = `validation-msg ${isValid ? 'valid' : 'invalid'}`;
    
    updateKeyStatus(isValid);
    return isValid;
}

function updateKeyStatus(hasKey) {
    if (hasKey) {
        keyDot.classList.add('active');
        keyStatus.innerHTML = '<span class="dot active"></span> AI Extraction Enabled';
        aiStatusBadge.classList.add('active');
        aiStatusBadge.querySelector('.icon').textContent = '✨';
        aiStatusBadge.querySelector('.text').innerHTML = 'AI Enhanced Mode: <strong>ON</strong>';
        captureBtn.textContent = 'Capture Card (AI)';
    } else {
        keyDot.classList.remove('active');
        keyStatus.innerHTML = '<span class="dot"></span> No key provided (Using basic OCR)';
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
    const factor = 1.2; 
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = avg; 
        data[i] = Math.min(255, data[i] * factor);
        data[i + 1] = Math.min(255, data[i + 1] * factor);
        data[i + 2] = Math.min(255, data[i + 2] * factor);
    }
    ctx.putImageData(imgData, 0, 0);
}

// --- Parsing Logic ---

async function parseWithAI(text) {
    if (!apiKey) return null;

    const promptText = `
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
        let response;
        if (aiProvider === 'openai') {
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: promptText }],
                    temperature: 0
                })
            });
        } else if (aiProvider === 'anthropic') {
             response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 
                    'x-api-key': apiKey, 
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                    'dangerously-allow-browser': 'true' // Required for client-side
                },
                body: JSON.stringify({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 1024,
                    messages: [{ role: "user", content: promptText }]
                })
            });
        } else if (aiProvider === 'gemini') {
            // Gemini requires a different endpoint structure usually, but for simplicity we'll use the standard REST API
            // Note: Gemini API often requires the key in the URL query param
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }]
                })
            });
        }

        if (!response.ok) throw new Error(`${aiProvider} API Error`);

        const data = await response.json();
        let content = '';

        if (aiProvider === 'openai') {
            content = data.choices[0].message.content;
        } else if (aiProvider === 'anthropic') {
            content = data.content[0].text;
        } else if (aiProvider === 'gemini') {
            content = data.candidates[0].content.parts[0].text;
        }

        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (err) {
        console.error('AI Parsing failed:', err);
        return null;
    }
}

// Regex Fallback (unchanged)
function extractEmails(text) { return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []; }
function extractPhones(text) { return text.match(/\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g) || []; }
function extractName(lines, emails, phones) {
    const filtered = lines.filter(l => {
        const t = l.trim();
        return t && !emails.includes(t) && !phones.some(p => t.includes(p));
    });
    let bestScore = -1, bestLine = '';
    filtered.forEach(line => {
        const words = line.split(/\s+/);
        const caps = words.filter(w => /^[A-Z]/.test(w)).length;
        if (caps > bestScore) { bestScore = caps; bestLine = line; }
    });
    return bestScore > 0 ? bestLine : (filtered[0] || '');
}
function extractOther(lines, name, emails, phones) {
    const excluded = new Set([name, ...emails, ...phones]);
    return lines.filter(l => { const t = l.trim(); return t && !excluded.has(t); });
}

function addCard(card) {
    cards.unshift(card);
    renderTable();
    saveCards();
}

function saveCards() { localStorage.setItem('cards', JSON.stringify(cards)); }

function updateCard(index, field, value) {
    cards[index][field] = value;
    saveCards();
}

function deleteCard(index) {
    if (confirm('Are you sure you want to delete this card?')) {
        cards.splice(index, 1);
        renderTable();
        saveCards();
    }
}

function renderTable() {
    tableBody.innerHTML = '';
    cards.forEach((c, index) => {
        const tr = document.createElement('tr');

        const createEditableCell = (field, value) => {
            const td = document.createElement('td');
            td.contentEditable = true;
            // Join arrays with ; for CSV compatibility
            td.textContent = Array.isArray(value) ? value.join('; ') : value;
            td.className = 'editable';
            td.addEventListener('blur', () => {
                const newValue = td.textContent.trim();
                td.classList.add('save-flash');
                setTimeout(() => td.classList.remove('save-flash'), 1000);
                let finalValue = newValue;
                if (Array.isArray(cards[index][field])) {
                    finalValue = newValue.split(';').map(s => s.trim()).filter(Boolean);
                }
                updateCard(index, field, finalValue);
            });
            td.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); td.blur(); }
            });
            return td;
        };

        const tdName = createEditableCell('name', c.name);
        const tdPhones = createEditableCell('phones', c.phones);
        const tdEmail = createEditableCell('email', c.email);
        const tdOther = createEditableCell('other', c.other);

        const tdAction = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        delBtn.title = 'Delete Card';
        delBtn.onclick = () => deleteCard(index);
        tdAction.appendChild(delBtn);

        tr.append(tdName, tdPhones, tdEmail, tdOther, tdAction);
        tableBody.appendChild(tr);
    });
}

async function processImage(blob) {
    const { data: { text } } = await Tesseract.recognize(blob, 'eng', { logger: m => console.log(m) });
    console.log("Raw OCR Text:", text);

    let card = await parseWithAI(text);

    if (!card) {
        console.log("Falling back to Regex parsing...");
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const emails = extractEmails(text);
        const phones = extractPhones(text);
        const name = extractName(lines, emails, phones);
        const other = extractOther(lines, name, emails, phones);
        card = { name: name || 'N/A', phones: phones, email: emails[0] || 'N/A', other: other };
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

exportCsvBtn.addEventListener('click', () => {
    if (cards.length === 0) {
        alert("No cards to export!");
        return;
    }
    // CSV Header
    let csvContent = "Name,Phone(s),Email,Other\n";
    
    cards.forEach(c => {
        // Helper to escape CSV fields (handle quotes and commas)
        const escape = (val) => {
            if (Array.isArray(val)) val = val.join('; '); // Use semicolon separator
            const str = String(val || '').replace(/"/g, '""');
            return `"${str}"`;
        };
        
        const row = [
            escape(c.name),
            escape(c.phones),
            escape(c.email),
            escape(c.other)
        ].join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cards.csv';
    a.click();
    URL.revokeObjectURL(url);
});

// Load persisted cards on start
function loadPersisted() {
    const stored = localStorage.getItem('cards');
    if (stored) {
        try { cards = JSON.parse(stored); renderTable(); } 
        catch (e) { console.error('Failed to parse stored cards', e); }
    }
}

initCamera();
loadPersisted();
