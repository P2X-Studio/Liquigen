FROM node:20.10.0

# Declare build arguments matching the names in your DO app settings
ARG MAINNET_RPC
ARG TESTNET_RPC
ARG MAINNET_RPC_CONDUIT
ARG TESTNET_RPC_CONDUIT
ARG DEX_FACTORY
ARG LIQUIGEN_FACTORY
ARG PRIVATE_KEY

# Set environment variables from the build arguments
ENV MAINNET_RPC=${MAINNET_RPC}
ENV TESTNET_RPC=${TESTNET_RPC}
ENV MAINNET_RPC_CONDUIT=${MAINNET_RPC_CONDUIT}
ENV TESTNET_RPC_CONDUIT=${TESTNET_RPC_CONDUIT}
ENV DEX_FACTORY=${DEX_FACTORY}
ENV LIQUIGEN_FACTORY=${LIQUIGEN_FACTORY}
ENV PRIVATE_KEY=${PRIVATE_KEY}

# Set the working directory for the app
WORKDIR /app

# Copy and compile the smart contracts
COPY dex-smart-contracts ./dex-smart-contracts
WORKDIR /app/dex-smart-contracts
RUN npm install && npx hardhat compile

# Copy the backend code and install its dependencies
WORKDIR /app
COPY dex-backend ./dex-backend
WORKDIR /app/dex-backend/src
RUN npm install

# Start the server
CMD ["node", "src/server.mjs"]
