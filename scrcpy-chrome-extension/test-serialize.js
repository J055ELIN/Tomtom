import { ScrcpyOptions4_1 } from "./node_modules/@yume-chan/scrcpy/esm/4_1/index.js";
const opt = new ScrcpyOptions4_1({
    videoCodec: "h264",
    maxSize: 1080,
    newDisplay: "1920x1080/160"
});
console.log(opt.serialize());
