export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
    success: string;
    error: string;
    warning: string;
  };
  code: {
    added: string;
    addedBg: string;
    removed: string;
    removedBg: string;
    modified: string;
    modifiedBg: string;
    keyword: string;
    string: string;
    number: string;
    comment: string;
    function: string;
    variable: string;
  };
}

const normalizeColor = (color: string): string => {
  if (color === 'gray') return 'grey';
  return color;
};

export const themes: Record<string, Theme> = {
  default: {
    name: 'Default',
    colors: {
      primary: 'white',
      secondary: 'gray',
      accent: 'blue',
      text: 'white',
      background: 'black',
      success: 'green',
      error: 'red',
      warning: 'yellow',
    },
    code: {
      added: 'white',
      addedBg: 'blue',
      removed: 'white',
      removedBg: 'red',
      modified: 'yellow',
      modifiedBg: 'yellow',
      keyword: 'magenta',
      string: 'green',
      number: 'cyan',
      comment: 'grey',
      function: 'blue',
      variable: 'white',
    },
  },
  dark: {
    name: 'Dark',
    colors: {
      primary: '#E0E0E0',
      secondary: '#858585ff',
      accent: '#66B2FF',
      text: '#FFFFFF',
      background: '#000000',
      success: '#00FF88',
      error: '#FF6666',
      warning: '#FFD966',
    },
    code: {
      added: 'white',
      addedBg: '#004466',
      removed: 'white',
      removedBg: '#660000',
      modified: '#FFD966',
      modifiedBg: '#665500',
      keyword: '#FF66FF',
      string: '#66FF99',
      number: '#66B2FF',
      comment: '#808080',
      function: '#66B2FF',
      variable: '#FFFFFF',
    },
  },
  forest: {
    name: 'Forest',
    colors: {
      primary: '#E0E0E0',
      secondary: '#228B22',
      accent: '#FFD966',
      text: '#FFFFFF',
      background: '#000000',
      success: '#00FF88',
      error: '#FF6666',
      warning: '#FFD966',
    },
    code: {
      added: 'white',
      addedBg: '#003322',
      removed: 'white',
      removedBg: '#330000',
      modified: '#FFD966',
      modifiedBg: '#554400',
      keyword: '#00FF88',
      string: '#CCFF66',
      number: '#66FFCC',
      comment: '#808080',
      function: '#00CC66',
      variable: '#FFFFFF',
    },
  },
  sunset: {
    name: 'Sunset',
    colors: {
      primary: '#E0E0E0',
      secondary: '#FFB347',
      accent: '#FF66CC',
      text: '#FFFFFF',
      background: '#000000',
      success: '#00FF88',
      error: '#FF6666',
      warning: '#FFD966',
    },
    code: {
      added: '#00FF88',
      addedBg: '#333300',
      removed: '#FF6666',
      removedBg: '#330000',
      modified: '#FFD966',
      modifiedBg: '#664400',
      keyword: '#FF66CC',
      string: '#FFD966',
      number: '#FF6666',
      comment: '#808080',
      function: '#FF66CC',
      variable: '#FFFFFF',
    },
  },
  monochrome: {
    name: 'Monochrome',
    colors: {
      primary: 'white',
      secondary: 'grey',
      accent: 'white',
      text: 'white',
      background: 'black',
      success: 'white',
      error: 'white',
      warning: 'grey',
    },
    code: {
      added: 'white',
      addedBg: 'white',
      removed: 'grey',
      removedBg: 'black',
      modified: 'white',
      modifiedBg: 'grey',
      keyword: 'white',
      string: 'grey',
      number: 'white',
      comment: 'grey',
      function: 'white',
      variable: 'white',
    },
  },
};

Object.keys(themes).forEach((themeName) => {
  const theme = themes[themeName];
  for (const section of ['colors', 'code'] as const) {
    for (const key of Object.keys(theme[section])) {
      // @ts-ignore - indexation dynamique
      theme[section][key] = normalizeColor(theme[section][key]);
    }
  }
});

export function getTheme(themeName: string): Theme {
  return themes[themeName] || themes.default;
}

export function getThemeNames(): string[] {
  return Object.keys(themes);
}
