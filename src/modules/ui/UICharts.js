import { UI } from './UIState.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { Icons } from '../../assets/Icons.js';

const METRIC_CONFIG = {
    followers: {
        label: 'Followers',
        startField: 'startFollowers',
        lastDeltaField: 'lastDeltaFollowers',
        intradayField: 'intradayDeltaFollowers',
        stroke: '#3b82f6'
    },
    following: {
        label: 'Following',
        startField: 'startFollowing',
        lastDeltaField: 'lastDeltaFollowing',
        intradayField: 'intradayDeltaFollowing',
        stroke: '#8b5cf6'
    },
    mutuals: {
        label: 'Mutuals',
        startField: 'startMutuals',
        lastDeltaField: 'lastDeltaMutuals',
        intradayField: 'intradayDeltaMutuals',
        stroke: '#10b981'
    }
};

const RANGE_LIMITS = {
    '7d': 7,
    '30d': 30,
    'all': Infinity
};

const roundCoord = (n) => Math.round(Number(n) * 100) / 100;

const shortDateLabel = (dateStr) => {
    const raw = String(dateStr || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw.slice(5); // MM-DD
    }
    return raw.slice(0, 10);
};

Object.assign(UI, {
    /**
     * Shared KPI delta builder for both Main History and Target Overview.
     */
    buildKpiDelta: (currVal, prevDayVal, startVal, lastDeltaVal, scansCount) => {
        const curr = Number(currVal ?? 0);
        const scans = Number(scansCount) || 1;
        const hasLastDelta = lastDeltaVal !== undefined && lastDeltaVal !== null;
        const lastDelta = hasLastDelta ? Number(lastDeltaVal) : 0;

        if (prevDayVal !== null && prevDayVal !== undefined) {
            const dayDiff = curr - Number(prevDayVal);
            const intraDiff = curr - Number(startVal ?? curr);

            if (dayDiff > 0) {
                const suffix = (scans > 1 && hasLastDelta && lastDelta !== dayDiff && lastDelta !== 0)
                    ? ` (${lastDelta > 0 ? '+' : ''}${lastDelta} last)`
                    : '';
                return { text: `+${dayDiff.toLocaleString()} vs prev${suffix}`, cls: 'is-positive', icon: Icons.trendingUp };
            }
            if (dayDiff < 0) {
                const suffix = (scans > 1 && hasLastDelta && lastDelta !== dayDiff && lastDelta !== 0)
                    ? ` (${lastDelta > 0 ? '+' : ''}${lastDelta} last)`
                    : '';
                return { text: `${dayDiff.toLocaleString()} vs prev${suffix}`, cls: 'is-negative', icon: Icons.trendingDown };
            }
            if (scans > 1 && intraDiff !== 0) {
                const sign = intraDiff > 0 ? '+' : '';
                return {
                    text: `0 vs prev (${sign}${intraDiff.toLocaleString()} today)`,
                    cls: intraDiff > 0 ? 'is-positive' : 'is-negative',
                    icon: intraDiff > 0 ? Icons.trendingUp : Icons.trendingDown
                };
            }
            return { text: 'No change vs prev', cls: 'is-neutral', icon: Icons.neutral };
        }

        if (scans > 1) {
            const intraDiff = curr - Number(startVal ?? curr);
            if (intraDiff > 0) {
                return { text: `+${intraDiff.toLocaleString()} today`, cls: 'is-positive', icon: Icons.trendingUp };
            }
            if (intraDiff < 0) {
                return { text: `${intraDiff.toLocaleString()} today`, cls: 'is-negative', icon: Icons.trendingDown };
            }
            if (hasLastDelta && lastDelta !== 0) {
                const sign = lastDelta > 0 ? '+' : '';
                return {
                    text: `0 today (${sign}${lastDelta.toLocaleString()} last)`,
                    cls: lastDelta > 0 ? 'is-positive' : 'is-negative',
                    icon: lastDelta > 0 ? Icons.trendingUp : Icons.trendingDown
                };
            }
            return { text: 'No change today', cls: 'is-neutral', icon: Icons.neutral };
        }

        return { text: 'First record', cls: 'is-neutral', icon: Icons.neutral };
    },

    /**
     * Renders an explicit signed delta pill for historical tables (+14, -3, or intraday movement).
     */
    formatDeltaPillHtml: (dayDelta, { intradayDelta = 0, scansCount = 1, isBaselineRow = false } = {}) => {
        const scans = Number(scansCount) || 1;
        const intra = Number(intradayDelta || 0);

        if (isBaselineRow) {
            if (scans > 1 && intra !== 0) {
                const cls = intra > 0 ? 'is-positive' : 'is-negative';
                const sign = intra > 0 ? '+' : '';
                return `<span class="ig-delta-pill ${cls}" title="Intraday change on baseline day">${sign}${intra.toLocaleString()}</span>`;
            }
            return '<span class="ig-delta-pill is-neutral" title="Opening baseline">—</span>';
        }

        const diff = Number(dayDelta || 0);
        if (diff > 0) {
            return `<span class="ig-delta-pill is-positive">+${diff.toLocaleString()}</span>`;
        }
        if (diff < 0) {
            return `<span class="ig-delta-pill is-negative">${diff.toLocaleString()}</span>`;
        }
        if (scans > 1 && intra !== 0) {
            const cls = intra > 0 ? 'is-positive' : 'is-negative';
            const sign = intra > 0 ? '+' : '';
            return `<span class="ig-delta-pill ${cls}" title="Net 0 vs previous day, ${sign}${intra} intraday">${sign}${intra.toLocaleString()} today</span>`;
        }
        return '<span class="ig-delta-pill is-neutral">0</span>';
    },

    /**
     * Computes normalized SVG coordinates and domain bounds for the interactive trend chart.
     */
    computeTrendSeries: (historyList, { metric = 'followers', range = '30d' } = {}) => {
        const normalized = Storage.normalizeHistoryRecords(Array.isArray(historyList) ? historyList : []).list;
        const cfg = METRIC_CONFIG[metric] || METRIC_CONFIG.followers;
        const metricKey = METRIC_CONFIG[metric] ? metric : 'followers';
        const limit = RANGE_LIMITS[range] || 30;

        const withMetric = [];
        normalized.forEach((entry, idx) => {
            const rawVal = entry?.[metricKey];
            if (rawVal !== undefined && rawVal !== null && !Number.isNaN(Number(rawVal))) {
                withMetric.push({ entry, fullIdx: idx });
            }
        });

        const viewWidth = 520;
        const viewHeight = 158;
        const padLeft = 48;
        const padRight = 16;
        const padTop = 14;
        const padBottom = 26;
        const plotW = viewWidth - padLeft - padRight;
        const plotH = viewHeight - padTop - padBottom;
        const bottomY = padTop + plotH;

        if (withMetric.length === 0) {
            return {
                isEmpty: true,
                metric: metricKey,
                metricLabel: cfg.label,
                range,
                points: [],
                viewWidth,
                viewHeight
            };
        }

        const windowed = Number.isFinite(limit) ? withMetric.slice(-limit) : withMetric;
        let mode = 'multi-day';
        let rawPoints = [];

        if (windowed.length === 1) {
            const { entry } = windowed[0];
            const currVal = Number(entry[metricKey] ?? 0);
            const startRaw = entry[cfg.startField];
            const startVal = (startRaw !== undefined && startRaw !== null && !Number.isNaN(Number(startRaw)))
                ? Number(startRaw)
                : currVal;
            const scans = Number(entry.scansCount) || 1;

            if (scans > 1) {
                mode = 'intraday-single-day';
                rawPoints = [
                    {
                        date: entry.date,
                        displayDate: `${entry.date} (Open)`,
                        axisLabel: 'Start',
                        value: startVal,
                        startValue: startVal,
                        delta: 0,
                        intradayDelta: 0,
                        scansCount: 1,
                        isOpeningAnchor: true
                    },
                    {
                        date: entry.date,
                        displayDate: `${entry.date} (Current)`,
                        axisLabel: 'Now',
                        value: currVal,
                        startValue: startVal,
                        delta: currVal - startVal,
                        intradayDelta: currVal - startVal,
                        scansCount: scans,
                        isOpeningAnchor: false
                    }
                ];
            } else {
                mode = 'single-baseline';
                rawPoints = [
                    {
                        date: entry.date,
                        displayDate: entry.date,
                        axisLabel: shortDateLabel(entry.date),
                        value: currVal,
                        startValue: startVal,
                        delta: 0,
                        intradayDelta: 0,
                        scansCount: 1,
                        isBaselineOnly: true
                    }
                ];
            }
        } else {
            rawPoints = windowed.map(({ entry, fullIdx }, idx) => {
                const val = Number(entry[metricKey] ?? 0);
                const startRaw = entry[cfg.startField];
                const startVal = (startRaw !== undefined && startRaw !== null && !Number.isNaN(Number(startRaw)))
                    ? Number(startRaw)
                    : val;

                let prevVal = null;
                if (idx > 0) {
                    prevVal = Number(windowed[idx - 1].entry[metricKey] ?? 0);
                } else if (fullIdx > 0) {
                    const prevCandidate = normalized[fullIdx - 1]?.[metricKey];
                    if (prevCandidate !== undefined && prevCandidate !== null && !Number.isNaN(Number(prevCandidate))) {
                        prevVal = Number(prevCandidate);
                    }
                }

                const delta = prevVal !== null ? (val - prevVal) : (val - startVal);
                const intradayDelta = val - startVal;

                return {
                    date: entry.date,
                    displayDate: entry.date,
                    axisLabel: shortDateLabel(entry.date),
                    value: val,
                    startValue: startVal,
                    delta,
                    intradayDelta,
                    scansCount: Number(entry.scansCount) || 1,
                    hasPrevDay: prevVal !== null
                };
            });
        }

        const values = rawPoints.map((p) => p.value);
        const rawMin = Math.min(...values);
        const rawMax = Math.max(...values);
        const rawSpan = rawMax - rawMin;

        let yMin = 0;
        let yMax = 4;
        if (rawSpan === 0) {
            yMin = Math.max(0, rawMin - 2);
            yMax = yMin + 4;
        } else {
            const pad = Math.max(1, Math.ceil(rawSpan * 0.18));
            yMin = Math.max(0, rawMin - pad);
            yMax = rawMax + pad;
            if (yMax - yMin < 2) {
                yMax = yMin + 2;
            }
        }
        const ySpan = Math.max(1, yMax - yMin);
        const yMid = Math.round((yMin + yMax) / 2);

        const count = rawPoints.length;
        const points = rawPoints.map((p, idx) => {
            const xRatio = count === 1 ? 0.5 : (idx / (count - 1));
            const x = roundCoord(padLeft + xRatio * plotW);
            const yRatio = (p.value - yMin) / ySpan;
            const y = roundCoord(bottomY - yRatio * plotH);

            let hitX = padLeft;
            let hitW = plotW;
            if (count > 1) {
                const prevX = idx === 0 ? padLeft : (padLeft + ((idx - 1) / (count - 1)) * plotW);
                const nextX = idx === count - 1 ? (padLeft + plotW) : (padLeft + ((idx + 1) / (count - 1)) * plotW);
                const leftEdge = idx === 0 ? padLeft : (prevX + x) / 2;
                const rightEdge = idx === count - 1 ? (padLeft + plotW) : (x + nextX) / 2;
                hitX = roundCoord(leftEdge);
                hitW = roundCoord(Math.max(6, rightEdge - leftEdge));
            }

            return {
                ...p,
                index: idx,
                x,
                y,
                xRatio: roundCoord(xRatio),
                hitX,
                hitW
            };
        });

        let linePath = '';
        let areaPath = '';
        if (points.length === 1) {
            const pt = points[0];
            linePath = `M ${padLeft} ${pt.y} L ${padLeft + plotW} ${pt.y}`;
            areaPath = `M ${padLeft} ${bottomY} L ${padLeft} ${pt.y} L ${padLeft + plotW} ${pt.y} L ${padLeft + plotW} ${bottomY} Z`;
        } else {
            linePath = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
            const firstPt = points[0];
            const lastPt = points[points.length - 1];
            areaPath = `M ${firstPt.x} ${bottomY} ` +
                points.map((pt) => `L ${pt.x} ${pt.y}`).join(' ') +
                ` L ${lastPt.x} ${bottomY} Z`;
        }

        const firstVal = points[0].value;
        const lastVal = points[points.length - 1].value;
        const windowDelta = lastVal - firstVal;

        let strokeColor = cfg.stroke;
        if (metricKey === 'followers') {
            if (windowDelta > 0) strokeColor = '#22c55e';
            else if (windowDelta < 0) strokeColor = '#ef4444';
            else strokeColor = '#3b82f6';
        }

        return {
            isEmpty: false,
            mode,
            metric: metricKey,
            metricLabel: cfg.label,
            range,
            strokeColor,
            points,
            linePath,
            areaPath,
            yMin,
            yMid,
            yMax,
            rawMin,
            rawMax,
            windowDelta,
            viewWidth,
            viewHeight,
            padLeft,
            padRight,
            padTop,
            padBottom,
            plotW,
            plotH,
            bottomY
        };
    },

    /**
     * Formats the readout HTML for a given chart point.
     */
    renderChartPointReadoutHtml: (pt, metricLabel) => {
        if (!pt) return '';
        const exactVal = Utils.formatExactNumber(pt.value);
        const safeDate = Utils.escapeHtml(pt.displayDate || pt.date || '');
        const scans = Number(pt.scansCount) || 1;

        let deltaBadge = '';
        if (pt.isBaselineOnly || pt.isOpeningAnchor) {
            deltaBadge = '<span class="ig-chart-readout-delta is-neutral">Baseline</span>';
        } else if (pt.delta > 0) {
            deltaBadge = `<span class="ig-chart-readout-delta is-positive">+${pt.delta.toLocaleString()}</span>`;
        } else if (pt.delta < 0) {
            deltaBadge = `<span class="ig-chart-readout-delta is-negative">${pt.delta.toLocaleString()}</span>`;
        } else {
            deltaBadge = '<span class="ig-chart-readout-delta is-neutral">0</span>';
        }

        let intraNote = '';
        if (scans > 1 && !pt.isOpeningAnchor) {
            const intraSign = pt.intradayDelta > 0 ? '+' : '';
            intraNote = `<span class="ig-chart-readout-intra">Open ${Utils.formatExactNumber(pt.startValue)} (${intraSign}${pt.intradayDelta.toLocaleString()} · ${scans}x)</span>`;
        }

        return [
            `<span class="ig-chart-readout-date">${safeDate}</span>`,
            `<span class="ig-chart-readout-val">${exactVal} <span class="ig-chart-readout-unit">${Utils.escapeHtml(metricLabel)}</span></span>`,
            deltaBadge,
            intraNote
        ].filter(Boolean).join(' ');
    },

    /**
     * Renders the complete interactive SVG trend chart card HTML.
     */
    renderTrendChartCard: (historyList, { scope = 'main', isRestricted = false } = {}) => {
        const normalized = Storage.normalizeHistoryRecords(Array.isArray(historyList) ? historyList : []).list;
        if (normalized.length === 0) return '';

        const hasMutualsData = !isRestricted && normalized.some(
            (h) => h.mutuals !== undefined && h.mutuals !== null && !Number.isNaN(Number(h.mutuals))
        );

        if (!UI.chartState[scope]) {
            UI.chartState[scope] = { metric: 'followers', range: '30d' };
        }
        let activeMetric = UI.chartState[scope].metric || 'followers';
        if (activeMetric === 'mutuals' && !hasMutualsData) {
            activeMetric = 'followers';
            UI.chartState[scope].metric = 'followers';
        }
        const activeRange = UI.chartState[scope].range || '30d';

        const series = UI.computeTrendSeries(normalized, { metric: activeMetric, range: activeRange });
        if (series.isEmpty) return '';

        const latestPt = series.points[series.points.length - 1];
        const firstPt = series.points[0];
        const gradId = `ig-trend-grad-${scope}-${series.metric}`;

        let windowSummaryHtml = '';
        if (series.mode === 'single-baseline') {
            windowSummaryHtml = '<span class="ig-chart-window-pill is-neutral">Baseline Point</span>';
        } else {
            const wSign = series.windowDelta > 0 ? '+' : '';
            const wCls = series.windowDelta > 0 ? 'is-positive' : (series.windowDelta < 0 ? 'is-negative' : 'is-neutral');
            const rangeText = activeRange === 'all' ? 'All-time' : activeRange.toUpperCase();
            windowSummaryHtml = `<span class="ig-chart-window-pill ${wCls}">${wSign}${series.windowDelta.toLocaleString()} (${rangeText})</span>`;
        }

        const metricsList = [
            { id: 'followers', label: 'Followers' },
            { id: 'following', label: 'Following' },
            ...(hasMutualsData ? [{ id: 'mutuals', label: 'Mutuals' }] : [])
        ];

        const metricButtonsHtml = metricsList.map((m) => (
            `<button type="button" class="ig-chart-seg-btn${series.metric === m.id ? ' is-active' : ''}" data-chart-metric="${m.id}">${m.label}</button>`
        )).join('');

        const rangeButtonsHtml = [
            { id: '7d', label: '7D' },
            { id: '30d', label: '30D' },
            { id: 'all', label: 'All' }
        ].map((r) => (
            `<button type="button" class="ig-chart-seg-btn${activeRange === r.id ? ' is-active' : ''}" data-chart-range="${r.id}">${r.label}</button>`
        )).join('');

        const midYCoord = roundCoord(series.padTop + series.plotH / 2);
        const showDots = series.points.length <= 32;

        const dotsSvg = series.points.map((pt, idx) => {
            const isLast = idx === series.points.length - 1;
            if (!showDots && !isLast && idx !== 0) return '';
            const r = isLast ? 3.8 : 2.6;
            return `<circle class="ig-chart-dot${isLast ? ' is-latest' : ''}" cx="${pt.x}" cy="${pt.y}" r="${r}" fill="${series.strokeColor}" />`;
        }).join('');

        const hitRectsSvg = series.points.map((pt) => {
            const aria = `${pt.displayDate}: ${pt.value.toLocaleString()} ${series.metricLabel} (${pt.delta >= 0 ? '+' : ''}${pt.delta})`;
            return `<rect class="ig-chart-hit" tabindex="0" role="button" aria-label="${Utils.escapeHtml(aria)}" ` +
                `x="${pt.hitX}" y="${series.padTop}" width="${pt.hitW}" height="${series.plotH}" ` +
                `data-point-index="${pt.index}" ` +
                `data-x="${pt.x}" data-y="${pt.y}" data-x-ratio="${pt.xRatio}" ` +
                `data-date="${Utils.escapeHtml(pt.displayDate)}" ` +
                `data-val="${pt.value}" data-delta="${pt.delta}" ` +
                `data-intra="${pt.intradayDelta}" data-scans="${pt.scansCount}" ` +
                `data-start="${pt.startValue}" ` +
                `data-baseline="${pt.isBaselineOnly || pt.isOpeningAnchor ? '1' : '0'}" />`;
        }).join('');

        let xAxisSvg = '';
        if (series.points.length === 1) {
            xAxisSvg = `<text x="${latestPt.x}" y="${series.viewHeight - 6}" text-anchor="middle" class="ig-chart-axis-text">${Utils.escapeHtml(latestPt.axisLabel)}</text>`;
        } else {
            const midPt = series.points.length >= 5 ? series.points[Math.floor(series.points.length / 2)] : null;
            xAxisSvg = [
                `<text x="${series.padLeft}" y="${series.viewHeight - 6}" text-anchor="start" class="ig-chart-axis-text">${Utils.escapeHtml(firstPt.axisLabel)}</text>`,
                midPt ? `<text x="${midPt.x}" y="${series.viewHeight - 6}" text-anchor="middle" class="ig-chart-axis-text">${Utils.escapeHtml(midPt.axisLabel)}</text>` : '',
                `<text x="${series.padLeft + series.plotW}" y="${series.viewHeight - 6}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(latestPt.axisLabel)}</text>`
            ].join('');
        }

        const lineDashAttr = series.mode === 'single-baseline' ? ' stroke-dasharray="5 4"' : '';

        return [
            `<div class="ig-trend-chart-card" data-chart-scope="${Utils.escapeHtml(scope)}" data-metric-label="${Utils.escapeHtml(series.metricLabel)}">`,
            `  <div class="ig-chart-header">`,
            `    <div class="ig-chart-title-group">`,
            `      <span class="ig-chart-title">${Icons.chartArea} Audience Trend</span>`,
            `      ${windowSummaryHtml}`,
            `    </div>`,
            `    <div class="ig-chart-controls">`,
            `      <div class="ig-chart-seg-group" role="group" aria-label="Chart metric">${metricButtonsHtml}</div>`,
            `      <div class="ig-chart-seg-group" role="group" aria-label="Chart time range">${rangeButtonsHtml}</div>`,
            `    </div>`,
            `  </div>`,
            `  <div class="ig-chart-readout" data-default-index="${latestPt.index}">`,
            `    ${UI.renderChartPointReadoutHtml(latestPt, series.metricLabel)}`,
            `  </div>`,
            `  <div class="ig-chart-stage">`,
            `    <svg class="ig-trend-svg" viewBox="0 0 ${series.viewWidth} ${series.viewHeight}" preserveAspectRatio="none" role="img" aria-label="${Utils.escapeHtml(series.metricLabel)} trend chart">`,
            `      <defs>`,
            `        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`,
            `          <stop offset="0%" stop-color="${series.strokeColor}" stop-opacity="0.30" />`,
            `          <stop offset="100%" stop-color="${series.strokeColor}" stop-opacity="0.01" />`,
            `        </linearGradient>`,
            `      </defs>`,
            `      <line x1="${series.padLeft}" y1="${series.padTop}" x2="${series.padLeft + series.plotW}" y2="${series.padTop}" class="ig-chart-grid-line" />`,
            `      <line x1="${series.padLeft}" y1="${midYCoord}" x2="${series.padLeft + series.plotW}" y2="${midYCoord}" class="ig-chart-grid-line is-mid" />`,
            `      <line x1="${series.padLeft}" y1="${series.bottomY}" x2="${series.padLeft + series.plotW}" y2="${series.bottomY}" class="ig-chart-grid-line" />`,
            `      <text x="${series.padLeft - 6}" y="${series.padTop + 4}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(Utils.formatNumber(series.yMax))}</text>`,
            `      <text x="${series.padLeft - 6}" y="${midYCoord + 3}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(Utils.formatNumber(series.yMid))}</text>`,
            `      <text x="${series.padLeft - 6}" y="${series.bottomY + 3}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(Utils.formatNumber(series.yMin))}</text>`,
            `      <path d="${series.areaPath}" fill="url(#${gradId})" class="ig-chart-area" />`,
            `      <path d="${series.linePath}" fill="none" stroke="${series.strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${lineDashAttr} class="ig-chart-line" />`,
            `      <line x1="${latestPt.x}" y1="${series.padTop}" x2="${latestPt.x}" y2="${series.bottomY}" class="ig-chart-crosshair" style="opacity:0;" />`,
            `      ${dotsSvg}`,
            `      <circle class="ig-chart-active-dot" cx="${latestPt.x}" cy="${latestPt.y}" r="5" fill="${series.strokeColor}" style="opacity:0;" />`,
            `      ${xAxisSvg}`,
            `      ${hitRectsSvg}`,
            `    </svg>`,
            `    <div class="ig-chart-tooltip" style="display:none;" aria-hidden="true"></div>`,
            `  </div>`,
            `</div>`
        ].join('\n');
    },

    /**
     * Binds CSP-safe delegated pointer, keyboard, and toggle interactions on a chart mount element.
     */
    bindChartInteractions: (mountEl, { historyList, scope = 'main', isRestricted = false } = {}) => {
        if (!mountEl) return;
        mountEl._chartConfig = { historyList, scope, isRestricted };

        if (mountEl.getAttribute('data-chart-bound') === '1') return;
        mountEl.setAttribute('data-chart-bound', '1');

        const activateHit = (hitEl) => {
            const card = hitEl.closest('.ig-trend-chart-card');
            if (!card) return;

            const x = Number(hitEl.getAttribute('data-x') || 0);
            const y = Number(hitEl.getAttribute('data-y') || 0);
            const xRatio = Number(hitEl.getAttribute('data-x-ratio') || 0.5);
            const pt = {
                displayDate: hitEl.getAttribute('data-date') || '',
                value: Number(hitEl.getAttribute('data-val') || 0),
                delta: Number(hitEl.getAttribute('data-delta') || 0),
                intradayDelta: Number(hitEl.getAttribute('data-intra') || 0),
                scansCount: Number(hitEl.getAttribute('data-scans') || 1),
                startValue: Number(hitEl.getAttribute('data-start') || 0),
                isBaselineOnly: hitEl.getAttribute('data-baseline') === '1'
            };
            const metricLabel = card.getAttribute('data-metric-label') || 'Followers';

            const crosshair = card.querySelector('.ig-chart-crosshair');
            if (crosshair) {
                crosshair.setAttribute('x1', String(x));
                crosshair.setAttribute('x2', String(x));
                crosshair.style.opacity = '1';
            }

            const activeDot = card.querySelector('.ig-chart-active-dot');
            if (activeDot) {
                activeDot.setAttribute('cx', String(x));
                activeDot.setAttribute('cy', String(y));
                activeDot.style.opacity = '1';
            }

            const readout = card.querySelector('.ig-chart-readout');
            if (readout) {
                readout.innerHTML = UI.renderChartPointReadoutHtml(pt, metricLabel);
            }

            const tooltip = card.querySelector('.ig-chart-tooltip');
            if (tooltip) {
                const sign = pt.delta > 0 ? '+' : '';
                const deltaCls = pt.isBaselineOnly ? 'is-neutral' : (pt.delta > 0 ? 'is-positive' : (pt.delta < 0 ? 'is-negative' : 'is-neutral'));
                const deltaLabel = pt.isBaselineOnly ? 'Baseline' : `${sign}${pt.delta.toLocaleString()} vs prev`;
                tooltip.innerHTML = `<div class="ig-chart-tt-date">${Utils.escapeHtml(pt.displayDate)}</div>` +
                    `<div class="ig-chart-tt-val">${Utils.formatExactNumber(pt.value)}</div>` +
                    `<div class="ig-chart-tt-delta ${deltaCls}">${Utils.escapeHtml(deltaLabel)}</div>`;
                tooltip.style.display = 'block';
                const leftPct = Math.min(92, Math.max(8, Math.round((x / 520) * 100)));
                tooltip.style.left = `${leftPct}%`;
                if (xRatio > 0.6) tooltip.classList.add('is-right');
                else tooltip.classList.remove('is-right');
            }
        };

        const resetChartHover = () => {
            const card = mountEl.querySelector('.ig-trend-chart-card');
            if (!card) return;
            const crosshair = card.querySelector('.ig-chart-crosshair');
            const activeDot = card.querySelector('.ig-chart-active-dot');
            const tooltip = card.querySelector('.ig-chart-tooltip');
            if (crosshair) crosshair.style.opacity = '0';
            if (activeDot) activeDot.style.opacity = '0';
            if (tooltip) tooltip.style.display = 'none';

            const readout = card.querySelector('.ig-chart-readout');
            const defaultIdx = readout ? readout.getAttribute('data-default-index') : null;
            const latestHit = defaultIdx !== null
                ? card.querySelector(`.ig-chart-hit[data-point-index="${defaultIdx}"]`)
                : null;
            if (readout && latestHit) {
                const metricLabel = card.getAttribute('data-metric-label') || 'Followers';
                const pt = {
                    displayDate: latestHit.getAttribute('data-date') || '',
                    value: Number(latestHit.getAttribute('data-val') || 0),
                    delta: Number(latestHit.getAttribute('data-delta') || 0),
                    intradayDelta: Number(latestHit.getAttribute('data-intra') || 0),
                    scansCount: Number(latestHit.getAttribute('data-scans') || 1),
                    startValue: Number(latestHit.getAttribute('data-start') || 0),
                    isBaselineOnly: latestHit.getAttribute('data-baseline') === '1'
                };
                readout.innerHTML = UI.renderChartPointReadoutHtml(pt, metricLabel);
            }
        };

        mountEl.addEventListener('click', (e) => {
            const metricBtn = e.target.closest('[data-chart-metric]');
            const rangeBtn = e.target.closest('[data-chart-range]');
            if (!metricBtn && !rangeBtn) return;

            e.preventDefault();
            e.stopPropagation();
            const cfg = mountEl._chartConfig;
            if (!cfg) return;

            if (!UI.chartState[cfg.scope]) {
                UI.chartState[cfg.scope] = { metric: 'followers', range: '30d' };
            }
            if (metricBtn) {
                UI.chartState[cfg.scope].metric = metricBtn.getAttribute('data-chart-metric') || 'followers';
            }
            if (rangeBtn) {
                UI.chartState[cfg.scope].range = rangeBtn.getAttribute('data-chart-range') || '30d';
            }

            mountEl.innerHTML = UI.renderTrendChartCard(cfg.historyList, {
                scope: cfg.scope,
                isRestricted: cfg.isRestricted
            });
        });

        mountEl.addEventListener('pointerover', (e) => {
            const hit = e.target.closest('.ig-chart-hit');
            if (hit) activateHit(hit);
        });

        mountEl.addEventListener('pointerleave', () => {
            resetChartHover();
        });

        mountEl.addEventListener('focusin', (e) => {
            const hit = e.target.closest('.ig-chart-hit');
            if (hit) activateHit(hit);
        });

        mountEl.addEventListener('focusout', (e) => {
            if (!mountEl.contains(e.relatedTarget)) {
                resetChartHover();
            }
        });
    },

    /**
     * Renders the segmented Audience Composition & Reciprocity bar card.
     */
    renderAudienceCompositionCard: ({
        followers = 0,
        following = 0,
        mutuals = 0,
        fans = null,
        notFollowingBack = null,
        mode = 'main'
    } = {}) => {
        const fCount = Math.max(0, Number(followers || 0));
        const ingCount = Math.max(0, Number(following || 0));
        const mutCount = Math.max(0, Number(mutuals || 0));

        const fansCount = fans !== null && fans !== undefined
            ? Math.max(0, Number(fans))
            : Math.max(0, fCount - mutCount);
        const notBackCount = notFollowingBack !== null && notFollowingBack !== undefined
            ? Math.max(0, Number(notFollowingBack))
            : Math.max(0, ingCount - mutCount);

        const unionTotal = mutCount + fansCount + notBackCount;
        if (unionTotal === 0) return '';

        const mutPct = roundCoord((mutCount / unionTotal) * 100);
        const fansPct = roundCoord((fansCount / unionTotal) * 100);
        const notBackPct = roundCoord(Math.max(0, 100 - mutPct - fansPct));

        const followBackRate = ingCount > 0 ? `${((mutCount / ingCount) * 100).toFixed(1)}%` : '—';
        const fanShare = fCount > 0 ? `${((fansCount / fCount) * 100).toFixed(1)}%` : '—';
        const ffRatio = ingCount > 0 ? `${(fCount / ingCount).toFixed(2)}x` : '—';

        const fansLabel = mode === 'target' ? 'Followers Only' : 'Fans';
        const notBackLabel = mode === 'target' ? 'Following Only' : 'Not Following Back';
        const cardTitle = mode === 'target' ? 'Network Composition' : 'Audience Composition & Reciprocity';

        return [
            `<div class="ig-composition-card">`,
            `  <div class="ig-comp-header">`,
            `    <span class="ig-comp-title">${Icons.mutuals} ${cardTitle}</span>`,
            `    <span class="ig-comp-ratio-pill" title="Followers to Following ratio">F/F Ratio: <strong>${ffRatio}</strong></span>`,
            `  </div>`,
            `  <div class="ig-comp-bar" role="img" aria-label="Mutuals ${mutPct}%, ${fansLabel} ${fansPct}%, ${notBackLabel} ${notBackPct}%">`,
            mutCount > 0 ? `    <div class="ig-comp-seg is-mutuals" style="width:${mutPct}%" title="Mutuals: ${mutCount.toLocaleString()} (${mutPct}%)"></div>` : '',
            fansCount > 0 ? `    <div class="ig-comp-seg is-fans" style="width:${fansPct}%" title="${fansLabel}: ${fansCount.toLocaleString()} (${fansPct}%)"></div>` : '',
            notBackCount > 0 ? `    <div class="ig-comp-seg is-notback" style="width:${notBackPct}%" title="${notBackLabel}: ${notBackCount.toLocaleString()} (${notBackPct}%)"></div>` : '',
            `  </div>`,
            `  <div class="ig-comp-legend">`,
            `    <span class="ig-comp-legend-item"><span class="ig-comp-dot is-mutuals"></span>Mutuals <strong>${mutCount.toLocaleString()}</strong></span>`,
            `    <span class="ig-comp-legend-item"><span class="ig-comp-dot is-fans"></span>${fansLabel} <strong>${fansCount.toLocaleString()}</strong></span>`,
            `    <span class="ig-comp-legend-item"><span class="ig-comp-dot is-notback"></span>${notBackLabel} <strong>${notBackCount.toLocaleString()}</strong></span>`,
            `  </div>`,
            `  <div class="ig-comp-metrics">`,
            `    <div class="ig-comp-metric-box">`,
            `      <span class="ig-comp-metric-label">Reciprocity</span>`,
            `      <span class="ig-comp-metric-val">${followBackRate}</span>`,
            `    </div>`,
            `    <div class="ig-comp-metric-box">`,
            `      <span class="ig-comp-metric-label">${fansLabel} Share</span>`,
            `      <span class="ig-comp-metric-val">${fanShare}</span>`,
            `    </div>`,
            `    <div class="ig-comp-metric-box">`,
            `      <span class="ig-comp-metric-label">Total Reach</span>`,
            `      <span class="ig-comp-metric-val">${unionTotal.toLocaleString()}</span>`,
            `    </div>`,
            `  </div>`,
            `</div>`
        ].filter(Boolean).join('\n');
    },

    /**
     * Generates a compact inline SVG sparkline for Monitored Account cards.
     */
    renderSparklineSvg: (historyList, { metric = 'followers', width = 68, height = 22 } = {}) => {
        const series = UI.computeTrendSeries(historyList, { metric, range: '30d' });
        if (series.isEmpty || series.points.length === 0) return '';

        const pts = series.points;
        const vals = pts.map((p) => p.value);
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        const span = Math.max(1, maxV - minV);
        const pad = 2.5;
        const innerW = width - pad * 2;
        const innerH = height - pad * 2;

        let stroke = '#60a5fa';
        if (series.windowDelta > 0) stroke = '#22c55e';
        else if (series.windowDelta < 0) stroke = '#ef4444';

        if (pts.length === 1) {
            const cy = roundCoord(height / 2);
            return `<svg class="ig-sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">` +
                `<line x1="${pad}" y1="${cy}" x2="${width - pad}" y2="${cy}" stroke="${stroke}" stroke-width="1.6" stroke-dasharray="3 2" opacity="0.7" />` +
                `<circle cx="${roundCoord(width / 2)}" cy="${cy}" r="2.4" fill="${stroke}" />` +
                `</svg>`;
        }

        const coords = pts.map((p, idx) => {
            const x = roundCoord(pad + (idx / (pts.length - 1)) * innerW);
            const yRatio = maxV === minV ? 0.5 : ((p.value - minV) / span);
            const y = roundCoord(height - pad - yRatio * innerH);
            return { x, y };
        });

        const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
        const lastC = coords[coords.length - 1];

        return `<svg class="ig-sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">` +
            `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />` +
            `<circle cx="${lastC.x}" cy="${lastC.y}" r="2.2" fill="${stroke}" />` +
            `</svg>`;
    }
});
