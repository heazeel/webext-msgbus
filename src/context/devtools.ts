import MessageRuntime from '../internal/MessageRuntime';
import PersistentPort from '../internal/PersistentPort';

const port = new PersistentPort(`devtools@${chrome.devtools.inspectedWindow.tabId}`);
const messageRuntime = new MessageRuntime('devtools', (message) => port.postMessage(message));
// const messageRuntime = new MessageRuntime('devtools', port.postMessage);

port.onMessage(messageRuntime.handleMessage);

export const { sendMessage, onMessage } = messageRuntime;

export default messageRuntime;
