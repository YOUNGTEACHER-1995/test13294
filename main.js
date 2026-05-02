import { GoogleGenAI } from "https://esm.run/@google/genai";

// API Key is now stored in .env file.
// In a real production environment, this should be handled by a backend or build tool (e.g., Vite, Webpack).
// For this prototype, we'll attempt to fetch it or use a placeholder if not found.
let API_KEY = "";

async function getApiKey() {
    try {
        const response = await fetch('.env');
        const text = await response.text();
        const match = text.match(/GEMINI_API_KEY=(.*)/);
        return match ? match[1].trim() : "";
    } catch (e) {
        console.warn("Could not load .env file directly. Please ensure API key is available.");
        return "";
    }
}

let ai;
let SYSTEM_PROMPT = "You are VisionBot, a helpful AI that helps people understand color blindness. When a user asks to see an image of something (e.g., 'show me a watermelon'), you should respond in a friendly way and then trigger an image search. ALWAYS include the keyword for the image search in your response wrapped in double brackets, like [[watermelon]]. If they are just chatting, respond normally.";

class ChatApp {
    constructor() {
        this.messagesContainer = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.history = [];

        this.init();
    }

    async init() {
        API_KEY = await getApiKey() || "AIzaSyBRfb2yVGofUTarmItp9lwHp2cqW0sqHes"; // Fallback to provided key if fetch fails
        ai = new GoogleGenAI(API_KEY);

        this.sendBtn.onclick = () => this.handleSendMessage();
        this.userInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        };
    }

    async handleSendMessage() {
        const text = this.userInput.value.trim();
        if (!text) return;

        this.appendMessage('user', text);
        this.userInput.value = '';

        const loadingMsg = this.appendMessage('bot', 'Thinking...', true);

        try {
            const model = ai.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
            
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nUser: " + text }] }]
            });
            
            const responseText = result.response.text();
            
            loadingMsg.parentElement.remove();

            this.processBotResponse(responseText);
        } catch (error) {
            console.error("Gemini Error:", error);
            try {
                const fallbackModel = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
                const result = await fallbackModel.generateContent({
                    contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nUser: " + text }] }]
                });
                const responseText = result.response.text();
                loadingMsg.parentElement.remove();
                this.processBotResponse(responseText);
            } catch (fallbackError) {
                loadingMsg.textContent = "Sorry, I encountered an error. Please check your API key in .env.";
            }
        }
    }

    appendMessage(role, text, isLoading = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.innerHTML = `
            <div class="message-content">${text}</div>
        `;
        // Since we are using column-reverse in CSS, we use prepend to put newest at the "top" of the flow (which is the bottom of the container)
        this.messagesContainer.prepend(msgDiv);
        return msgDiv.querySelector('.message-content');
    }

    async processBotResponse(text) {
        const keywordMatch = text.match(/\[\[(.*?)\]\]/);
        const cleanText = text.replace(/\[\[.*?\]\]/g, '').trim();

        if (cleanText) {
            this.appendMessage('bot', cleanText);
        }

        if (keywordMatch) {
            const keyword = keywordMatch[1];
            await this.displayImageSimulation(keyword);
        }
    }

    async displayImageSimulation(keyword) {
        const loadingMsg = this.appendMessage('bot', `Finding images of "${keyword}"...`, true);
        
        try {
            const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(keyword)}`;
            const response = await fetch(imageUrl);
            const finalImageUrl = response.url;

            loadingMsg.parentElement.remove();

            const resultDiv = document.createElement('div');
            resultDiv.className = 'message bot';
            resultDiv.innerHTML = `
                <div class="message-content">
                    Here is how <strong>${keyword}</strong> looks to different people:
                    <div class="image-result">
                        <div class="image-card">
                            <img src="${finalImageUrl}" alt="Original">
                            <div class="image-label">Original</div>
                        </div>
                        <div class="image-card">
                            <img src="${finalImageUrl}" class="protanopia" alt="Protanopia">
                            <div class="image-label">Protanopia</div>
                        </div>
                        <div class="image-card">
                            <img src="${finalImageUrl}" class="deuteranopia" alt="Deuteranopia">
                            <div class="image-label">Deuteranopia</div>
                        </div>
                        <div class="image-card">
                            <img src="${finalImageUrl}" class="tritanopia" alt="Tritanopia">
                            <div class="image-label">Tritanopia</div>
                        </div>
                    </div>
                </div>
            `;
            this.messagesContainer.prepend(resultDiv);
        } catch (error) {
            console.error("Image Fetch Error:", error);
            loadingMsg.textContent = "I couldn't find an image for that. Try another keyword!";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
