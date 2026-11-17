import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';
import { UI } from './ui/UIState.js';

const BACKUP_MAX_DEPTH = 20;
const BACKUP_UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const BACKUP_TAB_ID = 'ig-tab-backup';
const BACKUP_POPUP_ID = 'ig-backup-popup';

const ACCOUNT_DATA_KEY_BASES = [
    CONFIG.STORAGE_KEY,
    CONFIG.WHITELIST_KEY,
    CONFIG.HISTORY_KEY,
    CONFIG.CHURN_KEY,
    CONFIG.DEACTIVATED_KEY,
    CONFIG.BLOCKED_KEY,
    CONFIG.RENAMED_KEY,
    CONFIG.NEW_FOLLOWERS_KEY,
    CONFIG.TARGET_TRACKER_KEY,
    CONFIG.STORY_ANOMALY_KEY,
    CONFIG.STORY_OBS_KEY
];

const GLOBAL_UI_KEY_BASES = [
    CONFIG.POSITION_KEY,
    CONFIG.TARGET_SUBPANEL_POSITION_KEY,
    CONFIG.TOUR_KEY
];

const LEGACY_FLAT_KEYS = [
    'followers',
    'following',
    'followersDetailed',
    'followingDetailed',
    'notFollowingBackDetailed',
    'fansDetailed',
    'mutualsDetailed',
    'newFollowers',
    'newFollowersDetailed',
    'whitelist',
    'targetTracker',
    'unfollowers',
    'deactivated',
    'blocked',
    'renamed',
    'history'
];

let backupStatusNode = null;
let backupFileInputNode = null;
let backupPopupNode = null;
let backupTabButtonNode = null;

const getScriptMetadata = () => {
    const scriptInfo = typeof GM_info !== 'undefined' ? GM_info?.script : null;

    return {
        scriptId: CONFIG.SCRIPT_ID,
        scriptName: scriptInfo?.name || CONFIG.SCRIPT_NAME,
        scriptVersion: scriptInfo?.version || '0.0.0'
    };
};

const setBackupStatus = (message, kind = 'info') => {
    if (backupStatusNode) {
        backupStatusNode.dataset.state = kind;
        backupStatusNode.textContent = message;
    }

    if (kind === 'error') {
        Utils.logError(message, null);
        return;
    }

    Utils.log(message);
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const isSafeJsonValue = (value, depth = 0) => {
    if (depth > BACKUP_MAX_DEPTH) return false;
    if (value === null) return true;

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'boolean') return true;
    if (valueType === 'number') return Number.isFinite(value);

    if (Array.isArray(value)) {
        return value.every((item) => isSafeJsonValue(item, depth + 1));
    }

    if (!isPlainObject(value)) {
        return false;
    }

    return Object.entries(value).every(([key, entryValue]) => {
        if (typeof key !== 'string' || BACKUP_UNSAFE_KEYS.has(key)) return false;
        return isSafeJsonValue(entryValue, depth + 1);
    });
};

const isSafeStorageKey = (key) => typeof key === 'string' && key.length > 0 && !BACKUP_UNSAFE_KEYS.has(key);

const ALLOWED_BACKUP_KEY_BASES = [
    ...ACCOUNT_DATA_KEY_BASES,
    ...GLOBAL_UI_KEY_BASES,
    ...LEGACY_FLAT_KEYS
];

const isAuthorizedBackupKey = (key) => {
    if (!isSafeStorageKey(key)) return false;
    return ALLOWED_BACKUP_KEY_BASES.some((base) => {
        if (key === base) return true;
        if (key.startsWith(base + '_')) {
            const suffix = key.slice(base.length + 1);
            return /^[0-9]+$/.test(suffix);
        }
        return false;
    });
};

const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The backup file could not be read.'));
    reader.readAsText(file);
});

const getCurrentStorageKeys = async () => {
    if (typeof GM_listValues !== 'function') {
        throw new Error('The GM_listValues API is not available in this environment.');
    }

    const keys = await Promise.resolve(GM_listValues());
    return Array.isArray(keys) ? keys.filter(isSafeStorageKey) : [];
};

const getStoredValue = async (key) => Promise.resolve(GM_getValue(key));

const createDownload = (filename, content) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const buildBackupFilename = () => {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
    return `${CONFIG.SCRIPT_ID}-backup-${timestamp}.json`;
};

const writeBackupStatus = (message, kind = 'info') => {
    setBackupStatus(message, kind);
};

const createSvgElement = (tagName, attributes = {}) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(attributes).forEach(([name, value]) => {
        element.setAttribute(name, value);
    });
    return element;
};

const createBackupIcon = () => {
    const svg = createSvgElement('svg', {
        viewBox: '0 0 32 32',
        fill: 'currentColor',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
        focusable: 'false'
    });

    const group = createSvgElement('g', {
        transform: 'translate(-152 -515)',
        fill: 'currentColor'
    });

    const path = createSvgElement('path', {
        d: 'M171,525 C171.552,525 172,524.553 172,524 L172,520 C172,519.447 171.552,519 171,519 C170.448,519 170,519.447 170,520 L170,524 C170,524.553 170.448,525 171,525 L171,525 Z M182,543 C182,544.104 181.104,545 180,545 L156,545 C154.896,545 154,544.104 154,543 L154,519 C154,517.896 154.896,517 156,517 L158,517 L158,527 C158,528.104 158.896,529 160,529 L176,529 C177.104,529 178,528.104 178,527 L178,517 L180,517 C181.104,517 182,517.896 182,519 L182,543 L182,543 Z M160,517 L176,517 L176,526 C176,526.553 175.552,527 175,527 L161,527 C160.448,527 160,526.553 160,526 L160,517 L160,517 Z M180,515 L156,515 C153.791,515 152,516.791 152,519 L152,543 C152,545.209 153.791,547 156,547 L180,547 C182.209,547 184,545.209 184,543 L184,519 C184,516.791 182.209,515 180,515 L180,515 Z'
    });

    group.appendChild(path);
    svg.appendChild(group);

    return svg;
};

const createCloseIcon = () => {
    const svg = createSvgElement('svg', {
        viewBox: '0 0 24 24',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        stroke: 'currentColor',
        'aria-hidden': 'true',
        focusable: 'false'
    });

    const group = createSvgElement('g', {
        id: 'SVGRepo_iconCarrier'
    });

    const bgCarrier = createSvgElement('g', {
        id: 'SVGRepo_bgCarrier',
        'stroke-width': '0'
    });

    const tracerCarrier = createSvgElement('g', {
        id: 'SVGRepo_tracerCarrier',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
    });

    const innerGroup = createSvgElement('g', {
        id: 'Menu / Close_LG'
    });

    const path = createSvgElement('path', {
        id: 'Vector',
        d: 'M21 21L12 12M12 12L3 3M12 12L21.0001 3M12 12L3 21.0001',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
    });

    group.appendChild(bgCarrier);
    group.appendChild(tracerCarrier);
    innerGroup.appendChild(path);
    group.appendChild(innerGroup);
    svg.appendChild(group);

    return svg;
};

const ensureBackupPopup = () => {
    if (backupPopupNode) return backupPopupNode;

    const overlay = document.createElement('div');
    overlay.id = BACKUP_POPUP_ID;
    overlay.className = 'ig-backup-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'ig-backup-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'ig-backup-title');

    const header = document.createElement('div');
    header.className = 'ig-backup-dialog-header';

    const heading = document.createElement('div');
    heading.id = 'ig-backup-title';
    heading.className = 'ig-backup-dialog-title';
    heading.textContent = 'Backup';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'ig-backup-close-btn';
    closeButton.setAttribute('aria-label', 'Close backup popup');
    closeButton.title = 'Close';
    closeButton.appendChild(createCloseIcon());
    closeButton.addEventListener('click', () => {
        hideBackupPopup();
    });

    const description = document.createElement('p');
    description.className = 'ig-backup-dialog-description';
    description.textContent = 'Export or import the current script state as a local JSON backup.';

    const actions = document.createElement('div');
    actions.className = 'ig-backup-dialog-actions';

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'ig-btn ig-backup-btn ig-backup-btn-export';
    exportButton.textContent = 'Export Backup';
    exportButton.addEventListener('click', () => {
        exportBackup().catch(() => {
        });
    });

    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.className = 'ig-btn ig-backup-btn ig-backup-btn-import';
    importButton.textContent = 'Import Backup';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.className = 'ig-backup-file-input';
    fileInput.tabIndex = -1;

    const status = document.createElement('div');
    status.id = 'ig-backup-status';
    status.className = 'ig-backup-status';
    status.textContent = 'Backups are stored only in this browser.';

    importButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
        const selectedFile = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
        if (!selectedFile) return;
        await importBackup(selectedFile);
    });

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            hideBackupPopup();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
            hideBackupPopup();
        }
    });

    header.appendChild(heading);
    header.appendChild(closeButton);
    actions.appendChild(exportButton);
    actions.appendChild(importButton);
    dialog.appendChild(header);
    dialog.appendChild(description);
    dialog.appendChild(actions);
    dialog.appendChild(status);
    dialog.appendChild(fileInput);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    backupPopupNode = overlay;
    backupFileInputNode = fileInput;
    backupStatusNode = status;

    return backupPopupNode;
};

export const openBackupPopup = () => {
    const popup = ensureBackupPopup();
    if (typeof UI.applyCurrentTheme === 'function') {
        UI.applyCurrentTheme();
    } else {
        const panel = document.getElementById('ig-analyzer-panel');
        if (panel?.classList.contains('ig-light-theme')) {
            popup.classList.add('ig-light-theme');
        } else {
            popup.classList.remove('ig-light-theme');
        }
    }
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
};

export const hideBackupPopup = () => {
    if (!backupPopupNode) return;
    backupPopupNode.classList.remove('is-open');
    backupPopupNode.setAttribute('aria-hidden', 'true');
};

export const toggleBackupPopup = () => {
    if (!backupPopupNode || !backupPopupNode.classList.contains('is-open')) {
        openBackupPopup();
        return;
    }

    hideBackupPopup();
};

/**
 * Validates the structure and compatibility of a JSON backup (backward-compatible with schema v1 and v2).
 * @param {unknown} payload
 * @returns {{ valid: true, payload: { meta: Record<string, unknown>, data: Record<string, unknown> } } | { valid: false, reason: string }}
 */
export const validateBackupSchema = (payload) => {
    if (!isPlainObject(payload)) {
        return { valid: false, reason: 'The file does not contain a valid JSON object.' };
    }

    const meta = payload.meta;
    const data = payload.data;

    if (!isPlainObject(meta)) {
        return { valid: false, reason: 'The backup metadata block is missing.' };
    }

    if (!isPlainObject(data)) {
        return { valid: false, reason: 'The backup data block is missing.' };
    }

    const maxSupportedSchema = CONFIG.BACKUP_SCHEMA_VERSION;
    if (
        typeof meta.schemaVersion !== 'number' ||
        !Number.isInteger(meta.schemaVersion) ||
        meta.schemaVersion < 1 ||
        meta.schemaVersion > maxSupportedSchema
    ) {
        return {
            valid: false,
            reason: `The schema version is not compatible. Supported versions: 1..${maxSupportedSchema}.`
        };
    }

    if (typeof meta.scriptId !== 'string' || meta.scriptId !== CONFIG.SCRIPT_ID) {
        return { valid: false, reason: 'The backup does not belong to this script.' };
    }

    if (typeof meta.scriptName !== 'string' || typeof meta.scriptVersion !== 'string') {
        return { valid: false, reason: 'The backup metadata is incomplete.' };
    }

    if (typeof meta.exportedAt !== 'string' || Number.isNaN(Date.parse(meta.exportedAt))) {
        return { valid: false, reason: 'The export timestamp is invalid.' };
    }

    if (meta.ownerUserId !== undefined && meta.ownerUserId !== null && typeof meta.ownerUserId !== 'string') {
        return { valid: false, reason: 'The backup ownerUserId field is invalid.' };
    }

    if (meta.ownerUsername !== undefined && meta.ownerUsername !== null && typeof meta.ownerUsername !== 'string') {
        return { valid: false, reason: 'The backup ownerUsername field is invalid.' };
    }

    const dataEntries = Object.entries(data);
    if (typeof meta.keyCount === 'number' && meta.keyCount !== dataEntries.length) {
        return { valid: false, reason: 'The backup appears to be corrupted or truncated.' };
    }

    for (const [key, value] of dataEntries) {
        if (!isAuthorizedBackupKey(key)) {
            return { valid: false, reason: `The key "${key}" is not recognized or authorized for this script.` };
        }

        if (!isSafeJsonValue(value)) {
            return { valid: false, reason: `The key "${key}" contains unsupported values.` };
        }
    }

    return {
        valid: true,
        payload: {
            meta,
            data
        }
    };
};

/**
 * Exports all authorized values stored by Tampermonkey into a schema v2 JSON file.
 * @returns {Promise<{ meta: Record<string, unknown>, data: Record<string, unknown> }>}
 */
export const exportBackup = async () => {
    try {
        const listedKeys = await getCurrentStorageKeys().catch(() => []);
        const currentId = Storage.getCurrentUserId() || Utils.getUserId();
        const currentUsername = Utils.getUsername() || null;

        const allKeys = new Set(listedKeys.filter(isAuthorizedBackupKey));
        GLOBAL_UI_KEY_BASES.forEach((gk) => allKeys.add(gk));
        ACCOUNT_DATA_KEY_BASES.forEach((bk) => {
            if (currentId) {
                allKeys.add(`${bk}_${currentId}`);
            } else {
                allKeys.add(bk);
            }
        });

        const data = Object.create(null);
        for (const key of allKeys) {
            if (!isAuthorizedBackupKey(key)) continue;
            // When an active account ID exists, avoid exporting duplicate unscoped audience keys if scoped key is present
            if (currentId && ACCOUNT_DATA_KEY_BASES.includes(key)) {
                const scopedCandidate = await getStoredValue(`${key}_${currentId}`);
                if (scopedCandidate !== undefined && scopedCandidate !== null) {
                    continue;
                }
            }
            const val = await getStoredValue(key);
            if (val !== undefined && val !== null) {
                data[key] = val;
            }
        }

        const metadata = getScriptMetadata();
        const payload = {
            meta: {
                scriptId: metadata.scriptId,
                scriptName: metadata.scriptName,
                scriptVersion: metadata.scriptVersion,
                schemaVersion: CONFIG.BACKUP_SCHEMA_VERSION,
                ownerUserId: currentId ? String(currentId) : null,
                ownerUsername: currentUsername || null,
                exportedAt: Utils.now(),
                keyCount: Object.keys(data).length
            },
            data
        };

        const filename = buildBackupFilename();
        createDownload(filename, JSON.stringify(payload, null, 2));
        writeBackupStatus(`Backup exported: ${filename}`, 'success');

        return payload;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'The backup could not be exported.';
        writeBackupStatus(message, 'error');
        throw error;
    }
};

const clearTargetAccountStorage = async (targetUserId = null) => {
    if (typeof GM_deleteValue !== 'function') {
        throw new Error('The GM_deleteValue API is not available in this environment.');
    }

    const currentKeys = await getCurrentStorageKeys();
    const idStr = targetUserId ? String(targetUserId) : null;

    for (const key of currentKeys) {
        if (!isAuthorizedBackupKey(key)) continue;
        if (GLOBAL_UI_KEY_BASES.includes(key) || LEGACY_FLAT_KEYS.includes(key)) {
            GM_deleteValue(key);
            continue;
        }
        if (ACCOUNT_DATA_KEY_BASES.includes(key)) {
            // Remove orphan unscoped legacy keys so they cannot pollute multi-account sessions
            GM_deleteValue(key);
            continue;
        }
        if (idStr && key.endsWith(`_${idStr}`)) {
            GM_deleteValue(key);
            continue;
        }
        if (!idStr) {
            GM_deleteValue(key);
        }
    }
};

const promptBackupConfirmation = async (meta, currentUserId, isAccountMismatch) => {
    const safetyModal = typeof document !== 'undefined' ? document.getElementById('ig-safety-modal') : null;
    if (safetyModal && typeof UI.confirmAction === 'function') {
        const ownerLine = meta.ownerUsername
            ? `@${Utils.escapeHtml(String(meta.ownerUsername))}${meta.ownerUserId ? ` (${Utils.escapeHtml(String(meta.ownerUserId))})` : ''}`
            : (meta.ownerUserId ? `ID ${Utils.escapeHtml(String(meta.ownerUserId))}` : 'Legacy v1 Backup');
        const mismatchWarning = isAccountMismatch
            ? `<div style="margin-top:10px; padding:8px 10px; border-radius:8px; background:var(--iga-warning-subtle); border:1px solid var(--iga-border); color:var(--iga-warning); font-size:11.5px; text-align:left;"><b>Account Notice:</b> This backup was exported from <b>${ownerLine}</b>, which differs from your active account (<b>${Utils.escapeHtml(String(currentUserId))}</b>). Importing will restore this data into your active account without deleting other saved accounts.</div>`
            : '';
        const htmlMsg = [
            '<div style="text-align:left; font-size:12.5px; line-height:1.55;">',
            '  <div style="margin-bottom:8px;">This backup will overwrite the data for your active Instagram session:</div>',
            `  <div><b>Script:</b> ${Utils.escapeHtml(String(meta.scriptName))} (${Utils.escapeHtml(String(meta.scriptVersion))})</div>`,
            `  <div><b>Source Account:</b> ${ownerLine}</div>`,
            `  <div><b>Exported At:</b> ${Utils.escapeHtml(Utils.formatDate(String(meta.exportedAt)))}</div>`,
            mismatchWarning,
            '</div>'
        ].join('\n');

        return UI.confirmAction('Restore Backup', htmlMsg, 'Import Backup', true);
    }

    const lines = [
        'This backup will overwrite the current account data.',
        '',
        `Script: ${meta.scriptName}`,
        `Version: ${meta.scriptVersion}`,
        `Exported at: ${meta.exportedAt}`
    ];
    if (isAccountMismatch) {
        lines.push(`Warning: Backup owner (${meta.ownerUserId}) differs from active account (${currentUserId}).`);
    }
    lines.push('', 'Do you want to continue?');

    return typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(lines.join('\n'))
        : true;
};

/**
 * Imports a JSON backup (v1 or v2), validates it, and restores account-scoped state without cross-account pollution.
 * @param {File} file
 * @returns {Promise<boolean>}
 */
export const importBackup = async (file) => {
    if (!(file instanceof File)) {
        writeBackupStatus('Select a valid .json file.', 'error');
        return false;
    }

    try {
        const fileText = await readFileAsText(file);
        let parsedPayload;

        try {
            parsedPayload = JSON.parse(fileText);
        } catch {
            throw new Error('The file is corrupted or does not contain valid JSON.');
        }

        const validation = validateBackupSchema(parsedPayload);
        if (!validation.valid) {
            throw new Error(validation.reason);
        }

        const { meta, data } = validation.payload;
        const currentUserId = Storage.getCurrentUserId() || Utils.getUserId();
        const backupOwnerId = (typeof meta.ownerUserId === 'string' && meta.ownerUserId.trim())
            ? meta.ownerUserId.trim()
            : null;
        const isAccountMismatch = Boolean(currentUserId && backupOwnerId && String(currentUserId) !== String(backupOwnerId));

        const confirmed = await promptBackupConfirmation(meta, currentUserId, isAccountMismatch);
        if (!confirmed) {
            writeBackupStatus('Import canceled by the user.', 'info');
            return false;
        }

        await clearTargetAccountStorage(currentUserId);

        // 1. Write global UI keys and (when not remapping across mismatched accounts) explicit scoped keys
        for (const [key, value] of Object.entries(data)) {
            if (GLOBAL_UI_KEY_BASES.includes(key)) {
                GM_setValue(key, value);
                continue;
            }
            if (LEGACY_FLAT_KEYS.includes(key)) {
                continue;
            }
            if (ACCOUNT_DATA_KEY_BASES.includes(key)) {
                // Only write unscoped audience keys when no currentUserId is available
                if (!currentUserId) {
                    GM_setValue(key, value);
                }
                continue;
            }
            // Key is of form `${base}_${someId}`
            if (!isAccountMismatch || (currentUserId && key.endsWith(`_${currentUserId}`))) {
                GM_setValue(key, value);
            }
        }

        // 2. Resolve & sync the snapshot for the active account
        const pickBackupValueForBase = (baseKey) => {
            if (currentUserId && data[`${baseKey}_${currentUserId}`] !== undefined) {
                return data[`${baseKey}_${currentUserId}`];
            }
            if (backupOwnerId && data[`${baseKey}_${backupOwnerId}`] !== undefined) {
                return data[`${baseKey}_${backupOwnerId}`];
            }
            if (data[baseKey] !== undefined) {
                return data[baseKey];
            }
            const anyKey = Object.keys(data).find((k) => k.startsWith(`${baseKey}_`));
            if (anyKey && data[anyKey] !== undefined) {
                return data[anyKey];
            }
            return undefined;
        };

        let restoredSnapshot = pickBackupValueForBase(CONFIG.STORAGE_KEY);
        if (!isPlainObject(restoredSnapshot)) {
            restoredSnapshot = null;
        }

        // Fallback for legacy flat export formats
        if (!restoredSnapshot && Array.isArray(data.followers)) {
            restoredSnapshot = {
                version: 4,
                lastRun: meta.exportedAt || Utils.now(),
                followers: data.followers || [],
                following: data.following || [],
                followersDetailed: data.followersDetailed || [],
                followingDetailed: data.followingDetailed || [],
                notFollowingBackDetailed: data.notFollowingBackDetailed || [],
                fansDetailed: data.fansDetailed || [],
                mutualsDetailed: data.mutualsDetailed || [],
                unfollowers: Array.isArray(data.unfollowers) ? data.unfollowers : [],
                deactivated: Array.isArray(data.deactivated) ? data.deactivated : [],
                blocked: Array.isArray(data.blocked) ? data.blocked : [],
                renamed: Array.isArray(data.renamed) ? data.renamed : [],
                history: Array.isArray(data.history) ? data.history : []
            };
        }

        if (restoredSnapshot) {
            if (currentUserId) {
                Storage.save(restoredSnapshot, currentUserId);
                if (typeof GM_deleteValue === 'function') {
                    GM_deleteValue(CONFIG.STORAGE_KEY);
                }
            } else {
                GM_setValue(CONFIG.STORAGE_KEY, restoredSnapshot);
            }
        }

        // 3. Sync all auxiliary account-scoped keys cleanly to currentUserId (never leaving unscoped copies)
        const legacyFlatFallbackMap = {
            [CONFIG.HISTORY_KEY]: data.history,
            [CONFIG.WHITELIST_KEY]: data.whitelist,
            [CONFIG.CHURN_KEY]: data.unfollowers,
            [CONFIG.DEACTIVATED_KEY]: data.deactivated,
            [CONFIG.BLOCKED_KEY]: data.blocked,
            [CONFIG.RENAMED_KEY]: data.renamed,
            [CONFIG.NEW_FOLLOWERS_KEY]: data.newFollowersDetailed || data.newFollowers,
            [CONFIG.TARGET_TRACKER_KEY]: data.targetTracker
        };

        ACCOUNT_DATA_KEY_BASES.forEach((baseKey) => {
            if (baseKey === CONFIG.STORAGE_KEY) return;
            let val = pickBackupValueForBase(baseKey);
            if (val === undefined && legacyFlatFallbackMap[baseKey] !== undefined) {
                val = legacyFlatFallbackMap[baseKey];
            }
            if (val !== undefined && val !== null) {
                if (currentUserId) {
                    Storage.setScopedValue(baseKey, val, currentUserId);
                } else {
                    GM_setValue(baseKey, val);
                }
            }
            if (currentUserId && typeof GM_deleteValue === 'function') {
                GM_deleteValue(baseKey);
            }
        });

        // 4. Sync global UI keys
        GLOBAL_UI_KEY_BASES.forEach((globalKey) => {
            const val = pickBackupValueForBase(globalKey);
            if (val !== undefined && val !== null) {
                GM_setValue(globalKey, val);
            }
        });

        writeBackupStatus('Backup restored successfully. Reloading the interface...', 'success');
        window.setTimeout(() => window.location.reload(), 400);
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'The backup could not be imported.';
        writeBackupStatus(message, 'error');
        const safetyModal = typeof document !== 'undefined' ? document.getElementById('ig-safety-modal') : null;
        if (safetyModal && typeof UI.confirmAction === 'function') {
            await UI.confirmAction('Backup Import Error', Utils.escapeHtml(message), 'Close', false);
        } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(`Backup import error:\n\n${message}`);
        }
        return false;
    } finally {
        if (backupFileInputNode) {
            backupFileInputNode.value = '';
        }
    }
};

/**
 * Creates the backup export and import controls inside the panel.
 * @param {HTMLElement | null} hostElement
 * @returns {HTMLElement | null}
 */
export const createBackupUI = (hostElement = document.getElementById('ig-analyzer-panel')) => {
    if (!(hostElement instanceof HTMLElement)) {
        return null;
    }

    if (!backupTabButtonNode) {
        const tabsContainer = hostElement.querySelector('#ig-tabs');
        if (!tabsContainer) {
            return null;
        }

        const backupButton = document.createElement('button');
        backupButton.type = 'button';
        backupButton.id = BACKUP_TAB_ID;
        backupButton.className = 'ig-tab-btn ig-backup-tab-btn';
        backupButton.addEventListener('click', () => {
            backupButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            toggleBackupPopup();
        });

        const iconHolder = document.createElement('span');
        iconHolder.className = 'ig-tab-icon ig-backup-tab-icon';
        iconHolder.appendChild(createBackupIcon());

        const label = document.createElement('span');
        label.className = 'ig-tab-label';
        label.textContent = 'Backup';

        backupButton.appendChild(iconHolder);
        backupButton.appendChild(label);
        tabsContainer.appendChild(backupButton);
        backupTabButtonNode = backupButton;
    }

    ensureBackupPopup();

    return backupTabButtonNode;
};