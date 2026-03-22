# FAQ Chatbot

An AI-powered FAQ assistant built with **Angular 21** and **FastAPI**. This project features a futuristic, voice-reactive interface with real-time streaming LLM responses.

##  Tech Stack

### Frontend
- **Framework**: Angular 21 (Standalone components)
- **Styling**: Tailwind CSS 4
- **State Management**: Signals
- **Icons**: Lucide Angular
- **APIs**: Web Audio API, Web Speech API

### Backend
- **Framework**: FastAPI
- **LLM Engine**: Ollama (`smollm2:1.7b-instruct-q4_0`)
- **Data Format**: NDJSON streaming

---

##  Getting Started

### 1. Backend Setup (FastAPI)

1. **Install Ollama**: Download and install from [ollama.com](https://ollama.com/).
2. **Pull the Model**:
   ```bash
   ollama pull smollm2:1.7b-instruct-q4_0
   ```
3. **Setup Environment**:
   ```bash
   cd FastAPI
   python -m venv .venv
   # Windows: .venv\Scripts\activate
   # Linux/Mac: source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Run the Server**:
   ```bash
   python main.py
   ```
   *The backend will run on `http://localhost:8000`.*

### 2. Frontend Setup (Angular)

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run Development Server**:
   ```bash
   npm start
   ```
3. **Open the App**:
   Visit `http://localhost:4200` in your browser.

---

##  Project Structure

- `src/app/app.ts`: Core frontend logic (audio analysis, chat state).
- `src/app/app.html`: Main visual interface (Assistant Orb & Chat).
- `FastAPI/main.py`: AI backend logic & Ollama integration.
- `FastAPI/faq.json`: Knowledge base for the assistant.

##  Notes

- Ensure Ollama is running before starting the chat interaction.
