export interface ThemeDefinition {
  name: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
    card: string;
    cardForeground: string;
    sidebarBackground: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    ring: string;
  };
  gradient: {
    start: string;
    end: string;
  };
}

export interface SavedTheme extends ThemeDefinition {
  id: string;
  createdAt: string;
}