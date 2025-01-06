import { formatPortInfo, parsePortInfo, createPortId } from './utils/port';
import type { PortName, PortId } from './utils/port';
import { decodeConnectionArgs } from './utils/connection';
import type { WaittingReply } from './utils/waittingReply';
import { createWaittingReplyQueue } from './utils/waittingReply';
import type { RequestMessage } from './internal/PortMessage';
import PortMessage from './internal/PortMessage';
import type { InternalMessage } from './types';
import MessageRuntime from './internal/MessageRuntime';

interface PortConnection {
  port: chrome.runtime.Port;
  portId: PortId;
}

const waittingReplyQueue = createWaittingReplyQueue();
const connectionMap = new Map<PortName, PortConnection>();
const oncePortConnectedCbs = new Map<PortName, Set<() => void>>();
const onceSessionEndCbs = new Map<PortName, Set<() => void>>();

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
      const recipient = connectionMap.get(portName);
      if (recipient) {
        PortMessage.toExtensionContext(recipient.port, {
          status: 'replied',
          message,
        });
      }

      return notifications;
    },

    transferring: (receipt: WaittingReply) => {
      const sender = connectionMap.get(portName);
      if (sender) {
        PortMessage.toExtensionContext(sender.port, {
          status: 'transferring',
          receipt,
        });
      }

      return notifications;
    },

    cannotTransfer: (destination: PortName, message: InternalMessage) => {
      const sender = connectionMap.get(portName);
      if (sender && sender.portId === portId) {
        PortMessage.toExtensionContext(sender.port, {
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

        if (sender && sender.portId === portId && dest) {
          PortMessage.toExtensionContext(sender.port, {
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
        PortMessage.toExtensionContext(conn.port, {
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
        'background 向 content-script、inject-script、devtools 发送消息时,必须指定tabId',
      );
    }

    // 发送者信息
    // 对于 inject-script 的消息, 发送者上下文是 content-script
    // 因为 inject-script 不能直接通过端口通信，只能通过 content-script 转发
    const senderName = formatPortInfo({
      ...origin,
      context: origin.context === 'inject-script' ? 'content-script' : origin.context,
    });

    // 接收者信息
    const destName = formatPortInfo({
      ...destination,
      context: destination.context === 'inject-script' ? 'content-script' : destination.context,
      tabId: destination.tabId || origin.tabId,
    });

    // content-script 不感知 tabId
    message.destination.tabId = null;

    const senderConnection = connectionMap.get(senderName) as PortConnection;
    const destConnection = connectionMap.get(destName) as PortConnection | undefined;

    // 信息传递
    const transfer = () => {
      notifyPort(destName, destConnection?.portId).reply(message);

      const receipt: WaittingReply = {
        message,
        from: {
          portName: senderName,
          portId: senderConnection.portId,
        },
        to: {
          portName: destName,
          portId: (destConnection as PortConnection).portId,
        },
      };

      if (message.messageType === 'send') waittingReplyQueue.add(receipt);
      if (message.messageType === 'reply') waittingReplyQueue.remove(message.messageID);

      if (senderConnection) {
        PortMessage.toExtensionContext(senderConnection.port, {
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
        notifyPort(senderName, senderConnection.portId)
          .cannotTransfer(destName, message)
          .retry(destName);
      }
    }
  },
  (message) => {
    const senderName = formatPortInfo({
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

/**
 * 监听连接：所有其他脚本的连接都会被这里接收
 */
chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  const currentPort = decodeConnectionArgs(port.name);
  if (!currentPort) return;

  // 对于content-script，首次创建连接时未指定name，因为tabId是运行时才知道的
  // 但需要在运行时结合port.sender中的tabid重新生成name，这样background才能准确的发送消息到指定的tab上下文中
  currentPort.portName ||= formatPortInfo({
    context: 'content-script',
    tabId: port?.sender?.tab?.id || null,
  });
  const { tabId: linkedTabId } = parsePortInfo(currentPort.portName);

  connectionMap.set(currentPort.portName, {
    portId: currentPort.portId,
    port: port,
  });

  console.log('所有连接', connectionMap);

  onceSessionEnded(currentPort.portId, () => {
    const noNeedWait = waittingReplyQueue
      .entries()
      .filter((waittingReply) => waittingReply.to.portId === currentPort.portId);

    waittingReplyQueue.remove(noNeedWait);

    noNeedWait.forEach((waittingReply) => {
      if (waittingReply.from.portName === 'background') {
        messageRuntime.endTask(waittingReply.message.taskId);
      } else if (waittingReply.from.portName) {
        notifyPort(waittingReply.from.portName, waittingReply?.from?.portId || undefined).terminate(
          currentPort.portId,
        );
      }
    });
  });

  port.onDisconnect.addListener(() => {
    // 特殊情况下，原本的内容脚本的 onDisconnect 会在新的内容脚本的 onConnect 之后被调用
    // 如果直接根据 portName 删除连接，也会将新的内容脚本连接删除，所以需要先进行一下唯一性校验
    if (connectionMap.get(currentPort.portName)?.portId === currentPort.portId) {
      connectionMap.delete(currentPort.portName);
    }

    onceSessionEndCbs.get(currentPort.portId)?.forEach((cb) => cb());
    onceSessionEndCbs.delete(currentPort.portId);
  });

  port.onMessage.addListener((msg: RequestMessage) => {
    if (msg.type === 'send_to_bg' && msg.message?.origin?.context) {
      msg.message.origin.tabId = linkedTabId;
      messageRuntime.handleMessage(msg.message);
    }

    if (msg.type === 'sync_with_bg') {
      // 所有正在运行的连接
      const activePortIds = [...connectionMap.values()].map((conn) => conn.portId);

      const stillWaitting = msg.waittingReplyQueue.filter((waittingReply) =>
        activePortIds.includes(waittingReply.to.portId),
      );
      waittingReplyQueue.add(...stillWaitting);

      oncePortConnectedCbs.get(currentPort.portName)?.forEach((cb) => {
        const portConetext = parsePortInfo(currentPort.portName).context;
        // devtools, popup, options 都可能涉及UI，onMessage 的注册时机会偏后，所以延迟执行
        if (['devtools', 'popup', 'options'].includes(portConetext)) {
          setTimeout(() => cb(), 500);
        } else {
          cb();
        }
      });
      oncePortConnectedCbs.delete(currentPort.portName);

      // 等待回复的消息，通知连接方已经断开，需要废弃
      msg.waittingReplyQueue
        .filter((waittingReply) => !activePortIds.includes(waittingReply.to.portId))
        .forEach((waittingReply) =>
          notifyPort(currentPort.portName, currentPort.portId).terminate(waittingReply.to.portId),
        );

      // 未发送的消息，通知连接方可以重新发送
      msg.transferFailedQueue.forEach((failedPortName) =>
        notifyPort(currentPort.portName, currentPort.portId).retry(failedPortName),
      );

      return;
    }
  });
});

export const { sendMessage, onMessage } = messageRuntime;
