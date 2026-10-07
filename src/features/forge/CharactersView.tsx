import type { CharacterLook, RigClip } from "../../types";
import { ForgeView } from "./ForgeView";

/** Characters tab: the Forge. (The film's colour grade lives in Looks.) */
export function CharactersView(props: { characters: CharacterLook[]; clips: RigClip[]; onSaveCharacter: (c: CharacterLook) => void }) {
  return <ForgeView characters={props.characters} clips={props.clips} onSave={props.onSaveCharacter} />;
}
