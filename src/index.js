const
    fs = require('fs'),
    es = require('event-stream'),
    //Promise = require('bluebird'),
    //moment = require('moment'),
    // https://www.npmjs.com/package/@google-cloud/text-to-speech
    textToSpeech = require('@google-cloud/text-to-speech'),
    util = require('util'),
    // https://www.npmjs.com/package/optionator
    optionator = require('optionator');

const PROG_NAME = 'ts';

const SECTION_BREAK = 4;
const CAPTION_BREAK = 2;

// !! TODO escape xml chars

function convertToSsml(line, emptyLines) {
    let breakTime = null;
    if (emptyLines > 0) {
        breakTime = CAPTION_BREAK;
    }
    if (emptyLines > 1) {
        breakTime = SECTION_BREAK;
    }

    const breakAfterMarkup = breakTime ? `<break time="${breakTime}s"/>` : '';

    return `<speak><p>${line}</p>${breakAfterMarkup}</speak>`;
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
        result = [];
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
                        const ssml = convertToSsml(line, emptyLinesBefore);
                        result.push({
                                id: lineNr,
                                ssml
                            }
                        );

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
                    resolve(result);
                })
            );
    });
};

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

async function listVoices() {
    const client = new textToSpeech.TextToSpeechClient();

    const [result] = await client.listVoices({});
    const voices = result.voices;

    console.log('Voices:');
    voices.forEach(voice => {
        console.log(`Name: ${voice.name}`);
        console.log(`  SSML Voice Gender: ${voice.ssmlGender}`);
        console.log(`  Natural Sample Rate Hertz: ${voice.naturalSampleRateHertz}`);
        console.log('  Supported languages:');
        voice.languageCodes.forEach(languageCode => {
            console.log(`    ${languageCode}`);
        });
    });
}

// SSML: https://cloud.google.com/text-to-speech/docs/ssml

async function synthesizeSsml(ssml, outputFile) {
    const client = new textToSpeech.TextToSpeechClient();

    const request = {
        input: {ssml},
        // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize#VoiceSelectionParams
        voice: {
            languageCode: 'en-US',
            ssmlGender: 'FEMALE',
            name: 'en-US-Wavenet-C'
        },
        // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize#AudioConfig
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.8
        }
    };

    const [response] = await client.synthesizeSpeech(request);
    const writeFile = util.promisify(fs.writeFile);
    await writeFile(outputFile, response.audioContent, 'binary');
    console.log(`Audio content written to file: ${outputFile}`);
}

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
        const snippets = await importTxtFile(paramImportFileName, options);
        console.log(`Converted snippets ${JSON.stringify(snippets)}`);

        const mp3Files=[];
        const writeFile = util.promisify(fs.writeFile);
        for (const snippet of snippets) {
            const {
                id, ssml
            } = snippet;
            const idPadded = zeroPad(id, 5);

            console.log(`Processing id:${idPadded}, ssml:${ssml}`);
            const ssmlFn = `tmp/output-${idPadded}.ssml`;
            await writeFile(ssmlFn, ssml);
            const mp3Fn = `tmp/output-${idPadded}.mp3`;
            mp3Files.push(mp3Fn);

            if (paramSynth) {
                // we could to the synthesis in parallel, but for now make it simple
                // and do it in sync
                await synthesizeSsml(ssml, mp3Fn);
            }
        }
        // alternative mp3 concat: https://www.npmjs.com/package/audioconcat
        const ffmpegLine=`ffmpeg -i "concat:${mp3Files.join('|')}" -acodec copy tmp/out.mp3`;
        console.log(ffmpegLine);

        console.log(`All done!`);
    }

    if (paramListVoices) {
        listVoices().then(() => {
            console.log(`Done with listing voices..`);
        });
    }

}

main(process.argv);




