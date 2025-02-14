import MessageRuntime from '../internal/MessageRuntime';
import { decodeConnectionArgs } from '../utils/connection';
import { createWaittingReplyQueue } from '../utils/waittingReply';
import { createPortId, formatConnectionInfo, parseConnectionInfo } from '../utils/port';

import type { InternalMessage } from '../types';
import type { PortId, PortName } from '../utils/port';
import type { WaittingReply } from '../utils/waittingReply';

type RequestMessage =
  | {
      type: 'sync_with_bg';
      waittingReplyQueue: Array<WaittingReply>;
      transferFailedQueue: Array<PortName>;
    }
  | {
      type: 'send_to_bg';
      message: InternalMessage;
    };

interface PortConnection {
  port: chrome.runtime.Port;
  portId: PortId;
}

const waittingReplyQueue = createWaittingReplyQueue();
const connectionMap = new Map<PortName, PortConnection>();
const oncePortConnectedCbs = new Map<PortName, Set<() => void>>();
const onceSessionEndCbs = new Map<PortId, Set<() => void>>();

const oncePortConnected = (portName: PortName, cb: () => void) => {
  oncePortConnectedCbs.set(portName, (oncePortConnectedCbs.get(portName) || new Set()).add(cb));

  return () => {
    const su = oncePortConnectedCbs.get(portName);
    if (su?.delete(cb) && su?.size === 0) oncePortConnectedCbs.delete(portName);
  };
};

const onceSessionEnded = (portId: PortId, cb: () => void) => {
  onceSessionEndCbs.set(portId, (onceSessionEndCbs.get(portId) || new Set()).add(cb));
};

const notifyPort = (portName: PortName, portId: PortId | undefined) => {
  const notifications = {
    reply: (message: InternalMessage) => {
      connectionMap.get(portName)?.port.postMessage({
        status: 'replied',
        message,
      });

      return notifications;
    },

    transferring: (receipt: WaittingReply) => {
      connectionMap.get(portName)?.port.postMessage({
        status: 'transferring',
        receipt,
      });

      return notifications;
    },

    cannotTransfer: (destination: PortName, message: InternalMessage) => {
      const sender = connectionMap.get(portName);
      if (sender && sender.portId === portId) {
        sender.port.postMessage({
          status: 'cannot_transfer',
          destination,
          message,
        });
      }

      return notifications;
    },

    retry: (targetPort: PortName) => {
      const canRetry = () => {
        const sender = connectionMap.get(portName);
        const dest = connectionMap.get(targetPort);

        if (sender && dest && sender.portId === portId) {
          sender.port.postMessage({
            status: 'retry',
            portName: targetPort,
          });

          return true;
        }
      };

      if (!canRetry()) {
        const unsub = oncePortConnected(targetPort, canRetry);
        if (portId) onceSessionEnded(portId, unsub);
      }

      return notifications;
    },

    terminate: (portId: PortId) => {
      const conn = connectionMap.get(portName);
      if (conn && conn.portId === portId) {
        conn.port.postMessage({
          status: 'terminated',
          portId,
        });
      }

      return notifications;
    },
  };

  return notifications;
};

const sessPortId = createPortId();

const messageRuntime = new MessageRuntime(
  'background',
  (message) => {
    const { origin, destination } = message;

    if (
      message.origin.context === 'background' &&
      ['content-script', 'inject-script', 'devtools'].includes(message.destination.context) &&
      !message.destination.tabId
    ) {
      throw new TypeError(
        'background 向 content-script、inject-script、devtools 发送消息时, 必须指定tabId',
      );
    }

    // 发送者信息
    // 对于 inject-script 的消息, 发送者上下文是 content-script
    // 因为 inject-script 不能直接通过端口通信，只能通过 content-script 转发
    const senderName = formatConnectionInfo({
      ...origin,
      context: origin.context === 'inject-script' ? 'content-script' : origin.context,
    });

    // 接收者信息
    const destName = formatConnectionInfo({
      ...destination,
      context: destination.context === 'inject-script' ? 'content-script' : destination.context,
      tabId: destination.tabId || origin.tabId,
    });

    // content-script 不感知 tabId
    message.destination.tabId = null;

    const senderConnection = connectionMap.get(senderName) as PortConnection;
    const destConnection = connectionMap.get(destName) as PortConnection;

    // 信息传递
    const transfer = () => {
      notifyPort(destName, destConnection?.portId).reply(message);

      const receipt: WaittingReply = {
        message,
        from: {
          portName: senderName,
          portId: senderConnection?.portId,
        },
        to: {
          portName: destName,
          portId: destConnection?.portId,
        },
      };

      // 接收到发送方的消息，等待回复
      if (message.messageType === 'send') waittingReplyQueue.add(receipt);

      // 接收到答复方的消息，移除等待
      if (message.messageType === 'reply') waittingReplyQueue.remove(message.messageId);

      if (senderConnection) {
        // 通知发送者，消息已经传递
        senderConnection.port.postMessage({
          status: 'transferring',
          receipt,
        });
      }
    };

    if (destConnection?.port) {
      transfer();
      return;
    }

    if (message.messageType === 'send') {
      if (message.origin.context === 'background') {
        oncePortConnected(destName, transfer);
        return;
      }

      if (senderConnection?.port) {
        notifyPort(senderName, senderConnection.portId).cannotTransfer(destName, message);
      }
    }
  },
  (message) => {
    const senderName = formatConnectionInfo({
      ...message.origin,
      ...(message.origin.context === 'inject-script' && { context: 'content-script' }),
    });

    const sender = connectionMap.get(senderName);
    if (sender) {
      const receipt: WaittingReply = {
        message,
        from: {
          portName: senderName,
          portId: sender.portId,
        },
        to: {
          portName: 'background',
          portId: sessPortId,
        },
      };

      notifyPort(senderName, sender.portId).transferring(receipt);
    }
  },
);

chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  const connectionInfo = decodeConnectionArgs(port.name);
  if (!connectionInfo) {
    console.error('wrong connection args: ', port);
    return;
  }

  // 对于content-script，首次创建连接时未指定name，因为tabId是运行时才知道的
  // 但需要在运行时结合port.sender中的tabid重新生成name，这样background才能准确的发送消息到指定的tab上下文中
  connectionInfo.portName ||= formatConnectionInfo({
    context: 'content-script',
    tabId: port.sender?.tab?.id || null,
  });
  const { tabId: linkedTabId } = parseConnectionInfo(connectionInfo.portName);

  connectionMap.set(connectionInfo.portName, {
    portId: connectionInfo.portId,
    port: port,
  });

  console.log('all connections: ', connectionMap);

  onceSessionEnded(connectionInfo.portId, () => {
    const noNeedWait = waittingReplyQueue
      .entries()
      .filter((waittingReply) => waittingReply.to.portId === connectionInfo.portId);

    waittingReplyQueue.remove(noNeedWait);

    noNeedWait.forEach((waittingReply) => {
      if (waittingReply.from.portName === 'background') {
        messageRuntime.endTask(waittingReply.message.taskId);
      } else if (waittingReply.from.portName) {
        notifyPort(waittingReply.from.portName, waittingReply?.from?.portId || undefined).terminate(
          connectionInfo.portId,
        );
      }
    });
  });

  port.onDisconnect.addListener(() => {
    // 特殊情况下，原本的内容脚本的 onDisconnect 会在新的内容脚本的 onConnect 之后被调用
    // 如果直接根据 portName 删除连接，也会将新的内容脚本连接删除，所以需要先进行一下唯一性校验
    if (connectionMap.get(connectionInfo.portName)?.portId === connectionInfo.portId) {
      connectionMap.delete(connectionInfo.portName);
    }

    onceSessionEndCbs.get(connectionInfo.portId)?.forEach((cb) => cb());
    onceSessionEndCbs.delete(connectionInfo.portId);
  });

  port.onMessage.addListener((msg: RequestMessage) => {
    // 从其他脚本发送到 background 的正常消息
    if (msg.type === 'send_to_bg' && msg.message?.origin?.context) {
      msg.message.origin.tabId = linkedTabId;
      messageRuntime.handleMessage(msg.message);
    }

    // 从其他脚本发送到 background 的同步消息
    if (msg.type === 'sync_with_bg') {
      const activePortIds = [...connectionMap.values()].map((conn) => conn.portId);

      const stillWaitting = msg.waittingReplyQueue.filter((waittingReply) =>
        activePortIds.includes(waittingReply.to.portId),
      );
      waittingReplyQueue.add(...stillWaitting);

      oncePortConnectedCbs.get(connectionInfo.portName)?.forEach((cb) => {
        const portConetext = parseConnectionInfo(connectionInfo.portName).context;

        // devtools, popup, options, sidePanel 都可能涉及UI，onMessage 的注册时机会偏后，所以延迟执行
        if (['devtools', 'popup', 'options', 'sidePanel'].includes(portConetext)) {
          setTimeout(() => cb(), 500);
        } else {
          cb();
        }
      });
      oncePortConnectedCbs.delete(connectionInfo.portName);

      // 等待回复的消息，通知连接方已经断开，需要废弃
      msg.waittingReplyQueue
        .filter((waittingReply) => !activePortIds.includes(waittingReply.to.portId))
        .forEach((waittingReply) =>
          notifyPort(connectionInfo.portName, connectionInfo.portId).terminate(
            waittingReply.to.portId,
          ),
        );

      // 未发送的消息，通知连接方可以重新发送
      msg.transferFailedQueue.forEach((failedPortName) =>
        notifyPort(connectionInfo.portName, connectionInfo.portId).retry(failedPortName),
      );

      return;
    }
  });
});

export const { sendMessage, onMessage } = messageRuntime;

export default messageRuntime;
