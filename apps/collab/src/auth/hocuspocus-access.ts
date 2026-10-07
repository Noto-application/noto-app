import type { ConnectionConfiguration } from '@hocuspocus/server';

export function applyHocuspocusReadOnly(connection: ConnectionConfiguration, readOnly: boolean) {
  connection.readOnly = readOnly;
}