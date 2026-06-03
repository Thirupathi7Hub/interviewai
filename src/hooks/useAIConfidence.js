import { useEffect, useRef, useState, useCallback } from 'react';
import client from '../api/client';

const CAPTURE_INTERVAL_MS = 15000; // analyze face every 15 seconds
const JPEG_QUALITY        = 0.6;   // lower = smaller payload, faster upload
const CAPTURE_WIDTH       = 320;   // resize before sending (saves bandwidth)
const CAPTURE_HEIGHT      = 240;

/**
 * useAIConfidence — Captures webcam frames periodically and sends them to
 * the NVIDIA nemotron-3-nano-omni vision model for real AI confidence analysis.
 *
 * Returns:
 *   aiScore    — 0-100 AI confidence score
 *   emotion    — string label (calm, nervous, focused, etc.)
 *   engagement — high | medium | low
 *   eyeContact — boolean
 *   insight    — one encouraging sentence from the AI
 *   isAnalyzing — true while a request is in flight
 */
export function useAIConfidence({ videoRef, enabled }) {
  const [aiScore,      setAiScore]      = useState(null);   // null = not yet analyzed
  const [emotion,      setEmotion]      = useState('');
  const [engagement,   setEngagement]   = useState('');
  const [eyeContact,   setEyeContact]   = useState(true);
  const [insight,      setInsight]      = useState('');
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);

  const canvasRef  = useRef(null);
  const intervalRef = useRef(null);

  // Capture one JPEG frame from the video element
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    // Reuse or create offscreen canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width  = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY); // base64 data URL
  }, [videoRef]);

  // Send frame to backend → NVIDIA vision model
  const analyzeConfidence = useCallback(async () => {
    if (isAnalyzing) return; // skip if previous call still running
    const imageBase64 = captureFrame();
    if (!imageBase64) return;

    setIsAnalyzing(true);
    try {
      const { data } = await client.post('/interview/face-confidence', { imageBase64 });
      if (data.score !== undefined) setAiScore(data.score);
      if (data.emotion)             setEmotion(data.emotion);
      if (data.engagement)          setEngagement(data.engagement);
      if (data.eyeContact !== undefined) setEyeContact(data.eyeContact);
      if (data.insight)             setInsight(data.insight);
    } catch (err) {
      console.warn('[AI Confidence] API error:', err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [captureFrame, isAnalyzing]);

  // Start / stop interval based on enabled flag
  useEffect(() => {
    if (!enabled) return;

    // Run first analysis after 5 seconds (give video time to start)
    const firstRun = setTimeout(analyzeConfidence, 5000);
    intervalRef.current = setInterval(analyzeConfidence, CAPTURE_INTERVAL_MS);

    return () => {
      clearTimeout(firstRun);
      clearInterval(intervalRef.current);
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { aiScore, emotion, engagement, eyeContact, insight, isAnalyzing };
}
