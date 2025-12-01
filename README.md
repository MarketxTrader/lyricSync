# LyricSync AI

LyricSync AI is a modern web application that uses Google's Gemini 2.5 Flash model to automatically generate synchronized lyrics (LRC format) from audio files.

## Features

- **Drag & Drop Interface**: Easily upload MP3, WAV, or AAC files.
- **AI-Powered Transcription**: Utilizes Gemini 2.5 Flash for fast and accurate lyric generation.
- **LRC Editor**: View, edit, and copy synchronized lyrics.
- **Integrated Player**: Preview your audio track while editing lyrics.
- **LRC Export**: Download the result as a standard `.lrc` file for use in media players.

## Setup

1. **Environment Variables**:
   You must provide a valid API Key for Google GenAI.
   Create an environment variable named `API_KEY` with your key.

2. **Running the App**:
   This project is built with React. Ensure you have the necessary dependencies installed if building locally, or run within a compatible environment that supports the Google GenAI SDK.

## Technologies

- React 19
- TypeScript
- Tailwind CSS
- Google GenAI SDK (Gemini 2.5 Flash)
- FontAwesome

## License

MIT
