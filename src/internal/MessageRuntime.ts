import { serializeError } from 'serialize-error';
import uuid from 'tiny-uid';

import type {
  BridgeMessage,
  InternalMessage,
  OnMessageCallback,
  RuntimeContext,
  JsonValue,
} from '../types';
import { parseConnectionInfo, PortName } from '../utils/port';

/**
 * 消息通信运行时，会在这里统一处理消息
 * @param thisContext 运行时上下文（devtools | background | popup | options | content-script | inject-script）
 * @param routeMessage 消息发送函数，inject 为 window.postMessage，其他为长链接 port.postMessage
 * @param localMessage 本地消息处理函数, 目前仅 background 中使用
 * @returns
 */
class MessageRuntime {
  private taskQueue = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private onMessageListeners = new Map<string, OnMessageCallback<JsonValue>>();

  constructor(
    private context: RuntimeContext,
    private routeMessage: (msg: InternalMessage) => void,
    private localMessage?: (msg: InternalMessage) => void,
  ) {}

  /**
   * 1. 对于消息接收者，会走入 routeMessage，将 replay 数据发送给发送者
   * 2. 对于消息发送者，会走入 handleReply，调用之前发送消息生成的 Promise的resolve/reject，结束异步任务
   *
   * e.g.
   * 比如 content -> background
   *
   * 1. content 发送消息
   * 生成 Promise，并在taskQueue中存储 taskId 和 Promise的resolve/reject，走入 handleMessage 逻辑，
   * 由于 destination 为 background，所以走入 routeMessage 逻辑，将数据发送给 background
   *
   * 2. background 接收消息
   * 初始消息的 messageType 是 send，走入 handleSend 逻辑中，取出 background 中对应的 onMessage 并执行
   * 然后重新生成传输数据，origin 为 background，destination 为 content，messageType 为 reply，data 为 onMessage 的返回值
   * 继续走入 handleMessage 逻辑，由于 destination 被改为 content，所以走入 routeMessage 逻辑，将数据发送给 content
   *
   * 3. conetent 接收消息
   * PersistenPort.onMessage 接收到backgound消息，交给 handleMessage 处理，由于 destination 为 content，走入 handleReply 逻辑
   * 取出之前生成的 Promise，并调用 resolve/reject 结束异步任务
   */
  public handleMessage = (message: InternalMessage) => {
    // 接收方是自身，即接收消息
    if (message.destination.context === this.context && !message.destination.tabId) {
      this.localMessage?.(message);
      const { taskId, messageId, messageType } = message;

      const handleReply = () => {
        const currentTask = this.taskQueue.get(taskId);
        if (currentTask) {
          const { err, data } = message;
          if (err) {
            currentTask.reject(err);
          } else {
            currentTask.resolve(data);
          }
          this.taskQueue.delete(taskId);
        }
      };

      const handleReceive = async () => {
        let reply: JsonValue = undefined;
        let err: Error | void = undefined;
        let noHandlerFoundError = false;

        try {
          const cb = this.onMessageListeners.get(messageId);

          if (typeof cb === 'function') {
            reply = await cb({
              sender: message.origin,
              id: messageId,
              data: message.data,
              timestamp: message.timestamp,
            } as BridgeMessage<JsonValue>);
          } else {
            noHandlerFoundError = true;
            throw new Error(`在 '${this.context}' 中没有注册接收器来接收 '${messageId}' 的消息`);
          }
        } catch (error) {
          err = error as Error;
        } finally {
          if (err) {
            message.err = serializeError(err);
          }

          this.handleMessage({
            ...message,
            messageType: 'reply',
            data: reply,
            origin: { context: this.context, tabId: null },
            destination: message.origin,
          });

          if (err && !noHandlerFoundError) {
            throw reply;
          }
        }
      };

      switch (messageType) {
        case 'reply':
          return handleReply();
        case 'receive':
          return handleReceive();
      }
    }

    // 发送消息
    return this.routeMessage(message);
  };

  public endTask = (taskId: string) => {
    const currentTask = this.taskQueue.get(taskId);
    if (currentTask) {
      currentTask.reject('task was ended before it could complete');
      this.taskQueue.delete(taskId);
    }
  };

  /**
   * example:
   *
   * ```ts
   * const data = await sendMessage<ReturnData>('message-id', { foo: 'bar' }, 'content-script@tabId');
   * // typeof data === ReturnData
   * ```
   * 发送消息
   * @param messageID 消息标识
   * @param data 消息数据
   * @param destination 消息接收方
   * @returns
   */
  public sendMessage = <ReturnData extends JsonValue>(
    messageId: string,
    data: JsonValue,
    destination: PortName,
  ): Promise<ReturnData> => {
    const destPortInfo = parseConnectionInfo(destination);

    if (!destPortInfo.context) {
      throw new TypeError(
        `${destination} 不属于任何消息接收方(请设置background | content-script@tabId | inject-script@tabId | devtools@tabId | popup | options中的一个)`,
      );
    }

    return new Promise((resolve, reject) => {
      const payload: InternalMessage = {
        origin: { context: this.context, tabId: null },
        destination: destPortInfo,
        taskId: uuid(7),
        messageId,
        messageType: 'receive',
        data,
        timestamp: Date.now(),
      };

      this.taskQueue.set(payload.taskId, { resolve, reject });

      try {
        this.handleMessage(payload);
      } catch (error) {
        this.taskQueue.delete(payload.taskId);
        reject(error);
      }
    });
  };

  /**
   * example:
   *
   * ```ts
   * onMessage<ReceiveData>('message-id', async (message) => {
   *  // typeof message.data === ReceiveData
   *  console.log(message.data);
   * });
   * ```
   * 接收消息
   * @param messageID 消息标识
   * @param callback 消息回调
   * @returns
   */
  public onMessage = <ReceiveData extends JsonValue>(
    messageID: string,
    callback: OnMessageCallback<ReceiveData>,
  ) => {
    this.onMessageListeners.set(messageID, callback as OnMessageCallback<JsonValue>);
    return () => this.onMessageListeners.delete(messageID);
  };
}

export default MessageRuntime;
