import { ThemeProvider as NextThemesProvider } from "next-themes";

const THEME_STORAGE_KEY = "esm-theme";

/**
 * App-wide colour scheme provider.
 *
 * Toggles the `dark` class on `<html>` (which `styles.css` keys off) and
 * remembers the choice in localStorage. Defaults to the dark "Shroud" theme,
 * with "system" and the light "Embervale" theme available from the toggle.
 */
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
    >
      {children}
    </NextThemesProvider>
  );
};
