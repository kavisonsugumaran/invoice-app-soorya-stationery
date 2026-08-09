declare module "nspell" {
  type Dictionary = {
    aff: Uint8Array | string;
    dic?: Uint8Array | string;
  };

  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): boolean;
    add(word: string): NSpell;
    remove(word: string): NSpell;
  }

  function nspell(dictionary: Dictionary | Dictionary[]): NSpell;
  export default nspell;
}
