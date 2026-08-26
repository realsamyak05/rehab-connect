import { useEffect, useRef, useState } from "react";
import {
  FaCamera,
  FaCircleCheck,
  FaCircleExclamation,
  FaStop,
} from "react-icons/fa6";
import { onAuthStateChanged } from "firebase/auth";
import { arrayUnion, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./FormCheck.css";

const MEDIAPIPE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const CHECKS = {
  knee: { label: "Knee bend", hint: "Target: 100°" },
  squat: { label: "Squat symmetry", hint: "Compare left / right" },
  elbow: { label: "Elbow bend", hint: "Target: 90°" },
  shoulder: { label: "Shoulder lift", hint: "Target: 90°" },
  wrist: { label: "Wrist reach", hint: "Reach to shoulder height" },
};

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
  const leftFlexion = leftKneeAngle === null ? null : Math.round(180 - leftKneeAngle);
  const rightFlexion = rightKneeAngle === null ? null : Math.round(180 - rightKneeAngle);
  const flexion = leftFlexion === null || rightFlexion === null ? null : Math.round((leftFlexion + rightFlexion) / 2);
  const difference = leftFlexion === null || rightFlexion === null ? null : Math.abs(leftFlexion - rightFlexion);
  if (assessment === "knee") {
    if (flexion === null) return null;
    if (flexion < 10) return null;
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
  if (assessment === "squat") {
    if (flexion === null || difference === null) return null;
    if (flexion < 18) return null;
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
  const leftElbowAngle = angleBetween(landmarks[11], landmarks[13], landmarks[15]);
  const rightElbowAngle = angleBetween(landmarks[12], landmarks[14], landmarks[16]);
  if (assessment === "elbow") {
    if (leftElbowAngle === null || rightElbowAngle === null) return null;
    const elbowFlexion = Math.round(((180 - leftElbowAngle) + (180 - rightElbowAngle)) / 2);
    if (elbowFlexion < 10) return null;
    return {
      primary: "Elbow bend estimate: " + elbowFlexion + "°",
      detail: elbowFlexion < 90 ? "Your current screen estimate is about " + elbowFlexion + "°. Your selected target is 90°." : "You are at or beyond the selected 90° screen-estimate target.",
      score: Math.min(100, Math.round((elbowFlexion / 90) * 100)),
      stable: true,
    };
  }
  const leftShoulderLift = angleBetween(landmarks[23], landmarks[11], landmarks[13]);
  const rightShoulderLift = angleBetween(landmarks[24], landmarks[12], landmarks[14]);
  if (leftShoulderLift === null || rightShoulderLift === null) return null;
  const shoulderLift = Math.round((leftShoulderLift + rightShoulderLift) / 2);
  if (assessment === "shoulder") {
    if (shoulderLift < 10) return null;
    return {
      primary: "Shoulder lift estimate: " + shoulderLift + "°",
      detail: shoulderLift < 90 ? "Lift only within a comfortable range. Your selected target is 90°." : "You are at or beyond the selected 90° screen-estimate target.",
      score: Math.min(100, Math.round((shoulderLift / 90) * 100)),
      stable: true,
    };
  }
  const averageWristHeight = ((landmarks[11].y + landmarks[12].y) / 2) - ((landmarks[15].y + landmarks[16].y) / 2);
  const wristReach = Math.round(averageWristHeight * 100);
  if (wristReach < -4) return null;
  return {
    primary: wristReach >= 0 ? "Wrists are at shoulder height or higher" : "Wrists are approaching shoulder height",
    detail: "This tracks wrist reach height, not wrist-joint flexion. A side view with your shoulders and wrists visible gives the clearest screen estimate.",
    score: Math.min(100, Math.max(0, 50 + wristReach * 5)),
    stable: true,
  };
}

function FormCheck() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const frameRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const activePositionRef = useRef(false);
  const repCountRef = useRef(0);
  const lastResultRef = useRef(null);
  const [user, setUser] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [assessment, setAssessment] = useState("knee");
  const [targetReps, setTargetReps] = useState(5);
  const [repCount, setRepCount] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
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

  useEffect(() => onAuthStateChanged(auth, setUser), []);

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

  async function recordAssessment(completedReps, finalResult) {
    if (!user) {
      setMessage(
        "Session complete. Log in next time to save your form-check result.",
      );
      return;
    }

    try {
      await setDoc(
        doc(db, "users", user.uid, "tracker", "main"),
        {
          formAssessments: arrayUnion({
            movement: CHECKS[assessment].label,
            completedReps,
            targetReps,
            summary: finalResult?.primary || "Movement session completed",
            score: finalResult?.score ?? null,
            completedOn: new Date().toISOString(),
          }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMessage("Session complete and result saved to your recovery record.");
    } catch {
      setMessage("Session complete, but the result could not be saved.");
    }
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
    setRepCount(0);
    repCountRef.current = 0;
    activePositionRef.current = false;
    lastResultRef.current = null;
    setSessionComplete(false);
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
          if (estimate) {
            lastResultRef.current = estimate;
            activePositionRef.current = true;
            setMessage("");
          } else if (activePositionRef.current) {
            activePositionRef.current = false;
            const nextRep = repCountRef.current + 1;
            repCountRef.current = nextRep;
            setRepCount(nextRep);
            if (nextRep >= targetReps) {
              window.cancelAnimationFrame(frameRef.current);
              setAssessing(false);
              setSessionComplete(true);
              recordAssessment(nextRep, lastResultRef.current);
              return;
            }
            setMessage("Rep " + nextRep + " recorded. Return to the active position for the next rep.");
          } else {
            setMessage(
              "Move into the selected exercise position and keep the required joints visible.",
            );
          }
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
          Use your camera for screen-based movement estimates. Video stays on
          this device and is not saved.
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
            <span>Position the joints for your selected check in view.</span>
          </div>
          {cameraOn && (
            <span className="camera-chip">
              {assessing ? "● Analyzing on this device" : "Camera preview"}
            </span>
          )}
        </div>
        <div className="assessment-panel">
          <p className="form-kicker">CHOOSE A CHECK</p>
          <label className="assessment-select">
            Movement
            <select
              value={assessment}
              onChange={(event) => {
                stopAssessment();
                setAssessment(event.target.value);
                setResult(null);
                setMessage("Press Start form check when you are ready.");
              }}
            >
              {Object.entries(CHECKS).map(([value, check]) => (
                <option key={value} value={value}>
                  {check.label} — {check.hint}
                </option>
              ))}
            </select>
          </label>
          <label className="assessment-select">
            Reps to record
            <input
              type="number"
              min="1"
              max="30"
              value={targetReps}
              onChange={(event) =>
                setTargetReps(Math.max(1, Number(event.target.value) || 1))
              }
              disabled={assessing}
            />
          </label>
          <p className="rep-progress">
            {repCount} / {targetReps} reps recorded
          </p>
          <ol>
            <li>Place the camera at hip height, about 2–3 m away.</li>
            <li>Keep the required joints in view and move slowly.</li>
            <li>Move into position, then return to rest to count one rep.</li>
            <li>The camera pauses and records your final result at the target.</li>
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
      {sessionComplete && (
        <p className="session-complete">
          Session complete: {repCount} of {targetReps} reps recorded.
        </p>
      )}
      <p className="form-privacy">
        Privacy: the camera stream is processed in your browser for this session
        only. Rehab Connect does not upload or store your video.
      </p>
    </main>
  );
}
export default FormCheck;
