# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm test` - Run tests using Jest
- `node src/index.js --help` - Show CLI help and usage examples
- `node src/index.js --listVoices` - List available Google TTS voices
- `node src/index.js input.txt` - Convert text file to speech (requires Google Cloud credentials)

## Architecture

This is a text-to-speech utility that converts text files to MP3 audio using Google Cloud Text-to-Speech API.

### Core Components

- `src/index.js` - Main CLI application with file processing and command line parsing
- `src/gcpTextToSpeech.js` - Google Cloud TTS API integration and voice synthesis
- `src/mp3Util.js` - MP3 file concatenation using ffmpeg (handles large files by chunking)

### Key Processing Flow

1. Text files are split into blocks (max 5000 chars per API limit, target 2500 chars)
2. Each block is converted to MP3 via Google TTS API
3. All MP3 files are concatenated into a single output file
4. Temporary files are cleaned up

### Important Constraints

- Requires Google Cloud credentials via `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Requires ffmpeg on PATH for MP3 concatenation
- Text blocks are limited by Google TTS API (5000 char max)
- Uses Chirp 3 HD voices by default (free tier: 1M chars/month)

### Voice Configuration

Voice parameter format: "name, gender, language" (e.g., "en-US-Wavenet-D, MALE, en-US")
Default voice: en-US-Chirp3-HD-Aoede, FEMALE, en-US