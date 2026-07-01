const MAX_ROUNDS = 2;
const WORD_LENGTH = 12;
const GRID_ROWS = 2;

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
const statChocolate = document.getElementById('stat-chocolate');
const statGold = document.getElementById('stat-gold');
const resetStatsButton = document.getElementById('btn-reset-stats');
const playAgainButton = document.getElementById('btn-play-again');
const gameBody = document.getElementById('game-body');

let currentRow = 0;
let currentCol = 0;
let currentGuess = '';
let isGameOver = false;
let gameOutcome = null; // 'win' or 'loss'
let stats = null;
let dailyState = {
    date: '',
    target: '',
    guesses: [],
    outcome: null,
    reward: null
};

// Seeded Random helper for 1 in 1000 chance per user per day
function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getUserId() {
    let userId = localStorage.getItem('goldenticketle_user_id');
    if (!userId) {
        userId = 'usr_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('goldenticketle_user_id', userId);
    }
    return userId;
}

function getSeededRandom(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
    }
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
}

function determineTarget() {
    const userId = getUserId();
    const todayStr = getLocalDateString();
    const seed = `${userId}_${todayStr}`;
    const rand = getSeededRandom(seed);
    const value = Math.floor(rand * 1000); // 0 to 999
    
    // Exact 1 in 1000 chance (e.g. if rolled number is 777)
    if (value === 777) {
        return 'GOLDENTICKET';
    }
    return 'CHOCOLATEBAR';
}

const keyboardLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

const localStorageKey = 'goldenticketle_stats_v1';
const dailyStateKey = 'goldenticketle_daily_state_v1';

// Custom sound synthesizer via Web Audio API
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type, duration, delay = 0, gainVal = 0.1) {
    try {
        initAudio();
        if (!audioCtx || audioCtx.state !== 'running') return;
        
        setTimeout(() => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(gainVal, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        }, delay * 1000);
    } catch (e) {
        console.error(e);
    }
}

function playSoundType(type) {
    if (type === 'type') {
        playTone(350, 'triangle', 0.08, 0, 0.05);
    } else if (type === 'error') {
        playTone(150, 'sawtooth', 0.25, 0, 0.1);
    } else if (type === 'reveal') {
        playTone(440, 'sine', 0.12, 0, 0.08);
    } else if (type === 'win_chocolate') {
        // Little sweet fanfare
        playTone(261.63, 'sine', 0.15, 0, 0.1); // C4
        playTone(329.63, 'sine', 0.15, 0.12, 0.1); // E4
        playTone(392.00, 'sine', 0.15, 0.24, 0.1); // G4
        playTone(523.25, 'sine', 0.3, 0.36, 0.1); // C5
    } else if (type === 'win_gold') {
        // Triumphant orchestral sound
        playTone(261.63, 'sawtooth', 0.2, 0, 0.15); // C4
        playTone(329.63, 'sawtooth', 0.2, 0.1, 0.15); // E4
        playTone(392.00, 'sawtooth', 0.2, 0.2, 0.15); // G4
        playTone(523.25, 'sawtooth', 0.2, 0.3, 0.15); // C5
        playTone(659.25, 'sawtooth', 0.2, 0.4, 0.15); // E5
        playTone(783.99, 'sawtooth', 0.2, 0.5, 0.15); // G5
        playTone(1046.50, 'sawtooth', 0.6, 0.6, 0.2); // C6
    } else if (type === 'lose') {
        playTone(220, 'sine', 0.2, 0, 0.12);
        playTone(196, 'sine', 0.2, 0.15, 0.12);
        playTone(146.83, 'sine', 0.4, 0.3, 0.12);
    }
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
            console.error('Error loading daily state', e);
        }
    }

    // New Day Setup
    dailyState = {
        date: todayStr,
        target: determineTarget(),
        guesses: [],
        outcome: null,
        reward: null
    };
    saveDailyState();
}

function saveDailyState() {
    localStorage.setItem(dailyStateKey, JSON.stringify(dailyState));
}

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
        maxStreak: 0,
        goldenTicketsWon: 0,
        chocolateBarsWon: 0
    };
}

function initGame() {
    currentRow = 0;
    currentCol = 0;
    currentGuess = '';
    isGameOver = false;
    gameOutcome = null;

    loadStats();
    loadDailyState();

    currentRow = dailyState.guesses.length;
    gameOutcome = dailyState.outcome;

    createBoard();
    createKeyboard();
    resetModalBindings();

    // Visual Restore if already played today
    if (gameOutcome !== null) {
        isGameOver = true;
        // Restore row letters and colors
        setTimeout(() => {
            dailyState.guesses.forEach((guess, rIndex) => {
                const colors = getRowColorsForGuess(guess, dailyState.target);
                for (let cIndex = 0; cIndex < WORD_LENGTH; cIndex++) {
                    const tile = document.getElementById(`tile-${rIndex}-${cIndex}`);
                    if (tile) {
                        tile.textContent = guess[cIndex];
                        applyColorClasses(tile, colors[cIndex], dailyState.target);
                    }
                }
            });
            
            // Re-apply special effects
            if (dailyState.reward === 'goldenticket') {
                triggerGoldenTicketVisuals(false);
            } else if (dailyState.reward === 'chocolatebar') {
                triggerChocolateVisuals(false);
            }
        }, 100);

        setTimeout(showStatsModal, 1000);
    }
}

function createBoard() {
    gridElement.innerHTML = '';
    for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let col = 0; col < WORD_LENGTH; col += 1) {
            const tile = document.createElement('div');
            tile.id = `tile-${row}-${col}`;
            tile.className = 'w-full aspect-square border-2 border-purple-800/60 rounded-xl flex items-center justify-center text-sm sm:text-2xl font-black uppercase select-none bg-purple-950/40 text-purple-100 transition-all duration-300';
            gridElement.appendChild(tile);
        }
    }
}

function createKeyboard() {
    keyboardElement.innerHTML = '';
    keyboardLayout.forEach((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'flex justify-center gap-1 sm:gap-1.5 w-full px-1';
        row.forEach((key) => {
            const keyButton = document.createElement('button');
            keyButton.textContent = key;
            keyButton.dataset.key = key;
            // Removed min-w-[24px] and instead used flex-1 with max-widths to perfectly scale and span full browser widths automatically
            keyButton.className = 'flex-1 max-w-[46px] h-11 sm:h-14 rounded-lg bg-purple-900/60 text-purple-100 font-bold shadow-md hover:bg-purple-800 transition-colors focus:outline-none active:scale-[0.98] text-xs sm:text-base border border-purple-800/40';
            if (key === 'ENTER') keyButton.className = 'flex-[1.5] max-w-[68px] h-11 sm:h-14 rounded-lg bg-purple-900/60 text-purple-100 font-bold shadow-md hover:bg-purple-800 transition-colors focus:outline-none active:scale-[0.98] text-[10px] sm:text-sm border border-purple-800/40';
            if (key === 'BACK') keyButton.className = 'flex-[1.5] max-w-[68px] h-11 sm:h-14 rounded-lg bg-purple-900/60 text-purple-100 font-bold shadow-md hover:bg-purple-800 transition-colors focus:outline-none active:scale-[0.98] text-[10px] sm:text-sm border border-purple-800/40';
            keyButton.addEventListener('click', () => handleKey(key));
            rowEl.appendChild(keyButton);
        });
        keyboardElement.appendChild(rowEl);
    });
}

function handleKey(key) {
    if (isGameOver) return;
    initAudio();

    if (key === 'ENTER') {
        if (currentGuess.length < WORD_LENGTH) {
            showToast('Not enough letters!');
            playSoundType('error');
            shakeRow(currentRow);
            return;
        }
        submitGuess();
    } else if (key === 'BACK' || key === 'BACKSPACE') {
        if (currentCol > 0) {
            currentCol -= 1;
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            tile.textContent = '';
            tile.classList.remove('border-yellow-400', 'scale-105', 'bg-purple-900/20');
            tile.classList.add('border-purple-800/60');
            currentGuess = currentGuess.slice(0, -1);
            playSoundType('type');
        }
    } else if (/^[A-Z]$/.test(key.toUpperCase())) {
        if (currentCol < WORD_LENGTH) {
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            tile.textContent = key.toUpperCase();
            tile.classList.remove('border-purple-800/60');
            tile.classList.add('border-yellow-400', 'scale-105', 'bg-purple-900/20');
            currentGuess += key.toUpperCase();
            currentCol += 1;
            playSoundType('type');
        }
    }
}

// Physical keyboard listener
window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
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

function shakeRow(row) {
    for (let col = 0; col < WORD_LENGTH; col++) {
        const tile = document.getElementById(`tile-${row}-${col}`);
        if (tile) {
            tile.classList.add('animate-shake');
            setTimeout(() => {
                tile.classList.remove('animate-shake');
            }, 500);
        }
    }
}

function showToast(message, isGold = false) {
    const toast = document.createElement('div');
    if (isGold) {
        toast.className = 'px-4 py-3 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 text-purple-950 rounded-xl shadow-2xl font-black text-sm tracking-wide border-2 border-white animate-bounce text-center';
    } else {
        toast.className = 'px-4 py-2 bg-purple-800 text-white border border-purple-600 rounded-xl shadow-lg font-bold text-sm tracking-wide animate-bounce text-center';
    }
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function getRowColorsForGuess(guess, target) {
    const colors = Array(WORD_LENGTH).fill('absent'); // 'correct', 'present', 'absent'
    const targetLetters = target.split('');
    const guessLetters = guess.split('');

    // First pass: exact matches
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessLetters[i] === targetLetters[i]) {
            colors[i] = 'correct';
            targetLetters[i] = null;
            guessLetters[i] = null;
        }
    }

    // Second pass: present matches
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessLetters[i] !== null) {
            const index = targetLetters.indexOf(guessLetters[i]);
            if (index !== -1) {
                colors[i] = 'present';
                targetLetters[index] = null;
            }
        }
    }

    return colors;
}

function applyColorClasses(tile, color, target) {
    tile.classList.remove('bg-purple-950/40', 'border-purple-800/60');
    
    if (color === 'correct') {
        if (target === 'GOLDENTICKET') {
            tile.classList.add('gold-shimmer', 'text-purple-950', 'border-yellow-300', 'shadow-[0_0_10px_rgba(253,224,71,0.5)]');
        } else {
            // Chocolatebar correct
            tile.classList.add('bg-amber-800', 'text-amber-100', 'border-amber-500');
        }
    } else if (color === 'present') {
        if (target === 'GOLDENTICKET') {
            tile.classList.add('bg-yellow-500', 'text-purple-950', 'border-yellow-400');
        } else {
            // Chocolatebar present (tan/caramel)
            tile.classList.add('bg-amber-600', 'text-white', 'border-amber-400');
        }
    } else {
        tile.classList.add('bg-zinc-800', 'text-zinc-500', 'border-zinc-700');
    }
}

function submitGuess() {
    const guess = currentGuess.toUpperCase();
    const target = dailyState.target;

    // Save guess in Daily State
    dailyState.guesses.push(guess);

    const colors = getRowColorsForGuess(guess, target);

    // Apply flip animation sequentially
    for (let col = 0; col < WORD_LENGTH; col++) {
        const tile = document.getElementById(`tile-${currentRow}-${col}`);
        setTimeout(() => {
            tile.classList.add('animate-flip');
            
            // Halfway through flip, change colors
            setTimeout(() => {
                applyColorClasses(tile, colors[col], target);
                playSoundType('reveal');
            }, 250);
        }, col * 120);
    }

    // Check game over logic after all animations complete
    const checkDelay = WORD_LENGTH * 120 + 350;
    setTimeout(() => {
        if (guess === target) {
            winGame(target);
        } else {
            currentRow += 1;
            currentCol = 0;
            currentGuess = '';
            
            if (currentRow >= MAX_ROUNDS) {
                loseGame(target);
            } else {
                saveDailyState();
            }
        }
    }, checkDelay);
}

function winGame(target) {
    isGameOver = true;
    gameOutcome = 'win';
    
    dailyState.outcome = 'win';
    dailyState.reward = target === 'GOLDENTICKET' ? 'goldenticket' : 'chocolatebar';
    saveDailyState();

    // Stats
    stats.played += 1;
    stats.wins += 1;
    stats.streak += 1;
    if (stats.streak > stats.maxStreak) {
        stats.maxStreak = stats.streak;
    }

    if (target === 'GOLDENTICKET') {
        stats.goldenTicketsWon += 1;
        saveStats();
        triggerGoldenTicketVisuals(true);
    } else {
        stats.chocolateBarsWon += 1;
        saveStats();
        triggerChocolateVisuals(true);
    }

    setTimeout(showStatsModal, 2500);
}

function loseGame(target) {
    isGameOver = true;
    gameOutcome = 'loss';
    
    dailyState.outcome = 'loss';
    saveDailyState();

    // Stats
    stats.played += 1;
    stats.streak = 0;
    saveStats();

    playSoundType('lose');
    showToast(`😭 Out of chances! Today's secret factory word was: ${target}`);

    setTimeout(showStatsModal, 2000);
}

// Celebration particle generators
function spawnFallingItems(emojis, count) {
    for (let i = 0; i < count; i++) {
        const item = document.createElement('div');
        item.className = 'falling-item text-3xl sm:text-4xl';
        item.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        item.style.left = Math.random() * 100 + 'vw';
        item.style.animationDuration = (Math.random() * 3 + 2) + 's';
        item.style.animationDelay = (Math.random() * 1.5) + 's';
        
        document.body.appendChild(item);
        
        // Clean up item after animation ends
        setTimeout(() => {
            item.remove();
        }, 5000);
    }
}

function triggerGoldenTicketVisuals(triggerSound) {
    if (triggerSound) {
        playSoundType('win_gold');
    }

    // Party flash body class
    gameBody.classList.add('animate-party-flash');

    showToast('🎫🏆 UNBELIEVABLE! YOU WON THE GOLDEN TICKET! 🎩✨', true);

    // Blast tons of golden confetti
    confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#ca8a04', '#eab308', '#fde047', '#ffffff']
    });

    // Continuously rain gold elements (tickets, coins, hats)
    const elements = ['🎫', '🪙', '🎩', '✨', '💰', '🌟'];
    spawnFallingItems(elements, 60);
    
    // Interval of confetti for grand party
    let partyInterval = setInterval(() => {
        if (!isGameOver) {
            clearInterval(partyInterval);
            return;
        }
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ca8a04', '#eab308', '#fde047']
        });
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ca8a04', '#eab308', '#fde047']
        });
    }, 1200);

    // Save interval in window so we can clear if playAgain/reload
    window.goldenPartyInterval = partyInterval;
}

function triggerChocolateVisuals(triggerSound) {
    if (triggerSound) {
        playSoundType('win_chocolate');
    }

    showToast('🍫 sweet! You guessed CHOCOLATEBAR! 🍪🍩');

    // Chocolate/brown themed confetti
    confetti({
        particleCount: 120,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#9c6644', '#7f5539', '#5c3d2e', '#4a2c11', '#ddb892']
    });

    // Rain chocolates and cookies
    const elements = ['🍫', '🍪', '🍩', '🍬', '🧁', '🤎'];
    spawnFallingItems(elements, 45);
}

// Modal and GUI logic
function updateStatsUI() {
    statPlayed.textContent = stats.played;
    const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    statWinPct.textContent = `${winPct}%`;
    statStreak.textContent = stats.streak;
    statMaxStreak.textContent = stats.maxStreak;
    statChocolate.textContent = stats.chocolateBarsWon;
    statGold.textContent = stats.goldenTicketsWon;

    // Update Status Banner style and text
    if (gameOutcome === 'win') {
        if (dailyState.reward === 'goldenticket') {
            statusBanner.className = 'p-4 rounded-xl border text-center font-bold text-lg select-none bg-yellow-950/40 border-yellow-500 text-yellow-300 text-gold-neon animate-pulse';
            statusBanner.innerHTML = '🎫 JACKPOT! You found the 1-in-1000 GOLDEN TICKET today! 🎩';
        } else {
            statusBanner.className = 'p-4 rounded-xl border text-center font-bold text-lg select-none bg-amber-950/40 border-amber-800 text-amber-200';
            statusBanner.innerHTML = '🍫 Sweet victory! You won a Chocolate Bar today.';
        }
    } else if (gameOutcome === 'loss') {
        statusBanner.className = 'p-4 rounded-xl border text-center font-bold text-lg select-none bg-purple-950/60 border-purple-800 text-purple-300';
        statusBanner.innerHTML = `🚨 You lost. Today's secret factory word was: <span class="font-black text-white text-base block tracking-wider mt-1">${dailyState.target}</span>`;
    } else {
        statusBanner.className = 'p-4 rounded-xl border text-center font-bold text-lg select-none bg-purple-950/20 border-purple-900/60 text-purple-300';
        statusBanner.innerHTML = '🎫 Use your 2 daily chances to scan the factory database.';
    }

    // Disable play again button if daily limit is reached
    if (dailyState.outcome !== null) {
        playAgainButton.disabled = true;
        playAgainButton.textContent = 'Limit reached! Back tomorrow!';
        playAgainButton.className = 'px-5 py-2.5 bg-purple-950/40 border border-purple-900/50 text-purple-500 rounded-xl font-bold cursor-not-allowed text-xs';
    } else {
        playAgainButton.disabled = false;
        playAgainButton.textContent = 'Keep Guessing';
        playAgainButton.className = 'px-5 py-2.5 bg-purple-950 border border-purple-700 hover:bg-purple-800 font-bold text-yellow-400 rounded-xl transition-all text-xs';
    }
}

function showStatsModal() {
    updateStatsUI();
    statsModal.classList.remove('hidden');
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
    document.querySelectorAll('.modal-close').forEach((btn) => {
        btn.addEventListener('click', () => {
            hideHelpModal();
            hideStatsModal();
        });
    });

    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) hideHelpModal();
    });
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) hideStatsModal();
    });
}

// Setup triggers
document.getElementById('btn-help').addEventListener('click', showHelpModal);
document.getElementById('btn-stats').addEventListener('click', showStatsModal);

resetStatsButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all GOLDENTICKETLE factory statistics?')) {
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
});

// Share button handling
shareButton.addEventListener('click', () => {
    if (!gameOutcome) {
        showToast('Finish today\'s game to share your factory results!');
        return;
    }

    let titleText = '';
    let prizeMessage = '';
    let gridEmojis = '';

    const target = dailyState.target;
    
    // Construct Emojis grid
    dailyState.guesses.forEach((guess, rIdx) => {
        const colors = getRowColorsForGuess(guess, target);
        colors.forEach((colColor) => {
            if (colColor === 'correct') {
                gridEmojis += target === 'GOLDENTICKET' ? '🟨' : '🟫';
            } else if (colColor === 'present') {
                gridEmojis += '🟧';
            } else {
                gridEmojis += '🟪'; // Purple theme for missed letters
            }
        });
        gridEmojis += ` (${guess === target ? rIdx+1 : 'X'}/2)\n`;
    });

    if (gameOutcome === 'win') {
        if (target === 'GOLDENTICKET') {
            titleText = '🎫 GOLDENTICKETLE - JACKPOT! 🎫';
            prizeMessage = `OMGGGG! I won the factory's Golden Ticket! (1 in 1000 chance today!). Current Streak: ${stats.streak}`;
        } else {
            titleText = '🍫 GOLDENTICKETLE - WIN! 🍫';
            prizeMessage = `Sweet! I successfully scanned the factory and won a Chocolate Bar. Current Streak: ${stats.streak}`;
        }
    } else {
        titleText = '💥 GOLDENTICKETLE - LOST 💥';
        prizeMessage = `The database locked me out. No prizes today. Current Streak: ${stats.streak}`;
    }

    const shareText = `${titleText}\n\n${gridEmojis}\n${prizeMessage}\n\nhttps://lolword.com/games/goldenticketle/`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            showToast('Factory results copied to clipboard!');
        }).catch((err) => {
            console.error('Clipboard copy failed', err);
            showToast('Failed to copy results.');
        });
    } else {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Factory results copied to clipboard!');
        } catch (e) {
            showToast('Could not copy automatically.');
        }
        document.body.removeChild(textArea);
    }
});

// Auto-show help modal on first visit
const visitedKey = 'goldenticketle_visited';
if (!localStorage.getItem(visitedKey)) {
    localStorage.setItem(visitedKey, 'true');
    showHelpModal();
}

// Run init
initGame();
