import { GUARD_GUIDE } from '../guardGuide';
import { promptKey, type PromptOptions } from '../prompts';
import './defence.css';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const DEFENCE_KEYED: Readonly<Record<(typeof GUARD_GUIDE)[number]['name'], boolean>> = { Block: true, 'Perfect Parry': true, 'Guard Break': false };

export function defenceBasics(options: PromptOptions = {}): string {
  return GUARD_GUIDE.map(g => `<li><span class="ux-defence-key">${DEFENCE_KEYED[g.name] ? promptKey('guard', options) : ''}</span><span class="ux-defence-name"><b>${escape(g.name.toUpperCase())}</b><small>${escape(g.how.toUpperCase())}</small></span><span class="ux-defence-line">${escape(g.line)}</span></li>`).join('');
}
