import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return sessionStorage.getItem('diney-theme') || 'light'
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        sessionStorage.setItem('diney-theme', theme)
    }, [theme])

    const toggleTheme = () => {
        const html = document.documentElement
        html.classList.add('theme-transitioning')
        setTheme(prev => prev === 'light' ? 'dark' : 'light')
        setTimeout(() => html.classList.remove('theme-transitioning'), 500)
    }

    // Backward-compat aliases — existing components that use isDark/toggleDark keep working
    const isDark = theme === 'dark'
    const toggleDark = toggleTheme

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark, toggleDark }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    return useContext(ThemeContext)
}
