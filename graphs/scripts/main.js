import { initAlgorithmPanel } from "./features/algorithms/controller.js";
import { initEditor } from "./features/editor/controller.js";
import { initFileIO } from "./features/file-io/controller.js";
import { initInspector } from "./features/inspector/controller.js";
import { initUserAlgorithms } from "./features/user-algorithms/controller.js";
import { initWorkspace } from "./ui/workspace.js";

initEditor();
initAlgorithmPanel();
initUserAlgorithms();
initInspector();
initFileIO();
initWorkspace();
