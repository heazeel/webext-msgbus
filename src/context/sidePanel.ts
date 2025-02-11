import MessageRuntime from '../internal/MessageRuntime';
import PersistentPort from '../internal/PersistentPort';

const port = new PersistentPort(`sidePanel`);
const messageRuntime = new MessageRuntime('sidePanel', (message) => port.postMessage(message));

port.onMessage(messageRuntime.handleMessage);

export const { sendMessage, onMessage } = messageRuntime;

export default messageRuntime;
