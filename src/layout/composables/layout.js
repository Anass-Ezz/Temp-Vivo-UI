import { computed, reactive, watch } from 'vue';

// Read persisted preference; default to 'dark' if nothing was stored
const storedTheme = localStorage.getItem('ems-dark-theme');
const initialDark = storedTheme === null ? true : storedTheme === 'true';

// Apply the class immediately before Vue mounts so there is no flash of light content
if (initialDark) {
    document.documentElement.classList.add('app-dark');
} else {
    document.documentElement.classList.remove('app-dark');
}

const layoutConfig = reactive({
    preset: 'Aura',
    primary: 'emerald',
    surface: null,
    darkTheme: initialDark,
    menuMode: 'static'
});

const layoutState = reactive({
    staticMenuDesktopInactive: false,
    overlayMenuActive: false,
    profileSidebarVisible: false,
    configSidebarVisible: false,
    staticMenuMobileActive: false,
    menuHoverActive: false,
    activeMenuItem: null
});

// Persist theme changes to localStorage and keep the DOM class in sync
watch(
    () => layoutConfig.darkTheme,
    (dark) => {
        document.documentElement.classList.toggle('app-dark', dark);
        localStorage.setItem('ems-dark-theme', String(dark));
    }
);

/**
 * Composable providing access to the global layout configuration and state.
 * Handles sidebar toggling, dark/light theme switching (with localStorage persistence),
 * and active menu item tracking.
 *
 * @returns {{ layoutConfig: Object, layoutState: Object, toggleMenu: Function,
 *   isSidebarActive: ComputedRef, isDarkTheme: ComputedRef, getPrimary: ComputedRef,
 *   getSurface: ComputedRef, setActiveMenuItem: Function, toggleDarkMode: Function }}
 */
export function useLayout() {
    const setActiveMenuItem = (item) => {
        layoutState.activeMenuItem = item.value || item;
    };

    const toggleDarkMode = () => {
        if (!document.startViewTransition) {
            executeDarkModeToggle();
            return;
        }
        document.startViewTransition(() => executeDarkModeToggle());
    };

    const executeDarkModeToggle = () => {
        // Toggle the reactive state; the watcher above handles DOM + localStorage
        layoutConfig.darkTheme = !layoutConfig.darkTheme;
    };

    const toggleMenu = () => {
        if (layoutConfig.menuMode === 'overlay') {
            layoutState.overlayMenuActive = !layoutState.overlayMenuActive;
        }

        if (window.innerWidth > 991) {
            layoutState.staticMenuDesktopInactive = !layoutState.staticMenuDesktopInactive;
        } else {
            layoutState.staticMenuMobileActive = !layoutState.staticMenuMobileActive;
        }
    };

    const isSidebarActive = computed(() => layoutState.overlayMenuActive || layoutState.staticMenuMobileActive);
    const isDarkTheme = computed(() => layoutConfig.darkTheme);
    const getPrimary = computed(() => layoutConfig.primary);
    const getSurface = computed(() => layoutConfig.surface);

    return {
        layoutConfig,
        layoutState,
        toggleMenu,
        isSidebarActive,
        isDarkTheme,
        getPrimary,
        getSurface,
        setActiveMenuItem,
        toggleDarkMode
    };
}

