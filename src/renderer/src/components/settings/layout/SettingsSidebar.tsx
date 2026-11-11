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
    <aside className="w-56 flex-shrink-0 bg-[#08090c] p-3 flex flex-col justify-between overflow-y-auto select-none font-sans text-xs border-r border-white/[0.05]">
      <div className="space-y-5">
        {SETTINGS_CATEGORIES_GROUPED.map((group) => {
          if (group.sections.length === 0) return null;

          return (
            <div key={group.category} className="space-y-1">
              <h4 className="px-2.5 text-[11px] font-semibold text-[#717784] tracking-wide uppercase font-mono">
                {group.category}
              </h4>

              <div className="space-y-0.5 pt-1">
                {group.sections.map((section: SettingsSectionMetadata) => {
                  const Icon = section.icon;
                  const isSelected =
                    activeSection === section.id ||
                    (activeSection === 'shortcuts' && section.id === 'keybindings') ||
                    (activeSection === 'agents' && section.id === 'providers');

                  const isDisabled = Boolean(section.disabled);

                  return (
                    <button
                      key={section.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) {
                          onSelectSection(section.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left border-0 ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed text-[#717784]'
                          : isSelected
                            ? 'bg-white/[0.09] text-white font-medium cursor-default'
                            : 'text-[#8A8F98] hover:text-[#ECEDEF] hover:bg-white/[0.04] cursor-pointer'
                      }`}
                      title={isDisabled ? `${section.label} (Coming Soon)` : section.label}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 transition-colors ${
                            isSelected ? 'text-white' : 'text-[#717784]'
                          }`}
                        />
                        <span className="truncate">{section.label}</span>
                      </div>

                      {section.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#A4A8AF] border border-white/[0.06]">
                          {section.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
