import type { InternalMessage } from '../types';
import type { PortId, PortName } from '../utils/port';
import type { WaittingReply } from '../utils/waittingReply';

export type StatusMessage =
  | {
      status: 'cannot_transfer';
      message: InternalMessage;
      destination: PortName;
    }
  | {
      status: 'retry';
      portName: PortName;
    }
  | {
      status: 'transferring';
      receipt: WaittingReply;
    }
  | {
      status: 'replied';
      message: InternalMessage;
    }
  | {
      status: 'terminated';
      portId: PortId;
    };

export type RequestMessage =
  | {
      type: 'sync_with_bg';
      waittingReplyQueue: Array<WaittingReply>;
      transferFailedQueue: Array<PortName>;
    }
  | {
      type: 'send_to_bg';
      message: InternalMessage;
    };

class PortMessage {
  // 由其他脚本发送至 background
  static toBackground(port: chrome.runtime.Port, message: RequestMessage) {
    return port.postMessage(message);
  }

  // 由 background 发送至其他脚本
  static toExtensionContext(port: chrome.runtime.Port, message: StatusMessage) {
    return port.postMessage(message);
  }
}

export default PortMessage;
