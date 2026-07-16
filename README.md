# FaceGuard - Smart Employee Attendance System

An intelligent, real-time employee attendance system built using a **React** frontend and a **Python Flask** backend. The system employs state-of-the-art machine learning models running locally for face recognition, alignment, and classification.

---

## 🧠 Machine Learning Architecture

The system uses three sequential stages of machine learning models to identify employees:

```
[ Input Frame ] 
      │
      ▼
1. MTCNN (Face Detection & Alignment)
      │  └─ Outputs a cropped, aligned 160x160 face image.
      ▼
2. FaceNet (Feature Extraction)
      │  └─ Converts the face image into a normalized 512-dimensional vector.
      ▼
3. SVM Classifier (Matching & Verification)
         └─ Predicts the employee name based on learned boundaries.
            Includes a Cosine Similarity safety guard to filter out strangers.
```

### 1. Face Detection: **MTCNN**
- Uses **Multi-task Cascaded Convolutional Networks** to detect face bounding boxes and locate 5 facial landmarks (eyes, nose, mouth corners).
- The face is aligned, cropped, and resized to $160 \times 160$ pixels. Alignment is crucial to compensate for head tilts, ensuring consistent input to FaceNet.

### 2. Feature Extraction: **FaceNet (InceptionResnetV1)**
- Uses a pre-trained FaceNet model on the **VGGFace2** dataset.
- Converts the cropped face image into a **512-dimensional numerical embedding (vector)**.
- Embeddings are L2-normalized so that matching can be calculated using the vector dot product (Cosine Similarity).

### 3. Classification: **SVM (Support Vector Machine) + Cosine Similarity Guard**
- **Dynamic Training**: An SVM classifier (`scikit-learn` SVC with linear kernel) is trained dynamically in under 5ms every time a new employee is registered.
- **Strangers/Unknown Filter**: 
  - SVM always forces a prediction. To prevent false positives (classifying a stranger as an employee), the backend calculates the **Cosine Similarity** between the scanned face embedding and the predicted employee's registered embedding.
  - If the similarity is $< 0.65$, or if the SVM class probability is $< 0.5$, the system rejects the match and returns **Unknown**.
  - **Single User Fallback**: If only 1 employee is registered, SVM cannot mathematically compile. The system automatically falls back to raw Cosine Similarity matching.

---

## 📁 Directory Structure

```text
employee-attendance/
├── Dockerfile            # Multi-stage Docker config for 1-click cloud hosting
├── package.json          # Root scripts to run both servers concurrently
├── start.js              # Startup orchestration script
├── README.md             # Project documentation (this file)
├── backend/
│   ├── app.py            # Flask API server & ML pipeline (MTCNN, FaceNet, SVM)
│   ├── requirements.txt  # Python ML libraries
│   └── database/
│       ├── users/        # Saved profile pictures
│       ├── users.json    # Employee database (metadata and face embeddings)
│       └── attendance.json # Clock-in logs
└── frontend/
    ├── package.json      # React and Vite dependencies
    ├── vite.config.js    # Local dev API proxy
    ├── index.html        # App entry point
    └── src/
        ├── main.jsx      # React mounting script
        ├── App.jsx       # Single-page interface & Webcam scanner
        └── index.css     # Dark glassmorphic design system
```

---

## 💻 Local Development Setup

### Prerequisites
1. **Node.js**: Installed on your system (v18 or higher).
2. **Python**: Installed on your system (v3.8 to v3.11 recommended).

### Step 1: Install Dependencies
Open your terminal in the `employee-attendance` root directory:

**For Frontend (Node.js):**
```bash
npm install --prefix frontend
```

**For Backend (Python):**
It is highly recommended to install the CPU-only version of PyTorch to save disk space and RAM.
```bash
# Optional: Create a virtual environment
python -m venv venv
venv\Scripts\activate   # On Windows
source venv/bin/activate # On macOS/Linux

# Install CPU PyTorch first (much lighter)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install other requirements
pip install -r backend/requirements.txt
```

### Step 2: Run the App
To run both the React frontend dev server (port 5173) and the Flask backend (port 5000) concurrently with a single command, run:
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## ☁️ How to Host for Free (Hugging Face Spaces)

Hugging Face Spaces is the best option for hosting this project because:
- It is 100% free.
- It provides **16GB RAM** and **2 vCPUs** (more than enough for PyTorch).
- It provides **HTTPS** automatically, which is a browser requirement for web camera permissions.

### Deployment Steps:
1. Create a free account at [Hugging Face](https://huggingface.co/).
2. Click on your profile picture -> **New Space**.
3. Choose a name (e.g. `employee-attendance`).
4. Select **Docker** as the SDK (instead of Streamlit/Gradio).
5. Choose **Blank** template.
6. Set space visibility to **Public** (or Private).
7. Hugging Face will create a repository and show Git push instructions. Clone the space, copy all these project files into the cloned folder, commit, and push:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push
   ```
8. Hugging Face will automatically read the `Dockerfile`, build the React frontend, compile the Python backend, download the FaceNet weights, and host your application with SSL/HTTPS!

---

## ⚙️ Key System Features
- **Anti-Spam Logs**: Users cannot log attendance twice within 60 seconds (prevents duplicate logs while standing in front of the camera).
- **Dual Enrollment Modes**: Register users using either the live webcam or by uploading a profile photo.
- **Real-Time Feed Overlays**: Highlights the camera scan boundaries dynamically using customized glassmorphic states (Match, Unknown, Scanning).
- **Local Databases**: Stores all logs and users in lightweight JSON files. No databases to install or configure!
