# Multi-Modal Deepfake & Synthetic Media Detection

## Project Overview

This project detects potentially manipulated or synthetic audio-video media using an integrated multimodal approach. The system analyzes uploaded media across multiple dimensions—visual frames, audio features, and temporal consistency—to provide segment-by-segment and overall deepfake detection results.

---

## Architecture & Detection Pipeline

- **Visual Forensics:**
  - **Face Detection:** MediaPipe BlazeFace detects facial regions across sampled video frames.
  - **Feature Extraction & Classification:** Pretrained Xception neural network backbone (`legacy_xception.tf_in1k`) with trained classifier checkpoint (`artifacts/video_xception_full/classifier.pt`).
- **Audio Forensics:**
  - Mono 16 kHz audio extraction using FFmpeg.
  - **AASIST Model:** Audio Anti-Spoofing using Integrated Spectro-Temporal graph attention (`models/audio_aasist.pth`).
- **Media Preprocessing:**
  - Time-aligned slicing into 5-second overlapping segments with video frame extraction and audio stream mapping.
- **Multimodal Aggregation:**
  - Produces modality-wise fake probability scores (Visual score & Audio score) and an overall classification verdict (`REAL` vs `FAKE`) with confidence metrics.
- **Web Interface & REST API:**
  - Built with FastAPI (`main.py`) serving both backend analysis endpoints and an interactive frontend dashboard (`index.html`, `dashboard.html`, `app.js`, `style.css`).

---

## Project Structure

```
multimodal-deepfake-detection/
├── ai/
│   ├── audio_analyzer.py      # AASIST audio spoof inference
│   ├── video_analyzer.py      # BlazeFace + Xception visual inference
│   └── pipeline.py            # Multimodal aggregation pipeline
├── artifacts/
│   └── video_xception_full/
│       └── classifier.pt      # Visual classifier weights
├── models/
│   ├── aasist_config.conf     # AASIST model configuration
│   ├── aasist_model.py        # Graph attention PyTorch architecture
│   ├── audio_aasist.pth       # AASIST model weights
│   └── blaze_face_short_range.tflite
├── preprocessing/
│   ├── audio_extractor.py     # FFmpeg audio extraction
│   ├── audio_preprocessor.py  # Audio normalization and loading
│   ├── face_detector.py       # BlazeFace detection helpers
│   ├── frame_extractor.py     # Video frame extraction
│   ├── media_preprocessor.py  # Segment slicing and stream extraction
│   ├── media_types.py         # SegmentInput data models
│   └── video_reader.py        # OpenCV video metadata reader
├── services/
│   ├── upload_service.py      # Video upload & format validation
│   └── video_service.py       # Video inspection service
├── tests/
│   ├── test_end_to_end_analysis.py # Full integration test
│   ├── test_media_preprocessor.py  # Preprocessor tests
│   ├── test_upload.py              # Upload validation tests
│   └── test_video_service.py       # Video service tests
├── static/                    # Static UI assets
├── app.js                     # Interactive frontend script
├── dashboard.html             # Forensics dashboard
├── index.html                 # Main web application UI
├── main.py                    # FastAPI server & route handlers
├── requirements.txt           # Python dependencies
├── run.bat                    # One-click Windows startup script
└── style.css                  # UI stylesheet
```

---

## Getting Started

### 1. Prerequisites
- **Python 3.10+** (Python 3.12 recommended)
- **FFmpeg & FFprobe** installed and available in PATH (or placed in `bin/`)

### 2. Installation
Clone the repository and install required dependencies:

```bash
git clone https://github.com/manasvi019/multimodal-deepfake-detection.git
cd multimodal-deepfake-detection
pip install -r requirements.txt
```

### 3. Running the Server

Start the application with:

```bash
python main.py
```

Or on Windows, double-click:
```bat
run.bat
```

Once started, open your web browser at:
```
http://127.0.0.1:8000
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/upload` | Upload a video (MP4, MOV, AVI) |
| `GET` | `/videos` | List all uploaded videos |
| `GET` | `/videos/{filename}` | Retrieve video file details |
| `GET` | `/videos/{filename}/info` | Get technical metadata (FPS, dimensions, duration) |
| `POST` | `/videos/{filename}/analyze` | Run full multimodal deepfake detection pipeline |
| `GET` | `/` | Serve interactive web UI (`index.html`) |
| `GET` | `/dashboard` | Serve forensic dashboard (`dashboard.html`) |

---

## Running Automated Tests

Run the complete test suite with `pytest`:

```bash
pytest tests/
```

All 24 unit and end-to-end integration tests will run:
- Video and audio segment slicing
- Format validation and security checks
- Video technical metadata reading
- Full end-to-end detection pipeline
