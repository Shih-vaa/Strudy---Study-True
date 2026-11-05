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

## Face landmarker (eyes and head direction)

`face_landmarker.task` is Google's MediaPipe Face Landmarker bundle. It contains a face detector (the
same BlazeFace short-range model as above), a face-landmark model and a blendshape model. It is only
loaded when the owner switches on "Also check eyes and head direction" in Settings. From it Strudy
reads two things per look: how closed the eyes are (the two eye-blink scores) and which way the head
points (from the face's transformation matrix). It does not track where on the screen she looks.

- Source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Size: 3,758,596 bytes
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- License: Apache License 2.0 (as stated on the MediaPipe model card)
