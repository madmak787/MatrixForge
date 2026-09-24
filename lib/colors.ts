export const TABLE_COLORS = [
  { name: 'Matrix Green', hex: '#00ff41', bg: '#00ff4120', border: '#00ff41' },
  { name: 'Cyber Blue', hex: '#00d4ff', bg: '#00d4ff20', border: '#00d4ff' },
  { name: 'Neon Pink', hex: '#ff006e', bg: '#ff006e20', border: '#ff006e' },
  { name: 'Electric Purple', hex: '#b537f2', bg: '#b537f220', border: '#b537f2' },
  { name: 'Acid Yellow', hex: '#ffbe0b', bg: '#ffbe0b20', border: '#ffbe0b' },
  { name: 'Toxic Green', hex: '#39ff14', bg: '#39ff1420', border: '#39ff14' },
  { name: 'Ice Blue', hex: '#00f0ff', bg: '#00f0ff20', border: '#00f0ff' },
  { name: 'Sunset Orange', hex: '#ff6b6b', bg: '#ff6b6b20', border: '#ff6b6b' },
  { name: 'Mint', hex: '#00d084', bg: '#00d08420', border: '#00d084' },
  { name: 'Violet', hex: '#9d4edd', bg: '#9d4edd20', border: '#9d4edd' },
  { name: 'Deep Pink', hex: '#e71e63', bg: '#e71e6320', border: '#e71e63' },
  { name: 'Sky Cyan', hex: '#00bcd4', bg: '#00bcd420', border: '#00bcd4' }
]

export const getColorByIndex = (index: number) => {
  return TABLE_COLORS[index % TABLE_COLORS.length]
}

export const getColorByName = (name: string) => {
  return TABLE_COLORS.find(c => c.name === name) || TABLE_COLORS[0]
}
