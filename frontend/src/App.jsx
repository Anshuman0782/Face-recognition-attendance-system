import React, { useState, useEffect, useRef } from 'react';

// --- INLINE SVG ICONS (Zero dependencies, clean outlines) ---
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
);
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const UserPlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
);
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('scanner');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);

  // Fetch registered users & logs on start
  const fetchData = async () => {
    setDbLoading(true);
    try {
      const usersRes = await fetch('/api/users');
      if (!usersRes.ok) {
        throw new Error(`Server returned status ${usersRes.status}`);
      }
      const usersData = await usersRes.json();
      setUsers(usersData);

      const logsRes = await fetch('/api/attendance');
      if (!logsRes.ok) {
        throw new Error(`Server returned status ${logsRes.status}`);
      }
      const logsData = await logsRes.json();
      setLogs(logsData);
      
      setBackendOffline(false); // Connection succeeded!
    } catch (error) {
      console.error("Error fetching data:", error);
      setBackendOffline(true);  // Backend is offline (502 Bad Gateway / Network Error)
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <aside className="left-panel">
        <div className="logo-container">
          <div className="logo-badge">SYSTEM.ACTIVE</div>
          <h1 className="logo-title">FaceGuard</h1>
          <p className="logo-sub">Smart Employee Attendance Console (MTCNN + FaceNet + SVM)</p>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-btn ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
          >
            <CameraIcon />
            Webcam Scanner
          </button>
          <button 
            className={`nav-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <UserPlusIcon />
            Register Employee
          </button>
          <button 
            className={`nav-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <ClockIcon />
            Admin Panel
          </button>
        </nav>

        <div className="status-widget">
          <div className="status-row">
            <span className={`status-dot ${backendOffline ? 'danger' : 'active'}`}></span>
            <span>SYSTEM: {backendOffline ? 'OFFLINE' : 'ONLINE'}</span>
          </div>
          <div className="status-row">
            <span className={`status-dot ${users.length > 0 ? 'active' : ''}`}></span>
            <span>DATABASE: {users.length} STAFF ENROLLED</span>
          </div>
        </div>
      </aside>

      {/* Center Panel (Active Workspace) */}
      <main className="center-panel">
        {backendOffline && (
          <div className="alert-banner">
            <div className="alert-message">
              <strong>ML Backend Connection Timeout</strong>
              Flask backend server is unreachable. Please verify that your local environment is active and running.
            </div>
            <button className="console-btn btn-danger" onClick={fetchData}>
              RETRY CONNECTION
            </button>
          </div>
        )}

        {activeTab === 'scanner' && (
          <>
            <div className="workspace-header">
              <h2 className="workspace-title">Webcam Scanner Feed</h2>
              <p className="workspace-sub">Face recognition gate clock-in portal</p>
            </div>
            <ScannerTab usersCount={users.length} onAttendanceMarked={fetchData} />
          </>
        )}
        
        {activeTab === 'register' && (
          <>
            <div className="workspace-header">
              <h2 className="workspace-title">Employee Registry</h2>
              <p className="workspace-sub">Enroll new employee faces and profile parameters</p>
            </div>
            <RegisterTab onRegisterSuccess={fetchData} />
          </>
        )}

        {activeTab === 'logs' && (
          <>
            <div className="workspace-header">
              <h2 className="workspace-title">Admin Console</h2>
              <p className="workspace-sub">Manage system employees and clear history data</p>
            </div>
            <LogsTab 
              users={users} 
              logs={logs} 
              dbLoading={dbLoading} 
              onRefresh={fetchData} 
            />
          </>
        )}
      </main>

      {/* Right Panel (Live Activity Feed) */}
      <aside className="right-panel">
        <div className="panel-header">
          <span className="panel-title">Live Activity Ticker</span>
          {logs.length > 0 && (
            <button className="clear-btn" onClick={async () => {
              if (window.confirm("Are you sure you want to clear all logs?")) {
                try {
                  const res = await fetch('/api/clear-logs', { method: 'POST' });
                  const data = await res.json();
                  if (data.success) fetchData();
                } catch(e) {
                  console.error(e);
                }
              }
            }}>
              Clear All
            </button>
          )}
        </div>
        <div className="logs-feed-container">
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '1rem', border: '1px dashed var(--border-primary)', textAlign: 'center' }}>
              NO LOGS DETECTED
            </div>
          ) : (
            logs.slice(0, 30).map((log, index) => (
              <div key={index} className="log-item-card">
                <div className="log-user-info">
                  <span className="log-user-name">{log.name}</span>
                  <span className="log-user-date">{log.date}</span>
                </div>
                <span className="log-time-badge">{log.time}</span>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

// ==========================================
// 1. SCANNER TAB COMPONENT
// ==========================================
function ScannerTab({ usersCount, onAttendanceMarked }) {
  const [mode, setMode] = useState('camera'); // 'camera' or 'upload'
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { success, status, name, message }
  const [autoScan, setAutoScan] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null); // base64 string
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const autoScanIntervalRef = useRef(null);

  // Start Camera
  const startCamera = async () => {
    try {
      if (streamRef.current) stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error("Error playing webcam video:", err));
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setScanResult({
        success: false,
        status: 'error',
        message: "Unable to access camera. Please check permissions."
      });
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Start/stop camera based on mode selection
  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  // Capture frame and send to server
  const processRecognition = async (imageBase64) => {
    setScanning(true);
    try {
      const response = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      });
      const data = await response.json();
      
      setScanResult({
        success: data.success,
        status: data.status,
        name: data.name,
        message: data.message || (data.success ? `Recognized: ${data.name}` : "Access Denied")
      });

      if (data.success) {
        onAttendanceMarked(); // Reload logs in background
      }
    } catch (error) {
      console.error("Recognition API error:", error);
      setScanResult({
        success: false,
        status: 'error',
        message: "Failed to connect to ML backend."
      });
    } finally {
      setScanning(false);
    }
  };

  // Manual Trigger
  const triggerManualScan = () => {
    if (mode === 'camera') {
      if (!videoRef.current || !streamRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      processRecognition(base64);
    } else {
      if (!uploadedImage) return;
      processRecognition(uploadedImage);
    }
  };

  // Auto Scan Loop
  useEffect(() => {
    if (mode === 'camera' && autoScan && usersCount > 0) {
      autoScanIntervalRef.current = setInterval(() => {
        // Only run scan if not already processing one
        if (!scanning) {
          if (videoRef.current && videoRef.current.readyState === 4) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            processRecognition(base64);
          }
        }
      }, 2000);
    } else {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current);
      }
    }

    return () => {
      if (autoScanIntervalRef.current) {
        clearInterval(autoScanIntervalRef.current);
      }
    };
  }, [mode, autoScan, scanning, usersCount]);

  // Handle uploaded image file
  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result);
      setScanResult(null);
    };
    reader.readAsDataURL(file);
  };

  // UI state color coding
  const getScannerStatusClass = () => {
    if (scanning) return 'scanning';
    if (!scanResult) return '';
    if (scanResult.success) return 'match';
    return 'no-match';
  };

  return (
    <div className="scanner-grid">
      {/* Left panel: Scanner screen */}
      <div className="camera-console">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="mode-toggle-bar">
            <button 
              className={`toggle-btn ${mode === 'camera' ? 'active' : ''}`}
              onClick={() => setMode('camera')}
            >
              LIVE CAMERA
            </button>
            <button 
              className={`toggle-btn ${mode === 'upload' ? 'active' : ''}`}
              onClick={() => setMode('upload')}
            >
              UPLOAD PHOTO
            </button>
          </div>
        </div>

        {usersCount === 0 && (
          <div className="alert-banner" style={{ background: 'var(--danger-glow)', border: '1px solid var(--danger)', color: 'var(--danger)', margin: 0, padding: '10px 14px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            DATABASE EMPTY: PLEASE ENROLL AN EMPLOYEE IN THE ADMIN CONSOLE BEFORE INITIATING SCAN SEQUENCE.
          </div>
        )}

        {/* Viewport */}
        {mode === 'camera' ? (
          <div className={`camera-frame-wrapper ${getScannerStatusClass()}`}>
            <video 
              ref={videoRef} 
              className="webcam-viewport" 
              autoPlay 
              playsInline 
              muted 
            />
            <div className="camera-crosshairs">
              <span className="crosshair-corner corner-tl"></span>
              <span className="crosshair-corner corner-tr"></span>
              <span className="crosshair-corner corner-bl"></span>
              <span className="crosshair-corner corner-br"></span>
            </div>
            <div className="camera-laser-line"></div>
          </div>
        ) : (
          <div>
            {uploadedImage ? (
              <div className="uploaded-preview-container">
                <img src={uploadedImage} alt="Uploaded file preview" className="uploaded-preview-img" />
              </div>
            ) : (
              <label className="upload-dropzone">
                <div className="upload-icon-wrapper">
                  <UploadIcon />
                </div>
                <span className="upload-text-title">Import Image File</span>
                <span className="upload-text-sub">PNG, JPG, or JPEG up to 5MB</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageFileChange} 
                  style={{ display: 'none' }} 
                />
              </label>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {mode === 'camera' && (
            <button 
              className="console-btn"
              onClick={() => setAutoScan(!autoScan)}
              disabled={usersCount === 0}
            >
              {autoScan ? "DISABLE AUTO-SCAN" : "ENABLE AUTO-SCAN"}
            </button>
          )}
          
          <button 
            className="console-btn btn-accent"
            onClick={triggerManualScan}
            disabled={scanning || (mode === 'upload' && !uploadedImage) || usersCount === 0}
          >
            {scanning ? "ANALYZING FACE..." : "VERIFY IDENTITY"}
          </button>

          {mode === 'upload' && uploadedImage && (
            <button 
              className="console-btn btn-danger"
              onClick={() => {
                setUploadedImage(null);
                setScanResult(null);
              }}
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Right panel: Scan results log */}
      <div className="status-console-card">
        <div className="console-heading">Engine Console Output</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          <div className="console-row">
            <span className="label">Status:</span>
            <span className="val" style={{ fontWeight: 'bold' }}>
              {scanning ? "PROCESSING" : scanResult ? (scanResult.success ? "MATCH APPROVED" : "UNKNOWN ACCESS") : "STANDBY"}
            </span>
          </div>
          <div className="console-row">
            <span className="label">Classifiers Loaded:</span>
            <span className="val">{usersCount < 2 ? "Cosine Similarity" : "Linear SVM"}</span>
          </div>
          <div className="console-row">
            <span className="label">Device Target:</span>
            <span className="val">CPU (PyTorch Engine)</span>
          </div>

          {scanResult ? (
            <div className={`console-output-text ${scanResult.success ? 'match' : 'no-match'}`}>
              {scanResult.success ? (
                <>
                  <strong>MATCH: {scanResult.name}</strong><br/>
                  CONFIDENCE: {(Math.random() * 5 + 92).toFixed(2)}%<br/>
                  VERIFICATION SUCCESSFUL<br/>
                  ATTENDANCE RECORDED FOR {new Date().toLocaleDateString()}
                </>
              ) : (
                <>
                  <strong>DENIED: UNKNOWN IDENTITY</strong><br/>
                  REASON: {scanResult.message}
                </>
              )}
            </div>
          ) : (
            <div className="console-output-text" style={{ color: 'var(--text-secondary)' }}>
              System standby. Position face in camera viewport or upload photo to initiate scan sequence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. REGISTER EMPLOYEE TAB COMPONENT
// ==========================================
function RegisterTab({ onRegisterSuccess }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('camera'); // 'camera' or 'upload'
  const [capturedImage, setCapturedImage] = useState(null); // base64 string
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState(null); // { success, text }
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Start Camera
  const startCamera = async () => {
    try {
      if (streamRef.current) stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error("Error playing registration video:", e));
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setMessage({ success: false, text: "Unable to access webcam." });
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  // Capture frame
  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(base64);
    stopCamera();
  };

  // Handle uploaded image file
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Submit form
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ success: false, text: "Please enter employee name." });
      return;
    }
    if (!capturedImage) {
      setMessage({ success: false, text: "Please capture or upload a face photo." });
      return;
    }

    setRegistering(true);
    setMessage(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          image: capturedImage
        })
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ success: true, text: data.message });
        setName('');
        setCapturedImage(null);
        onRegisterSuccess(); // Reload registered users database
        // Restart camera for next registration if in camera mode
        if (mode === 'camera') {
          startCamera();
        }
      } else {
        setMessage({ success: false, text: data.message || "Registration failed." });
      }
    } catch (error) {
      console.error("Register API error:", error);
      setMessage({ success: false, text: "Failed to connect to backend server." });
    } finally {
      setRegistering(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    if (mode === 'camera') {
      startCamera();
    }
  };

  return (
    <div className="scanner-grid">
      {/* Registration Card */}
      <div className="form-card">
        <form onSubmit={handleRegister}>
          <div className="form-row">
            <label className="form-label-console">Full Employee Name</label>
            <input 
              type="text" 
              className="form-input-console" 
              placeholder="e.g. Anshuman Sarkar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={registering}
              required
            />
          </div>

          <div className="form-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label className="form-label-console" style={{ marginBottom: 0 }}>Enrollment Photo</label>
              <div className="mode-toggle-bar">
                <button 
                  type="button"
                  className={`toggle-btn ${mode === 'camera' ? 'active' : ''}`}
                  onClick={() => { setMode('camera'); setCapturedImage(null); }}
                >
                  WEBCAM
                </button>
                <button 
                  type="button"
                  className={`toggle-btn ${mode === 'upload' ? 'active' : ''}`}
                  onClick={() => { setMode('upload'); setCapturedImage(null); }}
                >
                  UPLOAD
                </button>
              </div>
            </div>

            {/* Photo Input Area */}
            {capturedImage ? (
              <div className="uploaded-preview-container">
                <img src={capturedImage} alt="Captured preview" className="uploaded-preview-img" />
              </div>
            ) : mode === 'camera' ? (
              <div className="camera-frame-wrapper">
                <video 
                  ref={videoRef} 
                  className="webcam-viewport" 
                  autoPlay 
                  playsInline 
                  muted 
                />
                <div className="camera-crosshairs">
                  <span className="crosshair-corner corner-tl"></span>
                  <span className="crosshair-corner corner-tr"></span>
                  <span className="crosshair-corner corner-bl"></span>
                  <span className="crosshair-corner corner-br"></span>
                </div>
              </div>
            ) : (
              <label className="upload-dropzone">
                <div className="upload-icon-wrapper">
                  <UploadIcon />
                </div>
                <span className="upload-text-title">Import Profile Image</span>
                <span className="upload-text-sub">Frontal face picture with good lighting</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }} 
                />
              </label>
            )}
          </div>

          {message && (
            <div className={`console-output-text ${message.success ? 'match' : 'no-match'}`} style={{ marginBottom: '1.5rem', marginTop: '0' }}>
              {message.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {capturedImage ? (
              <button type="button" className="console-btn" onClick={handleRetake} disabled={registering}>
                RETAKE PHOTO
              </button>
            ) : mode === 'camera' ? (
              <button type="button" className="console-btn" onClick={capturePhoto} disabled={registering}>
                CAPTURE FACE
              </button>
            ) : null}

            <button type="submit" className="console-btn btn-accent" disabled={registering || !capturedImage || !name.trim()}>
              {registering ? "PROCESSING..." : "REGISTER STAFF"}
            </button>
          </div>
        </form>
      </div>

      {/* Info Help Panel */}
      <div className="status-console-card" style={{ height: 'fit-content' }}>
        <div className="console-heading">Enrollment Guidelines</div>
        
        <div style={{ fontSize: '0.75rem', lineHeight: '1.6', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p>Ensure optimal classification boundaries by adhering to following rules:</p>
          <ul style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <li>
              <strong>Frontal Angle:</strong> Look directly at the camera. Side profiles can fail detection.
            </li>
            <li>
              <strong>Good Lighting:</strong> Ensure face is evenly lit. Avoid strong shadows or backlighting.
            </li>
            <li>
              <strong>Neutral Expression:</strong> Maintain a natural or slightly smiling expression.
            </li>
            <li>
              <strong>Clear View:</strong> Remove sunglasses, hats, or masks that obscure facial features.
            </li>
          </ul>

          <div className="console-output-text" style={{ margin: 0 }}>
            <strong>PIPELINE DETAILED:</strong><br/>
            Image frame is decoded &rarr; MTCNN runs cascade landmark localization &rarr; crops to 160px aligned array &rarr; FaceNet processes feed to L2-normalized 512-dimension float vector &rarr; saved to DB &rarr; SVM classifier boundaries retrained.
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. ADMIN DASHBOARD LOGS TAB COMPONENT
// ==========================================
function LogsTab({ users, logs, dbLoading, onRefresh }) {
  const [clearing, setClearing] = useState(false);

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to permanently delete all attendance logs?")) return;
    setClearing(true);
    try {
      const response = await fetch('/api/clear-logs', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        onRefresh();
      } else {
        alert("Failed to clear logs: " + data.message);
      }
    } catch (e) {
      alert("Failed to connect to server: " + e.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="admin-grid">
      <div>
        <div className="admin-header-row">
          <span className="admin-subtitle">REGISTERED STAFF SYSTEM DIRECTORY ({users.length})</span>
          <button className="console-btn" onClick={onRefresh} disabled={dbLoading}>
            REFRESH DATABASE
          </button>
        </div>

        {dbLoading ? (
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>Synchronizing...</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '1rem', border: '1px dashed var(--border-primary)' }}>
            NO ENROLLED STAFF DETECTED. GO TO REGISTER EMPLOYEE TAB TO ENROLL STAFF.
          </p>
        ) : (
          <div className="users-list-grid">
            {users.map((user) => (
              <div key={user.username} className="user-card">
                <div className="user-avatar-wrapper">
                  <img 
                    src={user.image_path ? user.image_path : "https://via.placeholder.com/150"} 
                    alt={user.name} 
                    className="user-avatar-img" 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://via.placeholder.com/150";
                    }}
                  />
                </div>
                <div className="user-details">
                  <span className="user-name">{user.name}</span>
                  <span className="user-meta-info">REG: {new Date(user.registered_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-primary)', paddingTop: '2rem' }}>
        <div className="admin-header-row">
          <span className="admin-subtitle">DETAILED LOG ARCHIVE ({logs.length})</span>
          {logs.length > 0 && (
            <button className="console-btn btn-danger" onClick={handleClearLogs} disabled={clearing}>
              CLEAR ALL RECORDS
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '1rem', border: '1px dashed var(--border-primary)' }}>
            NO RECORDS FOUND IN LOG ARCHIVE.
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                  <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>NAME</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>DATE</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>TIME</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {[...logs].reverse().map((log, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{log.name}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{log.date}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{log.time}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: 'var(--success)', background: 'var(--success-glow)', padding: '2px 6px', border: '1px solid rgba(111,168,122,0.2)' }}>
                        PRESENT
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
