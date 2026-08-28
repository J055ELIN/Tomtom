import fetch from "node-fetch";
import https from "https";
import fs from "fs";

const agent = new https.Agent({ rejectUnauthorized: false });

(async () => {
    try {
        const res = await fetch("https://github.com/Genymobile/scrcpy/releases/download/v4.1/scrcpy-server-v4.1", { agent, redirect: 'follow' });
        const buffer = await res.arrayBuffer();
        fs.writeFileSync("scrcpy-server.jar", Buffer.from(buffer));
        console.log("Downloaded scrcpy-server v4.1");
    } catch (e) {
        console.error(e);
    }
})();
