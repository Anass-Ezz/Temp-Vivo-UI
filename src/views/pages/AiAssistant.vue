<script setup>
import { ref, nextTick } from 'vue';

const API_URL = 'https://5e2zeiswxyqfufrjyvkczkbs5a0iksqj.lambda-url.eu-west-1.on.aws/';
const USER_ID = 'user-iss';

const messages = ref([
    {
        role: 'assistant',
        content: 'Hello! I am **ISSAI**, your intelligent assistant for the ISS mining safety system.\n\nI can help you with:\n- Worker and zone information from the database\n- Mining safety procedures and regulations\n- Emergency protocols and PPE requirements\n\nHow can I assist you today?',
        type: 'text'
    }
]);
const userInput = ref('');
const isLoading = ref(false);
const messagesContainer = ref(null);

function scrollToBottom() {
    nextTick(() => {
        if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
    });
}

// Build history from last 3 exchanges (6 messages max)
function buildHistory() {
    const nonSystem = messages.value.filter(m => m.type !== 'error');
    const last6 = nonSystem.slice(-6);
    return last6.map(m => ({
        role: m.role,
        content: m.content.length > 300 ? m.content.substring(0, 300) + '...' : m.content
    }));
}

// Markdown renderer with table support
function renderMarkdown(text) {
    if (!text) return '';

    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Tables — must be processed before other replacements
    html = html.replace(/(\|.+\|\n?)([\|\-: ]+\|\n?)((?:\|.+\|\n?)*)/gm, (match, header, separator, body) => {
        const headers = header.split('|')
            .map(h => h.trim())
            .filter(h => h.length > 0)
            .map(h => `<th>${h}</th>`)
            .join('');

        const rows = body.trim().split('\n').filter(r => r.trim()).map(row => {
            const cells = row.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);
            return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
        }).join('');

        return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    });

    // Bold and italic
    html = html
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Lists
    html = html
        .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

    // Headings
    html = html
        .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');

    // Paragraphs
    html = html
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
}

async function sendMessage() {
    const question = userInput.value.trim();
    if (!question || isLoading.value) return;

    messages.value.push({ role: 'user', content: question, type: 'text' });
    userInput.value = '';
    isLoading.value = true;
    scrollToBottom();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                question,
                userId: USER_ID,
                history: buildHistory()
            })
        });

        const data = await response.json();

        if (data.type === 'text') {
            messages.value.push({ role: 'assistant', content: data.answer, type: 'text' });
        } else {
            messages.value.push({
                role: 'assistant',
                content: data.answer || 'An error occurred. Please try again.',
                type: 'error'
            });
        }
    } catch (err) {
        const msg = err.name === 'AbortError'
            ? 'The request took too long. Please try a simpler question.'
            : 'Something went wrong. Please try again.';
        messages.value.push({ role: 'assistant', content: msg, type: 'error' });
    } finally {
        clearTimeout(timeoutId);
        isLoading.value = false;
        scrollToBottom();
    }
}

function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}
</script>

<template>
    <div class="ai-assistant-container">
        <!-- Header -->
        <div class="header mb-4">
            <div class="header-top">
                <div class="header-title">
                    <div class="issai-badge">
                        <i class="pi pi-android"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-semibold">Chat with your Building</h2>
                        <p class="header-subtitle">Powered by ISSAI — ISS Intelligent Assistant</p>
                    </div>
                </div>
                <div class="status-badge">
                    <span class="status-dot"></span>
                    Online
                </div>
            </div>
        </div>

        <!-- Chat window -->
        <div class="chat-window card">
            <div class="messages-container" ref="messagesContainer">
                <div
                    v-for="(message, index) in messages"
                    :key="index"
                    :class="['message', message.role === 'user' ? 'message-user' : 'message-assistant']"
                >
                    <div :class="['avatar', message.role === 'user' ? 'avatar-user' : 'avatar-assistant']">
                        <i :class="message.role === 'user' ? 'pi pi-user' : 'pi pi-android'"></i>
                    </div>

                    <div :class="['bubble', message.role === 'user' ? 'bubble-user' : 'bubble-assistant', message.type === 'error' ? 'bubble-error' : '']">
                        <div v-if="message.type === 'error'" class="error-header">
                            <i class="pi pi-exclamation-circle"></i>
                            <span>Something went wrong</span>
                        </div>
                        <div v-if="message.role === 'assistant'" class="markdown-content" v-html="renderMarkdown(message.content)"></div>
                        <div v-else>{{ message.content }}</div>
                    </div>
                </div>

                <!-- Loading -->
                <div v-if="isLoading" class="message message-assistant">
                    <div class="avatar avatar-assistant">
                        <i class="pi pi-android"></i>
                    </div>
                    <div class="bubble bubble-assistant bubble-loading">
                        <div class="thinking-label">ISSAI is thinking</div>
                        <div class="dots-container">
                            <span class="dot"></span>
                            <span class="dot"></span>
                            <span class="dot"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Input -->
            <div class="input-area">
                <div class="input-wrapper">
                    <input
                        v-model="userInput"
                        @keydown="handleKeydown"
                        type="text"
                        placeholder="Ask about safety procedures or zone data..."
                        :disabled="isLoading"
                        class="chat-input"
                    />
                    <button @click="sendMessage" :disabled="isLoading || !userInput.trim()" class="send-button">
                        <i class="pi pi-send"></i>
                    </button>
                </div>
                <div class="input-hint">Press Enter to send · Powered by Amazon Bedrock</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ai-assistant-container {
    padding: 1.5rem;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header-title {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.issai-badge {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.4rem;
    flex-shrink: 0;
}

.header-subtitle {
    color: #a5b4fc;
    font-size: 0.85rem;
    margin-top: 0.15rem;
}

.status-badge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #1a2e1a;
    color: #86efac;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    border: 1px solid #166534;
}

.status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #86efac;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.chat-window {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 78vh;
    border-radius: 12px;
    overflow: hidden;
    padding: 0;
}

.messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    scroll-behavior: smooth;
}

.message {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}

.message-user { flex-direction: row-reverse; }

.avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 0.9rem;
}

.avatar-assistant {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
}

.avatar-user {
    background: #2d3147;
    color: #a5b4fc;
}

.bubble {
    max-width: 78%;
    padding: 0.85rem 1.1rem;
    border-radius: 14px;
    font-size: 0.9rem;
    line-height: 1.6;
    word-break: break-word;
}

.bubble-assistant {
    background: #1e2139;
    color: #e2e8f0;
    border-bottom-left-radius: 4px;
}

.bubble-user {
    background: linear-gradient(135deg, #4f46e5, #4338ca);
    color: white;
    border-bottom-right-radius: 4px;
}

.bubble-error {
    background: #2e1a1a !important;
    color: #fca5a5 !important;
    border: 1px solid #7f1d1d;
}

.error-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
    color: #f87171;
}

/* Markdown styles */
.markdown-content :deep(p) { margin: 0 0 0.6rem 0; }
.markdown-content :deep(p:last-child) { margin-bottom: 0; }
.markdown-content :deep(strong) { font-weight: 700; color: #c7d2fe; }
.bubble-user .markdown-content :deep(strong) { color: white; }
.markdown-content :deep(em) { font-style: italic; color: #a5b4fc; }
.markdown-content :deep(ul) { margin: 0.4rem 0; padding-left: 1.2rem; list-style: none; }
.markdown-content :deep(li) { position: relative; padding-left: 0.8rem; margin-bottom: 0.3rem; color: #e2e8f0; }
.markdown-content :deep(li::before) { content: "•"; position: absolute; left: -0.2rem; color: #818cf8; }
.markdown-content :deep(h2) { font-size: 1rem; font-weight: 700; color: #c7d2fe; margin: 0.6rem 0 0.3rem 0; }
.markdown-content :deep(h3) { font-size: 0.95rem; font-weight: 700; color: #a5b4fc; margin: 0.5rem 0 0.2rem 0; }
.markdown-content :deep(h4) { font-size: 0.9rem; font-weight: 600; color: #818cf8; margin: 0.4rem 0 0.2rem 0; }

/* Table styles */
.markdown-content :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
    font-size: 0.82rem;
    border-radius: 8px;
    overflow: hidden;
}

.markdown-content :deep(th) {
    background: #2d3147;
    color: #a5b4fc;
    padding: 0.5rem 0.75rem;
    text-align: left;
    border: 1px solid #3b3f5c;
    font-weight: 600;
    white-space: nowrap;
}

.markdown-content :deep(td) {
    padding: 0.45rem 0.75rem;
    border: 1px solid #2a2d45;
    color: #e2e8f0;
    vertical-align: top;
}

.markdown-content :deep(tr:nth-child(even) td) {
    background: #1a1d2e;
}

.markdown-content :deep(tr:nth-child(odd) td) {
    background: #1e2139;
}

.markdown-content :deep(tr:hover td) {
    background: #252844;
    transition: background 0.15s ease;
}

/* Loading */
.bubble-loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.1rem;
}

.thinking-label {
    font-size: 0.8rem;
    color: #818cf8;
    font-style: italic;
}

.dots-container { display: flex; gap: 0.3rem; align-items: center; }

.dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #818cf8;
    animation: bounce 1.2s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
}

/* Input */
.input-area {
    padding: 1rem 1.5rem 0.75rem;
    border-top: 1px solid #2d3147;
    background: #1a1d2e;
}

.input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.chat-input {
    flex: 1;
    background: #2d3147;
    border: 1px solid #3b3f5c;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    color: #e2e8f0;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: Arial, sans-serif;
}

.chat-input:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.chat-input:disabled { opacity: 0.5; cursor: not-allowed; }

.send-button {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, #4f46e5, #4338ca);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s, transform 0.1s;
    flex-shrink: 0;
    font-size: 1rem;
}

.send-button:hover:not(:disabled) { opacity: 0.9; transform: scale(1.05); }
.send-button:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

.input-hint {
    font-size: 0.72rem;
    color: #4b5563;
    margin-top: 0.4rem;
    text-align: center;
}
</style>