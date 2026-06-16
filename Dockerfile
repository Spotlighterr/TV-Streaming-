FROM node:20-alpine

# Install FFmpeg and Intel graphics drivers for hardware acceleration
RUN apk add --no-cache \
    ffmpeg \
    intel-media-driver \
    libva-intel-driver \
    libva-utils

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all application source code and scripts
COPY . .

# Make scripts executable
RUN chmod +x *.sh

# Expose port
EXPOSE 8000

# Command to run the application
CMD [ "npm", "start" ]
