/** The game's Discord server, on the party page (the owner, 8 October 2026: "Need friends to play with? Join our Discord
 *  server! And then have the discord logo (stylized in our art style) and clicking it should take the user to our discord
 *  server to join"). One <button> (the logo and the words), so a pad and the keyboard reach it as they reach every other
 *  control on the sheet (SocialDialog.controller collects buttons, inputs and selects); it opens the invite in a new tab,
 *  as the legal pages open theirs. */
// (The owner's new invite, 8 October 2026: "Change the discord link to this: https://discord.gg/dCSHhJ73bW".)
export const DISCORD_INVITE = 'https://discord.gg/dCSHhJ73bW';
export const DISCORD_COPY = 'Need friends to play with? Join our Discord server!';
/** The Discord mark, its shape untouched: Phosphor Icons' discord-logo, fill weight (MIT licence, phosphoricons.com).
 *  party.css inks it: black on paper, white on ink when pressed or focused. */
const MARK = '<svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path d="M247.51,174.39,218,58a16.08,16.08,0,0,0-13-11.88l-36.06-5.92a16.22,16.22,0,0,0-18.26,11.88l-.21.85a4,4,0,0,0,3.27,4.93,155.62,155.62,0,0,1,24.41,5.62,8.2,8.2,0,0,1,5.62,9.7,8,8,0,0,1-10.19,5.64,155.4,155.4,0,0,0-90.8-.1,8.22,8.22,0,0,1-10.28-4.81,8,8,0,0,1,5.08-10.33,156.85,156.85,0,0,1,24.72-5.72,4,4,0,0,0,3.27-4.93l-.21-.85A16.21,16.21,0,0,0,87.08,40.21L51,46.13A16.08,16.08,0,0,0,38,58L8.49,174.39a15.94,15.94,0,0,0,9.06,18.51l67,29.71a16.17,16.17,0,0,0,21.71-9.1l3.49-9.45a4,4,0,0,0-3.27-5.35,158.13,158.13,0,0,1-28.63-6.2,8.2,8.2,0,0,1-5.61-9.67,8,8,0,0,1,10.2-5.66,155.59,155.59,0,0,0,91.12,0,8,8,0,0,1,10.19,5.65,8.19,8.19,0,0,1-5.61,9.68,157.84,157.84,0,0,1-28.62,6.2,4,4,0,0,0-3.27,5.35l3.49,9.45a16.18,16.18,0,0,0,21.71,9.1l67-29.71A15.94,15.94,0,0,0,247.51,174.39ZM92,152a12,12,0,1,1,12-12A12,12,0,0,1,92,152Zm72,0a12,12,0,1,1,12-12A12,12,0,0,1,164,152Z"/></svg>';
/** The block: the mark and the words, one control. `compact`: the party's secondary row. */
export function discordButton(compact = false) {
  return `<button type="button" class="pt-discord${compact ? ' pt-compact' : ''}" data-party-discord="${DISCORD_INVITE}" data-focus="discord" aria-label="${DISCORD_COPY} (Discord opens in a new tab)"><span class="pt-discord-mark">${MARK}</span><span class="pt-discord-copy">Need friends to play with? <b>Join our Discord server!</b></span><i aria-hidden="true">↗</i></button>`;
}
/** The invite, in a new tab that cannot reach back into this one. */
export function openDiscord(open: (url: string, target: string, features: string) => unknown = (url, target, features) => window.open(url, target, features)) {
  open(DISCORD_INVITE, '_blank', 'noopener');
}
