/* Compatibility loader. All quantity operations live in production-engine.js. */
(async function () {
    "use strict";
    const config = window.ADDITIONAL_WORK_CONFIG || {};
    const scripts = { "Embroidery": ["embroidery", "addWork_embroidery"], "Digital Print": ["digital-print", "addWork_digital_print"],
        "Screen Print": ["screen-print", "addWork_screen_print"], "Hand Work": ["handwork", "addWork_hand_work"], "Peco": ["peco", "addWork_peco"] };
    const selected = scripts[config.workType];
    if (!selected || (config.storageKey && config.storageKey !== selected[1])) throw new Error("Unknown additional-work configuration.");
    const base = new URL(".", document.currentScript.src);
    async function load(name) {
        const src = new URL(name + ".js", base).href;
        if ([...document.scripts].some(script => script.src === src)) return;
        await new Promise((resolve,reject) => { const script=document.createElement("script");script.src=src;script.onload=resolve;script.onerror=reject;document.head.appendChild(script); });
    }
    await load("production-engine"); await load("production-controls"); await load(selected[0]);
})();
