import express from 'express';
import processEvent from './eventHandler.mjs';
import { factoryContract } from './config.mjs';
import { WebSocketServer } from 'ws';

const app = express();
const port = process.env.PORT || 3001;
const wsPort = process.env.WS_PORT || 3003;

// Set up WebSocket server
const wss = new WebSocketServer({ port: wsPort });

wss.on('connection', (ws) => {
  console.log('Client connected');
});

// Broadcast function to send message to all connected clients
const broadcast = (message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
};

// Listen for events
factoryContract.on('NeedsMetadata', async (tokenId, owner, contractAddress) => {
  console.log(`NeedsMetadata event received for token ${tokenId} at contract ${contractAddress} for owner ${owner}. Processing...`);
  await processEvent(contractAddress, tokenId);

  // Convert BigInt to string before broadcasting
  const message = {
    tokenId: tokenId.toString(),
    owner,
    contractAddress
  };
  broadcast(JSON.stringify(message));

  // call AI generator
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(`WebSocket server listening at ws://localhost:${wsPort}`);
});
