import MessageRuntime from './internal/MessageRuntime';
import PostMessage from './internal/PostMessage';
import PersistentPort from './internal/PersistentPort';

// content脚本首次与后台建立连接时不需要指定名称，有后台根据sneder信息自动分配
const port = new PersistentPort();

// content-script 与 inject-script 之间需要通过 postMessage 通信
const win = new PostMessage('content-script');

const messageRuntime = new MessageRuntime('content-script', (message) => {
  if (message.destination.context === 'inject-script') {
    win.postMessage(message);
  } else {
    port.postMessage(message);
  }
});

win.onMessage((message: any) => {
  // 这里监听 inject-script 发送的消息，并转发给 background
  messageRuntime.handleMessage(
    Object.assign({}, message, {
      origin: {
        context: 'inject-script',
        tabId: null,
      },
    }),
  );
});

port.onMessage(messageRuntime.handleMessage);

port.onFailure((message) => {
  if (message.origin.context === 'inject-script') {
    win.postMessage({
      type: 'error',
      taskId: message.taskId,
    });

    return;
  }

  messageRuntime.endTask(message.taskId);
});

export const { sendMessage, onMessage } = messageRuntime;
