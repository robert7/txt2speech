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
                    const processLine = (lineNr > paramStartLine || (!paramStartLine))
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
        prepend: `Usage: ${PROG_NAME} [options...]\n`
            + '\n'
            + 'Examples:\n'
            + '  ts --listVoices\n'
            + '  ts --import abc.txt --startLine=10 --endLine=100\n'
            + '\n'
            + 'As invoking --synth may involve costs (if you are over the free tier), it may be reasonable for tests\n'
            + 'to limit the processing scope.'
            + '\n'
            + 'Version 1.0',
        typeAliases: {filename: 'String', directory: 'String'},
        options: [{
            option: 'help',
            alias: 'h',
            type: 'Boolean',
            description: 'Display help.'
        }, {
            option: 'import',
            alias: 'i',
            type: 'filename',
            description: 'Text file to import.'
        }, {
            option: 'startLine',
            type: 'Int',
            description: 'Line number where conversion should start (first document line has number 1).'
        }, {
            option: 'endLine',
            type: 'Int',
            description: 'Line number where conversion should end (line with given number is included)'
        }, {
            option: 'listVoices',
            alias: 'l',
            type: 'Boolean',
            description: 'List available voices'
        }, {
            option: 'synth',
            type: 'Boolean',
            description: 'Voice synthesis. This will generate mp3 files.'
        }
        ]
    });

    const options = configuredOptionator.parseArgv(argv);
    let displayHelpAndQuit = options.help
        || (!options.import && !options.listVoices);
    options.displayHelpAndQuit = displayHelpAndQuit;

    if (displayHelpAndQuit) {
        console.log(configuredOptionator.generateHelp());
    }
    return options;
};

const zeroPad = (num, places) => String(num).padStart(places, '0');

async function main(argv) {
    const options = parseCommandLine(argv);
    const {
        displayHelpAndQuit,
        listVoices: paramListVoices,
        import: paramImportFileName,
        synth: paramSynth
    } = options;

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
        const writeFile = util.promisify(fs.writeFile);
        for (const block of blocks) {
            const {
                id, ssml
            } = block;
            const idPadded = zeroPad(id, 5);

            console.log(`Processing id:${idPadded}, ssml:${ssml}`);
            const ssmlFn = `${filenameBase}-${idPadded}${SSML_EXTENSION}`;
            await writeFile(ssmlFn, ssml);
            const mp3Fn = `${filenameBase}-${idPadded}${MP3_EXTENSION}`;
            mp3Files.push(mp3Fn);

            if (paramSynth) {
                // we could to the synthesis in parallel, but for now make it simple
                // and do it in sync
                await synthesizeSsml(ssml, mp3Fn);
            }
        }

        if (paramSynth) {
            concatMp3Files(mp3Files, `${filenameBase}${MP3_EXTENSION}`);
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




