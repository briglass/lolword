const MAX_ROUNDS = 6;
const WORD_LENGTH = 5;
const GRID_ROWS = 6;
let VALID_GUESSES = [];
let WORDS = [];
const QUIET_COLORS = {
    correct: 'bg-correct text-white border-correct shadow-[0_0_0_2px_rgba(192,38,211,0.18)]',
    present: 'bg-present text-white border-present shadow-[0_0_0_2px_rgba(234,179,8,0.18)]',
    absent: 'bg-absent text-white border-absent shadow-[0_0_0_2px_rgba(55,65,81,0.18)]'
};

const gridElement = document.getElementById('grid');
const keyboardElement = document.getElementById('keyboard');
const timerDisplay = document.getElementById('timer-display');
const shareButton = document.getElementById('btn-share');
const toastContainer = document.getElementById('toast-container');
const helpModal = document.getElementById('modal-help');
const statsModal = document.getElementById('modal-stats');
const statsTitle = document.getElementById('stats-title');
const guessDistribution = document.getElementById('guess-distribution');
const statPlayed = document.getElementById('stat-played');
const statWinPct = document.getElementById('stat-winpct');
const statStreak = document.getElementById('stat-streak');
const statMaxStreak = document.getElementById('stat-maxstreak');
const secretWordDisplay = document.getElementById('secret-word-display');
const revealWordContainer = document.getElementById('reveal-word-container');
const solveTimeContainer = document.getElementById('solve-time-container');
const solveTimeDisplay = document.getElementById('solve-time-display');
const shareInfoText = document.getElementById('share-info-text');
const resetStatsButton = document.getElementById('btn-reset-stats');
const playAgainButton = document.getElementById('btn-play-again');
const insultText = document.getElementById('insult-text');

let currentRow = 0;
let currentCol = 0;
let currentGuess = '';
let timerInterval = null;
let timerStarted = false;
let startTime = null;
let isGameOver = false;
let solution = '';
let stats = null;
let guessResults = [];

const keyboardLayout = [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['ENTER','Z','X','C','V','B','N','M','BACK']
];

const localStorageKey = 'insultle_stats_v1';
const dailyIndex = Math.floor((Date.now() - new Date(2026, 0, 1).getTime()) / 86400000);
solution = (typeof ANSWERS !== 'undefined' && Array.isArray(ANSWERS)) ? ANSWERS[dailyIndex % ANSWERS.length] : '';

const INSULTS = [
    "That guess was adorable. In a tragic way.",
    "I've seen better words from a drunk parrot.",
    "Your keyboard misses you. It wants its dignity back.",
    "Keep going — you're doing... something.",
    "If confusion were talent, you'd have won already.",
    "Is that your final answer, or are you still dreaming?",
    "Cute. Try again when your brain wakes up."
];

async function loadAllowedWords() {
    if (typeof ALLOWED_WORDS !== 'undefined' && Array.isArray(ALLOWED_WORDS)) {
        VALID_GUESSES = [...new Set([...ANSWERS, ...ALLOWED_WORDS.filter((w) => w.length === WORD_LENGTH)])];
        WORDS = [...new Set(VALID_GUESSES)];
        return;
    }
    VALID_GUESSES = [...(ANSWERS || [])];
    WORDS = [...(ANSWERS || [])];
}

function createBoard() {
    gridElement.innerHTML = '';
    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < WORD_LENGTH; col += 1) {
            const tile = document.createElement('div');
            tile.id = `tile-${row}-${col}`;
            tile.className = 'w-full aspect-square border border-slate-800 rounded-xl flex items-center justify-center text-3xl font-extrabold tracking-[0.35em] uppercase select-none bg-slate-900 text-slate-50';
            gridElement.appendChild(tile);
        }
    }
}

function createKeyboard() {
    keyboardElement.innerHTML = '';
    keyboardLayout.forEach((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'flex justify-center gap-2';
        row.forEach((key) => {
            const keyButton = document.createElement('button');
            keyButton.textContent = key;
            keyButton.dataset.key = key;
            keyButton.className = 'min-w-[42px] h-14 rounded-xl bg-slate-800 text-slate-100 font-semibold shadow-md shadow-black/20 hover:bg-slate-700 transition-colors focus:outline-none active:scale-[0.98]';
            if (key === 'ENTER' || key === 'BACK') keyButton.classList.add('min-w-[68px]');
            keyButton.addEventListener('click', () => handleKey(key));
            rowEl.appendChild(keyButton);
        });
        keyboardElement.appendChild(rowEl);
    });
}

function startTimer() {
    if (timerStarted || isGameOver) return;
    timerStarted = true;
    startTime = Date.now();
    updateTimerDisplay();
    timerInterval = window.setInterval(updateTimerDisplay, 100);
}

function updateTimerDisplay() {
    if (!timerStarted || startTime === null) return;
    const elapsed = Date.now() - startTime;
    if (timerDisplay) timerDisplay.textContent = formatTime(elapsed);
}

function stopTimer() {
    if (timerInterval !== null) {
        window.clearInterval(timerInterval);
        timerInterval = null;
    }
    timerStarted = false;
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((milliseconds % 1000) / 100);
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${tenths}`;
}

function handleKey(key) {
    if (isGameOver) return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'BACK') { removeLetter(); return; }
    if (key.length !== 1) return;
    addLetter(key);
}

function addLetter(letter) {
    if (currentCol >= WORD_LENGTH) return;
    if (!timerStarted) startTimer();
    currentGuess += letter;
    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    if (tile) {
        tile.textContent = letter;
        tile.classList.add('animate-pop');
        window.setTimeout(() => tile.classList.remove('animate-pop'), 120);
    }
    currentCol += 1;
}

function removeLetter() {
    if (isGameOver) return;
    if (currentCol === 0) return;
    currentCol -= 1;
    currentGuess = currentGuess.slice(0, -1);
    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    if (tile) tile.textContent = '';
}

function submitGuess() {
    if (currentGuess.length !== WORD_LENGTH) {
        animateRowShake(currentRow);
        showToast('Not enough letters');
        return;
    }
    if (!WORDS.includes(currentGuess)) {
        animateRowShake(currentRow);
        showToast('Not in word list');
        return;
    }
    const evaluation = evaluateGuess(currentGuess);
    revealGuessTiles(evaluation);
    guessResults[currentRow] = evaluation.map(cell => cell.status);
    updateKeyboard(evaluation);

    const revealDelay = 500 + (WORD_LENGTH - 1) * 150;
    // show a random insult shortly after the reveal animation
    setTimeout(() => {
        const insult = INSULTS[Math.floor(Math.random() * INSULTS.length)];
        showInsult(insult);
    }, revealDelay + 50);

    if (currentGuess === solution) { endGame(true); return; }
    if (currentRow === MAX_ROUNDS - 1) { endGame(false); return; }

    currentRow += 1;
    currentCol = 0;
    currentGuess = '';
}

function animateRowShake(rowIndex) {
    for (let col = 0; col < WORD_LENGTH; col += 1) {
        const tile = document.getElementById(`tile-${rowIndex}-${col}`);
        if (tile) {
            tile.classList.add('animate-shake');
            tile.addEventListener('animationend', () => tile.classList.remove('animate-shake'), { once: true });
        }
    }
}

function evaluateGuess(guess) {
    const solutionLetters = solution.split('');
    const guessLetters = guess.split('');
    const result = guessLetters.map((letter) => ({ letter, status: 'absent' }));

    guessLetters.forEach((letter, index) => {
        if (solutionLetters[index] === letter) {
            result[index].status = 'correct';
            solutionLetters[index] = null;
        }
    });
    guessLetters.forEach((letter, index) => {
        if (result[index].status === 'correct') return;
        const presentIndex = solutionLetters.indexOf(letter);
        if (presentIndex !== -1) {
            result[index].status = 'present';
            solutionLetters[presentIndex] = null;
        }
    });
    return result;
}

function revealGuessTiles(result) {
    result.forEach((cell, index) => {
        const tile = document.getElementById(`tile-${currentRow}-${index}`);
        if (!tile) return;
        const classes = QUIET_COLORS[cell.status].split(' ');
        window.setTimeout(() => {
            tile.classList.add('flip');
            tile.classList.add(...classes);
            tile.classList.add('text-white');
        }, index * 150);
        window.setTimeout(() => tile.classList.remove('flip'), 500 + index * 150);
    });
}

function updateKeyboard(result) {
    result.forEach((cell) => {
        const key = keyboardElement.querySelector(`button[data-key="${cell.letter}"]`);
        if (!key) return;
        const previousState = key.dataset.state;
        const nextState = cell.status;
        const priority = { absent: 1, present: 2, correct: 3 };
        if (!previousState || priority[nextState] > priority[previousState]) {
            key.dataset.state = nextState;
            const classesToRemove = Object.values(QUIET_COLORS).flatMap(c => c.split(' '));
            key.classList.remove(...classesToRemove);
            key.classList.add(...QUIET_COLORS[nextState].split(' '));
        }
    });
}

function endGame(won) {
    isGameOver = true;
    stopTimer();
    const elapsed = startTime ? Date.now() - startTime : 0;
    const solvedLabel = won ? `${currentRow + 1}/${MAX_ROUNDS}` : `X/${MAX_ROUNDS}`;
    const revealDelay = 500 + (WORD_LENGTH - 1) * 150;
    showToast(won ? 'You solved it (somehow)!' : 'Game over — you tried.');
    updateStats(won, currentRow + 1, elapsed);
    setTimeout(() => showStatsModal(won, elapsed, solvedLabel), revealDelay + 200);
}

function showStatsModal(won, elapsedMs, solvedLabel) {
    statsTitle.textContent = won ? 'Victory (begrudgingly)' : 'Game Over';
    revealWordContainer.classList.toggle('hidden', won);
    if (!won) secretWordDisplay.textContent = solution;
    solveTimeContainer && solveTimeContainer.classList.remove('hidden');
    solveTimeDisplay && (solveTimeDisplay.textContent = formatTime(elapsedMs));
    shareInfoText && (shareInfoText.textContent = `Score: ${won ? `${currentRow + 1}/${MAX_ROUNDS}` : 'X/6'} • Time: ${formatTime(elapsedMs)}`);
    renderStats();
    statsModal.classList.remove('hidden');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto px-4 py-3 rounded-2xl bg-slate-900/95 border border-slate-700 text-sm text-slate-100 shadow-xl shadow-black/40 animate-pop';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 1800);
}

function loadStats() {
    const saved = window.localStorage.getItem(localStorageKey);
    if (!saved) {
        stats = { played:0, wins:0, currentStreak:0, maxStreak:0, distribution: Array(MAX_ROUNDS).fill(0), totalSolveTime:0 };
        return;
    }
    try { stats = JSON.parse(saved); if (stats.totalSolveTime === undefined) stats.totalSolveTime = 0; } catch (e) { stats = { played:0, wins:0, currentStreak:0, maxStreak:0, distribution: Array(MAX_ROUNDS).fill(0), totalSolveTime:0 }; }
}

function saveStats() { window.localStorage.setItem(localStorageKey, JSON.stringify(stats)); }

function resetStats() { stats = { played:0, wins:0, currentStreak:0, maxStreak:0, distribution: Array(MAX_ROUNDS).fill(0), totalSolveTime:0 }; saveStats(); renderStats(); }

function updateStats(won, guessCount, elapsedMs) {
    stats.played += 1;
    if (won) {
        stats.wins += 1;
        stats.currentStreak += 1;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        stats.distribution[currentRow] += 1;
        stats.totalSolveTime += elapsedMs;
    } else {
        stats.currentStreak = 0;
    }
    saveStats();
}

function renderStats() {
    const winPercent = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    statPlayed.textContent = stats.played;
    statWinPct.textContent = `${winPercent}%`;
    statStreak.textContent = stats.currentStreak;
    statMaxStreak.textContent = stats.maxStreak;
    const avgSolveElement = document.getElementById('stat-avgtime');
    if (avgSolveElement) {
        if (stats.wins > 0 && stats.totalSolveTime > 0) avgSolveElement.textContent = formatTime(stats.totalSolveTime / stats.wins);
        else avgSolveElement.textContent = '00:00.0';
    }
    guessDistribution.innerHTML = '';
    stats.distribution.forEach((count, index) => {
        const row = document.createElement('div'); row.className = 'flex items-center gap-3';
        const label = document.createElement('div'); label.className = 'w-6 text-xs text-slate-400'; label.textContent = index + 1;
        const barContainer = document.createElement('div'); barContainer.className = 'flex-1 bg-slate-950 rounded-full h-8 overflow-hidden border border-slate-800';
        const bar = document.createElement('div'); bar.className = 'h-full bg-fuchsia-500 rounded-full text-right pr-3 flex items-center justify-end text-[11px] font-semibold text-slate-950';
        const width = stats.played ? Math.max((count / Math.max(...stats.distribution, 1)) * 100, 2) : 2;
        bar.style.width = `${width}%`; bar.textContent = count;
        barContainer.appendChild(bar); row.appendChild(label); row.appendChild(barContainer); guessDistribution.appendChild(row);
    });
}

function copyShareResult() {
    if (!stats.played) { showToast('Play a game to share your embarrassment.'); return; }
    const solved = isGameOver ? `${stats.wins === 0 ? 'X' : currentRow + 1}/${MAX_ROUNDS}` : `?/${MAX_ROUNDS}`;
    const time = timerStarted || startTime ? formatTime(Date.now() - startTime) : '00:00.0';
    const header = `💬 INSULTLE ${solved} • ${time} `;
    const squares = guessResults.map((row) => row.map((status) => {
        if (status === 'correct') return '🔥';
        if (status === 'present') return '😡';
        return '💩';
    }).join('')).join('\n');
    const shareText = `${header}\n${squares}\n\nhttps://www.lolword.com/games/insultle`;
    navigator.clipboard.writeText(shareText).then(() => showToast('Result copied to clipboard')).catch(() => showToast('Unable to copy automatically'));
}

function addKeyboardListeners() {
    document.addEventListener('keydown', (event) => {
        if (isGameOver) return;
        const key = event.key.toUpperCase();
        if (key === 'ENTER') { submitGuess(); return; }
        if (key === 'BACKSPACE') { removeLetter(); return; }
        if (/^[A-Z]$/.test(key) && key.length === 1) { event.preventDefault(); addLetter(key); return; }
    });
}

function addModalListeners() {
    document.querySelectorAll('.modal-close').forEach((button) => {
        button.addEventListener('click', () => { helpModal.classList.add('hidden'); statsModal.classList.add('hidden'); });
    });
    document.getElementById('btn-help').addEventListener('click', () => helpModal.classList.remove('hidden'));
    document.getElementById('btn-stats').addEventListener('click', () => { renderStats(); statsModal.classList.remove('hidden'); });
    resetStatsButton.addEventListener('click', resetStats);
    playAgainButton.addEventListener('click', () => { statsModal.classList.add('hidden'); window.location.reload(); });
    shareButton.addEventListener('click', copyShareResult);
    helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.add('hidden'); });
    statsModal.addEventListener('click', (e) => { if (e.target === statsModal) statsModal.classList.add('hidden'); });
}

function showInsult(text) {
    if (!insultText) return;
    insultText.textContent = text;
    insultText.classList.add('animate-pop');
    setTimeout(() => insultText.classList.remove('animate-pop'), 800);
}

async function initialize() {
    await loadAllowedWords();
    loadStats();
    createBoard();
    createKeyboard();
    addKeyboardListeners();
    addModalListeners();
    renderStats();
    updateTimerDisplay();
}

initialize();
