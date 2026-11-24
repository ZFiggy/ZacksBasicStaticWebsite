(() => {
    const themeKey = 'siteTheme';
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    let preference = null;

    try {
        const saved = localStorage.getItem(themeKey);
        if (saved === 'light' || saved === 'dark') preference = saved;
    } catch {
        // The toggle still works for this page if storage is blocked.
    }

    function applyTheme() {
        const theme = preference || (systemTheme.matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = theme;
        const button = document.getElementById('theme-toggle');
        if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
    }

    applyTheme();
    document.addEventListener('DOMContentLoaded', () => {
        applyTheme();
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(themeKey, preference);
            } catch {
                // Keep the selected theme in memory for the current page.
            }
            applyTheme();
        });
    });
    systemTheme.addEventListener('change', () => {
        if (!preference) applyTheme();
    });
    window.addEventListener('storage', (event) => {
        if (event.key === themeKey || event.key === null) {
            preference = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
            applyTheme();
        }
    });
})();
