import subprocess
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from main import app
import services.upload_service as upload_service

client = TestClient(app)


def test_full_end_to_end_analysis(tmp_path, monkeypatch):
    monkeypatch.setattr(upload_service, "UPLOAD_DIR", tmp_path)

    # 1. Generate a valid 6-second video with both audio and video streams using ffmpeg
    video_file = tmp_path / "test_input.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "testsrc=size=320x240:rate=10:duration=6",
        "-f", "lavfi",
        "-i", "sine=frequency=1000:sample_rate=16000:duration=6",
        "-shortest",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        str(video_file),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    assert video_file.is_file()

    # 2. Upload video
    with open(video_file, "rb") as f:
        upload_resp = client.post(
            "/upload",
            files={"file": ("test_input.mp4", f, "video/mp4")},
        )
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()
    filename = upload_data["filename"]
    assert filename

    # 3. Request video info
    info_resp = client.get(f"/videos/{filename}/info")
    assert info_resp.status_code == 200
    info_data = info_resp.json()["video_info"]
    assert info_data["duration_seconds"] > 0
    assert info_data["width"] == 320
    assert info_data["height"] == 240

    # 4. Trigger multimodal deepfake analysis
    analyze_resp = client.post(f"/videos/{filename}/analyze")
    assert analyze_resp.status_code == 200
    analyze_data = analyze_resp.json()

    assert "analysis" in analyze_data
    analysis = analyze_data["analysis"]
    assert analysis["status"] == "completed"
    assert analysis["prediction"] in {"REAL", "FAKE", "inconclusive"}
    assert analysis["audio_score"] is not None
    assert len(analysis["segments"]) > 0

    print("\nEnd-to-end analysis result:")
    print("Prediction:", analysis["prediction"])
    print("Confidence:", analysis["confidence"])
    print("Audio fake score:", analysis["audio_score"])
    print("Video fake score:", analysis["video_score"])
    print("Segments count:", len(analysis["segments"]))

