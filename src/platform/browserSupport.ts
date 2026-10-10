/**
 * True when this browser lets a page open a folder on the computer, which connecting to the radio needs.
 * Chrome and Edge do. The check looks for the feature itself, not the browser's name.
 */
export const canOpenRadioDrive = (): boolean => typeof window !== 'undefined' && 'showDirectoryPicker' in window
