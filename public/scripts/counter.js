const clickCountKey = 'clickCount';
let clickCount = 0;
const countDisplay = document.getElementById('click-count');
const incrementButton = document.getElementById('increment');
const saveStatus = document.getElementById('save-status');
const touchdownStage = document.getElementById('touchdown-stage');
const touchdownStatus = document.getElementById('touchdown-status');
let pendingTouchdowns = 0;
let celebrating = false;

function celebrateTouchdown() {
    if (celebrating || pendingTouchdowns === 0) return;
    celebrating = true;
    pendingTouchdowns--;
    touchdownStage.classList.remove('is-playing', 'reduced-celebration');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Restart the pass even when two milestones are reached in quick succession.
    void touchdownStage.offsetWidth;
    touchdownStage.classList.add(reducedMotion ? 'reduced-celebration' : 'is-playing');
    touchdownStatus.textContent = `Touchdown! ${window.teamArcade.team.nickname} captain to the end zone. ${window.teamArcade.team.motto}`;
    window.setTimeout(() => {
        touchdownStage.classList.remove('is-playing', 'reduced-celebration');
        celebrating = false;
        touchdownStatus.textContent = 'Every 7 clicks unlocks a touchdown pass.';
        celebrateTouchdown();
    }, reducedMotion ? 1200 : 2800);
}

function parseCount(value) {
    const count = Number(value);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function displayCount() {
    countDisplay.textContent = clickCount.toLocaleString();
    countDisplay.style.setProperty('--count-length', countDisplay.textContent.length);
    incrementButton.disabled = clickCount >= Number.MAX_SAFE_INTEGER;
    document.getElementById('touchdown-count').textContent = Math.floor(clickCount / 7).toLocaleString();
    const remaining = 7 - clickCount % 7;
    document.getElementById('next-touchdown').textContent = `${remaining} ${remaining === 1 ? 'CLICK' : 'CLICKS'} TO TD`;
    document.querySelectorAll('.drive-progress i').forEach((segment, index) => {
        segment.classList.toggle('is-filled', index < clickCount % 7);
    });
    document.dispatchEvent(new CustomEvent('counter:change', { detail: { count: clickCount } }));
}

function showStorageError() {
    saveStatus.textContent = 'Browser storage is unavailable. Clicks will only last for this page session.';
}

try {
    clickCount = parseCount(window.teamArcade.storage.getItem(clickCountKey));
    window.teamArcade.storage.setItem(clickCountKey, clickCount.toString());
} catch {
    showStorageError();
}

displayCount();

// The shared board can restore a higher saved total without replaying old touchdowns.
window.eaglesCounter = {
    getCount: () => clickCount,
    restoreCount(value) {
        const restored = parseCount(value);
        if (restored <= clickCount) return;
        clickCount = restored;
        displayCount();
        try {
            window.teamArcade.storage.setItem(clickCountKey, clickCount.toString());
        } catch {
            showStorageError();
        }
        document.dispatchEvent(new Event('arcade:progress'));
    }
};

incrementButton.addEventListener('click', () => {
    if (clickCount >= Number.MAX_SAFE_INTEGER) return;

    try {
        // Include clicks made in another tab before incrementing.
        clickCount = Math.max(clickCount, parseCount(window.teamArcade.storage.getItem(clickCountKey)));
    } catch {
        showStorageError();
    }

    if (clickCount < Number.MAX_SAFE_INTEGER) clickCount++;
    displayCount();
    if (clickCount % 7 === 0) {
        pendingTouchdowns++;
        celebrateTouchdown();
    }

    try {
        window.teamArcade.storage.setItem(clickCountKey, clickCount.toString());
        saveStatus.textContent = 'Saved on this browser. Come back anytime.';
    } catch {
        showStorageError();
    }
    document.dispatchEvent(new Event('arcade:progress'));
});

window.addEventListener('storage', (event) => {
    if (event.key === window.teamArcade.keyFor(clickCountKey) || event.key === null) {
        clickCount = parseCount(event.newValue);
        displayCount();
    }
});
