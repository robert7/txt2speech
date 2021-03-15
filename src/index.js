const
    fs = require('fs'),
    es = require('event-stream'),
    Promise = require('bluebird'),
    moment = require('moment');

const PROG_NAME = 'ts';

// https://www.npmjs.com/package/optionator
const optionator = require('optionator');

/**
 * Read and process TXT file.
 *
 * @param fileName
 * @return {Promise}
 */
const importTxtFile = (fileName) => {
    return new Promise((resolve, reject) => {

        let lineNr = 0;
        result = [];
        let maxLineLength = 0;

        let stream = fs.createReadStream(fileName)
            // split on new line - regex variant: .pipe(es.split(/(\r?\n)/))
            // https://github.com/dominictarr/event-stream#split-matcher
            .pipe(es.split())
            .pipe(
                es.mapSync(function(line) {

                    // pause the readstream
                    stream.pause();

                    lineNr += 1;
                    // process line here and call s.resume() when ready
                    const lineLength = line.length;
                    if (lineLength > maxLineLength) {
                        maxLineLength = lineLength;
                    }

                    console.log(`line ${lineNr}: ${line}`);

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
            + 'Processing:\n'
            + '  '
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
        }
        ]
    });

    const options = configuredOptionator.parseArgv(argv);
    // non option arguments
    const argsAfterOptions = options._;
    let displayHelpAndQuit = options.help || !options.import;
    options.displayHelpAndQuit = displayHelpAndQuit;

    if (displayHelpAndQuit) {
        console.log(configuredOptionator.generateHelp());
    }
    return options;
};

const main = (argv) => {
    const options = parseCommandLine(argv);
    const {
        displayHelpAndQuit,
        import: importFileName
    } = options;

    if (displayHelpAndQuit) {
        process.exit(1);
    }
    if (importFileName) {
        importTxtFile(importFileName).then(() => {
            console.log(`done with ${importFileName}`);
        });
    }
};

main(process.argv);




