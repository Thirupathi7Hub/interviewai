import { useEffect, useRef, useState, useCallback } from 'react';

const INTERVAL_MS          = 700;   // analysis frequency
const NO_FACE_WARN_MS      = 3000;  // warn after 3s without face
const NO_FACE_VIOLATION_MS = 9000;  // violation after 9s without face
const HEAD_SHAKE_THRESH    = 0.14;  // relative X movement to flag a shake
const LOOK_AWAY_THRESH     = 0.35;  // face x-center deviation from 0.5
const HISTORY_LEN          = 6;     // frames to track for movement analysis
const MAX_VIOLATIONS       = 3;
const SCORE_RECOVER        = 0.4;   // points recovered per clean frame
const SCORE_PENALTY_WARN   = 3;     // points lost per minor warning
const SCORE_PENALTY_VIOL   = 18;    // points lost per hard violation

export function useProctoring({ videoRef, enabled }) {
  const [confidenceScore, setConfidenceScore] = useState(100);
  const [alert, setAlert]                     = useState(null); // { message, type: 'warning'|'danger' }
  const [violationCount, setViolationCount]   = useState(0);
  const [shouldEnd, setShouldEnd]             = useState(false);

  const detectorRef       = useRef(null);
  const faceHistoryRef    = useRef([]);    // [{ x, y, time }]
  const noFaceStartRef    = useRef(null);
  const violationCountRef = useRef(0);
  const scoreRef          = useRef(100);
  const intervalRef       = useRef(null);
  const alertTimerRef     = useRef(null);
  const lastViolTimeRef   = useRef(0);     // throttle violations

  // ── helpers ────────────────────────────────────────────────────────────────
  const pushScore = useCallback((value) => {
    scoreRef.current = Math.max(0, Math.min(100, value));
    setConfidenceScore(Math.round(scoreRef.current));
  }, []);

  const showAlert = useCallback((message, type = 'warning') => {
    setAlert({ message, type });
    clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => setAlert(null), type === 'danger' ? 6000 : 4000);
  }, []);

  const addViolation = useCallback((reason) => {
    const now = Date.now();
    if (now - lastViolTimeRef.current < 5000) return; // throttle: 1 violation per 5s
    lastViolTimeRef.current = now;

    violationCountRef.current += 1;
    setViolationCount(violationCountRef.current);
    pushScore(scoreRef.current - SCORE_PENALTY_VIOL);
    showAlert(`🚨 Violation #${violationCountRef.current}: ${reason}`, 'danger');

    if (violationCountRef.current >= MAX_VIOLATIONS) {
      setShouldEnd(true);
    }
  }, [pushScore, showAlert]);

  // ── FaceDetector init ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if ('FaceDetector' in window) {
      try {
        detectorRef.current = new window.FaceDetector({ maxDetectedFaces: 5, fastMode: true });
      } catch (e) {
        console.warn('[Proctoring] FaceDetector init failed:', e.message);
      }
    } else {
      console.warn('[Proctoring] FaceDetector API not available in this browser.');
    }
  }, [enabled]);

  // ── Per-frame analysis ──────────────────────────────────────────────────────
  const analyzeFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !detectorRef.current) return;

    const now = Date.now();
    let faces = [];

    try {
      faces = await detectorRef.current.detect(video);
    } catch {
      return; // video not ready yet
    }

    const vw = video.videoWidth  || video.offsetWidth  || 640;
    const vh = video.videoHeight || video.offsetHeight || 480;

    // ── No face ──────────────────────────────────────────────────────────────
    if (faces.length === 0) {
      if (!noFaceStartRef.current) noFaceStartRef.current = now;
      const elapsed = now - noFaceStartRef.current;

      if (elapsed > NO_FACE_VIOLATION_MS) {
        noFaceStartRef.current = null;
        addViolation('Face not visible — possible mobile usage');
      } else if (elapsed > NO_FACE_WARN_MS) {
        showAlert('🔍 Please keep your face visible in the camera', 'warning');
        pushScore(scoreRef.current - SCORE_PENALTY_WARN);
      }

      faceHistoryRef.current = [];
      return;
    }

    // Face visible → reset absence timer
    noFaceStartRef.current = null;

    // ── Multiple faces ────────────────────────────────────────────────────────
    if (faces.length > 1) {
      addViolation('Multiple people detected in frame');
      return;
    }

    // ── Primary face metrics ─────────────────────────────────────────────────
    const bbox        = faces[0].boundingBox;
    const faceCenterX = (bbox.x + bbox.width  / 2) / vw;
    const faceCenterY = (bbox.y + bbox.height / 2) / vh;

    // Track history
    faceHistoryRef.current.push({ x: faceCenterX, y: faceCenterY, time: now });
    if (faceHistoryRef.current.length > HISTORY_LEN) faceHistoryRef.current.shift();

    // ── Head shake: rapid lateral movement ────────────────────────────────────
    if (faceHistoryRef.current.length >= HISTORY_LEN) {
      const xs  = faceHistoryRef.current.map(f => f.x);
      const xRange = Math.max(...xs) - Math.min(...xs);
      if (xRange > HEAD_SHAKE_THRESH) {
        showAlert('🚨 Suspicious head movement detected — please stay still', 'warning');
        pushScore(scoreRef.current - SCORE_PENALTY_WARN);
        return;
      }
    }

    // ── Looking away from camera ───────────────────────────────────────────────
    if (Math.abs(faceCenterX - 0.5) > LOOK_AWAY_THRESH) {
      showAlert('👀 Please look directly at the camera', 'warning');
      pushScore(scoreRef.current - SCORE_PENALTY_WARN);
      return;
    }

    // ── All good: slowly recover score ────────────────────────────────────────
    if (scoreRef.current < 100) {
      pushScore(scoreRef.current + SCORE_RECOVER);
    }
  }, [videoRef, addViolation, showAlert, pushScore]);

  // ── Tab / window switching ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden) {
        showAlert('🚨 Tab switch detected!', 'danger');
        addViolation('Tab or window switch detected');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, addViolation, showAlert]);

  // ── Main loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    intervalRef.current = setInterval(analyzeFrame, INTERVAL_MS);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(alertTimerRef.current);
    };
  }, [enabled, analyzeFrame]);

  return { confidenceScore, alert, violationCount, shouldEnd };
}
