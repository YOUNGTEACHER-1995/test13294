import { GoogleGenAI } from "https://esm.run/@google/genai";

// API Key loading
let API_KEY = "";
async function getApiKey() {
    try {
        const response = await fetch('.env');
        const text = await response.text();
        const match = text.match(/GEMINI_API_KEY=(.*)/);
        return match ? match[1].trim() : "";
    } catch (e) {
        return "AIzaSyBRfb2yVGofUTarmItp9lwHp2cqW0sqHes"; // Fallback
    }
}

// --- Original Simulator Logic ---
function getRelativeLuminance(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 0;
    const [r, g, b] = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)].map(val => {
        val /= 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

class ColorCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    connectedCallback() { this.render(); }
    static get observedAttributes() { return ['color', 'name']; }
    attributeChangedCallback() { this.render(); }
    render() {
        const color = this.getAttribute('color') || '#3b82f6';
        const name = this.getAttribute('name') || 'New Color';
        this.shadowRoot.innerHTML = `
            <style>
                .card { background: #141b24; border-radius: 12px; overflow: hidden; border: 1px solid #1e2732; color: #f0f4f8; font-family: sans-serif; }
                .preview { height: 60px; background-color: ${color}; position: relative; }
                .content { padding: 12px; }
                .delete { position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.2); border: none; color: red; cursor: pointer; border-radius: 4px; }
                input { width: 100%; background: #1e2732; border: 1px solid #333; color: white; margin-top: 5px; padding: 4px; border-radius: 4px; }
            </style>
            <div class="card">
                <div class="preview"><button class="delete">&times;</button></div>
                <div class="content">
                    <input type="text" value="${name}" class="name-in">
                    <input type="text" value="${color}" class="hex-in">
                </div>
            </div>
        `;
        this.shadowRoot.querySelector('.delete').onclick = () => this.dispatchEvent(new CustomEvent('color-delete', { bubbles: true, composed: true }));
    }
}
customElements.define('color-card', ColorCard);

class Simulator {
    constructor() {
        this.palette = [{ name: 'Brand Blue', color: '#3b82f6' }];
        this.grid = document.getElementById('palette-grid');
        this.originalRender = document.getElementById('original-render');
        this.simulatedRender = document.getElementById('simulated-render');
        this.filterTabs = document.querySelectorAll('.filter-tab');
        this.init();
    }
    init() {
        document.getElementById('add-color').onclick = () => {
            this.palette.push({ name: 'New Color', color: '#6366f1' });
            this.render();
        };
        this.filterTabs.forEach(tab => {
            tab.onclick = () => {
                this.filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.setFilter(tab.dataset.filter);
            };
        });
        this.render();
        window.addEventListener('color-delete', (e) => {
            const index = Array.from(this.grid.children).indexOf(e.target);
            this.palette.splice(index, 1);
            this.render();
        });
    }
    setFilter(filter) {
        const filterMap = { 'normal': 'none', 'protanopia': 'url(#protanopia-filter)', 'deuteranopia': 'url(#deuteranopia-filter)', 'tritanopia': 'url(#tritanopia-filter)' };
        this.simulatedRender.style.filter = filterMap[filter] || 'none';
        document.getElementById('simulation-label').textContent = filter.charAt(0).toUpperCase() + filter.slice(1) + " Vision";
    }
    render() {
        this.grid.innerHTML = '';
        this.originalRender.innerHTML = '';
        this.simulatedRender.innerHTML = '';
        this.palette.forEach(item => {
            const card = document.createElement('color-card');
            card.setAttribute('name', item.name);
            card.setAttribute('color', item.color);
            this.grid.appendChild(card);
            [this.originalRender, this.simulatedRender].forEach(container => {
                const swatch = document.createElement('div');
                swatch.className = 'swatch';
                swatch.style.backgroundColor = item.color;
                container.appendChild(swatch);
            });
        });
    }
}

// --- Chatbot Logic ---
class VisionBot {
    constructor() {
        this.widget = document.getElementById('chat-widget');
        this.toggle = document.getElementById('chat-toggle');
        this.window = document.getElementById('chat-window');
        this.close = document.getElementById('close-chat');
        this.input = document.getElementById('user-input');
        this.send = document.getElementById('send-btn');
        this.messages = document.getElementById('chat-messages');
        this.ai = null;
        this.init();
    }
    async init() {
        const key = await getApiKey();
        this.ai = new GoogleGenAI(key);
        this.toggle.onclick = () => this.window.classList.toggle('hidden');
        this.close.onclick = () => this.window.classList.add('hidden');
        this.send.onclick = () => this.handleSend();
        this.input.onkeypress = (e) => { if (e.key === 'Enter') this.handleSend(); };
    }
    async handleSend() {
        const text = this.input.value.trim();
        if (!text) return;
        this.appendMessage('user', text);
        this.input.value = '';
        const loading = this.appendMessage('bot', '...', true);
        try {
            const model = this.ai.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
            const prompt = `Identify image search intent. If searching, return [[keyword]]. Response: ${text}`;
            const result = await model.generateContent(prompt);
            const response = result.response.text();
            loading.parentElement.remove();
            this.processResponse(response);
        } catch (e) {
            loading.textContent = "Error: Check API Key.";
        }
    }
    appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `<div class="message-content">${text}</div>`;
        this.messages.prepend(div);
        return div.querySelector('.message-content');
    }
    async processResponse(text) {
        const match = text.match(/\[\[(.*?)\]\]/);
        this.appendMessage('bot', text.replace(/\[\[.*?\]\]/g, '').trim() || "Searching...");
        if (match) await this.showImages(match[1]);
    }
    async showImages(keyword) {
        const url = `https://source.unsplash.com/featured/?${encodeURIComponent(keyword)}`;
        const res = await fetch(url);
        const finalUrl = res.url;
        const div = document.createElement('div');
        div.className = 'message bot';
        div.innerHTML = `
            <div class="message-content">
                Simulation for "${keyword}":
                <div class="image-result">
                    <div class="image-card"><img src="${finalUrl}"><div class="image-label">Orig</div></div>
                    <div class="image-card"><img src="${finalUrl}" class="protanopia"><div class="image-label">Prot</div></div>
                    <div class="image-card"><img src="${finalUrl}" class="deuteranopia"><div class="image-label">Deut</div></div>
                    <div class="image-card"><img src="${finalUrl}" class="tritanopia"><div class="image-label">Trit</div></div>
                </div>
            </div>`;
        this.messages.prepend(div);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Simulator();
    new VisionBot();
});
