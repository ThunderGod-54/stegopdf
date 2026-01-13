// Simple Chatbot Implementation
class Chatbot {
    constructor() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.responses = [
            "That's interesting! Can you tell me more?",
            "I understand. How can I assist you further?",
            "Great question! Let me think about that.",
            "I'm here to help with your PDF editing needs.",
            "What specific feature would you like to know about?",
            "That's a good point. Is there anything else I can help with?",
            "I see. Would you like me to explain any PDF editing concepts?",
            "Thanks for sharing that. How else can I support you?"
        ];

        this.init();
    }

    init() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    sendMessage() {
        const message = this.input.value.trim();
        if (message === '') return;

        this.addMessage(message, 'user');
        this.input.value = '';

        // Simulate bot response after a short delay
        setTimeout(() => {
            const response = this.getRandomResponse();
            this.addMessage(response, 'bot');
        }, 500 + Math.random() * 1000);
    }

    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        messageDiv.textContent = text;
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    getRandomResponse() {
        return this.responses[Math.floor(Math.random() * this.responses.length)];
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Chatbot();
});