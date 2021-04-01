// TODO escape xml chars in SSML lines
// TODO handle lines >5000 chars

const {listVoices, synthesizeSsml} = require('./gcpTextToSpeech'),
    {concatMp3Files} = require('./mp3Util');

const
    fs = require('fs'),
    es = require('event-stream'),
    util = require('util'),
    // https://www.npmjs.com/package/optionator
    optionator = require('optionator');

const PROG_NAME = 'ts';

const SECTION_BREAK = 4;
const CAPTION_BREAK = 2;

const TXT_EXTENSION = '.txt';
const MP3_EXTENSION = '.mp3';
const SSML_EXTENSION = '.ssml';

// API currently now limits the requests "ssml text" size to 5000 bytes; but we take lower value
const MAX_SSML_BLOCK_LEN = 1000;

/**
 * Convert incoming text line to SSML content (without adding "speak" wrapper").
 * There is a little heuristic based on empty lines, which could improve the narration a bit.
 *
 * @param line Incoming trext line.
 * @param emptyLines Empty line count *before* this line.
 *
 * @returns {string}
 */
function convertToSsmlContent(line, emptyLines) {
    let breakTime = null;
    // make a little pause based on count of empty lines before; so basically we guess the "headers"
    if (emptyLines > 0) {
        breakTime = CAPTION_BREAK;
    }
    if (emptyLines > 1) {
        breakTime = SECTION_BREAK;
    }

    const breakAfterMarkup = breakTime ? `<break time="${breakTime}s"/>` : '';

    const sentences = line.split('. ');
    if (Array.isArray(sentences) && (sentences.length > 1)) {
        const sentencesSsml = sentences.map(sentence => `<s>${sentence}</s>`);
        line = sentencesSsml.join('');
    }

    return `<p>${line}</p>${breakAfterMarkup}`;
}

/**
 * Just add the "speak" wrapper.
 * @param ssmlContent
 * @returns {string}
 */
function convertToSsmlAddSpeak(ssmlContent) {
    return `<speak>${ssmlContent}</speak>`;
}

/**
 * Add one SSML content block to result list.
 *
 * @param blocks List of result blocks.
 * @param blockId New block ID (taken from line number)
 * @param ssml Incoming SSML content (currently without the "speak" wrapper).
 */
function addSsmlContentToResult(blocks, blockId, ssml) {
    if (blocks.length > 0) {
        const lastResultBlock = blocks[blocks.length - 1];
        const lastSsmlContent = lastResultBlock.ssml;
        // if the size is smaller then MAX,just append the text
        // this decreases the count of resulting blocks a bit (and thus less requests and less "mp3" files)
        if ((lastSsmlContent.length + ssml.length) < MAX_SSML_BLOCK_LEN) {
            lastResultBlock.ssml = lastResultBlock.ssml + ssml;
            return;
        }
    }

    // else append new block
    blocks.push({
            id: blockId,
            ssml
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
                es.mapSync(function(line) {

                    // pause the readstream
                    stream.pause();
                    line = line.trim();

                    const isEmptyLine = line === '';

                    lineNr += 1;
                    const processLine = (lineNr >= paramStartLine || (!paramStartLine))
                        && (lineNr <= paramEndLine || (!paramEndLine))
                        && !isEmptyLine;

                    if (processLine) {
                        // process line here and call s.resume() when ready
                        const lineLength = line.length;
                        if (lineLength > maxLineLength) {
                            maxLineLength = lineLength;
                        }
                        const ssml = convertToSsmlContent(line, emptyLinesBefore);
                        addSsmlContentToResult(blocks, lineNr, ssml);

                        console.log(`line ${lineNr}: ${ssml}`);
                    }
                    if (isEmptyLine) {
                        emptyLinesBefore++;
                    } else {
                        emptyLinesBefore = 0;
                    }

                    // resume the readstream, possibly from a callback
                    stream.resume();
                }).on('error', function(err) {
                    console.log(`Error while reading file ${fileName} (at line ${lineNr})`, err);
                    reject();
                }).on('end', function() {
                    console.log(`Read entire file ${fileName} (${lineNr} lines; max.line length ${maxLineLength})`);
                    // add "speak" wrapper
                    blocks.forEach(block => {
                        block.ssml = convertToSsmlAddSpeak(block.ssml);
                    });

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
const parseCommandLine = function(argv) {
    const configuredOptionator = optionator({
        prepend: `Usage: ${PROG_NAME} text-file [options...]\n`
            + '\n'
            + 'Examples:\n'
            + '  ts --listVoices\n'
            + '  ts abc.txt --startLine 10 --endLine 100\n'
            + '  ts abd.txt --startLine 10  --endLine 12 --voice "en-US-Standard-A, MALE, en-US" --audio\n'
            + '\n'
            + 'As invoking --audio may involve costs (if you are over the free tier), it may be reasonable for tests\n'
            + 'to limit the processing scope. As of 2021-03 about 1M of input text is free, which is quite a lot.'
            + '\n'
            + 'Version 1.0',
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
            description: 'Skip removing intermediate files at the end (*.ssml and *.mp3). If "remove" is active, '
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
            description: 'Speaking rate. Default: "0.8".'
        }, {
            option: 'audio',
            alias: 'a',
            type: 'Boolean',
            description: 'Voice synthesis (generate audio version). This will narrate the TXT file into mp3.'
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

// const zeroPad = (num, places) => String(num).padStart(places, '0');

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

        const blocks = await importTxtFile(paramImportFileName, options);
        console.log(`Converted SSML blocks ${JSON.stringify(blocks)}`);

        const mp3Files = [];
        const ssmlFiles = [];
        const writeFile = util.promisify(fs.writeFile);
        for (const block of blocks) {
            const {
                id, ssml
            } = block;
            //const idPadded = zeroPad(id, 5);

            console.log(`Processing id:${id}, ssml:${ssml}`);
            // temporary files are generated in current directory
            // we could use "filenameBase" but it may be long and contain speces/special chars
            // so lets stay with simple filenames for now
            // of course the program may then NOT run in parallel in same directory
            const filenameBaseTmp = 'tstmp';
            const ssmlFn = `${filenameBaseTmp}-${id}${SSML_EXTENSION}`;
            unlinkIfExists(ssmlFn);

            await writeFile(ssmlFn, ssml);
            ssmlFiles.push(ssmlFn);
            const mp3Fn = `${filenameBaseTmp}-${id}${MP3_EXTENSION}`;
            unlinkIfExists(mp3Fn);

            mp3Files.push(mp3Fn);

            if (paramAudio) {
                // we could to the synthesis in parallel, but for now make it simple
                // and do it in sync
                await synthesizeSsml(ssml, mp3Fn, paramVoiceParsed, paramSpeakingRate);
            }
        }

        if (paramAudio) {
            const resultMp3 = `${filenameBase}${MP3_EXTENSION}`;
            unlinkIfExists(resultMp3);

            const concatOK = await concatMp3Files(mp3Files, resultMp3);
            if (!concatOK) {
                console.log('concat failed');
            }
            if (concatOK && paramRemove) {
                console.log(`About to remove intermediate files..`);
                mp3Files.concat(ssmlFiles).forEach(file => unlinkIfExists(file));
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

main(process.argv);




