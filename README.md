# JarvisBot

JarvisBot is a voice assistant frontend prototype built with Angular. The current version focuses on the first interaction layer: a simple web page that listens to microphone input and animates a visual core based on live sound intensity.

## Current MVP

- Requests microphone access in the browser
- Reads live input intensity with the Web Audio API
- Animates a central assistant orb in real time
- Displays basic state feedback such as idle, connecting, listening, and voice detected
- Supports Angular SSR without running browser-only microphone code on the server

## Project Goal

The long-term goal is to build a Jarvis-style assistant interface. This first milestone is the visual and interaction shell for voice input. It establishes the frontend experience before adding speech recognition, assistant responses, and backend intelligence.

## Tech Stack

- Angular 21
- Angular SSR
- TypeScript
- Tailwind CSS 4
- Web Audio API
- Express

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Then open:

```text
http://localhost:4200/
```

Allow microphone access when the browser prompts you. Once listening starts, the central visual reacts to your voice volume in real time.

## Build

Create a production build with:

```bash
npm run build
```

The output is generated in `dist/jarvis_bot`.

## Test

Run the test suite with:

```bash
npm test
```

## Current Structure

- `src/app/app.ts`: microphone handling, audio analysis, reactive UI state
- `src/app/app.html`: main assistant interface
- `src/app/app.css`: visual design and animation styling

## Next Steps

- Add waveform bars or richer voice-reactive visuals
- Add speech-to-text support
- Add assistant response states
- Connect the frontend to a backend assistant service
- Introduce conversation history and command handling

## Notes

- Microphone features only work in a browser environment
- If microphone permission is denied, the UI stays available but live input will not start
