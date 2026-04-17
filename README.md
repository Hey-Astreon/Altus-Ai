# Aura — Stealth AI Interview Assistant 🕵️‍♂️✨

Aura is a high-performance, undetectable Windows desktop application designed to provide real-time AI assistance during online interviews. It uses advanced stealth techniques to remain invisible to screen-sharing and proctoring software while providing you with instant, expert-level answers.

---

## 🚀 Overview

Aura acts as your "silent partner" during an interview. It captures the interviewer's voice through system audio loopback, transcribes it in real-time using AssemblyAI, and generates answers using cutting-edge LLMs (Claude 3.5 Sonnet and Gemma 4) via OpenRouter.

### Key Highlights:
*   **Total Stealth**: Specifically built to bypass OBS, Zoom, Teams, and standard proctoring tools.
*   **Dual-Brain Intelligence**: Toggle between a high-speed "Turbo" mode for general talk and a "Genius" mode for complex logic.
*   **Vision-Enabled**: Analyze technical diagrams or code snippets shown on the interviewer's screen with one click.
*   **Encrypted Security**: Your API keys are locked using the Windows SafeStorage API.

---

## 🛠 Tech Stack

*   **Runtime**: [Electron](https://www.electronjs.org/) (Main process & Preload bridge)
*   **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
*   **Styling**: Vanilla CSS (Obsidian Neon Glassmorphism)
*   **Audio Capture**: Hidden Renderer + MediaDevices (Loopback)
*   **Speech-to-Text**: [AssemblyAI](https://www.assemblyai.com/) (Real-time WebSockets)
*   **LLM Gateway**: [OpenRouter](https://openrouter.ai/) (Gemini 1.5 Flash & Claude 3.5 Sonnet)
*   **Security**: Electron `safeStorage` + `electron-store`

---

## 🌟 Features

### 1. **Obsidian Stealth UI**
The application window is frameless, transparent, and excluded from OS-level screen capture. It sits on top of your windows but remains invisible to everyone but you.

### 2. **Real-time Transcription**
Heats and transcribes the interviewer's voice with <500ms latency. Supports an "English-only" lock for maximum speed and accuracy during technical sessions.

### 3. **AI Question Detection**
Aura proactively identifies when a question has been asked and starts "thinking" automatically, showing you a live-streaming answer character-by-character.

### 4. **Vision Analysis**
Click the **Eye Icon** to capture a silent screenshot of the interviewer's screen. Aura will decode the diagram, flowchart, or code snippet and explain it to you.

### 5. **Interview Personas**
Switch between **Technical**, **System Design**, and **Behavioral** modes to change the AI's "expertise" and tone instantly.

---

## 🏁 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn
*   An **AssemblyAI API Key**
*   An **OpenRouter API Key**

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Silenttears-cloud/Aura-AI-Desktop-Application.git
    cd aura
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

### Running the App

1.  **Start the development environment**:
    ```bash
    npm run start
    ```
    *This will launch the Vite dev server and the Electron shell concurrently.*

2.  **Configuration**:
    *   Click the **Settings Gear** ⚙️ in the app header.
    *   Paste your API keys. They will be encrypted and saved locally.

---

## 🕹 How to Use

*   **Start Listening**: Click the **Start** button in the header. Aura will start transcribing the system audio.
*   **Analyze Screen**: Click the **Eye Icon** 👁️ to capture the current screen content for AI analysis.
*   **Panic Button (Genius Mode)**: Toggle from **Turbo** to **Genius** mode if the interviewer asks an extremely difficult reasoning question.
*   **Toggle Overlay**: Use `Ctrl + Shift + V` to quickly show/hide the application.
*   **Emergency Quit**: Use `Ctrl + Shift + Q` to instantly kill the application.

---

## 🔮 Future Roadmap & Enhancements

To take Aura to the next level, I recommend implementing the following:

1.  **Auto-Vision Sync**: A "Low Frequency" auto-screenshot mode that keeps an eye on the code being written without manual clicks.
2.  **Multilingual Support**: Add auto-detection for interviews in non-English languages.
3.  **Local LLM Fallback**: Implement `Ollama` or `LM Studio` integration for 100% offline intelligence.
4.  **Audio Noise Cancellation**: Add a filter to the audio worker to handle interviewers with low-quality microphones or background noise.
5.  **Mock Interview Mode**: A training mode where Aura asks you questions and evaluates your responses based on real-world transcriptions.

---

## 📄 License
This project is for educational and personal use only. Please use responsibly and in accordance with your local interview ethical guidelines.
