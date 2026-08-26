/**
 * App Version Control
 * 
 * Update this version number for every fix/update pushed to production.
 * Format: MAJOR.MINOR.PATCH (Semantic Versioning)
 * 
 * MAJOR - Breaking changes / major features
 * MINOR - New features / significant improvements  
 * PATCH - Bug fixes / small improvements
 */

export const APP_VERSION = "2.2.2"

// Human-readable changelog for the current version
export const VERSION_CHANGELOG = "Fix utang checkout error - skip amount validation for utang payment method"

// Build timestamp (auto-updated)
export const BUILD_DATE = new Date().toISOString().split('T')[0]
