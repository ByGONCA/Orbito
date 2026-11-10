/**
 * Orbito Official Plugin SDK
 * Facilitates creating official and community extensions for Orbito.
 */

import type {
  ExtensionManifest,
  ExtensionContext,
  ExtensionPermissions,
  IExtensionModule,
  CatalogPluginItem
} from '../extensions';

export type {
  ExtensionManifest,
  ExtensionContext,
  ExtensionPermissions,
  IExtensionModule,
  CatalogPluginItem
};

export interface OrbitoPluginDefinition {
  manifest: ExtensionManifest;
  activate: (context: ExtensionContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
}

/**
 * Type-safe helper to define an Orbito extension with full autocomplete.
 */
export function definePlugin(definition: OrbitoPluginDefinition): OrbitoPluginDefinition {
  return definition;
}
