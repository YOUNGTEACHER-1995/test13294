import { GoogleGenAI } from "https://esm.run/@google/genai";

// API Key loading helper
async function getApiKey() {
    try {
        const response = await fetch('.env');
        if (!response.ok) throw new Error();
        const text = await response.text();
        const match = text.match(/GEMINI_API_KEY=(.*)/);
        return match ? match[1].trim() : "AIzaSyBRfb2yVGofUTarmItp9lwHp2cqW0sqHes";
    } catch (e) {
        // Fallback to the provided key if .env fails to load
        return "AIzaSyBRfb2yVGofUTarmItp9lwHp2cqW0sqHes";
    }
}

// --- Original Simulator Logic ---
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
                .card { background: #141b24; border-radius: 12px; overflow: hidden; border: 1px solid #1e2732; color: #f0f4f8; font-family: sans-serif; transition: transform 0.2s; }
                .card:hover { transform: translateY(-2px); border-color: #3b82f6; }
                .preview { height: 80px; background-color: ${color}; position: relative; }
                .content { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
                .delete { position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.2); border: none; color: #ef4444; cursor: pointer; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
                .delete:hover { background: #ef4444; color: white; }
                input { width: 100%; background: #1e2732; border: 1px solid #333; color: white; padding: 6px; border-radius: 4px; font-size: 0.8rem; }
                input:focus { outline: none; border-color: #3b82f6; }
            </style>
            <div class="card">
                <div class="preview"><button class="delete" title="Delete">&times;</button></div>
                <div class="content">
                    <input type="text" value="${name}" class="name-in" placeholder="Color Name">
                    <input type="text" value="${color}" class="hex-in" placeholder="#000000">
                </div>
            </div>
        `;
        this.shadowRoot.querySelector('.delete').onclick = () => {
            this.dispatchEvent(new CustomEvent('color-delete', { bubbles: true, composed: true }));
        };
        
        const hexIn = this.shadowRoot.querySelector('.hex-in');
        hexIn.onchange = (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                this.setAttribute('color', e.target.value);
                this.dispatchEvent(new CustomEvent('color-update', { bubbles: true, composed: true }));
            }
        };
    }
}
customElements.define('color-card', ColorCard);

class Simulator {
    constructor() {
        // Initialize with 3 colors as requested
        this.palette = [
            { name: 'Primary Blue', color: '#3b82f6' },
            { name: 'Sunset Orange', color: '#f97316' },
            { name: 'Vibrant Pink', color: '#ec4899' }
        ];
        this.grid = document.getElementById('palette-grid');
        this.originalRender = document.getElementById('original-render');
        this.simulatedRender = document.getElementById('simulated-render');
        this.filterTabs = document.querySelectorAll('.filter-tab');
        this.init();
    }
    init() {
        document.getElementById('add-color').onclick = () => {
            this.palette.push({ name: 'New Color', color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0') });
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
            if (index > -1) {
                this.palette.splice(index, 1);
                this.render();
            }
        });
        window.addEventListener('color-update', () => this.render(false));
    }
    setFilter(filter) {
        const filterMap = { 'normal': 'none', 'protanopia': 'url(#protanopia-filter)', 'deuteranopia': 'url(#deuteranopia-filter)', 'tritanopia': 'url(#tritanopia-filter)' };
        this.simulatedRender.style.filter = filterMap[filter] || 'none';
        document.getElementById('simulation-label').textContent = filter.charAt(0).toUpperCase() + filter.slice(1) + " Vision";
    }
    render(updateGrid = true) {
        if (updateGrid) {
            this.grid.innerHTML = '';
        }
        this.originalRender.innerHTML = '';
        this.simulatedRender.innerHTML = '';
        
        const cards = updateGrid ? [] : Array.from(this.grid.querySelectorAll('color-card'));

        this.palette.forEach((item, index) => {
            if (updateGrid) {
                const card = document.createElement('color-card');
                card.setAttribute('name', item.name);
                card.setAttribute('color', item.color);
                this.grid.appendChild(card);
            }
            
            const color = updateGrid ? item.color : cards[index].getAttribute('color');
            [this.originalRender, this.simulatedRender].forEach(container => {
                const swatch = document.createElement('div');
                swatch.className = 'swatch';
                swatch.style.backgroundColor = color;
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

        // UI Listeners attached immediately for robustness
        this.setupUI();
        // Background API initialization
        this.initAI();
    }
    
    setupUI() {
        const handleToggle = (e) => {
            e.stopPropagation();
            const isHidden = this.window.classList.contains('hidden');
            if (isHidden) {
                this.window.classList.remove('hidden');
                this.input.focus();
            } else {
                this.window.classList.add('hidden');
            }
        };

        this.toggle.addEventListener('click', handleToggle);
        this.close.addEventListener('click', () => this.window.classList.add('hidden'));
        
        this.send.addEventListener('click', () => this.handleSend());
        this.input.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') this.handleSend(); 
        });

        // Close on escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.window.classList.contains('hidden')) {
                this.window.classList.add('hidden');
            }
        });
    }

    async initAI() {
        try {
            const key = await getApiKey();
            this.ai = new GoogleGenAI(key);
        } catch (e) {
            console.error("AI Init Error:", e);
        }
    }

    async handleSend() {
        const text = this.input.value.trim();
        if (!text) return;
        
        this.appendMessage('user', text);
        this.input.value = '';
        
        const loading = this.appendMessage('bot', '...', true);
        
        try {
            if (!this.ai) {
                const key = await getApiKey();
                this.ai = new GoogleGenAI(key);
            }
            
            const model = this.ai.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
            const result = await model.generateContent(`System: Identify image search intent. If searching, return [[keyword]]. Otherwise chat normally.\nUser: ${text}`);
            const response = result.response.text();
            
            loading.parentElement.remove();
            this.processResponse(response);
        } catch (e) {
            console.error(e);
            loading.textContent = "Error: Please check your API key in .env or try again later.";
        }
    }

    appendMessage(role, text, isLoading = false) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `<div class="message-content">${text}</div>`;
        this.messages.prepend(div);
        return div.querySelector('.message-content');
    }

    async processResponse(text) {
        const match = text.match(/\[\[(.*?)\]\]/);
        const cleanText = text.replace(/\[\[.*?\]\]/g, '').trim();
        
        if (cleanText) {
            this.appendMessage('bot', cleanText);
        }
        
        if (match) {
            const keyword = match[1];
            await this.showImages(keyword);
        }
    }

    async showImages(keyword) {
        const loading = this.appendMessage('bot', `Simulating colors for "${keyword}"...`);
        try {
            // Using a more reliable way to get Unsplash images
            const url = `https://source.unsplash.com/featured/?${encodeURIComponent(keyword)}`;
            const res = await fetch(url);
            const finalUrl = res.url;
            
            loading.parentElement.remove();
            
            const div = document.createElement('div');
            div.className = 'message bot';
            div.innerHTML = `
                <div class="message-content">
                    <p>Simulation for <strong>${keyword}</strong>:</p>
                    <div class="image-result">
                        <div class="image-card"><img src="${finalUrl}"><div class="image-label">Original</div></div>
                        <div class="image-card"><img src="${finalUrl}" class="protanopia"><div class="image-label">Prot</div></div>
                        <div class="image-card"><img src="${finalUrl}" class="deuteranopia"><div class="image-label">Deut</div></div>
                        <div class="image-card"><img src="${finalUrl}" class="tritanopia"><div class="image-label">Trit</div></div>
                    </div>
                </div>`;
            this.messages.prepend(div);
        } catch (e) {
            loading.textContent = `Could not find image for "${keyword}".`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Simulator();
    new VisionBot();
});
