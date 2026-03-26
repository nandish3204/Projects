window.onerror = function (msg, url, line, col, err) {
    alert("JS Error: " + msg + " at line " + line);
};

document.addEventListener('DOMContentLoaded', () => {

    // --- BACKEND (Express API) ---
    async function initDB() {
        try {
            const res = await fetch('/api/workflows');
            return await res.json();
        } catch (e) {
            console.warn("API restricted, using empty memory", e);
            return [];
        }
    }

    async function saveDB(data) {
        try {
            await fetch('/api/workflows', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) { }
    }

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let workflows = [];
    let currentWorkflowId = null;

    // --- DOM ELEMENTS ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    const mainApp = document.getElementById('main-app');
    const displayName = document.getElementById('display-name');
    const displayRole = document.getElementById('display-role');
    const logoutBtn = document.getElementById('logout-btn');

    const dashboardView = document.getElementById('dashboard-view');
    const timelineView = document.getElementById('timeline-view');
    const backToDashBtn = document.getElementById('back-to-dash-btn');

    const multiFileInput = document.getElementById('multi-file-input');
    const multiUploadText = document.getElementById('multi-upload-text');

    const actionDocsGrid = document.getElementById('action-docs-grid');
    const allDocsGrid = document.getElementById('all-docs-grid');
    const actionCount = document.getElementById('action-count');
    const allCount = document.getElementById('all-count');

    // --- INIT ---
    let sessionUser = null;
    try {
        const stored = sessionStorage.getItem('current_user');
        if (stored) sessionUser = JSON.parse(stored);
    } catch (e) { }

    if (sessionUser) {
        currentUser = sessionUser;
        handleLoginSuccess();
    }

    // --- AUTHENTICATION ---
    let isRegisterMode = false;
    const toggleAuth = document.getElementById('toggle-auth-mode');
    const levelGroup = document.getElementById('level-group');
    const authBtnText = document.querySelector('#auth-submit-btn span');

    if (toggleAuth) {
        toggleAuth.addEventListener('click', (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;
            if (isRegisterMode) {
                levelGroup.classList.remove('hidden');
                toggleAuth.textContent = 'Already have an account? Login';
                authBtnText.textContent = 'Register New User';
            } else {
                levelGroup.classList.add('hidden');
                toggleAuth.textContent = 'Need an account? Register new user';
                authBtnText.textContent = 'Authenticate';
            }
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userVal = document.getElementById('username').value.trim();
        const passVal = document.getElementById('password').value.trim();

        try {
            let endpoint = isRegisterMode ? '/api/register' : '/api/login';
            let bodyData = { username: userVal, password: passVal };
            if (isRegisterMode) bodyData.level = document.getElementById('reg-level').value;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();

            if (res.ok) {
                currentUser = data;
                try { sessionStorage.setItem('current_user', JSON.stringify(data)); } catch (e) { }
                loginError.classList.add('hidden');
                document.getElementById('password').value = '';
                handleLoginSuccess();
                showNotification(isRegisterMode ? `Registered successfully, ${data.role}` : `Welcome back, ${data.role}`, 'success');
            } else {
                loginError.textContent = data.error || 'Invalid credentials. Access denied.';
                loginError.classList.remove('hidden');
                loginForm.closest('.auth-card').animate([
                    { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }
                ], { duration: 400 });
            }
        } catch (e) {
            console.error('Auth Error', e);
        }
    });

    logoutBtn.addEventListener('click', () => {
        currentUser = null;
        try { sessionStorage.removeItem('current_user'); } catch (e) { }
        loginOverlay.classList.add('active');
        mainApp.classList.add('hidden');
        showNotification('Logged out successfully');
    });

    function handleLoginSuccess() {
        loginOverlay.classList.remove('active');
        mainApp.classList.remove('hidden');
        timelineView.classList.add('hidden');
        dashboardView.classList.remove('hidden');

        displayName.textContent = currentUser.username;
        displayRole.textContent = currentUser.role;

        renderDashboard();
    }

    // --- DASHBOARD RENDER ---
    async function renderDashboard() {
        workflows = await initDB(); // fetch from API

        actionDocsGrid.innerHTML = '';
        allDocsGrid.innerHTML = '';

        let actionableCount = 0;
        let nonActionCount = 0;

        // Sort: newest first
        const sorted = [...workflows].sort((a, b) => b.timestamp - a.timestamp);

        sorted.forEach(wf => {
            // Can current user action this?
            const isActionable = (wf.status === 'pending' || wf.status === 'rejected') && wf.currentLevel === currentUser.level;

            const card = document.createElement('div');
            card.className = "doc-card " + (isActionable ? 'actionable' : '');
            card.onclick = () => openWorkflow(wf.id);

            let statusHTML = '';
            if (wf.status === 'completed') statusHTML = '<span class="doc-status status-label-completed">Completed</span>';
            else if (wf.status === 'rejected') statusHTML = '<span class="doc-status status-label-rejected">Lvl ' + wf.currentLevel + ' Rejected</span>';
            else statusHTML = '<span class="doc-status status-label-pending">Lvl ' + wf.currentLevel + ' Pending</span>';

            card.innerHTML =
                '<div style="display: flex; justify-content: space-between; align-items:flex-start;">' +
                '<i class="fa-solid fa-file-pdf doc-icon"></i>' +
                statusHTML +
                '</div>' +
                '<div class="doc-info">' +
                '<h4>' + wf.filename + '</h4>' +
                '</div>' +
                '<div class="doc-meta">' +
                '<span>By: ' + wf.uploader + '</span>' +
                '<span>' + new Date(wf.timestamp).toLocaleDateString() + '</span>' +
                '</div>';

            if (isActionable) {
                actionDocsGrid.appendChild(card);
                actionableCount++;
            } else {
                allDocsGrid.appendChild(card);
                nonActionCount++;
            }
        });

        if (actionableCount === 0) {
            actionDocsGrid.innerHTML = '<p class="text-muted">No documents currently require your action.</p>';
        }
        if (nonActionCount === 0) {
            allDocsGrid.innerHTML = '<p class="text-muted">No other documents in pipeline.</p>';
        }

        actionCount.textContent = actionableCount;
        allCount.textContent = nonActionCount;
    }

    // --- MULTI-FILE UPLOAD ---
    multiFileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        let processed = 0;
        workflows = await initDB();

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const newWf = {
                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                    filename: file.name,
                    dataSize: file.size,
                    dataUrl: event.target.result, // base64
                    currentLevel: 2, // Auto-forward to Level 2 since Level 1 only uploads
                    status: 'pending',
                    uploader: currentUser.username,
                    timestamp: Date.now()
                };
                workflows.push(newWf);
                processed++;

                if (processed === files.length) {
                    await saveDB(workflows);
                    showNotification("Successfully initiated " + files.length + " document flows", 'success');
                    multiFileInput.value = ''; // clear
                    multiUploadText.textContent = 'Browse or Drag & Drop Documents';
                    renderDashboard();
                }
            };
            reader.readAsDataURL(file);
        });
    });

    // --- TIMELINE VIEW ---
    backToDashBtn.addEventListener('click', () => {
        timelineView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        renderDashboard();
    });

    function openWorkflow(id) {
        currentWorkflowId = id;
        dashboardView.classList.add('hidden');
        timelineView.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderTimeline();
    }

    async function renderTimeline() {
        workflows = await initDB();
        const wf = workflows.find(w => w.id === currentWorkflowId);
        if (!wf) return;

        // Header info
        document.getElementById('active-doc-name').textContent = wf.filename;
        document.getElementById('active-doc-id').textContent = wf.id.substring(wf.id.length - 6).toUpperCase();
        document.getElementById('active-doc-uploader').textContent = wf.uploader;

        const dlBtn = document.getElementById('active-doc-download');
        dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = wf.dataUrl;
            a.download = wf.filename;
            a.click();
            showNotification('Download started', 'success');
        };

        const globalDeleteBtn = document.getElementById('global-delete-btn');
        if (globalDeleteBtn) {
            // Only Level 1 can delete, and only before Level 2 approves it (meaning it hasn't reached Level 3 yet)
            if (currentUser && currentUser.level === 1 && wf.currentLevel <= 2 && wf.status !== 'completed') {
                globalDeleteBtn.classList.remove('hidden');
            } else {
                globalDeleteBtn.classList.add('hidden');
            }
        }

        const totalSteps = 5;
        const curLevel = wf.currentLevel;

        // Reset Cards
        for (let i = 1; i <= totalSteps; i++) {
            const card = document.querySelector('.workflow-card[data-level="' + i + '"]');
            if (!card) continue;

            card.classList.remove('active', 'completed', 'rejected', 'pending');
            const badge = card.querySelector('.status-badge');
            const actionArea = card.querySelector('.action-area');
            const restrictedArea = card.querySelector('.restricted-area');

            actionArea.classList.add('hidden');
            restrictedArea.classList.add('hidden');

            // Logic matching the old system but tied to the single WF
            if (i < curLevel || (i === curLevel && wf.status === 'completed')) {
                card.classList.add('completed');
                badge.className = 'status-badge status-label-completed';
                badge.innerHTML = 'Approved <i class="fa-solid fa-check ml-1"></i>';

            } else if (i === curLevel && wf.status === 'pending') {
                card.classList.add('active');
                badge.className = 'status-badge status-label-pending pulse-icon';
                badge.innerHTML = 'Action Required';

                if (currentUser && currentUser.level === i) {
                    actionArea.classList.remove('hidden');
                } else {
                    restrictedArea.classList.remove('hidden');
                }

            } else if (i === curLevel && wf.status === 'rejected') {
                card.classList.add('rejected');
                badge.className = 'status-badge status-label-rejected';
                badge.innerHTML = 'Rejected <i class="fa-solid fa-xmark ml-1"></i>';

                if (currentUser && currentUser.level === i) {
                    actionArea.classList.remove('hidden');
                } else {
                    restrictedArea.classList.remove('hidden');
                }
            } else {
                card.classList.add('pending');
                badge.className = 'status-badge status-label-pending';
                badge.innerHTML = 'Awaiting';
            }
        }

        // Completion Display
        const completionEl = document.getElementById('completion-state');
        if (curLevel === totalSteps && wf.status === 'completed') {
            completionEl.classList.remove('hidden');
            updateProgress(totalSteps);
            setTimeout(fireConfetti, 500);
        } else {
            completionEl.classList.add('hidden');
            updateProgress(Math.max(0, curLevel - 1));
        }

        // Add scroll reveal reset for immediate visibility
        document.querySelectorAll('.workflow-card').forEach(c => c.style.opacity = '1');
        document.querySelectorAll('.workflow-card').forEach(c => c.style.transform = 'translateY(0)');
    }

    // --- ACTIONS ---
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            const target = parseInt(this.getAttribute('data-target'));
            let wf = workflows.find(w => w.id === currentWorkflowId);

            if (target < 5) {
                wf.currentLevel = target + 1;
                wf.status = 'pending';
                showNotification("Approved step " + target + ". Assigned to Level " + (target + 1) + ".", 'success');
            } else {
                wf.status = 'completed';
                showNotification("Final Approval complete!", 'success');
            }

            await saveDB(workflows);
            renderTimeline();
        });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            const target = parseInt(this.getAttribute('data-target'));
            let wf = workflows.find(w => w.id === currentWorkflowId);

            const prevLevel = Math.max(1, target - 1); // min level 1
            wf.currentLevel = prevLevel;
            wf.status = 'rejected';

            await saveDB(workflows);
            showNotification("Request rejected. Returned to Level " + prevLevel + ".", 'error');
            renderTimeline();
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            if (!confirm("Are you sure you want to completely discard this workflow? This cannot be undone.")) return;

            workflows = workflows.filter(w => w.id !== currentWorkflowId);
            await saveDB(workflows);

            showNotification("Workflow document permanently deleted.", 'success');
            backToDashBtn.click(); // Navigates back successfully
        });
    });

    // --- UTILS ---
    function updateProgress(completedSteps) {
        const totalSteps = 5;
        const percentage = Math.round((completedSteps / totalSteps) * 100);
        document.getElementById('overall-progress').style.width = percentage + "%";
        document.getElementById('progress-percentage').innerText = percentage;

        let timelinePercentage = (completedSteps > 0) ? (completedSteps / (totalSteps - 0.5)) * 100 : 0;
        if (timelinePercentage > 100) timelinePercentage = 100;
        document.getElementById('timeline-fill').style.height = timelinePercentage + "%";
    }

    function showNotification(msg, type = 'info') {
        const container = document.getElementById('notification-container');
        const notif = document.createElement('div');
        notif.className = "notification";

        let icon = '<i class="fa-solid fa-circle-info" style="color:#3b82f6"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color:#10b981"></i>';
        if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444"></i>';

        notif.innerHTML = icon + " <span>" + msg + "</span>";
        container.appendChild(notif);

        setTimeout(() => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    function fireConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const pieces = [];
        const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

        for (let i = 0; i < 150; i++) {
            pieces.push({
                x: canvas.width / 2, y: canvas.height / 2 + 100,
                w: Math.random() * 10 + 5, h: Math.random() * 10 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 1) * 20 - 5,
                rot: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 10
            });
        }

        let animationId;
        function update() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let activePieces = 0;

            pieces.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.vy += 0.5; p.rot += p.rotSpeed;
                if (p.y < canvas.height) {
                    activePieces++;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot * Math.PI / 180);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                    ctx.restore();
                }
            });

            if (activePieces > 0) animationId = requestAnimationFrame(update);
            else { cancelAnimationFrame(animationId); ctx.clearRect(0, 0, canvas.width, canvas.height); }
        }
        update();
    }
});
