const MAX_ROUNDS = 6;
const WORD_LENGTH = 5;
const GRID_ROWS = 6;

const gridElement = document.getElementById('grid');
const keyboardElement = document.getElementById('keyboard');
const shareButton = document.getElementById('btn-share');
const toastContainer = document.getElementById('toast-container');
const helpModal = document.getElementById('modal-help');
const statsModal = document.getElementById('modal-stats');
const statsTitle = document.getElementById('stats-title');
const statusBanner = document.getElementById('status-banner');
const statPlayed = document.getElementById('stat-played');
const statWinPct = document.getElementById('stat-winpct');
const statStreak = document.getElementById('stat-streak');
const statMaxStreak = document.getElementById('stat-maxstreak');
const resetStatsButton = document.getElementById('btn-reset-stats');
const playAgainButton = document.getElementById('btn-play-again');

let currentRow = 0;
let currentCol = 0;
let currentGuess = '';
let isGameOver = false;
let gameOutcome = null; // 'win' or 'loss'
let stats = null;
let dailyState = {
    date: '',
    targetSeconds: 0,
    outcome: null
};

// Randomized invisible timer
let targetSeconds = 0;
let timerSecondsElapsed = 0;
let invisibleTimerInterval = null;

const keyboardLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

const localStorageKey = 'dontle_stats_v1';
const dailyStateKey = 'dontle_daily_state_v1';

// Format Date as local YYYY-MM-DD
function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Random timer duration: 10 seconds to 5 minutes (300 seconds), shorter times skew
function generateTargetSeconds() {
    const minTime = 10;
    const maxTime = 300;
    const u = Math.random();
    // Pow(u, 2.5) heavily skews towards shorter times
    return Math.floor(minTime + (maxTime - minTime) * Math.pow(u, 2.5));
}

function loadDailyState() {
    const todayStr = getLocalDateString();
    const raw = localStorage.getItem(dailyStateKey);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed.date === todayStr) {
                dailyState = parsed;
                return;
            }
        } catch (e) {
            console.error('Error loading daily DONTLE state', e);
        }
    }

    // New day setup! Generate unique duration for today
    dailyState = {
        date: todayStr,
        targetSeconds: generateTargetSeconds(),
        outcome: null
    };
    saveDailyState();
}

function saveDailyState() {
    localStorage.setItem(dailyStateKey, JSON.stringify(dailyState));
}

function initGame() {
    currentRow = 0;
    currentCol = 0;
    currentGuess = '';
    isGameOver = false;
    gameOutcome = null;
    timerSecondsElapsed = 0;

    loadStats();
    loadDailyState();

    targetSeconds = dailyState.targetSeconds;
    gameOutcome = dailyState.outcome;

    console.log(`DONTLE Date: ${dailyState.date} | Target: ${targetSeconds}s | Outcome: ${gameOutcome}`);

    createBoard();
    createKeyboard();
    resetModalBindings();

    if (gameOutcome !== null) {
        isGameOver = true;
        // Pre-fill board visual depending on past outcome for the day
        setTimeout(() => {
            if (gameOutcome === 'loss') {
                for (let col = 0; col < WORD_LENGTH; col += 1) {
                    const tile = document.getElementById(`tile-0-${col}`);
                    if (tile) {
                        tile.textContent = 'F';
                        tile.classList.add('bg-correct', 'text-white', 'border-correct');
                    }
                }
            } else if (gameOutcome === 'win') {
                for (let col = 0; col < WORD_LENGTH; col += 1) {
                    const tile = document.getElementById(`tile-0-${col}`);
                    if (tile) {
                        tile.textContent = '🏆';
                        tile.classList.add('bg-zinc-800', 'text-green-400', 'border-green-500');
                    }
                }
            }
        }, 100);

        // Auto show stats modal
        setTimeout(showStatsModal, 1000);
    } else {
        // Start invisible timer immediately
        if (invisibleTimerInterval) {
            clearInterval(invisibleTimerInterval);
        }
        invisibleTimerInterval = setInterval(updateInvisibleTimer, 1000);
    }
}

function updateInvisibleTimer() {
    if (isGameOver) return;
    
    timerSecondsElapsed += 1;
    if (timerSecondsElapsed >= targetSeconds) {
        winGame();
    }
}

function createBoard() {
    gridElement.innerHTML = '';
    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < WORD_LENGTH; col += 1) {
            const tile = document.createElement('div');
            tile.id = `tile-${row}-${col}`;
            tile.className = 'w-full aspect-square border border-zinc-800 rounded-xl flex items-center justify-center text-2xl sm:text-3xl font-extrabold tracking-[0.35em] uppercase select-none bg-zinc-900 text-zinc-50 transition-all duration-300';
            gridElement.appendChild(tile);
        }
    }
}

function createKeyboard() {
    keyboardElement.innerHTML = '';
    keyboardLayout.forEach((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'flex justify-center gap-1.5 sm:gap-2';
        row.forEach((key) => {
            const keyButton = document.createElement('button');
            keyButton.textContent = key;
            keyButton.dataset.key = key;
            keyButton.className = 'min-w-[32px] sm:min-w-[42px] h-12 sm:h-14 rounded-xl bg-zinc-800 text-zinc-100 font-semibold shadow-md hover:bg-zinc-700 transition-colors focus:outline-none active:scale-[0.98] text-sm sm:text-base';
            if (key === 'ENTER') keyButton.classList.add('min-w-[58px]', 'sm:min-w-[68px]');
            if (key === 'BACK') keyButton.classList.add('min-w-[58px]', 'sm:min-w-[68px]');
            keyButton.addEventListener('click', () => handleKey(key));
            rowEl.appendChild(keyButton);
        });
        keyboardElement.appendChild(rowEl);
    });
}

function handleKey(key) {
    if (isGameOver) return;

    if (key === 'ENTER') {
        if (currentGuess.length < WORD_LENGTH) {
            showToast('Not enough letters!');
            return;
        }
        // Submitting any word causes an instant loss!
        loseGame();
    } else if (key === 'BACK' || key === 'BACKSPACE') {
        if (currentCol > 0) {
            currentCol -= 1;
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            tile.textContent = '';
            tile.classList.remove('border-zinc-500', 'scale-105');
            tile.classList.add('border-zinc-800');
            currentGuess = currentGuess.slice(0, -1);
        }
    } else if (/^[A-Z]$/.test(key.toUpperCase())) {
        if (currentCol < WORD_LENGTH) {
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            tile.textContent = key.toUpperCase();
            tile.classList.remove('border-zinc-800');
            tile.classList.add('border-zinc-500', 'scale-105');
            currentGuess += key.toUpperCase();
            currentCol += 1;
        }
    }
}

// Physical keyboard listener
window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    
    // Ignore keyboard input if focus is inside standard text controls/dialog components
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
    }

    const key = e.key.toUpperCase();
    if (key === 'ENTER') {
        handleKey('ENTER');
    } else if (key === 'BACKSPACE') {
        handleKey('BACK');
    } else if (/^[A-Z]$/.test(key)) {
        handleKey(key);
    }
});

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'px-4 py-2 bg-red-600 text-white rounded-xl shadow-lg font-bold text-sm tracking-wide animate-bounce';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 2500);
}

function winGame() {
    isGameOver = true;
    gameOutcome = 'win';
    clearInterval(invisibleTimerInterval);

    // Save Daily State
    dailyState.outcome = 'win';
    saveDailyState();

    // Save stats
    stats.played += 1;
    stats.streak += 1;
    if (stats.streak > stats.maxStreak) {
        stats.maxStreak = stats.streak;
    }
    stats.wins += 1;
    saveStats();

    // Visual feedback
    showToast('🏆 YOU WON DONTLE! YOU SUCCESSFULLY DID NOT PLAY.');
    confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
    });

    setTimeout(showStatsModal, 1500);
}

function loseGame() {
    isGameOver = true;
    gameOutcome = 'loss';
    clearInterval(invisibleTimerInterval);

    // Color tiles as incorrect (red) to visually show they played and failed
    for (let col = 0; col < WORD_LENGTH; col += 1) {
        const tile = document.getElementById(`tile-${currentRow}-${col}`);
        tile.classList.add('bg-correct', 'text-white', 'border-correct', 'animate-shake');
    }

    // Save Daily State
    dailyState.outcome = 'loss';
    saveDailyState();

    // Save stats
    stats.played += 1;
    stats.streak = 0;
    saveStats();

    showToast('💥 Game Over! You played DONTLE and lost.');
    
    setTimeout(showStatsModal, 1500);
}

// Stats & Modals Logic
function loadStats() {
    const raw = localStorage.getItem(localStorageKey);
    if (raw) {
        try {
            stats = JSON.parse(raw);
        } catch (e) {
            stats = getInitialStats();
        }
    } else {
        stats = getInitialStats();
    }
}

function saveStats() {
    localStorage.setItem(localStorageKey, JSON.stringify(stats));
}

function getInitialStats() {
    return {
        played: 0,
        wins: 0,
        streak: 0,
        maxStreak: 0
    };
}

function updateStatsUI() {
    statPlayed.textContent = stats.played;
    const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    statWinPct.textContent = `${winPct}%`;
    statStreak.textContent = stats.streak;
    statMaxStreak.textContent = stats.maxStreak;

    // Update Banner
    if (gameOutcome === 'win') {
        statusBanner.className = 'p-4 rounded-xl border text-center font-bold text-lg select-none bg-green-950/40 border-green-800 text-green-400';
        statusBanner.innerHTML = '✨ CONGRATULATIONS! You successfully resisted the urge and won DONTLE.';
    } else if (gameOutcome === 'loss') {
        statusBanner.className = 'p-4 rounded-xl border text-center font-bold text-lg select-none bg-red-950/40 border-red-800 text-red-400';
        statusBanner.innerHTML = '🚨 FAILURE! You entered a word and played DONTLE. You lost.';
    } else {
        statusBanner.className = 'p-4 rounded-xl border text-center font-bold text-lg select-none bg-zinc-950/40 border-zinc-800 text-zinc-400';
        statusBanner.innerHTML = '🕒 Game in progress. Do not enter any words.';
    }

    // Disable / Enable Play Again button based on whether they played today
    if (dailyState.outcome !== null) {
        playAgainButton.disabled = true;
        playAgainButton.textContent = 'Come back tomorrow!';
        playAgainButton.classList.add('opacity-50', 'cursor-not-allowed');
        playAgainButton.classList.remove('hover:bg-zinc-700');
    } else {
        playAgainButton.disabled = false;
        playAgainButton.textContent = 'Try to Resist Again';
        playAgainButton.classList.remove('opacity-50', 'cursor-not-allowed');
        playAgainButton.classList.add('hover:bg-zinc-700');
    }
}

function showStatsModal() {
    updateStatsUI();
    statsModal.classList.remove('hidden');
    // Ensure scaling transition
    const inner = statsModal.firstElementChild;
    inner.classList.remove('scale-95');
    inner.classList.add('scale-100');
}

function hideStatsModal() {
    statsModal.classList.add('hidden');
}

function showHelpModal() {
    helpModal.classList.remove('hidden');
    const inner = helpModal.firstElementChild;
    inner.classList.remove('scale-95');
    inner.classList.add('scale-100');
}

function hideHelpModal() {
    helpModal.classList.add('hidden');
}

function resetModalBindings() {
    // Standard close triggers
    document.querySelectorAll('.modal-close').forEach((btn) => {
        btn.addEventListener('click', () => {
            hideHelpModal();
            hideStatsModal();
        });
    });

    // Outer click to close
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) hideHelpModal();
    });
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) hideStatsModal();
    });
}

// Setup static triggers
document.getElementById('btn-help').addEventListener('click', showHelpModal);
document.getElementById('btn-stats').addEventListener('click', showStatsModal);

resetStatsButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all DONTLE statistics?')) {
        stats = getInitialStats();
        saveStats();
        updateStatsUI();
        showToast('Stats reset successfully.');
    }
});

playAgainButton.addEventListener('click', () => {
    if (playAgainButton.disabled) return;
    hideStatsModal();
    initGame();
    showToast('New round started! Do not play.');
});

// Share button handling
shareButton.addEventListener('click', () => {
    if (!gameOutcome) {
        showToast('Finish the game to share your result!');
        return;
    }

    const titleText = gameOutcome === 'win' ? 'DONTLE - WIN 🏆' : 'DONTLE - LOSS 💥';
    const messageText = gameOutcome === 'win' 
        ? `Resisted the urge to play and successfully did not play. Current Streak: ${stats.streak}` 
        : `Failed to resist. Entered a word. Current Streak: ${stats.streak}`;

    // Generate 6 rows of word response emoji blocks to look like Wordle
    let gridEmojis = '';
    if (gameOutcome === 'win') {
        // 6 rows of green blocks for successful resistance
        gridEmojis = '🟩🟩🟩🟩🟩\n🟩🟩🟩🟩🟩\n🟩🟩🟩🟩🟩\n🟩🟩🟩🟩🟩\n🟩🟩🟩🟩🟩\n🟩🟩🟩🟩🟩';
    } else {
        // 1 row of red block (failed guess) and 5 rows of black blocks (empty rows)
        gridEmojis = '🟥🟥🟥🟥🟥\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛';
    }

    const shareText = `${titleText}\n${gridEmojis}\n${messageText}\n\nhttps://lolword.com/games/dontle/`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            showToast('Result copied to clipboard!');
        }).catch((err) => {
            console.error('Clipboard copy failed', err);
            showToast('Failed to copy result.');
        });
    } else {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Result copied to clipboard!');
        } catch (e) {
            showToast('Could not copy automatically.');
        }
        document.body.removeChild(textArea);
    }
});

// Auto-show help modal on first visit ever
const visitedKey = 'dontle_visited';
if (!localStorage.getItem(visitedKey)) {
    localStorage.setItem(visitedKey, 'true');
    showHelpModal();
}

// Run init
initGame();
