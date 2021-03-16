# txt2speech
Set of utilities to play with Google's [text-to-speech](https://cloud.google.com/text-to-speech) API and generate 
spoken audio from TXT files.
It can be used e.g. to generate computer spoken audiobook from a text, where no audio version exists.

Based on samples in [googleapis/nodejs-text-to-speech](https://github.com/googleapis/nodejs-text-to-speech).

As it is a kind of "MVP" for my personal use case, parts of a quite hardcoded.

It works only with Google Cloud account with activated billing,but there is a "free tier". Currently, 
1M of input text per month should be free. So there will be no charge until some amount 
of processed data. for my use case there is quite a lot free. 

See `--help` option for description of parameters.

To authenticate against Google cloud:
* [Create a service account](https://cloud.google.com/iam/docs/understanding-service-accounts)
* [Pass credentials](https://cloud.google.com/docs/authentication/production) in the GOOGLE_APPLICATION_CREDENTIALS environment variable. 
 
