import type { InternalMessage } from '../types';

interface PortWontRespondError {
  type: 'error';
  taskId: string;
}

const portInitMsg = 'webext-msgbus-port-init';
const portInitedMsg = 'webext-msgbus-port-inited';

class PostMessage {
  private portPromise: Promise<MessagePort>;
  private onMessageCallback: ((msg: InternalMessage | PortWontRespondError) => void) | undefined;

  constructor(private readonly context: 'inject-script' | 'content-script') {
    this.portPromise = this.initPortPromise();
  }

  private initPortPromise = () => {
    return new Promise<MessagePort>((resolve) => {
      const acceptMessagingPort = (event: MessageEvent) => {
        const {
          data: { msg, context },
          ports,
        } = event;
        if (msg === portInitMsg && context !== this.context) {
          window.removeEventListener('message', acceptMessagingPort);

          ports[0].onmessage = (event: MessageEvent) => this.onMessageCallback?.(event.data);
          ports[0].postMessage(portInitedMsg);

          return resolve(ports[0]);
        }
      };

      const offerMessagingPort = () => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event: MessageEvent) => {
          if (event.data === portInitedMsg) {
            window.removeEventListener('message', acceptMessagingPort);

            return resolve(channel.port1);
          }

          this.onMessageCallback?.(event.data);
        };

        window.postMessage(
          {
            msg: portInitMsg,
            context: this.context,
          },
          '*',
          [channel.port2],
        );
      };

      window.addEventListener('message', acceptMessagingPort);

      if (this.context === 'inject-script') {
        setTimeout(offerMessagingPort, 0);
      } else {
        offerMessagingPort();
      }
    });
  };

  public onMessage = (cb: typeof this.onMessageCallback) => (this.onMessageCallback = cb);

  public postMessage = async (msg: InternalMessage | PortWontRespondError) => {
    return (await this.portPromise).postMessage(msg);
  };
}

export default PostMessage;
