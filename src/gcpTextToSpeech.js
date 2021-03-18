const
    // https://www.npmjs.com/package/@google-cloud/text-to-speech
    textToSpeech = require('@google-cloud/text-to-speech'),
    util = require('util'),
    fs = require('fs');

exports.listVoices = async function listVoices() {
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
};

// SSML: https://cloud.google.com/text-to-speech/docs/ssml

exports.synthesizeSsml = async function synthesizeSsml(ssml, outputFile) {
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
};