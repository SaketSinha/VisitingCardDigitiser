// server.js - Simple Express server to serve the Visiting Card Digitiser app
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the project root (index.html, style.css, script.js, etc.)
app.use(express.static(__dirname));

// Fallback to index.html for any unknown routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Visiting Card Digitiser server running at http://localhost:${PORT}`);
});
