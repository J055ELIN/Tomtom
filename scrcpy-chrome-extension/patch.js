const fs = require('fs');
let code = fs.readFileSync('src/index.js', 'utf8');
code = code.replace(/    } catch \(e\) {\n        console.error\(e\);\n        statusText.innerText = "Error: " \+ e.message;\n        alert\(e.message\);\n    }\n}\);/g, `    } catch (e) {
        console.error(e);
        if (e.output) {
            console.error("Scrcpy Server Error Output:", e.output.join("\\n"));
            statusText.innerText = "Error (Server exited): " + e.output[0];
        } else {
            statusText.innerText = "Error: " + e.message;
        }
        alert(e.message + (e.output ? "\\nCheck console for server logs." : ""));
    }
});`);
fs.writeFileSync('src/index.js', code);
