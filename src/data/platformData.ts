export const platformInfo = {
  steam: { name: 'Steam', color: 'bg-blue-600', icon: '🟦' },
  epic: { name: 'Epic Games', color: 'bg-gray-800', icon: '⚫' },
  xbox: { name: 'Xbox', color: 'bg-green-600', icon: '🟢' },
  gog: { name: 'GOG', color: 'bg-purple-600', icon: '🟣' }
};

export type PlatformInfo = typeof platformInfo[keyof typeof platformInfo];
