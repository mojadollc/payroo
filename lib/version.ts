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

export const APP_VERSION = "2.2.0"

// Human-readable changelog for the current version
export const VERSION_CHANGELOG = "E-Load: show only active SKUs (skuStatus=true) from Gbits - 622 active out of 1064 total"

// Build timestamp (auto-updated)
export const BUILD_DATE = new Date().toISOString().split('T')[0]
