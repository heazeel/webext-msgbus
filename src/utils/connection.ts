import type { PortId, PortName } from './port';

export interface ConnectionArgs {
  portName: PortName;
  portId: PortId;
}

const isValidConnectionArgs = (args: any): boolean => {
  return (
    typeof args === 'object' && args !== null && ['portName', 'portId'].every((key) => key in args)
  );
};

/**
 * 编码参数，返回字符串
 * @param args
 * @returns
 */
export const encodeConnectionArgs = (args: ConnectionArgs): string => {
  return JSON.stringify(args);
};

/**
 * 解码参数，返回 'portName', 'portId'
 * @param encodedArgs
 * @returns {portName, portId}
 */
export const decodeConnectionArgs = (encodedArgs: string): ConnectionArgs | null => {
  try {
    const args = JSON.parse(encodedArgs);
    return isValidConnectionArgs(args) ? args : null;
  } catch (error) {
    return null;
  }
};
