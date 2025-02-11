import type { JsonValue } from 'type-fest';

import type { PortId, PortInfo, PortName } from './utils/port';

export type RuntimeContext =
  | 'background'
  | 'popup'
  | 'options'
  | 'sidePanel'
  | 'content-script'
  | 'inject-script'
  | 'devtools';

export interface BridgeMessage<T extends JsonValue> {
  sender: PortInfo;
  id: string;
  data: T;
  timestamp: number;
}

export type OnMessageCallback<T extends JsonValue, R = void | JsonValue> = (
  message: BridgeMessage<T>,
) => R | Promise<R>;

export interface InternalMessage {
  origin: PortInfo;
  destination: PortInfo;
  taskId: string; // 异步任务id
  messageID: string;
  messageType: 'send' | 'reply';
  err?: JsonValue;
  data?: JsonValue | void;
  timestamp: number;
}

export type Destination = PortName;
