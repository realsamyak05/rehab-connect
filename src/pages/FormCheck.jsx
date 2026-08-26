import { useEffect, useRef, useState } from "react";

import {
  FaArrowRight,
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
  knee: {
    label: "Knee bend",
    hint: "Target: 100°",
  },

  squat: {
    label: "Squat symmetry",
    hint: "Compare left / right",
  },

  elbow: {
    label: "Elbow bend",
    hint: "Target: 90°",
  },

  shoulder: {
    label: "Shoulder lift",
    hint: "Target: 90°",
  },

  wrist: {
    label: "Wrist reach",
    hint: "Reach to shoulder height",
  },
};

const DIAGRAMS = {
  knee: {
    title: "Knee bend",
    instruction: "Stand side-on with your hip, knee, and ankle visible.",
    points: [["Hip", 34, 35], ["Knee", 96, 90], ["Ankle", 154, 38]],
    path: "M34 35 L96 90 L154 38",
    arc: "M78 91 A22 22 0 0 1 108 68",
    angle: "100° target",
  },
  squat: {
    title: "Squat symmetry",
    instruction: "Face the camera so both knees and ankles stay in view.",
    points: [["L hip", 48, 28], ["L knee", 76, 86], ["L ankle", 54, 134], ["R hip", 142, 28], ["R knee", 114, 86], ["R ankle", 136, 134]],
    path: "M48 28 L76 86 L54 134 M142 28 L114 86 L136 134",
    arc: "M65 91 A17 17 0 0 1 82 72 M108 72 A17 17 0 0 1 125 91",
    angle: "Compare both sides",
  },
  elbow: {
    title: "Elbow bend",
    instruction: "Keep your shoulder, elbow, and wrist visible from the side.",
    points: [["Shoulder", 32, 46], ["Elbow", 96, 90], ["Wrist", 153, 48]],
    path: "M32 46 L96 90 L153 48",
    arc: "M78 91 A22 22 0 0 1 108 68",
    angle: "90° target",
  },
  shoulder: {
    title: "Shoulder lift",
    instruction: "Show your hip, shoulder, and raised elbow in the frame.",
    points: [["Hip", 92, 136], ["Shoulder", 92, 78], ["Elbow", 150, 40]],
    path: "M92 136 L92 78 L150 40",
    arc: "M92 99 A22 22 0 0 1 113 65",
    angle: "90° target",
  },
  wrist: {
    title: "Wrist reach",
    instruction: "Face the camera and keep both shoulders and wrists visible.",
    points: [["L shoulder", 48, 54], ["L wrist", 48, 105], ["R shoulder", 142, 54], ["R wrist", 142, 105]],
    path: "M48 54 L48 105 M142 54 L142 105",
    angle: "Shoulder-height reach",
  },
};

function JointDiagram({ assessment, value }) {
  const diagram = DIAGRAMS[assessment];
  const displayValue = Number.isFinite(value) ? Math.round(value) + "°" : diagram.angle;

  return (
    <aside className="joint-diagram" aria-label={diagram.title + " positioning guide"}>
      <div className="diagram-heading">
        <div>
          <p className="form-kicker">POSITIONING GUIDE</p>
          <h2>{diagram.title}</h2>
        </div>
        <strong>{displayValue}</strong>
      </div>
      <svg viewBox="0 0 190 160" role="img" aria-label={diagram.instruction}>
        <path className="diagram-limb" d={diagram.path} />
        {diagram.arc && <path className="diagram-arc" d={diagram.arc} />}
        {assessment === "wrist" && <path className="diagram-guide" d="M25 55 H165" />}
        {diagram.points.map(([label, x, y]) => (
          <g key={label}>
            <circle className="diagram-point" cx={x} cy={y} r="5" />
            <text x={x} y={y - 11}>{label}</text>
          </g>
        ))}
      </svg>
      <p>{diagram.instruction}</p>
    </aside>
  );
}

/*
 * Calculates the angle at `vertex`.
 *
 * Example:
 *
 *       first
 *         \
 *          \
 *        vertex ---- last
 *
 * Returns the angle in degrees.
 */
function angleBetween(first, vertex, last) {
  const firstVector = {
    x: first.x - vertex.x,
    y: first.y - vertex.y,
  };

  const lastVector = {
    x: last.x - vertex.x,
    y: last.y - vertex.y,
  };

  const dot = firstVector.x * lastVector.x + firstVector.y * lastVector.y;

  const length =
    Math.hypot(firstVector.x, firstVector.y) *
    Math.hypot(lastVector.x, lastVector.y);

  if (!length) return null;

  const cosine = Math.max(-1, Math.min(1, dot / length));

  return Math.acos(cosine) * (180 / Math.PI);
}

/*
 * Converts an angle into a 0-100 target score.
 *
 * This is NOT used to decide whether a rep counts.
 *
 * A rep can count at 40°, 60°, 75°, etc.
 * The score simply tells the user how close they got
 * to the selected target.
 */
function targetScore(value, target) {
  if (value === null || value === undefined) return 0;

  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

/*
 * Returns a useful quality description without claiming
 * that a partial movement is invalid.
 */
function targetDetail(value, target) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value >= target) {
    return "You reached or exceeded the selected " + target + "° target.";
  }

  return (
    "You reached about " + value + "°. The selected target is " + target + "°."
  );
}

/*
 * Calculates the movement estimate for the selected assessment.
 */
function poseEstimate(landmarks, assessment) {
  if (!landmarks?.length) return null;

  /*
   * ---------------------------------------------------------
   * KNEE
   * ---------------------------------------------------------
   *
   * MediaPipe:
   * 23 = left hip
   * 25 = left knee
   * 27 = left ankle
   *
   * 24 = right hip
   * 26 = right knee
   * 28 = right ankle
   *
   * A straight leg is approximately 0° flexion.
   * A 90° knee bend is approximately 90° flexion.
   */
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

  const leftFlexion =
    leftKneeAngle === null ? null : Math.round(180 - leftKneeAngle);

  const rightFlexion =
    rightKneeAngle === null ? null : Math.round(180 - rightKneeAngle);

  const flexion =
    leftFlexion === null || rightFlexion === null
      ? null
      : Math.round((leftFlexion + rightFlexion) / 2);

  const difference =
    leftFlexion === null || rightFlexion === null
      ? null
      : Math.abs(leftFlexion - rightFlexion);

  if (assessment === "knee") {
    if (flexion === null) return null;

    return {
      primary: "Knee flexion estimate: " + flexion + "°",

      detail: targetDetail(flexion, 100),

      score: targetScore(flexion, 100),

      stable: true,

      value: flexion,

      target: 100,
    };
  }

  /*
   * ---------------------------------------------------------
   * SQUAT
   * ---------------------------------------------------------
   */
  if (assessment === "squat") {
    if (flexion === null || difference === null) {
      return null;
    }

    if (flexion < 18) return null;

    const lessBentSide = leftFlexion < rightFlexion ? "left" : "right";

    return {
      primary: "Squat symmetry difference: " + difference + "°",

      detail:
        difference < 8
          ? "Your knee bend looks fairly even in this camera view."
          : "Your " +
            lessBentSide +
            " side is bending less in this camera view. " +
            "Slow down and use support if needed.",

      score: Math.max(0, 100 - difference * 5),

      stable: difference < 8,

      value: difference,

      target: 0,
    };
  }

  /*
   * ---------------------------------------------------------
   * ELBOW
   * ---------------------------------------------------------
   *
   * 11 = left shoulder
   * 13 = left elbow
   * 15 = left wrist
   *
   * 12 = right shoulder
   * 14 = right elbow
   * 16 = right wrist
   *
   * We convert the anatomical elbow angle into flexion:
   *
   * straight = ~0°
   * 90° bend = ~90°
   */
  const leftElbowAngle = angleBetween(
    landmarks[11],
    landmarks[13],
    landmarks[15],
  );

  const rightElbowAngle = angleBetween(
    landmarks[12],
    landmarks[14],
    landmarks[16],
  );

  if (assessment === "elbow") {
    if (leftElbowAngle === null || rightElbowAngle === null) {
      return null;
    }

    const leftElbowFlexion = Math.round(180 - leftElbowAngle);

    const rightElbowFlexion = Math.round(180 - rightElbowAngle);

    /*
     * Use the more-bent arm instead of averaging both arms.
     *
     * This is important for unilateral rehabilitation.
     */
    const elbowFlexion = Math.max(leftElbowFlexion, rightElbowFlexion);

    if (elbowFlexion < 5) return null;

    return {
      primary: "Elbow bend estimate: " + elbowFlexion + "°",

      detail: targetDetail(elbowFlexion, 90),

      score: targetScore(elbowFlexion, 90),

      stable: true,

      value: elbowFlexion,

      target: 90,
    };
  }

  /*
   * ---------------------------------------------------------
   * SHOULDER LIFT / ABDUCTION
   * ---------------------------------------------------------
   *
   * MediaPipe:
   * 11 = left shoulder
   * 13 = left elbow
   * 23 = left hip
   *
   * 12 = right shoulder
   * 14 = right elbow
   * 24 = right hip
   *
   * At the shoulder we calculate:
   *
   * hip -> shoulder -> elbow
   *
   * Arm beside body:
   * approximately 0°
   *
   * Arm at shoulder height:
   * approximately 90°
   *
   * IMPORTANT:
   * We DO NOT average the two shoulders.
   *
   * If the patient raises only the left arm:
   *
   * left  = 85°
   * right = 5°
   *
   * averaging would produce:
   *
   * (85 + 5) / 2 = 45°
   *
   * which is wrong for a unilateral shoulder exercise.
   *
   * Instead we use whichever side has the greater lift.
   */
  const leftShoulderLift = angleBetween(
    landmarks[23],
    landmarks[11],
    landmarks[13],
  );

  const rightShoulderLift = angleBetween(
    landmarks[24],
    landmarks[12],
    landmarks[14],
  );

  if (assessment === "shoulder") {
    if (leftShoulderLift === null || rightShoulderLift === null) {
      return null;
    }

    /*
     * Determine which arm is currently more elevated.
     */
    const shoulderLift = Math.round(
      Math.max(leftShoulderLift, rightShoulderLift),
    );

    /*
     * Ignore tiny values caused by normal pose/model noise.
     */
    if (shoulderLift < 5) return null;

    const activeSide = leftShoulderLift >= rightShoulderLift ? "left" : "right";

    return {
      primary: "Shoulder lift estimate: " + shoulderLift + "°",

      detail:
        targetDetail(shoulderLift, 90) +
        " " +
        activeSide.charAt(0).toUpperCase() +
        activeSide.slice(1) +
        " arm detected as the more elevated side.",

      score: targetScore(shoulderLift, 90),

      stable: true,

      value: shoulderLift,

      target: 90,

      side: activeSide,
    };
  }

  /*
   * ---------------------------------------------------------
   * WRIST REACH
   * ---------------------------------------------------------
   */
  const averageWristHeight =
    (landmarks[11].y + landmarks[12].y) / 2 -
    (landmarks[15].y + landmarks[16].y) / 2;

  const wristReach = Math.round(averageWristHeight * 100);

  if (wristReach < -4) return null;

  return {
    primary:
      wristReach >= 0
        ? "Wrists are at shoulder height or higher"
        : "Wrists are approaching shoulder height",

    detail:
      "This tracks wrist reach height, not wrist-joint flexion. " +
      "A side view with your shoulders and wrists visible gives " +
      "the clearest screen estimate.",

    score: Math.min(100, Math.max(0, 50 + wristReach * 5)),

    stable: true,

    value: wristReach,

    target: 0,
  };
}

/*
 * Determines whether the current estimate represents
 * meaningful movement for the selected assessment.
 *
 * This is deliberately LOWER than the target.
 *
 * Example:
 *
 * Shoulder target = 90°
 * Movement threshold = 20°
 *
 * Therefore:
 *
 * 35° movement -> valid rep
 * 60° movement -> valid rep
 * 85° movement -> valid rep
 * 90° movement -> valid rep
 *
 * The score tells us how well the target was reached.
 */
function getMovementThreshold(assessment) {
  switch (assessment) {
    case "shoulder":
      return 20;

    case "elbow":
      return 20;

    case "knee":
      return 20;

    case "squat":
      return 20;

    case "wrist":
      return 5;

    default:
      return 20;
  }
}

/*
 * Determines when the user is considered to have
 * returned to the resting position.
 *
 * We use a smaller value than the movement threshold.
 *
 * This hysteresis prevents:
 *
 * 19° -> 21° -> 19° -> 21°
 *
 * from creating multiple false repetitions.
 */
function getRestThreshold(assessment) {
  switch (assessment) {
    case "shoulder":
      return 15;

    case "elbow":
      return 15;

    case "knee":
      return 15;

    case "squat":
      return 15;

    case "wrist":
      return 0;

    default:
      return 15;
  }
}

function FormCheck() {
  const videoRef = useRef(null);

  const streamRef = useRef(null);

  const landmarkerRef = useRef(null);

  const frameRef = useRef(null);

  const lastUpdateRef = useRef(0);

  /*
   * True when the user has moved far enough
   * to start a repetition.
   */
  const activePositionRef = useRef(false);

  /*
   * Highest movement value reached during
   * the current repetition.
   */
  const currentRepPeakRef = useRef(null);

  /*
   * Stores completed repetitions.
   */
  const repResultsRef = useRef([]);

  const [user, setUser] = useState(null);

  const [cameraOn, setCameraOn] = useState(false);

  const [assessing, setAssessing] = useState(false);

  const [loadingModel, setLoadingModel] = useState(false);

  const [assessment, setAssessment] = useState("knee");

  const [targetReps, setTargetReps] = useState(5);

  const [repCount, setRepCount] = useState(0);

  const [sessionComplete, setSessionComplete] = useState(false);

  const [result, setResult] = useState(null);

  const [savingAngle, setSavingAngle] = useState(false);

  const [message, setMessage] = useState("");

  /*
   * Cleanup.
   */
  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(frameRef.current);

      streamRef.current?.getTracks().forEach((track) => track.stop());

      landmarkerRef.current?.close?.();
    };
  }, []);

  /*
   * Firebase auth.
   */
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  /*
   * Start camera.
   */
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
          width: {
            ideal: 960,
          },
          height: {
            ideal: 540,
          },
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

  /*
   * Pause form assessment without turning
   * the camera off.
   */
  function stopAssessment() {
    window.cancelAnimationFrame(frameRef.current);

    setAssessing(false);

    /*
     * Reset the current incomplete repetition.
     *
     * We don't count an unfinished rep.
     */
    activePositionRef.current = false;

    currentRepPeakRef.current = null;
  }

  /*
   * Save completed session.
   *
   * IMPORTANT:
   * We save actual rep results, not just
   * "perfect" repetitions.
   */
  async function recordAssessment(completedReps, finalResult, repResults) {
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

            reps: repResults,

            completedOn: new Date().toISOString(),
          }),

          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      setMessage("Session complete and result saved to your recovery record.");
    } catch {
      setMessage("Session complete, but the result could not be saved.");
    }
  }

  /*
   * Adds the live joint measurement to the check-in stream used by the
   * dashboard's range-of-motion card and four-week timeline.
   */
  async function addAngleToDashboard() {
    if (!result || !Number.isFinite(result.value)) return;

    if (!user) {
      setMessage("Log in to add this angle to your recovery dashboard.");
      return;
    }

    setSavingAngle(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "tracker", "main"),
        {
          checkIns: arrayUnion({
            date: new Date().toISOString().slice(0, 10),
            rangeOfMotion: Math.round(result.value),
            source: "form-check",
            movement: CHECKS[assessment].label,
            side: result.side || null,
            recordedOn: new Date().toISOString(),
          }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMessage(
        Math.round(result.value) +
          "° added to your dashboard as " +
          CHECKS[assessment].label.toLowerCase() +
          ".",
      );
    } catch {
      setMessage("We could not add that angle to the dashboard. Please try again.");
    } finally {
      setSavingAngle(false);
    }
  }

  /*
   * Turn camera off.
   */
  function stopCamera() {
    stopAssessment();

    streamRef.current?.getTracks().forEach((track) => track.stop());

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);

    setResult(null);

    setRepCount(0);

    setSessionComplete(false);

    repResultsRef.current = [];
  }

  /*
   * Completes one repetition.
   *
   * A repetition is counted based on movement,
   * NOT on reaching the target.
   */
  function completeRep(peakEstimate) {
    if (!peakEstimate) return;

    const nextRep = repResultsRef.current.length + 1;

    const repResult = {
      rep: nextRep,

      value: peakEstimate.value,

      target: peakEstimate.target ?? null,

      score: peakEstimate.score ?? null,

      summary: peakEstimate.primary,

      side: peakEstimate.side ?? null,

      completedOn: new Date().toISOString(),
    };

    repResultsRef.current.push(repResult);

    setRepCount(nextRep);

    setResult({
      ...peakEstimate,

      primary: "Rep " + nextRep + ": " + peakEstimate.primary,

      detail:
        peakEstimate.detail +
        " Rep counted based on movement; " +
        "the target is used for the form score.",
    });

    /*
     * Stop when the requested number
     * of repetitions has been completed.
     */
    if (nextRep >= targetReps) {
      window.cancelAnimationFrame(frameRef.current);

      setAssessing(false);

      setSessionComplete(true);

      recordAssessment(nextRep, peakEstimate, repResultsRef.current);

      return true;
    }

    setMessage(
      "Rep " +
        nextRep +
        " recorded. Return to the active position for the next rep.",
    );

    return false;
  }

  /*
   * Start pose assessment.
   */
  async function startAssessment() {
    if (!cameraOn) return;

    setLoadingModel(true);

    setMessage("");

    setRepCount(0);

    setSessionComplete(false);

    /*
     * Reset rep state.
     */
    activePositionRef.current = false;

    currentRepPeakRef.current = null;

    repResultsRef.current = [];

    setResult(null);

    try {
      if (!landmarkerRef.current) {
        const { FilesetResolver, PoseLandmarker } = await import(
          /* @vite-ignore */
          MEDIAPIPE_URL
        );

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
          },

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

        /*
         * Process approximately every 350 ms.
         */
        if (time - lastUpdateRef.current > 350) {
          lastUpdateRef.current = time;

          const estimate = poseEstimate(detection.landmarks?.[0], assessment);

          /*
           * -------------------------------------------------
           * NO VALID POSE
           * -------------------------------------------------
           */
          if (!estimate) {
            setResult(null);

            setMessage(
              "Move into the selected exercise position and keep the required joints visible.",
            );

            /*
             * Do NOT count a rep simply because
             * the pose disappeared.
             *
             * If the user was halfway through a rep,
             * we wait for them to return to a valid
             * resting position.
             */
          } else {
            /*
             * Show the current live movement estimate.
             */
            setResult(estimate);

            setMessage("");

            const movementThreshold = getMovementThreshold(assessment);

            const restThreshold = getRestThreshold(assessment);

            const value = estimate.value;

            /*
             * -------------------------------------------------
             * START / ACTIVE POSITION
             * -------------------------------------------------
             *
             * Once movement passes the threshold,
             * the repetition becomes active.
             */
            if (!activePositionRef.current && value >= movementThreshold) {
              activePositionRef.current = true;

              /*
               * First peak value of this rep.
               */
              currentRepPeakRef.current = estimate;
            }

            /*
             * -------------------------------------------------
             * UPDATE CURRENT REP PEAK
             * -------------------------------------------------
             *
             * While the rep is active, keep the
             * highest achieved movement.
             */
            if (activePositionRef.current) {
              const currentPeak = currentRepPeakRef.current;

              if (!currentPeak || value > currentPeak.value) {
                currentRepPeakRef.current = estimate;
              }
            }

            /*
             * -------------------------------------------------
             * COMPLETE REP
             * -------------------------------------------------
             *
             * Once the user returns close enough
             * to the resting position, the rep is
             * considered complete.
             *
             * Notice that reaching 90° is NOT required.
             */
            if (activePositionRef.current && value <= restThreshold) {
              const peak = currentRepPeakRef.current;

              activePositionRef.current = false;

              currentRepPeakRef.current = null;

              const completed = completeRep(peak);

              if (completed) {
                return;
              }
            }
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

                setRepCount(0);

                setSessionComplete(false);

                repResultsRef.current = [];

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

          <JointDiagram assessment={assessment} value={result?.value} />

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

            <li>
              Move through your comfortable range, then return to the resting
              position to complete one rep.
            </li>

            <li>
              The target angle is used to score the movement; you do not need to
              reach the target for the rep to count.
            </li>
          </ol>

          {!cameraOn ? (
            <button className="camera-button" onClick={startCamera}>
              <FaCamera />
              Turn on camera
            </button>
          ) : (
            <div className="camera-actions">
              {assessing ? (
                <button className="stop-button" onClick={stopAssessment}>
                  <FaStop />
                  Pause analysis
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
                <div
                  style={{
                    width: result.score + "%",
                  }}
                />
              </div>

              <button
                className="dashboard-angle-button"
                onClick={addAngleToDashboard}
                disabled={savingAngle}
              >
                {savingAngle ? "Adding to dashboard..." : "Add angle to dashboard"}
                {!savingAngle && <FaArrowRight />}
              </button>
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
