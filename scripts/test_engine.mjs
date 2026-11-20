import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import compiled or transpile via tsx / node
const monzaPath = path.join(__dirname, '../src/data/circuits/monza.json');
const monzaData = JSON.parse(fs.readFileSync(monzaPath, 'utf8'));

console.log("Monza loaded successfully!");
console.log("Track Name:", monzaData.fullName);
console.log("Segments count:", monzaData.segments.length);
console.log("Telemetry distance points:", monzaData.telemetry.distance.length);
console.log("Pole Driver:", monzaData.poleDriver, "Time:", monzaData.poleLapTime);
