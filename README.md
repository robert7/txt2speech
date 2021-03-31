# txt2speech
Set of utilities to play with Google's [text-to-speech](https://cloud.google.com/text-to-speech) API and generate 
a spoken audio from TXT files.
It can be used e.g. to generate a computer spoken "audiobook" from a text, where no audio version exists.

Based on samples in [googleapis/nodejs-text-to-speech](https://github.com/googleapis/nodejs-text-to-speech).

As it is a kind of "MVP" for my personal use case, parts are a bit hardcoded.

It works only with Google Cloud account with activated billing, but there is a "[free tier](https://cloud.google.com/free/docs/gcp-free-tier)". 
Currently, ~1M of input text per month should be free (but do recheck actual state, as this may change). 
So there will be no charge until some amount of processed data.
For my use cases, there is quite a lot free. 

See `--help` option for description of parameters.

## Preconditions:
* Authenticate against Google cloud:
  * [Create a service account](https://cloud.google.com/iam/docs/understanding-service-accounts)
  * [Pass credentials](https://cloud.google.com/docs/authentication/production) in the GOOGLE_APPLICATION_CREDENTIALS environment variable.
* In order mp3 merging to work, [ffmpeg must be on the path](https://www.npmjs.com/package/fluent-ffmpeg).   
 
