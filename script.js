// ==========================================
// State Management
// ==========================================
let transactions = [];
let sustainabilityScore = 0;

// Chart Instances
let barChartInstance = null;
let pieChartInstance = null;

// ==========================================
// DOM Elements
// ==========================================
const transactionForm = document.getElementById('transaction-form');
const typeSelect = document.getElementById('type');
const categoryGroup = document.getElementById('category-group');

// Summary elements
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const balanceEl = document.getElementById('balance');
const scoreEl = document.getElementById('sustainability-score');
const scoreBadgeEl = document.getElementById('score-badge');
const scoreProgressEl = document.getElementById('score-progress');

// Lists and Containers
const transactionsListEl = document.getElementById('transactions-list');
const insightsContainerEl = document.getElementById('insights-container');
const suggestionsContainerEl = document.getElementById('suggestions-container');

// ==========================================
// Authentication & Route Protection
// ==========================================
function updateNavigationState() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    const navLogin = document.getElementById('nav-login');
    const navRegister = document.getElementById('nav-register');
    const navDashboard = document.getElementById('nav-dashboard');
    const navLogout = document.getElementById('nav-logout');

    if (loggedInUser) {
        if(navLogin) navLogin.style.display = 'none';
        if(navRegister) navRegister.style.display = 'none';
        if(navDashboard) navDashboard.style.display = 'inline-block';
        if(navLogout) navLogout.style.display = 'inline-flex';
    } else {
        if(navLogin) navLogin.style.display = 'inline-block';
        if(navRegister) navRegister.style.display = 'inline-flex';
        if(navDashboard) navDashboard.style.display = 'none';
        if(navLogout) navLogout.style.display = 'none';
    }
}

function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
}

function checkRouteProtection() {
    const isDashboard = window.location.pathname.includes('dashboard.html');
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (isDashboard && !loggedInUser) {
        window.location.href = 'login.html';
    }
}

// ==========================================
// Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Auth Initialization
    checkRouteProtection();
    updateNavigationState();

    const navLogout = document.getElementById('nav-logout');
    if(navLogout) {
        navLogout.addEventListener('click', handleLogout);
    }

    // Register Form Handling
    const registerForm = document.getElementById('register-form');
    if(registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;
            const conf = document.getElementById('reg-confirm-password').value;
            const errorEl = document.getElementById('register-error');

            if (pass !== conf) {
                errorEl.textContent = "Passwords do not match.";
                errorEl.style.display = 'block';
                return;
            }

            let users = JSON.parse(localStorage.getItem('users')) || [];
            if (users.find(u => u.email === email)) {
                errorEl.textContent = "Email already registered.";
                errorEl.style.display = 'block';
                return;
            }

            users.push({ name, email, password: pass });
            localStorage.setItem('users', JSON.stringify(users));
            window.location.href = 'login.html';
        });
    }

    // Login Form Handling
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            let users = JSON.parse(localStorage.getItem('users')) || [];
            const user = users.find(u => u.email === email && u.password === pass);

            if (user) {
                localStorage.setItem('loggedInUser', JSON.stringify({ name: user.name, email: user.email }));
                window.location.href = 'dashboard.html';
            } else {
                errorEl.textContent = "Invalid email or password.";
                errorEl.style.display = 'block';
            }
        });
    }

    // Hide category if income is selected
    if(typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'income') {
                categoryGroup.style.display = 'none';
            } else {
                categoryGroup.style.display = 'block';
            }
        });
    }

    if(transactionForm) {
        // Set default date to today
        document.getElementById('date').valueAsDate = new Date();
        transactionForm.addEventListener('submit', handleAddTransaction);
    }

    initCharts();
});

// ==========================================
// Core Logic
// ==========================================

// Helper function to auto-detect category and sustainability score based on priority rules
function detectCategoryAndScore(description, selectedCategory) {
    const rules = [
        // 1. Eco keywords
        { category: 'Eco Product', score: 8, keywords: ['eco', 'reusable', 'bamboo', 'organic'] },
        // 2. Positive overrides
        { category: 'Shopping', score: 10, keywords: ['thrift'] },
        { category: 'Food', score: 10, keywords: ['home', 'homemade'] },
        // 3. Transport (positive & negative)
        { category: 'Transport', score: 10, keywords: ['bus', 'train', 'metro'] },
        { category: 'Transport', score: -8, keywords: ['fuel', 'petrol', 'diesel'] },
        // 4. Food (negative)
        { category: 'Food', score: -5, keywords: ['pizza', 'burger', 'chicken'] },
        // 5. Shopping (negative)
        { category: 'Shopping', score: -5, keywords: ['shopping', 'clothes', 'shoes', 'toys'] },
        // 6. Bills
        { category: 'Bills', score: -2, keywords: ['electricity', 'water', 'bill', 'rent'] }
    ];

    // Normalize input: lowercase and remove punctuation
    const normalizedDesc = description.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // Split into individual words
    const words = normalizedDesc.split(/\s+/);

    // Loop through priority rules
    for (const rule of rules) {
        for (const word of words) {
            if (rule.keywords.includes(word)) {
                return { category: rule.category, scoreChange: rule.score };
            }
        }
    }

    // Safe fallback: no match found
    return { category: selectedCategory, scoreChange: 0 };
}

function handleAddTransaction(e) {
    e.preventDefault();

    const type = document.getElementById('type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const date = document.getElementById('date').value;
    let description = document.getElementById('description').value.trim();
    let category = document.getElementById('category').value;

    let scoreChange = 0;
    
    // Apply logic only for expenses
    if (type === 'expense') {
        const result = detectCategoryAndScore(description, category);
        category = result.category;
        scoreChange = result.scoreChange;
    } else {
        category = 'Income';
    }

    const transaction = {
        id: Date.now(),
        type,
        amount,
        category,
        date,
        description,
        scoreChange
    };

    transactions.push(transaction);
    if(type === 'expense') {
        sustainabilityScore += scoreChange;
    }

    // Reset Form
    transactionForm.reset();
    document.getElementById('date').valueAsDate = new Date();
    
    // Update UI
    updateUI();
}

function updateUI() {
    updateSummaryCards();
    updateTransactionsList();
    updateSustainabilityVisuals();
    updateCharts();
    updateInsightsAndSuggestions();
}

// ==========================================
// UI Updaters
// ==========================================

function updateSummaryCards() {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });

    const balance = income - expense;

    totalIncomeEl.textContent = `$${income.toFixed(2)}`;
    totalExpenseEl.textContent = `$${expense.toFixed(2)}`;
    balanceEl.textContent = `$${balance.toFixed(2)}`;
    
    // Color coding balance
    if(balance < 0) balanceEl.style.color = 'var(--color-red)';
    else if(balance > 0) balanceEl.style.color = 'var(--color-green)';
    else balanceEl.style.color = 'var(--text-primary)';
}

function updateSustainabilityVisuals() {
    scoreEl.textContent = sustainabilityScore;

    // Badge Logic
    // Score < 0 → Red
    // Score 0–40 → Yellow
    // Score > 40 → Green
    // Score > 80 → Gold
    
    scoreBadgeEl.className = 'badge'; // Reset classes
    let progressPercentage = 50; // Default center for 0 score

    if (sustainabilityScore < 0) {
        scoreBadgeEl.classList.add('badge-red');
        scoreBadgeEl.textContent = 'Needs Work';
        progressPercentage = Math.max(0, 50 + sustainabilityScore); // Scale down from 50
        scoreProgressEl.style.backgroundColor = 'var(--color-red)';
    } else if (sustainabilityScore >= 0 && sustainabilityScore <= 40) {
        scoreBadgeEl.classList.add('badge-yellow');
        scoreBadgeEl.textContent = 'Moderate';
        progressPercentage = 50 + (sustainabilityScore / 2); // Scale from 50 to 70
        scoreProgressEl.style.backgroundColor = 'var(--color-yellow)';
    } else if (sustainabilityScore > 40 && sustainabilityScore <= 80) {
        scoreBadgeEl.classList.add('badge-green');
        scoreBadgeEl.textContent = 'Eco Warrior';
        progressPercentage = 70 + ((sustainabilityScore - 40) / 2); // Scale from 70 to 90
        scoreProgressEl.style.backgroundColor = 'var(--color-green)';
    } else {
        scoreBadgeEl.classList.add('badge-gold');
        scoreBadgeEl.textContent = 'Eco Legend';
        progressPercentage = Math.min(100, 90 + ((sustainabilityScore - 80) / 2)); // Scale up to 100
        scoreProgressEl.style.backgroundColor = 'var(--color-gold)';
    }

    scoreProgressEl.style.width = `${progressPercentage}%`;
}

function updateTransactionsList() {
    if (transactions.length === 0) {
        transactionsListEl.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem 0;">No transactions added yet.</p>';
        return;
    }

    // Sort by date newest first
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    transactionsListEl.innerHTML = sorted.map(t => {
        const isExpense = t.type === 'expense';
        const sign = isExpense ? '-' : '+';
        const amountColor = isExpense ? 'var(--color-red)' : 'var(--color-green)';
        const scoreBadge = isExpense && t.scoreChange !== 0 
            ? `<span style="font-size: 0.75rem; color: ${t.scoreChange > 0 ? 'var(--color-green)' : 'var(--color-red)'}">(${t.scoreChange > 0 ? '+' : ''}${t.scoreChange} pts)</span>`
            : '';

        return `
            <div class="expense-item">
                <div class="expense-info">
                    <h4>${t.description} ${scoreBadge}</h4>
                    <p>${t.category} | ${t.date}</p>
                </div>
                <div class="expense-amount" style="color: ${amountColor}">
                    ${sign}$${t.amount.toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
}

function updateInsightsAndSuggestions() {
    // Only analyze expenses
    const expenses = transactions.filter(t => t.type === 'expense');
    
    if (expenses.length === 0) return;

    // Calculate category totals
    const categoryTotals = {};
    expenses.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    // Find highest category
    let highestCategory = '';
    let highestAmount = 0;
    for (const [cat, amt] of Object.entries(categoryTotals)) {
        if (amt > highestAmount) {
            highestAmount = amt;
            highestCategory = cat;
        }
    }

    // Generate Insight
    let insightHtml = '';
    if (highestCategory) {
        insightHtml += `
            <div class="insight-message">
                <span>💡</span>
                <p style="margin:0;">You spent the most on <strong>${highestCategory}</strong> recently.</p>
            </div>
        `;
    }
    
    if (sustainabilityScore > 80) {
        insightHtml += `
            <div class="insight-message" style="border-color: var(--color-gold); background-color: var(--color-gold-light);">
                <span>🏆</span>
                <p style="margin:0; color: var(--color-gold); font-weight: 600;">Incredible! You've reached the Gold sustainability tier!</p>
            </div>
        `;
    } else if (sustainabilityScore > 20) {
        insightHtml += `
            <div class="insight-message" style="border-color: var(--color-green); background-color: var(--color-green-light);">
                <span>📈</span>
                <p style="margin:0;">Your sustainability score is improving! Keep up the green habits.</p>
            </div>
        `;
    } else if (sustainabilityScore < -10) {
        insightHtml += `
            <div class="insight-message" style="border-color: var(--color-red); background-color: var(--color-red-light);">
                <span>📉</span>
                <p style="margin:0;">Your sustainability score has dropped. Consider eco-friendly choices.</p>
            </div>
        `;
    }
    
    insightsContainerEl.innerHTML = insightHtml || insightsContainerEl.innerHTML;

    // Generate Suggestions
    let suggestionHtml = '';
    if (highestCategory === 'Transport') {
        suggestionHtml += `
            <div class="suggestion-message">
                <span>🚌</span>
                <p style="margin:0;">High transport costs? Try taking the bus or train to save money and earn +10 Eco Points.</p>
            </div>
        `;
    } else if (highestCategory === 'Shopping') {
        suggestionHtml += `
            <div class="suggestion-message">
                <span>♻️</span>
                <p style="margin:0;">Shopping a lot? Look for sustainable brands or second-hand items to reduce impact.</p>
            </div>
        `;
    } else if (highestCategory === 'Food') {
         suggestionHtml += `
            <div class="suggestion-message">
                <span>🥗</span>
                <p style="margin:0;">Consider cooking at home or choosing plant-based meals to boost your score.</p>
            </div>
        `;
    } else if (highestCategory === 'Bills') {
         suggestionHtml += `
            <div class="suggestion-message">
                <span>💡</span>
                <p style="margin:0;">Bills are high this period. Try optimizing electricity and water usage to save money and the planet!</p>
            </div>
        `;
    }

    // Default suggestion if score is good
    if (!suggestionHtml && sustainabilityScore > 0) {
        suggestionHtml = `
            <div class="suggestion-message">
                <span>🌟</span>
                <p style="margin:0;">You're doing great! Try walking (+15 pts) for short trips to maximize your score.</p>
            </div>
        `;
    }

    suggestionsContainerEl.innerHTML = suggestionHtml || suggestionsContainerEl.innerHTML;
}

// ==========================================
// Chart.js Integration
// ==========================================

function initCharts() {
    const barCtx = document.getElementById('barChart');
    const pieCtx = document.getElementById('pieChart');

    if (!barCtx || !pieCtx) return;

    // Initialize Empty Bar Chart (Weekly Expenses Mockup)
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Daily Expenses ($)',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: '#66bb6a',
                borderColor: '#2e7d32',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Recent Expenses by Day' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // Initialize Empty Pie Chart (Category Breakdown)
    pieChartInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Food', 'Transport', 'Shopping', 'Eco Product', 'Bills'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    '#ffa726', // Food
                    '#42a5f5', // Transport
                    '#ef5350', // Shopping
                    '#66bb6a', // Eco
                    '#90caf9'  // Bills
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Expense Categories' },
                legend: { position: 'bottom' }
            }
        }
    });
}

function updateCharts() {
    if (!barChartInstance || !pieChartInstance) return;

    const expenses = transactions.filter(t => t.type === 'expense');

    // Update Pie Chart Data
    const categoryTotals = { 'Food': 0, 'Transport': 0, 'Shopping': 0, 'Eco Product': 0, 'Bills': 0 };
    
    expenses.forEach(t => {
        if(categoryTotals[t.category] !== undefined) {
             categoryTotals[t.category] += t.amount;
        } else {
             // Fallback if category is custom somehow
             categoryTotals['Eco Product'] += t.amount; 
        }
    });

    pieChartInstance.data.datasets[0].data = [
        categoryTotals['Food'],
        categoryTotals['Transport'],
        categoryTotals['Shopping'],
        categoryTotals['Eco Product'],
        categoryTotals['Bills']
    ];
    pieChartInstance.update();

    // Update Bar Chart Data (Map dates to day of week)
    // Note: This groups all dates into the 7 days of the week for simplicity
    const dailyTotals = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun index (0-6)
    
    expenses.forEach(t => {
        const dateObj = new Date(t.date);
        let day = dateObj.getDay(); // 0 is Sunday, 1 is Monday
        // Convert to Mon=0, Sun=6
        day = day === 0 ? 6 : day - 1;
        dailyTotals[day] += t.amount;
    });

    barChartInstance.data.datasets[0].data = dailyTotals;
    barChartInstance.update();
}
