import uid from 'tiny-uid';

import type { RuntimeContext } from '../types';

export type PortId = `uid::${string}`;
export type PortName =
  | 'background'
  | 'popup'
  | 'options'
  | 'sidepanel'
  | `inject-script@${number}`
  | `content-script@${number}`
  | `devtools@${number}`;

export interface PortInfo {
  context: RuntimeContext;
  tabId: number | null;
}

const PORT_NAME_REG =
  /^((?:background$)|devtools|popup|options|sidepanel|content-script|inject-script)(?:@(\d+)?)?$/;

export const createPortId = (): PortId => `uid::${uid(7)}`;

/**
 * 解析端点信息
 * background -> { context: 'background', tabId: null }
 * content-script@123 -> { context: 'content-script', tabId: 123 }
 * devtools@456 -> { context: 'devtools', tabId: 456 }
 * @param portName
 * @returns
 */
export const parseConnectionInfo = (portName: PortName): PortInfo => {
  const [, context, tabId] = portName.match(PORT_NAME_REG) || [];

  return {
    context: context as RuntimeContext,
    tabId: (Number(tabId) as number) || null,
  };
};

/**
 * 格式化端点信息
 * background、popup、options、sidePanel 直接返回 context
 * devtools、content-script、inject-script 返回 context@tabId
 * @param params
 * @returns
 */
export const formatConnectionInfo = ({ context, tabId }: PortInfo): PortName => {
  if (['background', 'popup', 'options', 'sidepanel'].includes(context)) {
    return context as 'background' | 'popup' | 'options' | 'sidepanel';
  }

  return `${context}@${tabId}` as
    | `devtools@${number}`
    | `content-script@${number}`
    | `inject-script@${number}`;
};
