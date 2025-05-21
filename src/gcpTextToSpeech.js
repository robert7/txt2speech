const
    // https://www.npmjs.com/package/@google-cloud/text-to-speech
    textToSpeech = require('@google-cloud/text-to-speech'),
    util = require('util'),
    fs = require('fs');

const DEFAULT_VOICE = {
    name: 'en-US-Chirp3-HD-Aoede',
    ssmlGender: 'FEMALE',
    languageCode: 'en-US'
};
exports.DEFAULT_SPEAKING_RATE = 0.9;

exports.listVoices = async function listVoices() {
    const client = new textToSpeech.TextToSpeechClient();

    const [result] = await client.listVoices({});
    const voices = result.voices;

    voices.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));

    voices.forEach(voice => {
        const languagesStr = voice.languageCodes.join(' ');
        console.log(`${voice.name}, ${voice.ssmlGender}, ${languagesStr}`);
    });
};

/**
 * Synthetize given text into mp3 output using given voice.
 * @param text Text to be converted to speech. Should be plain text.
 * @param outputFile
 * @param voice
 * @param speakingRate
 * @return {Promise<void>}
 */
exports.synthesize = async function synthesizeSsml(text, outputFile, voice, speakingRate) {
    try {
        const client = new textToSpeech.TextToSpeechClient();

        if (!voice) {
            voice = DEFAULT_VOICE;
        }
        if (!speakingRate) {
            speakingRate = exports.DEFAULT_SPEAKING_RATE;
        }

        const request = {
            input: {text},
            // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize#VoiceSelectionParams
            voice,
            // https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize#AudioConfig
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate
            }
        };

        const [response] = await client.synthesizeSpeech(request);
        const writeFile = util.promisify(fs.writeFile);
        await writeFile(outputFile, response.audioContent, 'binary');
        // console.log(`Audio content written to file: ${outputFile}`);
        return true;
    } catch (e) {
        console.log(`Audio rendering failed: ${e}`);
        return false;
    }

};