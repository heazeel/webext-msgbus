import type { InternalMessage } from '../types';
import { encodeConnectionArgs } from '../utils/connection';
import { createPortId, PortName } from '../utils/port';
import { createWaittingReplyQueue } from '../utils/waittingReply';
import type { StatusMessage } from './PortMessage';
import PortMessage from './PortMessage';

/**
 * 提供原子通信能力
 * 创建一个持久的端口，用于当前脚本和后台脚本之间进行通信
 * 所有脚本（除了injectScript）都会与后台脚本建立持久连接
 * 返回与后台脚本建立的端口
 */
class PersistentPort {
  private readonly portId = createPortId();
  private port: chrome.runtime.Port = null!;
  private transferFailedQueue: Array<{ destName: PortName; message: InternalMessage }> = [];
  private waittingReplyQueue = createWaittingReplyQueue();
  private onMessageListeners = new Set<(message: InternalMessage) => void>();
  private onFailureListeners = new Set<(message: InternalMessage) => void>();

  constructor(readonly name: PortName | string = '') {
    this.connect();
  }

  private connect() {
    // 与后台建立连接
    this.port = chrome.runtime.connect({
      name: encodeConnectionArgs({ portName: this.name as PortName, portId: this.portId }),
    });

    // 连接失败，通常是由于未引入 webext-msgbus/background 脚本缺失导致
    if (chrome.runtime.lastError) {
      console.error(
        'Connection failed, normally caused by missing webext-msgbus/background script',
        chrome.runtime.lastError,
      );
      return;
    }

    this.port.onMessage.addListener((msg: StatusMessage) => this.handleMessage(msg));

    /**
     * service worker 会在不使用时终止，需要在连接断开时重新与后台建立连接，以此来唤醒后台脚本
     * https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension?hl=zh-cn
     */
    this.port.onDisconnect.addListener(() => this.connect());

    PortMessage.toBackground(this.port, {
      type: 'sync_with_bg',
      waittingReplyQueue: this.waittingReplyQueue.entries(),
      transferFailedQueue: [...new Set(this.transferFailedQueue.map(({ destName }) => destName))],
    });
  }

  private handleMessage = (msg: StatusMessage) => {
    // console.log(`${decodeConnectionArgs(this.port.name)?.portName || 'content'} 收到消息`, msg);

    switch (msg.status) {
      case 'cannot_transfer': {
        if (!this.transferFailedQueue.some((m) => m.message.messageId === msg.message.messageId)) {
          this.transferFailedQueue.push({
            message: msg.message,
            destName: msg.destination,
          });
        }
        break;
      }

      case 'retry': {
        this.transferFailedQueue = this.transferFailedQueue.filter((failedItem) => {
          if (failedItem.destName === msg.portName) {
            this.postMessage(failedItem.message);
            return false;
          }
          return true;
        });
        break;
      }

      case 'transferring': {
        if (msg.receipt.message.messageType === 'receive') {
          this.waittingReplyQueue.add(msg.receipt);
        }
        break;
      }

      case 'replied': {
        if (msg.message.messageType === 'reply') {
          this.waittingReplyQueue.remove(msg.message.messageId);
        }
        this.onMessageListeners.forEach((cb) => cb(msg.message));
        break;
      }

      case 'terminated': {
        const waittingReplies = this.waittingReplyQueue
          .entries()
          .filter((waitingItem) => msg.portId === waitingItem.to.portId);
        this.waittingReplyQueue.remove(waittingReplies);

        waittingReplies.forEach(({ message }) =>
          this.onFailureListeners.forEach((cb) => cb(message)),
        );
        break;
      }
    }
  };

  public onFailure(cb: (message: InternalMessage) => void) {
    this.onFailureListeners.add(cb);
  }

  public onMessage(cb: (message: InternalMessage) => void): void {
    this.onMessageListeners.add(cb);
  }

  public postMessage(message: any): void {
    PortMessage.toBackground(this.port, {
      type: 'send_to_bg',
      message,
    });
  }
}

export default PersistentPort;
