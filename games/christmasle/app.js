const MAX_ROUNDS = 6;
let WORD_LENGTH = 5;
let GRID_ROWS = 6;

const QUIET_COLORS = {
    correct: 'bg-green-600 text-white border-green-600 shadow-[0_0_12px_rgba(34,197,94,0.4)]',
    present: 'bg-yellow-500 text-slate-950 border-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.4)]',
    absent: 'bg-zinc-600 text-white border-zinc-600'
};

const gridElement = document.getElementById('grid');
const keyboardElement = document.getElementById('keyboard');
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
const shareInfoText = document.getElementById('share-info-text');
const resetStatsButton = document.getElementById('btn-reset-stats');
const lockOverlay = document.getElementById('lock-overlay');
const btnShowTodayResults = document.getElementById('btn-show-today-results');
const wordLenDisplay = document.getElementById('word-len-display');
const btnMuteToggle = document.getElementById('btn-mute-toggle');
const muteIcon = document.getElementById('mute-icon');

let currentRow = 0;
let currentCol = 0;
let currentGuess = '';
let isGameOver = false;
let solution = '';
let stats = null;
let guessResults = [];
let todayDateString = '';

const keyboardLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

const localStorageKey = 'christmasle_stats_v1';

// Web Audio API Synthesizer setup
let isMuted = true;
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (isMuted) return;
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type, duration, delay = 0) {
    if (isMuted) return;
    try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime + delay;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.1);
    } catch (e) {
        // ignore audio context failures
    }
}

function playBellSound() {
    playTone(987.77, 'sine', 0.15); // B5 high bell tone
}

function playDeleteSound() {
    playTone(523.25, 'sine', 0.1); // C5 lower tone
}

function playErrorSound() {
    playTone(220, 'sawtooth', 0.25); // Low buzz
}

function playSuccessChime() {
    const now = 0;
    // We Wish You A Merry Christmas motif in C Major:
    // D4(293.66) -> G4(392.00) -> G4(392.00) -> A4(440.00) -> G4(392.00) -> F#4(369.99) -> E4(329.63)
    const notes = [293.66, 392.00, 392.00, 440.00, 392.00, 369.99, 329.63, 523.25];
    const delays = [0, 0.25, 0.45, 0.65, 0.85, 1.05, 1.25, 1.45];
    const durations = [0.2, 0.2, 0.15, 0.15, 0.15, 0.15, 0.2, 0.5];
    
    notes.forEach((freq, idx) => {
        playTone(freq, 'sine', durations[idx], delays[idx]);
        // layer triangle wave for warmth
        setTimeout(() => {
            playTone(freq * 1.005, 'triangle', durations[idx] * 0.9, 0);
        }, delays[idx] * 1000);
    });
}

function playFailureChime() {
    const notes = [293.66, 277.18, 261.63, 233.08];
    notes.forEach((freq, idx) => {
        playTone(freq, 'triangle', 0.3, idx * 0.2);
    });
}

// Generate beautiful falling snow inside the snow-container
function startSnowfall() {
    const container = document.getElementById('snow-container');
    if (!container) return;
    const snowflakeCount = 45;
    const snowflakesList = ['❄️', '❄️', '✨', '⚪', '❄️', '🦌', '☃️', '🎄', '🎁'];
    
    for (let i = 0; i < snowflakeCount; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.textContent = snowflakesList[Math.floor(Math.random() * snowflakesList.length)];
        
        const size = 10 + Math.random() * 20;
        const left = Math.random() * 100;
        const delay = Math.random() * 8;
        const duration = 6 + Math.random() * 6;
        
        flake.style.fontSize = `${size}px`;
        flake.style.left = `${left}%`;
        flake.style.animationDelay = `${delay}s`;
        flake.style.animationDuration = `${duration}s`;
        flake.style.opacity = (0.3 + Math.random() * 0.7).toString();
        
        container.appendChild(flake);
    }
}

function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function selectDailySolution() {
    todayDateString = getTodayDateString();
    
    // Deterministic date string hash
    let hash = 0;
    for (let i = 0; i < todayDateString.length; i++) {
        hash = (hash << 5) - hash + todayDateString.charCodeAt(i);
        hash |= 0;
    }
    
    const index = Math.abs(hash) % ANSWERS.length;
    solution = ANSWERS[index].toUpperCase();
    WORD_LENGTH = solution.length;
    
    if (wordLenDisplay) {
        wordLenDisplay.textContent = WORD_LENGTH.toString();
    }
}

function createBoard() {
    gridElement.innerHTML = '';
    // Set columns dynamically based on solution length
    gridElement.style.gridTemplateColumns = `repeat(${WORD_LENGTH}, minmax(0, 1fr))`;
    
    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < WORD_LENGTH; col += 1) {
            const tile = document.createElement('div');
            tile.id = `tile-${row}-${col}`;
            tile.className = 'w-full aspect-square border-2 border-emerald-950/40 rounded-2xl flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-black tracking-normal uppercase select-none bg-slateBoard text-slate-50 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]';
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
            keyButton.textContent = key;
            keyButton.dataset.key = key;
            // set flex-grow, min-width, and padding to fully use client/window width nicely
            keyButton.className = 'flex-1 min-w-[20px] max-w-[80px] h-12 sm:h-14 rounded-xl bg-emerald-950 text-slate-100 font-extrabold shadow-md hover:bg-emerald-900 transition-colors focus:outline-none active:scale-95 text-[11px] sm:text-base border border-emerald-800/40 select-none';
            if (key === 'ENTER' || key === 'BACK') {
                keyButton.classList.add('flex-[1.5]', 'max-w-[110px]', 'text-[9px]', 'sm:text-[13px]');
            }
            keyButton.addEventListener('click', () => handleKey(key));
            rowEl.appendChild(keyButton);
        });
        keyboardElement.appendChild(rowEl);
    });
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
    playBellSound();
    currentGuess += letter;
    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    if (tile) {
        tile.textContent = letter;
        tile.classList.add('animate-pop');
        tile.classList.add('border-emerald-600');
        window.setTimeout(() => tile.classList.remove('animate-pop'), 120);
    }
    currentCol += 1;
}

function removeLetter() {
    if (isGameOver) return;
    if (currentCol === 0) return;
    playDeleteSound();
    currentCol -= 1;
    currentGuess = currentGuess.slice(0, -1);
    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    if (tile) {
        tile.textContent = '';
        tile.classList.remove('border-emerald-600');
    }
}

function submitGuess() {
    if (currentGuess.length !== WORD_LENGTH) {
        animateRowShake(currentRow);
        playErrorSound();
        showToast('Not enough holiday letters!');
        return;
    }
    
    // We allow ANY nonsense word / letter combination to keep things fun and playable
    const evaluation = evaluateGuess(currentGuess);
    revealGuessTiles(evaluation);
    guessResults[currentRow] = evaluation.map(cell => cell.status);
    updateKeyboard(evaluation);

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
            tile.classList.remove('bg-slateBoard', 'border-emerald-950/40', 'border-emerald-600');
            tile.classList.add(...classes);
            if (cell.status === 'present') {
                tile.classList.remove('text-slate-50', 'text-white');
                tile.classList.add('text-slate-950');
            } else {
                tile.classList.remove('text-slate-50', 'text-slate-950');
                tile.classList.add('text-white');
            }
        }, index * 120);
        window.setTimeout(() => tile.classList.remove('flip'), 450 + index * 120);
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

function triggerHolidayCheer() {
    // Fire beautiful confetti multiple times!
    const end = Date.now() + (3 * 1000);
    const colors = ['#dc2626', '#16a34a', '#eab308', '#ffffff'];

    (function frame() {
        confetti({
            particleCount: 4,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 4,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

function endGame(won) {
    isGameOver = true;
    const revealDelay = 500 + (WORD_LENGTH - 1) * 120;
    
    if (won) {
        showToast('🎄 MAGNIFICENT JOY TO THE WORLD! 🎁');
        setTimeout(() => {
            playSuccessChime();
            triggerHolidayCheer();
        }, revealDelay);
    } else {
        showToast('🎅 Better luck next time! ❄️');
        setTimeout(() => {
            playFailureChime();
        }, revealDelay);
    }
    
    // Save daily lock status
    updateStats(won, currentRow + 1);
    
    setTimeout(() => {
        showStatsModal(won);
    }, revealDelay + 1400);
}

function getCheerMessage(won, count) {
    if (!won) {
        return "Even Santa gets stuck down the chimney sometimes! Have a jolly cup of cocoa.";
    }
    const messages = [
        "A Christmas miracle! Santa is absolutely proud of your immense brainpower.",
        "Beautifully unwrapped in two guesses! You are a holiday genius.",
        "Unwrapped in three! That is better than a shiny new bicycle under the tree.",
        "Guessed in four! Truly a warm, glowing performance.",
        "Solved in five! A little tense, but the holiday spirit pulled you through.",
        "Down to the last ribbon! That was incredibly close, but you saved Christmas!"
    ];
    return messages[Math.min(count - 1, messages.length - 1)];
}

function showStatsModal(won) {
    statsTitle.textContent = won ? '🎄 JOLLY VICTORY! 🎁' : '🎅 Oh, Coal! ❄️';
    revealWordContainer.classList.toggle('hidden', won);
    if (!won) secretWordDisplay.textContent = solution;
    
    const statsCheerDisplay = document.getElementById('stats-cheer-display');
    if (statsCheerDisplay) {
        statsCheerDisplay.textContent = `"${getCheerMessage(won, currentRow + 1)}"`;
    }
    
    renderStats();
    statsModal.classList.remove('hidden');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto px-4 py-3 rounded-2xl bg-slate-900/95 border-2 border-emerald-700 text-sm font-bold text-slate-100 shadow-xl shadow-black/40 animate-pop';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2400);
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
            completedToday: false,
            todayDate: '',
            todayWon: false,
            todayResults: [],
            todayGuesses: []
        };
        return;
    }
    try {
        stats = JSON.parse(saved);
        if (!stats.distribution || stats.distribution.length !== MAX_ROUNDS) {
            stats.distribution = Array(MAX_ROUNDS).fill(0);
        }
    } catch (error) {
        stats = {
            played: 0,
            wins: 0,
            currentStreak: 0,
            maxStreak: 0,
            distribution: Array(MAX_ROUNDS).fill(0),
            completedToday: false,
            todayDate: '',
            todayWon: false,
            todayResults: [],
            todayGuesses: []
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
        completedToday: false,
        todayDate: '',
        todayWon: false,
        todayResults: [],
        todayGuesses: []
    };
    saveStats();
    renderStats();
    showToast('Presents reset successfully!');
}

function updateStats(won, guessCount) {
    stats.played += 1;
    stats.completedToday = true;
    stats.todayDate = todayDateString;
    stats.todayWon = won;
    stats.todayResults = [...guessResults];
    
    if (won) {
        stats.wins += 1;
        stats.currentStreak += 1;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        stats.distribution[currentRow] += 1;
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

    guessDistribution.innerHTML = '';

    stats.distribution.forEach((count, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3';
        const label = document.createElement('div');
        label.className = 'w-6 text-xs text-slate-400 font-bold';
        label.textContent = index + 1;
        
        const barContainer = document.createElement('div');
        barContainer.className = 'flex-1 bg-slate-950 rounded-full h-8 overflow-hidden border border-slate-800';
        
        const bar = document.createElement('div');
        bar.className = 'h-full bg-emerald-600 rounded-full text-right pr-3 flex items-center justify-end text-[11px] font-black text-white';
        const width = stats.played ? Math.max((count / Math.max(...stats.distribution, 1)) * 100, 4) : 4;
        bar.style.width = `${width}%`;
        bar.textContent = count;
        
        barContainer.appendChild(bar);
        row.appendChild(label);
        row.appendChild(barContainer);
        guessDistribution.appendChild(row);
    });
}

function copyShareResult() {
    const solved = isGameOver ? `${stats.todayWon ? currentRow + 1 : 'X'}/${MAX_ROUNDS}` : `?/${MAX_ROUNDS}`;
    const header = `🎄🎅🎁 CHRISTMASLE ${solved} 🎁🎅🎄`;
    
    // Map colors to over-the-top Christmas emojis
    const squares = (guessResults.length ? guessResults : stats.todayResults).map((row) =>
        row
            .map((status) => {
                if (status === 'correct') return '🎄'; // Tree
                if (status === 'present') return '🎁'; // Gift
                return '❄️';                         // Snowflake
            })
            .join('')
    ).join('\n');
    
    const shareText = `${header}\n${squares}\n\nUnwrap your gift today at:\nhttps://www.lolword.com/games/christmasle`;
    
    navigator.clipboard.writeText(shareText).then(() => {
        showToast('Holiday copy success! 🎅');
    }).catch(() => {
        showToast('Unable to wrap share text automatically');
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
            addLetter(key);
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
    shareButton.addEventListener('click', copyShareResult);
    
    helpModal.addEventListener('click', (event) => {
        if (event.target === helpModal) helpModal.classList.add('hidden');
    });
    statsModal.addEventListener('click', (event) => {
        if (event.target === statsModal) statsModal.classList.add('hidden');
    });
    
    btnShowTodayResults.addEventListener('click', () => {
        showStatsModal(stats.todayWon);
    });
}

function setupMuteToggle() {
    // Set initial icon to muted since default is true
    if (muteIcon) {
        muteIcon.outerHTML = '<i data-lucide="volume-x" id="mute-icon" class="w-5 h-5"></i>';
    }
    
    btnMuteToggle.addEventListener('click', () => {
        isMuted = !isMuted;
        const currentMuteIcon = document.getElementById('mute-icon');
        if (isMuted) {
            if (currentMuteIcon) {
                currentMuteIcon.outerHTML = '<i data-lucide="volume-x" id="mute-icon" class="w-5 h-5"></i>';
            }
        } else {
            if (currentMuteIcon) {
                currentMuteIcon.outerHTML = '<i data-lucide="volume-2" id="mute-icon" class="w-5 h-5"></i>';
            }
            try {
                initAudio();
                playBellSound();
            } catch (err) {}
        }
        lucide.createIcons();
    });
}

async function initialize() {
    selectDailySolution();
    loadStats();
    
    // Check if they already played today
    if (stats.completedToday && stats.todayDate === todayDateString) {
        isGameOver = true;
        currentRow = stats.todayResults.length;
        guessResults = [...stats.todayResults];
        
        // Show the overlay
        lockOverlay.classList.remove('hidden');
    }
    
    createBoard();
    createKeyboard();
    addKeyboardListeners();
    addModalListeners();
    setupMuteToggle();
    startSnowfall();
    renderStats();
    
    // Unhide icons
    lucide.createIcons();
}

initialize();
