export type TransferableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: TransferableValue }
  | TransferableValue[];

export type VMOptions = {
  memoryLimitMb?: number;
  timeoutMs?: number;
  env?: string;
};

export type EvaluateOptions = Omit<VMOptions, 'memoryLimitMb' | 'env'> & { modifyGlobals?: string };
