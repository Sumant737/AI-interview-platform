// src/components/interview/useProctoring.js - COMPLETE WITH OPTIMIZED EMOTION DETECTION
import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import useStore from '../../store/useStore';


// ----------------- Tunables -----------------
const YAW_THRESHOLD = 0.15;           // Head turn threshold (normalized)
const PITCH_THRESHOLD = 0.2;          // Head tilt threshold
const EAR_CLOSED = 0.21;              // Eye aspect ratio for closed eyes
const BLINK_DURATION = 700;           // ms
const NO_FACE_DURATION = 1500;        // ms
const MULTI_FACE_DURATION = 1200;     // ms
const WARNING_COOLDOWN = 2000;        // ms
const HEAD_TURN_DURATION = 2000;      // ms - Only warn after sustained turn
const FRAME_SKIP = 1;                 // process 1 of every (FRAME_SKIP+1) frames
const EMOTION_UPDATE_INTERVAL = 2000; // Update emotion every 2 seconds
// --------------------------------------------


// Module-level singleton to survive re-mounts in dev/StrictMode
let singleton = {
  started: false,
  initting: false,
  vision: null,
  landmarker: null,
  stream: null,
  streamInUse: false,
};


// ========== IMPROVED EMOTION DETECTION ==========
const detectEmotion = (landmarks) => {
  if (!landmarks || landmarks.length < 468) return { emotion: 'neutral', confidence: 0 };

  try {
    // Key landmark indices for emotion detection
    const leftMouthCorner = landmarks[61];   // Left mouth corner
    const rightMouthCorner = landmarks[291]; // Right mouth corner
    const upperLip = landmarks[13];          // Upper lip center
    const lowerLip = landmarks[14];          // Lower lip center
    const leftEyebrowInner = landmarks[70];  // Left eyebrow inner
    const rightEyebrowInner = landmarks[300]; // Right eyebrow inner
    const leftEyebrowOuter = landmarks[107]; // Left eyebrow outer
    const rightEyebrowOuter = landmarks[336]; // Right eyebrow outer
    const nose = landmarks[1];               // Nose tip
    const leftEye = landmarks[33];           // Left eye
    const rightEye = landmarks[263];         // Right eye
    
    // Calculate mouth metrics
    const mouthWidth = Math.abs(rightMouthCorner.x - leftMouthCorner.x);
    const mouthHeight = Math.abs(lowerLip.y - upperLip.y);
    const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
    const mouthCornerAvgY = (leftMouthCorner.y + rightMouthCorner.y) / 2;
    
    // Mouth curve (negative = smile/up, positive = frown/down)
    const mouthCurve = mouthCornerAvgY - mouthCenterY;
    
    // Mouth aspect ratio
    const mouthAspectRatio = mouthHeight / (mouthWidth || 0.001);
    
    // Calculate eyebrow metrics
    const eyebrowAvgY = (leftEyebrowInner.y + rightEyebrowInner.y + 
                         leftEyebrowOuter.y + rightEyebrowOuter.y) / 4;
    const eyeAvgY = (leftEye.y + rightEye.y) / 2;
    const eyebrowHeight = eyebrowAvgY - eyeAvgY; // Negative = raised, positive = lowered
    
    // Distance from mouth to nose (for smile detection)
    const mouthToNose = mouthCornerAvgY - nose.y;

    // ========== EMOTION CLASSIFICATION ==========
    
    // 😊 HAPPY: Mouth corners UP (negative curve), wide mouth
    if (mouthCurve < -0.008 && mouthWidth > 0.12) {
      return { 
        emotion: 'happy', 
        confidence: Math.min(0.95, 0.6 + Math.abs(mouthCurve) * 50) 
      };
    }
    
    // 😮 SURPRISED: Wide open mouth, raised eyebrows
    if (mouthAspectRatio > 0.5 && eyebrowHeight < -0.01) {
      return { 
        emotion: 'surprised', 
        confidence: Math.min(0.9, 0.6 + mouthAspectRatio * 0.5) 
      };
    }
    
    // 😰 FEARFUL: Wide eyes (raised eyebrows), slightly open mouth, tense
    if (eyebrowHeight < -0.015 && mouthAspectRatio > 0.25 && mouthAspectRatio < 0.5) {
      return { 
        emotion: 'fearful', 
        confidence: 0.7 
      };
    }
    
    // 😢 SAD: Mouth corners DOWN (positive curve), eyebrows down
    if (mouthCurve > 0.008 && eyebrowHeight > -0.005) {
      return { 
        emotion: 'sad', 
        confidence: 0.65 
      };
    }
    
    // 😠 ANGRY: Eyebrows down and close together, tight mouth
    if (eyebrowHeight > 0.005 && mouthWidth < 0.10) {
      return { 
        emotion: 'angry', 
        confidence: 0.7 
      };
    }
    
    // 😐 NEUTRAL: Default state (relaxed, no strong expression)
    return { 
      emotion: 'neutral', 
      confidence: 0.75 
    };

  } catch (error) {
    console.warn('Emotion detection error:', error);
    return { emotion: 'neutral', confidence: 0 };
  }
};


export default function useProctoring({ setStoreWarning, addProctorEvent }) {
  const [warning, setWarning] = useState(null);
  const [initialized, setInitialized] = useState(!!singleton.landmarker);
  const { cameraState, setCameraState, stopCamera } = useStore();

  // Emotion state
  const [currentEmotion, setCurrentEmotion] = useState({ emotion: 'neutral', confidence: 0 });
  const [emotionHistory, setEmotionHistory] = useState([]);

  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const mountedRef = useRef(true);

  // timers
  const lastNoFaceRef = useRef(null);
  const lastMultiFaceRef = useRef(null);
  const blinkStartRef = useRef(null);
  const lastWarnAtRef = useRef(0);
  const lastEmotionUpdateRef = useRef(0);
  const headTurnStartRef = useRef(null); // NEW: For head turn timing

  // rAF frame throttling
  const frameCounterRef = useRef(0);

  const emitWarn = (msg, type, persist = false) => {
    const now = Date.now();
    if (!persist && now - lastWarnAtRef.current < WARNING_COOLDOWN) return;
    lastWarnAtRef.current = now;
    setWarning(msg);
    setStoreWarning?.(type);
    if (!persist) setTimeout(() => setWarning(null), 1500);
  };

  const addEvent = (type, extra = {}) => {
    addProctorEvent?.({ type, timestamp: Date.now(), ...extra });
  };

  const calcEAR = (f) => {
    const L = f, R = f, T = f, B = f;
    if (!L || !R || !T || !B) return 1;
    const v = Math.abs(T.y - B.y);
    const h = Math.abs(L.x - R.x) || 1e-6;
    return v / h;
  };

  const startCamera = async () => {
    if (singleton.stream && singleton.streamInUse) {
      console.log('Camera stream already active');
      return singleton.stream;
    }

    try {
      console.log('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      singleton.stream = stream;
      singleton.streamInUse = true;
      setCameraState({ stream, isActive: true });
      
      console.log('Camera started successfully');
      return stream;
    } catch (error) {
      console.error('Camera error:', error);
      setWarning('Camera permission denied or unavailable.');
      throw error;
    }
  };

  const cleanupCamera = () => {
    console.log('Cleaning up camera...');
    if (singleton.stream) {
      singleton.stream.getTracks().forEach(track => {
        console.log('Stopping camera track:', track.kind);
        track.stop();
      });
      singleton.stream = null;
      singleton.streamInUse = false;
    }
    setCameraState({ stream: null, isActive: false });
    setWarning(null);
  };

  async function bindVideoStream(video, stream) {
    if (video.srcObject === stream) return;
    
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    
    if (video.readyState < 1) {
      await new Promise((res) => video.addEventListener('loadedmetadata', res, { once: true }));
    }
    
    try { 
      await video.play(); 
    } catch (playError) {
      console.error('Video play error:', playError);
    }
    
    if (video.paused) {
      await new Promise((res) => video.addEventListener('canplay', res, { once: true }));
      try { 
        await video.play(); 
      } catch (playError) {
        console.error('Video play retry error:', playError);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const start = async () => {
      await new Promise((res) => {
        const check = () => {
          if (videoRef.current && mountedRef.current) {
            res();
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
      
      if (cancelled || !mountedRef.current) return;

      try {
        const stream = await startCamera();
        if (cancelled || !mountedRef.current) return;

        await bindVideoStream(videoRef.current, stream);
        if (cancelled || !mountedRef.current) return;

        if (!singleton.landmarker) {
          if (singleton.initting) {
            while (singleton.initting && !cancelled) {
              await new Promise((res) => setTimeout(res, 50));
            }
          } else {
            try {
              singleton.initting = true;
              console.log('Initializing MediaPipe...');
              
              if (!singleton.vision) {
                singleton.vision = await FilesetResolver.forVisionTasks(
                  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
                );
              }
              
              singleton.landmarker = await FaceLandmarker.createFromOptions(singleton.vision, {
                baseOptions: {
                  modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
                },
                runningMode: 'VIDEO',
                numFaces: 2
              });
              
              console.log('MediaPipe initialized successfully');
            } catch (e) {
              console.error('Landmarker init error:', e);
              setWarning('Failed to initialize face detection.');
            } finally {
              singleton.initting = false;
            }
          }
        }

        if (cancelled || !mountedRef.current) return;

        singleton.started = true;
        setInitialized(true);

        let skip = 0;
        const tick = () => {
          if (cancelled || !mountedRef.current) return;
          
          const video = videoRef.current;
          const lm = singleton.landmarker;
          
          if (!video || !lm || !singleton.streamInUse) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          if (skip < FRAME_SKIP) {
            skip++;
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          skip = 0;

          try {
            if (video.readyState >= 2) {
              const res = lm.detectForVideo(video, performance.now());
              const faces = res?.faceLandmarks || [];
              const t = Date.now();

              // ========== PROCTORING LOGIC ==========
              if (faces.length === 0) {
                emitWarn('No face in view.', 'no_face');
                if (!lastNoFaceRef.current) lastNoFaceRef.current = t;
                if (t - lastNoFaceRef.current > NO_FACE_DURATION) {
                  emitWarn('No face detected. Please return to view.', 'no_face', true);
                  addEvent('no_face');
                  lastNoFaceRef.current = t;
                }
              } else {
                lastNoFaceRef.current = null;
              }

              if (faces.length > 1) {
                if (!lastMultiFaceRef.current) lastMultiFaceRef.current = t;
                if (t - lastMultiFaceRef.current > MULTI_FACE_DURATION) {
                  emitWarn('Multiple faces detected.', 'multi_face', true);
                  addEvent('multi_face');
                  lastMultiFaceRef.current = t;
                }
              } else {
                lastMultiFaceRef.current = null;
              }

              if (faces.length >= 1) {
                const f = faces[0];
                
                // ========== IMPROVED HEAD POSE DETECTION ==========
                if (f.length > 263) {
                  try {
                    const leftEye = f[33];
                    const rightEye = f[263];
                    const noseTip = f[1];
                    
                    const faceWidth = Math.abs(rightEye.x - leftEye.x);
                    const eyeCenter = (leftEye.x + rightEye.x) / 2;
                    const yaw = Math.abs(noseTip.x - eyeCenter) / faceWidth;
                    
                    const eyeMidY = (leftEye.y + rightEye.y) / 2;
                    const pitch = Math.abs(noseTip.y - eyeMidY);
                    
                    const isHeadTurned = yaw > YAW_THRESHOLD || pitch > PITCH_THRESHOLD;
                    
                    if (isHeadTurned) {
                      if (!headTurnStartRef.current) headTurnStartRef.current = t;
                      if (t - headTurnStartRef.current > HEAD_TURN_DURATION) {
                        emitWarn('Please face the screen directly.', 'yaw_out');
                        addEvent('yaw_out', { yaw: yaw.toFixed(3), pitch: pitch.toFixed(3) });
                        headTurnStartRef.current = t;
                      }
                    } else {
                      headTurnStartRef.current = null;
                    }
                  } catch (e) {
                    console.warn('Pose error:', e);
                  }
                }

                // Eye closure detection
                const ear = calcEAR(f);
                if (ear < EAR_CLOSED) {
                  if (!blinkStartRef.current) blinkStartRef.current = t;
                  if (t - blinkStartRef.current > BLINK_DURATION) {
                    emitWarn('Eyes closed detected.', 'eye_closed');
                    addEvent('eye_closed');
                    blinkStartRef.current = t;
                  }
                } else {
                  blinkStartRef.current = null;
                }

                // ========== EMOTION DETECTION ==========
                if (t - lastEmotionUpdateRef.current > EMOTION_UPDATE_INTERVAL) {
                  const emotionResult = detectEmotion(f);
                  
                  // Log for debugging
                  console.log('🎭 Emotion detected:', emotionResult.emotion, `(${Math.round(emotionResult.confidence * 100)}%)`);
                  
                  setCurrentEmotion(emotionResult);
                  
                  // Add to history with timestamp
                  setEmotionHistory(prev => [
                    ...prev,
                    {
                      ...emotionResult,
                      timestamp: t
                    }
                  ]);
                  
                  lastEmotionUpdateRef.current = t;
                  
                  // Add emotion event to proctoring events
                  addEvent('emotion_detected', emotionResult);
                }
              }
            }
          } catch (e) {
            console.warn('Detection error:', e);
          }
          
          rafRef.current = requestAnimationFrame(tick);
        };

        const onVis = () => {
          if (document.hidden) {
            emitWarn('Tab switch detected. Stay on this tab.', 'tab_switch');
            addEvent('tab_switch');
          }
        };
        document.addEventListener('visibilitychange', onVis);

        rafRef.current = requestAnimationFrame(tick);

        return () => {
          cancelled = true;
          document.removeEventListener('visibilitychange', onVis);
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setWarning(null);
          
          if (mountedRef.current) {
            cleanupCamera();
          }
        };

      } catch (error) {
        console.error('Error starting proctoring:', error);
        setWarning('Failed to start proctoring system.');
      }
    };

    const cleanup = start();

    return () => {
      mountedRef.current = false;
      cancelled = true;
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [setStoreWarning, addProctorEvent]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      cleanupCamera();
    };
  }, []);

  return { 
    warning, 
    videoRef, 
    initialized,
    currentEmotion,
    emotionHistory
  };
}
