# OmniCut Studio 🎬
### Free, Open-Source CapCut & After Effects Alternative with Instruction-Based Video Editing

> **OmniCut Studio** is a modern, modular, instruction-based video editor built to automate viral story shorts (Dylan Anderson style), kinetic subtitle animations, dynamic audio ducking, moving watermark removal, and face privacy tracking.

---

## ⚡ Key Highlights

* **📋 100% Instruction-Based (JSON Driven):** Supply a video and an `instructions.json` file. The engine places voiceover clips at exact timestamps, calculates audio ducking envelopes, burns animated subtitles, and cuts the final master video automatically.
* **🎙️ Built-in Kokoro TTS (`am_eric`):** Produces natural US English broadcaster/storyteller commentary offline without API limits or subscription fees.
* **🔉 Dynamic Audio Ducking:** Automatically drops background audio volume during voiceover lines (e.g., -12dB), restoring 100% volume for live dialogue and natural sound.
* **💬 Kinetic Pop-Bounce Captions:** Word-by-word active highlights (TikTok/Shorts style) with stroke borders and scale bounce animation.
* **💧 Moving Watermark Masking:** Configurable tracking blur box to hide logos, usernames, and watermark text.
* **🎭 Face Tracking & Blur:** Gaussian blur, mosaic pixelation, or censor bar tracking.
* **🌐 Runs Free on GitHub Pages:** Completely static client-side web studio with zero server setup required.

---

## 🚀 How to Host Free on GitHub Pages (Step-by-Step)

Once this repository is on GitHub, follow these 3 simple steps to host your editor live on the web for free:

1. Go to your repository page on GitHub:  
   👉 **[https://github.com/aditya-Pratap15/capcut-](https://github.com/aditya-Pratap15/capcut-)**
2. Click on **Settings** (top right tab) ⚙️.
3. In the left sidebar, click on **Pages** (under the "Code and automation" section).
4. Under **"Build and deployment"**:
   * **Source:** Select **`Deploy from a branch`**.
   * **Branch:** Select **`main`** and folder **`/ (root)`**.
   * Click **Save**.
5. Wait 1–2 minutes! GitHub will generate your live URL:  
   🌐 **`https://aditya-pratap15.github.io/capcut-/`**

You can now open that URL on any computer, phone, or tablet to use your custom editor anywhere!

---

## 📖 The Instruction JSON Schema (`instructions.json`)

The core innovation of OmniCut is the **instruction recipe**. Here is an example of how you can instruct the engine:

```json
{
  "metadata": {
    "project_name": "Dylan_Anderson_Story_Edit",
    "target_ratio": "9:16",
    "fps": 30
  },
  "audio_ducking": [
    {
      "start_sec": 0.0,
      "end_sec": 7.5,
      "original_volume": 0.25,
      "description": "Duck original audio during opening hook"
    },
    {
      "start_sec": 7.5,
      "end_sec": 21.0,
      "original_volume": 1.0,
      "description": "Full original audio for live action & cheering"
    },
    {
      "start_sec": 21.0,
      "end_sec": 28.5,
      "original_volume": 0.25,
      "description": "Duck original audio during closing takeaway"
    }
  ],
  "voiceover": [
    {
      "timestamp_sec": 0.2,
      "voice": "am_eric",
      "speed": 1.05,
      "volume": 1.2,
      "text": "When this little girl couldn't reach the basketball hoop, her older brother stepped in to give her a memory she would never forget."
    },
    {
      "timestamp_sec": 21.2,
      "voice": "am_eric",
      "speed": 1.05,
      "volume": 1.2,
      "text": "After helping her score, he gently kissed his little sister on the cheek, proving that older brothers really are the best protectors."
    }
  ],
  "captions": {
    "style": {
      "font_family": "Impact, Inter, sans-serif",
      "font_size_px": 42,
      "highlight_color": "#FFDF00",
      "animation": "pop_bounce",
      "position_y_percent": 80
    },
    "segments": [
      {
        "start_sec": 0.2,
        "end_sec": 7.2,
        "text": "When this little girl couldn't reach the hoop..."
      }
    ]
  },
  "effects": {
    "face_tracking": {
      "enabled": false,
      "mode": "gaussian"
    },
    "watermark_removal": [
      {
        "start_sec": 0.0,
        "end_sec": 28.8,
        "x_percent": 72,
        "y_percent": 4,
        "width_percent": 25,
        "height_percent": 6
      }
    ]
  }
}
```

---

## 💻 Running the Local Python CLI Engine (`engine.py`)

If you want **lossless 4K rendering** and automatic Kokoro TTS synthesis on your local machine:

### 1. Requirements
Make sure you have `ffmpeg` and Python installed:
```bash
pip install soundfile numpy kokoro
```

### 2. Execute Master Render
Run the engine by passing your video file and instructions:
```bash
python engine.py --video "my_video.mp4" --instructions "sample_instructions.json" --output "master_edit.mp4"
```

The script will automatically:
1. Synthesize the voiceover lines using Kokoro TTS (`am_eric`).
2. Calculate the volume envelopes for background audio ducking.
3. Merge and export the master `.mp4` video with sub-frame synchronization.

---

## 🛠️ Architecture & Extensibility

* `index.html`: The multi-track CapCut-style responsive web interface.
* `style.css`: Dark-mode studio styling with customizable color themes.
* `app.js`: Timeline management, HTML5 Canvas renderer, kinetic pop caption engine, and live audio ducking.
* `engine.py`: High-performance Python + FFmpeg CLI rendering backend.
* `sample_instructions.json`: Ready-to-use template for viral story shorts.

## 📄 License
MIT License — 100% Free for personal and commercial use.
