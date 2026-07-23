/**
 * Bill-Hive Image Editor  v2.0.0
 * ─────────────────────────────────
 * Crop / scale / brightness / grayscale / invert / colour-extraction /
 * padding tool. Self-contained, no framework dependency — imported for its
 * side effect (it attaches window.BHImageEditor) so it can be dropped into
 * any page.
 *
 * v2 rewrite: the crop box is now a real DOM overlay (not canvas
 * hit-testing), driven entirely by the Pointer Events API so mouse, touch,
 * and pen all work identically. The old version sized the preview canvas
 * with CSS `object-fit: contain`, which letterboxes non-matching aspect
 * ratios — the crop math assumed the display rect was the image bounds,
 * so clicks drifted out of alignment on tall/wide images. This version
 * sizes the canvas buffer to exactly match its CSS size, so there's no
 * letterboxing and no coordinate drift.
 *
 * Usage:
 *   import '../utils/imageEditor';
 *   ...
 *   window.BHImageEditor.open(dataUrl, { title: 'Edit Logo' })
 *     .then(editedDataUrl => { ... })   // user clicked Apply
 *     .catch(() => { ... });            // user cancelled
 */
(function (global) {
    'use strict';

    const PREVIEW_MAX_W = 420;
    const PREVIEW_MAX_H = 320;
    const MIN_BOX = 24; // smallest crop box side, in preview px

    const ASPECTS = [
        { key: 'free', label: 'Free', ratio: null },
        { key: '1:1', label: 'Square 1:1', ratio: 1 },
        { key: '4:3', label: 'Standard 4:3', ratio: 4 / 3 },
        { key: '3:4', label: 'Portrait 3:4', ratio: 3 / 4 },
        { key: '16:9', label: 'Widescreen 16:9', ratio: 16 / 9 },
        { key: '9:16', label: 'Tall 9:16', ratio: 9 / 16 },
        { key: '4:1', label: 'Banner 4:1', ratio: 4 / 1 },
        { key: '1:4', label: 'Tall Banner 1:4', ratio: 1 / 4 }
    ];

    /* ─── State ─── */
    let _resolve, _reject;
    let _originalImg = null;
    let _originalUrl = '';

    let _adj = {};
    const ADJ_DEFAULTS = {
        brightness: 0, grayscale: 0, invert: 0,
        scaleX: 100, scaleY: 100, lockAspect: true,
        padding: 0, paddingColor: '#ffffff', paddingTransparent: false
    };

    // Crop box, kept in PREVIEW pixels (matches the live canvas's CSS size exactly — no letterboxing)
    let _box = { x: 0, y: 0, w: 0, h: 0 };
    let _cropAspectKey = 'free';
    let _previewScale = 1;   // preview px per source px
    let _previewW = 0, _previewH = 0;

    let _drag = null; // { mode: 'move'|'resize', handle, startClientX, startClientY, startBox }
    let _palette = [];

    let _modal, _canvas, _ctx, _cropBoxEl, _canvasWrap;

    /* ────────────────────────────────────────────────
       Public API
    ──────────────────────────────────────────────── */
    const BHImageEditor = {
        open(dataUrl, opts = {}) {
            return new Promise((resolve, reject) => {
                _resolve = resolve;
                _reject = reject;
                _originalUrl = dataUrl;
                _adj = { ...ADJ_DEFAULTS };
                _cropAspectKey = 'free';
                _palette = [];

                _ensureModal();
                _loadImage(dataUrl, () => {
                    _setupPreview();
                    _resetUI();
                    _render();
                    _extractPalette();
                });

                const titleEl = document.getElementById('bhe-title');
                if (titleEl) titleEl.textContent = opts.title || 'Edit Image';

                _modal.classList.add('bhe-active');
                document.body.style.overflow = 'hidden';
            });
        }
    };

    /* ────────────────────────────────────────────────
       Modal HTML injection
    ──────────────────────────────────────────────── */
    function _ensureModal() {
        if (document.getElementById('bhe-modal')) return;

        const el = document.createElement('div');
        el.id = 'bhe-modal';
        el.innerHTML = `
<div class="bhe-overlay" id="bhe-overlay"></div>
<div class="bhe-dialog">
  <div class="bhe-header">
    <span class="bhe-title" id="bhe-title">Edit Image</span>
    <button class="bhe-close" id="bhe-close" title="Cancel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="bhe-body">
    <div class="bhe-canvas-wrap" id="bhe-canvas-wrap">
      <canvas id="bhe-canvas"></canvas>
      <div class="bhe-crop-box" id="bhe-crop-box">
        ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<div class="bhe-crop-handle" data-handle="${h}"></div>`).join('')}
      </div>
    </div>

    <div class="bhe-tabs">
      <button class="bhe-tab bhe-tab-active" data-tab="adjust">Adjust</button>
      <button class="bhe-tab" data-tab="crop">Crop</button>
      <button class="bhe-tab" data-tab="colours">Colours</button>
    </div>

    <!-- Adjust panel -->
    <div class="bhe-panel" id="bhe-panel-adjust">
      <div class="bhe-row">
        <label class="bhe-label">Brightness</label>
        <div class="bhe-slider-wrap">
          <input type="range" id="bhe-brightness" min="-100" max="100" step="1" value="0">
          <span class="bhe-val" id="bhe-brightness-val">0</span>
        </div>
      </div>
      <div class="bhe-row">
        <label class="bhe-label">Grayscale</label>
        <div class="bhe-slider-wrap">
          <input type="range" id="bhe-grayscale" min="0" max="100" step="1" value="0">
          <span class="bhe-val" id="bhe-grayscale-val">0%</span>
        </div>
      </div>
      <div class="bhe-row bhe-row-toggle">
        <label class="bhe-label">Invert Colours</label>
        <label class="bhe-toggle">
          <input type="checkbox" id="bhe-invert">
          <span class="bhe-toggle-thumb"></span>
        </label>
      </div>

      <div class="bhe-divider"></div>

      <div class="bhe-row">
        <label class="bhe-label">Width <small>px</small></label>
        <div class="bhe-wh-wrap">
          <input type="number" id="bhe-width" class="bhe-num" min="1" max="4000">
          <button class="bhe-lock-btn" id="bhe-lock-btn" title="Lock aspect ratio">
            <svg id="bhe-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>
          <input type="number" id="bhe-height" class="bhe-num" min="1" max="4000">
        </div>
      </div>
    </div>

    <!-- Crop panel -->
    <div class="bhe-panel bhe-panel-hidden" id="bhe-panel-crop">
      <p class="bhe-hint">Drag the box on the image, or use a handle to resize it. Corner handles keep the aspect ratio when one is selected below.</p>

      <div class="bhe-row">
        <label class="bhe-label">Aspect Ratio</label>
        <select id="bhe-crop-aspect" class="bhe-select">
          ${ASPECTS.map((a) => `<option value="${a.key}">${a.label}</option>`).join('')}
        </select>
      </div>

      <div class="bhe-crop-grid">
        <div class="bhe-row"><label class="bhe-label">X</label><input type="number" id="bhe-crop-x" class="bhe-num" min="0" value="0"></div>
        <div class="bhe-row"><label class="bhe-label">Y</label><input type="number" id="bhe-crop-y" class="bhe-num" min="0" value="0"></div>
        <div class="bhe-row"><label class="bhe-label">W</label><input type="number" id="bhe-crop-w" class="bhe-num" min="1" value="0"></div>
        <div class="bhe-row"><label class="bhe-label">H</label><input type="number" id="bhe-crop-h" class="bhe-num" min="1" value="0"></div>
      </div>
      <div class="bhe-crop-actions">
        <button class="bhe-btn bhe-btn-sm" id="bhe-crop-reset">Reset to Full Image</button>
      </div>

      <div class="bhe-divider"></div>

      <div class="bhe-row">
        <label class="bhe-label">Padding <small>shrinks the image within a border</small></label>
        <div class="bhe-slider-wrap">
          <input type="range" id="bhe-padding" min="0" max="30" step="1" value="0">
          <span class="bhe-val" id="bhe-padding-val">0%</span>
        </div>
      </div>
      <div class="bhe-row" id="bhe-padding-color-row">
        <label class="bhe-label">Padding Colour</label>
        <div class="bhe-wh-wrap">
          <input type="color" id="bhe-padding-color" value="#ffffff">
          <label class="bhe-check-inline"><input type="checkbox" id="bhe-padding-transparent"> Transparent</label>
        </div>
      </div>
    </div>

    <!-- Colours panel -->
    <div class="bhe-panel bhe-panel-hidden" id="bhe-panel-colours">
      <p class="bhe-hint">Dominant colours extracted from the image. Click to copy hex.</p>
      <div class="bhe-palette" id="bhe-palette"></div>
      <button class="bhe-btn bhe-btn-sm" style="margin-top:10px;" id="bhe-reextract-btn">Re-extract</button>
    </div>
  </div>

  <div class="bhe-footer">
    <button class="bhe-btn bhe-btn-ghost" id="bhe-reset-btn">Reset</button>
    <div style="display:flex;gap:8px;">
      <button class="bhe-btn bhe-btn-ghost" id="bhe-cancel-btn">Cancel</button>
      <button class="bhe-btn bhe-btn-primary" id="bhe-apply-btn">Apply</button>
    </div>
  </div>
</div>`;
        document.body.appendChild(el);

        _modal = el;
        _canvas = document.getElementById('bhe-canvas');
        _ctx = _canvas.getContext('2d');
        _canvasWrap = document.getElementById('bhe-canvas-wrap');
        _cropBoxEl = document.getElementById('bhe-crop-box');

        _bindEvents();
        _injectStyles();
    }

    /* ────────────────────────────────────────────────
       Event wiring
    ──────────────────────────────────────────────── */
    function _bindEvents() {
        document.getElementById('bhe-close').addEventListener('click', _cancel);
        document.getElementById('bhe-cancel-btn').addEventListener('click', _cancel);
        document.getElementById('bhe-overlay').addEventListener('click', _cancel);
        document.getElementById('bhe-apply-btn').addEventListener('click', _apply);
        document.getElementById('bhe-reset-btn').addEventListener('click', () => { _adj = { ...ADJ_DEFAULTS }; _cropAspectKey = 'free'; _resetUI(); _fitBoxToFull(); _render(); });
        document.getElementById('bhe-reextract-btn').addEventListener('click', _extractPalette);
        document.getElementById('bhe-crop-reset').addEventListener('click', () => { _fitBoxToFull(); _syncCropInputsFromBox(); _renderCropBox(); });

        // Tabs
        _modal.querySelectorAll('.bhe-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                _modal.querySelectorAll('.bhe-tab').forEach((t) => t.classList.remove('bhe-tab-active'));
                _modal.querySelectorAll('.bhe-panel').forEach((p) => p.classList.add('bhe-panel-hidden'));
                tab.classList.add('bhe-tab-active');
                document.getElementById('bhe-panel-' + tab.dataset.tab).classList.remove('bhe-panel-hidden');
                _cropBoxEl.style.display = tab.dataset.tab === 'crop' ? 'block' : 'none';
            });
        });

        // Adjust sliders
        _slider('bhe-brightness', 'bhe-brightness-val', (v) => { _adj.brightness = v; }, (v) => String(v));
        _slider('bhe-grayscale', 'bhe-grayscale-val', (v) => { _adj.grayscale = v / 100; }, (v) => v + '%');

        document.getElementById('bhe-invert').addEventListener('change', (e) => { _adj.invert = e.target.checked ? 1 : 0; _render(); });

        const widthInput = document.getElementById('bhe-width');
        const heightInput = document.getElementById('bhe-height');
        widthInput.addEventListener('input', () => {
            const w = parseInt(widthInput.value, 10) || 1;
            _adj.scaleX = (w / _originalImg.naturalWidth) * 100;
            if (_adj.lockAspect) { _adj.scaleY = _adj.scaleX; heightInput.value = Math.round(_originalImg.naturalHeight * _adj.scaleY / 100); }
        });
        heightInput.addEventListener('input', () => {
            const h = parseInt(heightInput.value, 10) || 1;
            _adj.scaleY = (h / _originalImg.naturalHeight) * 100;
            if (_adj.lockAspect) { _adj.scaleX = _adj.scaleY; widthInput.value = Math.round(_originalImg.naturalWidth * _adj.scaleX / 100); }
        });
        document.getElementById('bhe-lock-btn').addEventListener('click', () => { _adj.lockAspect = !_adj.lockAspect; _updateLockIcon(); });

        // Crop numeric inputs
        ['bhe-crop-x', 'bhe-crop-y', 'bhe-crop-w', 'bhe-crop-h'].forEach((id) => {
            document.getElementById(id).addEventListener('change', _applyCropInputsToBox);
        });
        document.getElementById('bhe-crop-aspect').addEventListener('change', (e) => {
            _cropAspectKey = e.target.value;
            _applyAspectToBox();
            _syncCropInputsFromBox();
            _renderCropBox();
        });

        // Padding controls
        _slider('bhe-padding', 'bhe-padding-val', (v) => { _adj.padding = v; }, (v) => v + '%');
        document.getElementById('bhe-padding-color').addEventListener('input', (e) => { _adj.paddingColor = e.target.value; });
        document.getElementById('bhe-padding-transparent').addEventListener('change', (e) => {
            _adj.paddingTransparent = e.target.checked;
            document.getElementById('bhe-padding-color').disabled = e.target.checked;
        });

        // Crop box dragging — Pointer Events unify mouse / touch / pen
        _cropBoxEl.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.bhe-crop-handle')) return; // handled separately below
            _startDrag(e, 'move', null);
        });
        _cropBoxEl.querySelectorAll('.bhe-crop-handle').forEach((h) => {
            h.addEventListener('pointerdown', (e) => { e.stopPropagation(); _startDrag(e, 'resize', h.dataset.handle); });
        });
    }

    function _startDrag(e, mode, handle) {
        e.preventDefault();
        _drag = { mode, handle, startClientX: e.clientX, startClientY: e.clientY, startBox: { ..._box } };
        try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
        window.addEventListener('pointermove', _onDragMove);
        window.addEventListener('pointerup', _onDragEnd);
        window.addEventListener('pointercancel', _onDragEnd);
    }

    function _onDragMove(e) {
        if (!_drag) return;
        const dx = e.clientX - _drag.startClientX;
        const dy = e.clientY - _drag.startClientY;
        const { x: x0, y: y0, w: w0, h: h0 } = _drag.startBox;
        const aspect = ASPECTS.find((a) => a.key === _cropAspectKey)?.ratio || null;

        if (_drag.mode === 'move') {
            _box = {
                x: _clamp(x0 + dx, 0, _previewW - w0),
                y: _clamp(y0 + dy, 0, _previewH - h0),
                w: w0, h: h0
            };
        } else if (aspect && ['nw', 'ne', 'se', 'sw'].includes(_drag.handle)) {
            _box = _resizeWithAspect(_drag.handle, _drag.startBox, dx, dy, aspect);
        } else {
            _box = _resizeFree(_drag.handle, _drag.startBox, dx, dy);
        }
        _renderCropBox();
        _syncCropInputsFromBox();
    }

    function _onDragEnd() {
        _drag = null;
        window.removeEventListener('pointermove', _onDragMove);
        window.removeEventListener('pointerup', _onDragEnd);
        window.removeEventListener('pointercancel', _onDragEnd);
    }

    function _resizeFree(handle, start, dx, dy) {
        let { x, y, w, h } = start;
        if (handle.includes('e')) w = _clamp(start.w + dx, MIN_BOX, _previewW - start.x);
        if (handle.includes('s')) h = _clamp(start.h + dy, MIN_BOX, _previewH - start.y);
        if (handle.includes('w')) { w = _clamp(start.w - dx, MIN_BOX, start.x + start.w); x = start.x + start.w - w; }
        if (handle.includes('n')) { h = _clamp(start.h - dy, MIN_BOX, start.y + start.h); y = start.y + start.h - h; }
        return { x, y, w, h };
    }

    function _resizeWithAspect(handle, start, dx, dy, aspect) {
        const { x: x0, y: y0, w: w0, h: h0 } = start;
        let w, h, x, y;
        if (handle === 'se') {
            w = _clamp(w0 + dx, MIN_BOX, _previewW - x0);
            h = w / aspect;
            if (y0 + h > _previewH) { h = _previewH - y0; w = h * aspect; }
            x = x0; y = y0;
        } else if (handle === 'nw') {
            const anchorX = x0 + w0, anchorY = y0 + h0;
            w = _clamp(w0 - dx, MIN_BOX, anchorX);
            h = w / aspect;
            if (anchorY - h < 0) { h = anchorY; w = h * aspect; }
            x = anchorX - w; y = anchorY - h;
        } else if (handle === 'ne') {
            const anchorY = y0 + h0;
            w = _clamp(w0 + dx, MIN_BOX, _previewW - x0);
            h = w / aspect;
            if (anchorY - h < 0) { h = anchorY; w = h * aspect; }
            x = x0; y = anchorY - h;
        } else { // sw
            const anchorX = x0 + w0;
            w = _clamp(w0 - dx, MIN_BOX, anchorX);
            h = w / aspect;
            if (y0 + h > _previewH) { h = _previewH - y0; w = h * aspect; }
            x = anchorX - w; y = y0;
        }
        return { x, y, w, h };
    }

    function _clamp(v, min, max) { return Math.max(min, Math.min(max, max >= min ? max : min, v)); }

    function _slider(sliderId, valId, setAdj, fmt) {
        const s = document.getElementById(sliderId), v = document.getElementById(valId);
        s.addEventListener('input', () => {
            const val = Number(s.value);
            setAdj(val);
            v.textContent = fmt(val);
            _render();
        });
    }

    function _loadImage(url, cb) {
        const img = new Image();
        img.onload = () => { _originalImg = img; cb(); };
        img.src = url;
    }

    /* ────────────────────────────────────────────────
       Preview sizing — canvas buffer == CSS size exactly (no letterboxing)
    ──────────────────────────────────────────────── */
    function _setupPreview() {
        const srcW = _originalImg.naturalWidth, srcH = _originalImg.naturalHeight;
        _previewScale = Math.min(PREVIEW_MAX_W / srcW, PREVIEW_MAX_H / srcH, 1);
        _previewW = Math.max(1, Math.round(srcW * _previewScale));
        _previewH = Math.max(1, Math.round(srcH * _previewScale));

        _canvas.width = _previewW;
        _canvas.height = _previewH;
        _canvas.style.width = _previewW + 'px';
        _canvas.style.height = _previewH + 'px';
        _canvasWrap.style.width = _previewW + 'px';
        _canvasWrap.style.height = _previewH + 'px';

        _fitBoxToFull();
    }

    function _fitBoxToFull() {
        _box = { x: 0, y: 0, w: _previewW, h: _previewH };
    }

    /* ────────────────────────────────────────────────
       Live preview render (adjustments only — crop is applied at export)
    ──────────────────────────────────────────────── */
    function _render() {
        if (!_originalImg) return;
        _ctx.clearRect(0, 0, _previewW, _previewH);
        _ctx.drawImage(_originalImg, 0, 0, _previewW, _previewH);

        if (_adj.brightness !== 0 || _adj.grayscale > 0 || _adj.invert) {
            const id = _ctx.getImageData(0, 0, _previewW, _previewH);
            _applyPixelAdjustments(id.data);
            _ctx.putImageData(id, 0, 0);
        }
        _renderCropBox();
    }

    function _applyPixelAdjustments(d) {
        const br = _adj.brightness * 2.55;
        for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i + 1], b = d[i + 2];
            r = Math.min(255, Math.max(0, r + br));
            g = Math.min(255, Math.max(0, g + br));
            b = Math.min(255, Math.max(0, b + br));
            if (_adj.grayscale > 0) {
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                r = r + (lum - r) * _adj.grayscale;
                g = g + (lum - g) * _adj.grayscale;
                b = b + (lum - b) * _adj.grayscale;
            }
            if (_adj.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
            d[i] = r; d[i + 1] = g; d[i + 2] = b;
        }
    }

    function _renderCropBox() {
        _cropBoxEl.style.left = _box.x + 'px';
        _cropBoxEl.style.top = _box.y + 'px';
        _cropBoxEl.style.width = _box.w + 'px';
        _cropBoxEl.style.height = _box.h + 'px';
    }

    /* ────────────────────────────────────────────────
       Crop numeric inputs <-> box (source px <-> preview px)
    ──────────────────────────────────────────────── */
    function _syncCropInputsFromBox() {
        const s = _previewScale;
        document.getElementById('bhe-crop-x').value = Math.round(_box.x / s);
        document.getElementById('bhe-crop-y').value = Math.round(_box.y / s);
        document.getElementById('bhe-crop-w').value = Math.round(_box.w / s);
        document.getElementById('bhe-crop-h').value = Math.round(_box.h / s);
    }

    function _applyCropInputsToBox() {
        const s = _previewScale;
        const srcW = _originalImg.naturalWidth, srcH = _originalImg.naturalHeight;
        let x = _clamp(parseInt(document.getElementById('bhe-crop-x').value, 10) || 0, 0, srcW - 1);
        let y = _clamp(parseInt(document.getElementById('bhe-crop-y').value, 10) || 0, 0, srcH - 1);
        let w = _clamp(parseInt(document.getElementById('bhe-crop-w').value, 10) || 1, 1, srcW - x);
        let h = _clamp(parseInt(document.getElementById('bhe-crop-h').value, 10) || 1, 1, srcH - y);
        _box = { x: x * s, y: y * s, w: w * s, h: h * s };
        _renderCropBox();
    }

    function _applyAspectToBox() {
        const aspect = ASPECTS.find((a) => a.key === _cropAspectKey)?.ratio;
        if (!aspect) return;
        // Re-fit the current box to the new ratio, centred, as large as possible.
        const cx = _box.x + _box.w / 2, cy = _box.y + _box.h / 2;
        let w = _box.w, h = w / aspect;
        if (h > _previewH) { h = _previewH; w = h * aspect; }
        if (w > _previewW) { w = _previewW; h = w / aspect; }
        let x = _clamp(cx - w / 2, 0, _previewW - w);
        let y = _clamp(cy - h / 2, 0, _previewH - h);
        _box = { x, y, w, h };
    }

    /* ────────────────────────────────────────────────
       Colour extraction (k-means, unchanged from v1)
    ──────────────────────────────────────────────── */
    BHImageEditor._extractPalette = function () {
        if (!_originalImg) return;
        const size = 60;
        const tc2 = document.createElement('canvas');
        tc2.width = size; tc2.height = size;
        const tc = tc2.getContext('2d');
        tc.drawImage(_originalImg, 0, 0, size, size);
        const data = tc.getImageData(0, 0, size, size).data;

        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            pixels.push([data[i], data[i + 1], data[i + 2]]);
        }
        if (!pixels.length) return;

        const k = 8;
        let centers = pixels.filter((_, i) => i % Math.floor(pixels.length / k) === 0).slice(0, k);

        for (let iter = 0; iter < 12; iter++) {
            const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
            for (const [r, g, b] of pixels) {
                let best = 0, bestD = Infinity;
                for (let j = 0; j < centers.length; j++) {
                    const d = (r - centers[j][0]) ** 2 + (g - centers[j][1]) ** 2 + (b - centers[j][2]) ** 2;
                    if (d < bestD) { bestD = d; best = j; }
                }
                sums[best][0] += r; sums[best][1] += g; sums[best][2] += b; sums[best][3]++;
            }
            centers = sums.map((s, i) => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[i]);
        }

        const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
        _palette = centers
            .sort((a, b) => (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) - (0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]))
            .map(toHex);

        _renderPalette();
    };

    function _extractPalette() { BHImageEditor._extractPalette(); }

    function _renderPalette() {
        const el = document.getElementById('bhe-palette');
        if (!el) return;
        el.innerHTML = _palette.map((hex) => `
            <div class="bhe-swatch" style="background:${hex};" title="${hex}" data-hex="${hex}">
                <span class="bhe-swatch-label">${hex}</span>
            </div>
        `).join('');
        el.querySelectorAll('.bhe-swatch').forEach((sw) => sw.addEventListener('click', () => BHImageEditor._copyColor(sw.dataset.hex)));
    }

    BHImageEditor._copyColor = function (hex) {
        navigator.clipboard?.writeText(hex).then(() => _showToast('Copied ' + hex)).catch(() => _showToast(hex));
    };

    /* ────────────────────────────────────────────────
       Apply (export to dataUrl) — full resolution, independent of preview
    ──────────────────────────────────────────────── */
    function _apply() {
        if (!_originalImg) return _cancel();

        const srcW = _originalImg.naturalWidth, srcH = _originalImg.naturalHeight;

        // Crop rect in SOURCE pixels
        const s = _previewScale;
        const cropX = Math.round(_clamp(_box.x / s, 0, srcW));
        const cropY = Math.round(_clamp(_box.y / s, 0, srcH));
        const cropW = Math.max(1, Math.round(_clamp(_box.w / s, 1, srcW - cropX)));
        const cropH = Math.max(1, Math.round(_clamp(_box.h / s, 1, srcH - cropY)));

        // Output size = cropped region scaled by the Adjust tab's width/height
        const outW = Math.max(1, Math.round(cropW * _adj.scaleX / 100));
        const outH = Math.max(1, Math.round(cropH * _adj.scaleY / 100));

        const base = document.createElement('canvas');
        base.width = outW; base.height = outH;
        const bc = base.getContext('2d');
        bc.drawImage(_originalImg, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

        if (_adj.brightness !== 0 || _adj.grayscale > 0 || _adj.invert) {
            const id = bc.getImageData(0, 0, outW, outH);
            _applyPixelAdjustments(id.data);
            bc.putImageData(id, 0, 0);
        }

        let finalCanvas = base;
        if (_adj.padding > 0) {
            const padX = Math.round(outW * (_adj.padding / 100));
            const padY = Math.round(outH * (_adj.padding / 100));
            const padded = document.createElement('canvas');
            padded.width = outW + padX * 2;
            padded.height = outH + padY * 2;
            const pc = padded.getContext('2d');
            if (!_adj.paddingTransparent) {
                pc.fillStyle = _adj.paddingColor;
                pc.fillRect(0, 0, padded.width, padded.height);
            }
            pc.drawImage(base, padX, padY);
            finalCanvas = padded;
        }

        const finalDataUrl = finalCanvas.toDataURL('image/png');
        _close();
        _resolve(finalDataUrl);
    }

    /* ────────────────────────────────────────────────
       Helpers
    ──────────────────────────────────────────────── */
    function _cancel() { _close(); _reject?.(); }

    function _close() {
        _drag = null;
        _modal.classList.remove('bhe-active');
        document.body.style.overflow = '';
    }

    function _resetUI() {
        if (!_originalImg) return;
        const w = _originalImg.naturalWidth, h = _originalImg.naturalHeight;
        document.getElementById('bhe-brightness').value = 0;
        document.getElementById('bhe-brightness-val').textContent = '0';
        document.getElementById('bhe-grayscale').value = 0;
        document.getElementById('bhe-grayscale-val').textContent = '0%';
        document.getElementById('bhe-invert').checked = false;
        document.getElementById('bhe-width').value = w;
        document.getElementById('bhe-height').value = h;
        document.getElementById('bhe-crop-aspect').value = 'free';
        document.getElementById('bhe-padding').value = 0;
        document.getElementById('bhe-padding-val').textContent = '0%';
        document.getElementById('bhe-padding-color').value = '#ffffff';
        document.getElementById('bhe-padding-color').disabled = false;
        document.getElementById('bhe-padding-transparent').checked = false;
        _syncCropInputsFromBox();
        _adj.lockAspect = true;
        _updateLockIcon();
        // Crop box only interactive/visible on the Crop tab
        _cropBoxEl.style.display = _modal.querySelector('.bhe-tab-active')?.dataset.tab === 'crop' ? 'block' : 'none';
    }

    function _updateLockIcon() {
        const btn = document.getElementById('bhe-lock-btn');
        if (!btn) return;
        btn.style.opacity = _adj.lockAspect ? '1' : '0.4';
        btn.title = _adj.lockAspect ? 'Aspect locked' : 'Aspect unlocked';
    }

    function _showToast(msg) {
        const t = document.createElement('div');
        t.className = 'bhe-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('bhe-toast-show'), 10);
        setTimeout(() => { t.classList.remove('bhe-toast-show'); setTimeout(() => t.remove(), 300); }, 2000);
    }

    /* ────────────────────────────────────────────────
       Styles (injected once)
    ──────────────────────────────────────────────── */
    function _injectStyles() {
        if (document.getElementById('bhe-styles')) return;
        const s = document.createElement('style');
        s.id = 'bhe-styles';
        s.textContent = `
#bhe-modal { display: none; position: fixed; inset: 0; z-index: 9999; align-items: center; justify-content: center; }
#bhe-modal.bhe-active { display: flex; }

.bhe-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); }

.bhe-dialog {
    position: relative; z-index: 1;
    background: var(--bg-card, #fff);
    border-radius: var(--radius-lg, 14px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.25);
    width: min(760px, 96vw); max-height: 92vh;
    display: flex; flex-direction: column; overflow: hidden;
}

.bhe-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-light, #e9ecef); flex-shrink: 0; }
.bhe-title { font-weight: 700; font-size: 1rem; color: var(--text-primary, #1a1a2e); letter-spacing: -0.01em; }
.bhe-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; border-radius: var(--radius-sm, 6px); cursor: pointer; color: var(--text-muted, #868e96); transition: background 0.15s, color 0.15s; }
.bhe-close:hover { background: var(--bg-hover, #f1f3f5); color: var(--text-primary, #1a1a2e); }
.bhe-close svg { width: 16px; height: 16px; }

.bhe-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0; }

.bhe-canvas-wrap {
    position: relative;
    background: repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
    margin: 16px auto 0;
    flex-shrink: 0;
    max-width: calc(100% - 32px);
}
#bhe-canvas { display: block; }

.bhe-crop-box {
    display: none;
    position: absolute;
    box-shadow: 0 0 0 9999px rgba(0,0,0,.5);
    border: 1.5px dashed #fff;
    cursor: move;
    touch-action: none;
}
.bhe-crop-handle {
    position: absolute;
    width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    touch-action: none;
    transform: translate(-50%, -50%);
}
.bhe-crop-handle::after { content: ''; width: 12px; height: 12px; background: #fff; border: 2px solid var(--accent-primary, #228be6); border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.bhe-crop-handle[data-handle="nw"] { top: 0; left: 0; cursor: nwse-resize; }
.bhe-crop-handle[data-handle="n"]  { top: 0; left: 50%; cursor: ns-resize; }
.bhe-crop-handle[data-handle="ne"] { top: 0; left: 100%; cursor: nesw-resize; }
.bhe-crop-handle[data-handle="e"]  { top: 50%; left: 100%; cursor: ew-resize; }
.bhe-crop-handle[data-handle="se"] { top: 100%; left: 100%; cursor: nwse-resize; }
.bhe-crop-handle[data-handle="s"]  { top: 100%; left: 50%; cursor: ns-resize; }
.bhe-crop-handle[data-handle="sw"] { top: 100%; left: 0; cursor: nesw-resize; }
.bhe-crop-handle[data-handle="w"]  { top: 50%; left: 0; cursor: ew-resize; }

.bhe-tabs { display: flex; gap: 2px; padding: 12px 16px 0; border-bottom: 1px solid var(--border-light, #e9ecef); flex-shrink: 0; }
.bhe-tab { padding: 7px 16px; border: none; background: transparent; font-size: 0.85rem; font-weight: 500; color: var(--text-muted, #868e96); cursor: pointer; border-radius: var(--radius-sm, 6px) var(--radius-sm, 6px) 0 0; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; margin-bottom: -1px; }
.bhe-tab:hover { color: var(--text-primary, #1a1a2e); }
.bhe-tab-active { color: var(--accent-primary, #228be6) !important; border-bottom-color: var(--accent-primary, #228be6); }

.bhe-panel { padding: 16px 20px; }
.bhe-panel-hidden { display: none !important; }

.bhe-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.bhe-row:last-child { margin-bottom: 0; }
.bhe-row-toggle { justify-content: space-between; }

.bhe-label { font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary, #495057); min-width: 80px; flex-shrink: 0; }
.bhe-label small { font-weight: 400; color: var(--text-muted, #868e96); margin-left: 2px; }

.bhe-slider-wrap { display: flex; align-items: center; gap: 10px; flex: 1; }
.bhe-slider-wrap input[type="range"] { flex: 1; accent-color: var(--accent-primary, #228be6); height: 4px; cursor: pointer; }
.bhe-val { min-width: 36px; text-align: right; font-size: 0.8125rem; font-weight: 600; color: var(--accent-primary, #228be6); font-variant-numeric: tabular-nums; }

.bhe-select { flex: 1; padding: 7px 10px; border: 1.5px solid var(--border-color, #dee2e6); border-radius: var(--radius-sm, 6px); background: var(--bg-input, #fff); color: var(--text-primary, #1a1a2e); font-size: 0.85rem; }

.bhe-wh-wrap { display: flex; align-items: center; gap: 6px; flex: 1; flex-wrap: wrap; }
.bhe-num { width: 80px; padding: 6px 10px; border: 1.5px solid var(--border-color, #dee2e6); border-radius: var(--radius-sm, 6px); background: var(--bg-input, #fff); color: var(--text-primary, #1a1a2e); font-size: 0.875rem; text-align: center; }
.bhe-num:focus { outline: none; border-color: var(--accent-primary, #228be6); }

.bhe-check-inline { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--text-secondary, #495057); cursor: pointer; }

.bhe-lock-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--border-color, #dee2e6); border-radius: var(--radius-sm, 6px); background: var(--bg-card, #fff); cursor: pointer; color: var(--text-secondary, #495057); flex-shrink: 0; }
.bhe-lock-btn svg { width: 14px; height: 14px; }

.bhe-divider { height: 1px; background: var(--border-light, #e9ecef); margin: 12px 0; }

.bhe-toggle { display: flex; align-items: center; cursor: pointer; }
.bhe-toggle input { display: none; }
.bhe-toggle-thumb { width: 38px; height: 22px; background: var(--border-color, #dee2e6); border-radius: 11px; position: relative; transition: background 0.2s; }
.bhe-toggle-thumb::after { content: ''; position: absolute; width: 16px; height: 16px; background: #fff; border-radius: 50%; top: 3px; left: 3px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.bhe-toggle input:checked + .bhe-toggle-thumb { background: var(--accent-primary, #228be6); }
.bhe-toggle input:checked + .bhe-toggle-thumb::after { transform: translateX(16px); }

.bhe-hint { font-size: 0.8rem; color: var(--text-muted, #868e96); margin-bottom: 12px; line-height: 1.5; }
.bhe-crop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
.bhe-crop-grid .bhe-row { margin-bottom: 0; }
.bhe-crop-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.bhe-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius-md, 10px); font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s, opacity 0.15s; }
.bhe-btn-primary { background: var(--accent-primary, #228be6); color: #fff; }
.bhe-btn-primary:hover { background: var(--accent-primary-hover, #1c7ed6); }
.bhe-btn-ghost { background: var(--bg-tertiary, #f1f3f5); color: var(--text-secondary, #495057); }
.bhe-btn-ghost:hover { background: var(--bg-hover, #e9ecef); }
.bhe-btn-sm { padding: 5px 12px; font-size: 0.8rem; background: var(--bg-tertiary, #f1f3f5); color: var(--text-secondary, #495057); border: 1px solid var(--border-color, #dee2e6); border-radius: var(--radius-sm, 6px); }
.bhe-btn-sm:hover { background: var(--bg-hover, #e9ecef); }

.bhe-palette { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 4px; }
.bhe-swatch { aspect-ratio: 1; border-radius: var(--radius-sm, 6px); cursor: pointer; position: relative; border: 1.5px solid rgba(0,0,0,0.08); overflow: hidden; transition: transform 0.15s; }
.bhe-swatch:hover { transform: scale(1.06); }
.bhe-swatch-label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.55); color: #fff; font-size: 0.65rem; text-align: center; padding: 2px 4px; font-family: monospace; opacity: 0; transition: opacity 0.15s; }
.bhe-swatch:hover .bhe-swatch-label { opacity: 1; }

.bhe-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid var(--border-light, #e9ecef); flex-shrink: 0; gap: 10px; }

.bhe-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); background: #1a1a2e; color: #fff; font-size: 0.875rem; font-weight: 500; padding: 10px 20px; border-radius: 20px; opacity: 0; transition: opacity 0.2s, transform 0.2s; z-index: 10001; pointer-events: none; white-space: nowrap; }
.bhe-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }

@media (max-width: 600px) {
    .bhe-dialog { width: 100vw; max-height: 100dvh; border-radius: 0; }
    .bhe-palette { grid-template-columns: repeat(4, 1fr); }
    .bhe-wh-wrap { flex-wrap: wrap; }
    .bhe-num { width: 70px; }
}
        `;
        document.head.appendChild(s);
    }

    global.BHImageEditor = BHImageEditor;

})(window);
