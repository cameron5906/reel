# Reel

A screen recorder you actually own. Record your screen with a webcam bubble, your mic, and system audio, then trim and export — all on your own machine. No account, no subscription, no cloud, no watermark, no "you've hit your 25-video limit."

It started as a weekend answer to a simple question: why am I paying a monthly fee to record my own screen? So this does the things people reach for Loom for, and it keeps every frame on your computer.

## What it does

- **Record a full monitor or a free-form region** — drag out exactly the area you want (handy on ultrawides).
- **Webcam bubble** — a draggable, circular camera overlay composited right into the video.
- **Microphone + system audio**, mixed together.
- **Background removal** — drop your real background for a solid color, a blur, or an image. There's a cutout slider to dial in the edges, plus a saved-colors palette.
- **Framing controls** — zoom and pan your camera before you hit record, and flip it horizontally so you're facing your content.
- **Live scene switching** while recording — screen + bubble, screen only, or camera fullscreen, with a smooth animated transition between them.
- **Cursor follow** — hold a key and the bubble trails your cursor and turns to face it, so your eyeline points at whatever you're pointing at.
- **Draw on the screen** mid-recording for callouts and arrows.
- **Trim, choose a resolution, and export** to MP4 or WebM. Exports are quick — when the source is already H.264 the MP4 is a straight copy, and re-encodes use your GPU (NVENC) when one's available.

## Your recordings stay yours

Reel captures and saves entirely on your computer. No telemetry, no sign-in, nothing uploaded anywhere. Recordings land in a folder you pick (defaults to `Videos\Reel`), and they're plain `.mp4`/`.webm` files you can do anything with.

## Requirements

- Windows 10/11
- [Node.js](https://nodejs.org) 18 or newer (to run or build from source)

## Run it

```bash
git clone https://github.com/cameron5906/reel
cd reel
npm install      # also pulls the background-removal model into place
npm run dev
```

That launches the app. Pick a capture area, a camera and mic, then hit **Record**.

## Build a Windows installer

```bash
npm run package
```

This produces an installer under `release/`. On Windows you may need **Developer Mode** turned on (Settings → Privacy & security → For developers) the first time, since the packaging tool extracts some files using symlinks.

## Using it

Pick your capture source (full monitor or a dragged region), choose a camera and microphone, toggle system audio, and optionally turn on background removal. Position the webcam bubble where you want it, then **Record**. A short countdown gives you a beat to get ready, and Reel tucks itself out of the way while recording.

While recording, these shortcuts work from anywhere:

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+S` | Stop recording |
| `Ctrl+Shift+1 / 2 / 3` | Scene: screen + bubble / screen only / camera fullscreen |
| `Ctrl+Shift+F` | Flip the camera |
| `Ctrl+Shift+Q` | Toggle cursor-follow |
| `Ctrl+Shift+D` | Toggle screen drawing |

When you stop, an editor opens so you can trim the ends, pick a resolution, and save.

## How it works

Reel is an Electron app (React + TypeScript). A hidden compositor paints the screen and a clipped, optionally background-removed webcam onto a single canvas each frame, mixes the audio, and records it with `MediaRecorder`. Background removal runs Google's [MediaPipe](https://ai.google.dev/edge/mediapipe) selfie segmentation locally. Exports go through a bundled [ffmpeg](https://ffmpeg.org).

## Acknowledgements

Stands on the shoulders of [Electron](https://www.electronjs.org), [MediaPipe](https://ai.google.dev/edge/mediapipe), and [ffmpeg](https://ffmpeg.org).

## License

MIT — see [LICENSE](LICENSE). It's free. Take it, use it, change it, ship it.
