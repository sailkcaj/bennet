# Bennet presentation demo

[Watch the latest 56-second demo](Bennet-demo.mp4).

This is a rendered presentation video, separate from the installed Expo app. The labelled facial boxes, pulse and breathing readings, alarm scenario, nearby helper, 30 m distance, notification, and map are illustrative. No real person receives an alert. The face boxes are hand-keyframed to the camera movement; they do not detect a pulse or diagnose a medical event.

## Sequence

| Time | Scene |
| --- | --- |
| 0–8 s | Close-up with moving forehead/cheek boxes, wide-shot inset, pulse and breathing traces |
| 8–12 s | Simulated irregular traces; scripted test event |
| 12–42 s | Full-screen check-in alarm, generated beeps, real 30-second cancellation countdown |
| 42–47 s | Nearby helper's phone: “Someone needs help”, “30 m away” |
| 47–56 s | Example route with directions and an “On my way” button |

The source clips in `inputs/` are Jack's original recordings. Their audio is never used in the rendered demo; the alarm and notification tones are generated mathematically.

## Re-render

Requirements: Python 3.10+, FFmpeg available on PATH, and Avenir Next on macOS or DejaVu Sans on Linux.

```bash
python3 -m venv demo/.venv
demo/.venv/bin/pip install -r demo/requirements.txt
demo/.venv/bin/python demo/render.py --preview  # extracts silent frames and generates scene stills
demo/.venv/bin/python demo/render.py            # writes demo/Bennet-demo.mp4
```

Intermediate frames, generated alarm audio, and preview stills stay in ignored `demo/.cache/`. A fresh clone regenerates them from the two source videos.

## Verification of the committed export

- 1920 × 1080, H.264, 30 fps, 1,680 frames, exactly 56 seconds.
- AAC audio contains only generated alarm/notification tones.
- Original soundtrack excluded; pre-alarm and post-notification audio are silent.
- The alarm begins at 12 seconds and ends at 42 seconds, giving the sleeper a full 30-second window.
- Full FFmpeg decode completed without errors.
