FROM node:20.10.0

# Set the working directory for the app
WORKDIR /app

# Copy and compile the smart contracts
COPY dex-smart-contracts ./dex-smart-contracts
WORKDIR /app/dex-smart-contracts
RUN npm install && npx hardhat compile

# Copy the backend code and install its dependencies
WORKDIR /app
COPY dex-backend ./dex-backend
WORKDIR /app/dex-backend
RUN npm install

# Start the server
CMD ["node", "src/server.mjs"]
