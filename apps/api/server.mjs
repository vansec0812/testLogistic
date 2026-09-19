import http from 'node:http';
import { createApiHandler, readGatewayConfig } from './gateway.mjs';

const { port } = readGatewayConfig();
const server = http.createServer(createApiHandler());
server.listen(port, () => {
  console.log(`ECont API listening on http://localhost:${port}`);
  console.log(`AI configured: ${Boolean(readGatewayConfig().apiKey)}`);
});
