// Web Worker entry: shot simulation runs here so the render thread never waits
// on it. SimWorkerClient is the other end.
import { handleSimRequest } from './simRequest.js';

self.onmessage = (e) => {
  const { reply, transfer } = handleSimRequest(e.data);
  self.postMessage(reply, transfer);
};
