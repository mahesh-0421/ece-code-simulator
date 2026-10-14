/* =========================================================
   APPLICATION STATE
   ========================================================= */

let codeMirrorInstance = null;
let currentLanguage = 'verilog';
let currentResults = null;
let waveZoomLevel = 1.0;

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const codeEditorTextarea = document.getElementById('codeEditor');
const languageSelect = document.getElementById('languageSelect');
const quickExampleSelect = document.getElementById('quickExampleSelect');
const runBtn = document.getElementById('runBtn');
const resetBtn = document.getElementById('resetBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const clearBtn = document.getElementById('clearBtn');
const themeToggle = document.getElementById('themeToggle');

const consoleOutput = document.getElementById('consoleOutput');
const waveformContainer = document.getElementById('waveformContainer');
const plotsContainer = document.getElementById('plotsContainer');
const schematicContainer = document.getElementById('schematicContainer');
const rawVcdOutput = document.getElementById('rawVcdOutput');

const execBadge = document.getElementById('execBadge');
const execTime = document.getElementById('execTime');
const copyOutputBtn = document.getElementById('copyOutputBtn');
const downloadResultBtn = document.getElementById('downloadResultBtn');
const downloadWaveSvgBtn = document.getElementById('downloadWaveSvgBtn');
const downloadPlotBtn = document.getElementById('downloadPlotBtn');
const downloadVcdBtn = document.getElementById('downloadVcdBtn');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');

const lineCountSpan = document.getElementById('lineCount');
const charCountSpan = document.getElementById('charCount');
const waveformBadge = document.getElementById('waveformBadge');
const plotsBadge = document.getElementById('plotsBadge');
const waveInfo = document.getElementById('waveInfo');
const plotsInfo = document.getElementById('plotsInfo');
const engineStatusText = document.getElementById('engineStatusText');

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEditor();
    initEventListeners();
    loadInitialTemplate();
    checkBackendHealth();
});

/* =========================================================
   THEME
   ========================================================= */

function initTheme() {
    const savedTheme = localStorage.getItem('ece_theme') || 'dark';

    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle?.querySelector('.theme-icon');

    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    if (codeMirrorInstance) {
        codeMirrorInstance.setOption(
            'theme',
            theme === 'dark' ? 'nord' : 'eclipse'
        );
    }
}

themeToggle?.addEventListener('click', () => {
    const current =
        document.documentElement.getAttribute('data-theme') || 'dark';

    const next = current === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ece_theme', next);
    updateThemeIcon(next);
});

/* =========================================================
   EDITOR
   ========================================================= */

function getEditorMode(language) {
    return language === 'verilog' ? 'verilog' : 'octave';
}

function initEditor() {
    if (!codeEditorTextarea) {
        console.error('Missing #codeEditor element.');
        return;
    }

    if (window.CodeMirror) {
        const isDark =
            document.documentElement.getAttribute('data-theme') === 'dark';

        codeMirrorInstance = CodeMirror.fromTextArea(
            codeEditorTextarea,
            {
                lineNumbers: true,
                mode: getEditorMode(currentLanguage),
                theme: isDark ? 'nord' : 'eclipse',
                tabSize: 4,
                indentUnit: 4,
                matchBrackets: true,
                autoCloseBrackets: true,
                lineWrapping: false,
                extraKeys: {
                    'Ctrl-Enter': () => runSimulation(),
                    'Cmd-Enter': () => runSimulation()
                }
            }
        );

        codeMirrorInstance.on('change', updateEditorStats);
    } else {
        codeEditorTextarea.addEventListener('input', updateEditorStats);

        codeEditorTextarea.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                runSimulation();
            }
        });
    }

    updateEditorStats();
}

function getEditorCode() {
    return codeMirrorInstance
        ? codeMirrorInstance.getValue()
        : (codeEditorTextarea?.value || '');
}

function setEditorCode(code, language = currentLanguage) {
    const editorMode = getEditorMode(language);

    if (codeMirrorInstance) {
        codeMirrorInstance.setValue(code);
        codeMirrorInstance.setOption('mode', editorMode);
    } else if (codeEditorTextarea) {
        codeEditorTextarea.value = code;
    }

    updateEditorStats();
}

function updateEditorStats() {
    const text = getEditorCode();

    if (lineCountSpan) {
        lineCountSpan.textContent = text ? text.split('\n').length : 0;
    }

    if (charCountSpan) {
        charCountSpan.textContent = text.length;
    }
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function initEventListeners() {
    languageSelect?.addEventListener('change', event => {
        currentLanguage = event.target.value;
        loadDefaultExampleForLanguage(currentLanguage);
    });

    quickExampleSelect?.addEventListener('change', event => {
        const key = event.target.value;

        if (key && EXAMPLES[key]) {
            loadSelectedExample(key);
        }
    });

    runBtn?.addEventListener('click', runSimulation);

    resetBtn?.addEventListener('click', () => {
        loadDefaultExampleForLanguage(currentLanguage);
    });

    clearBtn?.addEventListener('click', () => {
        setEditorCode('', currentLanguage);
        clearOutput();
    });

    copyCodeBtn?.addEventListener('click', async () => {
        await copyToClipboard(getEditorCode());
        showTempBtnText(copyCodeBtn, 'Copied!');
    });

    copyOutputBtn?.addEventListener('click', async () => {
        await copyToClipboard(consoleOutput?.textContent || '');
        showTempBtnText(copyOutputBtn, 'Copied!');
    });

    downloadResultBtn?.addEventListener('click', downloadConsoleOutput);
    downloadWaveSvgBtn?.addEventListener('click', downloadWaveformSvg);
    downloadPlotBtn?.addEventListener('click', downloadPlotPng);
    downloadVcdBtn?.addEventListener('click', downloadVcdFile);

    zoomInBtn?.addEventListener('click', () => {
        waveZoomLevel = Math.min(waveZoomLevel * 1.3, 5);

        if (currentResults?.waveform) {
            renderWaveform(currentResults.waveform);
        }
    });

    zoomOutBtn?.addEventListener('click', () => {
        waveZoomLevel = Math.max(waveZoomLevel / 1.3, 0.4);

        if (currentResults?.waveform) {
            renderWaveform(currentResults.waveform);
        }
    });

    zoomResetBtn?.addEventListener('click', () => {
        waveZoomLevel = 1;

        if (currentResults?.waveform) {
            renderWaveform(currentResults.waveform);
        }
    });

    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            activateTab(button.getAttribute('data-tab'));
        });
    });

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(item => {
                item.classList.remove('active');
            });

            button.classList.add('active');

            const filter = button.getAttribute('data-filter');

            document.querySelectorAll('.example-card').forEach(card => {
                const category = card.getAttribute('data-category');

                card.style.display =
                    filter === 'all' || category === filter
                        ? 'flex'
                        : 'none';
            });
        });
    });
}

/* =========================================================
   EXAMPLE LOADING
   ========================================================= */

function loadInitialTemplate() {
    loadSelectedExample('v_and');
}

function loadDefaultExampleForLanguage(language) {
    if (language === 'verilog') {
        loadSelectedExample('v_and');
    } else {
        loadSelectedExample('m_sine');
    }
}

window.setLanguageMode = function(language) {
    currentLanguage = language;

    if (languageSelect) {
        languageSelect.value = language;
    }

    loadDefaultExampleForLanguage(language);
};

window.loadSelectedExample = function(key) {
    const example = EXAMPLES[key];

    if (!example) {
        console.error('Unknown example:', key);
        return;
    }

    currentLanguage = example.language;

    if (languageSelect) {
        languageSelect.value = example.language;
    }

    setEditorCode(example.code, example.language);

    if (quickExampleSelect) {
        quickExampleSelect.value = key;
    }

    const ide = document.getElementById('ide');

    if (ide && window.scrollY > 400) {
        ide.scrollIntoView({ behavior: 'smooth' });
    }
};

/* =========================================================
   RUN SIMULATION
   Compatible with POST /run: { language, code }
   ========================================================= */

async function runSimulation() {
    const code = getEditorCode().trim();

    if (!code) {
        alert('Please enter code before running the simulation.');
        return;
    }

    if (!runBtn) return;

    runBtn.disabled = true;
    runBtn.textContent = 'Simulating...';

    if (execBadge) {
        execBadge.className = 'status-pill status-running';
        execBadge.textContent = 'Running';
    }

    if (execTime) {
        execTime.textContent = 'Executing...';
    }

    if (consoleOutput) {
        consoleOutput.textContent = 'Submitting code to simulation engine...\n';
        consoleOutput.className = 'terminal-view';
    }

    try {
        const response = await fetch('/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                language: currentLanguage,
                code
            })
        });

        const rawText = await response.text();

        let data;

        try {
            data = JSON.parse(rawText);
        } catch {
            throw new Error(
                `Backend returned invalid JSON (HTTP ${response.status}). ` +
                rawText.slice(0, 500)
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error || `HTTP request failed: ${response.status}`
            );
        }

        currentResults = data;
        renderSimulationResults(data);
    } catch (error) {
        console.error('Simulation error:', error);

        if (execBadge) {
            execBadge.className = 'status-pill status-error';
            execBadge.textContent = 'Error';
        }

        if (execTime) {
            execTime.textContent = '--';
        }

        if (consoleOutput) {
            consoleOutput.className = 'terminal-view error';
            consoleOutput.textContent =
                `Simulation request failed.\n${error.message}`;
        }

        if (waveformContainer) {
            waveformContainer.innerHTML = emptyPlaceholder(
                '📈',
                'Waveform Unavailable',
                'The backend did not return usable simulation results.'
            );
        }

        currentResults = null;
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Simulation';
    }
}

/* =========================================================
   RESULT RENDERING
   ========================================================= */

function renderSimulationResults(data) {
    const hasError = !data.success || Boolean(data.error);

    if (execBadge) {
        execBadge.className =
            `status-pill ${hasError ? 'status-error' : 'status-success'}`;

        execBadge.textContent = hasError ? 'Failed' : 'Success';
    }

    if (execTime) {
        execTime.textContent =
            `Execution Time: ${data.executionTimeMs ?? '--'} ms`;
    }

    let output = data.output || '';

    if (data.error) {
        output += (output ? '\n\n' : '') + `[ERROR]: ${data.error}`;
    }

    if (consoleOutput) {
        consoleOutput.textContent =
            output || 'Simulation completed with no standard output.';

        consoleOutput.className =
            `terminal-view ${hasError ? 'error' : 'success'}`;
    }

    // Digital Verilog waveform
    const signals = data.waveform?.signals;

    if (Array.isArray(signals) && signals.length > 0) {
        if (waveformBadge) {
            waveformBadge.textContent = signals.length;
        }

        renderWaveform(data.waveform);

        if (waveInfo) {
            waveInfo.textContent =
                `${signals.length} signal(s) plotted. ` +
                `Duration: ${data.waveform.duration ?? '--'} ` +
                `${data.waveform.timescale || 'simulation ticks'}`;
        }
    } else {
        if (waveformBadge) waveformBadge.textContent = '0';
        if (waveInfo) waveInfo.textContent = 'No waveform data';

        if (waveformContainer) {
            waveformContainer.innerHTML = emptyPlaceholder(
                '📈',
                'No Waveform Data',
                hasError
                    ? 'Check the simulation error in the Console tab.'
                    : 'No signal transitions were recorded.'
            );
        }
    }

    // MATLAB / GNU Octave figures
    const plots = Array.isArray(data.plots)
        ? data.plots
        : Array.isArray(data.figures)
            ? data.figures
            : [];

    const usablePlots = plots.filter(plot =>
        plot &&
        (plot.image || plot.dataUrl ||
         (Array.isArray(plot.series) && plot.series.length))
    );

    if (usablePlots.length > 0) {
        if (plotsBadge) plotsBadge.textContent = usablePlots.length;
        if (plotsInfo) {
            plotsInfo.textContent =
                `${usablePlots.length} plot figure(s) generated`;
        }

        renderPlots(usablePlots);

        if (downloadPlotBtn) {
            downloadPlotBtn.style.display = 'inline-block';
        }
    } else {
        if (plotsBadge) plotsBadge.textContent = '0';
        if (plotsInfo) plotsInfo.textContent = 'No plots generated';

        if (plotsContainer) {
            plotsContainer.innerHTML = emptyPlaceholder(
                '📊',
                'No Graphical Plots',
                'Use plot(), stem(), stairs(), or bar() in MATLAB/Octave.'
            );
        }

        if (downloadPlotBtn) {
            downloadPlotBtn.style.display = 'none';
        }
    }

    // Circuit schematic
    if (
        data.circuitDiagram &&
        Array.isArray(data.circuitDiagram.gates) &&
        data.circuitDiagram.gates.length
    ) {
        renderSchematic(data.circuitDiagram.gates);
    } else if (schematicContainer) {
        schematicContainer.innerHTML = emptyPlaceholder(
            '🔲',
            'No Schematic Available',
            'Simple Verilog gate-level assignments can generate a schematic.'
        );
    }

    // Raw VCD
    if (rawVcdOutput) {
        rawVcdOutput.textContent =
            data.rawVcd || 'No VCD output recorded.';
    }

    if (downloadVcdBtn) {
        downloadVcdBtn.style.display =
            data.rawVcd ? 'inline-block' : 'none';
    }

    // Select the most useful result tab
    if (hasError) {
        activateTab('tab-console');
    } else if (Array.isArray(signals) && signals.length) {
        activateTab('tab-waveform');
    } else if (usablePlots.length) {
        activateTab('tab-plots');
    } else {
        activateTab('tab-console');
    }
}

function emptyPlaceholder(icon, title, message) {
    return `
        <div class="empty-placeholder">
            <div class="placeholder-icon">${icon}</div>
            <h4>${escapeHtml(title)}</h4>
            <p>${escapeHtml(message)}</p>
        </div>`;
}

function activateTab(tabId) {
    if (!tabId) return;

    document.querySelectorAll('.tab-btn').forEach(button => {
        button.classList.toggle(
            'active',
            button.getAttribute('data-tab') === tabId
        );
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

function clearOutput() {
    if (consoleOutput) {
        consoleOutput.textContent =
            'Ready. Select a language and click Run Simulation.';
        consoleOutput.className = 'terminal-view';
    }

    if (waveformContainer) {
        waveformContainer.innerHTML =
            emptyPlaceholder('📈', 'No Waveforms', 'Run a simulation to begin.');
    }

    if (plotsContainer) {
        plotsContainer.innerHTML =
            emptyPlaceholder('📊', 'No Plots', 'Run a MATLAB/Octave script.');
    }

    if (schematicContainer) {
        schematicContainer.innerHTML =
            emptyPlaceholder('🔲', 'No Schematic', 'No circuit generated yet.');
    }

    if (rawVcdOutput) {
        rawVcdOutput.textContent = 'No VCD data.';
    }

    if (execBadge) {
        execBadge.className = 'status-pill status-ready';
        execBadge.textContent = 'Ready';
    }

    if (execTime) execTime.textContent = 'Execution Time: --';
    if (waveformBadge) waveformBadge.textContent = '0';
    if (plotsBadge) plotsBadge.textContent = '0';
    if (waveInfo) waveInfo.textContent = 'No waveform data';
    if (plotsInfo) plotsInfo.textContent = 'No plots generated';

    if (downloadPlotBtn) downloadPlotBtn.style.display = 'none';
    if (downloadVcdBtn) downloadVcdBtn.style.display = 'none';

    currentResults = null;
}

/* =========================================================
   DIGITAL WAVEFORM RENDERER
   Supports the backend's points/values and t/v formats.
   ========================================================= */

function renderWaveform(waveform) {
    if (!waveformContainer) return;

    const signals = Array.isArray(waveform?.signals)
        ? waveform.signals
        : [];

    if (!signals.length) {
        waveformContainer.innerHTML =
            emptyPlaceholder('📈', 'No Waveforms', 'No signals to display.');
        return;
    }

    const normalizedSignals = signals.map(signal => {
        const sourcePoints = Array.isArray(signal.values)
            ? signal.values
            : Array.isArray(signal.points)
                ? signal.points
                : [];

        const points = sourcePoints.map(point => ({
            t: Number(point.t ?? point.time ?? 0),
            v: String(point.v ?? point.value ?? 'x')
        })).filter(point => Number.isFinite(point.t));

        return {
            name: String(signal.name || 'signal'),
            points
        };
    }).filter(signal => signal.points.length);

    if (!normalizedSignals.length) {
        waveformContainer.innerHTML =
            emptyPlaceholder('📈', 'No Signal Points', 'No valid waveform samples were returned.');
        return;
    }

    const times = normalizedSignals.flatMap(signal =>
        signal.points.map(point => point.t)
    );

    let minTime = Number.isFinite(Number(waveform.minTime))
        ? Number(waveform.minTime)
        : Math.min(...times);

    let maxTime = Number.isFinite(Number(waveform.maxTime))
        ? Number(waveform.maxTime)
        : Math.max(...times);

    if (maxTime <= minTime) {
        maxTime = minTime + 1;
    }

    const width = Math.max(900, Math.round(1100 * waveZoomLevel));
    const left = 170;
    const right = 40;
    const top = 55;
    const rowHeight = 58;
    const signalHeight = 28;
    const bottom = 45;

    const height = top + rowHeight * normalizedSignals.length + bottom;
    const plotWidth = width - left - right;

    const timeToX = time =>
        left + ((time - minTime) / (maxTime - minTime)) * plotWidth;

    const esc = escapeHtml;

    let svg = `
    <svg id="waveSvgElement"
         class="waveform-svg"
         viewBox="0 0 ${width} ${height}"
         xmlns="http://www.w3.org/2000/svg"
         role="img"
         aria-label="Digital timing waveform">
      <rect width="${width}" height="${height}" fill="#050b14"/>
    `;

    // Time grid
    for (let i = 0; i <= 10; i++) {
        const t = minTime + (i / 10) * (maxTime - minTime);
        const x = timeToX(t);

        svg += `
          <line x1="${x}" y1="${top - 20}"
                x2="${x}" y2="${height - bottom}"
                stroke="#203047" stroke-dasharray="3,3"/>
          <text x="${x}" y="${top - 28}"
                fill="#94a3b8" font-size="11"
                text-anchor="middle">
            ${Number(t.toPrecision(5))} ${esc(waveform.timescale || '')}
          </text>`;
    }

    normalizedSignals.forEach((signal, index) => {
        const rowTop = top + index * rowHeight;
        const yHigh = rowTop + 5;
        const yLow = rowTop + signalHeight;
        const yMid = (yHigh + yLow) / 2;

        svg += `
          <line x1="0" y1="${rowTop + rowHeight - 5}"
                x2="${width}" y2="${rowTop + rowHeight - 5}"
                stroke="#142033"/>
          <rect x="0" y="${rowTop - 5}"
                width="${left - 10}" height="${rowHeight - 5}"
                fill="#08101e"/>
          <text x="12" y="${yMid + 4}"
                fill="#38bdf8" font-size="12"
                font-family="monospace">${esc(signal.name)}</text>`;

        const points = signal.points.slice().sort((a, b) => a.t - b.t);

        // Remove redundant duplicate samples at the same time and value.
        const clean = [];

        for (const point of points) {
            const previous = clean[clean.length - 1];

            if (
                previous &&
                previous.t === point.t &&
                previous.v === point.v
            ) {
                continue;
            }

            clean.push(point);
        }

        let path = '';

        clean.forEach((point, i) => {
            const x = timeToX(point.t);
            const value = point.v.toLowerCase();

            const y = value === '1'
                ? yHigh
                : value === '0'
                    ? yLow
                    : yMid;

            if (i === 0) {
                path += `M ${x} ${y}`;
            } else {
                const previous = clean[i - 1];
                const previousY = previous.v.toLowerCase() === '1'
                    ? yHigh
                    : previous.v.toLowerCase() === '0'
                        ? yLow
                        : yMid;

                path += ` L ${x} ${previousY} L ${x} ${y}`;
            }

            const next = clean[i + 1];
            const endX = next ? timeToX(next.t) : timeToX(maxTime);

            path += ` L ${Math.max(x, endX)} ${y}`;
        });

        svg += `
          <path d="${path}"
                fill="none"
                stroke="#00e5ff"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"/>`;
    });

    svg += '</svg>';
    waveformContainer.innerHTML = svg;
}

/* =========================================================
   MATLAB / OCTAVE PLOT RENDERER
   ========================================================= */

function normalizeImageDataUrl(image) {
    if (typeof image !== 'string' || !image) return '';

    // Accept both valid data URLs and the legacy "=" separator
    // produced by the currently supplied simulator.js.
    if (image.startsWith('data:image/png;base64=')) {
        return image.replace(
            'data:image/png;base64=',
            'data:image/png;base64,'
        );
    }

    return image;
}

function renderPlots(plots) {
    if (!plotsContainer) return;

    let html = '';

    plots.forEach((plot, index) => {
        const title = plot.title || plot.name || `Figure ${index + 1}`;
        const image = normalizeImageDataUrl(plot.image || plot.dataUrl || '');

        html += `<div class="plot-card">`;
        html += `<h4>${escapeHtml(title)}</h4>`;

        if (image) {
            html += `
                <img
                    src="${escapeHtml(image)}"
                    class="plot-image"
                    alt="${escapeHtml(title)}"
                    loading="lazy"
                />`;
        } else if (Array.isArray(plot.series) && plot.series.length) {
            html += renderSvgPlotFromSeries(plot);
        } else {
            html += '<p>No usable plot image or series data was returned.</p>';
        }

        html += '</div>';
    });

    plotsContainer.innerHTML = html;
}

function renderSvgPlotFromSeries(plot) {
    const width = 800;
    const height = 400;

    const padLeft = 65;
    const padRight = 25;
    const padTop = 30;
    const padBottom = 50;

    const series = (plot.series || []).map(item => {
        const xs = Array.isArray(item.x)
            ? item.x.map(Number)
            : [];

        const ys = Array.isArray(item.y)
            ? item.y.map(Number)
            : [];

        const points = [];

        for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
            if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
                points.push({ x: xs[i], y: ys[i] });
            }
        }

        return { name: item.name || '', points };
    }).filter(item => item.points.length);

    if (!series.length) {
        return '<p>No numeric plot data is available.</p>';
    }

    const allX = series.flatMap(item => item.points.map(point => point.x));
    const allY = series.flatMap(item => item.points.map(point => point.y));

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    const dx = maxX === minX ? 1 : maxX - minX;
    const dy = maxY === minY ? 1 : maxY - minY;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const mapX = x => padLeft + ((x - minX) / dx) * plotWidth;
    const mapY = y => height - padBottom - ((y - minY) / dy) * plotHeight;

    let svg = `
    <svg viewBox="0 0 ${width} ${height}"
         class="plot-image"
         xmlns="http://www.w3.org/2000/svg"
         role="img"
         aria-label="${escapeHtml(plot.title || 'Scientific plot')}">
      <rect width="${width}" height="${height}" fill="#050b14"/>
    `;

    for (let i = 0; i <= 5; i++) {
        const fraction = i / 5;
        const yValue = minY + fraction * dy;
        const y = mapY(yValue);
        const xValue = minX + fraction * dx;
        const x = mapX(xValue);

        svg += `
          <line x1="${padLeft}" y1="${y}"
                x2="${width - padRight}" y2="${y}"
                stroke="#203047" stroke-dasharray="3,3"/>
          <text x="${padLeft - 8}" y="${y + 4}"
                fill="#94a3b8" font-size="11"
                text-anchor="end">${yValue.toPrecision(4)}</text>
          <line x1="${x}" y1="${padTop}"
                x2="${x}" y2="${height - padBottom}"
                stroke="#203047" stroke-dasharray="3,3"/>
          <text x="${x}" y="${height - padBottom + 18}"
                fill="#94a3b8" font-size="11"
                text-anchor="middle">${xValue.toPrecision(4)}</text>`;
    }

    svg += `
      <line x1="${padLeft}" y1="${padTop}"
            x2="${padLeft}" y2="${height - padBottom}"
            stroke="#64748b"/>
      <line x1="${padLeft}" y1="${height - padBottom}"
            x2="${width - padRight}" y2="${height - padBottom}"
            stroke="#64748b"/>`;

    const colors = ['#38bdf8', '#f97316', '#10b981', '#a855f7', '#f43f5e'];

    series.forEach((item, index) => {
        const color = colors[index % colors.length];

        const path = item.points.map((point, pointIndex) => {
            const command = pointIndex === 0 ? 'M' : 'L';

            return `${command} ${mapX(point.x)} ${mapY(point.y)}`;
        }).join(' ');

        svg += `
          <path d="${path}"
                fill="none"
                stroke="${color}"
                stroke-width="2"
                stroke-linejoin="round"/>`;
    });

    svg += '</svg>';

    return svg;
}

/* =========================================================
   CIRCUIT SCHEMATIC
   ========================================================= */

function renderSchematic(gates) {
    if (!schematicContainer || !Array.isArray(gates) || !gates.length) {
        return;
    }

    const width = 850;
    const gateHeight = 44;
    const rowHeight = 85;
    const height = Math.max(380, gates.length * rowHeight + 60);

    let svg = `
      <svg class="schematic-svg"
           viewBox="0 0 ${width} ${height}"
           xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#060e1b"/>
    `;

    gates.forEach((gate, index) => {
        const x = 350;
        const y = 35 + index * rowHeight;
        const gateWidth = 100;

        svg += `
          <rect x="${x}" y="${y}" width="${gateWidth}" height="${gateHeight}"
                rx="6" fill="#172554" stroke="#3b82f6" stroke-width="2"/>
          <text x="${x + gateWidth / 2}" y="${y + 18}"
                fill="#93c5fd" font-size="12" font-weight="700"
                text-anchor="middle">${escapeHtml(gate.gate)}</text>
          <text x="${x + gateWidth / 2}" y="${y + 34}"
                fill="#60a5fa" font-size="10"
                text-anchor="middle">${escapeHtml(gate.output)}</text>`;

        (gate.inputs || []).forEach((input, inputIndex) => {
            const inputY = y + 10 + inputIndex * 12;

            svg += `
              <line x1="120" y1="${inputY}" x2="${x}" y2="${inputY}"
                    stroke="#64748b" stroke-width="1.5"/>
              <circle cx="120" cy="${inputY}" r="3" fill="#38bdf8"/>
              <text x="110" y="${inputY + 4}"
                    fill="#f1f5f9" font-size="10"
                    text-anchor="end">${escapeHtml(input)}</text>`;
        });

        const outputY = y + gateHeight / 2;

        svg += `
          <line x1="${x + gateWidth}" y1="${outputY}"
                x2="720" y2="${outputY}"
                stroke="#10b981" stroke-width="2"/>
          <circle cx="720" cy="${outputY}" r="4" fill="#10b981"/>
          <text x="732" y="${outputY + 4}"
                fill="#34d399" font-size="11">${escapeHtml(gate.output)}</text>`;
    });

    svg += '</svg>';
    schematicContainer.innerHTML = svg;
}

/* =========================================================
   DOWNLOADS
   ========================================================= */

function downloadConsoleOutput() {
    downloadFile(
        consoleOutput?.textContent || '',
        'simulation_output.txt',
        'text/plain;charset=utf-8'
    );
}

function downloadWaveformSvg() {
    const svg = document.getElementById('waveSvgElement');

    if (!svg) {
        alert('No waveform is available to download.');
        return;
    }

    const svgXml = new XMLSerializer().serializeToString(svg);

    downloadFile(svgXml, 'waveform.svg', 'image/svg+xml;charset=utf-8');
}

function downloadPlotPng() {
    const plots = currentResults?.plots || currentResults?.figures || [];

    const firstPlot = plots.find(plot =>
        plot.image || plot.dataUrl
    );

    if (!firstPlot) {
        alert('No plot image is available to download.');
        return;
    }

    const image = normalizeImageDataUrl(firstPlot.image || firstPlot.dataUrl);

    const anchor = document.createElement('a');
    anchor.href = image;
    anchor.download = 'plot.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function downloadVcdFile() {
    if (!currentResults?.rawVcd) {
        alert('No VCD file is available.');
        return;
    }

    downloadFile(currentResults.rawVcd, 'simulation.vcd', 'text/plain');
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   BACKEND HEALTH
   Compatible with string or object engine-status responses.
   ========================================================= */

function formatEngineVersion(value, fallback) {
    if (!value) return fallback;

    if (typeof value === 'string') {
        return value.split('\n')[0];
    }

    if (typeof value === 'object') {
        return value.version || value.path ||
            (value.available === false ? 'Not installed' : fallback);
    }

    return fallback;
}

async function checkBackendHealth() {
    if (!engineStatusText) return;

    try {
        const response = await fetch('/health');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success === false) {
            throw new Error(data.message || 'Backend health check failed.');
        }

        const simulators = data.simulators || {};

        const verilog = formatEngineVersion(
            simulators.verilog,
            'Icarus Verilog'
        );

        const matlab = formatEngineVersion(
            simulators.matlab || simulators.octave,
            'GNU Octave'
        );

        engineStatusText.textContent =
            `Backend Online | Verilog: ${verilog} | MATLAB/Octave: ${matlab}`;

        const dot = document.querySelector('.status-indicator-dot');

        if (dot) {
            dot.classList.remove('offline');
        }
    } catch (error) {
        engineStatusText.textContent =
            `Backend Offline or Reconnecting: ${error.message}`;

        const dot = document.querySelector('.status-indicator-dot');

        if (dot) {
            dot.classList.add('offline');
        }
    }
}

/* =========================================================
   HELPERS
   ========================================================= */

async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.appendChild(textarea);
        textarea.select();

        const copied = document.execCommand('copy');
        textarea.remove();

        if (!copied) {
            throw new Error('Clipboard copy failed.');
        }
    } catch (error) {
        console.error('Copy failed:', error);
        alert('Unable to copy automatically. Please select and copy the text.');
    }
}

function showTempBtnText(button, text) {
    if (!button) return;

    const original = button.innerHTML;
    button.textContent = text;

    setTimeout(() => {
        button.innerHTML = original;
    }, 1500);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}