import type { InternalMessage } from '../types';
import type { PortId, PortName } from './port';

export interface WaittingReply {
  message: InternalMessage;
  to: {
    portName: PortName;
    portId: PortId;
  };
  from: {
    portName: PortName;
    portId: PortId;
  };
}

export const createWaittingReplyQueue = () => {
  let waittingReplies: Array<WaittingReply> = [];

  return {
    add: (...receipts: WaittingReply[]) => {
      waittingReplies = [...waittingReplies, ...receipts];
    },
    remove: (message: string | WaittingReply[]) => {
      waittingReplies =
        typeof message === 'string'
          ? waittingReplies.filter((receipt) => receipt.message.taskId !== message)
          : waittingReplies.filter((receipt) => !message.includes(receipt));
    },
    entries: () => waittingReplies,
  };
};
