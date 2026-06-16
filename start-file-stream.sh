#!/bin/sh

# Default arguments
FILE_PATH=${1:-"/app/videos/input.mp4"}
RELAY_URL=${2:-"http://localhost:8000/feed/vtv1"}

if [ ! -f "$FILE_PATH" ]; then
  echo "Error: Video file not found at $FILE_PATH"
  echo "Please place a video file in the 'videos' directory and name it 'input.mp4'"
  exit 1
fi

echo "Starting MPEG-TS File Stream in loop..."
echo "Streaming file: $FILE_PATH"
echo "Pushing stream to: $RELAY_URL"
echo "Press Ctrl+C to stop."

# Attempt Intel VA-API hardware decoding and encoding
echo "Trying Intel VA-API hardware decoding & encoding..."
ffmpeg -hwaccel vaapi -hwaccel_device /dev/dri/renderD128 -hwaccel_output_format vaapi \
  -re -stream_loop -1 -i "$FILE_PATH" \
  -c:v h264_vaapi \
  -c:a aac -b:a 128k \
  -f mpegts "$RELAY_URL"

# Fallback to software CPU decoding/encoding if VA-API fails
if [ $? -ne 0 ]; then
  echo "⚠️ Intel VA-API failed or not supported. Falling back to CPU (software)..."
  ffmpeg -re -stream_loop -1 -i "$FILE_PATH" \
    -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -f mpegts "$RELAY_URL"
fi
