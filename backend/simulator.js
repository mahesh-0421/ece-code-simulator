'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const IS_WINDOWS = process.platform === 'win32';
const MAX_BUFFER = 30 * 1024 * 1024; // 30MB
const MAX_CODE_LENGTH = 500000;      // 500KB
const VERILOG_TIMEOUT = 30000;       // 30 seconds
const OCTAVE_TIMEOUT = 60000;        // 60 seconds

/* =========================================================
   GENERAL HELPERS & EXECUTION
   ========================================================= */

function makeTempDir(prefix) {
    const base = path.join(__dirname, 'temp');
    if (!fs.existsSync(base)) {
        try {
            fs.mkdirSync(base, { recursive: true });
        } catch {
            return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
        }
    }
    return fs.mkdtempSync(path.join(base, prefix));
}

function isFile(p) {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}

function isDirectory(p) {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function pathValue() {
    return process.env.PATH || process.env.Path || '';
}

function unique(items) {
    const seen = new Set();
    return items.filter(Boolean).map(p => path.resolve(p)).filter(p => {
        const key = IS_WINDOWS ? p.toLowerCase() : p;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function withExtraPath(dirs) {
    return unique([
        ...dirs.filter(isDirectory),
        ...pathValue().split(path.delimiter).filter(Boolean)
    ]).join(path.delimiter);
}

function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        env: {
            ...process.env,
            ...(options.env || {}),
            OCTAVE_HISTFILE: IS_WINDOWS ? 'NUL' : '/dev/null'
        },
        encoding: 'utf8',
        windowsHide: true,
        timeout: options.timeout || VERILOG_TIMEOUT,
        maxBuffer: MAX_BUFFER,
        shell: false
    });

    const stdout = (result.stdout || '').replace(/\r\n/g, '\n');
    const stderr = (result.stderr || '').replace(/\r\n/g, '\n');

    if (result.error) {
        return {
            success: false,
            code: typeof result.status === 'number' ? result.status : -1,
            stdout,
            stderr,
            error: result.error.message || 'Execution error.'
        };
    }

    return {
        success: result.status === 0,
        code: result.status,
        stdout,
        stderr,
        error: result.status === 0
            ? ''
            : stderr || stdout || `Process exited with code ${result.status}`
    };
}

function failure(error, startTime = Date.now(), extra = {}) {
    return {
        success: false,
        output: '',
        waveform: null,
        figures: [],
        plots: [],
        circuitDiagram: null,
        rawVcd: '',
        executionTimeMs: Date.now() - startTime,
        error,
        ...extra
    };
}

function findOnPath(names) {
    for (const dir of pathValue().split(path.delimiter).filter(Boolean)) {
        for (const name of names) {
            const candidate = path.join(dir, name);
            if (isFile(candidate)) return candidate;
        }
    }
    return null;
}

function findFiles(root, names, maxDepth = 5) {
    const found = [];
    const wanted = new Set(names.map(n => n.toLowerCase()));

    function walk(dir, depth) {
        if (!isDirectory(dir) || depth > maxDepth || found.length > 100) {
            return;
        }

        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isFile() && wanted.has(entry.name.toLowerCase())) {
                found.push(full);
            } else if (
                entry.isDirectory() &&
                depth < maxDepth &&
                !['node_modules', '.git', 'cache', 'packages'].includes(entry.name.toLowerCase())
            ) {
                walk(full, depth + 1);
            }
        }
    }

    walk(root, 0);
    return found;
}

/* =========================================================
   ENGINE DISCOVERY & CACHING
   ========================================================= */

let cachedIcarus = null;
let cachedOctave = null;

function locateIcarus() {
    if (cachedIcarus) return cachedIcarus;

    const ivName = IS_WINDOWS ? 'iverilog.exe' : 'iverilog';
    const vvpName = IS_WINDOWS ? 'vvp.exe' : 'vvp';
    const configured = process.env.ICARUS_BIN;

    if (configured) {
        const location = path.resolve(configured);
        const iv = isFile(location) ? location : path.join(location, ivName);
        const vvp = path.join(path.dirname(iv), vvpName);

        if (isFile(iv) && isFile(vvp)) {
            cachedIcarus = { iverilog: iv, vvp, bin: path.dirname(iv) };
            return cachedIcarus;
        }
    }

    const iv = findOnPath([ivName]);
    const vvp = findOnPath([vvpName]);

    if (iv && vvp) {
        cachedIcarus = { iverilog: iv, vvp, bin: path.dirname(iv) };
        return cachedIcarus;
    }

    const roots = IS_WINDOWS
        ? [
            'C:\\iverilog',
            'C:\\iverilog\\bin',
            'C:\\Icarus Verilog',
            'C:\\Program Files\\Icarus Verilog',
            'C:\\Program Files (x86)\\Icarus Verilog',
            'C:\\tools\\iverilog'
        ]
        : [
            '/usr/bin',
            '/usr/local/bin',
            '/opt/homebrew/bin',
            '/usr/local/opt/icarus-verilog/bin'
        ];

    if (IS_WINDOWS) {
        for (const key of ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA', 'USERPROFILE']) {
            if (process.env[key]) {
                roots.push(
                    path.join(process.env[key], 'Icarus Verilog'),
                    path.join(process.env[key], 'iverilog'),
                    path.join(process.env[key], 'tools', 'iverilog')
                );
            }
        }
    }

    for (const root of unique(roots)) {
        const files = findFiles(root, [ivName, vvpName], 6);
        const a = files.find(p => path.basename(p).toLowerCase() === ivName.toLowerCase());
        const b = files.find(p => path.basename(p).toLowerCase() === vvpName.toLowerCase());

        if (a && b) {
            cachedIcarus = { iverilog: a, vvp: b, bin: path.dirname(a) };
            return cachedIcarus;
        }
    }

    return null;
}

function locateOctave() {
    if (cachedOctave) return cachedOctave;

    const names = IS_WINDOWS ? ['octave-cli.exe', 'octave.exe'] : ['octave-cli', 'octave'];
    const configured = process.env.OCTAVE_BIN;

    if (configured) {
        const location = path.resolve(configured);
        if (isFile(location)) {
            cachedOctave = { exe: location, bin: path.dirname(location) };
            return cachedOctave;
        }
        for (const name of names) {
            const candidate = path.join(location, name);
            if (isFile(candidate)) {
                cachedOctave = { exe: candidate, bin: location };
                return cachedOctave;
            }
        }
    }

    const onPath = findOnPath(names);
    if (onPath) {
        cachedOctave = { exe: onPath, bin: path.dirname(onPath) };
        return cachedOctave;
    }

    const roots = IS_WINDOWS
        ? [
            'C:\\Program Files\\GNU Octave',
            'C:\\Program Files (x86)\\GNU Octave',
            'C:\\Octave',
            'C:\\tools\\octave'
        ]
        : [
            '/usr/bin',
            '/usr/local/bin',
            '/opt/homebrew/bin',
            '/Applications/Octave.app/Contents/Resources/usr/bin'
        ];

    for (const root of unique(roots)) {
        const files = findFiles(root, names, 7);
        if (files.length) {
            files.sort((a, b) =>
                Number(path.basename(b).toLowerCase().startsWith('octave-cli')) -
                Number(path.basename(a).toLowerCase().startsWith('octave-cli'))
            );
            cachedOctave = { exe: files[0], bin: path.dirname(files[0]) };
            return cachedOctave;
        }
    }

    return null;
}

function getEngineStatus() {
    const iv = locateIcarus();
    const oct = locateOctave();

    let ivVersion = 'Not installed';
    let octVersion = 'Not installed';

    if (iv) {
        try {
            const check = runCommand(iv.iverilog, ['-V']);
            const firstLine = (check.stdout || '').split('\n')[0].trim();
            ivVersion = firstLine || 'Installed';
        } catch {
            ivVersion = 'Installed';
        }
    }

    if (oct) {
        try {
            const check = runCommand(oct.exe, ['--version']);
            const firstLine = (check.stdout || '').split('\n')[0].trim();
            octVersion = firstLine || 'Installed';
        } catch {
            octVersion = 'Installed';
        }
    }

    return {
        verilog: {
            available: !!iv,
            path: iv ? iv.iverilog : null,
            version: ivVersion
        },
        matlab: {
            available: !!oct,
            path: oct ? oct.exe : null,
            version: octVersion
        }
    };
}

/* =========================================================
   SECURITY & SANITIZATION
   ========================================================= */

const FORBIDDEN_OCTAVE_PATTERNS = [
    /\bsystem\s*\(/i,
    /\bdos\s*\(/i,
    /\bunix\s*\(/i,
    /\bpopen\s*\(/i,
    /\bunlink\s*\(/i,
    /\brmdir\s*\(/i,
    /\bdelete\s*\(\s*['"][\\/]/i,
    /\bpython\s*\(/i,
    /\bperl\s*\(/i
];

function checkOctaveSecurity(code) {
    for (const pattern of FORBIDDEN_OCTAVE_PATTERNS) {
        if (pattern.test(code)) {
            return {
                safe: false,
                reason: 'Security Restriction: Operating system command calls (such as system(), unix(), dos(), popen()) are blocked in the online execution environment.'
            };
        }
    }
    return { safe: true };
}

/* =========================================================
   VERILOG PARSER & INJECTION
   ========================================================= */

function getModuleNames(code) {
    return [
        ...code.matchAll(/\bmodule\s+(?:(?:automatic|static)\s+)?([A-Za-z_$][\w$]*)/g)
    ].map(match => match[1]);
}

function isTestbench(name) {
    return /(^tb$|^tb_|_tb$|testbench|^test$)/i.test(name);
}

function selectTopModule(code, mode = 'both') {
    const modules = getModuleNames(code);
    if (!modules.length) {
        return { error: 'No Verilog module declaration found (expected: "module <name> ... endmodule").' };
    }

    const benches = modules.filter(isTestbench);
    const designs = modules.filter(name => !isTestbench(name));

    if (mode === 'main') {
        return designs.length
            ? { top: designs[0], modules }
            : { error: 'Mode "main" selected, but no design module was found (modules found: ' + modules.join(', ') + ').' };
    }

    if (mode === 'testbench') {
        return benches.length
            ? { top: benches[benches.length - 1], modules }
            : { error: 'Mode "testbench" selected, but no testbench module (tb, tb_*, *_tb, test, testbench) was found.' };
    }

    return {
        top: benches.length ? benches[benches.length - 1] : modules[modules.length - 1],
        modules
    };
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripDumpDirectives(code) {
    return code
        .replace(/\$dumpfile\s*\([^;]*\)\s*;?/gi, '')
        .replace(/\$dumpvars\s*\([^;]*\)\s*;?/gi, '')
        .replace(/\$dumpon\s*;?/gi, '')
        .replace(/\$dumpoff\s*;?/gi, '');
}

function injectDump(code, top) {
    const source = stripDumpDirectives(code);
    const moduleRegex = new RegExp(
        '\\bmodule\\s+(?:(?:automatic|static)\\s+)?' + escapeRegExp(top) + '\\b'
    );
    const match = moduleRegex.exec(source);
    if (!match) return source;

    const end = source.indexOf('endmodule', match.index);
    if (end < 0) return source;

    const dumpBlock = `
initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0);
end
`;
    return source.slice(0, end) + dumpBlock + source.slice(end);
}

/* =========================================================
   VCD WAVEFORM PARSER (BUS & SCALAR EXTRACTION)
   ========================================================= */

function parseVcd(text) {
    if (!text || !text.trim()) return null;

    const lines = text.split(/\r?\n/);
    const declarations = [];
    const idMap = new Map();
    const changes = [];

    let timescale = '1ns';
    let inHeader = true;
    let currentTime = 0;

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (line.startsWith('$timescale')) {
            const value = line.replace('$timescale', '').replace('$end', '').trim();
            if (value) timescale = value.replace(/\s+/g, ' ');
            continue;
        }

        if (line.startsWith('$var')) {
            const match = /^\$var\s+\S+\s+(\d+)\s+(\S+)\s+(\S+)(?:\s+\[([^\]]+)\])?\s+\$end/.exec(line);
            if (match) {
                const declaration = {
                    width: Number(match[1]),
                    id: match[2],
                    name: match[3],
                    range: match[4] || ''
                };
                declarations.push(declaration);
                if (!idMap.has(declaration.id)) {
                    idMap.set(declaration.id, []);
                }
                idMap.get(declaration.id).push(declaration);
            }
            continue;
        }

        if (line.startsWith('$enddefinitions')) {
            inHeader = false;
            continue;
        }

        if (inHeader || line.startsWith('$')) continue;

        if (line.startsWith('#')) {
            const time = Number(line.slice(1));
            if (Number.isFinite(time)) currentTime = time;
            continue;
        }

        let id = null;
        let value = null;

        if (/^[01xXzZ]\S*$/.test(line)) {
            value = line[0].toLowerCase();
            id = line.slice(1).trim();
        } else if (/^[bBrR][01xXzZ]+\s+\S+$/.test(line)) {
            const parts = line.split(/\s+/);
            value = parts[0].slice(1).toLowerCase();
            id = parts[1];
        }

        if (id && idMap.has(id)) {
            changes.push({ time: currentTime, id, value });
        }
    }

    const signals = [];
    const seenSignalNames = new Set();

    function addSignal(name, id, bitIndex = null) {
        if (seenSignalNames.has(name)) return;

        const points = [];

        for (const change of changes) {
            if (change.id !== id) continue;

            let value = change.value;
            if (bitIndex !== null && value.length > 1) {
                const offset = value.length - 1 - bitIndex;
                value = offset >= 0 ? value[offset] : '0';
            }

            const last = points[points.length - 1];
            if (!last || last.value !== value || last.time !== change.time) {
                points.push({
                    time: change.time,
                    value,
                    t: change.time,
                    v: value
                });
            }
        }

        if (points.length && points[0].time > 0) {
            points.unshift({
                time: 0,
                value: points[0].value,
                t: 0,
                v: points[0].value
            });
        }

        if (points.length) {
            seenSignalNames.add(name);
            signals.push({
                name,
                points,
                values: points
            });
        }
    }

    for (const declaration of declarations) {
        if (declaration.width <= 1) {
            addSignal(declaration.name, declaration.id);
            continue;
        }

        let left = declaration.width - 1;
        let right = 0;
        const range = /(-?\d+)\s*:\s*(-?\d+)/.exec(declaration.range);
        if (range) {
            left = Number(range[1]);
            right = Number(range[2]);
        }

        const step = left >= right ? -1 : 1;

        for (let bit = left; ; bit += step) {
            addSignal(
                `${declaration.name}[${bit}]`,
                declaration.id,
                bit
            );
            if (bit === right) break;
        }
    }

    if (!signals.length) return null;

    const duration = changes.length
        ? Math.max(...changes.map(change => change.time))
        : 0;

    return {
        type: 'digital',
        timescale,
        minTime: 0,
        maxTime: duration,
        duration,
        endTime: duration,
        signals
    };
}

/* =========================================================
   CIRCUIT DIAGRAM GENERATOR (GATE-LEVEL SCHEMATIC)
   ========================================================= */

function buildCircuitDiagram(code) {
    const gates = [];
    const regex = /\bassign\s+([A-Za-z_$][\w$]*(?:\s*\[[^\]]+\])?)\s*=\s*([^;]+);/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
        const output = match[1].replace(/\s+/g, '');
        const expression = match[2].trim();

        let gate = 'LOGIC';
        if (/~\s*\(?\s*[A-Za-z_$]/.test(expression)) {
            gate = 'NOT';
        } else if (/\^~|~\^/.test(expression)) {
            gate = 'XNOR';
        } else if (/\^/.test(expression)) {
            gate = 'XOR';
        } else if (/~\s*&/.test(expression)) {
            gate = 'NAND';
        } else if (/~\s*\|/.test(expression)) {
            gate = 'NOR';
        } else if (/&&|&/.test(expression)) {
            gate = 'AND';
        } else if (/\|\||\|/.test(expression)) {
            gate = 'OR';
        } else if (/\?/.test(expression)) {
            gate = 'MUX';
        }

        const inputs = [
            ...expression.matchAll(/[A-Za-z_$][\w$]*(?:\s*\[[^\]]+\])?/g)
        ]
            .map(item => item[0].replace(/\s+/g, ''))
            .filter(item =>
                !['and', 'or', 'not', 'xor', 'xnor', 'nand', 'nor'].includes(item.toLowerCase())
            );

        gates.push({
            output,
            gate,
            inputs: [...new Set(inputs)],
            expression
        });
    }

    // Instantiated gates: and g1(y, a, b);
    const gateRe = /\b(and|or|not|nand|nor|xor|xnor)\s+([A-Za-z_$][\w$]*)\s*\(([^)]+)\);/gi;
    while ((match = gateRe.exec(code)) !== null) {
        const type = match[1].toUpperCase();
        const pins = match[3].split(',').map(s => s.trim().replace(/\s+/g, '')).filter(Boolean);
        if (pins.length >= 2) {
            gates.push({
                output: pins[0],
                gate: type,
                inputs: pins.slice(1),
                expression: `${type}(${pins.slice(1).join(', ')})`
            });
        }
    }

    if (!gates.length) return null;

    return {
        type: 'schematic',
        gates
    };
}

/* =========================================================
   VERILOG RUNNER
   ========================================================= */

async function runVerilog(code, mode = 'both') {
    const startTime = Date.now();

    if (code.length > MAX_CODE_LENGTH) {
        return failure(`Source code exceeds maximum allowed size (${Math.round(code.length / 1024)} KB > 500 KB).`, startTime);
    }

    const tools = locateIcarus();
    if (!tools) {
        return failure('Icarus Verilog was not found. Please install iverilog and vvp or set ICARUS_BIN.', startTime);
    }

    const selected = selectTopModule(code, mode);
    if (!selected.top) {
        return {
            ...failure(selected.error, startTime),
            circuitDiagram: buildCircuitDiagram(code)
        };
    }

    const temp = makeTempDir('ece-verilog-');

    try {
        const sourceFile = path.join(temp, 'main.v');
        const outputFile = path.join(temp, 'simulation.out');
        const vcdFile = path.join(temp, 'dump.vcd');

        fs.writeFileSync(sourceFile, injectDump(code, selected.top), 'utf8');

        const env = {
            PATH: withExtraPath([tools.bin])
        };

        const compile = runCommand(
            tools.iverilog,
            ['-g2012', '-s', selected.top, '-o', outputFile, sourceFile],
            { cwd: temp, env, timeout: VERILOG_TIMEOUT }
        );

        if (!compile.success) {
            return {
                ...failure(compile.error || 'Verilog compilation failed.', startTime),
                output: [compile.stdout, compile.stderr].filter(Boolean).join('\n').trim(),
                circuitDiagram: buildCircuitDiagram(code),
                details: {
                    mode,
                    topModule: selected.top,
                    modules: selected.modules
                }
            };
        }

        const simulation = runCommand(
            tools.vvp,
            [outputFile],
            { cwd: temp, env, timeout: VERILOG_TIMEOUT }
        );

        const vcdText = isFile(vcdFile) ? fs.readFileSync(vcdFile, 'utf8') : '';
        const waveform = vcdText ? parseVcd(vcdText) : null;

        let error = '';
        if (!simulation.success) {
            error = simulation.error || 'Verilog simulation runtime error.';
        } else if (!waveform) {
            error = 'Simulation completed, but no VCD waveform was recorded. Check that your testbench toggles signals using delays (#10) and finishes with $finish.';
        }

        const output = [simulation.stdout, simulation.stderr].filter(Boolean).join('\n').trim();

        return {
            success: simulation.success && !!waveform,
            output: output || (simulation.success ? 'Verilog simulation completed successfully.' : ''),
            waveform,
            figures: [],
            plots: [],
            circuitDiagram: buildCircuitDiagram(code),
            rawVcd: vcdText ? vcdText.substring(0, 50000) : '',
            executionTimeMs: Date.now() - startTime,
            error,
            details: {
                mode,
                topModule: selected.top,
                modules: selected.modules,
                signalCount: waveform ? waveform.signals.length : 0
            }
        };
    } finally {
        try {
            fs.rmSync(temp, { recursive: true, force: true });
        } catch {}
    }
}

/* =========================================================
   GNU OCTAVE / MATLAB RUNNER
   ========================================================= */

function octaveQuote(value) {
    return String(value).replace(/\\/g, '/').replace(/'/g, "''");
}

function createOctaveRunner(userCode, temp) {
    const userFile = path.join(temp, 'user_code.m');
    const runnerFile = path.join(temp, 'runner.m');
    const diaryFile = path.join(temp, 'diary.txt');
    const errorFile = path.join(temp, 'octave_error.txt');
    const figureList = path.join(temp, 'figures.tsv');
    const dataFile = path.join(temp, 'waveform.tsv');

    fs.writeFileSync(userFile, userCode, 'utf8');

    const q = octaveQuote;
    const qt = q(temp);

    const script = `
warning('off', 'all');

try
    try
        graphics_toolkit('gnuplot');
    catch
    end

    set(0, 'defaultfigurevisible', 'off');

    try
        set(0, 'defaultaxesfontname', 'DejaVu Sans');
        set(0, 'defaulttextfontname', 'DejaVu Sans');
        set(0, 'defaultaxesfontsize', 10);
        set(0, 'defaulttextfontsize', 10);
    catch
    end

    diary('${q(diaryFile)}');
    run('${q(userFile)}');
    diary off;

catch err
    try
        diary off;
    catch
    end

    fid = fopen('${q(errorFile)}', 'w');
    if fid >= 0
        fprintf(fid, '%s\\n', err.message);
        for kk = 1:numel(err.stack)
            fprintf(fid, '  at %s (line %d)\\n', err.stack(kk).name, err.stack(kk).line);
        end
        fclose(fid);
    end
end

try
    figs = findall(0, 'type', 'figure');
catch
    figs = [];
end

fidfig = fopen('${q(figureList)}', 'w');
fiddata = fopen('${q(dataFile)}', 'w');

if fidfig >= 0 && fiddata >= 0
    for fi = 1:numel(figs)
        fh = figs(fi);
        imagefile = fullfile('${qt}', sprintf('figure_%02d.png', fi));

        try
            set(fh, 'visible', 'off');
            drawnow();
            print(fh, imagefile, '-dpng', '-r100');
        catch
            try
                saveas(fh, imagefile);
            catch
            end
        end

        nm = get(fh, 'name');
        if isempty(nm)
            nm = sprintf('Figure %d', fi);
        end

        if exist(imagefile, 'file') == 2
            fprintf(fidfig, 'FIG\\t%d\\t%s\\t%s\\n', fi, nm, imagefile);
        else
            fprintf(fidfig, 'FIG\\t%d\\t%s\\t%s\\n', fi, nm, '');
        end

        try
            axs = findall(fh, 'type', 'axes');
        catch
            axs = [];
        end

        for ai = 1:numel(axs)
            try
                ls = findall(axs(ai), 'type', 'line');
            catch
                ls = [];
            end

            for li = 1:numel(ls)
                lh = ls(li);
                xd = get(lh, 'xdata');
                yd = get(lh, 'ydata');

                if isempty(xd) || isempty(yd)
                    continue;
                end

                xd = xd(:);
                yd = yd(:);
                n = min(numel(xd), numel(yd));

                label = get(lh, 'displayname');
                if isempty(label)
                    label = sprintf('Series %d', li);
                end

                fprintf(fiddata, 'LINE\\t%d\\t%d\\t%d\\t%s\\n', fi, ai, li, label);

                for pi = 1:n
                    if isfinite(xd(pi)) && isfinite(yd(pi))
                        fprintf(fiddata, 'P\\t%.15g\\t%.15g\\n', xd(pi), yd(pi));
                    end
                end

                fprintf(fiddata, 'ENDLINE\\n');
            end
        end
    end

    fclose(fidfig);
    fclose(fiddata);
else
    if fidfig >= 0, fclose(fidfig); end
    if fiddata >= 0, fclose(fiddata); end
end

exit;
`;

    fs.writeFileSync(runnerFile, script, 'utf8');

    return {
        runnerFile,
        diaryFile,
        errorFile,
        figureList,
        dataFile
    };
}

function readOctaveResults(figureList, dataFile) {
    const figures = [];
    const series = [];

    if (isFile(dataFile)) {
        let current = null;
        const lines = fs.readFileSync(dataFile, 'utf8').split(/\r?\n/);

        for (const line of lines) {
            if (!line) continue;
            const parts = line.split('\t');

            if (parts[0] === 'LINE') {
                current = {
                    figure: Number(parts[1]),
                    axes: Number(parts[2]),
                    line: Number(parts[3]),
                    name: parts.slice(4).join('\t') || `Series ${parts[3]}`,
                    points: []
                };
                series.push(current);
            } else if (parts[0] === 'P' && current) {
                const x = Number(parts[1]);
                const y = Number(parts[2]);
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    current.points.push({ x, y });
                }
            } else if (parts[0] === 'ENDLINE') {
                current = null;
            }
        }
    }

    if (isFile(figureList)) {
        const lines = fs.readFileSync(figureList, 'utf8').split(/\r?\n/);

        for (const line of lines) {
            if (!line.startsWith('FIG\t')) continue;
            const parts = line.split('\t');
            const index = Number(parts[1]);
            const name = parts[2] || `Figure ${index}`;
            const imagePath = parts.slice(3).join('\t');

            let base64 = '';
            let dataUrl = '';

            if (imagePath && isFile(imagePath)) {
                base64 = fs.readFileSync(imagePath).toString('base64');
                dataUrl = 'data:image/png;base64=' + base64;
            }

            const figSeries = series
                .filter(s => s.figure === index)
                .map(s => ({
                    name: s.name,
                    x: s.points.map(p => p.x),
                    y: s.points.map(p => p.y)
                }));

            figures.push({
                id: index,
                index,
                title: name,
                name,
                image: dataUrl,
                dataUrl,
                series: figSeries
            });
        }
    }

    const signals = series.map(item => ({
        name: item.name,
        points: item.points.map(point => ({
            time: point.x,
            value: point.y,
            t: point.x,
            v: point.y
        })),
        values: item.points.map(point => ({
            time: point.x,
            value: point.y,
            t: point.x,
            v: point.y
        }))
    }));

    return { figures, series, signals };
}

async function runOctave(code) {
    const startTime = Date.now();

    if (code.length > MAX_CODE_LENGTH) {
        return failure(`Source code exceeds maximum allowed size (${Math.round(code.length / 1024)} KB > 500 KB).`, startTime);
    }

    const sec = checkOctaveSecurity(code);
    if (!sec.safe) {
        return failure(sec.reason, startTime);
    }

    const octave = locateOctave();
    if (!octave) {
        return failure('GNU Octave was not found. Please install octave-cli or set OCTAVE_BIN.', startTime);
    }

    const temp = makeTempDir('ece-octave-');

    try {
        const files = createOctaveRunner(code, temp);

        const result = runCommand(
            octave.exe,
            ['--quiet', '--no-gui', '--no-history', files.runnerFile],
            {
                cwd: temp,
                env: {
                    PATH: withExtraPath([octave.bin]),
                    GNUTERM: 'pngcairo'
                },
                timeout: OCTAVE_TIMEOUT
            }
        );

        const diary = isFile(files.diaryFile) ? fs.readFileSync(files.diaryFile, 'utf8').trim() : '';
        const errorText = isFile(files.errorFile) ? fs.readFileSync(files.errorFile, 'utf8').trim() : '';

        const captured = readOctaveResults(files.figureList, files.dataFile);

        const output = [result.stdout, result.stderr, diary].filter(Boolean).join('\n').trim();

        let error = errorText || (!result.success ? result.error : '');

        const allTimes = captured.signals.flatMap(s => s.values.map(v => v.t));
        const minTime = allTimes.length ? Math.min(...allTimes) : 0;
        const maxTime = allTimes.length ? Math.max(...allTimes) : 0;

        const waveform = captured.signals.length
            ? {
                type: 'analog',
                duration: maxTime - minTime,
                minTime,
                maxTime,
                series: captured.series,
                signals: captured.signals
            }
            : null;

        if (!error && !captured.figures.length && !captured.signals.length) {
            error = 'The script ran but no plot was captured. Ensure your code calls plot, stem, stairs, or bar.';
        }

        const success = result.success && !errorText;

        return {
            success,
            output: output || (success ? 'MATLAB/Octave code executed successfully.' : ''),
            waveform,
            figures: captured.figures,
            plots: captured.figures,
            circuitDiagram: null,
            rawVcd: '',
            executionTimeMs: Date.now() - startTime,
            error,
            details: {
                simulator: octave.exe,
                plotCount: captured.figures.length,
                seriesCount: captured.series.length
            }
        };
    } finally {
        try {
            fs.rmSync(temp, { recursive: true, force: true });
        } catch {}
    }
}

const runMatlab = runOctave;

/* =========================================================
   PUBLIC ROUTER API
   ========================================================= */

async function runCode(language, code, mode = 'both') {
    if (typeof language !== 'string' || typeof code !== 'string') {
        return failure('Language and code must be strings.');
    }

    if (!code.trim()) {
        return failure('Please enter code before running the simulation.');
    }

    const lang = language.toLowerCase().trim();

    if (lang.includes('verilog') || lang === 'v' || lang.includes('systemverilog')) {
        const selectedMode = String(mode).toLowerCase().trim();
        if (!['main', 'testbench', 'both'].includes(selectedMode)) {
            return failure('Invalid Verilog mode. Choose main, testbench, or both.');
        }
        return await runVerilog(code, selectedMode);
    }

    if (lang.includes('matlab') || lang.includes('octave') || lang === 'm') {
        return await runOctave(code);
    }

    return failure(`Unsupported language: "${language}". Choose Verilog, MATLAB, or GNU Octave.`);
}

module.exports = {
    runCode,
    runVerilog,
    runOctave,
    runMatlab,
    locateIcarus,
    locateOctave,
    getEngineStatus,
    parseVcd,
    buildCircuitDiagram
};