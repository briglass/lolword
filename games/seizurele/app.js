const MAX_ROUNDS = 6;
const WORD_LENGTH = 5;
const GRID_ROWS = 6;
let VALID_GUESSES = [];
let WORDS = [];
let disruptionActive = false;
let disruptionInterval = null;
let disruptionSpinTimeout = null;
let shapeSweepInterval = null;
let disruptionSpinActive = false;
let disruptionSpinDirection = 'normal';
let disruptionSpinDuration = 5;
const QUIET_COLORS = {
    correct: 'bg-correct text-white border-correct shadow-[0_0_0_2px_rgba(83,141,78,0.4)]',
    present: 'bg-present text-white border-present shadow-[0_0_0_2px_rgba(181,159,59,0.4)]',
    absent: 'bg-absent text-white border-absent shadow-[0_0_0_2px_rgba(58,58,60,0.4)]'
};
// Keyboard-specific colors: green/yellow match the tiles, but absent keys go
// pitch black with dimmed letters so guessed-and-missing letters are unmistakable
const KEY_COLORS = {
    correct: QUIET_COLORS.correct,
    present: QUIET_COLORS.present,
    absent: 'bg-black text-zinc-600 opacity-60 border border-zinc-800'
};

const gridElement = document.getElementById('grid');
const keyboardElement = document.getElementById('keyboard');
const timerDisplay = document.getElementById('timer-display');
const timerDot = document.getElementById('timer-dot');
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
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

const localStorageKey = 'seizurele_stats_v1';
const dailyIndex = Math.floor((Date.now() - new Date(2026, 0, 1).getTime()) / 86400000);
solution = ANSWERS[dailyIndex % ANSWERS.length];

async function loadAllowedWords() {
    if (typeof ALLOWED_WORDS !== 'undefined' && Array.isArray(ALLOWED_WORDS)) {
        VALID_GUESSES = [...new Set([...ANSWERS, ...ALLOWED_WORDS.filter((word) => word.length === WORD_LENGTH)])];
        WORDS = [...new Set(VALID_GUESSES)];
        return;
    }

    console.warn('ALLOWED_WORDS is not defined; using ANSWERS only.');
    VALID_GUESSES = [...ANSWERS];
    WORDS = [...ANSWERS];
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
            if (key === 'ENTER') keyButton.classList.add('min-w-[68px]');
            if (key === 'BACK') keyButton.classList.add('min-w-[68px]');
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
    // make the pulsating dot red while timer is active
    try {
        if (timerDot) {
            timerDot.classList.remove('bg-emerald-400');
            timerDot.classList.add('bg-red-400');
        }
        const inner = document.getElementById('timer-dot-inner');
        if (inner) {
            inner.classList.remove('bg-emerald-500');
            inner.classList.add('bg-red-500');
        }
    } catch (e) {
        // ignore if DOM not ready
    }
}

function updateTimerDisplay() {
    if (!timerStarted || startTime === null) return;
    const elapsed = Date.now() - startTime;
    timerDisplay.textContent = formatTime(elapsed);
}

function stopTimer() {
    if (timerInterval !== null) {
        window.clearInterval(timerInterval);
        timerInterval = null;
    }
    timerStarted = false;
    // revert the pulsating dot to green when stopped
    try {
        if (timerDot) {
            timerDot.classList.remove('bg-red-400');
            timerDot.classList.add('bg-emerald-400');
        }
        const inner = document.getElementById('timer-dot-inner');
        if (inner) {
            inner.classList.remove('bg-red-500');
            inner.classList.add('bg-emerald-500');
        }
    } catch (e) {
        // ignore if DOM not ready
    }
}

function startDisruptionEffects() {
    disruptionActive = true;
    disruptionSpinActive = true;
    randomizeSpin();
    applySpinClass();
    scheduleSpinToggle();
    flashBackground();
    disruptionInterval = window.setInterval(() => {
        if (Math.random() > 0.9) scrambleKeyboard();
        randomizeSpin();
        flashBackground();
        flashButtons();
        flashGuessedTiles();
        createSweepShape();
        createBurstShape();
        createBurstShape();
        createSweepShape();
        createRainShape();
        jitterScreen();
    }, 1200);
}

function stopDisruptionEffects() {
    disruptionActive = false;
    disruptionSpinActive = false;
    applySpinClass();
    document.body.style.backgroundColor = '';
    if (disruptionInterval !== null) {
        window.clearInterval(disruptionInterval);
        disruptionInterval = null;
    }
    if (disruptionSpinTimeout !== null) {
        window.clearTimeout(disruptionSpinTimeout);
        disruptionSpinTimeout = null;
    }
    if (shapeSweepInterval !== null) {
        window.clearInterval(shapeSweepInterval);
        shapeSweepInterval = null;
    }
    document.querySelectorAll('.flash-tile').forEach((tile) => tile.classList.remove('flash-tile'));
    document.querySelectorAll('.jitter-glitch').forEach((node) => node.classList.remove('jitter-glitch'));
    document.querySelectorAll('button.flash-button').forEach((button) => {
        button.classList.remove('flash-button');
        button.style.backgroundColor = '';
        button.style.color = '';
        button.style.boxShadow = '';
    });
    const overlay = document.getElementById('disruption-overlay');
    if (overlay) overlay.innerHTML = '';
}

function scheduleSpinToggle() {
    if (disruptionSpinTimeout !== null) {
        window.clearTimeout(disruptionSpinTimeout);
    }
    disruptionSpinTimeout = window.setTimeout(() => {
        disruptionSpinActive = !disruptionSpinActive;
        if (disruptionSpinActive) randomizeSpin();
        applySpinClass();
        scheduleSpinToggle();
    }, 1400 + Math.random() * 2600);
}

function applySpinClass() {
    const target = document.getElementById('crazy-visuals-container') || document.body;
    if (disruptionSpinActive) {
        target.classList.add('disruption-spin');
    } else {
        target.classList.remove('disruption-spin');
    }
}

function randomizeSpin() {
    disruptionSpinDirection = Math.random() > 0.5 ? 'normal' : 'reverse';
    disruptionSpinDuration = 7 + Math.random() * 3;
    document.documentElement.style.setProperty('--spin-duration', `${disruptionSpinDuration.toFixed(2)}s`);
    document.documentElement.style.setProperty('--spin-direction', disruptionSpinDirection);
}

function jitterScreen() {
    const target = document.getElementById('crazy-visuals-container') || document.body;
    const amount = 1 + Math.random() * 3;
    target.style.transform = `translate(${(Math.random() - 0.5) * amount}px, ${(Math.random() - 0.5) * amount}px)`;
    target.classList.add('jitter-glitch');
    window.setTimeout(() => {
        target.style.transform = '';
        target.classList.remove('jitter-glitch');
    }, 180 + Math.random() * 140);
}

function createBurstShape() {
    const overlay = document.getElementById('disruption-overlay');
    if (!overlay) return;
    const shape = document.createElement('div');
    const size = 30 + Math.random() * 110;
    shape.className = 'sweep-shape';
    shape.style.width = `${size}px`;
    shape.style.height = `${size}px`;
    shape.style.left = `${Math.random() * 100}%`;
    shape.style.top = `${Math.random() * 90}%`;
    shape.style.background = `radial-gradient(circle, ${getRandomFlashColor()} 0%, transparent 85%)`;
    shape.style.animationDuration = `${0.9 + Math.random() * 1.6}s`;
    overlay.appendChild(shape);
    window.setTimeout(() => shape.remove(), 1600 + Math.random() * 900);
}

function createRainShape() {
    const overlay = document.getElementById('disruption-overlay');
    if (!overlay) return;
    const drop = document.createElement('div');
    const width = 4 + Math.random() * 8;
    const height = 20 + Math.random() * 80;
    drop.className = 'rain-shape';
    drop.style.width = `${width}px`;
    drop.style.height = `${height}px`;
    drop.style.left = `${Math.random() * 90 + 5}%`;
    drop.style.top = `-120px`;
    drop.style.background = `linear-gradient(180deg, ${getRandomFlashColor()} 0%, transparent 100%)`;
    drop.style.opacity = '0.75';
    drop.style.animationDuration = `${1.2 + Math.random() * 1.4}s`;
    overlay.appendChild(drop);
    window.setTimeout(() => drop.remove(), 1500 + Math.random() * 600);
}

function scrambleKeyboard() {
    const rows = Array.from(keyboardElement.children);
    rows.forEach((row) => {
        const keys = Array.from(row.children);
        const shuffled = keys.sort(() => Math.random() - 0.5);
        shuffled.forEach((key) => row.appendChild(key));
    });
}

function flashBackground() {
    const body = document.body;
    body.classList.add('flash-background');
    body.style.backgroundColor = getRandomFlashColor();
    body.style.filter = 'saturate(1.3) brightness(1.1)';
    window.setTimeout(() => {
        body.classList.remove('flash-background');
        body.style.backgroundColor = '';
        body.style.filter = '';
    }, 650);
}

function flashButtons() {
    const buttons = Array.from(keyboardElement.querySelectorAll('button'));
    const color = getRandomFlashColor();
    buttons.forEach((button) => {
        // Dead letters stay visibly dead — never flash absent keys
        if (button.dataset.state === 'absent') return;
        button.classList.add('flash-button');
        button.style.backgroundColor = color;
        button.style.color = '#111';
        window.setTimeout(() => {
            button.classList.remove('flash-button');
            button.style.backgroundColor = '';
            button.style.color = '';
        }, 450);
    });
}

function getRandomFlashColor() {
    const colors = ['#f59e0b', '#ef4444', '#22c55e', '#38bdf8', '#a855f7', '#f43f5e'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function flashGuessedTiles() {
    const guessedTiles = Array.from(document.querySelectorAll('[id^="tile-"]')).filter((tile) => tile.textContent.trim().length === 1);
    guessedTiles.forEach((tile) => {
        tile.classList.add('flash-tile');
        window.setTimeout(() => tile.classList.remove('flash-tile'), 900);
    });
}

function createSweepShape() {
    const overlay = document.getElementById('disruption-overlay');
    if (!overlay) return;
    const shape = document.createElement('div');
    const size = 80 + Math.random() * 180;
    shape.className = 'sweep-shape';
    shape.style.width = `${size}px`;
    shape.style.height = `${size}px`;
    shape.style.left = `${-size}px`;
    shape.style.top = `${Math.random() * 70}vh`;
    shape.style.background = `radial-gradient(circle, ${getRandomFlashColor()} 0%, transparent 85%)`;
    overlay.appendChild(shape);
    window.setTimeout(() => shape.remove(), 2500);
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((milliseconds % 1000) / 100);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function handleKey(key) {
    if (isGameOver) return;
    if (key === 'ENTER') {
        submitGuess();
        return;
    }
    if (key === 'BACK') {
        removeLetter();
        return;
    }
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

    if (!disruptionActive) {
        startDisruptionEffects();
    }

    if (currentGuess === solution) {
        endGame(true);
        return;
    }

    if (currentRow === MAX_ROUNDS - 1) {
        endGame(false);
        return;
    }

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

    // Mark correct letters first
    guessLetters.forEach((letter, index) => {
        if (solutionLetters[index] === letter) {
            result[index].status = 'correct';
            solutionLetters[index] = null;
        }
    });

    // Mark present letters second
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
            const classesToRemove = [...Object.values(QUIET_COLORS), ...Object.values(KEY_COLORS)].flatMap(c => c.split(' '));
            key.classList.remove('bg-slate-800', 'hover:bg-slate-700', 'text-slate-100', ...classesToRemove);
            key.classList.add(...KEY_COLORS[nextState].split(' '));
        }
    });
}

function endGame(won) {
    isGameOver = true;
    stopTimer();
    stopDisruptionEffects();
    const elapsed = startTime ? Date.now() - startTime : 0;
    const solvedLabel = won ? `${currentRow + 1}/${MAX_ROUNDS}` : `X/${MAX_ROUNDS}`;
    const revealDelay = 500 + (WORD_LENGTH - 1) * 150;
    showToast(won ? 'You solved it!' : 'Game over');
    updateStats(won, currentRow + 1, elapsed);
    setTimeout(() => showStatsModal(won, elapsed, solvedLabel), revealDelay + 200);
}

function showStatsModal(won, elapsedMs, solvedLabel) {
    statsTitle.textContent = won ? 'Victory!' : 'Game Over';
    revealWordContainer.classList.toggle('hidden', won);
    if (!won) secretWordDisplay.textContent = solution;
    solveTimeContainer.classList.remove('hidden');
    solveTimeDisplay.textContent = formatTime(elapsedMs);
    shareInfoText.textContent = `Score: ${won ? `${currentRow + 1}/${MAX_ROUNDS}` : 'X/6'} • Time: ${formatTime(elapsedMs)}`;
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
        stats = {
            played: 0,
            wins: 0,
            currentStreak: 0,
            maxStreak: 0,
            distribution: Array(MAX_ROUNDS).fill(0),
            totalSolveTime: 0
        };
        return;
    }
    try {
        stats = JSON.parse(saved);
        if (stats.totalSolveTime === undefined) {
            stats.totalSolveTime = 0;
        }
    } catch (error) {
        stats = {
            played: 0,
            wins: 0,
            currentStreak: 0,
            maxStreak: 0,
            distribution: Array(MAX_ROUNDS).fill(0),
            totalSolveTime: 0
        };
    }
}

function saveStats() {
    window.localStorage.setItem(localStorageKey, JSON.stringify(stats));
}

function resetStats() {
    stats = {
        played: 0,
        wins: 0,
        currentStreak: 0,
        maxStreak: 0,
        distribution: Array(MAX_ROUNDS).fill(0),
        totalSolveTime: 0
    };
    saveStats();
    renderStats();
}

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
        if (stats.wins > 0 && stats.totalSolveTime > 0) {
            avgSolveElement.textContent = formatTime(stats.totalSolveTime / stats.wins);
        } else {
            avgSolveElement.textContent = '00:00.0';
        }
    }

    guessDistribution.innerHTML = '';

    stats.distribution.forEach((count, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3';
        const label = document.createElement('div');
        label.className = 'w-6 text-xs text-slate-400';
        label.textContent = index + 1;
        const barContainer = document.createElement('div');
        barContainer.className = 'flex-1 bg-slate-950 rounded-full h-8 overflow-hidden border border-slate-800';
        const bar = document.createElement('div');
        bar.className = 'h-full bg-emerald-500 rounded-full text-right pr-3 flex items-center justify-end text-[11px] font-semibold text-slate-950';
        const width = stats.played ? Math.max((count / Math.max(...stats.distribution, 1)) * 100, 2) : 2;
        bar.style.width = `${width}%`;
        bar.textContent = count;
        barContainer.appendChild(bar);
        row.appendChild(label);
        row.appendChild(barContainer);
        guessDistribution.appendChild(row);
    });
}

function copyShareResult() {
    if (!stats.played) {
        showToast('Play a game to share your score.');
        return;
    }
    const solved = isGameOver ? `${stats.wins === 0 ? 'X' : currentRow + 1}/${MAX_ROUNDS}` : `?/${MAX_ROUNDS}`;
    const time = timerStarted || startTime ? formatTime(Date.now() - startTime) : '00:00.0';
    const header = `🌀 SEIZURELE ${solved} • ${time} ⚡`;
    const squares = guessResults.map((row) =>
        row
            .map((status) => {
                if (status === 'correct') return '✨';  // Sparkles for Correct
                if (status === 'present') return '⚡';  // Lightning Strobe for Present
                return '😵‍💫';                           // Dizzy/Spinning for Absent
            })
            .join('')
    ).join('\n');
    const shareText = `${header}\n${squares}\n\nhttps://lolword.com/games/seizurele/`;
    navigator.clipboard.writeText(shareText).then(() => {
        showToast('Result copied to clipboard');
    }).catch(() => {
        showToast('Unable to copy automatically');
    });
}

function addKeyboardListeners() {
    document.addEventListener('keydown', (event) => {
        if (isGameOver) return;
        const key = event.key.toUpperCase();
        if (key === 'ENTER') {
            submitGuess();
            return;
        }
        if (key === 'BACKSPACE') {
            removeLetter();
            return;
        }
        if (/^[A-Z]$/.test(key) && key.length === 1) {
            event.preventDefault();
            return;
        }
    });
}

function addModalListeners() {
    document.querySelectorAll('.modal-close').forEach((button) => {
        button.addEventListener('click', () => {
            helpModal.classList.add('hidden');
            statsModal.classList.add('hidden');
        });
    });
    document.getElementById('btn-help').addEventListener('click', () => {
        helpModal.classList.remove('hidden');
    });
    document.getElementById('btn-stats').addEventListener('click', () => {
        renderStats();
        statsModal.classList.remove('hidden');
    });
    resetStatsButton.addEventListener('click', resetStats);
    playAgainButton.addEventListener('click', () => {
        statsModal.classList.add('hidden');
        window.location.reload();
    });
    shareButton.addEventListener('click', copyShareResult);
    helpModal.addEventListener('click', (event) => {
        if (event.target === helpModal) helpModal.classList.add('hidden');
    });
    statsModal.addEventListener('click', (event) => {
        if (event.target === statsModal) statsModal.classList.add('hidden');
    });
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
