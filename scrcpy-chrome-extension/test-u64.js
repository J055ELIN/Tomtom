import { struct, u64, u32, u8 } from "@yume-chan/struct";
import { ScrcpyOptions4_1 } from "@yume-chan/scrcpy";

try {
    const InjectTouchControlMessage = struct(
        {
            type: u8,
            action: u8,
            pointerId: u64,
            pointerX: u32,
            pointerY: u32,
            videoWidth: u32,
            videoHeight: u32,
            pressure: u32,
            actionButton: u32,
            buttons: u32,
        },
        { littleEndian: false }
    );
    
    console.log("Creating touch with -1n");
    const msg = {
        type: 2, action: 0, pointerId: -1n,
        pointerX: 10, pointerY: 10, videoWidth: 100, videoHeight: 100,
        pressure: 1, actionButton: 1, buttons: 1
    };
    
    InjectTouchControlMessage.serialize(msg);
    console.log("Success with -1n!");
} catch (e) {
    console.error("Failed!", e.message);
}
