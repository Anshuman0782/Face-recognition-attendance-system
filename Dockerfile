# Step 1: Build the React Frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Step 2: Build the Flask Backend & Final Image
FROM python:3.10-slim

# Install system packages required for OpenCV and image operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend dependencies and install them
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application files
COPY backend/ ./backend/

# Copy built React frontend files from the first stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create database directories and empty logs to ensure proper permissions
RUN mkdir -p /app/backend/database/users

# Expose the default port (7860 is used by Hugging Face Spaces)
EXPOSE 7860
ENV PORT=7860

# Run Flask backend server
CMD ["python", "backend/app.py"]
