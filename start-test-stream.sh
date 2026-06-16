#!/bin/sh

# Default relay server URL
RELAY_URL=${1:-"http://localhost:8000/feed/test"}

echo "Starting MPEG-TS Test Stream..."
echo "Pushing stream to: $RELAY_URL"
echo "Press Ctrl+C to stop."

# Attempt Intel VA-API hardware encoding first
echo "Trying Intel VA-API hardware encoding..."
ffmpeg -init_hw_device vaapi=va:/dev/dri/renderD128 -filter_hw_device va -re \
  -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=440 \
  -vf 'format=nv12,hwupload' \
  -c:v h264_vaapi \
  -c:a aac -b:a 128k \
  -f mpegts "$RELAY_URL"

# Fallback to CPU software encoding if VA-API fails
if [ $? -ne 0 ]; then
  echo "⚠️ Intel VA-API failed or not supported. Falling back to CPU (libx264)..."
  ffmpeg -re \
    -f lavfi -i testsrc=size=1280x720:rate=30 \
    -f lavfi -i sine=frequency=440 \
    -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -f mpegts "$RELAY_URL"
fi
