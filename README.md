# txt2speech
Set of utilities to play with Google's [text-to-speech](https://cloud.google.com/text-to-speech) API and generate 
spoken audio from TXT files.
Based on samples in [googleapis/nodejs-text-to-speech](https://github.com/googleapis/nodejs-text-to-speech)
As it is a kind of "MVP" for my personal use case, parts of a quite hardcoded.

See `--help` option for description of parameters.

To authenticate against Google cloud:
* [Create a service account](https://cloud.google.com/iam/docs/understanding-service-accounts)
* [Pass credentials](https://cloud.google.com/docs/authentication/production) in the GOOGLE_APPLICATION_CREDENTIALS environment variable. 
 
