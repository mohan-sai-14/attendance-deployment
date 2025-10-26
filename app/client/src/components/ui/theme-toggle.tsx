import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Get the icon based on the current theme
  const ThemeIcon = () => {
    if (theme === "light") return <Sun className="h-5 w-5 text-yellow-500" />;
    if (theme === "dark") return <Moon className="h-5 w-5 text-neon-blue" />;
    return <Monitor className="h-5 w-5 text-foreground/70" />;
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="rounded-full p-2.5 bg-background/80 backdrop-blur-sm border border-border/30 hover:border-border/50 transition-all shadow-md hover:shadow-lg"
        aria-label="Toggle theme"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <ThemeIcon />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 p-1 rounded-lg bg-background/90 backdrop-blur-sm border border-border/20 shadow-lg z-50"
          >
            <div className="flex flex-col gap-1 min-w-36">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTheme("light");
                  setIsDropdownOpen(false);
                }}
                className={`justify-start rounded-md px-3 py-2 text-sm ${
                  theme === "light" ? "bg-accent/10 text-accent font-medium" : "text-foreground/70"
                }`}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTheme("dark");
                  setIsDropdownOpen(false);
                }}
                className={`justify-start rounded-md px-3 py-2 text-sm ${
                  theme === "dark" ? "bg-accent/10 text-accent font-medium" : "text-foreground/70"
                }`}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTheme("system");
                  setIsDropdownOpen(false);
                }}
                className={`justify-start rounded-md px-3 py-2 text-sm ${
                  theme === "system" ? "bg-accent/10 text-accent font-medium" : "text-foreground/70"
                }`}
              >
                <Monitor className="h-4 w-4 mr-2" />
                System
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
