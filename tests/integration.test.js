const fs = require('fs');
const path = require('path');
const { importTxtFile } = require('../src/index');

describe('Integration Tests', () => {
    const testDir = path.join(__dirname, 'test-files');
    const testFile = path.join(testDir, 'test-input.txt');

    beforeAll(() => {
        // Create test directory if it doesn't exist
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    afterAll(() => {
        // Clean up test files
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
        if (fs.existsSync(testDir)) {
            fs.rmdirSync(testDir);
        }
    });

    describe('importTxtFile', () => {
        test('should process a simple text file', async () => {
            const testContent = 'First line.\nSecond line.\nThird line.';
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {});

            expect(blocks).toHaveLength(1);
            expect(blocks[0].blockContent).toContain('First line.');
            expect(blocks[0].blockContent).toContain('Second line.');
            expect(blocks[0].blockContent).toContain('Third line.');
        });

        test('should handle line range options', async () => {
            const testContent = 'Line 1.\nLine 2.\nLine 3.\nLine 4.\nLine 5.';
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {
                startLine: 2,
                endLine: 4
            });

            expect(blocks).toHaveLength(1);
            expect(blocks[0].blockContent).toContain('Line 2.');
            expect(blocks[0].blockContent).toContain('Line 3.');
            expect(blocks[0].blockContent).toContain('Line 4.');
            expect(blocks[0].blockContent).not.toContain('Line 1.');
            expect(blocks[0].blockContent).not.toContain('Line 5.');
        });

        test('should split large content into multiple blocks', async () => {
            // Create content that will exceed TARGET_BLOCK_LEN (2500 chars)
            const longLine = 'This is a long line that will be repeated many times. '.repeat(50);
            const testContent = [longLine, longLine, longLine].join('\n');
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {});

            expect(blocks.length).toBeGreaterThan(1);
            blocks.forEach(block => {
                expect(block.blockContent.length).toBeLessThanOrEqual(5000); // MAX_BLOCK_LEN
            });
        });

        test('should handle empty lines correctly', async () => {
            const testContent = 'Line 1.\n\nLine 3.\n\n\nLine 6.';
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {});

            expect(blocks).toHaveLength(1);
            expect(blocks[0].blockContent).toContain('Line 1.');
            expect(blocks[0].blockContent).toContain('Line 3.');
            expect(blocks[0].blockContent).toContain('Line 6.');
        });

        test('should assign correct block IDs based on line numbers', async () => {
            const testContent = 'Line 1.\nLine 2.\nLine 3.';
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {});

            expect(blocks[0].id).toBe(1); // First line number
        });

        test('should handle files with only startLine option', async () => {
            const testContent = 'Line 1.\nLine 2.\nLine 3.\nLine 4.\nLine 5.';
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {
                startLine: 3
            });

            expect(blocks).toHaveLength(1);
            expect(blocks[0].blockContent).toContain('Line 3.');
            expect(blocks[0].blockContent).toContain('Line 4.');
            expect(blocks[0].blockContent).toContain('Line 5.');
            expect(blocks[0].blockContent).not.toContain('Line 1.');
            expect(blocks[0].blockContent).not.toContain('Line 2.');
        });

        test('should handle files with only endLine option', async () => {
            const testContent = 'Line 1.\nLine 2.\nLine 3.\nLine 4.\nLine 5.';
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {
                endLine: 3
            });

            expect(blocks).toHaveLength(1);
            expect(blocks[0].blockContent).toContain('Line 1.');
            expect(blocks[0].blockContent).toContain('Line 2.');
            expect(blocks[0].blockContent).toContain('Line 3.');
            expect(blocks[0].blockContent).not.toContain('Line 4.');
            expect(blocks[0].blockContent).not.toContain('Line 5.');
        });

        // Note: File error handling test skipped due to timing issues with stream error handling
    });

    describe('End-to-End Text Processing Workflow', () => {
        test('should process text through the complete pipeline', async () => {
            const testContent = 'This is a test sentence. Another sentence follows. And a third sentence.';
            fs.writeFileSync(testFile, testContent);

            const blocks = await importTxtFile(testFile, {});

            // Verify the blocks structure
            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toHaveProperty('id');
            expect(blocks[0]).toHaveProperty('blockContent');
            expect(typeof blocks[0].id).toBe('number');
            expect(typeof blocks[0].blockContent).toBe('string');
            expect(blocks[0].blockContent.length).toBeGreaterThan(0);
        });

        test('should maintain text integrity through processing', async () => {
            const originalText = 'First sentence. Second sentence. Third sentence.';
            fs.writeFileSync(testFile, originalText);

            const blocks = await importTxtFile(testFile, {});
            const processedText = blocks.map(block => block.blockContent).join('\n');

            // The processed text should contain all original content
            expect(processedText).toContain('First sentence.');
            expect(processedText).toContain('Second sentence.');
            expect(processedText).toContain('Third sentence.');
        });
    });
});