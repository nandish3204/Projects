const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // to handle base64 files
app.use(express.static(__dirname)); // Serve HTML/CSS/JS

// Initialize DB if doesn't exist
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        users: [
            { username: 'user1', password: 'pass1', level: 1, role: 'Data Entry Specialist' },
            { username: 'user2', password: 'pass2', level: 2, role: 'QA Analyst' },
            { username: 'user3', password: 'pass3', level: 3, role: 'Ops Manager' },
            { username: 'user4', password: 'pass4', level: 4, role: 'Regional Director' },
            { username: 'user5', password: 'pass5', level: 5, role: 'System Admin' }
        ],
        workflows: []
    }, null, 2));
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- AUTH ROUTES ---
app.post('/api/register', (req, res) => {
    const { username, password, level } = req.body;
    if (!username || !password || !level) return res.status(400).json({ error: 'Missing fields' });

    const numLevel = parseInt(level);
    const roles = {
        1: 'Data Entry Specialist',
        2: 'QA Analyst',
        3: 'Ops Manager',
        4: 'Regional Director',
        5: 'System Admin'
    };

    const db = readDB();
    const existing = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) return res.status(400).json({ error: 'Username already taken' });

    const newUser = {
        username,
        password, // In production, hash this with bcrypt!
        level: numLevel,
        role: roles[numLevel] || 'User'
    };

    db.users.push(newUser);
    writeDB(db);
    res.json(newUser);
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) {
        res.json(user);
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// --- WORKFLOW ROUTES ---
app.get('/api/workflows', (req, res) => {
    const db = readDB();
    res.json(db.workflows);
});

app.post('/api/workflows', (req, res) => {
    const items = req.body; // Expecting array of workflow objects
    const db = readDB();
    db.workflows = db.workflows.concat(items);
    writeDB(db);
    res.json({ message: 'Saved successfully' });
});

app.put('/api/workflows', (req, res) => {
    // For updating a specific workflow (status, currentLevel)
    const updatedWorkflows = req.body;
    const db = readDB();
    db.workflows = updatedWorkflows; // overwriting for simplicity based on frontend logic
    writeDB(db);
    res.json({ message: 'Updated successfully' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
