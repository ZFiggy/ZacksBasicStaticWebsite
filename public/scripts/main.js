class Main {
    constructor() {
        this.pageViewsKey = 'pageViewsCount';
        let count = 0;
        try {
            const stored = Number(localStorage.getItem(this.pageViewsKey));
            if (Number.isSafeInteger(stored) && stored >= 0) count = stored;
            count = Math.min(count + 1, Number.MAX_SAFE_INTEGER);
            localStorage.setItem(this.pageViewsKey, count.toString());
        } catch {
            count = Math.max(count, 1);
            document.getElementById('count').title = 'Browser storage is unavailable; visits cannot be saved.';
        }
        document.getElementById('count').textContent = count.toLocaleString();
    }
}

document.mainClass = new Main();
