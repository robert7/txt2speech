// Mock the Google Cloud Text-to-Speech client
const mockSynthesizeSpeech = jest.fn();
const mockListVoices = jest.fn();

jest.mock('@google-cloud/text-to-speech', () => {
    return {
        TextToSpeechClient: jest.fn().mockImplementation(() => ({
            synthesizeSpeech: mockSynthesizeSpeech,
            listVoices: mockListVoices
        }))
    };
});

// Mock fs.writeFile using promisified version
const mockWriteFile = jest.fn();
jest.mock('util', () => ({
    promisify: jest.fn((fn) => {
        if (fn.name === 'writeFile') {
            return mockWriteFile;
        }
        return fn;
    })
}));

const { synthesize, listVoices, DEFAULT_SPEAKING_RATE } = require('../src/gcpTextToSpeech');

describe('Google Cloud Text-to-Speech API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('synthesize', () => {
        test('should synthesize text with default voice and settings', async () => {
            const mockAudioContent = Buffer.from('fake audio data');
            mockSynthesizeSpeech.mockResolvedValue([{ audioContent: mockAudioContent }]);
            mockWriteFile.mockResolvedValue();

            const result = await synthesize('Hello world', 'output.mp3');

            expect(result).toBe(true);
            expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
                input: { text: 'Hello world' },
                voice: {
                    name: 'en-US-Chirp3-HD-Aoede',
                    ssmlGender: 'FEMALE',
                    languageCode: 'en-US'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: DEFAULT_SPEAKING_RATE
                }
            });
            expect(mockWriteFile).toHaveBeenCalledWith('output.mp3', mockAudioContent, 'binary');
        });

        test('should synthesize text with custom voice', async () => {
            const mockAudioContent = Buffer.from('fake audio data');
            mockSynthesizeSpeech.mockResolvedValue([{ audioContent: mockAudioContent }]);
            mockWriteFile.mockResolvedValue();

            const customVoice = {
                name: 'en-US-Wavenet-D',
                ssmlGender: 'MALE',
                languageCode: 'en-US'
            };

            const result = await synthesize('Hello world', 'output.mp3', customVoice);

            expect(result).toBe(true);
            expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
                input: { text: 'Hello world' },
                voice: customVoice,
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: DEFAULT_SPEAKING_RATE
                }
            });
        });

        test('should synthesize text with custom speaking rate', async () => {
            const mockAudioContent = Buffer.from('fake audio data');
            mockSynthesizeSpeech.mockResolvedValue([{ audioContent: mockAudioContent }]);
            mockWriteFile.mockResolvedValue();

            const customRate = 1.2;
            const result = await synthesize('Hello world', 'output.mp3', null, customRate);

            expect(result).toBe(true);
            expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
                input: { text: 'Hello world' },
                voice: {
                    name: 'en-US-Chirp3-HD-Aoede',
                    ssmlGender: 'FEMALE',
                    languageCode: 'en-US'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: customRate
                }
            });
        });

        test('should return false when API call fails', async () => {
            mockSynthesizeSpeech.mockRejectedValue(new Error('API Error'));

            const result = await synthesize('Hello world', 'output.mp3');

            expect(result).toBe(false);
            expect(mockSynthesizeSpeech).toHaveBeenCalled();
        });

        test('should return false when file write fails', async () => {
            const mockAudioContent = Buffer.from('fake audio data');
            mockSynthesizeSpeech.mockResolvedValue([{ audioContent: mockAudioContent }]);
            mockWriteFile.mockRejectedValue(new Error('Write error'));

            const result = await synthesize('Hello world', 'output.mp3');

            expect(result).toBe(false);
        });
    });

    describe('listVoices', () => {
        test('should list and sort voices', async () => {
            const mockVoices = [
                {
                    name: 'en-US-Wavenet-D',
                    ssmlGender: 'MALE',
                    languageCodes: ['en-US']
                },
                {
                    name: 'en-US-Wavenet-A',
                    ssmlGender: 'FEMALE',
                    languageCodes: ['en-US']
                },
                {
                    name: 'fr-FR-Wavenet-A',
                    ssmlGender: 'FEMALE',
                    languageCodes: ['fr-FR']
                }
            ];

            mockListVoices.mockResolvedValue([{ voices: mockVoices }]);

            // Mock console.log to capture output
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await listVoices();

            expect(mockListVoices).toHaveBeenCalledWith({});
            
            // Verify voices are sorted alphabetically
            expect(consoleSpy).toHaveBeenCalledWith('en-US-Wavenet-A, FEMALE, en-US');
            expect(consoleSpy).toHaveBeenCalledWith('en-US-Wavenet-D, MALE, en-US');
            expect(consoleSpy).toHaveBeenCalledWith('fr-FR-Wavenet-A, FEMALE, fr-FR');

            consoleSpy.mockRestore();
        });

        test('should handle voices with multiple language codes', async () => {
            const mockVoices = [
                {
                    name: 'en-US-Wavenet-A',
                    ssmlGender: 'FEMALE',
                    languageCodes: ['en-US', 'en-CA']
                }
            ];

            mockListVoices.mockResolvedValue([{ voices: mockVoices }]);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await listVoices();

            expect(consoleSpy).toHaveBeenCalledWith('en-US-Wavenet-A, FEMALE, en-US en-CA');

            consoleSpy.mockRestore();
        });

        test('should handle empty voices list', async () => {
            mockListVoices.mockResolvedValue([{ voices: [] }]);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await listVoices();

            expect(mockListVoices).toHaveBeenCalledWith({});
            expect(consoleSpy).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        test('should handle API errors gracefully', async () => {
            mockListVoices.mockRejectedValue(new Error('API Error'));

            await expect(listVoices()).rejects.toThrow('API Error');
        });
    });
});