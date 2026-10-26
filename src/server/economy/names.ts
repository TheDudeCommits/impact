export const LETTER: Record<string, string> = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's' };
const read = (text: string) => text.toLowerCase().replace(/[0-9@$]/g, digit => LETTER[digit] ?? digit);

export const ANYWHERE = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'faggot', 'retard', 'whore', 'slut', 'hitler', 'kike', 'chink',
  'pussy', 'penis', 'vagina', 'porn', 'twat', 'dildo', 'jizz', 'molest', 'asshole', 'motherf', 'bastard', 'wanker', 'tranny', 'paedo',
  'cocksuck', 'blowjob', 'handjob', 'pedophil', 'paedophil', 'wetback', 'raghead', 'towelhead', 'sandnig', 'shemale', 'cumshot', 'phuck', 'fcuk'];
export const WORDS = new Set(['ass', 'fag', 'fags', 'cum', 'dick', 'cock', 'tit', 'tits', 'sex', 'rape', 'rapist', 'nazi', 'nazis', 'spic', 'coon', 'hoe', 'hoes',
  'kys', 'pedo', 'wank', 'nig', 'gook', 'jap', 'slag', 'anal', 'nonce',
  'dicks', 'cocks', 'fck', 'fuk', 'fuq', 'niga', 'nigs', 'paki', 'pakis', 'dyke', 'dykes', 'heil', 'kkk', 'boob', 'boobs', 'anus', 'spaz']);

export function blockedName(name: string): boolean {
  const whole = read(name.replace(/_/g, ''));
  if (ANYWHERE.some(word => whole.includes(word))) return true;
  return [whole, ...name.split('_').filter(Boolean).map(read)].some(word => WORDS.has(word));
}
