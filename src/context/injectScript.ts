import MessageRuntime from '../internal/MessageRuntime';
import PostMessagePort from '../internal/PostMessagePort';

// inject-script 与 content-script 之间需要通过 postMessage 通信
const win = new PostMessagePort('inject-script');

const messageRuntime = new MessageRuntime('inject-script', (message) => win.postMessage(message));

win.onMessage((msg) => {
  if ('type' in msg) {
    messageRuntime.endTask(msg.taskId);
  } else {
    messageRuntime.handleMessage(msg);
  }
});

export const { sendMessage, onMessage } = messageRuntime;

export default messageRuntime;
