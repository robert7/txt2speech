# Test Implementation Plan

## Current State
- Jest is configured and working with a basic test
- Test command: `npm test`
- Test directory: `tests/`

## Testing Strategy

### 1. Unit Tests for Core Functions

#### `src/index.js`
- `fixLongLines(textContent)` - Text processing logic
- `addContentToResult(blocks, blockId, textContent)` - Block management
- `parseVoice(paramVoice)` - Voice parameter parsing
- `parseCommandLine(argv)` - CLI argument validation
- `importTxtFile(fileName, options)` - File reading and processing

#### `src/gcpTextToSpeech.js`
- `synthesize(text, outputFile, voice, speakingRate)` - Mock Google API calls
- `listVoices()` - Mock Google API calls

#### `src/mp3Util.js`
- `concatMp3Files(mp3Files, concatedMp3Filename, internals)` - Already has dependency injection structure for testing

### 2. Integration Tests
- File processing workflow (txt → blocks → mp3)
- Command line argument parsing end-to-end
- Error handling scenarios
- File cleanup operations

### 3. Mocking Strategy
- Mock Google Cloud TTS API calls (expensive/external dependency)
- Mock filesystem operations for test safety
- Mock ffmpeg/audioconcat for mp3 operations
- Use Jest's built-in mocking capabilities

### 4. Test File Structure
```
tests/
├── basic.test.js (existing)
├── index.test.js (CLI and main logic)
├── gcpTextToSpeech.test.js (Google TTS API)
├── mp3Util.test.js (MP3 operations)
└── integration.test.js (end-to-end workflows)
```

### 5. Priority Implementation Order
1. Text processing logic (block splitting, line breaking) - `index.test.js`
2. CLI option parsing and validation - `index.test.js`
3. MP3 concatenation logic - `mp3Util.test.js`
4. Google TTS API mocking - `gcpTextToSpeech.test.js`
5. Integration tests - `integration.test.js`
6. Error handling paths - across all test files

### 6. Test Data Requirements
- Sample text files for testing
- Mock audio data for MP3 operations
- Various CLI argument combinations
- Edge cases (empty files, long lines, special characters)