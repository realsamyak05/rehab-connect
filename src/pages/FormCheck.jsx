import { useEffect, useRef, useState } from "react";
import {
  FaCamera,
  FaCircleCheck,
  FaCircleExclamation,
  FaStop,
} from "react-icons/fa6";
import "./FormCheck.css";

const MEDIAPIPE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

function angleBetween(first, vertex, last) {
  const firstVector = { x: first.x - vertex.x, y: first.y - vertex.y };
  const lastVector = { x: last.x - vertex.x, y: last.y - vertex.y };
  const dot = firstVector.x * lastVector.x + firstVector.y * lastVector.y;
  const length =
    Math.hypot(firstVector.x, firstVector.y) *
    Math.hypot(lastVector.x, lastVector.y);
  if (!length) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot / length))) * (180 / Math.PI);
}

function poseEstimate(landmarks, assessment) {
  if (!landmarks?.length) return null;
  const leftKneeAngle = angleBetween(
    landmarks[23],
    landmarks[25],
    landmarks[27],
  );
  const rightKneeAngle = angleBetween(
    landmarks[24],
    landmarks[26],
    landmarks[28],
  );
  if (leftKneeAngle === null || rightKneeAngle === null) return null;
  const leftFlexion = Math.round(180 - leftKneeAngle);
  const rightFlexion = Math.round(180 - rightKneeAngle);
  const flexion = Math.round((leftFlexion + rightFlexion) / 2);
  const difference = Math.abs(leftFlexion - rightFlexion);
  if (assessment === "knee") {
    return {
      primary: "Knee flexion estimate: " + flexion + "°",
      detail:
        flexion < 100
          ? "Your current screen estimate is about " +
            flexion +
            "°. Your selected target is 100°."
          : "You are at or beyond the selected 100° screen-estimate target.",
      score: Math.min(100, Math.round((flexion / 100) * 100)),
      stable: difference < 10,
    };
  }
  const lessBentSide = leftFlexion < rightFlexion ? "left" : "right";
  return {
    primary: "Squat symmetry difference: " + difference + "°",
    detail:
      difference < 8
        ? "Your knee bend looks fairly even in this camera view."
        : "Your " +
          lessBentSide +
          " side is bending less in this camera view. Slow down and use support if needed.",
    score: Math.max(0, 100 - difference * 5),
    stable: difference < 8,
  };
}

function FormCheck() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const frameRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [assessment, setAssessment] = useState("knee");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(
    () => () => {
      window.cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close?.();
    },
    [],
  );

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera access is not supported in this browser.");
      return;
    }
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
    } catch {
      setMessage(
        "Camera access was not granted. Allow camera access and try again.",
      );
    }
  }

  function stopAssessment() {
    window.cancelAnimationFrame(frameRef.current);
    setAssessing(false);
  }

  function stopCamera() {
    stopAssessment();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setResult(null);
  }

  async function startAssessment() {
    if (!cameraOn) return;
    setLoadingModel(true);
    setMessage("");
    try {
      if (!landmarkerRef.current) {
        const { FilesetResolver, PoseLandmarker } = await import(
          /* @vite-ignore */ MEDIAPIPE_URL
        );
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
      }
      setAssessing(true);
      const assessFrame = (time) => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          frameRef.current = window.requestAnimationFrame(assessFrame);
          return;
        }
        const detection = landmarkerRef.current.detectForVideo(
          videoRef.current,
          time,
        );
        if (time - lastUpdateRef.current > 350) {
          lastUpdateRef.current = time;
          const estimate = poseEstimate(detection.landmarks?.[0], assessment);
          setResult(estimate);
          if (!estimate)
            setMessage(
              "Step back until your hips, knees, and ankles are visible in the frame.",
            );
          else setMessage("");
        }
        frameRef.current = window.requestAnimationFrame(assessFrame);
      };
      frameRef.current = window.requestAnimationFrame(assessFrame);
    } catch {
      setMessage(
        "The on-device pose model could not load. Check your connection and try again.",
      );
    } finally {
      setLoadingModel(false);
    }
  }

  return (
    <main className="form-check-page">
      <header>
        <p className="form-kicker">ON-DEVICE MOTION CHECK</p>
        <h1>See your movement in the moment.</h1>
        <p>
          Use your camera for a screen-based estimate of knee bend or squat
          symmetry. Video stays on this device and is not saved.
        </p>
      </header>
      <section className="form-safety">
        <FaCircleExclamation />
        <span>
          This is not a diagnosis or a replacement for a physiotherapist. Stop
          if movement causes pain, dizziness, weakness, or instability.
        </span>
      </section>
      <section className="form-workspace">
        <div className="camera-panel">
          <video
            ref={videoRef}
            className={cameraOn ? "camera-feed" : "camera-feed hidden"}
            playsInline
            muted
          />
          <div
            className={
              cameraOn ? "camera-placeholder hidden" : "camera-placeholder"
            }
          >
            <FaCamera />
            <strong>Camera is off</strong>
            <span>Position your whole lower body in view.</span>
          </div>
          {cameraOn && (
            <span className="camera-chip">
              {assessing ? "● Analyzing on this device" : "Camera preview"}
            </span>
          )}
        </div>
        <div className="assessment-panel">
          <p className="form-kicker">CHOOSE A CHECK</p>
          <div className="assessment-options">
            <button
              className={assessment === "knee" ? "selected" : ""}
              onClick={() => {
                setAssessment("knee");
                setResult(null);
              }}
            >
              Knee flexion<span>Target: 100°</span>
            </button>
            <button
              className={assessment === "squat" ? "selected" : ""}
              onClick={() => {
                setAssessment("squat");
                setResult(null);
              }}
            >
              Squat symmetry<span>Compare left / right</span>
            </button>
          </div>
          <ol>
            <li>Place the camera at hip height, about 2–3 m away.</li>
            <li>Wear clothing that makes your knees and ankles visible.</li>
            <li>Move slowly and hold a comfortable position for a moment.</li>
          </ol>
          {!cameraOn ? (
            <button className="camera-button" onClick={startCamera}>
              <FaCamera /> Turn on camera
            </button>
          ) : (
            <div className="camera-actions">
              {assessing ? (
                <button className="stop-button" onClick={stopAssessment}>
                  <FaStop /> Pause analysis
                </button>
              ) : (
                <button
                  className="camera-button"
                  onClick={startAssessment}
                  disabled={loadingModel}
                >
                  {loadingModel ? "Loading pose model..." : "Start form check"}
                </button>
              )}
              <button className="stop-button" onClick={stopCamera}>
                Turn off camera
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="assessment-result" aria-live="polite">
        {result ? (
          <>
            <div
              className={
                result.stable ? "result-icon good" : "result-icon caution"
              }
            >
              <FaCircleCheck />
            </div>
            <div>
              <p className="form-kicker">LIVE SCREEN ESTIMATE</p>
              <h2>{result.primary}</h2>
              <p>{result.detail}</p>
              <div className="estimate-meter">
                <div style={{ width: result.score + "%" }} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="result-icon">
              <FaCamera />
            </div>
            <div>
              <p className="form-kicker">WAITING FOR A POSE</p>
              <h2>Ready when you are.</h2>
              <p>
                {message ||
                  "Turn on the camera, then start the form check to see an on-device movement estimate."}
              </p>
            </div>
          </>
        )}
      </section>
      <p className="form-privacy">
        Privacy: the camera stream is processed in your browser for this session
        only. Rehab Connect does not upload or store your video.
      </p>
    </main>
  );
}
export default FormCheck;
