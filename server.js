require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // to handle base64 files
app.use(express.static(__dirname)); // Serve HTML/CSS/JS

// --- MONGODB CONNECTION ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/workflowDB';
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB Atlas!');
    })
    .catch(err => {
        console.error('MongoDB connection error. Make sure your MONGO_URI is set!', err.message);
    });

// --- SCHEMAS & MODELS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    level: { type: Number, required: true },
    role: { type: String, required: true }
});

const workflowSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // custom ID used by frontend
    filename: String,
    dataSize: Number,
    dataUrl: String,
    currentLevel: Number,
    status: String,
    uploader: String,
    timestamp: Number
});

const User = mongoose.model('User', userSchema);
const Workflow = mongoose.model('Workflow', workflowSchema);



// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    try {
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

        const existing = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
        if (existing) return res.status(400).json({ error: 'Username already taken' });

        const newUser = new User({
            username,
            password,
            level: numLevel,
            role: roles[numLevel] || 'User'
        });

        await newUser.save();
        res.json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i'), password });
        if (user) {
            res.json(user);
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- WORKFLOW ROUTES ---
app.get('/api/workflows', async (req, res) => {
    try {
        const workflows = await Workflow.find().sort({ timestamp: -1 });
        res.json(workflows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/workflows', async (req, res) => {
    try {
        const newWorkflow = new Workflow(req.body);
        await newWorkflow.save();
        res.json(newWorkflow);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/workflows/:id', async (req, res) => {
    try {
        const updated = await Workflow.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true }
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/workflows/:id', async (req, res) => {
    try {
        await Workflow.findOneAndDelete({ id: req.params.id });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
