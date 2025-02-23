FROM node:20.10.0

# Set the working directory for the app
WORKDIR /aA

# Copy both directories into the container
COPY dex-backend ./dex-backend
COPY dex-smart-contracts ./dex-smart-contracts

# Change directory to dex-backend
WORKDIR /app/dex-backend

# Install dependencies if you have a package.json
RUN npm install

# Start the server
CMD ["node", "src/server.mjs"]
