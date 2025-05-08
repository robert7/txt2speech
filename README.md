# txt2speech
Set of utilities to play with Google's [text-to-speech](https://cloud.google.com/text-to-speech) API and generate 
a spoken audio from TXT files.
It can be used e.g. to generate a computer spoken "audiobook" from a text, where no audio version exists.

Based on samples in [googleapis/nodejs-text-to-speech](https://github.com/googleapis/google-cloud-node/tree/main/packages/google-cloud-texttospeech).

As it is a kind of "MVP" for my personal use case, parts are a bit hardcoded.

It works only with Google Cloud account with activated billing, but there is a "[free tier - pricing](https://cloud.google.com/text-to-speech/pricing?hl=en)".
Currently, ~1M of input text per month should be free (but do recheck actual state, as this may change). 
So there will be no charge until some amount of processed data.
For my use cases, there is quite a lot free.

As of 2025-05 free tier includes Chirp 3 HD voices (1M chars free tier).

See `--help` option for description of parameters.

## Preconditions:
* Authenticate against Google cloud:
  * [Create a service account](https://cloud.google.com/iam/docs/understanding-service-accounts)
  * [Pass credentials](https://cloud.google.com/docs/authentication/production) in the GOOGLE_APPLICATION_CREDENTIALS environment variable.
* In order mp3 merging to work, [ffmpeg must be on the path](https://www.npmjs.com/package/fluent-ffmpeg).


## API
"texttospeech.googleapis.com" needs to be activated in your Google Cloud project
https://cloud.google.com/text-to-speech/docs/reference/rest/?apix=true

Authentication (alternative to using service account - NOT recommended, but possible e.g. for quick testing):

```fish

set USER x@x.com
set PROJECT_ID project-id

gcloud auth revoke $USER && gcloud auth login $USER
gcloud config set project $PROJECT_ID
gcloud auth application-default set-quota-project $PROJECT_ID
gcloud config set billing/quota_project $PROJECT_ID
gcloud auth application-default login
```

Check voice demos at (new Chirp 3: HD voices): https://cloud.google.com/text-to-speech/docs/chirp3-hd


## Versions
Tag v2021-ssml for the older version of the code, which uses SSML to generate the audio