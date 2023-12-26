import {init} from "./hooks/init.mjs";
import {ready} from "./hooks/ready.mjs";
import {renderHotbar} from "./hooks/renderHotbar.mjs";

Hooks.once("init", init);
Hooks.once("ready", ready);
Hooks.on("renderHotbar", renderHotbar);