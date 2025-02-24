import type { PortId, PortInfo, PortName } from './utils/port';

type JsonPrimitive = string | number | boolean | null | undefined;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

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

export type OnMessageCallback<T extends JsonValue> = (
  message: BridgeMessage<T>,
) => void | JsonValue | Promise<void | JsonValue>;

export interface InternalMessage {
  origin: PortInfo; // 消息发送方
  destination: PortInfo; // 消息接收方
  taskId: string; // 异步任务id
  messageId: string; // 消息标识
  messageType: 'send' | 'reply';
  err?: any;
  data?: void | JsonValue;
  timestamp: number;
}

export type Destination = PortName;
