// TODO escape xml chars in input lines
// TODO handle lines >5000 chars

const {listVoices, synthesize, DEFAULT_SPEAKING_RATE} = require('./gcpTextToSpeech'),
    {concatMp3Files} = require('./mp3Util');

const
    fs = require('fs'),
    es = require('event-stream'),
    util = require('util'),
    // https://www.npmjs.com/package/optionator
    optionator = require('optionator');

const PROG_NAME = 'ts';
const TXT_EXTENSION = '.txt';
const MP3_EXTENSION = '.mp3';
const CONTENT_EXTENSION = '.txt-temp';
const TEMP_AUDIO_FILE_PREFIX = 'tstmp';
const VERSION = '1.0';

// API currently now limits the requests text size to ~5000 bytes; but we take lower value
const TARGET_BLOCK_LEN = 2500;
const MAX_BLOCK_LEN = 5000;

// break lines longer than this into smaller blocks
const BREAK_LINE_LEN = 300;


/**
 * Break long lines into smaller blocks.
 * This will still fail to fix the problem if any sentence in the line is longer than BREAK_LINE_LEN.
 *
 * @param textContent Text content to be processed.
 * @return {string} Processed text content.
 */
function fixLongLines(textContent) {
    // split line at ". "
    // assemble new blocks into a temporary array, so that each block is smaller than BREAK_LINE_LEN
    // join the blocks with ".\n"

    const tmp = [];
    const lines = textContent.split('. ');
    let currentBlock = '';
    lines.forEach(line => {
        const lineLength = line.length;
        if (currentBlock.length + lineLength < BREAK_LINE_LEN) {
            currentBlock += (currentBlock.length > 0 ? '. ' : '') + line;
        } else {
            tmp.push(currentBlock);
            currentBlock = line;
        }
    });
    if (currentBlock.length > 0) {
        tmp.push(currentBlock);
    }
    // now we have a list of blocks, each smaller than BREAK_LINE_LEN
    // now we need to add them to the result blocks
    textContent = tmp.join('.\n');
    return textContent;
}

/**
 * Add one content block to a result list.
 *
 * @param blocks List of result blocks.
 * @param blockId New block ID (taken from line number)
 * @param textContent Incoming text content (currently without the "speak" wrapper).
 */
function addContentToResult(blocks, blockId, textContent) {

    // temporarily disabling, although it should work as a fix
    // the problem was, that line contained "." as request by Google TTS,
    // but some "." were followed by further characters
    // e.g. "xx xx xx.12 sss sss sss.13 xx xx xx"
    // then the "." was not recognised as end of sentence

    // if (textContent.length > BREAK_LINE_LEN) {
    //     const textContentOrig = textContent;
    //     textContent = fixLongLines(textContent);
    //     console.warn(`WARN: Line ${blockId} is too long`);
    //     console.log(`Original: ${textContentOrig}`);
    //     console.log(`Fixed: ${textContent}`);
    // }

    if (textContent.length > MAX_BLOCK_LEN) {
        throw 'block longer then API maximum - ABORT';
    }

    if (blocks.length > 0) {
        const lastResultBlock = blocks[blocks.length - 1];
        const lastContent = lastResultBlock.blockContent;
        // if the size is smaller than MAX, append the text
        // this decreases the count of resulting blocks a bit (and thus fewer requests and fewer "mp3" files)
        if ((lastContent.length + textContent.length) < TARGET_BLOCK_LEN) {
            lastResultBlock.blockContent = lastResultBlock.blockContent + '\n' + textContent;
            return;
        }
    }

    // else append new block
    blocks.push({
            id: blockId,
            blockContent: textContent
        }
    );
}

/**
 * Read and process TXT file.
 *
 * @param fileName
 * @param options
 * @return {Promise}
 */
async function importTxtFile(fileName, options) {

    const {
        startLine: paramStartLine,
        endLine: paramEndLine
    } = options;

    return new Promise((resolve, reject) => {

        let lineNr = 0;
        blocks = [];
        let maxLineLength = 0;
        let emptyLinesBefore = 0;

        let stream = fs.createReadStream(fileName)
            // split on new line - regex variant: .pipe(es.split(/(\r?\n)/))
            // https://github.com/dominictarr/event-stream#split-matcher
            .pipe(es.split())
            .pipe(
                es.mapSync(function (line) {

                    // pause the readstream
                    stream.pause();
                    line = line.trim();

                    const isEmptyLine = line === '';

                    lineNr += 1;
                    const processLine = (lineNr >= paramStartLine || (!paramStartLine))
                        && (lineNr <= paramEndLine || (!paramEndLine));

                    if (processLine) {
                        // process line here and call s.resume() when ready
                        const lineLength = line.length;
                        if (lineLength > maxLineLength) {
                            maxLineLength = lineLength;
                        }
                        addContentToResult(blocks, lineNr, line);

                        console.log(`line ${lineNr}: ${line}`);
                    }
                    if (isEmptyLine) {
                        emptyLinesBefore++;
                    } else {
                        emptyLinesBefore = 0;
                    }

                    // resume the readstream, possibly from a callback
                    stream.resume();
                }).on('error', function (err) {
                    console.log(`Error while reading file ${fileName} (at line ${lineNr})`, err);
                    reject();
                }).on('end', function () {
                    console.log(`Read entire file ${fileName} (${lineNr} lines; max.line length ${maxLineLength})`);
                    resolve(blocks);
                })
            );
    });
}

/**
 * Parse commandline options
 * @param argv CLI arguments.
 * @return {{help}|*} Parsed options
 */
const parseCommandLine = function (argv) {
    const configuredOptionator = optionator({
        prepend: `Usage: ${PROG_NAME} text-file [options...]\n`
            + '\n'
            + 'Examples:\n'
            + '  ts --listVoices\n'
            + '  ts abc.txt --startLine 10 --endLine 100 --no-audio\n'
            + '  ts abd.txt --startLine 10 --endLine 12 --voice "en-US-Standard-A, MALE, en-US"\n'
            + '\n'
            + 'As invoking with --audio may involve costs (if you are over the free tier), it may be reasonable for tests\n'
            + 'to limit the processing scope.'
            + '\n'
            + `Version ${VERSION}`,
        typeAliases: {filename: 'String', voice: 'String', rate: 'Number', line: 'Int'},
        options: [{
            option: 'help',
            alias: 'h',
            type: 'Boolean',
            description: 'Display help.'
        }, {
            option: 'listVoices',
            alias: 'l',
            type: 'Boolean',
            description: 'List available voices.\n'
        }, {
            option: 'startLine',
            type: 'line',
            description: 'Line number where conversion should start (first document line has number 1).'
        }, {
            option: 'endLine',
            type: 'line',
            description: 'Line number where conversion should end (line with given number is included).'
        }, {
            option: 'remove',
            type: 'Boolean',
            description: `Skip removing intermediate files at the end (*${CONTENT_EXTENSION} and *.mp3). If "remove" is active, `
                + 'files are only removed if --audio went well.',
            default: 'true'
        }, {
            option: 'voice',
            type: 'voice',
            description: 'Voice to use (as returned by --listVoices). E.g.: "en-US-Wavenet-D, MALE, en-US"\n' +
                'You can play with voices at Google demo: https://cloud.google.com/text-to-speech#section-2'
        }, {
            option: 'speakingRate',
            type: 'rate',
            description: `Speaking rate. Default: "${DEFAULT_SPEAKING_RATE}".`
        }, {
            option: 'audio',
            type: 'Boolean',
            description: 'Skip voice synthesis (just generate intermediary files). If not used, MP3 version is generated. (Can cause costs).',
            default: 'true'
        }
        ]
    });

    const options = configuredOptionator.parseArgv(argv);
    const argsAfterOptions = options._;

    const hasImportFile = Array.isArray(argsAfterOptions) && (argsAfterOptions.length === 1);
    const hasListVoices = options.listVoices;
    let displayHelpAndQuit = options.help || (!(hasImportFile || hasListVoices));

    const importFile = !displayHelpAndQuit ? argsAfterOptions[0] : undefined;
    if (hasImportFile) {
        displayHelpAndQuit = displayHelpAndQuit || (!importFile.endsWith(TXT_EXTENSION));
    }

    options.import = importFile;
    options.displayHelpAndQuit = displayHelpAndQuit;

    if (displayHelpAndQuit) {
        console.log(configuredOptionator.generateHelp());
    }
    return options;
};

// voice parameter should be a string consisting of 3 parts delimited by ','
const EXPECTED_VOICE_PARTS = 3;

function parseVoice(paramVoice) {
    const paramVoiceParsed = (typeof paramVoice === 'string') ? paramVoice.split(',') : undefined;
    if (Array.isArray(paramVoiceParsed) && (paramVoiceParsed.length === EXPECTED_VOICE_PARTS)) {
        return {
            name: paramVoiceParsed[0].trim(),
            ssmlGender: paramVoiceParsed[1].trim(),
            languageCode: paramVoiceParsed[2].trim()
        };
    }
}

function unlinkIfExists(filename) {
    if (!fs.existsSync(filename)) {
        return;
    }

    fs.unlinkSync(filename);
}

async function main(argv) {
    const options = parseCommandLine(argv);
    const {
        displayHelpAndQuit,
        listVoices: paramListVoices,
        import: paramImportFileName,
        voice: paramVoice,
        speakingRate: paramSpeakingRate,
        remove: paramRemove,
        audio: paramAudio
    } = options;
    const paramVoiceParsed = parseVoice(paramVoice);

    if (displayHelpAndQuit) {
        process.exit(1);
    }
    if (paramImportFileName) {
        if (!paramImportFileName.endsWith(TXT_EXTENSION)) {
            console.log(`Error: it is expected that the filename to be imported (${paramImportFileName}) ".txt" extension has...`);
            return;
        }

        const filenameBase = paramImportFileName.substr(0, paramImportFileName.length - TXT_EXTENSION.length);

        try {
            const blocks = await importTxtFile(paramImportFileName, options);
        } catch (e) {
            console.log(`ABORT - Failed to read/convert input file!`);
            return;
        }

        // console.log(`Converted blocks ${JSON.stringify(blocks)}`);
        const blockCount = blocks.length;
        console.log(`Converted to ${blockCount} blocks`);

        const mp3Files = [];
        const contentFiles = [];
        const writeFile = util.promisify(fs.writeFile);
        let mp3RenderingOK = true;

        // https://github.com/visionmedia/node-progress#readme
        let blockNr = 0;
        for (const block of blocks) {
            const {
                id, blockContent: blockContent
            } = block;
            blockNr++;
            console.log(`Processing block ${blockNr}/${blockCount}, id:${id}, (${blockContent.length} chars)`);

            // temporary files are generated in the current directory
            // we could use "filenameBase" but it may be long and contain speces/special chars
            // so lets stay with simple filenames for now
            // of course the program may then NOT run in parallel in same directory
            const contentFn = `${TEMP_AUDIO_FILE_PREFIX}-${id}${CONTENT_EXTENSION}`;
            unlinkIfExists(contentFn);

            await writeFile(contentFn, blockContent);
            contentFiles.push(contentFn);
            const mp3Fn = `${TEMP_AUDIO_FILE_PREFIX}-${id}${MP3_EXTENSION}`;
            unlinkIfExists(mp3Fn);

            mp3Files.push(mp3Fn);

            if (paramAudio) {
                // we could to the synthesis in parallel, but for now make it simple
                // and do it in sync
                mp3RenderingOK = await synthesize(blockContent, mp3Fn, paramVoiceParsed, paramSpeakingRate);
                if (!mp3RenderingOK) {
                    console.log('ABORT - audio rendering failed!');
                    return;
                }
            }
        }

        if (paramAudio && mp3RenderingOK) {
            const resultMp3 = `${filenameBase}${MP3_EXTENSION}`;
            unlinkIfExists(resultMp3);

            const concatOK = await concatMp3Files(mp3Files, resultMp3);
            if (!concatOK) {
                console.log('concat failed');
            }
            if (concatOK && paramRemove) {
                console.log(`About to remove intermediate files..`);
                mp3Files.concat(contentFiles).forEach(file => unlinkIfExists(file));
            }
        }

        console.log(`All done!`);
    }

    if (paramListVoices) {
        listVoices().then(() => {
            console.log(`Done with listing voices..`);
        });
    }

}

// Export functions for testing
module.exports = {
    fixLongLines,
    addContentToResult,
    parseVoice,
    parseCommandLine,
    importTxtFile
};

// Only run main if this file is executed directly
if (require.main === module) {
    main(process.argv);
}




