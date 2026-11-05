# Face detector model

`blaze_face_short_range.tflite` is Google's BlazeFace (short range) face detector, the model the
MediaPipe Face Detector task uses for faces up to about two metres from the camera. It is bundled
into the app so that nothing is ever downloaded at run time.

- Source: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
- Size: 229,746 bytes
- SHA-256: `b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f`
- License: Apache License 2.0 (as stated on the MediaPipe model card)

It is loaded by `../faceDetector.ts` together with the WebAssembly engine from the
`@mediapipe/tasks-vision` package (also Apache-2.0). To replace it, change the file here and update
the hash above.
