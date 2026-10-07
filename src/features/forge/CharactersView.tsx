import type { CharacterLook } from "../../types";
import { ForgeView } from "./ForgeView";

/** Characters tab: the Forge. (The film's colour grade lives in Looks.) */
export function CharactersView(props: { characters: CharacterLook[]; onSaveCharacter: (c: CharacterLook) => void }) {
  return <ForgeView characters={props.characters} onSave={props.onSaveCharacter} />;
}
