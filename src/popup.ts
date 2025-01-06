import MessageRuntime from './internal/MessageRuntime';
import PersistentPort from './internal/PersistentPort';

const port = new PersistentPort('popup');
const messageRuntime = new MessageRuntime('popup', (message) => port.postMessage(message));

port.onMessage(messageRuntime.handleMessage);

export const { sendMessage, onMessage } = messageRuntime;
