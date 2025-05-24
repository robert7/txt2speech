const { concatMp3Files } = require('../src/mp3Util');

describe('MP3 Concatenation', () => {
    describe('concatMp3Files', () => {
        test('should handle small number of files without chunking', async () => {
            const mockConcatMp3FilesInt = jest.fn().mockResolvedValue(true);
            const mockUnlinkIfExists = jest.fn();
            
            const mp3Files = ['file1.mp3', 'file2.mp3', 'file3.mp3'];
            const outputFile = 'output.mp3';
            
            const internals = {
                concatMp3FilesInt: mockConcatMp3FilesInt,
                unlinkIfExists: mockUnlinkIfExists,
                chunkSize: 35
            };
            
            const result = await concatMp3Files(mp3Files, outputFile, internals);
            
            expect(result).toBe(true);
            expect(mockConcatMp3FilesInt).toHaveBeenCalledWith(mp3Files, outputFile);
            expect(mockConcatMp3FilesInt).toHaveBeenCalledTimes(1);
        });

        test('should handle large number of files with chunking', async () => {
            const mockConcatMp3FilesInt = jest.fn().mockResolvedValue(true);
            const mockUnlinkIfExists = jest.fn();
            
            // Create array with more than chunkSize files
            const mp3Files = Array.from({ length: 40 }, (_, i) => `file${i + 1}.mp3`);
            const outputFile = 'output.mp3';
            
            const internals = {
                concatMp3FilesInt: mockConcatMp3FilesInt,
                unlinkIfExists: mockUnlinkIfExists,
                chunkSize: 35
            };
            
            const result = await concatMp3Files(mp3Files, outputFile, internals);
            
            expect(result).toBe(true);
            // Should be called twice: once for chunk, once for final concat
            expect(mockConcatMp3FilesInt).toHaveBeenCalledTimes(2);
            
            // First call should be for chunking
            expect(mockConcatMp3FilesInt).toHaveBeenNthCalledWith(1, mp3Files.slice(0, 35), 'tmp-1.mp3');
            
            // Second call should be for final concat with temp file + remaining files
            const finalFiles = ['tmp-1.mp3'].concat(mp3Files.slice(35));
            expect(mockConcatMp3FilesInt).toHaveBeenNthCalledWith(2, finalFiles, outputFile);
            
            // Temp file should be cleaned up
            expect(mockUnlinkIfExists).toHaveBeenCalledWith('tmp-1.mp3');
        });

        test('should handle multiple chunking levels', async () => {
            const mockConcatMp3FilesInt = jest.fn().mockResolvedValue(true);
            const mockUnlinkIfExists = jest.fn();
            
            // Create array with many more files to trigger multiple chunking
            const mp3Files = Array.from({ length: 80 }, (_, i) => `file${i + 1}.mp3`);
            const outputFile = 'output.mp3';
            
            const internals = {
                concatMp3FilesInt: mockConcatMp3FilesInt,
                unlinkIfExists: mockUnlinkIfExists,
                chunkSize: 35
            };
            
            const result = await concatMp3Files(mp3Files, outputFile, internals);
            
            expect(result).toBe(true);
            // Should be called multiple times for chunking
            expect(mockConcatMp3FilesInt).toHaveBeenCalledTimes(3);
            
            // Check temp files are cleaned up
            expect(mockUnlinkIfExists).toHaveBeenCalledWith('tmp-1.mp3');
            expect(mockUnlinkIfExists).toHaveBeenCalledWith('tmp-2.mp3');
        });

        test('should return false when concatenation fails', async () => {
            const mockConcatMp3FilesInt = jest.fn().mockResolvedValue(false);
            const mockUnlinkIfExists = jest.fn();
            
            const mp3Files = ['file1.mp3', 'file2.mp3'];
            const outputFile = 'output.mp3';
            
            const internals = {
                concatMp3FilesInt: mockConcatMp3FilesInt,
                unlinkIfExists: mockUnlinkIfExists,
                chunkSize: 35
            };
            
            const result = await concatMp3Files(mp3Files, outputFile, internals);
            
            expect(result).toBe(false);
            expect(mockConcatMp3FilesInt).toHaveBeenCalledWith(mp3Files, outputFile);
        });

        test('should return false when chunking fails', async () => {
            const mockConcatMp3FilesInt = jest.fn()
                .mockResolvedValueOnce(false) // First chunk fails
                .mockResolvedValue(true);     // Others would succeed
            const mockUnlinkIfExists = jest.fn();
            
            const mp3Files = Array.from({ length: 40 }, (_, i) => `file${i + 1}.mp3`);
            const outputFile = 'output.mp3';
            
            const internals = {
                concatMp3FilesInt: mockConcatMp3FilesInt,
                unlinkIfExists: mockUnlinkIfExists,
                chunkSize: 35
            };
            
            const result = await concatMp3Files(mp3Files, outputFile, internals);
            
            expect(result).toBe(false);
            expect(mockConcatMp3FilesInt).toHaveBeenCalledTimes(1);
        });

        test('should not clean up temp files when final concat fails', async () => {
            const mockConcatMp3FilesInt = jest.fn()
                .mockResolvedValueOnce(true)  // Chunk succeeds
                .mockResolvedValueOnce(false); // Final concat fails
            const mockUnlinkIfExists = jest.fn();
            
            const mp3Files = Array.from({ length: 40 }, (_, i) => `file${i + 1}.mp3`);
            const outputFile = 'output.mp3';
            
            const internals = {
                concatMp3FilesInt: mockConcatMp3FilesInt,
                unlinkIfExists: mockUnlinkIfExists,
                chunkSize: 35
            };
            
            const result = await concatMp3Files(mp3Files, outputFile, internals);
            
            expect(result).toBe(false);
            // Temp files should NOT be cleaned up when final concat fails
            expect(mockUnlinkIfExists).not.toHaveBeenCalled();
        });

        test('should handle edge case with exactly chunkSize + 2 files', async () => {
            const mockConcatMp3FilesInt = jest.fn().mockResolvedValue(true);
            const mockUnlinkIfExists = jest.fn();
            
            // Exactly 37 files (35 + 2)
            const mp3Files = Array.from({ length: 37 }, (_, i) => `file${i + 1}.mp3`);
            const outputFile = 'output.mp3';
            
            const internals = {
                concatMp3FilesInt: mockConcatMp3FilesInt,
                unlinkIfExists: mockUnlinkIfExists,
                chunkSize: 35
            };
            
            const result = await concatMp3Files(mp3Files, outputFile, internals);
            
            expect(result).toBe(true);
            // Should only be called once (no chunking needed)
            expect(mockConcatMp3FilesInt).toHaveBeenCalledTimes(1);
            expect(mockConcatMp3FilesInt).toHaveBeenCalledWith(mp3Files, outputFile);
        });
    });
});