# Web Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY apps/web/package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY apps/web/ .

# Expose port
EXPOSE 3000

# Default command (development)
CMD ["npm", "run", "dev"]

# For production, use:
# RUN npm run build
# CMD ["npm", "start"]
