import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

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
const YAW_DISTRACTION_THRESH = 0.32; // threshold for head turned too far left/right
const YAW_SHAKE_THRESH     = 0.35;  // range of yaw rotation that flags a head shake

// global model loading promise to avoid duplicate loading attempts if multiple hooks mount
let globalLoadPromise = null;
let modelsLoaded = false;

async function loadFaceApiModels() {
  if (modelsLoaded) return;
  if (!globalLoadPromise) {
    globalLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models')
    ]).then(() => {
      modelsLoaded = true;
      console.log('[Proctoring] face-api.js models loaded successfully.');
    }).catch(err => {
      globalLoadPromise = null;
      console.error('[Proctoring] Failed to load face-api.js models:', err);
      throw err;
    });
  }
  return globalLoadPromise;
}

export function useProctoring({ videoRef, enabled }) {
  const [confidenceScore, setConfidenceScore] = useState(100);
  const [alert, setAlert]                     = useState(null); // { message, type: 'warning'|'danger' }
  const [violationCount, setViolationCount]   = useState(0);
  const [shouldEnd, setShouldEnd]             = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(!modelsLoaded);

  const faceHistoryRef    = useRef([]);    // [{ x, y, yaw, time }]
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

  // ── face-api.js models init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    loadFaceApiModels()
      .then(() => {
        setIsModelsLoading(false);
      })
      .catch(() => {
        showAlert('⚠️ Proctoring models failed to load. Please check connection.', 'warning');
      });
  }, [enabled, showAlert]);

  // ── Per-frame analysis ──────────────────────────────────────────────────────
  const analyzeFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !modelsLoaded) return;

    const now = Date.now();
    let detection = null;

    try {
      detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
        .withFaceLandmarks();
    } catch (err) {
      console.warn('[Proctoring] detect error or video not ready:', err.message);
      return;
    }

    const vw = video.videoWidth  || video.offsetWidth  || 640;
    const vh = video.videoHeight || video.offsetHeight || 480;

    // ── No face ──────────────────────────────────────────────────────────────
    if (!detection) {
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

    // ── Primary face metrics ─────────────────────────────────────────────────
    const box = detection.detection.box;
    const faceCenterX = (box.x + box.width  / 2) / vw;
    const faceCenterY = (box.y + box.height / 2) / vh;

    // Extract landmarks for head orientation
    const landmarks = detection.landmarks;
    const noseTip = landmarks.positions[30]; // center nose bridge point
    const leftJaw = landmarks.positions[0];  // leftmost jaw contour point
    const rightJaw = landmarks.positions[16]; // rightmost jaw contour point

    // Relative yaw calculation: difference in distances from nose-to-jaw sides
    const dL = Math.abs(noseTip.x - leftJaw.x);
    const dR = Math.abs(rightJaw.x - noseTip.x);
    
    // yawScore runs from ~ -0.5 (turned left) to +0.5 (turned right), close to 0 when looking straight
    const yawScore = (dL + dR) > 0 ? (dL - dR) / (dL + dR) : 0;

    // Track history
    faceHistoryRef.current.push({ x: faceCenterX, y: faceCenterY, yaw: yawScore, time: now });
    if (faceHistoryRef.current.length > HISTORY_LEN) faceHistoryRef.current.shift();

    // ── Head shake: rapid lateral position shifting OR yaw rotation oscillation ─────
    if (faceHistoryRef.current.length >= HISTORY_LEN) {
      const yaws      = faceHistoryRef.current.map(f => f.yaw);
      const yawRange  = Math.max(...yaws) - Math.min(...yaws);
      
      const xs        = faceHistoryRef.current.map(f => f.x);
      const xRange    = Math.max(...xs) - Math.min(...xs);

      if (yawRange > YAW_SHAKE_THRESH || xRange > HEAD_SHAKE_THRESH) {
        showAlert('🚨 Head shaking detected — please remain focused and still', 'warning');
        pushScore(scoreRef.current - SCORE_PENALTY_WARN);
        faceHistoryRef.current = [];
        return;
      }
    }

    // ── Distraction: head turned too far left or right (yaw ratio) ─────────────
    if (Math.abs(yawScore) > YAW_DISTRACTION_THRESH) {
      showAlert('👀 Distraction detected — please look directly at the screen', 'warning');
      pushScore(scoreRef.current - SCORE_PENALTY_WARN);
      return;
    }

    // ── Looking away: face moved too far from center of frame ──────────────────
    if (Math.abs(faceCenterX - 0.5) > LOOK_AWAY_THRESH) {
      showAlert('👀 Please position yourself in the center of the camera', 'warning');
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

  return { confidenceScore, alert, violationCount, shouldEnd, isModelsLoading };
}

