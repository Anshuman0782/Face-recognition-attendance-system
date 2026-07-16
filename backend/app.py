import os
import json
import base64
import io
import datetime
import numpy as np
import torch
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from PIL import Image
from facenet_pytorch import MTCNN, InceptionResnetV1
from sklearn.svm import SVC
from pymongo import MongoClient

app = Flask(__name__)
# Enable CORS for development so React frontend (port 5173) can query Python backend (port 5000)
CORS(app)

# Define directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BASE_DIR, "database")
USERS_DIR = os.path.join(DATABASE_DIR, "users")
USERS_JSON = os.path.join(DATABASE_DIR, "users.json")
ATTENDANCE_JSON = os.path.join(DATABASE_DIR, "attendance.json")

# MongoDB connection setup
MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://anshumansarkar600_db_user:facerecognition0782@cluster0.82jp7zi.mongodb.net/attendance_db?appName=Cluster0")
use_mongodb = False
db = None

try:
    # Trigger connection with 2-second timeout to avoid long hanging
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000, tlsAllowInvalidCertificates=True)
    client.server_info()  # Forces a ping/connection check
    
    # Try to extract the default database name from URI, fallback if admin or empty
    try:
        db = client.get_default_database()
    except Exception:
        db = client['attendance_db']
        
    if db.name == 'admin' or not db.name:
        db = client['attendance_db']
        
    print(f"Connected to MongoDB database: {db.name}")
    use_mongodb = True
    
    # Ensure indexes for performance and constraint checking
    db.users.create_index("username", unique=True)
    db.attendance.create_index([("name", 1), ("timestamp", -1)])
except Exception as e:
    print(f"MongoDB connection failed: {e}")
    print("Falling back to local JSON database storage.")
    use_mongodb = False

# Ensure directories exist
os.makedirs(USERS_DIR, exist_ok=True)

# Initialize PyTorch Models
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# MTCNN for face detection & cropping (uses default CPU weights)
mtcnn = MTCNN(
    image_size=160,
    margin=10,
    keep_all=False,
    select_largest=True,
    post_process=True,
    device=device
)

# InceptionResnetV1 pre-trained on VGGFace2 (FaceNet equivalent)
resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)

# Global variables for classifier
svm_model = None
svm_classes = []
registered_users = {}

def save_users_json():
    if not use_mongodb:
        with open(USERS_JSON, 'w') as f:
            json.dump(registered_users, f, indent=4)

def load_database():
    global registered_users, use_mongodb
    registered_users = {}
    
    if use_mongodb:
        try:
            # Load users from MongoDB (exclude the heavy image_data field to save memory)
            for user in db.users.find({}, {"image_data": 0}):
                registered_users[user["username"]] = {
                    "name": user["name"],
                    "embedding": user["embedding"],
                    "registered_at": user["registered_at"],
                    "image_path": user.get("image_path", "")
                }
            print(f"Loaded {len(registered_users)} registered users from MongoDB.")
        except Exception as e:
            print(f"Error loading users from MongoDB: {e}")
            print("Falling back to local JSON database storage.")
            use_mongodb = False
            load_database()
            return
    else:
        if os.path.exists(USERS_JSON):
            try:
                with open(USERS_JSON, 'r') as f:
                    registered_users = json.load(f)
                print(f"Loaded {len(registered_users)} registered users from local JSON.")
            except Exception as e:
                print(f"Error loading users.json: {e}")
                registered_users = {}
        else:
            registered_users = {}
            save_users_json()
            
    train_classifier()

def train_classifier():
    """
    Trains the SVM classifier using face embeddings from registered_users.
    Requires at least 2 unique users to train.
    """
    global svm_model, svm_classes, registered_users
    svm_model = None
    svm_classes = []

    if len(registered_users) < 2:
        print("Fewer than 2 users registered. SVM training skipped; using Cosine Similarity fallback.")
        return

    X = []
    y = []
    classes = list(registered_users.keys())

    for idx, username in enumerate(classes):
        user_data = registered_users[username]
        embedding = user_data.get('embedding')
        if embedding is not None:
            X.append(np.array(embedding))
            y.append(idx)

    # Ensure we actually have at least 2 unique classes in the training data
    if len(np.unique(y)) < 2:
        print("Fewer than 2 classes with embeddings. SVM training skipped.")
        return

    try:
        # Linear kernel works very well for high-dimensional normalized face embeddings.
        # We disable probability calibration to allow training on tiny datasets (e.g. 2 samples) without cross-validation issues.
        svm = SVC(kernel='linear')
        svm.fit(X, y)
        svm_model = svm
        svm_classes = classes
        print("SVM Classifier trained successfully!")
    except Exception as e:
        print(f"Error training SVM: {e}")

def get_face_embedding(pil_img):
    """
    Detects a face, crops/aligns it, and extracts the 512-d normalized FaceNet embedding.
    """
    # MTCNN detects, crops, and normalizes the face to 160x160
    face = mtcnn(pil_img)
    if face is None:
        return None, "No face detected in the image."

    # Get face descriptor embedding
    with torch.no_grad():
        # face shape: [3, 160, 160] -> [1, 3, 160, 160]
        embedding = resnet(face.unsqueeze(0).to(device)).cpu().numpy()[0]

    # Normalize the embedding vector to unit length (L2 norm = 1)
    # This enables us to use Dot Product directly as Cosine Similarity
    embedding = embedding / np.linalg.norm(embedding)
    return embedding, None

def decode_base64_image(base64_str):
    """
    Converts a base64 encoded image string from the React frontend into a PIL RGB Image.
    """
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    img_data = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(img_data)).convert('RGB')

def log_attendance(name):
    """
    Logs attendance (date, time) to MongoDB (or attendance.json fallback).
    Prevents double logs for the same user within 1 minute.
    """
    now = datetime.datetime.now()
    new_log = {
        "name": name,
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "timestamp": now.isoformat()
    }

    if use_mongodb:
        try:
            # Anti-duplicate check using query on index
            last_log = db.attendance.find_one(
                {"name": name},
                sort=[("timestamp", -1)]
            )
            is_duplicate = False
            if last_log:
                log_time = datetime.datetime.fromisoformat(last_log["timestamp"])
                if (now - log_time).total_seconds() < 60:
                    is_duplicate = True

            if not is_duplicate:
                db.attendance.insert_one(new_log)
                return True, "Attendance marked."
            else:
                return False, "Attendance already marked in the last minute."
        except Exception as e:
            print(f"Error logging attendance to MongoDB: {e}")
            # fall through to JSON backend if Mongo write fails

    # Fallback to local JSON files
    logs = []
    if os.path.exists(ATTENDANCE_JSON):
        try:
            with open(ATTENDANCE_JSON, 'r') as f:
                logs = json.load(f)
        except Exception:
            logs = []

    is_duplicate = False
    for log in reversed(logs):
        log_time = datetime.datetime.fromisoformat(log["timestamp"])
        if (now - log_time).total_seconds() > 300:
            break
        if log["name"] == name and (now - log_time).total_seconds() < 60:
            is_duplicate = True
            break

    if not is_duplicate:
        logs.append(new_log)
        try:
            with open(ATTENDANCE_JSON, 'w') as f:
                json.dump(logs, f, indent=4)
            return True, "Attendance marked."
        except Exception as e:
            return False, f"Server save error: {str(e)}"
    else:
        return False, "Attendance already marked in the last minute."

# --- API ENDPOINTS ---

@app.route('/api/users', methods=['GET'])
def get_users():
    users_list = []
    for username, data in registered_users.items():
        users_list.append({
            "username": username,
            "name": data["name"],
            "registered_at": data["registered_at"],
            "image_path": data.get("image_path", "")
        })
    return jsonify(users_list)

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    if use_mongodb:
        try:
            logs = list(db.attendance.find({}, {"_id": 0}))
            return jsonify(logs)
        except Exception as e:
            print(f"Error querying attendance from MongoDB: {e}")
            # fall through to JSON fallback if MongoDB query fails

    logs = []
    if os.path.exists(ATTENDANCE_JSON):
        try:
            with open(ATTENDANCE_JSON, 'r') as f:
                logs = json.load(f)
        except Exception:
            logs = []
    return jsonify(logs)

@app.route('/api/clear-logs', methods=['POST'])
def clear_logs():
    if use_mongodb:
        try:
            db.attendance.delete_many({})
            return jsonify({"success": True, "message": "Attendance logs cleared successfully."})
        except Exception as e:
            print(f"Error clearing attendance in MongoDB: {e}")
            # fall through to JSON if MongoDB fails

    try:
        with open(ATTENDANCE_JSON, 'w') as f:
            json.dump([], f)
        return jsonify({"success": True, "message": "Attendance logs cleared successfully."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/register', methods=['POST'])
def register():
    """
    Registers a new employee by computing and storing their face embedding, 
    and saving their photo.
    """
    global registered_users
    data = request.json
    if not data or 'name' not in data or 'image' not in data:
        return jsonify({"success": False, "message": "Missing name or image parameter."}), 400

    name = data['name'].strip()
    if not name:
        return jsonify({"success": False, "message": "Name cannot be empty."}), 400

    # Create safe directory and filename
    safe_name = "".join([c if c.isalnum() else "_" for c in name]).lower()
    img_filename = "profile.jpg"

    try:
        # Extract base64 image data and decode
        image_field = data['image']
        if ',' in image_field:
            base64_str = image_field.split(',')[1]
        else:
            base64_str = image_field
        img_bytes = base64.b64decode(base64_str)

        # Load image for ML processing
        pil_img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        embedding, error = get_face_embedding(pil_img)
        if error:
            return jsonify({"success": False, "message": error}), 400

        registered_at = datetime.datetime.now().isoformat()
        image_path = f"/api/database/users/{safe_name}/{img_filename}"

        if use_mongodb:
            try:
                # Save to MongoDB
                user_doc = {
                    "username": safe_name,
                    "name": name,
                    "embedding": embedding.tolist(),
                    "registered_at": registered_at,
                    "image_path": image_path,
                    "image_data": img_bytes
                }
                db.users.update_one({"username": safe_name}, {"$set": user_doc}, upsert=True)
            except Exception as e:
                print(f"Error saving user to MongoDB: {e}")
                # if MongoDB write fails, fall back to disk/JSON saving

        # Save photo to local disk as fallback / local copy
        user_folder = os.path.join(USERS_DIR, safe_name)
        os.makedirs(user_folder, exist_ok=True)
        img_path = os.path.join(user_folder, img_filename)
        pil_img.save(img_path, format="JPEG")

        # Update local in-memory representation
        registered_users[safe_name] = {
            "name": name,
            "embedding": embedding.tolist(),
            "registered_at": registered_at,
            "image_path": image_path
        }
        
        if not use_mongodb:
            save_users_json()

        # Retrain SVM on the new user dataset
        train_classifier()

        return jsonify({
            "success": True, 
            "message": f"Successfully registered {name}!",
            "username": safe_name
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@app.route('/api/recognize', methods=['POST'])
def recognize():
    """
    Recognizes a face in the provided image using SVM (if >= 2 users) 
    or Cosine Similarity fallback.
    """
    global svm_model, svm_classes, registered_users
    data = request.json
    if not data or 'image' not in data:
        return jsonify({"success": False, "message": "Missing image parameter."}), 400

    if not registered_users:
        return jsonify({
            "success": False, 
            "status": "no_users", 
            "message": "No employees registered. Register a user in the Admin Panel first."
        }), 400

    try:
        pil_img = decode_base64_image(data['image'])
        scanned_emb, error = get_face_embedding(pil_img)
        if error:
            return jsonify({"success": False, "status": "no_face", "message": error}), 400

        matched_username = None
        match_confidence = 0.0

        # CASE 1: Fallback (Only 1 user registered, SVM cannot run)
        if len(registered_users) < 2 or svm_model is None:
            # Find the best cosine similarity match
            best_sim = -1.0
            best_user = None

            for username, user_data in registered_users.items():
                user_emb = np.array(user_data["embedding"])
                # Since embeddings are normalized, dot product is cosine similarity
                similarity = np.dot(scanned_emb, user_emb)
                if similarity > best_sim:
                    best_sim = similarity
                    best_user = username

            # Threshold check (Cosine Similarity threshold of 0.50 is the optimal sweet spot for FaceNet)
            if best_user and best_sim > 0.50:
                matched_username = best_user
                match_confidence = best_sim
            else:
                return jsonify({
                    "success": False, 
                    "status": "unknown", 
                    "message": "Face unrecognized.",
                    "best_similarity": float(best_sim) if best_user else 0.0
                }), 200

        # CASE 2: Standard SVM Classifier + Cosine Similarity Guard
        else:
            # Predict index class directly using SVM
            pred_idx = svm_model.predict([scanned_emb])[0]
            predicted_username = svm_classes[pred_idx]

            # Cosine similarity validation to avoid SVM false positives
            target_emb = np.array(registered_users[predicted_username]["embedding"])
            similarity = np.dot(scanned_emb, target_emb)

            # Match rule: predicted user must be an actual visual match (Cosine similarity > 0.50)
            if similarity > 0.50:
                matched_username = predicted_username
                match_confidence = similarity
            else:
                return jsonify({
                    "success": False, 
                    "status": "unknown", 
                    "message": "Face unrecognized.",
                    "cosine_similarity": float(similarity)
                }), 200

        # Mark attendance if matched
        display_name = registered_users[matched_username]["name"]
        logged_success, log_msg = log_attendance(display_name)

        return jsonify({
            "success": True,
            "status": "match",
            "name": display_name,
            "username": matched_username,
            "confidence": float(match_confidence),
            "attendance_logged": logged_success,
            "attendance_message": log_msg
        })

    except Exception as e:
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

# Serve static uploaded files from backend database
@app.route('/api/database/users/<username>/<filename>')
def serve_user_file(username, filename):
    safe_username = "".join([c if c.isalnum() else "_" for c in username]).lower()
    
    if use_mongodb:
        try:
            user = db.users.find_one({"username": safe_username}, {"image_data": 1})
            if user and "image_data" in user:
                return send_file(io.BytesIO(user["image_data"]), mimetype='image/jpeg')
        except Exception as e:
            print(f"Error serving user image from MongoDB: {e}")
            # fall through to disk serving if database lookup fails
            
    return send_from_directory(os.path.join(USERS_DIR, safe_username), filename)

# Serve static React frontend in production
FRONTEND_DIST_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"success": False, "message": "API route not found."}), 404
        
    if os.path.exists(FRONTEND_DIST_DIR) and path and os.path.exists(os.path.join(FRONTEND_DIST_DIR, path)):
        return send_from_directory(FRONTEND_DIST_DIR, path)
        
    if os.path.exists(FRONTEND_DIST_DIR):
        return send_from_directory(FRONTEND_DIST_DIR, "index.html")
        
    return "ML Backend API Server is Running. Frontend dist directory not found. Please build React frontend."

# Initialize database on start
load_database()

if __name__ == '__main__':
    # Hugging Face Spaces and other platforms run on port 7860 by default or via environment variables
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
