import { CONFIG } from './Config.js';

export const Utils = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => (new Date()).toISOString(),
    log: (msg) => console.log(`[IG Analyzer] ${msg}`),
    logError: (msg, err) => console.error(`[IG Analyzer Error] ${msg}`, err),
    getUserId: () => {
        const c = document.cookie.split("; ").find((x) => x.startsWith("ds_user_id="));
        return c ? c.split("=")[1] : null;
    },
    diff: (a, b) => {
        const setB = new Set(b);
        return a.filter((x) => !setB.has(x));
    },
    intersection: (a, b) => {
        const setB = new Set(b);
        return a.filter((x) => setB.has(x));
    },
    exportCSV: (data, filename) => {
        if (!data || !data.length) return;
        const csvContent = "Username,Profile URL\n" + data.map((u) => u.username + "," + u.url).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};