/* Keep header fullscreen independent of optional theme widgets. */
(function () {
    'use strict';
    const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    function sync() {
        const full = active();
        document.querySelectorAll('.full-screen-open').forEach(icon => {
            icon.classList.toggle('d-none', full);
            icon.classList.remove('d-block');
        });
        document.querySelectorAll('.full-screen-close').forEach(icon => {
            icon.classList.toggle('d-none', !full);
            icon.classList.remove('d-block');
        });
        document.querySelectorAll('.header-fullscreen .header-link').forEach(link => {
            link.setAttribute('aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen');
            link.setAttribute('title', full ? 'Exit fullscreen' : 'Enter fullscreen');
        });
    }
    window.openFullscreen = async function () {
        try {
            if (active()) {
                const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
                if (exit) await exit.call(document);
            } else {
                const element = document.documentElement;
                const enter = element.requestFullscreen || element.webkitRequestFullscreen || element.msRequestFullscreen;
                if (enter) await enter.call(element);
            }
        } catch (error) {
            console.warn('Fullscreen could not be changed:', error.message);
        }
        sync();
    };
    ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'].forEach(event => document.addEventListener(event, sync));
    sync();
})();
