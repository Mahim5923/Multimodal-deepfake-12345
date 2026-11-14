from dataclasses import dataclass, field
import numpy as np
from preprocessing.media_types import SegmentInput

from .audio_analyzer import AudioAnalyzer
from .video_analyzer import VideoAnalyzer


@dataclass
class SegmentAnalysis:
    segment_id: str
    start_sec: float
    end_sec: float
    audio_fake_score: float | None
    video_fake_score: float | None
    sync_mismatch_score: float | None = None


@dataclass
class AnalysisResult:
    status: str
    prediction: str
    confidence: float | None
    overall_score: float | None = None
    video_score: float | None = None
    audio_score: float | None = None
    segments: list[SegmentAnalysis] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "prediction": self.prediction,
            "confidence": self.confidence,
            "overall_score": self.overall_score,
            "video_score": self.video_score,
            "audio_score": self.audio_score,
            "segments": [
                {
                    "segment_id": s.segment_id,
                    "start_sec": s.start_sec,
                    "end_sec": s.end_sec,
                    "audio_fake_score": s.audio_fake_score,
                    "video_fake_score": s.video_fake_score,
                    "sync_mismatch_score": s.sync_mismatch_score,
                }
                for s in self.segments
            ],
            "errors": self.errors,
        }


def analyze_segments(segments: list[SegmentInput]) -> AnalysisResult:
    errors: list[dict[str, str]] = []
    results: list[SegmentAnalysis] = []

    if not segments:
        return AnalysisResult(
            status="failed",
            prediction="inconclusive",
            confidence=None,
            overall_score=None,
            video_score=None,
            audio_score=None,
            segments=[],
            errors=[{"analyzer": "pipeline", "message": "No segments were provided."}],
        )

    try:
        video_analyzer = VideoAnalyzer()
    except Exception as exc:
        video_analyzer = None
        errors.append({"analyzer": "video", "message": str(exc)})

    try:
        audio_analyzer = AudioAnalyzer()
    except Exception as exc:
        audio_analyzer = None
        errors.append({"analyzer": "audio", "message": str(exc)})

    errors.append({
        "analyzer": "sync",
        "message": "Synchronization analysis is not implemented yet.",
    })

    try:
        for segment in segments:
            video_score = None
            audio_score = None

            if video_analyzer is not None and getattr(segment, "video_available", True):
                try:
                    frames = getattr(segment, "video_frames", None)
                    if frames is not None and len(frames) > 0:
                        video_score = video_analyzer.predict_frames(np.asarray(frames))
                except Exception as exc:
                    errors.append({
                        "analyzer": "video",
                        "segment_id": str(segment.segment_id),
                        "message": str(exc),
                    })

            if audio_analyzer is not None and getattr(segment, "audio_available", True):
                try:
                    samples = getattr(segment, "audio_samples", None)
                    if samples is not None and len(samples) > 0:
                        audio_score = audio_analyzer.predict_samples(
                            samples,
                            sample_rate=getattr(segment, "audio_sample_rate", 16000),
                        )
                except Exception as exc:
                    errors.append({
                        "analyzer": "audio",
                        "segment_id": str(segment.segment_id),
                        "message": str(exc),
                    })

            results.append(
                SegmentAnalysis(
                    segment_id=str(segment.segment_id),
                    start_sec=float(segment.start_sec),
                    end_sec=float(segment.end_sec),
                    audio_fake_score=audio_score,
                    video_fake_score=video_score,
                    sync_mismatch_score=None,
                )
            )
    finally:
        if video_analyzer is not None:
            video_analyzer.close()

    # Calculate modality aggregations
    valid_video_scores = [s.video_fake_score for s in results if s.video_fake_score is not None]
    valid_audio_scores = [s.audio_fake_score for s in results if s.audio_fake_score is not None]

    avg_video_score = float(np.mean(valid_video_scores)) if valid_video_scores else None
    avg_audio_score = float(np.mean(valid_audio_scores)) if valid_audio_scores else None

    if avg_video_score is not None and avg_audio_score is not None:
        overall_score = float(0.5 * avg_video_score + 0.5 * avg_audio_score)
    elif avg_video_score is not None:
        overall_score = avg_video_score
    elif avg_audio_score is not None:
        overall_score = avg_audio_score
    else:
        overall_score = None

    if overall_score is not None:
        prediction = "FAKE" if overall_score >= 0.5 else "REAL"
        confidence = float(overall_score if prediction == "FAKE" else 1.0 - overall_score)
        status = "completed"
    else:
        prediction = "inconclusive"
        confidence = None
        status = "failed"

    return AnalysisResult(
        status=status,
        prediction=prediction,
        confidence=confidence,
        overall_score=overall_score,
        video_score=avg_video_score,
        audio_score=avg_audio_score,
        segments=results,
        errors=errors,
    )
