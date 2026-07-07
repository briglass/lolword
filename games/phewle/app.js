// PHEWLE — Wordle, but you start on the 6th guess.
// Rows 0-4 are pre-filled wrong guesses from words.js; the player gets row 5 only.
// One play per day, resets at the player's local midnight.

const WORD_LENGTH = 5;
const GRID_ROWS = 6;
const PLAYER_ROW = 5;
const MAX_ROUNDS = 6;

const TILE_COLORS = {
    correct: ['bg-correct', 'border-correct'],
    present: ['bg-present', 'border-present'],
    absent: ['bg-absent', 'border-absent']
};
const KEY_COLORS = {
    correct: ['bg-correct'],
    present: ['bg-present'],
    absent: ['bg-absent', 'opacity-60']
};
const SHARE_EMOJI = { correct: '\u{1F7E9}', present: '\u{1F7E8}', absent: '⬛' };

const stateKey = 'phewle_state_v1';
const statsKey = 'phewle_stats_v1';

const gridElement = document.getElementById('grid');
const keyboardElement = document.getElementById('keyboard');
const toastContainer = document.getElementById('toast-container');
const helpModal = document.getElementById('modal-help');
const statsModal = document.getElementById('modal-stats');
const statsTitle = document.getElementById('stats-title');
const statusBanner = document.getElementById('status-banner');
const revealWordContainer = document.getElementById('reveal-word-container');
const secretWordDisplay = document.getElementById('secret-word-display');
const statPlayed = document.getElementById('stat-played');
const statWinPct = document.getElementById('stat-winpct');
const statStreak = document.getElementById('stat-streak');
const statMaxStreak = document.getElementById('stat-maxstreak');
const countdownDisplay = document.getElementById('countdown');
const shareButton = document.getElementById('btn-share');
const resetStatsButton = document.getElementById('btn-reset-stats');

const keyboardLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

let solution = '';
let givenGuesses = [];
let guessResults = [];   // status arrays for all revealed rows (used for share grid)
let currentGuess = '';
let currentCol = 0;
let isGameOver = false;
let isRevealing = false;
let stats = null;
let dayState = null;
let VALID_GUESSES = new Set();
let countdownInterval = null;

// ---------- Daily puzzle selection (local time, resets at the user's midnight) ----------

function todayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function yesterdayString() {
    const now = new Date();
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
}

function dayNumber() {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const epochMidnight = new Date(PHEWLE_EPOCH.year, PHEWLE_EPOCH.month - 1, PHEWLE_EPOCH.day);
    // Math.round shrugs off DST hour shifts
    return Math.round((todayMidnight - epochMidnight) / 86400000);
}

function hasPuzzleData() {
    return typeof PHEWLE_PUZZLES !== 'undefined' && Array.isArray(PHEWLE_PUZZLES) && PHEWLE_PUZZLES.length > 0
        && typeof PHEWLE_EPOCH !== 'undefined';
}

function puzzleIndex() {
    const n = dayNumber() % PHEWLE_PUZZLES.length;
    return n < 0 ? n + PHEWLE_PUZZLES.length : n;
}

function puzzleNumber() {
    // Fall back to the number saved with a finished game if puzzle data is unavailable
    if (typeof PHEWLE_EPOCH === 'undefined') return (dayState && dayState.num) || 0;
    return dayNumber() + 1; // PHEWLE #1 is launch day
}

function loadPuzzle() {
    if (!hasPuzzleData()) return false;
    const entry = PHEWLE_PUZZLES[puzzleIndex()];
    solution = entry[0];
    givenGuesses = entry.slice(1);
    return true;
}

// ---------- Dictionary ----------

function buildDictionary() {
    if (typeof ALLOWED_WORDS !== 'undefined' && Array.isArray(ALLOWED_WORDS)) {
        VALID_GUESSES = new Set(ALLOWED_WORDS.filter((w) => w.length === WORD_LENGTH));
    }
    if (hasPuzzleData()) {
        PHEWLE_PUZZLES.forEach((entry) => entry.forEach((w) => VALID_GUESSES.add(w)));
    }
    // Today's own words are always guessable, whatever loaded
    if (solution) VALID_GUESSES.add(solution);
    givenGuesses.forEach((w) => VALID_GUESSES.add(w));
}

// ---------- Wordle evaluation ----------

function evaluateGuess(guess) {
    const solutionLetters = solution.split('');
    const result = guess.split('').map((letter) => ({ letter, status: 'absent' }));

    result.forEach((cell, index) => {
        if (solutionLetters[index] === cell.letter) {
            cell.status = 'correct';
            solutionLetters[index] = null;
        }
    });
    result.forEach((cell, index) => {
        if (cell.status === 'correct') return;
        const presentIndex = solutionLetters.indexOf(cell.letter);
        if (presentIndex !== -1) {
            cell.status = 'present';
            solutionLetters[presentIndex] = null;
        }
    });
    return result;
}

// ---------- Board / keyboard rendering ----------

function createBoard() {
    gridElement.innerHTML = '';
    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < WORD_LENGTH; col += 1) {
            const tile = document.createElement('div');
            tile.id = `tile-${row}-${col}`;
            tile.className = 'tile w-full aspect-square border-2 border-tileborder rounded-[3px] flex items-center justify-center text-2xl sm:text-3xl font-extrabold uppercase select-none text-white';
            gridElement.appendChild(tile);
        }
    }
}

function createKeyboard() {
    keyboardElement.innerHTML = '';
    keyboardLayout.forEach((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'flex justify-center w-full gap-1 sm:gap-1.5 px-1';
        row.forEach((key) => {
            const keyButton = document.createElement('button');
            keyButton.textContent = key === 'BACK' ? '⌫' : key;
            keyButton.dataset.key = key;
            keyButton.className = 'flex-1 min-w-[20px] max-w-[52px] h-14 rounded-[4px] bg-keybg text-white font-bold uppercase text-sm sm:text-base transition-colors focus:outline-none active:scale-95 select-none';
            if (key === 'ENTER' || key === 'BACK') {
                keyButton.classList.add('flex-[1.6]', 'max-w-[84px]', 'text-[11px]', 'sm:text-xs');
            }
            keyButton.addEventListener('click', () => handleKey(key));
            rowEl.appendChild(keyButton);
        });
        keyboardElement.appendChild(rowEl);
    });
}

function paintTile(tile, letter, status, flip) {
    const apply = () => {
        tile.textContent = letter;
        tile.classList.remove('border-tileborder', 'border-tileactive');
        tile.classList.add(...TILE_COLORS[status]);
    };
    if (flip) {
        tile.classList.add('flip');
        window.setTimeout(apply, 250); // swap color at the halfway point of the flip
        window.setTimeout(() => tile.classList.remove('flip'), 520);
    } else {
        apply();
    }
}

function paintRow(row, evaluation, flip, stagger) {
    evaluation.forEach((cell, index) => {
        const tile = document.getElementById(`tile-${row}-${index}`);
        if (!tile) return;
        if (flip) {
            window.setTimeout(() => paintTile(tile, cell.letter, cell.status, true), stagger + index * 140);
        } else {
            paintTile(tile, cell.letter, cell.status, false);
        }
    });
}

function updateKeyboard(evaluation) {
    const priority = { absent: 1, present: 2, correct: 3 };
    evaluation.forEach((cell) => {
        const key = keyboardElement.querySelector(`button[data-key="${cell.letter}"]`);
        if (!key) return;
        const previousState = key.dataset.state;
        if (!previousState || priority[cell.status] > priority[previousState]) {
            key.dataset.state = cell.status;
            key.classList.remove('bg-keybg', 'bg-correct', 'bg-present', 'bg-absent', 'opacity-60');
            key.classList.add(...KEY_COLORS[cell.status]);
        }
    });
}

// Reveal the 5 pre-filled wrong guesses.
// animate=true on a fresh day; instant when restoring a finished game.
function revealGivenGuesses(animate) {
    guessResults = [];
    givenGuesses.forEach((guess, row) => {
        const evaluation = evaluateGuess(guess);
        guessResults[row] = evaluation.map((cell) => cell.status);
        const stagger = animate ? 250 + row * 420 : 0;
        paintRow(row, evaluation, animate, stagger);
        if (animate) {
            window.setTimeout(() => updateKeyboard(evaluation), stagger + WORD_LENGTH * 140 + 250);
        } else {
            updateKeyboard(evaluation);
        }
    });
    return 250 + (givenGuesses.length - 1) * 420 + WORD_LENGTH * 140 + 400; // total animation time
}

// ---------- Input handling ----------

function handleKey(key) {
    if (isGameOver || isRevealing) return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === 'BACK') { removeLetter(); return; }
    if (key.length !== 1 || !/^[A-Z]$/.test(key)) return;
    addLetter(key);
}

function addLetter(letter) {
    if (currentCol >= WORD_LENGTH) return;
    currentGuess += letter;
    const tile = document.getElementById(`tile-${PLAYER_ROW}-${currentCol}`);
    if (tile) {
        tile.textContent = letter;
        tile.classList.remove('border-tileborder');
        tile.classList.add('border-tileactive', 'animate-pop');
        window.setTimeout(() => tile.classList.remove('animate-pop'), 130);
    }
    currentCol += 1;
}

function removeLetter() {
    if (currentCol === 0) return;
    currentCol -= 1;
    currentGuess = currentGuess.slice(0, -1);
    const tile = document.getElementById(`tile-${PLAYER_ROW}-${currentCol}`);
    if (tile) {
        tile.textContent = '';
        tile.classList.remove('border-tileactive');
        tile.classList.add('border-tileborder');
    }
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

function submitGuess() {
    if (currentGuess.length !== WORD_LENGTH) {
        animateRowShake(PLAYER_ROW);
        showToast('Not enough letters');
        return;
    }
    if (!VALID_GUESSES.has(currentGuess)) {
        animateRowShake(PLAYER_ROW);
        showToast('Not in word list');
        return;
    }

    isRevealing = true;
    const evaluation = evaluateGuess(currentGuess);
    guessResults[PLAYER_ROW] = evaluation.map((cell) => cell.status);
    paintRow(PLAYER_ROW, evaluation, true, 0);

    const won = currentGuess === solution;
    const revealDone = WORD_LENGTH * 140 + 400;

    window.setTimeout(() => {
        updateKeyboard(evaluation);
        endGame(won);
    }, revealDone);
}

function endGame(won) {
    isGameOver = true;
    isRevealing = false;

    // Save the full puzzle with the result so a return visit can rebuild the
    // board and share text entirely from this state, even if words.js fails to load
    dayState = {
        date: todayString(),
        num: puzzleNumber(),
        answer: solution,
        given: givenGuesses,
        guess: currentGuess,
        won: won,
        done: true
    };
    saveDayState();
    updateStats(won);

    if (typeof gtag === 'function') {
        gtag('event', 'phewle_result', { result: won ? 'win' : 'loss', puzzle: puzzleNumber() });
    }

    if (won) {
        showToast('PHEW! \u{1F62E}‍\u{1F4A8}');
        bounceWinRow();
        fireConfetti();
    } else {
        showToast(solution);
    }
    window.setTimeout(() => showResultModal(won), won ? 1700 : 1300);
}

function bounceWinRow() {
    for (let col = 0; col < WORD_LENGTH; col += 1) {
        const tile = document.getElementById(`tile-${PLAYER_ROW}-${col}`);
        if (tile) {
            window.setTimeout(() => tile.classList.add('animate-bounce-win'), col * 90);
        }
    }
}

function fireConfetti() {
    if (typeof confetti !== 'function') return;
    confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 }, colors: ['#538d4e', '#b59f3b', '#ffffff'] });
    window.setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4 } }), 350);
}

// ---------- Daily state (one play per day) ----------

function saveDayState() {
    try { window.localStorage.setItem(stateKey, JSON.stringify(dayState)); } catch (e) { /* private mode */ }
}

function loadDayState() {
    try {
        const saved = window.localStorage.getItem(stateKey);
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (parsed && parsed.date === todayString()) return parsed;
    } catch (e) { /* ignore */ }
    return null;
}

// Restore a finished game: paint everything instantly and lock input.
function restoreFinishedGame() {
    isGameOver = true;
    revealGivenGuesses(false);
    currentGuess = dayState.guess || '';
    if (currentGuess) {
        const evaluation = evaluateGuess(currentGuess);
        guessResults[PLAYER_ROW] = evaluation.map((cell) => cell.status);
        paintRow(PLAYER_ROW, evaluation, false, 0);
        updateKeyboard(evaluation);
    }
    window.setTimeout(() => showResultModal(dayState.won), 600);
}

// ---------- Stats ----------

function defaultStats() {
    return { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, lastPlayedDate: null };
}

function loadStats() {
    try {
        const saved = window.localStorage.getItem(statsKey);
        stats = saved ? JSON.parse(saved) : defaultStats();
        if (typeof stats.played !== 'number') stats = defaultStats();
    } catch (e) {
        stats = defaultStats();
    }
}

function saveStats() {
    try { window.localStorage.setItem(statsKey, JSON.stringify(stats)); } catch (e) { /* ignore */ }
}

function updateStats(won) {
    stats.played += 1;
    if (won) {
        stats.wins += 1;
        // Streak continues only if the previous played day was yesterday
        stats.currentStreak = (stats.lastPlayedDate === yesterdayString()) ? stats.currentStreak + 1 : 1;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    } else {
        stats.currentStreak = 0;
    }
    stats.lastPlayedDate = todayString();
    saveStats();
}

function resetStats() {
    stats = defaultStats();
    saveStats();
    renderStats();
    showToast('Stats reset');
}

function renderStats() {
    const winPercent = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    statPlayed.textContent = stats.played;
    statWinPct.textContent = `${winPercent}%`;
    statStreak.textContent = stats.currentStreak;
    statMaxStreak.textContent = stats.maxStreak;
}

// ---------- Result modal + countdown ----------

function showResultModal(won) {
    if (isGameOver && dayState && dayState.done) {
        statsTitle.textContent = won ? 'PHEW! \u{1F605}' : 'So Close. No Phew.';
        statusBanner.classList.remove('hidden', 'border-correct', 'text-correct', 'border-red-500', 'text-red-400');
        if (won) {
            statusBanner.classList.add('border-correct', 'text-correct');
            statusBanner.textContent = 'You saved the board on the 6th guess!';
        } else {
            statusBanner.classList.add('border-red-500', 'text-red-400');
            statusBanner.textContent = 'The one guess... wasted.';
        }
        revealWordContainer.classList.toggle('hidden', won);
        if (!won) secretWordDisplay.textContent = solution;
    } else {
        statsTitle.textContent = 'Statistics';
        statusBanner.classList.add('hidden');
        revealWordContainer.classList.add('hidden');
    }
    renderStats();
    startCountdown();
    statsModal.classList.remove('hidden');
}

function startCountdown() {
    if (countdownInterval !== null) return;
    const tick = () => {
        const now = new Date();
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const ms = nextMidnight - now;
        if (ms <= 1000 && isGameOver) {
            window.location.reload(); // new day, new PHEWLE
            return;
        }
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        countdownDisplay.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    tick();
    countdownInterval = window.setInterval(tick, 1000);
}

// ---------- Share ----------

function buildShareText() {
    const won = dayState && dayState.won;
    const score = won ? '6/6' : 'X/6';
    const rows = guessResults
        .filter((row) => Array.isArray(row))
        .map((row) => row.map((status) => SHARE_EMOJI[status]).join(''))
        .join('\n');
    const num = (dayState && dayState.num) || puzzleNumber();
    return `PHEWLE #${num} ${score} \u{1F605}\n\n${rows}\n\nwww.lolword.com/games/phewle`;
}

function copyShareResult() {
    if (!isGameOver || !dayState || !dayState.done) {
        showToast('Finish today’s PHEWLE to share it!');
        return;
    }
    const shareText = buildShareText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText)
            .then(() => showToast('Result copied to clipboard'))
            .catch(() => fallbackCopy(shareText));
    } else {
        fallbackCopy(shareText);
    }
}

function fallbackCopy(text) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        showToast('Result copied to clipboard');
    } catch (e) {
        showToast('Unable to copy automatically');
    }
}

// ---------- Toasts / modals ----------

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto px-4 py-3 rounded-lg bg-zinc-100 text-zinc-900 border border-zinc-300 text-sm font-bold shadow-xl shadow-black/40 animate-pop transition-opacity duration-300';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2000);
}

function addModalListeners() {
    document.querySelectorAll('.modal-close').forEach((button) => {
        button.addEventListener('click', () => {
            helpModal.classList.add('hidden');
            statsModal.classList.add('hidden');
        });
    });
    document.getElementById('btn-help').addEventListener('click', () => helpModal.classList.remove('hidden'));
    document.getElementById('btn-stats').addEventListener('click', () => showResultModal(dayState ? dayState.won : false));
    resetStatsButton.addEventListener('click', resetStats);
    shareButton.addEventListener('click', copyShareResult);
    helpModal.addEventListener('click', (event) => {
        if (event.target === helpModal) helpModal.classList.add('hidden');
    });
    statsModal.addEventListener('click', (event) => {
        if (event.target === statsModal) statsModal.classList.add('hidden');
    });
}

function addKeyboardListeners() {
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (!helpModal.classList.contains('hidden') || !statsModal.classList.contains('hidden')) {
            if (event.key === 'Escape' || event.key === 'Enter') {
                helpModal.classList.add('hidden');
                statsModal.classList.add('hidden');
            }
            return;
        }
        const key = event.key.toUpperCase();
        if (key === 'ENTER') { handleKey('ENTER'); return; }
        if (key === 'BACKSPACE') { handleKey('BACK'); return; }
        if (/^[A-Z]$/.test(key)) handleKey(key);
    });
}

// ---------- Init ----------

function initialize() {
    // Board, keyboard, and all listeners come up first and never depend on
    // word-list data — a data hiccup must not kill the stats/share buttons.
    loadStats();
    createBoard();
    createKeyboard();
    addModalListeners();
    addKeyboardListeners();

    dayState = loadDayState();
    if (dayState && dayState.done) {
        // Already played today — restore the board and lock it until midnight.
        // Prefer the puzzle copy saved with the result; fall back to words.js
        // for games saved before the puzzle was included in the state.
        if (dayState.answer && Array.isArray(dayState.given) && dayState.given.length) {
            solution = dayState.answer;
            givenGuesses = dayState.given;
        } else {
            loadPuzzle();
        }
        if (solution && givenGuesses.length) {
            try {
                restoreFinishedGame();
            } catch (e) {
                console.error('PHEWLE restore failed:', e);
                showToast('Something went wrong restoring today’s game');
            }
        } else {
            showToast('Couldn’t load today’s puzzle — try refreshing!');
        }
        return;
    }

    // Fresh day: dramatic reveal of the 5 failed guesses
    if (!loadPuzzle()) {
        showToast('Couldn’t load today’s puzzle — try refreshing!');
        return;
    }
    buildDictionary();
    isRevealing = true;
    const totalDelay = revealGivenGuesses(true);
    const firstVisit = !window.localStorage.getItem(statsKey);
    window.setTimeout(() => {
        isRevealing = false;
        showToast('5 wrong guesses. You get ONE. \u{1F605}');
        if (firstVisit) helpModal.classList.remove('hidden');
    }, totalDelay);
}

initialize();
