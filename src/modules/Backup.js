import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';

const BACKUP_MAX_DEPTH = 20;
const BACKUP_UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const BACKUP_TAB_ID = 'ig-tab-backup';
const BACKUP_POPUP_ID = 'ig-backup-popup';

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
 * Validates the structure and compatibility of a JSON backup.
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

    const expectedSchemaVersion = CONFIG.BACKUP_SCHEMA_VERSION;
    if (meta.schemaVersion !== expectedSchemaVersion) {
        return {
            valid: false,
            reason: `The schema version is not compatible. Expected ${expectedSchemaVersion}.`
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

    const dataEntries = Object.entries(data);
    if (typeof meta.keyCount === 'number' && meta.keyCount !== dataEntries.length) {
        return { valid: false, reason: 'The backup appears to be corrupted or truncated.' };
    }

    for (const [key, value] of dataEntries) {
        if (!isSafeStorageKey(key)) {
            return { valid: false, reason: `The key "${key}" is not safe.` };
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
 * Exports all values stored by Tampermonkey into a JSON file.
 * @returns {Promise<{ meta: Record<string, unknown>, data: Record<string, unknown> }>}
 */
export const exportBackup = async () => {
    try {
        const keys = await getCurrentStorageKeys();
        const data = Object.create(null);

        for (const key of keys) {
            data[key] = await getStoredValue(key);
        }

        const metadata = getScriptMetadata();
        const payload = {
            meta: {
                scriptId: metadata.scriptId,
                scriptName: metadata.scriptName,
                scriptVersion: metadata.scriptVersion,
                schemaVersion: CONFIG.BACKUP_SCHEMA_VERSION,
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

const clearCurrentStorage = async () => {
    if (typeof GM_deleteValue !== 'function') {
        throw new Error('The GM_deleteValue API is not available in this environment.');
    }

    const currentKeys = await getCurrentStorageKeys();
    for (const key of currentKeys) {
        GM_deleteValue(key);
    }
};

/**
 * Imports a JSON backup, validates it, and overwrites the current storage.
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
        const confirmationMessage = [
            'This backup will overwrite all current script data.',
            '',
            `Script: ${meta.scriptName}`,
            `Version: ${meta.scriptVersion}`,
            `Exported at: ${meta.exportedAt}`,
            '',
            'Do you want to continue?'
        ].join('\n');

        if (!window.confirm(confirmationMessage)) {
            writeBackupStatus('Import canceled by the user.', 'info');
            return false;
        }

        await clearCurrentStorage();

        const storedSnapshot = isPlainObject(data[CONFIG.STORAGE_KEY]) ? data[CONFIG.STORAGE_KEY] : null;
        const normalizedSnapshot = storedSnapshot || {
            version: 4,
            lastRun: meta.exportedAt,
            followers: Array.isArray(data.followers) ? data.followers : [],
            following: Array.isArray(data.following) ? data.following : [],
            followersDetailed: Array.isArray(data.followersDetailed) ? data.followersDetailed : [],
            followingDetailed: Array.isArray(data.followingDetailed) ? data.followingDetailed : [],
            notFollowingBackDetailed: Array.isArray(data.notFollowingBackDetailed) ? data.notFollowingBackDetailed : [],
            fansDetailed: Array.isArray(data.fansDetailed) ? data.fansDetailed : [],
            mutualsDetailed: Array.isArray(data.mutualsDetailed) ? data.mutualsDetailed : [],
            unfollowers: Array.isArray(data.unfollowers) ? data.unfollowers : [],
            deactivated: Array.isArray(data.deactivated) ? data.deactivated : [],
            blocked: Array.isArray(data.blocked) ? data.blocked : [],
            renamed: Array.isArray(data.renamed) ? data.renamed : [],
            history: Array.isArray(data.history) ? data.history : []
        };

        for (const [key, value] of Object.entries(data)) {
            GM_setValue(key, value);
        }

        Storage.save(normalizedSnapshot);

        writeBackupStatus('Backup restored successfully. Reloading the interface...', 'success');
        window.setTimeout(() => window.location.reload(), 250);
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'The backup could not be imported.';
        writeBackupStatus(message, 'error');
        window.alert(`Backup import error:\n\n${message}`);
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