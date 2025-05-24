const { fixLongLines, addContentToResult, parseVoice, parseCommandLine } = require('../src/index');

describe('Text Processing Logic', () => {
    describe('fixLongLines', () => {
        test('should break long lines at sentence boundaries', () => {
            const longText = 'This is a sentence. '.repeat(20) + 'Final sentence';
            const result = fixLongLines(longText);
            
            expect(result).toContain('.\n');
            expect(result.length).toBeGreaterThan(0);
        });

        test('should handle short text without breaking', () => {
            const shortText = 'This is a short sentence.';
            const result = fixLongLines(shortText);
            
            expect(result).toBe(shortText);
        });

        test('should handle empty text', () => {
            const result = fixLongLines('');
            expect(result).toBe('');
        });

        test('should preserve sentence structure when breaking', () => {
            const text = 'First sentence. Second sentence. Third sentence.';
            const result = fixLongLines(text);
            
            expect(result).toContain('First sentence');
            expect(result).toContain('Second sentence');
            expect(result).toContain('Third sentence');
        });
    });

    describe('addContentToResult', () => {
        test('should add new block when blocks array is empty', () => {
            const blocks = [];
            addContentToResult(blocks, 1, 'Test content');
            
            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toEqual({
                id: 1,
                blockContent: 'Test content'
            });
        });

        test('should append to last block when combined length is under target', () => {
            const blocks = [{
                id: 1,
                blockContent: 'Short content'
            }];
            
            addContentToResult(blocks, 2, 'More content');
            
            expect(blocks).toHaveLength(1);
            expect(blocks[0].blockContent).toBe('Short content\nMore content');
        });

        test('should create new block when combined length exceeds target', () => {
            const blocks = [{
                id: 1,
                blockContent: 'x'.repeat(2000)
            }];
            
            addContentToResult(blocks, 2, 'x'.repeat(600));
            
            expect(blocks).toHaveLength(2);
            expect(blocks[1].id).toBe(2);
            expect(blocks[1].blockContent).toBe('x'.repeat(600));
        });

        test('should throw error when content exceeds maximum block length', () => {
            const blocks = [];
            const longContent = 'x'.repeat(5001); // MAX_BLOCK_LEN + 1
            
            expect(() => {
                addContentToResult(blocks, 1, longContent);
            }).toThrow('block longer then API maximum - ABORT');
        });
    });

    describe('parseVoice', () => {
        test('should parse valid voice string', () => {
            const voiceString = 'en-US-Wavenet-D, MALE, en-US';
            const result = parseVoice(voiceString);
            
            expect(result).toEqual({
                name: 'en-US-Wavenet-D',
                ssmlGender: 'MALE',
                languageCode: 'en-US'
            });
        });

        test('should handle voice string with extra spaces', () => {
            const voiceString = '  en-US-Wavenet-D  ,  MALE  ,  en-US  ';
            const result = parseVoice(voiceString);
            
            expect(result).toEqual({
                name: 'en-US-Wavenet-D',
                ssmlGender: 'MALE',
                languageCode: 'en-US'
            });
        });

        test('should return undefined for invalid voice string', () => {
            expect(parseVoice('invalid')).toBeUndefined();
            expect(parseVoice('one, two')).toBeUndefined();
            expect(parseVoice('one, two, three, four')).toBeUndefined();
        });

        test('should return undefined for non-string input', () => {
            expect(parseVoice(null)).toBeUndefined();
            expect(parseVoice(undefined)).toBeUndefined();
            expect(parseVoice(123)).toBeUndefined();
            expect(parseVoice([])).toBeUndefined();
        });
    });

    describe('parseCommandLine', () => {
        test('should parse basic help option', () => {
            const argv = ['node', 'index.js', '--help'];
            const result = parseCommandLine(argv);
            
            expect(result.help).toBe(true);
            expect(result.displayHelpAndQuit).toBe(true);
        });

        test('should parse listVoices option', () => {
            const argv = ['node', 'index.js', '--listVoices'];
            const result = parseCommandLine(argv);
            
            expect(result.listVoices).toBe(true);
        });

        test('should parse input file', () => {
            const argv = ['node', 'index.js', 'test.txt'];
            const result = parseCommandLine(argv);
            
            expect(result.import).toBe('test.txt');
            expect(result.displayHelpAndQuit).toBe(false);
        });

        test('should reject non-txt files', () => {
            const argv = ['node', 'index.js', 'test.mp3'];
            const result = parseCommandLine(argv);
            
            expect(result.displayHelpAndQuit).toBe(true);
        });

        test('should parse voice option', () => {
            const argv = ['node', 'index.js', 'test.txt', '--voice', 'en-US-Wavenet-D, MALE, en-US'];
            const result = parseCommandLine(argv);
            
            expect(result.voice).toBe('en-US-Wavenet-D, MALE, en-US');
        });

        test('should parse line range options', () => {
            const argv = ['node', 'index.js', 'test.txt', '--startLine', '10', '--endLine', '20'];
            const result = parseCommandLine(argv);
            
            expect(result.startLine).toBe(10);
            expect(result.endLine).toBe(20);
        });
    });
});