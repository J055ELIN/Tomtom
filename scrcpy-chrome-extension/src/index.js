import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import { AdbScrcpyClient, AdbScrcpyOptions4_1 } from "@yume-chan/adb-scrcpy";
import { ScrcpyNewDisplay } from "@yume-chan/scrcpy";
import { WebCodecsVideoDecoder, WebGLVideoFrameRenderer } from "@yume-chan/scrcpy-decoder-webcodecs";
import { TinyH264Decoder } from "@yume-chan/scrcpy-decoder-tinyh264";
import { WritableStream } from "@yume-chan/stream-extra";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";

const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const statusText = document.getElementById("status");
const canvas = document.getElementById("videoCanvas");

// Globals to manage connections
let globalDevice = null;
let globalAdb = null;
let globalClient = null;
let globalDecoder = null;
let globalSession = null;

const Manager = AdbDaemonWebUsbDeviceManager.BROWSER;
const CredentialStore = new AdbWebCredentialStore("Chrome ADB Scrcpy");

function updateUI() {
    const inputs = document.querySelectorAll('.opt-input');
    if (globalClient) {
        connectBtn.disabled = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        disconnectBtn.disabled = false;
        inputs.forEach(i => i.disabled = true);
    } else if (globalAdb) {
        connectBtn.disabled = true;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        disconnectBtn.disabled = false;
        inputs.forEach(i => i.disabled = false);
    } else {
        connectBtn.disabled = false;
        startBtn.disabled = true;
        stopBtn.disabled = true;
        disconnectBtn.disabled = true;
        inputs.forEach(i => i.disabled = false);
    }
}

connectBtn.addEventListener("click", async () => {
    try {
        const device = await Manager.requestDevice();
        if (!device) return;
        
        let connection;
        try {
            connection = await device.connect();
        } catch(connErr) {
            console.warn("Connection error (Device in use)", connErr);
            throw new Error("Device is already in use. Please close Android Studio and run 'adb kill-server' in your terminal, then reconnect.");
        }
        
        const authenticate = AdbDaemonTransport.authenticate || (AdbDaemonTransport.default && AdbDaemonTransport.default.authenticate);
        if (!authenticate) {
             throw new Error("Critical internal error: AdbDaemonTransport.authenticate is missing! Dump: " + typeof AdbDaemonTransport);
        }

        const transport = await authenticate.call(AdbDaemonTransport, {
            serial: device.serial,
            connection: connection,
            credentialStore: CredentialStore,
        });
        
        globalDevice = device;
        globalAdb = new Adb(transport);
        statusText.innerText = `Connected: ${device.serial}`;
        updateUI();
    } catch (e) {
        console.error(e);
        if (e.output) {
            console.error("Scrcpy Server Error Output:", e.output.join("\n"));
            statusText.innerText = "Error (Server exited): " + e.output[0];
        } else {
            statusText.innerText = "Error: " + e.message;
        }
        alert(e.message + (e.output ? "\nCheck console for server logs." : ""));
    }
});

startBtn.addEventListener("click", async () => {
    if (!globalAdb) return;
    try {
        statusText.innerText = "Starting Scrcpy...";
        startBtn.disabled = true;
        document.querySelectorAll('.opt-input').forEach(i => i.disabled = true);

        
        const response = await fetch("scrcpy-server.jar");
        const serverBuffer = await response.arrayBuffer();
        
        const serverStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(serverBuffer));
                controller.close();
            }
        });
        
        const sync = await globalAdb.sync();
        try {
            await sync.write({
                filename: "/data/local/tmp/scrcpy-server.jar",
                file: serverStream,
            });
        } finally {
            await sync.dispose();
        }
        
        const maxSize = parseInt(document.getElementById("optMaxSize").value, 10);
        const bitRate = parseInt(document.getElementById("optBitRate").value, 10);
        const maxFps = parseInt(document.getElementById("optMaxFps").value, 10);
        const turnScreenOff = document.getElementById("optTurnScreenOff").checked;
        const stayAwake = document.getElementById("optStayAwake").checked;
        const altDeskStr = document.getElementById("optAltDesk").value;
        const videoCodec = document.getElementById("optVideoCodec").value;
        const videoEnabled = document.getElementById("optVideoEnabled").value === "true";
        const optionsInit = {
            logLevel: "verbose",
            video: videoEnabled,
            videoBitRate: bitRate,
            maxSize: maxSize,
            maxFps: maxFps,
            turnScreenOff: turnScreenOff,
            stayAwake: stayAwake,
            clipboardAutosync: false, // Prevents ID 80 crash
            videoCodec: videoCodec === "tinyh264" ? "h264" : videoCodec,
            videoCodecOptions: videoCodec === "tinyh264" ? "profile=1" : undefined,
            audio: false,
            control: true,
            sendFrameMeta: true,
        };
        
        if (altDeskStr) {
            // e.g. "1920x1080/320"
            const parts = altDeskStr.split("/");
            if (parts.length === 2) {
                const dims = parts[0].split("x");
                optionsInit.displayId = 0; // The virtual display will spawn, but server needs to capture it
                optionsInit.newDisplay = new ScrcpyNewDisplay(
                    parseInt(dims[0], 10),
                    parseInt(dims[1], 10),
                    parseInt(parts[1], 10)
                );
            }
        }
        
        const options = new AdbScrcpyOptions4_1(optionsInit);
        
        globalClient = await AdbScrcpyClient.start(
            globalAdb,
            "/data/local/tmp/scrcpy-server.jar",
            options
        );
        updateUI();
        
        // Consume clipboard to prevent control socket from blocking
        if (options.clipboard) {
            options.clipboard.pipeTo(new WritableStream({
                write(msg) { /* console.log("Clipboard:", msg); */ }
            })).catch(e => console.warn("Clipboard stream err:", e));
        }
        
        if (options.uHidOutput) {
            options.uHidOutput.pipeTo(new WritableStream({
                write(msg) { /* discard */ }
            })).catch(e => console.warn("uHidOutput stream err:", e));
        }
        
        // Log server output for debugging
        globalClient.output.pipeTo(new WritableStream({
            write(line) {
                console.log("[Scrcpy Server]", line);
            }
        })).catch(() => {});
        
        const videoStream = await globalClient.videoStream;
        if (!videoEnabled) {
            // No video stream, just set fake dimensions based on selected Alt Desk
            if (altDeskStr) {
                const parts = altDeskStr.split("/");
                const dims = parts[0].split("x");
                globalSession = { width: parseInt(dims[0], 10), height: parseInt(dims[1], 10) };
            } else {
                globalSession = { width: 1080, height: 2424 }; // Fallback for Pixel 9a
            }
            
            // Paint canvas gray and show message
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (gl) {
                gl.clearColor(0.2, 0.2, 0.2, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
            statusText.innerText = "Control Only Mode Active";
            return;
        }
        if (!videoStream) {
            statusText.innerText = "No video stream";
            return;
        }

        const { metadata, stream } = videoStream;
        
        if (videoCodec === "tinyh264") {
            globalDecoder = new TinyH264Decoder({
                canvas: canvas,
            });
        } else {
            globalDecoder = new WebCodecsVideoDecoder({
                codec: metadata.codec,
                renderer: new WebGLVideoFrameRenderer(canvas),
            });
        }
        
        stream.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                if (chunk.type === "session") {
                    console.log("Video session:", JSON.stringify(chunk));
                    globalSession = chunk;
                    return;
                }
                controller.enqueue(chunk);
            }
        })).pipeTo(globalDecoder.writable).catch(e => {
            console.error(e);
            stopMirroring(); // Stop gracefully on decode error
        });
        
        statusText.innerText = "Streaming";
        
    } catch (e) {
        console.error(e);
        globalClient = null;
        updateUI();
        if (e.output) {
            console.error("Scrcpy Server Error Output:", e.output.join("\n"));
            statusText.innerText = "Error (Server exited): " + e.output[0];
        } else {
            statusText.innerText = "Error: " + e.message;
        }
        alert(e.message + (e.output ? "\nCheck console for server logs." : ""));
    }
});

async function stopMirroring() {
    if (globalClient) {
        try {
            await globalClient.close();
        } catch (e) {
            console.error("Error stopping scrcpy client:", e);
        }
        globalClient = null;
    }
    if (globalDecoder) {
        try {
            globalDecoder.dispose();
        } catch (e) {
            console.error("Error disposing decoder:", e);
        }
        globalDecoder = null;
    }
    
    // Clear canvas
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    canvas.width = canvas.width; // Clear hack for 2d
    
    statusText.innerText = globalAdb ? "Stopped. Ready." : "Disconnected";
    updateUI();
}

stopBtn.addEventListener("click", stopMirroring);

disconnectBtn.addEventListener("click", async () => {
    await stopMirroring();
    
    if (globalAdb) {
        try {
            await globalAdb.close();
        } catch (e) {
            console.error("Error closing ADB:", e);
        }
        globalAdb = null;
    }
    
    // In @yume-chan/adb-daemon-webusb, closing the connection/device is done on the underlying USBDevice if possible.
    // The library doesn't strictly expose `device.close()` in this exact manager flow, but we clear refs.
    globalDevice = null;
    statusText.innerText = "Disconnected";
    updateUI();
});

// --- Input Control Setup ---
let isDragging = false;

function getMouseCoordinates(e) {
    if (!globalSession) return null;

    const rect = canvas.getBoundingClientRect();
    const videoRatio = globalSession.width / globalSession.height;
    const canvasRatio = rect.width / rect.height;
    
    let drawWidth, drawHeight, drawX, drawY;
    if (videoRatio > canvasRatio) {
        drawWidth = rect.width;
        drawHeight = rect.width / videoRatio;
        drawX = 0;
        drawY = (rect.height - drawHeight) / 2;
    } else {
        drawWidth = rect.height * videoRatio;
        drawHeight = rect.height;
        drawX = (rect.width - drawWidth) / 2;
        drawY = 0;
    }
    
    const x = e.clientX - rect.left - drawX;
    const y = e.clientY - rect.top - drawY;
    
    if (x < 0 || x > drawWidth || y < 0 || y > drawHeight) {
        return null;
    }
    
    return {
        x: Math.max(0, Math.min(globalSession.width, (x / drawWidth) * globalSession.width)),
        y: Math.max(0, Math.min(globalSession.height, (y / drawHeight) * globalSession.height))
    };
}

function handleMouseEvent(e) {
    if (!globalClient || !globalClient.controller) return;

    const coords = getMouseCoordinates(e);
    if (!coords && e.type !== 'mouseup' && e.type !== 'mouseleave') return;
    
    let action;
    if (e.type === 'mousedown') {
        canvas.focus();
        action = 0; // Down
        isDragging = true;
    } else if (e.type === 'mouseup' || e.type === 'mouseleave') {
        if (!isDragging) return;
        action = 1; // Up
        isDragging = false;
    } else if (e.type === 'mousemove') {
        if (!isDragging) return;
        action = 2; // Move
    } else {
        return;
    }
    
    // Fallback to last known coords if releasing out of bounds
    const sendX = coords ? coords.x : (canvas._lastX || 0);
    const sendY = coords ? coords.y : (canvas._lastY || 0);
    
    if (coords) {
        canvas._lastX = coords.x;
        canvas._lastY = coords.y;
    }
    
    // For Finger touches, typically buttons = 1 to signify contact (primary)
    const actionButton = 0;
    const buttons = action === 1 ? 0 : 1;
    
    globalClient.controller.injectTouch({
        action,
        pointerId: 1n, // Generic finger 1
        pointerX: Math.round(sendX),
        pointerY: Math.round(sendY),
        videoWidth: globalSession.width,
        videoHeight: globalSession.height,
        pressure: action === 1 ? 0 : 1,
        actionButton: actionButton,
        buttons: buttons
    }).catch(err => console.warn("Failed to inject touch", err));
}

canvas.addEventListener('mousedown', handleMouseEvent);
canvas.addEventListener('mouseup', handleMouseEvent);
canvas.addEventListener('mousemove', handleMouseEvent);
canvas.addEventListener('mouseleave', handleMouseEvent);
canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (globalClient?.controller) {
        // Context menu (right click) maps to back button
        globalClient.controller.backOrScreenOn(0).catch(() => {});
        setTimeout(() => globalClient.controller.backOrScreenOn(1).catch(() => {}), 50);
    }
});

// Basic Keyboard
const KEYCODE_MAP = {
    "Backspace": 67,
    "Enter": 66,
    "Escape": 4, // Back button
    "ArrowUp": 19,
    "ArrowDown": 20,
    "ArrowLeft": 21,
    "ArrowRight": 22,
    "Home": 3,   // Home button
    "Tab": 61,
};

function handleKeyEvent(e) {
    if (!globalClient || !globalClient.controller) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    
    // Ignore browser shortcuts
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.startsWith('F')) return;

    const action = e.type === "keydown" ? 0 : 1;

    // For printable characters, use injectText on keydown
    if (e.key.length === 1) {
        if (action === 0) {
            globalClient.controller.injectText(e.key).catch(() => {});
        }
        return;
    }

    const keyCode = KEYCODE_MAP[e.key];
    if (keyCode) {
        e.preventDefault();
        globalClient.controller.injectKeyCode({
            action: action,
            keyCode: keyCode,
            repeat: 0,
            metaState: 0
        }).catch(() => {});
    }
}

window.addEventListener("keydown", handleKeyEvent);
window.addEventListener("keyup", handleKeyEvent);
