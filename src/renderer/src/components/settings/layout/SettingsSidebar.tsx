import React from 'react';
import {
  SETTINGS_CATEGORIES_GROUPED,
  type SettingsSectionMetadata
} from '../registry/settings-registry';
import type { SettingsSectionId } from '../../../../../shared/types';

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onSelectSection: (sectionId: SettingsSectionId) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeSection,
  onSelectSection
}) => {
  return (
    <aside className="w-56 flex-shrink-0 border-r border-border bg-surface-elevated/40 backdrop-blur-sm p-3 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-6">
        {SETTINGS_CATEGORIES_GROUPED.map((group) => (
          <div key={group.category} className="space-y-1">
            <h4 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted font-mono">
              {group.category}
            </h4>

            <div className="space-y-0.5 pt-1">
              {group.sections.map((section: SettingsSectionMetadata) => {
                const Icon = section.icon;
                const isSelected = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    onClick={() => onSelectSection(section.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-surface-active text-foreground font-semibold'
                        : 'text-foreground-secondary hover:text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isSelected ? 'text-foreground' : 'text-foreground-muted'
                      }`}
                    />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border px-2 text-[11px] font-mono text-foreground-muted">
        Orbito Desktop v0.1.0
      </div>
    </aside>
  );
};
