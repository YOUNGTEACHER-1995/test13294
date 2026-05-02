/**
 * Color Accessibility Simulator
 * Core logic and Web Components
 */

// --- Utility Functions ---

function getRelativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
        val /= 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function getContrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

function suggestAccessibleColor(hex, targetContrast = 4.5, backgroundLuminance = 1) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    let bestL = l;
    let low = 0, high = 1;
    if (backgroundLuminance > 0.5) high = l;
    else low = l;

    for (let i = 0; i < 20; i++) {
        let mid = (low + high) / 2;
        let testRgb = hslToRgb(h, s, mid);
        let testHex = rgbToHex(testRgb.r, testRgb.g, testRgb.b);
        let testLum = getRelativeLuminance(testHex);
        let contrast = getContrastRatio(testLum, backgroundLuminance);
        if (contrast >= targetContrast) {
            bestL = mid;
            if (backgroundLuminance > 0.5) low = mid;
            else high = mid;
        } else {
            if (backgroundLuminance > 0.5) high = mid;
            else low = mid;
        }
    }
    const finalRgb = hslToRgb(h, s, bestL);
    return rgbToHex(finalRgb.r, finalRgb.g, finalRgb.b);
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max == min) h = s = 0;
    else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s == 0) r = g = b = l;
    else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

// --- Web Components ---

class ColorCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._color = this.getAttribute('color') || '#3b82f6';
        this._name = this.getAttribute('name') || 'New Color';
    }
    connectedCallback() { this.render(); }
    static get observedAttributes() { return ['color', 'name']; }
    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal === newVal) return;
        if (name === 'color') this._color = newVal;
        if (name === 'name') this._name = newVal;
        this.render();
        this.dispatchEvent(new CustomEvent('color-change', { 
            detail: { color: this._color, name: this._name },
            bubbles: true,
            composed: true
        }));
    }
    updateColor(hex) {
        if (/^#[0-9A-F]{6}$/i.test(hex)) {
            this.setAttribute('color', hex);
        }
    }
    render() {
        const luminance = getRelativeLuminance(this._color);
        const contrast = getContrastRatio(luminance, 1.0);
        const isPass = contrast >= 4.5;
        const suggestion = !isPass ? suggestAccessibleColor(this._color, 4.5, 1.0) : null;
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                .card { background: #141b24; border-radius: 16px; overflow: hidden; border: 1px solid #1e2732; transition: all 0.3s ease; position: relative; font-family: 'Inter', sans-serif; color: #f0f4f8; }
                .card:hover { transform: translateY(-4px); border-color: #3b82f6; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); }
                .preview { height: 100px; background-color: ${this._color}; display: flex; align-items: center; justify-content: center; position: relative; }
                .delete-btn { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(239, 68, 68, 0.2); color: #ef4444; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
                .delete-btn:hover { background: #ef4444; color: white; }
                .content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
                .input-group { display: flex; flex-direction: column; gap: 4px; }
                label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
                input { background: #1e2732; border: 1px solid transparent; color: #f0f4f8; padding: 6px 10px; border-radius: 6px; font-size: 13px; font-family: 'JetBrains Mono', monospace; }
                input:focus { outline: none; border-color: #3b82f6; }
                .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; width: fit-content; }
                .badge.pass { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .badge.fail { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                .suggestion { margin-top: 8px; padding-top: 8px; border-top: 1px solid #1e2732; }
                .suggestion p { font-size: 11px; color: #94a3b8; margin: 0 0 6px 0; }
                .apply-btn { width: 100%; background: #1e2732; color: #f0f4f8; padding: 6px; border-radius: 6px; font-size: 11px; font-weight: 600; border: none; cursor: pointer; transition: background 0.2s; }
                .apply-btn:hover { background: #3b82f6; }
                .picker-btn { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; backdrop-filter: blur(4px); }
            </style>
            <div class="card">
                <div class="preview" style="background-color: ${this._color}">
                    <button class="delete-btn" aria-label="Delete color">&times;</button>
                    <button class="picker-btn">Pick Color</button>
                    <input type="color" class="color-picker" value="${this._color}" style="position: absolute; opacity: 0; pointer-events: none;">
                </div>
                <div class="content">
                    <div class="input-group">
                        <label>Color Name</label>
                        <input type="text" class="name-input" value="${this._name}" placeholder="e.g. Primary Blue">
                    </div>
                    <div class="input-group">
                        <label>Hex Code</label>
                        <input type="text" class="hex-input" value="${this._color}">
                    </div>
                    <div class="badge ${isPass ? 'pass' : 'fail'}">
                        ${isPass ? '✓ AA PASS' : '⚠ AA FAIL'} (${contrast.toFixed(2)}:1)
                    </div>
                    ${!isPass ? `
                        <div class="suggestion">
                            <p>Suggested (4.5:1): <strong>${suggestion}</strong></p>
                            <button class="apply-btn" data-hex="${suggestion}">Apply Suggestion</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        this.shadowRoot.querySelector('.delete-btn').onclick = () => {
            this.dispatchEvent(new CustomEvent('color-delete', { bubbles: true, composed: true }));
        };
        this.shadowRoot.querySelector('.name-input').onchange = (e) => {
            this.setAttribute('name', e.target.value);
        };
        this.shadowRoot.querySelector('.hex-input').onchange = (e) => {
            this.updateColor(e.target.value);
        };
        const picker = this.shadowRoot.querySelector('.color-picker');
        this.shadowRoot.querySelector('.picker-btn').onclick = () => picker.click();
        picker.oninput = (e) => this.updateColor(e.target.value);
        if (this.shadowRoot.querySelector('.apply-btn')) {
            this.shadowRoot.querySelector('.apply-btn').onclick = (e) => {
                this.updateColor(e.target.dataset.hex);
            };
        }
    }
}
customElements.define('color-card', ColorCard);

class App {
    constructor() {
        this.palette = [
            { name: 'Brand Blue', color: '#3b82f6' },
            { name: 'Sunset Orange', color: '#f97316' },
            { name: 'Vibrant Pink', color: '#ec4899' }
        ];
        this.currentFilter = 'normal';
        this.init();
    }
    init() {
        this.grid = document.getElementById('palette-grid');
        this.addBtn = document.getElementById('add-color');
        this.originalRender = document.getElementById('original-render');
        this.simulatedRender = document.getElementById('simulated-render');
        this.filterTabs = document.querySelectorAll('.filter-tab');
        this.simLabel = document.getElementById('simulation-label');
        this.onboarding = document.getElementById('onboarding');
        this.addBtn.onclick = () => this.addColor();
        this.filterTabs.forEach(tab => {
            tab.onclick = () => {
                this.filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.setFilter(tab.dataset.filter, tab.textContent);
            };
        });
        document.querySelector('.close-banner').onclick = () => {
            this.onboarding.style.display = 'none';
        };
        this.renderPalette();
        this.renderSimulation();
        window.addEventListener('color-change', () => this.renderSimulation());
        window.addEventListener('color-delete', (e) => {
            const index = Array.from(this.grid.children).indexOf(e.target);
            this.palette.splice(index, 1);
            this.renderPalette();
            this.renderSimulation();
        });
    }
    addColor() {
        this.palette.push({ name: 'New Color', color: '#6366f1' });
        this.renderPalette();
        this.renderSimulation();
    }
    setFilter(filter, label) {
        this.currentFilter = filter;
        this.simLabel.textContent = `${label} Vision`;
        const filterMap = {
            'normal': 'none',
            'protanopia': 'url(#protanopia-filter)',
            'deuteranopia': 'url(#deuteranopia-filter)',
            'tritanopia': 'url(#tritanopia-filter)'
        };
        this.simulatedRender.style.filter = filterMap[filter];
    }
    renderPalette() {
        this.grid.innerHTML = '';
        this.palette.forEach(item => {
            const card = document.createElement('color-card');
            card.setAttribute('name', item.name);
            card.setAttribute('color', item.color);
            this.grid.appendChild(card);
        });
    }
    renderSimulation() {
        this.originalRender.innerHTML = '';
        this.simulatedRender.innerHTML = '';
        const cards = Array.from(this.grid.querySelectorAll('color-card'));
        cards.forEach(card => {
            const color = card.getAttribute('color');
            const swatch1 = document.createElement('div');
            swatch1.className = 'swatch';
            swatch1.style.backgroundColor = color;
            this.originalRender.appendChild(swatch1);
            const swatch2 = document.createElement('div');
            swatch2.className = 'swatch';
            swatch2.style.backgroundColor = color;
            this.simulatedRender.appendChild(swatch2);
        });
    }
}
document.addEventListener('DOMContentLoaded', () => { new App(); });
