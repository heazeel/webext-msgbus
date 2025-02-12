import MessageRuntime from '../internal/MessageRuntime';
import PersistentPort from '../internal/PersistentPort';

const port = new PersistentPort('popup');
const messageRuntime = new MessageRuntime('popup', (message) => port.postMessage(message));

port.onMessage(messageRuntime.handleMessage);

port.onFailure((message) => {
  messageRuntime.endTask(message.taskId);
});

export const { sendMessage, onMessage } = messageRuntime;

export default messageRuntime;
