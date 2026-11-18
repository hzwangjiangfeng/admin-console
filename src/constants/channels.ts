export const CHANNELS = [
  { id: 1, name: '技术' },
  { id: 2, name: '产品' },
  { id: 3, name: '随笔' },
] as const;
export const CHANNEL_OPTIONS = CHANNELS.map(({ id, name }) => ({ value: id, label: name }));
export function isChannelId(value: number) {
  return CHANNELS.some((channel) => channel.id === value);
}
export function getChannelName(id: number) {
  return CHANNELS.find((channel) => channel.id === id)?.name ?? '未知频道';
}
